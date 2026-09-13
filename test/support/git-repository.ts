import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { onTestFinished } from 'vitest';

export interface TestRepository {
  readonly root: string;
  git(...args: string[]): string;
  write(path: string, content: string): void;
  /** Stages every change and commits it, returning the new commit ID. */
  commit(message: string): string;
}

/** Creates a directory that is removed when the current test finishes. */
export function createTemporaryDirectory(): string {
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), 'assure-test-')));
  onTestFinished(() => {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5 });
  });
  return directory;
}

/** Creates an empty Git repository on `main`, removed when the current test finishes. */
export function createTestRepository(): TestRepository {
  const root = createTemporaryDirectory();
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  git('init', '--quiet', '--initial-branch=main');

  return {
    root,
    git,
    write(path, content) {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    },
    commit(message) {
      git('add', '--all');
      git('commit', '--quiet', '--message', message);
      return git('rev-parse', 'HEAD').trim();
    },
  };
}
