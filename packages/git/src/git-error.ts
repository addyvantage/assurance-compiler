/** Why a Git operation could not produce the information that was asked for. */
export type GitFailure =
  | { readonly kind: 'git-unavailable' }
  | { readonly kind: 'not-a-repository'; readonly directory: string }
  | { readonly kind: 'no-head-commit' }
  | { readonly kind: 'unresolvable-ref'; readonly ref: string }
  | { readonly kind: 'no-merge-base'; readonly base: string; readonly head: string }
  | {
      readonly kind: 'unexpected-output';
      readonly args: readonly string[];
      readonly detail: string;
    }
  | {
      readonly kind: 'command-failed';
      readonly args: readonly string[];
      readonly exitCode: number | undefined;
      readonly stderr: string;
    };

export class GitError extends Error {
  override readonly name = 'GitError';
  readonly failure: GitFailure;

  constructor(failure: GitFailure, options?: ErrorOptions) {
    super(describeFailure(failure), options);
    this.failure = failure;
  }
}

function describeFailure(failure: GitFailure): string {
  switch (failure.kind) {
    case 'git-unavailable':
      return 'The git executable could not be started.';
    case 'not-a-repository':
      return `${failure.directory} is not inside a Git working tree.`;
    case 'no-head-commit':
      return 'HEAD does not point to a commit.';
    case 'unresolvable-ref':
      return `Could not resolve \`${failure.ref}\` to a commit.`;
    case 'no-merge-base':
      return `\`${failure.base}\` and \`${failure.head}\` have no common ancestor.`;
    case 'unexpected-output':
      return `Unexpected output from \`git ${failure.args.join(' ')}\`: ${failure.detail}`;
    case 'command-failed':
      return `\`git ${failure.args.join(' ')}\` failed with exit code ${String(failure.exitCode)}.`;
  }
}
