import { and, eq } from 'drizzle-orm';
import { canonicalJson } from '@assurance-compiler/sync';
import { db, schema } from '@/lib/db';
import { reportOf } from '@/lib/runs';
import { currentSession, ensureWorkspace } from '@/lib/session';

/**
 * The cloud-safe projection as accepted, in canonical byte order, so the download hashes to
 * the recorded report hash. This is not the local evidence file.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await currentSession();
  if (session === null) return new Response('Unauthorized', { status: 401 });
  const workspace = await ensureWorkspace(session.user);
  const { id } = await context.params;
  const run = await db.query.run.findFirst({
    where: and(eq(schema.run.id, id), eq(schema.run.workspaceId, workspace.id)),
  });
  const report = run === undefined ? null : reportOf(run);
  if (run === undefined || report === null || run.reportHash === null) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(canonicalJson(report), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="assure-run-${run.id.slice(0, 8)}-cloud.json"`,
      'x-report-sha256': run.reportHash,
      'cache-control': 'private, no-store',
    },
  });
}
