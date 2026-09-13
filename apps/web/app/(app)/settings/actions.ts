'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, schema } from '@/lib/db';
import { requireWorkspace } from '@/lib/session';

export async function renameWorkspace(form: FormData): Promise<void> {
  const { workspace } = await requireWorkspace();
  const name = field(form, 'name').trim();
  if (name.length === 0 || name.length > 80) return;
  await db.update(schema.workspace).set({ name }).where(eq(schema.workspace.id, workspace.id));
  revalidatePath('/', 'layout');
}

/** Ends the CLI's credential. Its links and run history remain, marked revoked. */
export async function revokeCliSession(form: FormData): Promise<void> {
  const { workspace } = await requireWorkspace();
  const id = field(form, 'id');
  const cli = await db.query.cliSession.findFirst({
    where: and(eq(schema.cliSession.id, id), eq(schema.cliSession.workspaceId, workspace.id)),
  });
  if (cli === undefined) return;
  if (cli.authSessionId !== null) {
    await db.delete(schema.session).where(eq(schema.session.id, cli.authSessionId));
  }
  await db
    .update(schema.cliSession)
    .set({ revokedAt: new Date(), authSessionId: null })
    .where(eq(schema.cliSession.id, cli.id));
  revalidatePath('/settings');
}

export async function unlinkRepository(form: FormData): Promise<void> {
  const { workspace } = await requireWorkspace();
  const cliSessionId = field(form, 'cliSessionId');
  const repositoryId = field(form, 'repositoryId');
  await db
    .delete(schema.cliLink)
    .where(
      and(
        eq(schema.cliLink.workspaceId, workspace.id),
        eq(schema.cliLink.cliSessionId, cliSessionId),
        eq(schema.cliLink.repositoryId, repositoryId),
      ),
    );
  revalidatePath('/settings');
}

/** Form values are strings or files; only strings are accepted. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
