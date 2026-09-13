import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Step, ToolResult, ToolRunner } from './run-tool.js';

const SUPPORTED_MAJOR_VERSION = 6;
const SCHEMA = join('prisma', 'schema.prisma');

export interface PrismaCli {
  readonly entry: string;
  readonly version: string;
}

/**
 * Finds the Prisma CLI the repository installed, so migrations run with the project's own
 * Prisma version. Only the CLI's package manifest is read; no project configuration is loaded.
 */
export async function locatePrismaCli(root: string): Promise<Step<PrismaCli>> {
  const directory = join(root, 'node_modules', 'prisma');
  const entry = join(directory, 'build', 'index.js');
  let version: unknown;
  try {
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      version?: unknown;
    };
    version = manifest.version;
    await access(entry);
  } catch {
    return {
      ok: false,
      cancelled: false,
      detail: 'The Prisma CLI is not installed in this repository (node_modules/prisma).',
    };
  }
  if (typeof version !== 'string' || Number.parseInt(version, 10) !== SUPPORTED_MAJOR_VERSION) {
    return {
      ok: false,
      cancelled: false,
      detail: `Prisma ${String(version)} is installed; this check supports Prisma ${String(SUPPORTED_MAJOR_VERSION)}.x.`,
    };
  }
  return { ok: true, value: { entry, version } };
}

/** Runs `prisma migrate deploy` for a materialized project directory. */
export function migrateDeploy(
  cli: PrismaCli,
  projectDirectory: string,
  url: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  return runPrisma(
    cli,
    projectDirectory,
    ['migrate', 'deploy', '--schema', SCHEMA],
    url,
    run,
    signal,
  );
}

/**
 * Runs a SQL file with `prisma db execute`. The server receives the file as one script in one
 * implicit transaction, and client-side commands such as psql's `\!` cannot run on the host.
 */
export function executeSqlFile(
  cli: PrismaCli,
  projectDirectory: string,
  file: string,
  url: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  return runPrisma(
    cli,
    projectDirectory,
    ['db', 'execute', '--file', file, '--schema', SCHEMA],
    url,
    run,
    signal,
  );
}

/**
 * The working directory contains only the materialized schema and migrations, so no repository
 * `.env` or config file can be picked up, and the database URL is the only connection setting
 * the process receives.
 */
function runPrisma(
  cli: PrismaCli,
  projectDirectory: string,
  args: readonly string[],
  url: string,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<ToolResult> {
  return run({
    file: process.execPath,
    args: [cli.entry, ...args],
    cwd: projectDirectory,
    env: {
      DATABASE_URL: url,
      CHECKPOINT_DISABLE: '1',
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
      // An unreachable mirror turns any attempted engine download into a fast local failure.
      PRISMA_ENGINES_MIRROR: 'http://127.0.0.1:9',
      NO_COLOR: '1',
    },
    timeoutMs: 300_000,
    signal,
  });
}
