import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import { StateChip, SyncChip, VerdictChip } from '@/components/status';
import { db, schema } from '@/lib/db';
import { short, when } from '@/lib/format';
import { listRuns, reportOf, type RunFilters as Filters } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';
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

  return (
    <>
      <PageHeader
        title="Runs"
        description="Every check a linked CLI reported, newest first. Each run is independent evidence about one candidate commit."
      />
      <RunFilters repositories={repositories} />
      {runs.length === 0 ? (
        <div className="empty">
          <h2>{repositories.length === 0 ? 'No runs yet' : 'No runs match these filters'}</h2>
          <p className="muted">
            {repositories.length === 0
              ? 'Register a repository and link the CLI to see runs here.'
              : 'Clear a filter, or run a check with --sync from a linked checkout.'}
          </p>
          {repositories.length === 0 ? (
            <div>
              <Link href="/repositories/new" className="button primary">
                Register a repository
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Result</th>
                <th>Requirement</th>
                <th>Repository</th>
                <th>Change</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(({ run, repository: repo, sync }) => {
                const report = reportOf(run);
                const requirement = report?.requirements[0];
                return (
                  <tr key={run.id}>
                    <td>
                      <Link href={`/runs/${run.id}`} className="row-link">
                        {run.verdict === null ? (
                          <SyncChip state={sync} />
                        ) : (
                          <VerdictChip verdict={run.verdict} />
                        )}
                      </Link>
                    </td>
                    <td>
                      {report === null ? (
                        <span className="faint">pending</span>
                      ) : requirement === undefined ? (
                        <StateChip state="NONE" />
                      ) : (
                        <StateChip state={requirement.state} />
                      )}
                    </td>
                    <td>
                      <Link href={`/repositories/${repo.id}`}>{repo.name}</Link>
                    </td>
                    <td className="mono">
                      {run.requestedBase} {short(run.mergeBase)} → {short(run.headCommit)}
                    </td>
                    <td className="muted" title={run.startedAt.toISOString()}>
                      {when(run.startedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
