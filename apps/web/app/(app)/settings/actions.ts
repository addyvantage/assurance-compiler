'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/lib/db';
import { requireWorkspace } from '@/lib/session';

/** Each action returns whether it took effect, so the page never confirms a change that did not happen. */
export async function renameWorkspace(form: FormData): Promise<boolean> {
  const { workspace } = await requireWorkspace();
  const name = field(form, 'name').trim();
  if (name.length === 0 || name.length > 80) return false;
  await db.update(schema.workspace).set({ name }).where(eq(schema.workspace.id, workspace.id));
  revalidatePath('/', 'layout');
  return true;
}

/** Ends the CLI's credential. Its links and run history remain, marked revoked. */
export async function revokeCliSession(form: FormData): Promise<boolean> {
  const { workspace } = await requireWorkspace();
  const id = field(form, 'id');
  const cli = await db.query.cliSession.findFirst({
    where: and(eq(schema.cliSession.id, id), eq(schema.cliSession.workspaceId, workspace.id)),
  });
  if (cli === undefined) return false;
  if (cli.authSessionId !== null) {
    await db.delete(schema.session).where(eq(schema.session.id, cli.authSessionId));
  }
  await db
    .update(schema.cliSession)
    .set({ revokedAt: new Date(), authSessionId: null })
    .where(eq(schema.cliSession.id, cli.id));
  revalidatePath('/settings');
  return true;
}

export async function unlinkRepository(form: FormData): Promise<boolean> {
  const { workspace } = await requireWorkspace();
  const cliSessionId = field(form, 'cliSessionId');
  const repositoryId = field(form, 'repositoryId');
  const removed = await db
    .delete(schema.cliLink)
    .where(
      and(
        eq(schema.cliLink.workspaceId, workspace.id),
        eq(schema.cliLink.cliSessionId, cliSessionId),
        eq(schema.cliLink.repositoryId, repositoryId),
      ),
    )
    .returning({ repositoryId: schema.cliLink.repositoryId });
  revalidatePath('/settings');
  return removed.length > 0;
}

/** Form values are strings or files; only strings are accepted. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
