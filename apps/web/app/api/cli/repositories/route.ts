import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireCli } from '@/lib/session';

/** Repositories in the CLI's workspace, for `assure link`. */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireCli(request);
  if (!auth.ok) return auth.response;
  const rows = await db
    .select({ id: schema.repository.id, name: schema.repository.name })
    .from(schema.repository)
    .where(eq(schema.repository.workspaceId, auth.workspace.id))
    .orderBy(schema.repository.name);
  return Response.json({ workspace: auth.workspace.name, repositories: rows });
}
