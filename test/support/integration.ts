import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MigrationExecutionObservation } from '../../packages/core/src/index.js';
import { expect } from 'vitest';
import type { TestRepository } from './git-repository.js';

/**
 * Integration tests need real tools and fail, rather than skip, without them: a skipped
 * integration test proves nothing. Requires PostgreSQL server tools (initdb, pg_ctl, psql) on
 * PATH and ASSURE_TEST_PRISMA_NODE_MODULES naming a node_modules directory with prisma@6.
 */
export function requireIntegrationTools(): string {
  for (const tool of ['initdb', 'pg_ctl', 'psql']) {
    try {
      execFileSync(tool, ['--version'], { stdio: 'ignore' });
    } catch {
      throw new Error(`Integration tests need PostgreSQL's ${tool} on PATH.`);
    }
  }
  const nodeModules = process.env['ASSURE_TEST_PRISMA_NODE_MODULES'];
  if (nodeModules === undefined || !existsSync(join(nodeModules, 'prisma', 'package.json'))) {
    throw new Error(
      'Integration tests need ASSURE_TEST_PRISMA_NODE_MODULES set to a node_modules directory containing prisma@6.',
    );
  }
  return nodeModules;
}

/** Makes Prisma available to a test repository the way a project install would, without committing it. */
export function installPrisma(repository: TestRepository, nodeModules: string): void {
  symlinkSync(nodeModules, join(repository.root, 'node_modules'), 'junction');
  appendFileSync(join(repository.root, '.git', 'info', 'exclude'), 'node_modules\n');
}

/** Asserts the run's directory is gone and nothing still listens on its PostgreSQL port. */
export async function expectRunResourcesRemoved(
  observation: MigrationExecutionObservation,
): Promise<void> {
  const prefix = `assure-run-${observation.runId.slice(0, 8)}-`;
  expect(readdirSync(tmpdir()).filter((name) => name.startsWith(prefix))).toEqual([]);

  const port = /127\.0\.0\.1:(\d+)/.exec(observation.stages[0]?.detail ?? '')?.[1];
  if (port !== undefined) expect(await acceptsConnections(Number(port))).toBe(false);
}

function acceptsConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}
