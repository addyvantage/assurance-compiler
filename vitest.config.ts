import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const workspacePackageSource = fileURLToPath(
  new URL('./packages/$1/src/index.ts', import.meta.url),
);
const emptyGitConfig = fileURLToPath(new URL('./test/support/empty.gitconfig', import.meta.url));
const INTEGRATION_TESTS = [
  'apps/*/test/**/*.integration.test.ts',
  'packages/*/test/**/*.integration.test.ts',
];

export default defineConfig({
  resolve: {
    // Tests exercise workspace packages from source so they never depend on a prior build.
    alias: [
      { find: /^@assurance-compiler\/(core|git|prisma)$/, replacement: workspacePackageSource },
    ],
  },
  test: {
    // Git behaves identically on every machine: no system or user configuration, a fixed
    // identity, and no repository discovery above the temporary directory.
    env: {
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: emptyGitConfig,
      GIT_CEILING_DIRECTORIES: [tmpdir(), realpathSync.native(tmpdir())].join(delimiter),
      GIT_AUTHOR_NAME: 'Assurance Test',
      GIT_AUTHOR_EMAIL: 'test@assurance.invalid',
      GIT_COMMITTER_NAME: 'Assurance Test',
      GIT_COMMITTER_EMAIL: 'test@assurance.invalid',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['apps/*/test/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...INTEGRATION_TESTS],
          // Several tests create real Git repositories, which is slow on some platforms.
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: INTEGRATION_TESTS,
          // Each test creates and removes a real PostgreSQL cluster.
          testTimeout: 300_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
