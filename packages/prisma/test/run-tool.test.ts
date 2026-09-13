import { afterEach, describe, expect, it, vi } from 'vitest';
import { runTool } from '../src/migration-execution/run-tool.js';

const node = process.execPath;
const cwd = process.cwd();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('runTool', () => {
  it('terminates a process that exceeds its timeout', async () => {
    const result = await runTool({
      file: node,
      args: ['-e', 'setTimeout(() => {}, 60000)'],
      cwd,
      timeoutMs: 300,
    });

    expect(result).toMatchObject({ timedOut: true, cancelled: false });
    expect(result.exitCode).not.toBe(0);
  });

  it('terminates a process when cancelled', async () => {
    const controller = new AbortController();
    const pending = runTool({
      file: node,
      args: ['-e', 'setTimeout(() => {}, 60000)'],
      cwd,
      timeoutMs: 60_000,
      signal: controller.signal,
    });
    setTimeout(() => {
      controller.abort();
    }, 200);

    expect(await pending).toMatchObject({ cancelled: true, timedOut: false });
  });

  it('never passes credentials or connection settings from the parent environment', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:secret@production.example/app');
    vi.stubEnv('PGPASSWORD', 'secret');

    const result = await runTool({
      file: node,
      args: [
        '-e',
        'process.stdout.write(JSON.stringify([process.env.DATABASE_URL ?? null, process.env.PGPASSWORD ?? null, process.env.GIVEN]))',
      ],
      cwd,
      env: { GIVEN: 'yes' },
      timeoutMs: 10_000,
    });

    expect(JSON.parse(result.output)).toEqual([null, null, 'yes']);
  });

  it('passes arguments directly, without shell interpretation', async () => {
    const argument = 'a b; echo "quoted" $HOME %PATH% | more';

    const result = await runTool({
      file: node,
      args: ['-e', 'process.stdout.write(process.argv[1])', argument],
      cwd,
      timeoutMs: 10_000,
    });

    expect(result.output).toBe(argument);
  });

  it('does not wait for a background process when output is not captured', async () => {
    // Like `pg_ctl start`: the command exits, but leaves a process holding its inherited output.
    const script =
      "require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 15000)'], { stdio: 'inherit', detached: true }).unref()";

    const started = Date.now();
    const result = await runTool({
      file: node,
      args: ['-e', script],
      cwd,
      timeoutMs: 10_000,
      captureOutput: false,
    });

    expect(result).toMatchObject({ exitCode: 0, timedOut: false });
    expect(Date.now() - started).toBeLessThan(8_000);
  });

  it('reports an executable that is not installed', async () => {
    const result = await runTool({ file: 'assure-no-such-tool', args: [], cwd, timeoutMs: 10_000 });

    expect(result.notFound).toBe(true);
  });
});
