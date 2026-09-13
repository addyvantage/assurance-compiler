import { eq } from 'drizzle-orm';
import { Activity } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RunList, type RunListItem } from '@/components/app/run-list';
import { PageBody, PageHeading, Topbar } from '@/components/app/topbar';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { db, schema } from '@/lib/db';
import { listRuns, requirementState, type RunFilters as Filters } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';
import { runStatus } from '@/lib/status-kind';
import { RunFilters } from './run-filters';

export const metadata: Metadata = { title: 'Runs' };

const RESULTS = new Set(['COMPLETE', 'INCOMPLETE', 'FAILED', 'running']);

export default async function RunsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ repository?: string; result?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { repository, result } = await searchParams;
  const filters: Filters = {
    repositoryId: repository,
    verdict:
      result !== undefined && RESULTS.has(result) ? (result as Filters['verdict']) : undefined,
  };
  const [repositories, runs] = await Promise.all([
    db
      .select({ id: schema.repository.id, name: schema.repository.name })
      .from(schema.repository)
      .where(eq(schema.repository.workspaceId, workspace.id))
      .orderBy(schema.repository.name),
    listRuns(workspace.id, filters),
  ]);
  const items: RunListItem[] = runs.map(({ run, repository: repo, sync }) => {
    const requirement = requirementState(run);
    return {
      id: run.id,
      repositoryName: repo.name,
      requestedBase: run.requestedBase,
      mergeBase: run.mergeBase,
      headCommit: run.headCommit,
      startedAt: run.startedAt,
      status: runStatus(run.verdict, sync, requirement),
      requirementState: requirement,
      durationMs:
        run.finishedAt === null ? null : run.finishedAt.getTime() - run.startedAt.getTime(),
    };
  });
  const filtered = repository !== undefined || filters.verdict !== undefined;

  return (
    <>
      <Topbar crumbs={[{ label: 'Runs' }]} />
      <PageBody>
        <PageHeading
          title="Runs"
          description="Every check a linked CLI reported, newest first. Each run is separate evidence about one candidate commit."
        />
        <RunFilters
          repositories={repositories}
          repository={repository ?? ''}
          result={result ?? 'all'}
        />
        {items.length > 0 ? (
          <RunList items={items} />
        ) : (
          <div className="rounded-lg border border-line bg-raised shadow-raised">
            {filtered ? (
              <EmptyState
                icon={<Activity />}
                title="No runs match these filters"
                description="Choose another result or repository, or clear the filters."
              >
                <Link href="/runs" className={buttonClass('secondary', 'md')}>
                  Clear filters
                </Link>
              </EmptyState>
            ) : (
              <EmptyState
                icon={<Activity />}
                title="No runs yet"
                description={
                  repositories.length === 0
                    ? 'Register a repository and link the CLI from a checkout of it. Runs appear here as they are reported.'
                    : 'Run a check with --sync from a linked checkout. The run appears here as soon as the CLI announces it.'
                }
              >
                <Link
                  href={repositories.length === 0 ? '/repositories/new' : '/repositories'}
                  className={buttonClass('primary', 'md')}
                >
                  {repositories.length === 0 ? 'Register a repository' : 'Open repositories'}
                </Link>
              </EmptyState>
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}
