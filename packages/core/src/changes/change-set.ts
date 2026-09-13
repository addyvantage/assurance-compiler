import type { ChangedFile } from './changed-file.js';

/** A revision as the user named it, and the commit it resolved to. */
export interface Revision {
  readonly ref: string;
  readonly commit: string;
}

/**
 * The change under analysis.
 *
 * `files` lists everything that differs between `mergeBase` and `head`: the work
 * introduced on top of `base`, excluding anything that landed on `base` afterwards.
 */
export interface ChangeSet {
  readonly base: Revision;
  readonly head: Revision;
  readonly mergeBase: string;
  readonly files: readonly ChangedFile[];
}
