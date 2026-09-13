import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MIGRATION_EXECUTION_STAGES,
  type MigrationExecutionObservation,
  type MigrationExecutionStage,
  type MigrationFailure,
  type StageRecord,
} from '@assurance-compiler/core';
import { describeDatabaseError, parseMigrateDeployOutput, prismaErrorLine } from './diagnostics.js';
import type { MigrationInputs, PrismaProject } from './inputs.js';
import {
  appliedMigrations,
  checkPopulation,
  databaseUrl,
  initializeCluster,
  startServer,
  stopServer,
  type PostgresServer,
} from './postgres.js';
import { executeSqlFile, locatePrismaCli, migrateDeploy, type PrismaCli } from './prisma-cli.js';
import { runTool, toolFailure, type Step, type ToolResult, type ToolRunner } from './run-tool.js';

const PROVIDER = { id: 'prisma-postgresql', version: '0.1.0' } as const;

export interface VerificationOptions {
  readonly signal?: AbortSignal;
  /** Replaces process execution. Used to exercise timeouts and cleanup failures in tests. */
  readonly runTool?: ToolRunner;
  /**
   * Receives every stage transition as it happens: once when a stage starts running and once
   * when it ends. The final observation remains the only authority; this is for progress display.
   */
  readonly onStage?: (record: StageRecord) => void;
  /** Identifies the run in the observation. Generated when not given. */
  readonly runId?: string;
}

/** Thrown when the provider itself breaks. It is never evidence about the migrations. */
export class VerificationRunError extends Error {
  override readonly name = 'VerificationRunError';
  readonly cleanup: MigrationExecutionObservation['cleanup'];

  constructor(cause: unknown, cleanup: MigrationExecutionObservation['cleanup']) {
    super('Migration verification stopped because of an internal error.', { cause });
    this.cleanup = cleanup;
  }
}

interface RunState {
  readonly workdir: string;
  readonly records: Map<MigrationExecutionStage, StageRecord>;
  readonly environment: { postgres?: string; prisma?: string };
  populatedTables: { table: string; populated: boolean }[];
  migrationFailure?: MigrationFailure;
  dataDirectory?: string;
}

/** What every stage after the environment needs. */
interface Session {
  readonly cli: PrismaCli;
  readonly server: PostgresServer;
  readonly state: RunState;
  readonly run: ToolRunner;
  readonly signal: AbortSignal | undefined;
  readonly secrets: readonly string[];
}

/**
 * Applies the baseline migrations to a new, invocation-owned PostgreSQL cluster, loads the
 * baseline seed, confirms the expected tables contain rows, then applies the candidate
 * migrations with `prisma migrate deploy`. Returns an observation for central assessment.
 *
 * Owned resources are removed afterwards on success, failure, timeout and cancellation. A
 * forced termination of this process or a host crash can still leave them behind.
 */
export async function verifyMigrationExecution(
  root: string,
  inputs: MigrationInputs,
  options: VerificationOptions = {},
): Promise<MigrationExecutionObservation> {
  const run = options.runTool ?? runTool;
  const runId = options.runId ?? randomUUID();
  const state: RunState = {
    workdir: await mkdtemp(join(tmpdir(), `assure-run-${runId.slice(0, 8)}-`)),
    records: new Map(MIGRATION_EXECUTION_STAGES.map((name) => [name, { name, status: 'pending' }])),
    environment: {},
    populatedTables: [],
  };

  try {
    await runStages(root, inputs, state, run, options.signal, options.onStage);
  } catch (error) {
    throw new VerificationRunError(error, await cleanUp(state, run));
  }

  return {
    requirement: 'NONEMPTY_MIGRATION_EXECUTION',
    runId,
    origin: 'local',
    provider: PROVIDER,
    environment: state.environment,
    subject: inputs.subject,
    stages: [...state.records.values()],
    populatedTables: state.populatedTables,
    ...(state.migrationFailure === undefined ? {} : { migrationFailure: state.migrationFailure }),
    cleanup: await cleanUp(state, run),
  };
}

async function runStages(
  root: string,
  inputs: MigrationInputs,
  state: RunState,
  run: ToolRunner,
  signal: AbortSignal | undefined,
  onStage: VerificationOptions['onStage'],
): Promise<void> {
  const stage = <T>(name: MigrationExecutionStage, command: string, work: () => Promise<Step<T>>) =>
    runStage(state, name, command, signal, work, onStage);

  const ready = await stage('environment', 'initdb; pg_ctl start', () =>
    prepareEnvironment(root, inputs, state, run, signal),
  );
  if (ready === undefined) return;
  const { server } = ready;
  const session: Session = {
    ...ready,
    state,
    run,
    signal,
    secrets: [server.password, server.adminPassword, databaseUrl(server)],
  };

  const baselineApplied = await stage('baseline-migrations', deployCommand('baseline'), () =>
    deploy(session, 'baseline', inputs.baseline),
  );
  if (baselineApplied === undefined) return;

  const seeded = await stage('seed', 'prisma db execute --file <run>/seed.sql', () =>
    seed(session),
  );
  if (seeded === undefined) return;

  const populated = await stage(
    'population-check',
    'psql --command "SELECT EXISTS (SELECT 1 FROM <table>)"',
    async () => {
      const result = await checkPopulation(
        server,
        inputs.subject.expectedTables,
        state.workdir,
        run,
        signal,
      );
      if (result.ok) state.populatedTables = result.value;
      return result;
    },
  );
  if (populated === undefined) return;

  await stage('candidate-migrations', deployCommand('candidate'), () =>
    deploy(session, 'candidate', inputs.candidate),
  );
}

async function runStage<T>(
  state: RunState,
  name: MigrationExecutionStage,
  command: string,
  signal: AbortSignal | undefined,
  work: () => Promise<Step<T>>,
  onStage: VerificationOptions['onStage'],
): Promise<T | undefined> {
  const record = (entry: StageRecord) => {
    state.records.set(name, entry);
    onStage?.(entry);
  };
  if (signal?.aborted === true) {
    record({ name, status: 'cancelled', detail: 'Cancelled before the stage started.' });
    return undefined;
  }
  const startedAt = new Date();
  record({ name, status: 'running', startedAt: startedAt.toISOString(), command });
  const step = await work();
  const status = step.ok ? 'succeeded' : step.cancelled ? 'cancelled' : 'failed';
  record({
    name,
    status,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    command,
    ...(step.detail === undefined ? {} : { detail: step.detail }),
  });
  return step.ok ? step.value : undefined;
}

async function prepareEnvironment(
  root: string,
  inputs: MigrationInputs,
  state: RunState,
  run: ToolRunner,
  signal: AbortSignal | undefined,
): Promise<Step<{ cli: PrismaCli; server: PostgresServer }>> {
  const cli = await locatePrismaCli(root);
  if (!cli.ok) return cli;
  state.environment.prisma = cli.value.version;

  await writeProject(join(state.workdir, 'baseline'), inputs.baseline);
  await writeProject(join(state.workdir, 'candidate'), inputs.candidate);
  await writeFile(join(state.workdir, 'seed.sql'), inputs.seed, { mode: 0o600 });

  const cluster = await initializeCluster(state.workdir, run, signal);
  if (!cluster.ok) return cluster;
  state.dataDirectory = cluster.value.dataDirectory;

  const server = await startServer(cluster.value, state.workdir, run, signal);
  if (!server.ok) return server;
  state.environment.postgres = server.value.version;

  return {
    ok: true,
    value: { cli: cli.value, server: server.value },
    detail: `PostgreSQL ${server.value.version} on 127.0.0.1:${String(server.value.port)}; Prisma ${cli.value.version}.`,
  };
}

/**
 * Runs `prisma migrate deploy` and, when Prisma reports success, confirms from Prisma's own
 * records that every migration of the project is applied, so a no-op run cannot pass.
 */
async function deploy(
  session: Session,
  project: 'baseline' | 'candidate',
  files: PrismaProject,
): Promise<Step<true>> {
  const { cli, server, state, run, signal, secrets } = session;
  const result = await migrateDeploy(
    cli,
    join(state.workdir, project),
    databaseUrl(server),
    run,
    signal,
  );
  if (result.exitCode !== 0) {
    const failure =
      result.cancelled || result.timedOut ? {} : parseMigrateDeployOutput(result.output);
    if (failure.migration === undefined || failure.databaseError === undefined) {
      return prismaFailure('prisma migrate deploy', result, secrets);
    }
    if (project === 'candidate') {
      state.migrationFailure = { migration: failure.migration, ...failure.databaseError };
    }
    return {
      ok: false,
      cancelled: false,
      detail: `Prisma ${failure.prismaCode ?? 'error'}: migration ${failure.migration} failed with ${describeDatabaseError(failure.databaseError)}.`,
    };
  }

  const applied = await appliedMigrations(server, state.workdir, run, signal);
  if (!applied.ok) return applied;
  const expected = files.migrations.map((migration) => migration.name);
  if (JSON.stringify(applied.value) !== JSON.stringify(expected)) {
    return {
      ok: false,
      cancelled: false,
      detail:
        'Prisma reported success, but its migration records do not match the expected migrations.',
    };
  }
  const count = expected.length === 1 ? '1 migration' : `${String(expected.length)} migrations`;
  return { ok: true, value: true, detail: `${count} applied.` };
}

/** Loads the baseline seed fixture as the non-superuser owner role. */
async function seed({ cli, server, state, run, signal, secrets }: Session): Promise<Step<true>> {
  const result = await executeSqlFile(
    cli,
    join(state.workdir, 'baseline'),
    join(state.workdir, 'seed.sql'),
    databaseUrl(server),
    run,
    signal,
  );
  return result.exitCode === 0
    ? { ok: true, value: true }
    : prismaFailure('prisma db execute', result, secrets);
}

/**
 * Describes a Prisma failure without the database's message: Prisma can print it with row
 * values inline, so only a line carrying a Prisma error code is kept.
 */
function prismaFailure(tool: string, result: ToolResult, secrets: readonly string[]): Step<never> {
  if (result.cancelled || result.timedOut || result.notFound || result.exitCode === undefined) {
    return toolFailure(tool, result, secrets);
  }
  const line =
    prismaErrorLine(result.output, secrets) ??
    'the database message is not recorded because it can contain row values';
  return {
    ok: false,
    cancelled: false,
    detail: `${tool} exited with code ${String(result.exitCode)}: ${line}.`,
  };
}

async function writeProject(directory: string, project: PrismaProject): Promise<void> {
  const migrations = join(directory, 'prisma', 'migrations');
  await mkdir(migrations, { recursive: true });
  await writeFile(join(directory, 'prisma', 'schema.prisma'), project.schema.bytes);
  if (project.lock !== undefined) {
    await writeFile(join(migrations, 'migration_lock.toml'), project.lock.bytes);
  }
  for (const migration of project.migrations) {
    // Names are validated against a strict pattern, so they cannot escape the directory.
    await mkdir(join(migrations, migration.name));
    await writeFile(join(migrations, migration.name, 'migration.sql'), migration.sql);
  }
}

function deployCommand(project: 'baseline' | 'candidate'): string {
  return `prisma migrate deploy --schema <run>/${project}/prisma/schema.prisma`;
}

/** Removes only what this run created, and names anything that could not be removed. */
async function cleanUp(
  state: RunState,
  run: ToolRunner,
): Promise<MigrationExecutionObservation['cleanup']> {
  const leftovers: string[] = [];
  if (state.dataDirectory !== undefined) {
    const stopped = await stopServer(state.dataDirectory, state.workdir, run).catch(() => false);
    if (!stopped) leftovers.push(`PostgreSQL server for data directory ${state.dataDirectory}`);
  }
  try {
    // Retries give a terminated tool's child processes time to release files on Windows.
    await rm(state.workdir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch {
    leftovers.push(`Run directory ${state.workdir}`);
  }
  return { status: leftovers.length === 0 ? 'succeeded' : 'failed', leftovers };
}
