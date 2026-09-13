import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createTemporaryDirectory,
  createTestRepository,
} from '../../../test/support/git-repository.js';
import {
  findRepositoryRoot,
  GitError,
  hasUncommittedChanges,
  readChangeSet,
} from '../src/index.js';

describe('readChangeSet', () => {
  it('distinguishes added, modified, deleted and renamed files', async () => {
    const repository = createTestRepository();
    repository.write('src/modified.ts', 'export const value = 1;\n');
    repository.write('src/deleted.ts', 'export const unused = true;\n');
    repository.write('docs/guide.md', '# Guide\n\nHow to operate the service safely.\n');
    const base = repository.commit('base');

    repository.git('switch', '--quiet', '--create', 'feature');
    repository.write('src/modified.ts', 'export const value = 2;\n');
    repository.git('rm', '--quiet', 'src/deleted.ts');
    repository.git('mv', 'docs/guide.md', 'docs/handbook.md');
    repository.write('src/added.ts', 'export const added = true;\n');
    const head = repository.commit('feature');

    await expect(readChangeSet(repository.root, 'main')).resolves.toEqual({
      base: { ref: 'main', commit: base },
      head: { ref: 'HEAD', commit: head },
      mergeBase: base,
      files: [
        { status: 'renamed', previousPath: 'docs/guide.md', path: 'docs/handbook.md' },
        { status: 'added', path: 'src/added.ts' },
        { status: 'deleted', path: 'src/deleted.ts' },
        { status: 'modified', path: 'src/modified.ts' },
      ],
    });
  });

  it('compares from the merge base, excluding work that landed on the base later', async () => {
    const repository = createTestRepository();
    repository.write('prisma/schema.prisma', 'model User { id Int @id }\n');
    const branchPoint = repository.commit('base');

    repository.git('switch', '--quiet', '--create', 'feature');
    repository.write('src/feature.ts', 'export {};\n');
    const head = repository.commit('feature');

    repository.git('switch', '--quiet', 'main');
    repository.write('prisma/schema.prisma', 'model User { id Int @id\n  age Int? }\n');
    const mainTip = repository.commit('main moves on');
    repository.git('switch', '--quiet', 'feature');

    await expect(readChangeSet(repository.root, 'main')).resolves.toEqual({
      base: { ref: 'main', commit: mainTip },
      head: { ref: 'HEAD', commit: head },
      mergeBase: branchPoint,
      files: [{ status: 'added', path: 'src/feature.ts' }],
    });
  });

  it('returns no files when HEAD is the base', async () => {
    const repository = createTestRepository();
    repository.write('README.md', '# Project\n');
    repository.commit('base');

    const changeSet = await readChangeSet(repository.root, 'main');

    expect(changeSet.files).toEqual([]);
  });

  it.each(['does-not-exist', '--output=/tmp/injected', ''])(
    'reports `%s` as an unresolvable ref',
    async (ref) => {
      const repository = createTestRepository();
      repository.write('README.md', '# Project\n');
      repository.commit('base');

      await expect(readChangeSet(repository.root, ref)).rejects.toMatchObject({
        failure: { kind: 'unresolvable-ref', ref },
      });
    },
  );

  it('reports a repository without commits', async () => {
    const repository = createTestRepository();

    await expect(readChangeSet(repository.root, 'main')).rejects.toMatchObject({
      failure: { kind: 'no-head-commit' },
    });
  });

  it('reports histories that share no commit', async () => {
    const repository = createTestRepository();
    repository.write('README.md', '# Main\n');
    repository.commit('main');
    repository.git('switch', '--quiet', '--orphan', 'unrelated');
    repository.write('README.md', '# Unrelated\n');
    repository.commit('unrelated');

    await expect(readChangeSet(repository.root, 'main')).rejects.toMatchObject({
      failure: { kind: 'no-merge-base', base: 'main', head: 'HEAD' },
    });
  });
});

describe('findRepositoryRoot', () => {
  it('finds the root from a subdirectory', async () => {
    const repository = createTestRepository();
    repository.write('src/users/service.ts', 'export {};\n');
    repository.commit('base');

    const root = await findRepositoryRoot(join(repository.root, 'src', 'users'));

    expect(join(root)).toBe(join(repository.root));
  });

  it('reports a directory outside any repository', async () => {
    const directory = createTemporaryDirectory();

    const failure = findRepositoryRoot(directory);

    await expect(failure).rejects.toBeInstanceOf(GitError);
    await expect(failure).rejects.toMatchObject({
      failure: { kind: 'not-a-repository', directory },
    });
  });
});

describe('hasUncommittedChanges', () => {
  it('is false for a clean working tree and true once anything changes', async () => {
    const repository = createTestRepository();
    repository.write('README.md', '# Project\n');
    repository.commit('base');

    await expect(hasUncommittedChanges(repository.root)).resolves.toBe(false);

    repository.write('prisma/schema.prisma', 'model User { id Int @id }\n');

    await expect(hasUncommittedChanges(repository.root)).resolves.toBe(true);
  });

  it('sees untracked files when status.showUntrackedFiles is no', async () => {
    const repository = createTestRepository();
    repository.write('README.md', '# Project\n');
    repository.commit('base');
    repository.git('config', 'status.showUntrackedFiles', 'no');
    repository.write('notes.txt', 'draft\n');

    await expect(hasUncommittedChanges(repository.root)).resolves.toBe(true);
  });
});
