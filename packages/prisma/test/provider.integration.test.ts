import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { assessMigrationExecution } from '@assurance-compiler/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureRepository,
  type FixtureName,
} from '../../../test/support/fixture-repository.js';
import type { TestRepository } from '../../../test/support/git-repository.js';
import {
  expectRunResourcesRemoved,
  installPrisma,
  requireIntegrationTools,
} from '../../../test/support/integration.js';
import {
  resolveMigrationInputs,
  verifyMigrationExecution,
  type MigrationInputs,
  type ToolRunner,
} from '../src/index.js';
import { runTool, type ToolRequest } from '../src/migration-execution/run-tool.js';

let nodeModules: string;

beforeAll(() => {
  nodeModules = requireIntegrationTools();
});

async function prepare(
  fixture: FixtureName,
  change?: (repository: TestRepository) => void,
): Promise<{ root: string; inputs: MigrationInputs }> {
  const repository = createFixtureRepository(fixture);
  change?.(repository);
  installPrisma(repository, nodeModules);
  const resolution = await resolveMigrationInputs(repository.root, {
    baseline: repository.git('merge-base', 'main', 'HEAD').trim(),
    candidate: repository.git('rev-parse', 'HEAD').trim(),
    seedPath: 'prisma/seed.sql',
    expectedTables: ['public.User'],
  });
  if (!resolution.ok) throw new Error(resolution.reason);
  return { root: repository.root, inputs: resolution.inputs };
}

/** A candidate migration that keeps Prisma and its schema engine busy inside PostgreSQL. */
function addSlowMigration(repository: TestRepository): void {
  repository.write('prisma/migrations/20260914_slow/migration.sql', 'SELECT pg_sleep(60);\n');
  repository.commit('slow migration');
}

const isCandidateDeploy = (request: ToolRequest) =>
  request.args.includes('deploy') && basename(request.cwd) === 'candidate';

describe('verifyMigrationExecution with real PostgreSQL and Prisma', () => {
  it('times out a real Prisma migration and still removes every resource', async () => {
    const { root, inputs } = await prepare('prisma-migration-corrected', addSlowMigration);
    const intercept: ToolRunner = (request) =>
      runTool(isCandidateDeploy(request) ? { ...request, timeoutMs: 8_000 } : request);

    const observation = await verifyMigrationExecution(root, inputs, { runTool: intercept });

    expect(observation.stages.map((stage) => stage.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
      'succeeded',
      'failed',
    ]);
    expect(observation.stages[4]?.detail).toContain('timed out');
    expect(assessMigrationExecution(inputs.subject, observation).state).toBe('NOT_PROVEN');
    expect(observation.cleanup).toEqual({ status: 'succeeded', leftovers: [] });
    await expectRunResourcesRemoved(observation);
  });

  it('cancels a real Prisma migration and still removes every resource', async () => {
    const { root, inputs } = await prepare('prisma-migration-corrected', addSlowMigration);
    const cancellation = new AbortController();
    const intercept: ToolRunner = (request) => {
      if (isCandidateDeploy(request)) {
        setTimeout(() => {
          cancellation.abort();
        }, 8_000);
      }
      return runTool(request);
    };

    const observation = await verifyMigrationExecution(root, inputs, {
      runTool: intercept,
      signal: cancellation.signal,
    });

    expect(observation.stages[4]).toMatchObject({
      name: 'candidate-migrations',
      status: 'cancelled',
    });
    expect(assessMigrationExecution(inputs.subject, observation).state).toBe('NOT_PROVEN');
    expect(observation.cleanup).toEqual({ status: 'succeeded', leftovers: [] });
    await expectRunResourcesRemoved(observation);
  });

  it('runs repository SQL without superuser privileges', async () => {
    const { root, inputs } = await prepare('prisma-migration-corrected', (repository) => {
      repository.write(
        'prisma/migrations/20260914_escape/migration.sql',
        "COPY (SELECT 1) TO PROGRAM 'echo escaped';\n",
      );
      repository.commit('attempt to run a host program');
    });

    const observation = await verifyMigrationExecution(root, inputs);

    expect(observation.migrationFailure).toMatchObject({
      migration: '20260914_escape',
      sqlState: '42501',
    });
    expect(assessMigrationExecution(inputs.subject, observation).state).toBe('NOT_PROVEN');
    await expectRunResourcesRemoved(observation);
  });

  it('withholds a message the migration raised with row values, even with a violation SQLSTATE', async () => {
    const { root, inputs } = await prepare('prisma-migration-corrected', (repository) => {
      repository.write(
        'prisma/migrations/20260914_raise/migration.sql',
        `DO $$ BEGIN RAISE EXCEPTION 'cannot migrate: %', (SELECT string_agg("email", ', ') FROM "User") USING ERRCODE = '23505'; END $$;\n`,
      );
      repository.commit('migration that raises with row values');
    });

    const observation = await verifyMigrationExecution(root, inputs);

    expect(observation.migrationFailure).toEqual({
      migration: '20260914_raise',
      sqlState: '23505',
    });
    expect(JSON.stringify(observation)).not.toContain('@example.com');
    expect(assessMigrationExecution(inputs.subject, observation).state).toBe('FAILED');
    await expectRunResourcesRemoved(observation);
  });

  it('classifies a Prisma connection failure as operational rather than a violation', async () => {
    const { root, inputs } = await prepare('prisma-migration-unsafe');
    const intercept: ToolRunner = async (request) =>
      isCandidateDeploy(request)
        ? {
            exitCode: 1,
            output: "Error: P1001: Can't reach database server at `127.0.0.1:1`",
            notFound: false,
            timedOut: false,
            cancelled: false,
          }
        : runTool(request);

    const observation = await verifyMigrationExecution(root, inputs, { runTool: intercept });

    expect(observation.migrationFailure).toBeUndefined();
    expect(observation.stages[4]?.detail).toContain('P1001');
    expect(assessMigrationExecution(inputs.subject, observation)).toMatchObject({
      state: 'NOT_PROVEN',
    });
    await expectRunResourcesRemoved(observation);
  });

  it('reports missing PostgreSQL tools as a failed environment stage', async () => {
    const { root, inputs } = await prepare('prisma-migration-corrected');
    const intercept: ToolRunner = async (request) =>
      request.file === 'initdb'
        ? { exitCode: undefined, output: '', notFound: true, timedOut: false, cancelled: false }
        : runTool(request);

    const transitions: string[] = [];
    const observation = await verifyMigrationExecution(root, inputs, {
      runTool: intercept,
      onStage: (record) => transitions.push(`${record.name}:${record.status}`),
    });

    expect(observation.stages[0]).toMatchObject({
      status: 'failed',
      detail: 'initdb was not found on PATH.',
    });
    expect(transitions).toEqual(['environment:running', 'environment:failed']);
    expect(observation.stages.slice(1).every((stage) => stage.status === 'pending')).toBe(true);
    expect(observation.cleanup).toEqual({ status: 'succeeded', leftovers: [] });
  });

  it('reports a server that fails to start, and cleans up after it', async () => {
    const { root, inputs } = await prepare('prisma-migration-corrected');
    const intercept: ToolRunner = async (request) =>
      request.file === 'pg_ctl' && request.args[0] === 'start'
        ? {
            exitCode: 1,
            output: 'pg_ctl: could not start server',
            notFound: false,
            timedOut: false,
            cancelled: false,
          }
        : runTool(request);

    const observation = await verifyMigrationExecution(root, inputs, { runTool: intercept });

    expect(observation.stages[0]?.status).toBe('failed');
    expect(observation.stages[0]?.detail).toContain('pg_ctl start exited with code 1');
    expect(assessMigrationExecution(inputs.subject, observation).state).toBe('NOT_PROVEN');
    expect(observation.cleanup.status).toBe('succeeded');
    await expectRunResourcesRemoved(observation);
  });

  it('names resources it could not confirm were removed', async () => {
    const { root, inputs } = await prepare('prisma-migration-corrected');
    // The server really stops, but the stop is reported as failed and its PID file reappears.
    const intercept: ToolRunner = async (request) => {
      const result = await runTool(request);
      if (request.file !== 'pg_ctl' || request.args[0] !== 'stop') return result;
      const dataDirectory = request.args[1]?.replace('--pgdata=', '') ?? '';
      writeFileSync(join(dataDirectory, 'postmaster.pid'), '0\n');
      return { ...result, exitCode: 1 };
    };

    const observation = await verifyMigrationExecution(root, inputs, { runTool: intercept });

    expect(observation.cleanup.status).toBe('failed');
    expect(observation.cleanup.leftovers).toHaveLength(1);
    expect(observation.cleanup.leftovers[0]).toContain('PostgreSQL server for data directory');
    expect(assessMigrationExecution(inputs.subject, observation).state).toBe('PROVEN');
    await expectRunResourcesRemoved(observation);
  });
});
