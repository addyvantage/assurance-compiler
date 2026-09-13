import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { db, schema } from './db';

export type Workspace = typeof schema.workspace.$inferSelect;
export type CliSession = typeof schema.cliSession.$inferSelect;

interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** The browser session, or `null`. Reads cookies from the current request. */
export async function currentSession() {
  const requestHeaders = await headers();
  // A CLI token is for the CLI routes. Pages, server actions, streams and downloads need the
  // browser's cookie session, so a bearer token never signs in here.
  if ((requestHeaders.get('authorization') ?? '').startsWith('Bearer ')) return null;
  return auth.api.getSession({ headers: requestHeaders });
}

/**
 * The signed-in user and their workspace. Redirects to sign-in otherwise. Every page under
 * the app shell starts here, so no page can query without a workspace scope.
 */
export async function requireWorkspace(): Promise<{
  user: SessionUser;
  sessionId: string;
  workspace: Workspace;
}> {
  const session = await currentSession();
  if (session === null) redirect('/sign-in');
  const workspace = await ensureWorkspace(session.user);
  return { user: session.user, sessionId: session.session.id, workspace };
}

/** Each account owns exactly one personal workspace, created on first use. */
export async function ensureWorkspace(user: SessionUser): Promise<Workspace> {
  const existing = await db.query.workspace.findFirst({
    where: eq(schema.workspace.ownerUserId, user.id),
  });
  if (existing !== undefined) return existing;
  const localPart = user.email.split('@')[0] ?? 'personal';
  const name = `${user.name.trim() === '' ? localPart : user.name.trim()}'s workspace`;
  const [created] = await db
    .insert(schema.workspace)
    .values({ id: randomUUID(), name, ownerUserId: user.id })
    .onConflictDoNothing()
    .returning();
  if (created !== undefined) return created;
  // A concurrent request created it first.
  const raced = await db.query.workspace.findFirst({
    where: eq(schema.workspace.ownerUserId, user.id),
  });
  if (raced === undefined) throw new Error('Workspace creation failed.');
  return raced;
}

export type CliAuth =
  | {
      readonly ok: true;
      readonly authSessionId: string;
      readonly workspace: Workspace;
      /** `undefined` until the CLI registers itself after login. */
      readonly cli: CliSession | undefined;
    }
  | { readonly ok: false; readonly response: Response };

/**
 * Authenticates a CLI request by its bearer token (a Better Auth session issued through the
 * device flow). The workspace comes from the session's user, never from the request body.
 */
export async function authenticateCli(request: Request): Promise<CliAuth> {
  // A browser cookie must never act as a CLI: only an explicit bearer token is accepted.
  if (!(request.headers.get('authorization') ?? '').startsWith('Bearer ')) {
    return { ok: false, response: problem(401, 'Not signed in. Run `assure login`.') };
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (session === null) {
    return { ok: false, response: problem(401, 'Not signed in. Run `assure login`.') };
  }
  const workspace = await ensureWorkspace(session.user);
  const cli = await db.query.cliSession.findFirst({
    where: eq(schema.cliSession.authSessionId, session.session.id),
  });
  if (cli !== undefined) {
    await db
      .update(schema.cliSession)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.cliSession.id, cli.id));
  }
  return { ok: true, authSessionId: session.session.id, workspace, cli };
}

/** Like `authenticateCli`, but the CLI must already be registered. */
export async function requireCli(
  request: Request,
): Promise<(CliAuth & { ok: true; cli: CliSession }) | { ok: false; response: Response }> {
  const result = await authenticateCli(request);
  if (!result.ok) return result;
  if (result.cli === undefined) {
    return { ok: false, response: problem(403, 'This CLI is not registered. Run `assure login`.') };
  }
  return { ...result, cli: result.cli };
}

/** A JSON error body the CLI can print verbatim. */
export function problem(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}
