import type { ChangeSet, Revision } from '@assurance-compiler/core';
import { listChangedFiles } from './changed-files.js';
import { findMergeBase, resolveCommit, resolveHeadCommit } from './revisions.js';

/**
 * Reads the change `HEAD` introduces relative to `baseRef`.
 *
 * Files are compared from the merge base rather than from the tip of `baseRef`, which
 * matches what a pull request shows: commits that landed on the base after the branch
 * diverged are not part of this change. Uncommitted work is not included.
 */
export async function readChangeSet(root: string, baseRef: string): Promise<ChangeSet> {
  const head: Revision = { ref: 'HEAD', commit: await resolveHeadCommit(root) };
  const base: Revision = { ref: baseRef, commit: await resolveCommit(root, baseRef) };
  const mergeBase = await findMergeBase(root, base, head);
  const files = await listChangedFiles(root, mergeBase, head.commit);
  return { base, head, mergeBase, files };
}
