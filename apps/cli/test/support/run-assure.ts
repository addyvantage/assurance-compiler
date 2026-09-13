import { runCli } from '../../src/cli.js';
import type { TextOutput } from '../../src/io.js';

export interface AssureResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs the CLI in-process, as a non-terminal without colour, and captures its output. */
export async function assure(args: readonly string[], cwd: string): Promise<AssureResult> {
  const stdout = captureOutput();
  const stderr = captureOutput();
  const exitCode = await runCli(args, { cwd, stdout: stdout.output, stderr: stderr.output });
  return { exitCode, stdout: stdout.text(), stderr: stderr.text() };
}

function captureOutput(): { readonly output: TextOutput; text(): string } {
  const chunks: string[] = [];
  return {
    output: {
      color: false,
      columns: undefined,
      write: (text) => {
        chunks.push(text);
      },
    },
    text: () => chunks.join(''),
  };
}
