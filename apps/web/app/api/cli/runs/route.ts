import { isRecord, optionalString, readJson } from '@/lib/http';
import { startRun } from '@/lib/runs';
import { problem, requireCli } from '@/lib/session';

const OID = /^[0-9a-f]{40,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Announces a local run before any stage runs, so the browser can follow it. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireCli(request);
  if (!auth.ok) return auth.response;
  const body = await readJson(request, 8192);
  if (!body.ok) return body.response;
  if (!isRecord(body.value)) return problem(400, 'The body must be an object.');
  const v = body.value;
  const runId = optionalString(v['runId'], 36);
  const repositoryId = optionalString(v['repositoryId'], 64);
  const requestedBase = optionalString(v['requestedBase'], 1024);
  const baseCommit = optionalString(v['baseCommit'], 64);
  const headCommit = optionalString(v['headCommit'], 64);
  const mergeBase = optionalString(v['mergeBase'], 64);
  const cliVersion = optionalString(v['cliVersion'], 64);
  const startedAt = optionalString(v['startedAt'], 64);
  if (
    runId === undefined ||
    !UUID.test(runId) ||
    repositoryId === undefined ||
    requestedBase === undefined ||
    baseCommit === undefined ||
    !OID.test(baseCommit) ||
    headCommit === undefined ||
    !OID.test(headCommit) ||
    mergeBase === undefined ||
    !OID.test(mergeBase) ||
    cliVersion === undefined ||
    startedAt === undefined ||
    Number.isNaN(Date.parse(startedAt))
  ) {
    return problem(400, 'The run announcement is incomplete or malformed.');
  }
  const outcome = await startRun(auth.workspace.id, auth.cli.id, {
    runId,
    repositoryId,
    requestedBase,
    baseCommit,
    headCommit,
    mergeBase,
    cliVersion,
    startedAt: new Date(startedAt),
  });
  if (!outcome.ok) return problem(outcome.status, outcome.message);
  return Response.json({ runId }, { status: outcome.created ? 201 : 200 });
}
