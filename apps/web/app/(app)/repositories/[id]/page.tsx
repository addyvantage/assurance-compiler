import { and, desc, eq, isNull } from 'drizzle-orm';
import { Activity, ExternalLink, FolderGit2, Hand } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Prop, PropertyGroup } from '@/components/app/properties';
import { RunList, type RunListItem } from '@/components/app/run-list';
import { PageBody, Topbar } from '@/components/app/topbar';
import { buttonClass } from '@/components/ui/button';
import { Identifier } from '@/components/ui/copy';
import { Tip } from '@/components/ui/tooltip';
import { db, schema } from '@/lib/db';
import { NEVER_SENT, SENT } from '@/lib/disclosure';
import { ago, when } from '@/lib/format';
import { listRuns, requirementState } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';
import { runStatus } from '@/lib/status-kind';
import { SetupSteps } from './setup-steps';

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

  const [links, authorizedCli, runs] = await Promise.all([
    db
      .select({ link: schema.cliLink, cli: schema.cliSession })
      .from(schema.cliLink)
      .innerJoin(schema.cliSession, eq(schema.cliSession.id, schema.cliLink.cliSessionId))
      .where(
        and(eq(schema.cliLink.repositoryId, repository.id), isNull(schema.cliSession.revokedAt)),
      )
      .orderBy(desc(schema.cliLink.linkedAt)),
    db.query.cliSession.findFirst({
      where: and(
        eq(schema.cliSession.workspaceId, workspace.id),
        isNull(schema.cliSession.revokedAt),
      ),
    }),
    listRuns(workspace.id, { repositoryId: repository.id }, 20),
  ]);
  const serverUrl = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';
  const items: RunListItem[] = runs.map(({ run, sync }) => {
    const requirement = requirementState(run);
    return {
      id: run.id,
      repositoryName: repository.name,
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
  const httpsUrl =
    repository.remoteUrl?.startsWith('https://') === true ? repository.remoteUrl : null;

  return (
    <>
      <Topbar
        crumbs={[{ label: 'Repositories', href: '/repositories' }, { label: repository.name }]}
        actions={
          <Link
            href={`/runs?repository=${repository.id}`}
            className={buttonClass('secondary', 'sm')}
          >
            <Activity />
            All runs
          </Link>
        }
      />
      <PageBody wide>
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <header className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-raised shadow-raised">
                <FolderGit2 className="size-5 text-ink-2" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-[-0.02em]">
                  {repository.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
                  <Tip content="Registered by name. No GitHub access was requested or verified.">
                    <span tabIndex={0} className="inline-flex items-center gap-1.5 rounded-[4px]">
                      <Hand className="size-3.5" />
                      Manual registration
                    </span>
                  </Tip>
                  {httpsUrl !== null ? (
                    <a
                      href={httpsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-w-0 items-center gap-1 hover:text-ink"
                    >
                      <span className="truncate">{httpsUrl}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : repository.remoteUrl === null ? null : (
                    <span className="truncate font-mono">{repository.remoteUrl}</span>
                  )}
                </div>
              </div>
            </header>

            <section className="mt-9">
              <SetupSteps
                steps={[
                  {
                    id: 'login',
                    title: 'Authorize the CLI on your machine',
                    description: (
                      <>
                        Build the CLI once from a checkout of assurance-compiler with{' '}
                        <code className="text-[12.5px] text-ink">
                          pnpm install --frozen-lockfile && pnpm build
                        </code>
                        , then sign in. You approve it in this browser; the token is kept in the
                        operating system keychain, never in a repository.
                      </>
                    ),
                    command: `assure login --server ${serverUrl}`,
                    done: authorizedCli !== undefined,
                    doneText:
                      authorizedCli === undefined ? '' : `Authorized on ${authorizedCli.label}`,
                  },
                  {
                    id: 'link',
                    title: 'Link the checkout of this repository',
                    description:
                      'Run inside the Git checkout you want to verify. The link is saved in your user configuration. Linked means this CLI may report runs here; it does not mean the machine is online.',
                    command: `assure link ${repository.id}`,
                    done: links.length > 0,
                    doneText: links[0] === undefined ? '' : `Linked from ${links[0].cli.label}`,
                  },
                  {
                    id: 'run',
                    title: 'Run a check and follow it here',
                    description:
                      'Needs PostgreSQL server tools on PATH and the repository’s own Prisma 6. Without --sync the same command verifies locally and sends nothing.',
                    command:
                      'assure check main --seed-sql prisma/seed.sql --expect-table public.User --sync',
                    done: items.length > 0,
                    doneText: `${String(items.length)} ${items.length === 1 ? 'run' : 'runs'} reported`,
                  },
                ]}
              />
            </section>

            <section className="mt-11" aria-labelledby="runs-title">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id="runs-title" className="text-sm font-semibold">
                  Recent runs
                </h2>
                {items.length > 0 ? (
                  <Link
                    href={`/runs?repository=${repository.id}`}
                    className="text-xs text-ink-2 hover:text-ink"
                  >
                    View all
                  </Link>
                ) : null}
              </div>
              {items.length > 0 ? (
                <RunList items={items} showRepository={false} />
              ) : (
                <p className="rounded-lg border border-line bg-raised px-4 py-5 text-sm text-ink-2 shadow-raised">
                  No runs reported yet. The first run appears here as soon as the CLI announces it.
                </p>
              )}
            </section>
          </div>

          <aside className="grid content-start gap-6 lg:sticky lg:top-20 lg:self-start">
            <PropertyGroup title="Repository">
              <Prop label="ID">
                <Identifier value={repository.id} label="repository ID" chars={8} />
              </Prop>
              <Prop label="Connection">Manual</Prop>
              <Prop label="Detector">Prisma at root</Prop>
              <Prop label="Registered">
                <time dateTime={repository.createdAt.toISOString()}>
                  {when(repository.createdAt)}
                </time>
              </Prop>
            </PropertyGroup>
            <PropertyGroup title="Linked CLIs">
              {links.length === 0 ? (
                <p className="text-sm text-ink-3">None yet.</p>
              ) : (
                links.map(({ cli }) => (
                  <Prop key={cli.id} label={`assure ${cli.cliVersion}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[12.5px]">{cli.label}</span>
                      <span className="block text-xs text-ink-3">
                        last heard {ago(cli.lastUsedAt)}
                      </span>
                    </span>
                  </Prop>
                ))
              )}
              <Link href="/settings" className="text-xs text-ink-2 hover:text-ink">
                Manage in settings
              </Link>
            </PropertyGroup>
            <PropertyGroup title="What --sync sends">
              <ul className="grid gap-1.5 text-xs text-ink-2">
                {SENT.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <h3 className="mt-2 text-xs font-medium text-ink-3">Never sent</h3>
              <ul className="grid gap-1.5 text-xs text-ink-2">
                {NEVER_SENT.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink-3">
                Names and paths can themselves be sensitive; this is not a zero-data upload. A
                failed upload never changes the local result.
              </p>
            </PropertyGroup>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
