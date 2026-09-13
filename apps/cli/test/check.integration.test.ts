import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assessMigrationExecution,
  type CheckDocument,
  type MigrationExecutionObservation,
} from '@assurance-compiler/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureRepository,
  type FixtureName,
} from '../../../test/support/fixture-repository.js';
import {
  createTemporaryDirectory,
  type TestRepository,
} from '../../../test/support/git-repository.js';
import {
  expectRunResourcesRemoved,
  installPrisma,
  requireIntegrationTools,
} from '../../../test/support/integration.js';
import { assure } from './support/run-assure.js';

const MIGRATION = 'prisma/migrations/20260913_add_age/migration.sql';

let nodeModules: string;

beforeAll(() => {
  nodeModules = requireIntegrationTools();
});

function repositoryFor(fixture: FixtureName): TestRepository {
  const repository = createFixtureRepository(fixture);
  installPrisma(repository, nodeModules);
  return repository;
}

async function checkJson(
  repository: TestRepository,
  seed = 'prisma/seed.sql',
): Promise<{
  exitCode: number;
  document: CheckDocument;
  verification: MigrationExecutionObservation;
  stdout: string;
}> {
  const result = await assure(
    ['check', 'main', '--seed-sql', seed, '--expect-table', 'public.User', '--json'],
    repository.root,
  );
  const document = JSON.parse(result.stdout) as CheckDocument;
  if (document.verification === null)
    throw new Error(`No verification ran: ${result.stdout}${result.stderr}`);
  await expectRunResourcesRemoved(document.verification);
  return {
    exitCode: result.exitCode,
    document,
    verification: document.verification,
    stdout: result.stdout,
  };
}

const statuses = (verification: MigrationExecutionObservation) =>
  verification.stages.map((stage) => stage.status);

describe('assure check against real PostgreSQL and Prisma', () => {
  it('FAILS a migration that cannot apply to existing rows', async () => {
    const { exitCode, document, verification, stdout } = await checkJson(
      repositoryFor('prisma-migration-unsafe'),
    );

    expect(exitCode).toBe(1);
    expect(document).toMatchObject({
      verdict: 'FAILED',
      requirements: [
        {
          id: 'NONEMPTY_MIGRATION_EXECUTION',
          state: 'FAILED',
          evidence: [{ outcome: 'VIOLATES' }],
        },
      ],
    });
    expect(statuses(verification)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
      'succeeded',
      'failed',
    ]);
    expect(verification).toMatchObject({
      origin: 'local',
      environment: { prisma: '6.19.3' },
      populatedTables: [{ table: 'public.User', populated: true }],
      migrationFailure: {
        migration: '20260913_add_age',
        sqlState: '23502',
        message: 'column "age" of relation "User" contains null values',
      },
      cleanup: { status: 'succeeded', leftovers: [] },
    });
    expect(verification.environment.postgres).toMatch(/^\d+\.\d+/);
    expect(stdout).not.toContain('@example.com');
    expect(stdout).not.toMatch(/postgresql:\/\/|PGPASSWORD/);
  });

  it('PROVES the corrected migration against the same baseline fixture', async () => {
    const unsafe = await checkJson(repositoryFor('prisma-migration-unsafe'));
    const corrected = await checkJson(repositoryFor('prisma-migration-corrected'));

    expect(corrected.exitCode).toBe(0);
    expect(corrected.document).toMatchObject({
      verdict: 'COMPLETE',
      requirements: [{ state: 'PROVEN', evidence: [{ outcome: 'SATISFIES' }] }],
    });
    expect(statuses(corrected.verification)).toEqual(Array(5).fill('succeeded'));
    expect(corrected.verification.subject.seed).toEqual(unsafe.verification.subject.seed);
    expect(corrected.verification.subject.baselineMigrations).toEqual(
      unsafe.verification.subject.baselineMigrations,
    );
  });

  it('is NOT_PROVEN when an expected table has no rows', async () => {
    const { exitCode, document, verification } = await checkJson(
      repositoryFor('prisma-migration-corrected'),
      'prisma/seed-empty.sql',
    );

    expect(exitCode).toBe(3);
    expect(document.requirements[0]?.state).toBe('NOT_PROVEN');
    expect(statuses(verification)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
      'failed',
      'pending',
    ]);
    expect(verification.stages[3]?.detail).toBe('No rows after seeding in public.User.');
  });

  it('is NOT_PROVEN when the seed fixture does not fit the baseline schema', async () => {
    const { exitCode, verification, stdout } = await checkJson(
      repositoryFor('prisma-migration-unsafe'),
      'prisma/seed-invalid.sql',
    );

    expect(exitCode).toBe(3);
    expect(statuses(verification)).toEqual([
      'succeeded',
      'succeeded',
      'failed',
      'pending',
      'pending',
    ]);
    expect(verification.stages[2]?.detail).toBe(
      'prisma db execute exited with code 1: the database message is not recorded because it can contain row values.',
    );
    expect(stdout).not.toContain('Failing row');
  });

  it('executes committed migrations, not uncommitted edits', async () => {
    const repository = repositoryFor('prisma-migration-unsafe');
    repository.write(
      MIGRATION,
      'ALTER TABLE "User" ADD COLUMN "age" INTEGER NOT NULL DEFAULT 0;\n',
    );

    const { exitCode, document } = await checkJson(repository);

    expect(exitCode).toBe(1);
    expect(document.verdict).toBe('FAILED');
  });

  it('keeps the merge base as the baseline after main advances', async () => {
    const repository = repositoryFor('prisma-migration-unsafe');
    const mergeBase = repository.git('rev-parse', 'main').trim();
    repository.git('switch', '--quiet', 'main');
    repository.write('prisma/seed.sql', '-- main no longer seeds any rows\n');
    const tip = repository.commit('main empties the seed');
    repository.git('switch', '--quiet', 'feature');

    const { exitCode, document, verification } = await checkJson(repository);

    expect(exitCode).toBe(1);
    expect(document).toMatchObject({ base: { ref: 'main', commit: tip }, mergeBase });
    expect(verification.subject.baseline).toBe(mergeBase);
    expect(verification.subject.seed.blob).toBe(
      repository.git('rev-parse', `${mergeBase}:prisma/seed.sql`).trim(),
    );
  });

  it('rejects real evidence when assessed against different inputs', async () => {
    const { verification } = await checkJson(repositoryFor('prisma-migration-corrected'));

    expect(assessMigrationExecution(verification.subject, verification).state).toBe('PROVEN');
    expect(
      assessMigrationExecution(
        { ...verification.subject, candidate: 'f'.repeat(40) },
        verification,
      ),
    ).toMatchObject({
      state: 'NOT_PROVEN',
      evidence: [],
    });
  });

  it('renders a failing result verdict-first and writes the same record as evidence', async () => {
    const repository = repositoryFor('prisma-migration-unsafe');
    const destination = join(createTemporaryDirectory(), 'evidence.json');

    const result = await assure(
      [
        'check',
        'main',
        '--seed-sql',
        'prisma/seed.sql',
        '--expect-table',
        'public.User',
        '--evidence-out',
        destination,
      ],
      repository.root,
    );
    const evidence = JSON.parse(readFileSync(destination, 'utf8')) as CheckDocument;

    expect(result.exitCode).toBe(1);
    expect(result.stdout.startsWith('Verdict: FAILED\nNONEMPTY_MIGRATION_EXECUTION failed.')).toBe(
      true,
    );
    expect(result.stdout).toContain('failed     candidate-migrations');
    expect(result.stdout).toContain('SQLSTATE 23502');
    expect(result.stdout).toContain(`Evidence   ${destination}`);
    expect(evidence).toMatchObject({
      version: 1,
      verdict: 'FAILED',
      verification: { migrationFailure: { sqlState: '23502' } },
    });
  });
});
