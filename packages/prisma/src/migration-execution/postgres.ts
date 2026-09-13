import { randomBytes } from 'node:crypto';
import { access, appendFile, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { describeDatabaseError, parsePsqlError } from './diagnostics.js';
import { quoteTableName } from './inputs.js';
import { toolFailure, type Step, type ToolResult, type ToolRunner } from './run-tool.js';

/** The superuser, used only to create the owner role and database. */
const ADMIN = 'assure_admin';
/**
 * Migrations and the seed run as this role. It owns the database but is not a superuser, so
 * repository SQL cannot run host programs (`COPY … TO PROGRAM`) or read server files.
 */
const OWNER = 'assure';
const DATABASE = 'assure';

/** A PostgreSQL server this invocation created, listening only on loopback. */
export interface PostgresServer {
  readonly dataDirectory: string;
  readonly port: number;
  readonly version: string;
  readonly adminPassword: string;
  /** Password of the owner role. */
  readonly password: string;
}

interface Connection {
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

export function databaseUrl(server: PostgresServer): string {
  return `postgresql://${OWNER}:${server.password}@127.0.0.1:${String(server.port)}/${DATABASE}?sslmode=disable&connect_timeout=10`;
}

/** Creates a new cluster in `workdir`; the superuser password file is removed immediately. */
export async function initializeCluster(
  workdir: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<Step<{ dataDirectory: string; adminPassword: string }>> {
  const dataDirectory = join(workdir, 'pgdata');
  const passwordFile = join(workdir, 'pgpass');
  const adminPassword = randomBytes(24).toString('hex');
  await writeFile(passwordFile, adminPassword, { mode: 0o600 });
  try {
    const result = await run({
      file: 'initdb',
      args: [
        `--pgdata=${dataDirectory}`,
        `--username=${ADMIN}`,
        '--auth=scram-sha-256',
        `--pwfile=${passwordFile}`,
        '--encoding=UTF8',
        '--locale=C',
        '--no-sync',
        '--no-instructions',
      ],
      cwd: workdir,
      timeoutMs: 120_000,
      signal,
    });
    if (result.exitCode !== 0) return toolFailure('initdb', result);
  } finally {
    await rm(passwordFile, { force: true });
  }
  return { ok: true, value: { dataDirectory, adminPassword } };
}

/**
 * Starts the cluster on a free loopback port without Unix sockets, confirms that the server on
 * that port is this cluster, then creates the non-superuser owner role and its database.
 */
export async function startServer(
  cluster: { dataDirectory: string; adminPassword: string },
  workdir: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<Step<PostgresServer>> {
  const port = await findFreePort();
  await appendFile(
    join(cluster.dataDirectory, 'postgresql.conf'),
    [
      '',
      '# assure: disposable verification server',
      "listen_addresses = '127.0.0.1'",
      `port = ${String(port)}`,
      "unix_socket_directories = ''",
      'fsync = off',
      'synchronous_commit = off',
      'full_page_writes = off',
      '',
    ].join('\n'),
  );

  const log = join(workdir, 'postgres.log');
  const start = await run({
    file: 'pg_ctl',
    args: ['start', `--pgdata=${cluster.dataDirectory}`, `--log=${log}`, '--wait', '--timeout=60'],
    cwd: workdir,
    timeoutMs: 90_000,
    signal,
    captureOutput: false,
  });
  if (start.exitCode !== 0) {
    // The server log explains a failed start; no statements have run, so it holds no data.
    const output = await readFile(log, 'utf8').catch(() => '');
    return toolFailure('pg_ctl start', { ...start, output });
  }

  const admin = { port, user: ADMIN, password: cluster.adminPassword, database: 'postgres' };
  const identity = await psql(
    admin,
    [
      '--tuples-only',
      '--no-align',
      "--command=SELECT current_setting('data_directory') || '|' || current_setting('server_version')",
    ],
    workdir,
    run,
    signal,
  );
  if (identity.exitCode !== 0) return toolFailure('psql', identity, [cluster.adminPassword]);
  const [reportedDirectory = '', version = ''] = identity.output.trim().split('|');
  if (!(await isSameDirectory(reportedDirectory, cluster.dataDirectory))) {
    return {
      ok: false,
      cancelled: false,
      detail: `The server on port ${String(port)} is not the cluster this run created.`,
    };
  }

  // Sent on standard input so the owner password never appears in a process argument list.
  const password = randomBytes(24).toString('hex');
  const setup = await psql(
    admin,
    ['--file=-'],
    workdir,
    run,
    signal,
    30_000,
    [
      `CREATE ROLE ${OWNER} LOGIN PASSWORD '${password}';`,
      `CREATE DATABASE ${DATABASE} OWNER ${OWNER};`,
      '',
    ].join('\n'),
  );
  if (setup.exitCode !== 0) return toolFailure('psql', setup, [cluster.adminPassword, password]);

  return {
    ok: true,
    value: {
      dataDirectory: cluster.dataDirectory,
      port,
      version,
      adminPassword: cluster.adminPassword,
      password,
    },
  };
}

/** Reports whether each table has at least one row, without reading any row values. */
export async function checkPopulation(
  server: PostgresServer,
  tables: readonly string[],
  workdir: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<Step<{ table: string; populated: boolean }[]>> {
  const observed: { table: string; populated: boolean }[] = [];
  for (const table of tables) {
    const query = `--command=SELECT EXISTS (SELECT 1 FROM ${quoteTableName(table)})`;
    const result = await psql(
      owner(server),
      ['--tuples-only', '--no-align', query],
      workdir,
      run,
      signal,
    );
    if (result.exitCode !== 0) return psqlFailure(result, server, `read ${table}`);
    observed.push({ table, populated: result.output.trim() === 't' });
  }
  const empty = observed.filter((entry) => !entry.populated).map((entry) => entry.table);
  if (empty.length > 0) {
    return { ok: false, cancelled: false, detail: `No rows after seeding in ${empty.join(', ')}.` };
  }
  return { ok: true, value: observed, detail: `Rows present in ${tables.join(', ')}.` };
}

/** Names of migrations Prisma has recorded as fully applied. */
export async function appliedMigrations(
  server: PostgresServer,
  workdir: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<Step<string[]>> {
  const query =
    '--command=SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name';
  const result = await psql(
    owner(server),
    ['--tuples-only', '--no-align', query],
    workdir,
    run,
    signal,
  );
  if (result.exitCode !== 0) return psqlFailure(result, server, 'read applied migrations');
  return {
    ok: true,
    value: result.output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  };
}

/**
 * Stops a cluster this run created. Deliberately ignores cancellation: cleanup must still be
 * attempted after the user cancels. Returns false if the server may still be running.
 */
export async function stopServer(
  dataDirectory: string,
  workdir: string,
  run: ToolRunner,
): Promise<boolean> {
  const pidFile = join(dataDirectory, 'postmaster.pid');
  if (!(await exists(pidFile))) return true;
  const result = await run({
    file: 'pg_ctl',
    args: ['stop', `--pgdata=${dataDirectory}`, '--mode=immediate', '--wait', '--timeout=30'],
    cwd: workdir,
    timeoutMs: 60_000,
  });
  return result.exitCode === 0 || !(await exists(pidFile));
}

/**
 * Explains a failed query on the owner database, which runs after repository SQL. A database
 * error is reduced to what evidence may contain; psql's raw output is never kept in that case.
 */
function psqlFailure(result: ToolResult, server: PostgresServer, action: string): Step<never> {
  const error = result.cancelled || result.timedOut ? undefined : parsePsqlError(result.output);
  return error === undefined
    ? toolFailure('psql', result, [server.password])
    : {
        ok: false,
        cancelled: false,
        detail: `Could not ${action}: ${describeDatabaseError(error)}.`,
      };
}

function owner(server: PostgresServer): Connection {
  return { port: server.port, user: OWNER, password: server.password, database: DATABASE };
}

function psql(
  connection: Connection,
  args: readonly string[],
  workdir: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
  timeoutMs = 30_000,
  input?: string,
): Promise<ToolResult> {
  return run({
    file: 'psql',
    args: [
      '--no-psqlrc',
      '--quiet',
      '--set=ON_ERROR_STOP=1',
      '--set=VERBOSITY=verbose',
      '--host=127.0.0.1',
      `--port=${String(connection.port)}`,
      `--username=${connection.user}`,
      `--dbname=${connection.database}`,
      ...args,
    ],
    cwd: workdir,
    env: { PGPASSWORD: connection.password, PGCONNECT_TIMEOUT: '10', PGSSLMODE: 'disable' },
    ...(input === undefined ? {} : { input }),
    timeoutMs,
    signal,
  });
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

/** PostgreSQL reports paths with `/` even on Windows, where paths are also case-insensitive. */
async function isSameDirectory(reported: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([realpath(reported).catch(() => reported), realpath(expected)]);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}
