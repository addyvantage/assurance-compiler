import { stat } from 'node:fs/promises';
import { delimiter, isAbsolute, join } from 'node:path';
import { execa } from 'execa';
import { firstErrorLine } from './diagnostics.js';

export interface ToolRequest {
  /** Executable name, resolved on PATH, or an absolute path. */
  readonly file: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** Variables for this tool. Nothing else is inherited apart from HOST_VARIABLES. */
  readonly env?: Readonly<Record<string, string>>;
  /** Written to the tool's standard input, keeping it out of the process argument list. */
  readonly input?: string;
  /**
   * Set to false for a command that leaves a background process running, such as
   * `pg_ctl start`. On Windows that process inherits captured output pipes and keeps them
   * open, so waiting for the output would never finish.
   */
  readonly captureOutput?: boolean;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal | undefined;
}

export interface ToolResult {
  /** `undefined` when the process did not exit on its own. */
  readonly exitCode: number | undefined;
  /** Interleaved stdout and stderr, bounded to OUTPUT_LIMIT_BYTES. */
  readonly output: string;
  readonly notFound: boolean;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
}

export type ToolRunner = (request: ToolRequest) => Promise<ToolResult>;

/** The outcome of one provider step: a value, or a bounded, redacted reason it did not succeed. */
export type Step<T> =
  | { readonly ok: true; readonly value: T; readonly detail?: string }
  | { readonly ok: false; readonly cancelled: boolean; readonly detail: string };

const OUTPUT_LIMIT_BYTES = 1024 * 1024;
const KILL_GRACE_MS = 5_000;

/**
 * Host variables a tool needs merely to start: executable lookup, temporary files, and on
 * Windows the system root. Credentials and connection settings such as DATABASE_URL or
 * PGPASSWORD are never inherited.
 */
const HOST_VARIABLES = ['PATH', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME'];

/** Runs a tool with direct argv, a bounded duration and bounded output, and no shell. */
export const runTool: ToolRunner = async (request) => {
  const env = { ...hostVariables(), LC_ALL: 'C', ...request.env };
  const executable = await findExecutable(request.file, env);
  if (executable === undefined) {
    return { exitCode: undefined, output: '', notFound: true, timedOut: false, cancelled: false };
  }
  const result = await execa(executable, request.args, {
    cwd: request.cwd,
    env,
    extendEnv: false,
    ...(request.input === undefined ? { stdin: 'ignore' as const } : { input: request.input }),
    ...(request.captureOutput === false
      ? { stdout: 'ignore' as const, stderr: 'ignore' as const }
      : { all: true, maxBuffer: OUTPUT_LIMIT_BYTES }),
    reject: false,
    timeout: request.timeoutMs,
    forceKillAfterDelay: KILL_GRACE_MS,
    windowsHide: true,
    ...(request.signal === undefined ? {} : { cancelSignal: request.signal }),
  });
  return {
    exitCode: result.exitCode,
    // No combined output exists when it was not captured or the process never started.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    output: result.all ?? '',
    notFound: false,
    timedOut: result.timedOut,
    cancelled: result.isCanceled,
  };
};

/** Explains why a tool run did not succeed, without credentials and within a bounded length. */
export function toolFailure(
  tool: string,
  result: ToolResult,
  secrets: readonly string[] = [],
): Step<never> {
  if (result.cancelled) return { ok: false, cancelled: true, detail: `${tool} was cancelled.` };
  if (result.notFound) {
    return { ok: false, cancelled: false, detail: `${tool} was not found on PATH.` };
  }
  if (result.timedOut) return { ok: false, cancelled: false, detail: `${tool} timed out.` };
  const line = firstErrorLine(result.output, secrets);
  const exit =
    result.exitCode === undefined
      ? 'did not exit normally'
      : `exited with code ${String(result.exitCode)}`;
  return { ok: false, cancelled: false, detail: `${tool} ${exit}${line ? `: ${line}` : '.'}` };
}

/**
 * Resolves an executable on PATH before running it. On Windows a command that does not exist
 * is otherwise reported as an ordinary non-zero exit, and only `.exe` and `.com` files can be
 * started without a shell, so batch-file wrappers are skipped.
 */
async function findExecutable(
  file: string,
  env: Readonly<Record<string, string>>,
): Promise<string | undefined> {
  if (isAbsolute(file)) return file;
  const extensions =
    process.platform === 'win32'
      ? (env['PATHEXT'] ?? '.COM;.EXE')
          .split(';')
          .filter((extension) => /^\.(com|exe)$/i.test(extension))
      : [''];
  const directories = (env['PATH'] ?? '').split(delimiter).filter((directory) => directory !== '');
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = join(directory, `${file}${extension}`);
      if (
        await stat(candidate).then(
          (entry) => entry.isFile(),
          () => false,
        )
      )
        return candidate;
    }
  }
  return undefined;
}

function hostVariables(): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const name of HOST_VARIABLES) {
    const value = process.env[name];
    if (value !== undefined) variables[name] = value;
  }
  return variables;
}
