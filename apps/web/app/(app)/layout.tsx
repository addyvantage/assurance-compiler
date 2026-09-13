import { eq } from 'drizzle-orm';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app/shell';
import { db, schema } from '@/lib/db';
import { short } from '@/lib/format';
import { latestRunByRepository, listRuns, requirementState } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';
import { runStatus } from '@/lib/status-kind';

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const { user, workspace } = await requireWorkspace();
  const [repositories, latest, runs] = await Promise.all([
    db
      .select({ id: schema.repository.id, name: schema.repository.name })
      .from(schema.repository)
      .where(eq(schema.repository.workspaceId, workspace.id))
      .orderBy(schema.repository.name),
    latestRunByRepository(workspace.id),
    listRuns(workspace.id, {}, 8),
  ]);
  return (
    <AppShell
      workspaceName={workspace.name}
      email={user.email}
      repositories={repositories.map((repository) => {
        const last = latest.get(repository.id);
        const status =
          last === undefined
            ? { kind: 'nothing' as const, label: 'No runs yet' }
            : runStatus(last.run.verdict, last.sync, requirementState(last.run));
        return { id: repository.id, name: repository.name, ...status };
      })}
      runs={runs.map(({ run, repository, sync }) => {
        const status = runStatus(run.verdict, sync, requirementState(run));
        return {
          id: run.id,
          repositoryName: repository.name,
          kind: status.kind,
          label: status.label,
          candidate: short(run.headCommit),
          startedAt: run.startedAt.toISOString(),
        };
      })}
    >
      {children}
    </AppShell>
  );
}
