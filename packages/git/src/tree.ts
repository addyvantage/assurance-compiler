import { execa } from 'execa';
import { GitError } from './git-error.js';
import { GIT_ENVIRONMENT, runGitOrThrow } from './run-git.js';

/** One entry of a commit's tree. `path` is repository-relative and uses `/`. */
export interface TreeEntry {
  /** Git file mode, such as `100644` (file), `120000` (symlink) or `160000` (submodule). */
  readonly mode: string;
  readonly type: string;
  readonly oid: string;
  /** Size in bytes, or `undefined` for trees and submodules. */
  readonly size: number | undefined;
  readonly path: string;
}

/**
 * Lists every entry under `paths` in `commit`, recursively. Paths are matched literally, so
 * user-supplied paths cannot act as glob patterns.
 */
export async function listTree(
  root: string,
  commit: string,
  paths: readonly string[],
): Promise<TreeEntry[]> {
  const args = ['ls-tree', '-r', '-l', '-z', '--full-tree', commit, '--', ...paths];
  const output = await runGitOrThrow(root, args);
  return output
    .split('\0')
    .filter((record) => record !== '')
    .map((record) => {
      const match = /^(\d{6}) (\w+) ([0-9a-f]{40,64}) +(-|\d+)\t(.+)$/s.exec(record);
      if (match === null) {
        throw new GitError({ kind: 'unexpected-output', args, detail: 'unreadable tree entry' });
      }
      const [, mode = '', type = '', oid = '', size = '', path = ''] = match;
      return { mode, type, oid, size: size === '-' ? undefined : Number(size), path };
    });
}

/** Reads a blob's exact bytes, independent of checkout line-ending conversion. */
export async function readBlob(root: string, oid: string): Promise<Uint8Array> {
  const args = ['cat-file', 'blob', oid];
  const result = await execa('git', args, {
    cwd: root,
    env: GIT_ENVIRONMENT,
    stdin: 'ignore',
    reject: false,
    encoding: 'buffer',
    // The blob's final newline is part of its content.
    stripFinalNewline: false,
  });
  if (result.exitCode !== 0) {
    throw new GitError({
      kind: 'command-failed',
      args,
      exitCode: result.exitCode,
      stderr: new TextDecoder().decode(result.stderr).trim(),
    });
  }
  return result.stdout;
}
