import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/shell';
import { db, schema } from '@/lib/db';
import { ago, when } from '@/lib/format';
import { requireWorkspace } from '@/lib/session';
import { renameWorkspace, revokeCliSession, unlinkRepository } from './actions';
import { ThemePicker } from './theme-picker';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { workspace, user } = await requireWorkspace();
  const clis = await db
    .select()
    .from(schema.cliSession)
    .where(eq(schema.cliSession.workspaceId, workspace.id))
    .orderBy(desc(schema.cliSession.createdAt));
  const links = await db
    .select({ link: schema.cliLink, repository: schema.repository, cli: schema.cliSession })
    .from(schema.cliLink)
    .innerJoin(schema.repository, eq(schema.repository.id, schema.cliLink.repositoryId))
    .innerJoin(schema.cliSession, eq(schema.cliSession.id, schema.cliLink.cliSessionId))
    .where(eq(schema.cliLink.workspaceId, workspace.id))
    .orderBy(desc(schema.cliLink.linkedAt));

  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${user.email}.`} />

      <section className="section" aria-labelledby="ws-heading">
        <div className="section-title">
          <h2 id="ws-heading">Workspace</h2>
        </div>
        <form action={renameWorkspace}>
          <div className="field">
            <label htmlFor="ws-name">Name</label>
            <input
              id="ws-name"
              name="name"
              className="input"
              defaultValue={workspace.name}
              maxLength={80}
              required
            />
            <span className="hint">
              Your account owns this workspace. Invitations and roles are not part of this release.
            </span>
          </div>
          <button type="submit" className="button">
            Save name
          </button>
        </form>
      </section>

      <section className="section" aria-labelledby="theme-heading">
        <div className="section-title">
          <h2 id="theme-heading">Appearance</h2>
        </div>
        <ThemePicker />
      </section>

      <section className="section" aria-labelledby="cli-heading">
        <div className="section-title">
          <h2 id="cli-heading">Authorized CLIs</h2>
        </div>
        {clis.length === 0 ? (
          <p className="muted">No CLI has signed in yet. Start from a repository page.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>CLI</th>
                  <th>Authorized</th>
                  <th>Last used</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clis.map((cli) => (
                  <tr key={cli.id}>
                    <td className="mono">{cli.label}</td>
                    <td>assure {cli.cliVersion}</td>
                    <td className="muted" title={cli.createdAt.toISOString()}>
                      {when(cli.createdAt)}
                    </td>
                    <td className="muted">
                      {cli.revokedAt === null
                        ? ago(cli.lastUsedAt)
                        : `revoked ${when(cli.revokedAt)}`}
                    </td>
                    <td className="num">
                      {cli.revokedAt === null ? (
                        <form action={revokeCliSession}>
                          <input type="hidden" name="id" value={cli.id} />
                          <button type="submit" className="button small danger">
                            Revoke
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="faint" style={{ marginTop: 8 }}>
          Revoking ends that CLI&apos;s credential immediately. Runs it already reported stay in
          history, marked with its name.
        </p>
      </section>

      <section className="section" aria-labelledby="links-heading">
        <div className="section-title">
          <h2 id="links-heading">Linked repositories</h2>
        </div>
        {links.length === 0 ? (
          <p className="muted">No repository is linked to a CLI yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>CLI</th>
                  <th>Linked</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {links.map(({ link, repository, cli }) => (
                  <tr key={`${cli.id}:${repository.id}`}>
                    <td>
                      <Link href={`/repositories/${repository.id}`}>{repository.name}</Link>
                    </td>
                    <td className="mono">
                      {cli.label}
                      {cli.revokedAt === null ? '' : ' (revoked)'}
                    </td>
                    <td className="muted" title={link.linkedAt.toISOString()}>
                      {when(link.linkedAt)}
                    </td>
                    <td className="num">
                      <form action={unlinkRepository}>
                        <input type="hidden" name="cliSessionId" value={cli.id} />
                        <input type="hidden" name="repositoryId" value={repository.id} />
                        <button type="submit" className="button small">
                          Unlink
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="data-heading">
        <div className="section-title">
          <h2 id="data-heading">What synchronization sends</h2>
        </div>
        <p className="muted" style={{ maxWidth: '72ch' }}>
          Only when you pass <code>--sync</code>, and only for a linked repository: run and
          repository IDs, commit and Git blob IDs, the requested branch name, requirement and
          provider IDs, stage statuses and timings, PostgreSQL and Prisma versions, SQLSTATE codes,
          cleanup status, the seed fixture path, migration names, expected table names, and changed
          file paths the detector recognized. Branch names, paths and identifiers can themselves be
          sensitive; this is not a zero-data upload. Never sent: database messages, stage details,
          tool output, SQL, seed contents, source files, row values, local paths, credentials or
          stack traces. The complete evidence file stays local.
        </p>
      </section>
    </>
  );
}
