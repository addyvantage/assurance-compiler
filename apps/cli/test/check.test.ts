import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFixtureRepository } from '../../../test/support/fixture-repository.js';
import { createTemporaryDirectory } from '../../../test/support/git-repository.js';
import { assure } from './support/run-assure.js';

const CONFIG = ['--seed-sql', 'prisma/seed.sql', '--expect-table', 'public.User'];

describe('assure check', () => {
  describe('invalid usage exits 2', () => {
    it.each<[string, string[], string]>([
      [
        'a seed without tables',
        ['--seed-sql', 'prisma/seed.sql'],
        '--seed-sql requires at least one --expect-table',
      ],
      [
        'tables without a seed',
        ['--expect-table', 'public.User'],
        '--expect-table requires --seed-sql',
      ],
      [
        'a Windows-style seed path',
        ['--seed-sql', 'prisma\\seed.sql', '--expect-table', 'public.User'],
        'repository-relative',
      ],
      [
        'a seed path outside the repository',
        ['--seed-sql', '../seed.sql', '--expect-table', 'public.User'],
        'repository-relative',
      ],
      [
        'an unqualified table',
        ['--seed-sql', 'prisma/seed.sql', '--expect-table', 'User'],
        'schema.table',
      ],
      [
        'an injected table name',
        ['--seed-sql', 'prisma/seed.sql', '--expect-table', 'public.User"; DROP TABLE "User"; --'],
        'schema.table',
      ],
      [
        'Prisma metadata as a table',
        ['--seed-sql', 'prisma/seed.sql', '--expect-table', 'public._prisma_migrations'],
        '_prisma_migrations',
      ],
      [
        'a repeated seed',
        ['--seed-sql', 'a.sql', '--seed-sql', 'b.sql', '--expect-table', 'public.User'],
        '--seed-sql may be given only once',
      ],
    ])('rejects %s', async (_description, options, message) => {
      const repository = createFixtureRepository('prisma-migration-corrected');

      const result = await assure(['check', 'main', ...options], repository.root);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(message);
    });

    it.each([
      [['check', '--base', 'invalid', '--base', 'main', '--json']],
      [['check', '--base', 'main', '--base', 'main']],
      [['check', 'main', '--base', 'main']],
    ])('rejects an ambiguous base: %j', async (args) => {
      const repository = createFixtureRepository('prisma-no-change');

      const result = await assure(args, repository.root);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
    });
  });

  it('reports MISSING and exits 3 when migration verification is not configured', async () => {
    const repository = createFixtureRepository('prisma-migration-unsafe');

    const text = await assure(['check', 'main'], repository.root);
    const json = await assure(['check', 'main', '--json'], repository.root);

    expect(text.exitCode).toBe(3);
    expect(text.stdout.startsWith('Verdict: INCOMPLETE\n')).toBe(true);
    expect(text.stdout.replace(/\s+/g, ' ')).toContain(
      'NONEMPTY_MIGRATION_EXECUTION is missing: no migration verification is configured.',
    );
    expect(text.stdout).toContain(
      'assure check main --seed-sql <path> --expect-table <schema.table>',
    );
    expect(json.exitCode).toBe(3);
    expect(JSON.parse(json.stdout)).toMatchObject({
      verdict: 'INCOMPLETE',
      requirements: [{ id: 'NONEMPTY_MIGRATION_EXECUTION', state: 'MISSING' }],
      verification: null,
    });
  });

  it('exits 0 and states its limited scope when nothing supported changed', async () => {
    const repository = createFixtureRepository('prisma-no-change');

    await expect(assure(['check', 'main', ...CONFIG], repository.root)).resolves.toEqual({
      exitCode: 0,
      stdout: [
        'No supported assurance-sensitive changes detected.',
        'No assurance requirements were evaluated for this change.',
        '1 changed file in main...HEAD · detectors: prisma',
        '',
      ].join('\n'),
      stderr: '',
    });
  });

  it('is NOT_PROVEN, without running verification, when a schema change adds no migration', async () => {
    const repository = createFixtureRepository('prisma-schema-change');

    const result = await assure(['check', 'main', ...CONFIG, '--json'], repository.root);

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      verdict: 'INCOMPLETE',
      requirements: [
        { state: 'NOT_PROVEN', reason: expect.stringContaining('adds no migration') as unknown },
      ],
      verification: null,
    });
  });

  it('verifies against the merge base, not the base tip, and records both', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    repository.git('switch', '--quiet', 'main');
    repository.write('prisma/seed-late.sql', '-- added after the branch diverged\n');
    const tip = repository.commit('main moves on');
    repository.git('switch', '--quiet', 'feature');
    const mergeBase = repository.git('merge-base', 'main', 'HEAD').trim();

    const result = await assure(
      [
        'check',
        'main',
        '--seed-sql',
        'prisma/seed-late.sql',
        '--expect-table',
        'public.User',
        '--json',
      ],
      repository.root,
    );

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      base: { ref: 'main', commit: tip },
      mergeBase,
      requirements: [
        {
          state: 'NOT_PROVEN',
          reason: expect.stringContaining(`merge-base commit ${mergeBase.slice(0, 7)}`) as unknown,
        },
      ],
    });
  });

  it('is NOT_PROVEN without starting PostgreSQL when the repository has no Prisma CLI', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');

    const result = await assure(['check', 'main', ...CONFIG, '--json'], repository.root);

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({
      requirements: [{ state: 'NOT_PROVEN' }],
      verification: {
        environment: {},
        stages: [
          {
            name: 'environment',
            status: 'failed',
            detail: expect.stringContaining('node_modules/prisma') as unknown,
          },
          { name: 'baseline-migrations', status: 'pending' },
          { name: 'seed', status: 'pending' },
          { name: 'population-check', status: 'pending' },
          { name: 'candidate-migrations', status: 'pending' },
        ],
        cleanup: { status: 'succeeded', leftovers: [] },
      },
    });
  });

  it('writes an evidence file once, with a matching hash, and never overwrites it', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    const destination = join(createTemporaryDirectory(), 'evidence with spaces.json');

    const first = await assure(
      ['check', 'main', ...CONFIG, '--json', '--evidence-out', destination],
      repository.root,
    );
    const written = readFileSync(destination);
    const { artifact, ...document } = JSON.parse(first.stdout) as { artifact: unknown };

    expect(first.exitCode).toBe(3);
    expect(JSON.parse(written.toString('utf8'))).toEqual(document);
    expect(artifact).toEqual({
      path: destination,
      sha256: createHash('sha256').update(written).digest('hex'),
    });

    const second = await assure(
      ['check', 'main', ...CONFIG, '--evidence-out', destination],
      repository.root,
    );

    expect(second.exitCode).toBe(2);
    expect(second.stderr).toContain('already exists');
    expect(readFileSync(destination)).toEqual(written);
  });

  it('refuses an existing evidence destination before verifying anything', async () => {
    const repository = createFixtureRepository('prisma-migration-corrected');
    const destination = join(createTemporaryDirectory(), 'evidence.json');
    writeFileSync(destination, 'keep me');

    const result = await assure(
      ['check', 'main', ...CONFIG, '--evidence-out', destination],
      repository.root,
    );

    expect(result).toMatchObject({ exitCode: 2, stdout: '' });
    expect(readFileSync(destination, 'utf8')).toBe('keep me');
  });

  it('exits 3 outside a Git repository', async () => {
    const result = await assure(['check', 'main'], createTemporaryDirectory());

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('Not a Git repository.');
  });

  it('keeps stdout pure JSON and reports uncommitted changes on stderr', async () => {
    const repository = createFixtureRepository('prisma-migration-unsafe');
    repository.git('config', 'status.showUntrackedFiles', 'no');
    repository.write('notes.txt', 'draft\n');

    const result = await assure(['check', 'main', '--json'], repository.root);

    expect(() => JSON.parse(result.stdout) as unknown).not.toThrow();
    expect(result.stderr).toBe('note: uncommitted changes are not included in this check\n');
  });
});
