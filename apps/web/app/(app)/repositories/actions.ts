'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { db, schema } from '@/lib/db';
import { requireWorkspace } from '@/lib/session';

export interface RepositoryFormState {
  readonly error: string | null;
}

const URL_SHAPE = /^(https?:\/\/[^\s]+|git@[^\s:]+:[^\s]+)$/;

export async function createRepository(
  _previous: RepositoryFormState,
  form: FormData,
): Promise<RepositoryFormState> {
  const { workspace } = await requireWorkspace();
  const name = field(form, 'name').trim();
  const remoteUrl = field(form, 'remoteUrl').trim();
  if (name.length === 0 || name.length > 100) {
    return { error: 'Give the repository a name of 1 to 100 characters.' };
  }
  if (remoteUrl !== '' && (remoteUrl.length > 500 || !URL_SHAPE.test(remoteUrl))) {
    return { error: 'The URL must start with https:// or git@ and contain no spaces.' };
  }
  const id = randomUUID();
  const inserted = await db
    .insert(schema.repository)
    .values({ id, workspaceId: workspace.id, name, remoteUrl: remoteUrl === '' ? null : remoteUrl })
    .onConflictDoNothing()
    .returning({ id: schema.repository.id });
  if (inserted.length === 0) {
    return { error: 'A repository with that name already exists in this workspace.' };
  }
  redirect(`/repositories/${id}`);
}

/** Form values are strings or files; only strings are accepted. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
