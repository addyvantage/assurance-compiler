import type { MigrationExecutionSubject, MigrationIdentity } from '@assurance-compiler/core';
import { listTree, readBlob, type TreeEntry } from '@assurance-compiler/git';
import { PRISMA_MIGRATIONS_DIRECTORY, PRISMA_SCHEMA_PATH } from '../paths.js';

/** Prisma's own bookkeeping table. Its rows say nothing about application data. */
export const PRISMA_METADATA_TABLE = '_prisma_migrations';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const REGULAR_FILE_MODE = /^100(644|755)$/;
const MIGRATION_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const LOCK_FILE = 'migration_lock.toml';

/**
 * Accepts `schema.table` made of plain, unquoted identifiers. Names are case-sensitive, as
 * Prisma creates them quoted. Anything else is rejected rather than escaped.
 */
export function isTableName(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 2 && parts.every((part) => SQL_IDENTIFIER.test(part));
}

/** Quotes a name accepted by `isTableName`. */
export function quoteTableName(table: string): string {
  return table
    .split('.')
    .map((part) => `"${part}"`)
    .join('.');
}

/** A normalized repository-relative path: `/`-separated, with no absolute or `..` segments. */
export function isRepositoryRelativePath(value: string): boolean {
  if (value === '' || value.includes('\0') || value.includes('\\') || value.startsWith('/')) {
    return false;
  }
  if (/^[A-Za-z]:/.test(value)) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

export interface PrismaProject {
  readonly schema: { readonly blob: string; readonly bytes: Uint8Array };
  readonly lock: { readonly blob: string; readonly bytes: Uint8Array } | undefined;
  /** Migrations ordered by name, which is the order Prisma applies them in. */
  readonly migrations: readonly (MigrationIdentity & { readonly sql: Uint8Array })[];
}

export interface MigrationInputs {
  readonly subject: MigrationExecutionSubject;
  readonly baseline: PrismaProject;
  readonly candidate: PrismaProject;
  readonly seed: Uint8Array;
}

export type InputResolution =
  | { readonly ok: true; readonly inputs: MigrationInputs }
  | { readonly ok: false; readonly reason: string };

export interface InputRequest {
  /** The merge-base commit that defines the populated baseline. */
  readonly baseline: string;
  readonly candidate: string;
  readonly seedPath: string;
  readonly expectedTables: readonly string[];
}

/**
 * Reads and validates everything verification will use, from immutable Git objects only.
 *
 * Supported: one Prisma project at the repository root, PostgreSQL with
 * `url = env("DATABASE_URL")`, and a candidate that only appends migrations to the baseline
 * history. Anything else is reported as a reason, never approximated.
 */
export async function resolveMigrationInputs(
  root: string,
  request: InputRequest,
): Promise<InputResolution> {
  const baseline = await readProject(root, request.baseline);
  if (typeof baseline === 'string') return { ok: false, reason: baseline };
  const candidate = await readProject(root, request.candidate);
  if (typeof candidate === 'string') return { ok: false, reason: candidate };

  const historyProblem = findHistoryProblem(baseline, candidate);
  if (historyProblem !== undefined) return { ok: false, reason: historyProblem };

  const candidateMigrations = candidate.migrations.slice(baseline.migrations.length);
  if (candidateMigrations.length === 0) {
    return {
      ok: false,
      reason:
        'The change modifies the database schema but adds no migration, so there is no candidate migration to execute.',
    };
  }

  const seed = await readSeed(root, request.baseline, request.seedPath);
  if (typeof seed === 'string') return { ok: false, reason: seed };

  const identity = ({ name, blob }: MigrationIdentity): MigrationIdentity => ({ name, blob });
  return {
    ok: true,
    inputs: {
      subject: {
        baseline: request.baseline,
        candidate: request.candidate,
        schema: { baseline: baseline.schema.blob, candidate: candidate.schema.blob },
        seed: { path: request.seedPath, blob: seed.blob },
        baselineMigrations: baseline.migrations.map(identity),
        candidateMigrations: candidateMigrations.map(identity),
        expectedTables: request.expectedTables,
      },
      baseline,
      candidate,
      seed: seed.bytes,
    },
  };
}

/** Reads the root Prisma project at a commit, or explains why it is unsupported. */
async function readProject(root: string, commit: string): Promise<PrismaProject | string> {
  const entries = await listTree(root, commit, [
    PRISMA_SCHEMA_PATH,
    PRISMA_MIGRATIONS_DIRECTORY.slice(0, -1),
  ]);
  let schemaEntry: TreeEntry | undefined;
  let lockEntry: TreeEntry | undefined;
  const migrationEntries: { name: string; entry: TreeEntry }[] = [];

  for (const entry of entries) {
    const problem = entryProblem(entry);
    if (problem !== undefined) return problem;
    if (entry.path === PRISMA_SCHEMA_PATH) {
      schemaEntry = entry;
      continue;
    }
    const relative = entry.path.slice(PRISMA_MIGRATIONS_DIRECTORY.length);
    if (relative === LOCK_FILE) {
      lockEntry = entry;
      continue;
    }
    const [name = '', file, ...rest] = relative.split('/');
    if (file !== 'migration.sql' || rest.length > 0 || !MIGRATION_NAME.test(name)) {
      return `${entry.path} at ${short(commit)} is not a supported Prisma migration file.`;
    }
    migrationEntries.push({ name, entry });
  }

  if (schemaEntry === undefined) return `${PRISMA_SCHEMA_PATH} does not exist at ${short(commit)}.`;
  const schemaBytes = await readBlob(root, schemaEntry.oid);
  const datasourceProblem = findDatasourceProblem(new TextDecoder().decode(schemaBytes));
  if (datasourceProblem !== undefined) {
    return `${PRISMA_SCHEMA_PATH} at ${short(commit)}: ${datasourceProblem}`;
  }

  let lock: PrismaProject['lock'];
  if (lockEntry !== undefined) {
    const bytes = await readBlob(root, lockEntry.oid);
    if (!/^\s*provider\s*=\s*"postgresql"\s*$/m.test(new TextDecoder().decode(bytes))) {
      return `${lockEntry.path} at ${short(commit)} does not declare provider = "postgresql".`;
    }
    lock = { blob: lockEntry.oid, bytes };
  }

  migrationEntries.sort((a, b) => (a.name < b.name ? -1 : 1));
  const migrations = await Promise.all(
    migrationEntries.map(async ({ name, entry }) => ({
      name,
      blob: entry.oid,
      sql: await readBlob(root, entry.oid),
    })),
  );
  return { schema: { blob: schemaEntry.oid, bytes: schemaBytes }, lock, migrations };
}

function entryProblem(entry: TreeEntry): string | undefined {
  if (entry.mode === '120000') return `${entry.path} is a symbolic link, which is not supported.`;
  if (entry.type !== 'blob' || !REGULAR_FILE_MODE.test(entry.mode)) {
    return `${entry.path} is not a regular file, which is not supported.`;
  }
  if ((entry.size ?? 0) > MAX_INPUT_BYTES) return `${entry.path} is larger than 10 MiB.`;
  return undefined;
}

function findDatasourceProblem(schema: string): string | undefined {
  const blocks = [...schema.matchAll(/^\s*datasource\s+\w+\s*\{([^}]*)\}/gm)];
  const body = blocks.length === 1 ? blocks[0]?.[1] : undefined;
  if (body === undefined) return 'exactly one datasource block is required.';
  if (!/^\s*provider\s*=\s*"postgresql"\s*$/m.test(body)) {
    return 'only provider = "postgresql" is supported.';
  }
  if (!/^\s*url\s*=\s*env\(\s*"DATABASE_URL"\s*\)\s*$/m.test(body)) {
    return 'only url = env("DATABASE_URL") is supported.';
  }
  if (/^\s*(directUrl|shadowDatabaseUrl)\s*=/m.test(body)) {
    return 'directUrl and shadowDatabaseUrl are not supported.';
  }
  return undefined;
}

/** Baseline history must reach the candidate unchanged, with new migrations appended after it. */
function findHistoryProblem(baseline: PrismaProject, candidate: PrismaProject): string | undefined {
  const candidateBlobs = new Map(
    candidate.migrations.map((migration) => [migration.name, migration.blob]),
  );
  for (const migration of baseline.migrations) {
    const blob = candidateBlobs.get(migration.name);
    if (blob === undefined) {
      return `The change deletes existing migration ${migration.name}. Only appending migrations is supported.`;
    }
    if (blob !== migration.blob) {
      return `The change edits existing migration ${migration.name}. Only appending migrations is supported.`;
    }
  }
  const misplaced = candidate.migrations.find(
    (migration, index) =>
      index < baseline.migrations.length && migration.name !== baseline.migrations[index]?.name,
  );
  if (misplaced !== undefined) {
    return `New migration ${misplaced.name} sorts before existing migrations, so Prisma would not apply it last. Only appending migrations is supported.`;
  }
  if (baseline.lock?.blob !== candidate.lock?.blob) {
    return `The change modifies ${PRISMA_MIGRATIONS_DIRECTORY}${LOCK_FILE}, which is not supported.`;
  }
  return undefined;
}

async function readSeed(
  root: string,
  baseline: string,
  seedPath: string,
): Promise<{ blob: string; bytes: Uint8Array } | string> {
  const entry = (await listTree(root, baseline, [seedPath])).find(
    (candidate) => candidate.path === seedPath,
  );
  if (entry === undefined) {
    return `The seed fixture ${seedPath} does not exist at the merge-base commit ${short(baseline)}. Commit the fixture to the base branch before the change being checked.`;
  }
  const problem = entryProblem(entry);
  if (problem !== undefined) return problem;
  return { blob: entry.oid, bytes: await readBlob(root, entry.oid) };
}

function short(commit: string): string {
  return commit.slice(0, 7);
}
