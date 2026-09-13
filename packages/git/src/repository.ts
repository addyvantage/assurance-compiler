import { GitError } from './git-error.js';
import { commandFailed, runGit } from './run-git.js';

/**
 * Returns the root of the Git working tree containing `directory`.
 *
 * All other operations run from this root, so repository-relative paths are the same
 * no matter which subdirectory the user invoked the tool from.
 */
export async function findRepositoryRoot(directory: string): Promise<string> {
  const args = ['rev-parse', '--show-toplevel'];
  const result = await runGit(directory, args);
  if (result.exitCode === 0) return result.stdout.trim();
  if (result.stderr.includes('not a git repository')) {
    throw new GitError({ kind: 'not-a-repository', directory });
  }
  throw commandFailed(args, result);
}
