import { createHash } from 'node:crypto';
import { assessMigrationExecution, type CheckDocument } from '@assurance-compiler/core';
import { describe, expect, it } from 'vitest';
import {
  parseCloudRunEvent,
  parseCloudRunReport,
  projectCheckDocument,
  reportHash,
} from '../src/index.js';

const OID = 'a'.repeat(40);
const RUN_ID = '93f597ac-a4c0-4d98-8ceb-1d7539d06102';
const SECRET_MESSAGE = 'cannot migrate: ada@example.com';
const LOCAL_PATH = '/Users/someone/private/assure-run-93f597ac-x';

/** A local check document as `assure check --json` prints it, with everything that must stay local. */
const localDocument: CheckDocument = {
  version: 1,
  base: { ref: 'main', commit: 'b'.repeat(40) },
  head: { ref: 'HEAD', commit: 'c'.repeat(40) },
  mergeBase: 'b'.repeat(40),
  detectors: ['prisma'],
  changes: [
    {
      surface: 'DATABASE_SCHEMA_CHANGE',
      detector: 'prisma',
      files: [{ path: 'prisma/migrations/20260913_add_age/migration.sql', status: 'added' }],
    },
  ],
  requirements: [
    {
      id: 'NONEMPTY_MIGRATION_EXECUTION',
      state: 'FAILED',
      triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
      evidence: [
        {
          provider: 'prisma-postgresql',
          commit: 'c'.repeat(40),
          outcome: 'VIOLATES',
          summary: `Candidate migration failed with SQLSTATE 23505: ${SECRET_MESSAGE}.`,
        },
      ],
    },
  ],
  verdict: 'FAILED',
  verification: {
    requirement: 'NONEMPTY_MIGRATION_EXECUTION',
    runId: RUN_ID,
    origin: 'local',
    provider: { id: 'prisma-postgresql', version: '0.1.0' },
    environment: { postgres: '16.14 (Homebrew)', prisma: '6.19.3' },
    subject: {
      baseline: 'b'.repeat(40),
      candidate: 'c'.repeat(40),
      schema: { baseline: OID, candidate: OID },
      seed: { path: 'prisma/seed.sql', blob: OID },
      baselineMigrations: [{ name: '20260801_init', blob: OID }],
      candidateMigrations: [{ name: '20260913_add_age', blob: OID }],
      expectedTables: ['public.User'],
    },
    stages: [
      {
        name: 'environment',
        status: 'succeeded',
        startedAt: '2026-09-13T10:00:00.000Z',
        durationMs: 5100,
        command: 'initdb; pg_ctl start',
        detail: `PostgreSQL 16.14 on 127.0.0.1:5555; Prisma 6.19.3.`,
      },
      {
        name: 'baseline-migrations',
        status: 'succeeded',
        startedAt: '2026-09-13T10:00:05.000Z',
        durationMs: 1800,
        detail: '1 migration applied.',
      },
      {
        name: 'seed',
        status: 'succeeded',
        startedAt: '2026-09-13T10:00:07.000Z',
        durationMs: 1600,
      },
      {
        name: 'population-check',
        status: 'succeeded',
        startedAt: '2026-09-13T10:00:09.000Z',
        durationMs: 100,
        detail: 'Rows present in public.User.',
      },
      {
        name: 'candidate-migrations',
        status: 'failed',
        startedAt: '2026-09-13T10:00:09.000Z',
        durationMs: 1600,
        detail: `Prisma P3018: migration 20260913_add_age failed with SQLSTATE 23505: ${SECRET_MESSAGE}.`,
      },
    ],
    populatedTables: [{ table: 'public.User', populated: true }],
    migrationFailure: { migration: '20260913_add_age', sqlState: '23505', message: SECRET_MESSAGE },
    cleanup: { status: 'failed', leftovers: [`Run directory ${LOCAL_PATH}`] },
  },
};

const context = {
  runId: RUN_ID,
  cliVersion: '0.1.0',
  startedAt: '2026-09-13T10:00:00.000Z',
  finishedAt: '2026-09-13T10:00:12.000Z',
  localArtifactSha256: 'f'.repeat(64),
};

describe('projectCheckDocument', () => {
  const report = projectCheckDocument(localDocument, context);
  const serialized = JSON.stringify(report);

  it('keeps only allowlisted fields', () => {
    expect(serialized).not.toContain(SECRET_MESSAGE);
    expect(serialized).not.toContain(LOCAL_PATH);
    expect(serialized).not.toContain('detail');
    expect(serialized).not.toContain('summary');
    expect(serialized).not.toContain('command');
    expect(report.verification).toMatchObject({
      migrationFailure: { migration: '20260913_add_age', sqlState: '23505' },
      cleanup: { status: 'failed', leftoverCount: 1 },
    });
  });

  it('round-trips through the ingress validator unchanged', () => {
    const parsed = parseCloudRunReport(JSON.parse(serialized));
    expect(parsed).toEqual({ ok: true, value: report });
  });

  it('carries enough for the engine to reassess the reported state', () => {
    const verification = report.verification;
    if (verification === null) throw new Error('verification expected');
    const reassessed = assessMigrationExecution(verification.subject, {
      ...verification,
      requirement: 'NONEMPTY_MIGRATION_EXECUTION',
      origin: 'local',
      cleanup: { status: verification.cleanup.status, leftovers: [] },
    });
    expect(reassessed.state).toBe('FAILED');
  });

  it('has its own hash, which is not the local artifact hash', () => {
    const hash = reportHash(report);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(context.localArtifactSha256);
    // Key order does not change the hash.
    const reordered = JSON.parse(JSON.stringify({ ...report, version: 1 })) as typeof report;
    expect(reportHash(reordered)).toBe(hash);
    expect(hash).toBe(
      createHash('sha256')
        .update(JSON.stringify(sortDeep(report)))
        .digest('hex'),
    );
  });
});

describe('parseCloudRunReport', () => {
  const valid = JSON.parse(JSON.stringify(projectCheckDocument(localDocument, context))) as Record<
    string,
    unknown
  >;

  it.each<[string, (report: Record<string, unknown>) => unknown]>([
    ['an unknown top-level field', (r) => ({ ...r, reason: 'smuggled' })],
    ['a stage detail', (r) => withStage(r, { detail: SECRET_MESSAGE })],
    [
      'a migration failure message',
      (r) =>
        withVerification(r, {
          migrationFailure: { migration: 'x', sqlState: '23505', message: 'm' },
        }),
    ],
    ['a malformed commit', (r) => ({ ...r, mergeBase: 'not-a-commit' })],
    [
      'an unknown requirement',
      (r) => ({ ...r, requirements: [{ id: 'OTHER', state: 'PROVEN', triggeredBy: [] }] }),
    ],
    ['an unknown state', (r) => ({ ...r, verdict: 'OK' })],
    ['a wrong version', (r) => ({ ...r, version: 2 })],
    [
      'a control character in a path',
      (r) => ({ ...r, base: { ref: 'ma\u0000in', commit: 'b'.repeat(40) } }),
    ],
    [
      'a leftover path instead of a count',
      (r) => withVerification(r, { cleanup: { status: 'failed', leftovers: [LOCAL_PATH] } }),
    ],
  ])('rejects %s', (_name, mutate) => {
    const result = parseCloudRunReport(mutate(valid));
    expect(result.ok).toBe(false);
  });

  it('accepts a report without verification', () => {
    const result = parseCloudRunReport({ ...valid, verification: null, verdict: 'INCOMPLETE' });
    expect(result.ok).toBe(true);
  });
});

describe('parseCloudRunEvent', () => {
  it('accepts a stage transition and rejects details', () => {
    const event = {
      version: 1,
      runId: RUN_ID,
      sequence: 3,
      at: '2026-09-13T10:00:05.000Z',
      stage: { name: 'seed', status: 'running', startedAt: '2026-09-13T10:00:05.000Z' },
    };
    expect(parseCloudRunEvent(event)).toEqual({ ok: true, value: event });
    expect(parseCloudRunEvent({ ...event, stage: { ...event.stage, detail: 'x' } }).ok).toBe(false);
    expect(parseCloudRunEvent({ ...event, sequence: 0 }).ok).toBe(false);
  });
});

function withVerification(
  report: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...report, verification: { ...(report['verification'] as object), ...patch } };
}

function withStage(
  report: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const verification = report['verification'] as { stages: Record<string, unknown>[] };
  return withVerification(report, {
    stages: verification.stages.map((stage, index) =>
      index === 0 ? { ...stage, ...patch } : stage,
    ),
  });
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortDeep(entry)]),
    );
  }
  return value;
}
