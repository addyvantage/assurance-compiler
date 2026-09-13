import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { STALE_AFTER_MS, listEvents } from '@/lib/runs';
import { currentSession, ensureWorkspace } from '@/lib/session';

/**
 * Server-sent events for one run: every stored stage event after `Last-Event-ID` (or `after`),
 * then new ones as they arrive, then a final `report` event when the terminal snapshot lands.
 *
 * ponytail: the source is a 1 s database poll per open stream. Enough for a workspace of one;
 * move to LISTEN/NOTIFY when many browsers watch many runs.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await currentSession();
  if (session === null) return new Response('Unauthorized', { status: 401 });
  const workspace = await ensureWorkspace(session.user);
  const { id } = await context.params;
  const run = await db.query.run.findFirst({
    where: and(eq(schema.run.id, id), eq(schema.run.workspaceId, workspace.id)),
  });
  if (run === undefined) return new Response('Not found', { status: 404 });

  const url = new URL(request.url);
  const afterHeader = request.headers.get('last-event-id') ?? url.searchParams.get('after') ?? '0';
  let after = Number.parseInt(afterHeader, 10);
  if (!Number.isInteger(after) || after < 0) after = 0;

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown, eventId?: number) => {
        const idLine = eventId === undefined ? '' : `id: ${String(eventId)}\n`;
        controller.enqueue(
          encoder.encode(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const finish = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      request.signal.addEventListener('abort', finish);
      let ticks = 0;
      let lastActivity = run.createdAt.getTime();
      while (!closed) {
        const events = await listEvents(run.id, after);
        for (const event of events) {
          lastActivity = Math.max(lastActivity, event.at.getTime());
          send(
            'stage',
            { sequence: event.sequence, at: event.at.toISOString(), stage: event.stage },
            event.sequence,
          );
          after = event.sequence;
        }
        const current = await db.query.run.findFirst({
          columns: { status: true, verdict: true },
          where: eq(schema.run.id, run.id),
        });
        if (current?.status !== 'running') {
          send('report', {
            status: current?.status ?? 'reported',
            verdict: current?.verdict ?? null,
          });
          finish();
          break;
        }
        if (Date.now() - lastActivity > STALE_AFTER_MS) {
          // The CLI stopped reporting. The browser shows the run as stale; nothing is failed.
          send('stale', { lastActivity: new Date(lastActivity).toISOString() });
          finish();
          break;
        }
        if (ticks % 15 === 0) controller.enqueue(encoder.encode(': keep-alive\n\n'));
        ticks += 1;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
