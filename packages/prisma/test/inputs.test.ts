import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFixtureRepository } from '../../../test/support/fixture-repository.js';
import type { TestRepository } from '../../../test/support/git-repository.js';
import {
  isRepositoryRelativePath,
  isTableName,
  resolveMigrationInputs,
  type InputResolution,
} from '../src/index.js';

const MIGRATION = 'prisma/migrations/20260913_add_age/migration.sql';

function resolveFor(
  repository: TestRepository,
  seedPath = 'prisma/seed.sql',
): Promise<InputResolution> {
  return resolveMigrationInputs(repository.root, {
    baseline: repository.git('merge-base', 'main', 'HEAD').trim(),
    candidate: repository.git('rev-parse', 'HEAD').trim(),
    seedPath,
    expectedTables: ['public.User'],
  });
}

function blob(repository: TestRepository, revision: string, path: string): string {
  return repository.git('rev-parse', `${revision}:${path}`).trim();
}

async function reasonFor(repository: TestRepository, seedPath?: string): Promise<string> {
  const resolution = await resolveFor(repository, seedPath);
  if (resolution.ok) throw new Error('Expected the inputs to be rejected.');
  return resolution.reason;
}

describe('isTableName', () => {
  it.each([
    ['public.User', true],
    ['app_data.order_items', true],
    [`public.${'t'.repeat(63)}`, true],
    ['User', false],
    ['a.b.c', false],
    ['public."User"', false],
    ['public.User; DROP TABLE "User"', false],
    ['1public.User', false],
    [`public.${'t'.repeat(64)}`, false],
  ])('%s → %s', (value, expected) => {
    expect(isTableName(value)).toBe(expected);
  });
});

describe('isRepositoryRelativePath', () => {
  it.each(['prisma/seed.sql', 'seed.sql', 'db fixtures/überblick.sql'])('accepts %s', (path) => {
    expect(isRepositoryRelativePath(path)).toBe(true);
  });

  it.each([
    '',
    '/etc/passwd',
    '../seed.sql',
    'prisma/../../seed.sql',
    './seed.sql',
    'prisma//seed.sql',
    'prisma/seed.sql/',
    'prisma\\seed.sql',
    'C:/seed.sql',
  ])('rejects %j', (path) => {
    expect(isRepositoryRelativePath(path)).toBe(false);
  });
});

describe('resolveMigrationInputs', () => {
  it('identifies every input by its immutable Git object', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    const baseline = repository.git('rev-parse', 'main').trim();

    const resolution = await resolveFor(repository);

    expect(resolution.ok && resolution.inputs.subject).toEqual({
      baseline,
      candidate: repository.git('rev-parse', 'HEAD').trim(),
      schema: {
        baseline: blob(repository, baseline, 'prisma/schema.prisma'),
        candidate: blob(repository, 'HEAD', 'prisma/schema.prisma'),
      },
      seed: { path: 'prisma/seed.sql', blob: blob(repository, baseline, 'prisma/seed.sql') },
      baselineMigrations: [
        {
          name: '20260801_init',
          blob: blob(repository, baseline, 'prisma/migrations/20260801_init/migration.sql'),
        },
      ],
      candidateMigrations: [
        { name: '20260913_add_age', blob: blob(repository, 'HEAD', MIGRATION) },
      ],
      expectedTables: ['public.User'],
    });
  });

  it('ignores uncommitted edits to migrations and the seed fixture', async () => {
    const repository = createFixtureRepository('prisma-migration-unsafe');
    const committed = repository.git('show', `HEAD:${MIGRATION}`);
    repository.write(MIGRATION, 'ALTER TABLE "User" ADD COLUMN "age" INTEGER;\n');
    repository.write('prisma/seed.sql', '-- edited locally\n');

    const resolution = await resolveFor(repository);

    if (!resolution.ok) throw new Error(resolution.reason);
    expect(resolution.inputs.subject.candidateMigrations[0]?.blob).toBe(
      blob(repository, 'HEAD', MIGRATION),
    );
    expect(new TextDecoder().decode(resolution.inputs.candidate.migrations[1]?.sql)).toBe(
      committed,
    );
    expect(resolution.inputs.subject.seed.blob).toBe(blob(repository, 'main', 'prisma/seed.sql'));
  });

  it('preserves committed bytes exactly, whatever the host line endings', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.git('switch', '--quiet', 'main');
    writeFileSync(join(repository.root, 'prisma', 'seed-crlf.sql'), 'SELECT 1;\r\nSELECT 2;\r\n');
    repository.commit('add a CRLF fixture');
    repository.git('switch', '--quiet', 'feature');
    repository.git('rebase', '--quiet', 'main');

    const resolution = await resolveFor(repository, 'prisma/seed-crlf.sql');

    expect(resolution.ok && new TextDecoder().decode(resolution.inputs.seed)).toBe(
      'SELECT 1;\r\nSELECT 2;\r\n',
    );
  });

  it('requires a candidate migration for a schema change', async () => {
    const repository = createFixtureRepository('prisma-schema-change');

    expect(await reasonFor(repository)).toContain('adds no migration');
  });

  it('rejects an edited historical migration', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.write(
      'prisma/migrations/20260801_init/migration.sql',
      'CREATE TABLE "Other" ("id" INTEGER);\n',
    );
    repository.commit('edit history');

    expect(await reasonFor(repository)).toContain('edits existing migration 20260801_init');
  });

  it('rejects a deleted historical migration', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.git('rm', '--quiet', 'prisma/migrations/20260801_init/migration.sql');
    repository.commit('delete history');

    expect(await reasonFor(repository)).toContain('deletes existing migration 20260801_init');
  });

  it('rejects a new migration that sorts before existing history', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.write('prisma/migrations/20260101_early/migration.sql', 'SELECT 1;\n');
    repository.commit('out of order');

    expect(await reasonFor(repository)).toContain(
      '20260101_early sorts before existing migrations',
    );
  });

  it('rejects unsupported files in the migrations directory', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.write('prisma/migrations/20260913_add_age/notes.md', '# Notes\n');
    repository.commit('extra file');

    expect(await reasonFor(repository)).toContain('is not a supported Prisma migration file');
  });

  it('rejects a schema without the supported PostgreSQL datasource', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    const schema = repository.git('show', 'HEAD:prisma/schema.prisma');
    repository.write(
      'prisma/schema.prisma',
      schema.replace(
        'url      = env("DATABASE_URL")',
        'url      = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")',
      ),
    );
    repository.commit('direct url');

    expect(await reasonFor(repository)).toContain(
      'directUrl and shadowDatabaseUrl are not supported',
    );
  });

  it('rejects a symbolic link in the Prisma project', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.write('link-target.txt', 'prisma/other.prisma');
    const target = repository.git('hash-object', '-w', 'link-target.txt').trim();
    repository.git('rm', '--quiet', '--cached', 'prisma/schema.prisma');
    repository.git('update-index', '--add', '--cacheinfo', `120000,${target},prisma/schema.prisma`);
    repository.git('commit', '--quiet', '--message', 'symlink schema');

    expect(await reasonFor(repository)).toContain('prisma/schema.prisma is a symbolic link');
  });

  it('requires the seed fixture to exist at the merge base, not only on the base tip', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.git('switch', '--quiet', 'main');
    repository.write(
      'prisma/seed-late.sql',
      'INSERT INTO "User" ("email") VALUES (\'late@example.com\');\n',
    );
    repository.commit('main moves on');
    repository.git('switch', '--quiet', 'feature');

    const mergeBase = repository.git('merge-base', 'main', 'HEAD').trim();

    expect(await reasonFor(repository, 'prisma/seed-late.sql')).toContain(
      `does not exist at the merge-base commit ${mergeBase.slice(0, 7)}`,
    );
  });
});
