import { runGitOrThrow } from './run-git.js';

/**
 * True when the working tree has staged, unstaged or untracked changes.
 * Untracked files are requested explicitly so `status.showUntrackedFiles=no` cannot hide them.
 */
export async function hasUncommittedChanges(root: string): Promise<boolean> {
  const output = await runGitOrThrow(root, [
    'status',
    '--porcelain',
    '-z',
    '--untracked-files=normal',
  ]);
  return output.length > 0;
}
