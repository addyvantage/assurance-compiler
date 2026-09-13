import { MAX_EVENT_BYTES, parseCloudRunEvent } from '@assurance-compiler/sync';
import { readJson } from '@/lib/http';
import { appendEvent, ownedRun } from '@/lib/runs';
import { problem, requireCli } from '@/lib/session';

/** One stage transition. Repeats of a sequence number are accepted and ignored. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireCli(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const run = await ownedRun(auth.workspace.id, auth.cli.id, id);
  if (run === undefined) return problem(404, 'No such run for this CLI.');
  const body = await readJson(request, MAX_EVENT_BYTES);
  if (!body.ok) return body.response;
  const event = parseCloudRunEvent(body.value);
  if (!event.ok) return problem(422, `Event rejected: ${event.reason}.`);
  if (event.value.runId !== run.id) return problem(422, 'The event is about a different run.');
  if (run.status !== 'running') return problem(409, 'The run already has its final report.');
  const { inserted } = await appendEvent(
    run.id,
    event.value.sequence,
    new Date(event.value.at),
    event.value.stage,
  );
  return Response.json({ sequence: event.value.sequence, inserted });
}
