import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { projectCheckDocument, reportHash, type CloudRunReport } from '@assurance-compiler/sync';
import { GET as authGet, POST as authPost } from '../app/api/auth/[...all]/route';
import { POST as link } from '../app/api/cli/link/route';
import { POST as register } from '../app/api/cli/register/route';
import { POST as postEvent } from '../app/api/cli/runs/[id]/events/route';
import { POST as postReport } from '../app/api/cli/runs/[id]/report/route';
import { POST as startRun } from '../app/api/cli/runs/route';
import { auth } from '../lib/auth';
import { db, schema } from '../lib/db';
import { ensureWorkspace } from '../lib/session';
import { getRun, listEvents, syncState } from '../lib/runs';
import { localDocument } from './support/local-document';

/**
 * Exercises the ingestion routes as functions against the local development database, with
 * real Better Auth sessions. Requires DATABASE_URL and BETTER_AUTH_SECRET (apps/web/.env.local).
 */

interface Actor {
  readonly token: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly email: string;
}

const OID = 'b'.repeat(40);

async function createActor(): Promise<Actor> {
  const email = `test-${randomUUID()}@assurance.invalid`;
  const signedUp = await auth.api.signUpEmail({
    body: { email, password: 'correct-horse-battery-staple', name: 'Test' },
  });
  const token = signedUp.token;
  if (token === null) throw new Error('sign-up returned no session token');
  const workspace = await ensureWorkspace(signedUp.user);
  const repositoryId = randomUUID();
  await db.insert(schema.repository).values({
    id: repositoryId,
    workspaceId: workspace.id,
    name: `repo-${repositoryId.slice(0, 8)}`,
  });
  const registered = await register(
    json('/api/cli/register', { label: 'test-host', cliVersion: '0.1.0' }, token),
  );
  expect(registered.status).toBe(201);
  const linked = await link(json('/api/cli/link', { repositoryId }, token));
  expect(linked.status).toBe(200);
  return { token, workspaceId: workspace.id, repositoryId, email };
}

function json(path: string, body: unknown, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function announce(actor: Actor, runId: string, token = actor.token) {
  return startRun(
    json(
      '/api/cli/runs',
      {
        runId,
        repositoryId: actor.repositoryId,
        requestedBase: 'main',
        baseCommit: OID,
        headCommit: 'c'.repeat(40),
        mergeBase: OID,
        cliVersion: '0.1.0',
        startedAt: new Date().toISOString(),
      },
      token,
    ),
  );
}

function event(runId: string, sequence: number, status: 'running' | 'succeeded') {
  return {
    version: 1,
    runId,
    sequence,
    at: new Date().toISOString(),
    stage: { name: 'environment', status, startedAt: new Date().toISOString() },
  };
}

function reportFor(runId: string): CloudRunReport {
  return projectCheckDocument(localDocument(runId), {
    runId,
    cliVersion: '0.1.0',
    startedAt: new Date(Date.now() - 10_000).toISOString(),
    finishedAt: new Date().toISOString(),
  });
}

let alice: Actor;
let mallory: Actor;

beforeAll(async () => {
  alice = await createActor();
  mallory = await createActor();
});

describe('CLI ingestion', () => {
  it('rejects unauthenticated and unregistered callers', async () => {
    expect((await startRun(json('/api/cli/runs', {}))).status).toBe(401);
    const stranger = await auth.api.signUpEmail({
      body: {
        email: `s-${randomUUID()}@assurance.invalid`,
        password: 'correct-horse-battery-staple',
        name: 'S',
      },
    });
    expect((await announce(alice, randomUUID(), stranger.token ?? '')).status).toBe(403);
  });

  it('refuses to start a run for a repository in another workspace', async () => {
    const response = await startRun(
      json(
        '/api/cli/runs',
        {
          runId: randomUUID(),
          repositoryId: alice.repositoryId,
          requestedBase: 'main',
          baseCommit: OID,
          headCommit: 'c'.repeat(40),
          mergeBase: OID,
          cliVersion: '0.1.0',
          startedAt: new Date().toISOString(),
        },
        mallory.token,
      ),
    );
    expect(response.status).toBe(403);
  });

  it('keeps events and reports scoped to the announcing CLI', async () => {
    const runId = randomUUID();
    expect((await announce(alice, runId)).status).toBe(201);
    const foreignEvent = await postEvent(
      json(`/api/cli/runs/${runId}/events`, event(runId, 1, 'running'), mallory.token),
      params(runId),
    );
    expect(foreignEvent.status).toBe(404);
    const foreignReport = await postReport(
      json(`/api/cli/runs/${runId}/report`, reportFor(runId), mallory.token),
      params(runId),
    );
    expect(foreignReport.status).toBe(404);
    expect(await getRun(mallory.workspaceId, runId)).toBeUndefined();
    expect(await getRun(alice.workspaceId, runId)).toBeDefined();
  });

  it('accepts events idempotently and out of order, and reads them back in sequence', async () => {
    const runId = randomUUID();
    await announce(alice, runId);
    const second = await postEvent(
      json('', event(runId, 2, 'succeeded'), alice.token),
      params(runId),
    );
    const first = await postEvent(json('', event(runId, 1, 'running'), alice.token), params(runId));
    const repeat = await postEvent(
      json('', event(runId, 1, 'running'), alice.token),
      params(runId),
    );
    expect([second.status, first.status, repeat.status]).toEqual([200, 200, 200]);
    expect(((await repeat.json()) as { inserted: boolean }).inserted).toBe(false);
    expect((await listEvents(runId, 0)).map((e) => e.sequence)).toEqual([1, 2]);
    expect((await listEvents(runId, 1)).map((e) => e.sequence)).toEqual([2]);
  });

  it('rejects an event carrying free-form detail', async () => {
    const runId = randomUUID();
    await announce(alice, runId);
    const smuggled = {
      ...event(runId, 1, 'running'),
      stage: { ...event(runId, 1, 'running').stage, detail: 'row values' },
    };
    const response = await postEvent(json('', smuggled, alice.token), params(runId));
    expect(response.status).toBe(422);
  });

  it('stores one validated report, reassesses it, and refuses a different second report', async () => {
    const runId = randomUUID();
    await announce(alice, runId);
    const report = reportFor(runId);
    const first = await postReport(json('', report, alice.token), params(runId));
    expect(first.status).toBe(201);
    const body = (await first.json()) as { reportHash: string };
    expect(body.reportHash).toBe(reportHash(report));

    const stored = await getRun(alice.workspaceId, runId);
    expect(stored?.run.status).toBe('reported');
    expect(stored?.run.verdict).toBe('FAILED');
    expect(stored?.run.reassessmentAgrees).toBe(true);
    expect(stored?.sync).toBe('reported');

    const again = await postReport(json('', report, alice.token), params(runId));
    expect(again.status).toBe(200);
    const different = await postReport(
      json('', { ...report, verdict: 'COMPLETE' }, alice.token),
      params(runId),
    );
    expect(different.status).toBe(409);
    const late = await postEvent(json('', event(runId, 9, 'running'), alice.token), params(runId));
    expect(late.status).toBe(409);
  });

  it('rejects a report about another change or with disallowed fields', async () => {
    const runId = randomUUID();
    await announce(alice, runId);
    const report = reportFor(runId);
    const otherChange = await postReport(
      json('', { ...report, mergeBase: 'a'.repeat(40) }, alice.token),
      params(runId),
    );
    expect(otherChange.status).toBe(422);
    const smuggled = await postReport(
      json('', { ...report, reason: 'secret' }, alice.token),
      params(runId),
    );
    expect(smuggled.status).toBe(422);
    expect((await getRun(alice.workspaceId, runId))?.run.status).toBe('running');
  });

  it('records disagreement when the reported state contradicts the observation', async () => {
    const runId = randomUUID();
    await announce(alice, runId);
    const report = reportFor(runId);
    const lying: CloudRunReport = {
      ...report,
      verdict: 'COMPLETE',
      requirements: [
        {
          id: 'NONEMPTY_MIGRATION_EXECUTION',
          state: 'PROVEN',
          triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
        },
      ],
    };
    expect((await postReport(json('', lying, alice.token), params(runId))).status).toBe(201);
    expect((await getRun(alice.workspaceId, runId))?.run.reassessmentAgrees).toBe(false);
  });

  it('stops accepting a revoked CLI token', async () => {
    const victim = await createActor();
    const cli = await db.query.cliSession.findFirst({
      where: eq(schema.cliSession.workspaceId, victim.workspaceId),
    });
    if (cli?.authSessionId === null || cli === undefined) throw new Error('cli session expected');
    await db.delete(schema.session).where(eq(schema.session.id, cli.authSessionId));
    expect((await announce(victim, randomUUID())).status).toBe(401);
  });

  it('derives synchronization state from recency, not from the assessment', () => {
    const now = Date.now();
    const base = { status: 'running' as const, createdAt: new Date(now - 60_000) };
    expect(syncState(base as never, new Date(now - 30_000), now)).toBe('live');
    expect(syncState(base as never, new Date(now - 10 * 60_000), now)).toBe('stale');
    expect(syncState({ ...base, status: 'reported' } as never, null, now)).toBe('reported');
  });
});

describe('account endpoints', () => {
  it('refuse a CLI token, except for signing that CLI out', async () => {
    const actor = await createActor();
    const session = await authGet(
      new Request('http://localhost/api/auth/get-session', {
        headers: { authorization: `Bearer ${actor.token}` },
      }),
    );
    expect(session.status).toBe(403);
    const approve = await authPost(
      json('/api/auth/device/approve', { userCode: 'ABCDEFGH' }, actor.token),
    );
    expect(approve.status).toBe(403);
    const signOut = await authPost(json('/api/auth/sign-out', {}, actor.token));
    expect(signOut.status).toBe(200);
  });
});
