import { GitError, type GitFailure } from '@assurance-compiler/git';
import { VerificationRunError } from '@assurance-compiler/prisma';
import type { Theme } from './theme.js';

interface ErrorDescription {
  readonly message: string;
  readonly hint?: string;
}

/** An expected failure whose message is already written for a person. */
export class CliError extends Error {
  override readonly name = 'CliError';
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.hint = hint;
  }
}

const DEBUG_HINT = 'Re-run with --debug for details.';
const PREFIX = 'error: ';

/**
 * Renders an error for a person. Expected failures get a plain sentence and a next step;
 * internals such as stacks and Git's own output appear only with `--debug`.
 */
export function renderError(error: unknown, theme: Theme, debug: boolean): string {
  const { message, hint } = describeError(error);
  const lines = [`${theme.negative(PREFIX.trimEnd())} ${message}`];
  if (hint !== undefined) lines.push(`${' '.repeat(PREFIX.length)}${theme.muted(hint)}`);
  if (debug) lines.push('', ...debugDetails(error).map((line) => theme.muted(line)));
  return `${lines.join('\n')}\n`;
}

function describeError(error: unknown): ErrorDescription {
  if (error instanceof GitError) return describeGitFailure(error.failure);
  if (error instanceof CliError) return { message: error.message, hint: error.hint };
  if (error instanceof VerificationRunError) {
    const { leftovers } = error.cleanup;
    return {
      message:
        'Migration verification stopped because of an internal error. No assessment was made.',
      hint:
        leftovers.length === 0
          ? `Resources this run created were removed. ${DEBUG_HINT}`
          : `Could not remove: ${leftovers.join('; ')}. ${DEBUG_HINT}`,
    };
  }
  const detail = error instanceof Error ? error.message : String(error);
  return { message: `Unexpected error: ${detail}`, hint: DEBUG_HINT };
}

function describeGitFailure(failure: GitFailure): ErrorDescription {
  switch (failure.kind) {
    case 'git-unavailable':
      return {
        message: 'Git is not available.',
        hint: 'Install Git and make sure `git` is on your PATH.',
      };
    case 'not-a-repository':
      return {
        message: 'Not a Git repository.',
        hint: 'Run this command from inside a repository.',
      };
    case 'no-head-commit':
      return {
        message: 'HEAD does not point to a commit yet.',
        hint: 'Create a commit, then run this command again.',
      };
    case 'unresolvable-ref':
      return {
        message: `Could not resolve base ref \`${failure.ref}\`.`,
        hint: 'Check that the ref exists locally. CI checkouts may need to fetch it first.',
      };
    case 'no-merge-base':
      return {
        message: `\`${failure.base}\` and ${failure.head} share no history.`,
        hint: 'If this is a shallow clone, fetch full history with `git fetch --unshallow`.',
      };
    case 'unexpected-output':
      return { message: 'Git produced output that could not be read.', hint: DEBUG_HINT };
    case 'command-failed':
      return {
        message: `Git command failed: ${firstLine(failure.stderr) ?? `git ${failure.args.join(' ')}`}`,
        hint: DEBUG_HINT,
      };
  }
}

function debugDetails(error: unknown): string[] {
  const details: string[] = [];
  if (error instanceof GitError) {
    details.push(...JSON.stringify(error.failure, null, 2).split('\n'));
  }
  if (error instanceof Error && error.stack !== undefined) {
    details.push(...error.stack.split('\n'));
  }
  return details;
}

function firstLine(text: string): string | undefined {
  const line = text.split('\n').find((candidate) => candidate.trim() !== '');
  return line?.trim();
}
