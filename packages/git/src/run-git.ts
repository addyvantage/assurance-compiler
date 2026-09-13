import { execa } from 'execa';
import { GitError } from './git-error.js';

export interface GitResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export const GIT_ENVIRONMENT = {
  // Git's messages are matched in English regardless of the user's locale.
  LC_ALL: 'C',
  // Never block waiting for credentials.
  GIT_TERMINAL_PROMPT: '0',
  // Read-only commands such as `status` must not take locks another Git process needs.
  GIT_OPTIONAL_LOCKS: '0',
  // Pathspecs are always literal paths, never glob patterns.
  GIT_LITERAL_PATHSPECS: '1',
};

/**
 * Runs the Git executable with an argument vector.
 *
 * Arguments are handed to the process directly and never interpreted by a shell. A
 * non-zero exit is returned, not thrown, so callers can decide what it means.
 */
export async function runGit(cwd: string, args: readonly string[]): Promise<GitResult> {
  const result = await execa('git', args, {
    cwd,
    env: GIT_ENVIRONMENT,
    stdin: 'ignore',
    reject: false,
  });

  if (result.exitCode === undefined) {
    const failure =
      result.code === 'ENOENT'
        ? ({ kind: 'git-unavailable' } as const)
        : ({ kind: 'command-failed', args, exitCode: undefined, stderr: result.stderr } as const);
    throw new GitError(failure, { cause: result });
  }

  return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}

/** Runs Git and returns its standard output, throwing if it exits unsuccessfully. */
export async function runGitOrThrow(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runGit(cwd, args);
  if (result.exitCode !== 0) throw commandFailed(args, result);
  return result.stdout;
}

export function commandFailed(args: readonly string[], result: GitResult): GitError {
  return new GitError({
    kind: 'command-failed',
    args,
    exitCode: result.exitCode,
    stderr: result.stderr.trim(),
  });
}
