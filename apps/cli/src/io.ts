/** A destination for text output, and what it can display. */
export interface TextOutput {
  readonly color: boolean;
  /** Width of the terminal in columns, or `undefined` when output is not a terminal. */
  readonly columns: number | undefined;
  write(text: string): void;
}

export interface CliEnvironment {
  readonly cwd: string;
  readonly stdout: TextOutput;
  readonly stderr: TextOutput;
  /** Aborted when the user cancels, so running verification can stop and clean up. */
  readonly signal?: AbortSignal;
}

/**
 * The parts of a Node.js output stream the CLI relies on. `isTTY` and `columns` exist only
 * when the stream is a terminal, which Node's own typings do not express.
 */
export interface OutputStream {
  readonly isTTY?: boolean;
  readonly columns?: number;
  write(text: string): unknown;
}

export function terminalOutput(
  stream: OutputStream,
  env: NodeJS.ProcessEnv = process.env,
): TextOutput {
  const isTerminal = stream.isTTY === true;
  return {
    color: supportsColor(isTerminal, env),
    columns: isTerminal ? stream.columns : undefined,
    write: (text) => {
      stream.write(text);
    },
  };
}

/** Follows the NO_COLOR (https://no-color.org) and FORCE_COLOR conventions. */
function supportsColor(isTerminal: boolean, env: NodeJS.ProcessEnv): boolean {
  const { NO_COLOR, FORCE_COLOR, TERM } = env;
  if (NO_COLOR !== undefined && NO_COLOR !== '') return false;
  if (FORCE_COLOR !== undefined) return FORCE_COLOR !== '0' && FORCE_COLOR !== 'false';
  return isTerminal && TERM !== 'dumb';
}
