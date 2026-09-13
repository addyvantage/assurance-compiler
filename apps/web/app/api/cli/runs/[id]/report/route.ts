import { MAX_REPORT_BYTES, parseCloudRunReport } from '@assurance-compiler/sync';
import { readJson } from '@/lib/http';
import { ownedRun, storeReport } from '@/lib/runs';
import { problem, requireCli } from '@/lib/session';

/** The authoritative terminal snapshot. Validated against the allowlist, then stored once. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireCli(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const run = await ownedRun(auth.workspace.id, auth.cli.id, id);
  if (run === undefined) return problem(404, 'No such run for this CLI.');
  const body = await readJson(request, MAX_REPORT_BYTES);
  if (!body.ok) return body.response;
  const report = parseCloudRunReport(body.value);
  if (!report.ok) return problem(422, `Report rejected: ${report.reason}.`);
  const outcome = await storeReport(run, report.value);
  if (!outcome.ok) return problem(outcome.status, outcome.message);
  return Response.json(
    { runId: run.id, reportHash: outcome.hash, duplicate: outcome.duplicate },
    { status: outcome.duplicate ? 200 : 201 },
  );
}
