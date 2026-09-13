import { and, eq } from 'drizzle-orm';
import { isRecord, optionalString, readJson } from '@/lib/http';
import { db, schema } from '@/lib/db';
import { problem, requireCli } from '@/lib/session';

/** Binds this CLI session to a repository in its own workspace. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireCli(request);
  if (!auth.ok) return auth.response;
  const body = await readJson(request, 4096);
  if (!body.ok) return body.response;
  const repositoryId = isRecord(body.value)
    ? optionalString(body.value['repositoryId'], 64)
    : undefined;
  if (repositoryId === undefined) return problem(400, 'repositoryId is required.');
  const repository = await db.query.repository.findFirst({
    where: and(
      eq(schema.repository.id, repositoryId),
      eq(schema.repository.workspaceId, auth.workspace.id),
    ),
  });
  if (repository === undefined) return problem(404, 'No such repository in your workspace.');
  await db
    .insert(schema.cliLink)
    .values({ cliSessionId: auth.cli.id, repositoryId, workspaceId: auth.workspace.id })
    .onConflictDoNothing();
  return Response.json({ repository: { id: repository.id, name: repository.name } });
}
