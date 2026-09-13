import { desc, eq } from 'drizzle-orm';
import { Check, CircleSlash, Laptop } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageBody, PageHeading, Topbar } from '@/components/app/topbar';
import { db, schema } from '@/lib/db';
import { NEVER_SENT, SENT } from '@/lib/disclosure';
import { ago, when } from '@/lib/format';
import { requireWorkspace } from '@/lib/session';
import { RevokeCliButton, ThemeControl, UnlinkButton, WorkspaceNameForm } from './controls';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { workspace, user } = await requireWorkspace();
  const [clis, links] = await Promise.all([
    db
      .select()
      .from(schema.cliSession)
      .where(eq(schema.cliSession.workspaceId, workspace.id))
      .orderBy(desc(schema.cliSession.createdAt)),
    db
      .select({ link: schema.cliLink, repository: schema.repository, cli: schema.cliSession })
      .from(schema.cliLink)
      .innerJoin(schema.repository, eq(schema.repository.id, schema.cliLink.repositoryId))
      .innerJoin(schema.cliSession, eq(schema.cliSession.id, schema.cliLink.cliSessionId))
      .where(eq(schema.cliLink.workspaceId, workspace.id))
      .orderBy(desc(schema.cliLink.linkedAt)),
  ]);

  return (
    <>
      <Topbar crumbs={[{ label: 'Settings' }]} />
      <PageBody>
        <PageHeading title="Settings" description={`Signed in as ${user.email}.`} />

        <Section
          title="Workspace"
          description="Your account owns this workspace. Invitations and roles are not part of this release."
        >
          <WorkspaceNameForm name={workspace.name} />
        </Section>

        <Section
          title="Appearance"
          description="Saved in this browser. System follows your operating system."
        >
          <ThemeControl />
        </Section>

        <Section
          title="Authorized CLIs"
          description="Machines signed in with assure login. Revoking ends a credential immediately; runs it reported stay in history."
        >
          {clis.length === 0 ? (
            <Empty>No CLI has signed in yet. Start from a repository page.</Empty>
          ) : (
            <List>
              {clis.map((cli) => (
                <li key={cli.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <Laptop className="size-4 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] text-ink">
                      {cli.label}
                    </span>
                    <span className="block text-xs text-ink-3">
                      assure {cli.cliVersion}, authorized {when(cli.createdAt)}
                    </span>
                  </span>
                  {cli.revokedAt === null ? (
                    <>
                      <span className="text-xs text-ink-3">used {ago(cli.lastUsedAt)}</span>
                      <RevokeCliButton id={cli.id} label={cli.label} />
                    </>
                  ) : (
                    <span className="rounded-full bg-hover px-2 py-0.5 text-xs text-ink-2">
                      Revoked {when(cli.revokedAt)}
                    </span>
                  )}
                </li>
              ))}
            </List>
          )}
        </Section>

        <Section
          title="Linked repositories"
          description="Which CLI may report runs for which repository."
        >
          {links.length === 0 ? (
            <Empty>No repository is linked to a CLI yet.</Empty>
          ) : (
            <List>
              {links.map(({ link, repository, cli }) => (
                <li
                  key={`${cli.id}:${repository.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/repositories/${repository.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {repository.name}
                    </Link>
                    <span className="block truncate text-xs text-ink-3">
                      from <span className="font-mono">{cli.label}</span>
                      {cli.revokedAt === null ? '' : ' (revoked)'}, linked {when(link.linkedAt)}
                    </span>
                  </span>
                  <UnlinkButton
                    cliSessionId={cli.id}
                    repositoryId={repository.id}
                    name={repository.name}
                  />
                </li>
              ))}
            </List>
          )}
        </Section>

        <Section
          title="What synchronization sends"
          description="Only with --sync, and only for a linked repository. Names and paths can be sensitive; this is not a zero-data upload."
        >
          <div className="grid overflow-hidden rounded-lg border border-line bg-raised shadow-raised sm:grid-cols-2">
            <div className="border-b border-line p-4 sm:border-r sm:border-b-0">
              <h3 className="mb-2.5 text-xs font-medium text-ink-2">Sent</h3>
              <ul className="grid gap-2">
                {SENT.map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm text-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-ink-3" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4">
              <h3 className="mb-2.5 text-xs font-medium text-ink-2">Never sent</h3>
              <ul className="grid gap-2">
                {NEVER_SENT.map((line) => (
                  <li key={line} className="flex gap-2.5 text-sm text-ink">
                    <CircleSlash className="mt-0.5 size-4 shrink-0 text-ink-3" />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink-3">
                The complete evidence file stays on the machine that ran the check.
              </p>
            </div>
          </div>
        </Section>
      </PageBody>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-line py-8 first-of-type:border-t-0 first-of-type:pt-0 md:grid-cols-[232px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink-2">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function List({ children }: { readonly children: ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-raised shadow-raised">
      {children}
    </ul>
  );
}

function Empty({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-lg border border-line bg-raised px-4 py-5 text-sm text-ink-2 shadow-raised">
      {children}
    </p>
  );
}
