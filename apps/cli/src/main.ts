#!/usr/bin/env node
import { runCli } from './cli.js';
import { terminalOutput } from './io.js';

// The first interrupt cancels and lets the run clean up; a second one terminates immediately.
const cancellation = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    process.stderr.write('\nCancelling. Removing resources this run created.\n');
    cancellation.abort();
  });
}

process.exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: terminalOutput(process.stdout),
  stderr: terminalOutput(process.stderr),
  signal: cancellation.signal,
});
