import { compareChangedFiles, type ChangedFile } from '@assurance-compiler/core';
import { GitError } from './git-error.js';
import { parseNameStatus, UnexpectedNameStatusError } from './name-status.js';
import { runGitOrThrow } from './run-git.js';

/**
 * Lists files that differ between two commits, ordered by path.
 *
 * Uses `diff-tree`, a plumbing command whose output is not affected by user
 * configuration such as `diff.renames`, `diff.relative` or colour settings.
 */
export async function listChangedFiles(
  root: string,
  fromCommit: string,
  toCommit: string,
): Promise<ChangedFile[]> {
  const args = ['diff-tree', '-r', '-z', '--name-status', '--find-renames', fromCommit, toCommit];
  const output = await runGitOrThrow(root, args);
  try {
    return parseNameStatus(output).sort(compareChangedFiles);
  } catch (error) {
    if (!(error instanceof UnexpectedNameStatusError)) throw error;
    throw new GitError(
      { kind: 'unexpected-output', args, detail: error.message },
      { cause: error },
    );
  }
}
