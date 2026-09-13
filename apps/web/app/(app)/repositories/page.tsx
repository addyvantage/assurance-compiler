import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import { SyncChip, VerdictChip } from '@/components/status';
import { db, schema } from '@/lib/db';
import { ago } from '@/lib/format';
import { listRuns } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';

export const metadata: Metadata = { title: 'Repositories' };

export default async function RepositoriesPage() {
  const { workspace } = await requireWorkspace();
  const repositories = await db
    .select()
    .from(schema.repository)
    .where(eq(schema.repository.workspaceId, workspace.id))
    .orderBy(desc(schema.repository.createdAt));
  const runs = await listRuns(workspace.id, {}, 500);
  const latestByRepository = new Map<string, (typeof runs)[number]>();
  for (const entry of runs) {
    if (!latestByRepository.has(entry.run.repositoryId)) {
      latestByRepository.set(entry.run.repositoryId, entry);
    }
  }
  const links = await db
    .select({ repositoryId: schema.cliLink.repositoryId })
    .from(schema.cliLink)
    .innerJoin(schema.cliSession, eq(schema.cliSession.id, schema.cliLink.cliSessionId))
    .where(eq(schema.cliLink.workspaceId, workspace.id));
  const linked = new Set(links.map((link) => link.repositoryId));

  return (
    <>
      <PageHeader
        title="Repositories"
        description="Each repository is verified by a CLI you link on your own machine. Results appear here as they are reported."
        actions={
          <Link href="/repositories/new" className="button primary">
            Register a repository
          </Link>
        }
      />
      {repositories.length === 0 ? (
        <div className="empty">
          <h2>No repositories yet</h2>
          <p className="muted">
            Register the repository you want to verify, then link the assure CLI from a checkout of
            it. Registration records a name and, optionally, a URL; it does not connect to GitHub.
          </p>
          <div>
            <Link href="/repositories/new" className="button primary">
              Register a repository
            </Link>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Latest run</th>
                <th>When</th>
                <th>Next</th>
              </tr>
            </thead>
            <tbody>
              {repositories.map((repository) => {
                const latest = latestByRepository.get(repository.id);
                const isLinked = linked.has(repository.id);
                return (
                  <tr key={repository.id}>
                    <td>
                      <Link href={`/repositories/${repository.id}`} className="row-link">
                        {repository.name}
                      </Link>
                      <div className="faint">
                        {repository.remoteUrl ?? 'no URL'} · manual registration
                      </div>
                    </td>
                    <td>
                      {latest === undefined ? (
                        <span className="faint">no runs</span>
                      ) : latest.run.verdict === null ? (
                        <SyncChip state={latest.sync} />
                      ) : (
                        <VerdictChip verdict={latest.run.verdict} />
                      )}
                    </td>
                    <td className="muted" title={latest?.run.startedAt.toISOString()}>
                      {latest === undefined ? '' : ago(latest.run.startedAt)}
                    </td>
                    <td>
                      {!isLinked ? (
                        <Link href={`/repositories/${repository.id}`}>Link the CLI</Link>
                      ) : latest === undefined ? (
                        <Link href={`/repositories/${repository.id}`}>Run the first check</Link>
                      ) : (
                        <Link href={`/runs/${latest.run.id}`}>Open latest run</Link>
                      )}
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
