import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFixtureRepository } from '../../../test/support/fixture-repository.js';
import { createTemporaryDirectory } from '../../../test/support/git-repository.js';
import { assure } from './support/run-assure.js';

const RULE = '─'.repeat(72);

const SCHEMA_AND_MIGRATION_PLAN = [
  RULE,
  `Assurance plan${' '.repeat(47)}main...HEAD`,
  RULE,
  '',
  '2 of 3 changed files are assurance-sensitive',
  '',
  'DATABASE_SCHEMA_CHANGE',
  '',
  '  added     prisma/migrations/20260913_add_age/migration.sql',
  '  modified  prisma/schema.prisma',
  '',
  'Requires',
  '',
  '  NONEMPTY_MIGRATION_EXECUTION',
  '  Migrations execute against a populated database',
  '',
  '  Why',
  '  This change modifies the database schema. A migration that succeeds on',
  '  an empty database may still fail against existing rows.',
  '',
  '  Establishes',
  '  The candidate migrations apply without error to a database that',
  '  already contains data.',
  '',
  '  Does not establish',
  '  · Existing data is preserved or transformed correctly',
  '  · The migration completes within production time or lock budgets',
  '  · Application code stays compatible with the schema during rollout',
  '  · The populated data reflects every shape of production data',
  '',
  '  Status',
  '  MISSING  No evidence provider is available for this requirement.',
  '',
  'Summary',
  '',
  '  1 requirement',
  '  0 proven',
  '  1 missing',
  '',
  'Verdict: INCOMPLETE',
  RULE,
  '',
].join('\n');

describe('assure diff', () => {
  describe('text output', () => {
    it('renders the assurance plan for a schema and migration change', async () => {
      const repository = createFixtureRepository('prisma-schema-and-migration-change');

      await expect(assure(['diff', 'main'], repository.root)).resolves.toEqual({
        exitCode: 0,
        stdout: SCHEMA_AND_MIGRATION_PLAN,
        stderr: '',
      });
    });

    it.each([
      ['prisma-schema-change', '  modified  prisma/schema.prisma'],
      ['prisma-migration-change', '  added     prisma/migrations/20260913_add_age/migration.sql'],
    ] as const)('plans %s', async (fixture, fileLine) => {
      const repository = createFixtureRepository(fixture);

      const { stdout } = await assure(['diff', 'main'], repository.root);

      expect(stdout).toContain(
        [
          '1 of 1 changed file is assurance-sensitive',
          '',
          'DATABASE_SCHEMA_CHANGE',
          '',
          fileLine,
          '',
        ].join('\n'),
      );
      expect(stdout).toContain('  NONEMPTY_MIGRATION_EXECUTION\n');
      expect(stdout).toContain('Verdict: INCOMPLETE\n');
    });

    it('reports nothing detected without claiming the change is safe', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      const result = await assure(['diff', 'main'], repository.root);

      expect(result).toEqual({
        exitCode: 0,
        stdout:
          'No assurance-sensitive changes detected.\n1 changed file in main...HEAD · detectors: prisma\n',
        stderr: '',
      });
      expect(result.stdout).not.toMatch(/safe|all good|verified|complete/i);
    });

    it('treats --base exactly like the positional base', async () => {
      const repository = createFixtureRepository('prisma-schema-and-migration-change');

      const { stdout } = await assure(['diff', '--base', 'main'], repository.root);

      expect(stdout).toBe(SCHEMA_AND_MIGRATION_PLAN);
    });

    it('plans the whole repository when run from a subdirectory', async () => {
      const repository = createFixtureRepository('prisma-schema-and-migration-change');

      const { stdout } = await assure(['diff', 'main'], join(repository.root, 'src', 'users'));

      expect(stdout).toBe(SCHEMA_AND_MIGRATION_PLAN);
    });

    it('notes that uncommitted changes are not part of the plan', async () => {
      const repository = createFixtureRepository('prisma-no-change');
      repository.write('prisma/schema.prisma', 'model Draft { id Int @id }\n');

      const { stdout } = await assure(['diff', 'main'], repository.root);

      expect(stdout).toContain('No assurance-sensitive changes detected.\n');
      expect(stdout).toContain('Uncommitted changes are not included. Commit them to plan them.\n');
    });
  });

  describe('JSON output', () => {
    it('prints the plan as a version 1 document', async () => {
      const repository = createFixtureRepository('prisma-schema-and-migration-change');
      const base = repository.git('rev-parse', 'main').trim();
      const head = repository.git('rev-parse', 'HEAD').trim();

      const result = await assure(['diff', 'main', '--json'], repository.root);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.endsWith('}\n')).toBe(true);
      expect(JSON.parse(result.stdout)).toEqual({
        version: 1,
        base: { ref: 'main', commit: base },
        head: { ref: 'HEAD', commit: head },
        mergeBase: base,
        detectors: ['prisma'],
        changes: [
          {
            surface: 'DATABASE_SCHEMA_CHANGE',
            detector: 'prisma',
            files: [
              { path: 'prisma/migrations/20260913_add_age/migration.sql', status: 'added' },
              { path: 'prisma/schema.prisma', status: 'modified' },
            ],
          },
        ],
        requirements: [
          {
            id: 'NONEMPTY_MIGRATION_EXECUTION',
            state: 'MISSING',
            triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
            evidence: [],
          },
        ],
        verdict: 'INCOMPLETE',
      });
    });

    it('prints an empty plan when nothing is detected', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      const { stdout } = await assure(['diff', 'main', '--json'], repository.root);

      expect(JSON.parse(stdout)).toMatchObject({
        detectors: ['prisma'],
        changes: [],
        requirements: [],
        verdict: 'COMPLETE',
      });
    });

    it('keeps stdout pure JSON when the working tree has uncommitted changes', async () => {
      const repository = createFixtureRepository('prisma-no-change');
      repository.write('notes.txt', 'draft\n');

      const result = await assure(['diff', 'main', '--json'], repository.root);

      expect(() => JSON.parse(result.stdout) as unknown).not.toThrow();
      expect(result.stderr).toBe('note: uncommitted changes are not included in this plan\n');
    });

    it('detects untracked files even when Git is configured to hide them', async () => {
      const repository = createFixtureRepository('prisma-no-change');
      repository.git('config', 'status.showUntrackedFiles', 'no');
      repository.write('notes.txt', 'draft\n');

      const text = await assure(['diff', 'main'], repository.root);
      const json = await assure(['diff', 'main', '--json'], repository.root);

      expect(text.stdout).toContain('Uncommitted changes are not included.');
      expect(JSON.parse(json.stdout)).toMatchObject({ version: 1 });
      expect(json.stderr).toBe('note: uncommitted changes are not included in this plan\n');
    });
  });

  describe('exit codes and errors', () => {
    it('exits 0 for an INCOMPLETE plan, because diff is analytical rather than a gate', async () => {
      const repository = createFixtureRepository('prisma-schema-change');

      const result = await assure(['diff', 'main'], repository.root);

      expect(result.stdout).toContain('Verdict: INCOMPLETE');
      expect(result.exitCode).toBe(0);
    });

    it('exits 0 for a COMPLETE plan', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      const result = await assure(['diff', 'main', '--json'], repository.root);

      expect(JSON.parse(result.stdout)).toMatchObject({ verdict: 'COMPLETE' });
      expect(result.exitCode).toBe(0);
    });

    it('exits 1 outside a Git repository', async () => {
      const directory = createTemporaryDirectory();

      await expect(assure(['diff', 'main'], directory)).resolves.toEqual({
        exitCode: 1,
        stdout: '',
        stderr: 'error: Not a Git repository.\n       Run this command from inside a repository.\n',
      });
    });

    it('exits 1 when the base ref cannot be resolved', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      await expect(assure(['diff', 'foo'], repository.root)).resolves.toEqual({
        exitCode: 1,
        stdout: '',
        stderr:
          'error: Could not resolve base ref `foo`.\n' +
          '       Check that the ref exists locally. CI checkouts may need to fetch it first.\n',
      });
    });

    it('shows diagnostic details only with --debug', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      const concise = await assure(['diff', 'foo'], repository.root);
      const detailed = await assure(['diff', 'foo', '--debug'], repository.root);

      expect(concise.stderr).not.toContain('GitError');
      expect(detailed.exitCode).toBe(1);
      expect(detailed.stderr).toContain('"kind": "unresolvable-ref"');
      expect(detailed.stderr).toContain('GitError: Could not resolve `foo` to a commit.');
    });

    it('exits 2 when the base is supplied both positionally and with --base', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      const result = await assure(['diff', 'main', '--base', 'main'], repository.root);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe(
        'error: pass the base ref as an argument or with --base, not both\n',
      );
    });

    it.each([
      [['diff', '--base', 'invalid', '--base', 'main', '--json']],
      [['diff', '--base', 'main', '--base', 'main']],
    ])('exits 2 when --base is repeated: %j', async (args) => {
      const repository = createFixtureRepository('prisma-no-change');

      const result = await assure(args, repository.root);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('--base may be given only once');
    });

    it('exits 2 when no base is supplied', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      const result = await assure(['diff'], repository.root);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe('error: missing base ref, for example `assure diff main`\n');
    });

    it('exits 2 for an unknown option', async () => {
      const repository = createFixtureRepository('prisma-no-change');

      const result = await assure(['diff', 'main', '--verbose'], repository.root);

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("unknown option '--verbose'");
    });

    it('exits 0 for --help and --version', async () => {
      const directory = createTemporaryDirectory();

      const help = await assure(['diff', '--help'], directory);
      const version = await assure(['--version'], directory);

      expect(help.exitCode).toBe(0);
      expect(help.stdout).toContain('Usage: assure diff [options] [base]');
      expect(version).toEqual({ exitCode: 0, stdout: '0.1.0\n', stderr: '' });
    });
  });
});
