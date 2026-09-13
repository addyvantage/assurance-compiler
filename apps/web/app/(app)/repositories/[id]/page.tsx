import { and, desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Command, Identifier } from '@/components/copy-button';
import { PageHeader } from '@/components/shell';
import { SyncChip, VerdictChip } from '@/components/status';
import { db, schema } from '@/lib/db';
import { ago, short, when } from '@/lib/format';
import { listRuns } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';

export const metadata: Metadata = { title: 'Repository' };

export default async function RepositoryPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const repository = await db.query.repository.findFirst({
    where: and(eq(schema.repository.id, id), eq(schema.repository.workspaceId, workspace.id)),
  });
  if (repository === undefined) notFound();

  const links = await db
    .select({ link: schema.cliLink, cli: schema.cliSession })
    .from(schema.cliLink)
    .innerJoin(schema.cliSession, eq(schema.cliSession.id, schema.cliLink.cliSessionId))
    .where(eq(schema.cliLink.repositoryId, repository.id))
    .orderBy(desc(schema.cliLink.linkedAt));
  const activeLinks = links.filter((entry) => entry.cli.revokedAt === null);
  const runs = await listRuns(workspace.id, { repositoryId: repository.id }, 20);
  const serverUrl = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';

  return (
    <>
      <PageHeader
        title={repository.name}
        description={
          <>
            Manual registration{repository.remoteUrl === null ? '' : <> · {repository.remoteUrl}</>}
            . Supported detector: Prisma schema and migrations at the repository root.
          </>
        }
        crumbs={[{ href: '/repositories', label: 'Repositories' }]}
      />

      <section className="section" aria-labelledby="link-heading">
        <div className="section-title">
          <h2 id="link-heading">CLI link</h2>
          {activeLinks.length === 0 ? (
            <span className="chip caution">Not linked</span>
          ) : (
            <span className="chip proven">Linked</span>
          )}
        </div>
        {activeLinks.length === 0 ? (
          <p className="muted" style={{ marginBottom: 16 }}>
            No CLI is linked to this repository. Linking authorizes one CLI installation, on one
            machine, to report runs here. It does not mean that machine is online: results arrive
            only while you run a check with <code>--sync</code>.
          </p>
        ) : (
          <ul className="limits" style={{ listStyle: 'none', paddingLeft: 0, marginBottom: 16 }}>
            {activeLinks.map(({ link, cli }) => (
              <li key={cli.id}>
                Linked from <span className="mono">{cli.label}</span> (assure {cli.cliVersion}) on{' '}
                <span title={link.linkedAt.toISOString()}>{when(link.linkedAt)}</span>; last heard{' '}
                {ago(cli.lastUsedAt)}. Manage in <Link href="/settings">Settings</Link>.
              </li>
            ))}
          </ul>
        )}

        <ol className="steps">
          <li className="step">
            <div>
              <h3>Build the CLI once</h3>
              <p>
                From a checkout of assurance-compiler, with Node 22.12+ and pnpm 9.15.0. The
                commands below assume <code>assure</code> resolves to{' '}
                <code>apps/cli/dist/main.js</code>; use the full path if it does not.
              </p>
              <Command text="pnpm install --frozen-lockfile && pnpm build" />
            </div>
          </li>
          <li className="step">
            <div>
              <h3>Sign this machine in</h3>
              <p>
                Opens a device authorization you approve in this browser. The token is stored in the
                operating system keychain, never in the repository.
              </p>
              <Command text={`assure login --server ${serverUrl}`} />
            </div>
          </li>
          <li className="step">
            <div>
              <h3>Link the checkout to this repository</h3>
              <p>
                Run inside the Git checkout you want to verify. The link is recorded in your user
                configuration, not in the repository.
              </p>
              <Command text={`assure link ${repository.id}`} />
            </div>
          </li>
          <li className="step">
            <div>
              <h3>Run a check and follow it here</h3>
              <p>
                Requires PostgreSQL server tools on PATH and the repository&apos;s own Prisma 6.
                Without <code>--sync</code>, the same command verifies locally and sends nothing.
              </p>
              <Command text="assure check main --seed-sql prisma/seed.sql --expect-table public.User --sync" />
            </div>
          </li>
        </ol>

        <p className="notice" style={{ marginTop: 16 }}>
          What <code>--sync</code> sends: run and repository IDs, commit and blob IDs, branch name,
          requirement and provider IDs, stage statuses and timings, PostgreSQL and Prisma versions,
          SQLSTATE codes, cleanup status, the seed path, migration names, table names and changed
          file paths under <code>prisma/</code>. It never sends database messages, stage details,
          SQL, seed contents, source files, row values, local paths or credentials. If a connection
          fails, the local result and exit code are unchanged.
        </p>
        <div className="faint" style={{ marginTop: 8 }}>
          Repository ID <Identifier value={repository.id} shortLength={8} label="repository ID" />
        </div>
      </section>

      <section className="section" aria-labelledby="runs-heading">
        <div className="section-title">
          <h2 id="runs-heading">Recent runs</h2>
          <Link href={`/runs?repository=${repository.id}`}>All runs for this repository</Link>
        </div>
        {runs.length === 0 ? (
          <p className="muted">
            No runs reported yet. The first run appears here as soon as the CLI announces it.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Change</th>
                  <th>Started</th>
                  <th>Run</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(({ run, sync }) => (
                  <tr key={run.id}>
                    <td>
                      {run.verdict === null ? (
                        <SyncChip state={sync} />
                      ) : (
                        <VerdictChip verdict={run.verdict} />
                      )}
                    </td>
                    <td className="mono">
                      {run.requestedBase} {short(run.mergeBase)} → {short(run.headCommit)}
                    </td>
                    <td className="muted" title={run.startedAt.toISOString()}>
                      {when(run.startedAt)}
                    </td>
                    <td>
                      <Link href={`/runs/${run.id}`} className="row-link mono">
                        {run.id.slice(0, 8)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
