# Contributing

Practical workflow for this repository. Rules live in [POLICY.md](POLICY.md); this file is the
how-to.

## Toolchain

- Node.js 22.12 or newer (`engines` in every package). Select it explicitly if a shell hook picks
  another version; `node -v` must agree before running anything, because `pnpm` and the tools the
  tests start all follow `PATH`.
- pnpm 9.15.0, pinned by `packageManager` in `package.json`. `pnpm -v` must print it.
- Git 2.28 or newer.
- For real verification and integration tests: PostgreSQL server tools (`initdb`, `pg_ctl`,
  `psql`) on `PATH`, and a Prisma 6.x CLI installed outside the repository.

Install with the frozen lockfile:

```sh
pnpm install --frozen-lockfile
```

Never copy `node_modules` between platforms.

## Commands

All from `package.json` at the root:

| Command                 | What it does                                                            |
| ----------------------- | ----------------------------------------------------------------------- |
| `pnpm typecheck`        | Whole-workspace type check against sources, no build needed             |
| `pnpm lint`             | ESLint with type-aware rules                                            |
| `pnpm format:check`     | Prettier check; `pnpm format` writes                                    |
| `pnpm test`             | Unit tests (`vitest --project unit`); some create real Git repositories |
| `pnpm test:integration` | Real PostgreSQL and Prisma runs; fails rather than skips without tools  |
| `pnpm build`            | `tsc --build` into each package's `dist/`                               |
| `pnpm check`            | typecheck, lint, format:check and unit tests in one go                  |
| `pnpm assure …`         | Runs the built CLI (`apps/cli/dist/main.js`)                            |

Run `pnpm build` before using the built CLI or the README demonstrations.

## Integration prerequisites

`ASSURE_TEST_PRISMA_NODE_MODULES` names a `node_modules` directory that contains `prisma@6`.
Keep it outside the repository so the test tooling is not a project dependency:

```sh
mkdir -p ~/assure-tooling && npm install --prefix ~/assure-tooling prisma@6.19.3
ASSURE_TEST_PRISMA_NODE_MODULES=~/assure-tooling/node_modules pnpm test:integration
```

Each integration test creates, uses and removes its own PostgreSQL cluster on a loopback port.
Nothing else on the machine is touched.

## Test fixtures and Git identity

Tests set a fixed Git identity through `vitest.config.ts` environment variables and isolate Git
from user and system configuration. Demonstration repositories created by hand get a local
identity inside that repository:

```sh
git config user.name "Assure Demo" && git config user.email "demo@assurance.invalid"
```

Never change global Git identity for a test or a demonstration.

## Selecting tests

- `pnpm vitest run --project unit packages/core` runs one package's unit tests.
- `pnpm vitest run --project integration -t "<test name>"` runs one integration test.
- Provider (`packages/prisma/src/migration-execution`) or CLI `check` changes need the
  integration suite. Documentation-only changes need `pnpm format:check`.

## Environment variables

| Variable                          | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `ASSURE_TEST_PRISMA_NODE_MODULES` | Location of the external Prisma 6 CLI for integration tests |
| `NO_COLOR`, `FORCE_COLOR`         | Standard color conventions honored by the CLI               |

The CLI generates `DATABASE_URL`, `PGPASSWORD` and the other connection and Prisma settings it
passes to the tools it starts; it never reads them from your environment.

## Branch and pull-request workflow

1. Start from up-to-date `main` on a task branch (`git switch -c <task> origin/main`).
2. Keep commits cohesive. Do not mix unrelated changes.
3. Run the checks relevant to the change, then review the diff.
4. Push the branch and open a pull request describing what changed, what was verified and how
   (labels in POLICY.md §D), and what remains unverified.
5. Amber changes get an independent review; Red changes need explicit human sign-off before
   merge. `main` currently has no branch protection or CI workflow, so this is a process
   expectation, not an enforced gate.

## Reporting verification

State the commit, the environment (OS and architecture, Node, pnpm, PostgreSQL, Prisma) and
the exact commands with their results. Label each result as independently verified,
agent-reported, source-inspected, browser-inspected, assumed, not run or blocked.

Platform evidence to date is recorded in [docs/project-status.md](docs/project-status.md).
macOS (Apple Silicon) is where recent changes were run. Windows results are historical and were
not rerun for changes made since; do not describe Windows as verified for a change unless it was
actually run there.

## Maintenance

Update this file when package scripts, prerequisites or environment variables change.
