import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  parseCloudRunReport,
  reportHash,
  type CloudRunReport,
  type CloudStage,
} from '@assurance-compiler/sync';
import { db, schema } from './db';
import { reassess } from './reassess';

export type RunRow = typeof schema.run.$inferSelect;
export type RunEventRow = typeof schema.runEvent.$inferSelect;

/** Minutes without an event or report after which a running run is shown as stale. */
export const STALE_AFTER_MS = 2 * 60 * 1000;

export type SyncState = 'live' | 'stale' | 'reported';

/**
 * Synchronization state is about what the server has received, never about the migration.
 * A stale run is one the CLI stopped talking about; it may still be running, or gone.
 */
export function syncState(run: RunRow, lastEventAt: Date | null, now = Date.now()): SyncState {
  if (run.status === 'reported') return 'reported';
  const last = lastEventAt?.getTime() ?? run.createdAt.getTime();
  return now - last > STALE_AFTER_MS ? 'stale' : 'live';
}

export function reportOf(run: RunRow): CloudRunReport | null {
  if (run.report === null) return null;
  const parsed = parseCloudRunReport(run.report);
  // Stored reports were validated on ingress; a failure here means the stored row was edited.
  return parsed.ok ? parsed.value : null;
}

export interface RunFilters {
  readonly repositoryId?: string | undefined;
  readonly verdict?: 'COMPLETE' | 'INCOMPLETE' | 'FAILED' | 'running' | undefined;
}

export async function listRuns(workspaceId: string, filters: RunFilters, limit = 100) {
  const conditions = [eq(schema.run.workspaceId, workspaceId)];
  if (filters.repositoryId !== undefined) {
    conditions.push(eq(schema.run.repositoryId, filters.repositoryId));
  }
  if (filters.verdict === 'running') conditions.push(eq(schema.run.status, 'running'));
  else if (filters.verdict !== undefined) conditions.push(eq(schema.run.verdict, filters.verdict));
  const rows = await db
    .select({ run: schema.run, repository: schema.repository })
    .from(schema.run)
    .innerJoin(schema.repository, eq(schema.repository.id, schema.run.repositoryId))
    .where(and(...conditions))
    .orderBy(desc(schema.run.startedAt))
    .limit(limit);
  const latest = await latestEventTimes(rows.map((row) => row.run.id));
  return rows.map((row) => ({
    ...row,
    sync: syncState(row.run, latest.get(row.run.id) ?? null),
  }));
}

export async function getRun(workspaceId: string, runId: string) {
  const row = await db
    .select({ run: schema.run, repository: schema.repository, cli: schema.cliSession })
    .from(schema.run)
    .innerJoin(schema.repository, eq(schema.repository.id, schema.run.repositoryId))
    .innerJoin(schema.cliSession, eq(schema.cliSession.id, schema.run.cliSessionId))
    .where(and(eq(schema.run.workspaceId, workspaceId), eq(schema.run.id, runId)))
    .limit(1);
  const found = row[0];
  if (found === undefined) return undefined;
  const events = await listEvents(found.run.id, 0);
  const lastEvent = events.at(-1);
  return {
    ...found,
    events,
    report: reportOf(found.run),
    sync: syncState(found.run, lastEvent?.at ?? null),
  };
}

export async function listEvents(runId: string, after: number): Promise<RunEventRow[]> {
  return db
    .select()
    .from(schema.runEvent)
    .where(and(eq(schema.runEvent.runId, runId), gt(schema.runEvent.sequence, after)))
    .orderBy(schema.runEvent.sequence);
}

async function latestEventTimes(runIds: readonly string[]): Promise<Map<string, Date>> {
  if (runIds.length === 0) return new Map();
  const rows = await db
    .select({ runId: schema.runEvent.runId, at: sql<Date>`max(${schema.runEvent.at})` })
    .from(schema.runEvent)
    .where(inArray(schema.runEvent.runId, [...runIds]))
    .groupBy(schema.runEvent.runId);
  return new Map(rows.map((row) => [row.runId, new Date(row.at)]));
}

/* Ingestion. Every function receives the workspace and CLI session already authenticated. */

export interface RunStart {
  readonly runId: string;
  readonly repositoryId: string;
  readonly requestedBase: string;
  readonly baseCommit: string;
  readonly headCommit: string;
  readonly mergeBase: string;
  readonly cliVersion: string;
  readonly startedAt: Date;
}

export type StartOutcome =
  | { readonly ok: true; readonly created: boolean }
  | { readonly ok: false; readonly status: number; readonly message: string };

export async function startRun(
  workspaceId: string,
  cliSessionId: string,
  start: RunStart,
): Promise<StartOutcome> {
  const link = await db.query.cliLink.findFirst({
    where: and(
      eq(schema.cliLink.cliSessionId, cliSessionId),
      eq(schema.cliLink.repositoryId, start.repositoryId),
      eq(schema.cliLink.workspaceId, workspaceId),
    ),
  });
  if (link === undefined) {
    return { ok: false, status: 403, message: 'This CLI is not linked to that repository.' };
  }
  const existing = await db.query.run.findFirst({ where: eq(schema.run.id, start.runId) });
  if (existing !== undefined) {
    return existing.cliSessionId === cliSessionId && existing.workspaceId === workspaceId
      ? { ok: true, created: false }
      : { ok: false, status: 409, message: 'That run ID is already in use.' };
  }
  await db.insert(schema.run).values({
    id: start.runId,
    workspaceId,
    repositoryId: start.repositoryId,
    cliSessionId,
    status: 'running',
    requestedBase: start.requestedBase,
    baseCommit: start.baseCommit,
    headCommit: start.headCommit,
    mergeBase: start.mergeBase,
    cliVersion: start.cliVersion,
    startedAt: start.startedAt,
  });
  return { ok: true, created: true };
}

/** Returns the run only if it belongs to this workspace and CLI session. */
export async function ownedRun(workspaceId: string, cliSessionId: string, runId: string) {
  return db.query.run.findFirst({
    where: and(
      eq(schema.run.id, runId),
      eq(schema.run.workspaceId, workspaceId),
      eq(schema.run.cliSessionId, cliSessionId),
    ),
  });
}

/** Inserts an event once. A repeat of the same sequence is accepted and ignored. */
export async function appendEvent(
  runId: string,
  sequence: number,
  at: Date,
  stage: CloudStage,
): Promise<{ inserted: boolean }> {
  const result = await db
    .insert(schema.runEvent)
    .values({ runId, sequence, at, stage })
    .onConflictDoNothing()
    .returning({ sequence: schema.runEvent.sequence });
  return { inserted: result.length > 0 };
}

export type ReportOutcome =
  | { readonly ok: true; readonly hash: string; readonly duplicate: boolean }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** Stores the terminal report once. The first accepted report is final. */
export async function storeReport(run: RunRow, report: CloudRunReport): Promise<ReportOutcome> {
  if (report.runId !== run.id) {
    return { ok: false, status: 422, message: 'The report is about a different run.' };
  }
  if (
    report.base.commit !== run.baseCommit ||
    report.head.commit !== run.headCommit ||
    report.mergeBase !== run.mergeBase
  ) {
    return { ok: false, status: 422, message: 'The report is about a different change.' };
  }
  const hash = reportHash(report);
  if (run.status === 'reported') {
    return run.reportHash === hash
      ? { ok: true, hash, duplicate: true }
      : { ok: false, status: 409, message: 'A different report was already accepted.' };
  }
  const { agrees } = reassess(report);
  const written = await db
    .update(schema.run)
    .set({
      status: 'reported',
      finishedAt: new Date(report.finishedAt),
      verdict: report.verdict,
      report,
      reportHash: hash,
      reassessmentAgrees: agrees,
    })
    .where(and(eq(schema.run.id, run.id), eq(schema.run.status, 'running')))
    .returning({ reportHash: schema.run.reportHash });
  if (written.length > 0) return { ok: true, hash, duplicate: false };
  // A concurrent report won the write; only an identical report counts as delivered.
  const current = await db.query.run.findFirst({
    columns: { reportHash: true },
    where: eq(schema.run.id, run.id),
  });
  return current?.reportHash === hash
    ? { ok: true, hash, duplicate: true }
    : { ok: false, status: 409, message: 'A different report was already accepted.' };
}
