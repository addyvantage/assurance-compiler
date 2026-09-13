import { hostname } from 'node:os';
import { rm } from 'node:fs/promises';
import { findRepositoryRoot } from '@assurance-compiler/git';
import { api, describeFailure, expectOk, messageOf } from '../cloud/client.js';
import {
  CLIENT_ID,
  deleteToken,
  listSpool,
  normalizeServer,
  readToken,
  writeLink,
  writeToken,
} from '../cloud/index.js';
import { ExitCode } from '../exit-codes.js';
import type { CliEnvironment } from '../io.js';
import { readVersion } from '../version.js';

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

/** `assure login`: device authorization approved in the browser, token kept in the OS store. */
export async function runLogin(server: string, environment: CliEnvironment): Promise<number> {
  const { stdout, stderr } = environment;
  try {
    const origin = normalizeServer(server);
    const code = expectOk(
      await api(origin, '/api/auth/device/code', {
        method: 'POST',
        body: { client_id: CLIENT_ID },
      }),
      'Could not start sign-in',
    ) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete?: string;
      expires_in: number;
      interval?: number;
    };
    const url = code.verification_uri_complete ?? `${origin}${code.verification_uri}`;
    stdout.write(
      [
        `Open ${url}`,
        `and confirm the code ${code.user_code} to authorize this machine (${hostname()}).`,
        `The code expires in ${String(Math.round(code.expires_in / 60))} minutes. Waiting…`,
        '',
      ].join('\n'),
    );

    let interval = Math.max(code.interval ?? 5, 1) * 1000;
    const deadline = Date.now() + code.expires_in * 1000;
    let token: string | undefined;
    while (token === undefined) {
      if (environment.signal?.aborted === true) {
        stderr.write('Sign-in cancelled.\n');
        return ExitCode.Error;
      }
      if (Date.now() > deadline) {
        stderr.write('error: the code expired before it was approved. Run `assure login` again.\n');
        return ExitCode.Error;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
      const poll = await api(origin, '/api/auth/device/token', {
        method: 'POST',
        body: { grant_type: DEVICE_GRANT, device_code: code.device_code, client_id: CLIENT_ID },
      });
      const body = poll.body as { access_token?: string; error?: string } | null;
      if (poll.status < 300 && typeof body?.access_token === 'string') {
        token = body.access_token;
      } else if (body?.error === 'slow_down') {
        interval += 5000;
      } else if (body?.error === 'authorization_pending') {
        continue;
      } else {
        const why =
          body?.error === 'access_denied'
            ? 'access was denied in the browser'
            : (messageOf(body) ?? `the server answered ${String(poll.status)}`);
        stderr.write(`error: sign-in did not complete: ${why}.\n`);
        return ExitCode.Error;
      }
    }

    let registered: { workspace: string };
    try {
      registered = expectOk(
        await api(origin, '/api/cli/register', {
          method: 'POST',
          token,
          body: { label: hostname(), cliVersion: readVersion() },
        }),
        'Signed in, but could not register this CLI',
      ) as { workspace: string };
    } catch (error) {
      // Do not leave a session the user cannot see in Settings.
      await api(origin, '/api/auth/sign-out', { method: 'POST', token, body: {} }).catch(
        () => undefined,
      );
      throw error;
    }
    await writeToken(origin, token);
    stdout.write(`Signed in to ${origin}. Workspace: ${registered.workspace}.\n`);
    stdout.write(
      'Next: run `assure link <repository-id>` inside the checkout you want to verify.\n',
    );
    return ExitCode.Success;
  } catch (error) {
    stderr.write(`error: ${describeFailure(error)}\n`);
    return ExitCode.Error;
  }
}

export async function runLogout(server: string, environment: CliEnvironment): Promise<number> {
  const origin = normalizeServer(server);
  const token = await readToken(origin).catch(() => undefined);
  if (token !== undefined) {
    await api(origin, '/api/auth/sign-out', { method: 'POST', token, body: {} }).catch(
      () => undefined,
    );
  }
  await deleteToken(origin);
  environment.stdout.write(`Signed out of ${origin}. The stored credential was removed.\n`);
  return ExitCode.Success;
}

/** `assure link [repository-id]`: binds this checkout to a repository in the workspace. */
export async function runLink(
  repositoryId: string | undefined,
  server: string,
  environment: CliEnvironment,
): Promise<number> {
  const { stdout, stderr } = environment;
  try {
    const origin = normalizeServer(server);
    const token = await readToken(origin);
    if (token === undefined) {
      stderr.write(`error: not signed in to ${origin}. Run \`assure login\` first.\n`);
      return ExitCode.Error;
    }
    const root = await findRepositoryRoot(environment.cwd);
    if (repositoryId === undefined) {
      const listed = expectOk(
        await api(origin, '/api/cli/repositories', { token }),
        'Could not list repositories',
      ) as { workspace: string; repositories: { id: string; name: string }[] };
      if (listed.repositories.length === 0) {
        stdout.write(
          `No repositories in workspace ${listed.workspace}. Register one at ${origin}/repositories/new.\n`,
        );
        return ExitCode.Error;
      }
      stdout.write(`Repositories in ${listed.workspace}:\n`);
      for (const repository of listed.repositories) {
        stdout.write(`  ${repository.id}  ${repository.name}\n`);
      }
      stdout.write('Run `assure link <repository-id>` with the one this checkout belongs to.\n');
      return ExitCode.Success;
    }
    const linked = expectOk(
      await api(origin, '/api/cli/link', { method: 'POST', token, body: { repositoryId } }),
      'Could not link',
    ) as { repository: { id: string; name: string } };
    await writeLink(root, {
      server: origin,
      repositoryId: linked.repository.id,
      repositoryName: linked.repository.name,
    });
    stdout.write(
      `Linked ${root} to ${linked.repository.name} on ${origin}.\nRuns report there only when you pass --sync to \`assure check\`.\n`,
    );
    return ExitCode.Success;
  } catch (error) {
    stderr.write(`error: ${describeFailure(error)}\n`);
    return ExitCode.Error;
  }
}

/** `assure sync`: delivers reports that were spooled after a failed upload. */
export async function runSync(environment: CliEnvironment): Promise<number> {
  const { stdout, stderr } = environment;
  const spooled = await listSpool();
  if (spooled.length === 0) {
    stdout.write('Nothing to deliver.\n');
    return ExitCode.Success;
  }
  let failures = 0;
  for (const { file, entry } of spooled) {
    try {
      const token = await readToken(entry.server);
      if (token === undefined) throw new Error(`not signed in to ${entry.server}`);
      expectOk(
        await api(entry.server, `/api/cli/runs/${entry.runId}/report`, {
          method: 'POST',
          token,
          body: entry.report,
          retries: 2,
        }),
        `Run ${entry.runId.slice(0, 8)} was not delivered`,
      );
      await rm(file, { force: true });
      stdout.write(
        `Delivered run ${entry.runId.slice(0, 8)} to ${entry.server}/runs/${entry.runId}\n`,
      );
    } catch (error) {
      failures += 1;
      stderr.write(`error: ${describeFailure(error)}\n`);
    }
  }
  return failures === 0 ? ExitCode.Success : ExitCode.Error;
}
