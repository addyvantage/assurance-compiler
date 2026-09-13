import type { Revision } from '@assurance-compiler/core';
import { GitError } from './git-error.js';
import { commandFailed, runGit } from './run-git.js';

/** Resolves a user-supplied ref (branch, tag, SHA, `HEAD~2`, ...) to a full commit ID. */
export async function resolveCommit(root: string, ref: string): Promise<string> {
  const commit = await tryResolveCommit(root, ref);
  if (commit === undefined) throw new GitError({ kind: 'unresolvable-ref', ref });
  return commit;
}

export async function resolveHeadCommit(root: string): Promise<string> {
  const commit = await tryResolveCommit(root, 'HEAD');
  if (commit === undefined) throw new GitError({ kind: 'no-head-commit' });
  return commit;
}

/** Returns the best common ancestor of two commits. */
export async function findMergeBase(root: string, base: Revision, head: Revision): Promise<string> {
  const args = ['merge-base', base.commit, head.commit];
  const result = await runGit(root, args);
  if (result.exitCode === 0) return result.stdout.trim();
  if (result.exitCode === 1) {
    throw new GitError({ kind: 'no-merge-base', base: base.ref, head: head.ref });
  }
  throw commandFailed(args, result);
}

async function tryResolveCommit(root: string, ref: string): Promise<string | undefined> {
  // Arguments never pass through a shell, but a ref beginning with `-` would still be
  // read by Git as an option. No valid ref starts with `-`, so such input is unresolvable.
  if (ref === '' || ref.startsWith('-') || ref.includes('\0')) return undefined;

  const result = await runGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return result.exitCode === 0 ? result.stdout.trim() : undefined;
}
