import { createHash } from 'node:crypto';
import { projectCheckDocument, projectStage, type CloudRunEvent } from '@assurance-compiler/sync';
import type { CheckDocument, StageRecord } from '@assurance-compiler/core';
import { api, describeFailure, expectOk } from './client.js';
import { normalizeServer, readLink, readToken, spoolReport } from './index.js';

export interface SyncSession {
  readonly server: string;
  readonly runId: string;
  readonly token: string;
  readonly url: string;
  /** Called for every stage transition; delivery is ordered and never blocks the provider. */
  readonly onStage: (record: StageRecord) => void;
  /** Resolves once every queued event has been attempted. */
  readonly drain: () => Promise<void>;
  /** Problems encountered so far, in order. */
  readonly problems: string[];
}

export interface SyncOutcome {
  readonly status: 'reported' | 'failed';
  readonly url: string;
  readonly runId: string;
  readonly reportHash?: string;
  readonly problems: readonly string[];
  readonly spooledTo?: string;
}

/**
 * Announces a run to the linked repository's workspace. Returns a reason string when
 * synchronization cannot start; local verification proceeds either way.
 */
export async function startSync(
  root: string,
  runId: string,
  change: { requestedBase: string; baseCommit: string; headCommit: string; mergeBase: string },
  cliVersion: string,
  startedAt: Date,
  serverOverride: string | undefined,
): Promise<SyncSession | string> {
  const link = await readLink(root);
  if (link === undefined) {
    return 'This checkout is not linked to a repository. Run `assure link <repository-id>` first.';
  }
  let server: string;
  let token: string | undefined;
  try {
    server = normalizeServer(serverOverride ?? link.server);
    token = await readToken(server);
  } catch (error) {
    return describeFailure(error);
  }
  if (token === undefined) return `Not signed in to ${server}. Run \`assure login\`.`;
  try {
    expectOk(
      await api(server, '/api/cli/runs', {
        method: 'POST',
        token,
        retries: 2,
        body: {
          runId,
          repositoryId: link.repositoryId,
          requestedBase: change.requestedBase,
          baseCommit: change.baseCommit,
          headCommit: change.headCommit,
          mergeBase: change.mergeBase,
          cliVersion,
          startedAt: startedAt.toISOString(),
        },
      }),
      'Could not announce the run',
    );
  } catch (error) {
    return describeFailure(error);
  }

  const problems: string[] = [];
  let sequence = 0;
  let delivering = true;
  let queue: Promise<void> = Promise.resolve();
  const onStage = (record: StageRecord) => {
    sequence += 1;
    // After one lost event the run's progress is already incomplete; the final report is
    // what matters, so later events are not worth further waiting.
    if (!delivering) return;
    const event: CloudRunEvent = {
      version: 1,
      runId,
      sequence,
      at: new Date().toISOString(),
      stage: projectStage(record),
    };
    queue = queue.then(async () => {
      try {
        expectOk(
          await api(server, `/api/cli/runs/${runId}/events`, {
            method: 'POST',
            token,
            body: event,
            retries: 1,
          }),
          `Stage ${record.name} ${record.status} was not delivered`,
        );
      } catch (error) {
        delivering = false;
        problems.push(`${describeFailure(error)}; later stage events were not sent`);
      }
    });
  };
  return {
    server,
    runId,
    token,
    url: `${server}/runs/${runId}`,
    onStage,
    drain: () => queue,
    problems,
  };
}

/** Sends the terminal report. On failure the report is spooled for `assure sync`. */
export async function finishSync(
  session: SyncSession,
  document: CheckDocument,
  context: { cliVersion: string; startedAt: Date; localArtifact?: string },
): Promise<SyncOutcome> {
  await session.drain();
  const report = projectCheckDocument(document, {
    runId: session.runId,
    cliVersion: context.cliVersion,
    startedAt: context.startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    ...(context.localArtifact === undefined
      ? {}
      : { localArtifactSha256: sha256(context.localArtifact) }),
  });
  try {
    const body = expectOk(
      await api(session.server, `/api/cli/runs/${session.runId}/report`, {
        method: 'POST',
        token: session.token,
        body: report,
        retries: 2,
      }),
      'The final report was not delivered',
    ) as { reportHash?: string } | null;
    return {
      status: 'reported',
      url: session.url,
      runId: session.runId,
      ...(body?.reportHash === undefined ? {} : { reportHash: body.reportHash }),
      problems: session.problems,
    };
  } catch (error) {
    const spooledTo = await spoolReport({
      server: session.server,
      runId: session.runId,
      report,
    }).catch(() => undefined);
    return {
      status: 'failed',
      url: session.url,
      runId: session.runId,
      problems: [...session.problems, describeFailure(error)],
      ...(spooledTo === undefined ? {} : { spooledTo }),
    };
  }
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
