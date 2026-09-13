import { and, desc, eq, isNull } from 'drizzle-orm';
import { ChevronRight, FolderGit2, Link2, Unlink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageBody, PageHeading, Topbar } from '@/components/app/topbar';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusIcon } from '@/components/ui/status';
import { db, schema } from '@/lib/db';
import { ago } from '@/lib/format';
import { latestRunByRepository, requirementState } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';
import { runStatus } from '@/lib/status-kind';
import { RegisterRepository } from './register-repository';

export const metadata: Metadata = { title: 'Repositories' };

export default async function RepositoriesPage() {
  const { workspace } = await requireWorkspace();
  const [repositories, latest, links] = await Promise.all([
    db
      .select()
      .from(schema.repository)
      .where(eq(schema.repository.workspaceId, workspace.id))
      .orderBy(desc(schema.repository.createdAt)),
    latestRunByRepository(workspace.id),
    db
      .select({ repositoryId: schema.cliLink.repositoryId })
      .from(schema.cliLink)
      .innerJoin(schema.cliSession, eq(schema.cliSession.id, schema.cliLink.cliSessionId))
      .where(
        and(eq(schema.cliLink.workspaceId, workspace.id), isNull(schema.cliSession.revokedAt)),
      ),
  ]);
  const linked = new Set(links.map((link) => link.repositoryId));

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Repositories' }]}
        actions={repositories.length > 0 ? <RegisterRepository /> : undefined}
      />
      <PageBody>
        <PageHeading
          title="Repositories"
          description="Each repository is verified by a CLI you link on your own machine. Results appear here as they are reported."
        />
        {repositories.length === 0 ? (
          <div className="rounded-lg border border-line bg-raised shadow-raised">
            <EmptyState
              icon={<FolderGit2 />}
              title="No repositories yet"
              description="Register the repository you want to verify, then link the assure CLI from a checkout of it. Registering does not connect to GitHub."
            >
              <RegisterRepository size="md" />
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-raised shadow-raised">
            {repositories.map((repository) => {
              const last = latest.get(repository.id);
              const status =
                last === undefined
                  ? null
                  : runStatus(last.run.verdict, last.sync, requirementState(last.run));
              const isLinked = linked.has(repository.id);
              return (
                <li key={repository.id}>
                  <Link
                    href={`/repositories/${repository.id}`}
                    className="group grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3.5 px-4 py-3 transition-colors -outline-offset-2 hover:bg-hover md:grid-cols-[32px_minmax(0,1fr)_120px_minmax(0,220px)_16px]"
                  >
                    <span className="grid size-8 place-items-center rounded-md border border-line bg-sunken text-ink-2">
                      <FolderGit2 className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {repository.name}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {repository.remoteUrl ?? 'No URL recorded'}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'hidden items-center gap-1.5 text-xs md:inline-flex',
                        isLinked ? 'text-ink-2' : 'text-warn-ink',
                      )}
                    >
                      {isLinked ? <Link2 className="size-3.5" /> : <Unlink className="size-3.5" />}
                      {isLinked ? 'CLI linked' : 'Not linked'}
                    </span>
                    <span className="flex min-w-0 items-center justify-end gap-2 text-xs md:justify-start">
                      {status === null || last === undefined ? (
                        <span className="text-ink-3">No runs yet</span>
                      ) : (
                        <>
                          <StatusIcon status={status.kind} size={14} />
                          <span className="text-ink-2">{status.label}</span>
                          <span className="truncate text-ink-3">{ago(last.run.startedAt)}</span>
                        </>
                      )}
                    </span>
                    <ChevronRight className="hidden size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 md:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>
    </>
  );
}
