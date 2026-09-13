import { randomUUID } from 'node:crypto';
import { isRecord, optionalString, readJson } from '@/lib/http';
import { db, schema } from '@/lib/db';
import { authenticateCli, problem } from '@/lib/session';

/** Records the CLI that just completed device authorization. Idempotent per session. */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateCli(request);
  if (!auth.ok) return auth.response;
  const body = await readJson(request, 4096);
  if (!body.ok) return body.response;
  const label = isRecord(body.value) ? optionalString(body.value['label'], 128) : undefined;
  const cliVersion = isRecord(body.value)
    ? optionalString(body.value['cliVersion'], 64)
    : undefined;
  if (label === undefined || cliVersion === undefined) {
    return problem(400, 'label and cliVersion are required.');
  }
  if (auth.cli !== undefined) {
    return Response.json({ cliSessionId: auth.cli.id, workspace: auth.workspace.name });
  }
  const id = randomUUID();
  await db
    .insert(schema.cliSession)
    .values({
      id,
      workspaceId: auth.workspace.id,
      authSessionId: auth.authSessionId,
      label,
      cliVersion,
    })
    .onConflictDoNothing();
  return Response.json({ cliSessionId: id, workspace: auth.workspace.name }, { status: 201 });
}
