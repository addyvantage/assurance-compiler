# Architecture

What exists on `main`, with file references, followed by what is proposed and clearly
separated. Verified against commit `a3cde95` on 2026-09-13. Read this before crossing a package
or trust boundary.

## Packages

```
packages/core     Engine: surfaces, requirements, evidence, assessment, planner, JSON document
packages/git      Immutable input extraction through the git executable
packages/prisma   Prisma change detector; PostgreSQL migration-execution provider
apps/cli          The assure command: argument parsing, commands, text rendering
```

Dependency direction is strictly downward: `apps/cli` → `packages/prisma` → `packages/git` →
`packages/core`. `packages/core` depends on nothing and knows nothing about processes, HTTP,
databases, terminals or browsers. Keep it that way.

## Engine (`packages/core`)

- `changes/`: `ChangeSurface` (`DATABASE_SCHEMA_CHANGE`), `ChangedFile`, `ChangeSet`, and the
  `ChangeDetector` interface. Detection is path-based and deterministic.
- `requirements/`: `RequirementDefinition` with `establishes` and `limitations`;
  `nonempty-migration-execution.ts` is the single current definition.
- `evidence/`: `AssuranceState`, `Evidence`, `Assessment`, and
  `migration-execution.ts`, which holds `assessMigrationExecution`: the only function that turns
  a provider observation into an assessment. It rejects observations about other inputs,
  incomplete or out-of-order stage lifecycles, missing tool versions, population checks that
  did not cover every expected table, failures for non-candidate migrations, malformed SQLSTATEs
  and an empty expected-table set. Operational SQLSTATE classes and `42501` are `NOT_PROVEN`;
  classes 22, 23 and 42 are `FAILED`.
- `planner/`: `buildAssurancePlan`, `withAssessment`, `planVerdict`.
- `report/plan-document.ts`: the public JSON wire format, `version: 1`. `PlanDocument` is what
  `assure diff --json` prints; `CheckDocument` adds `verification` and is also the
  `--evidence-out` file format. Incompatible shape changes increment `version`.

## Immutable inputs (`packages/git`)

`readChangeSet` resolves the requested base ref to its tip, `HEAD` to the candidate commit, and
their merge base. The merge base is the verification baseline, matching what `diff`
classifies. `tree.ts` lists trees with literal pathspecs and reads blob bytes exactly, so every
input is identified by a Git object ID and the working tree is never read. `working-tree.ts`
only reports whether uncommitted or untracked changes exist so the CLI can warn that they are
excluded. Git runs with `LC_ALL=C`, no terminal prompts, optional locks off and literal
pathspecs (`run-git.ts`).

## Prisma detection and migration execution (`packages/prisma`)

`detector.ts` raises `DATABASE_SCHEMA_CHANGE` for `prisma/schema.prisma` and
`prisma/migrations/**` at the repository root. Nested projects, custom schema locations,
multi-file schemas and Prisma 7 configuration are not detected.

`migration-execution/` is the provider `prisma-postgresql` (version `0.1.0`):

- `inputs.ts` reads schema, lock file, migrations and the seed fixture from the merge base and
  candidate commits. Supported: one root project, `provider = "postgresql"`,
  `url = env("DATABASE_URL")`, no `directUrl` or `shadowDatabaseUrl`, regular files under 10
  MiB, and candidates that only append migrations. Anything else is a reason, never an
  approximation.
- `postgres.ts` creates a cluster with `initdb`, starts it on a free loopback port with no Unix
  socket, confirms the server's data directory is this run's, creates a non-superuser owner role
  and database, checks population with `SELECT EXISTS`, reads `_prisma_migrations`, and stops the
  server. It needs PostgreSQL server tools on `PATH`; there is no Docker path.
- `prisma-cli.ts` locates the repository's own `node_modules/prisma` (major version 6 only) and
  runs `migrate deploy` and `db execute` with `process.execPath` in a directory containing only
  the materialized schema and migrations, so no repository `.env` or config is loaded.
- `run-tool.ts` runs every tool with a direct argument vector, a minimal environment (`PATH`,
  `PATHEXT` and `SystemRoot` on Windows, temp directories, `HOME`, `LC_ALL=C`, plus what the
  caller passes), bounded time and output, no shell, and cancellation.
- `diagnostics.ts` reduces tool output to what evidence may hold: Prisma error codes, SQLSTATE,
  the failing migration name, and a database message only when it matches one of PostgreSQL's
  own constraint or catalog message templates with quoted identifier slots of at most 63
  characters.
- `provider.ts` runs the five stages `environment`, `baseline-migrations`, `seed`,
  `population-check`, `candidate-migrations`, records each as a `StageRecord`, and always
  attempts cleanup of the cluster and run directory. Cleanup is best effort under forced
  termination or host failure; leftovers are named in the observation.

## CLI (`apps/cli`)

`cli.ts` parses arguments with Commander and enforces usage rules (base given once, `--seed-sql`
with at least one `--expect-table`, repository-relative seed path, `schema.table` identifiers,
never `_prisma_migrations`, `--evidence-out` must not exist). `commands/check.ts` orchestrates:
change set, plan, input resolution, verification, assessment, evidence file, output, exit code.
`output/` renders text; JSON is the document from core. Exit codes: 0 complete, 1 failed, 2
usage, 3 incomplete or operational problem. An unwritable evidence file or failed cleanup exits
3 but never hides a `FAILED` verdict.

Ordinary local verification needs no account and no network.

## Trust boundaries

- The checked repository is trusted code: its `node_modules/prisma` executes on the host as
  such. The disposable PostgreSQL cluster limits what repository SQL can do (no superuser, no
  `COPY … TO PROGRAM`, no server file reads) but is not a sandbox for the Prisma process.
- Evidence never contains credentials, row values, source files or SQL. Database messages are
  retained only by template match. Known limitation: the template match is on shape, so a
  migration can raise text that fits a template, such as
  `relation "ada@example.com" does not exist`, and that text is retained. Identifiers are
  retained as named. This is not a guarantee that arbitrary data cannot appear in a local
  evidence file; it is a bound on the common cases.
- The observation a provider returns is untrusted input to the engine. Only
  `assessMigrationExecution` decides the state.

## Proposed: web control plane and cloud synchronization

Nothing in this section exists on `main`. A task branch (`web-control-plane`) carries early work;
see `project-status.md`. Dependency, auth, database, transport and hosting choices for the web
application require explicit approval and are not decided by this document.

Principles the implementation must satisfy:

- Change identity (base tip, merge base, candidate, input blob IDs) is different from run
  identity (one execution of one provider). Local and CI runs of the same change remain
  independent evidence.
- Server validation of a report proves the report is well formed and coherent. It does not
  prove the client executed anything. Origin must be labeled accurately: "reported by a linked
  local CLI" is not attested execution.
- Execution state (stages), assessment state (requirement states) and synchronization state
  (what the browser has received) are three separate things and are displayed as such.
- The browser renders engine truth; it does not reinterpret it. Where the server rebuilds a
  summary, it does so from structured fields, never from free text the client sent.
- Cloud payloads are an explicit, versioned allowlist, not serialized local observations.
  Structured fields (run and repository IDs, commits and blob IDs, requirement and provider IDs,
  stage statuses and timings, tool versions, SQLSTATE, cleanup status) are the default. Database
  messages, stage details, evidence summaries, reasons, raw logs, SQL, fixtures, source, row
  contents, local absolute paths, credentials and stacks are excluded. Paths, branch names,
  migration names and table identifiers are disclosed repository metadata: their inclusion must
  be deliberate and shown in the linking disclosure, and the product must never call the upload
  "zero data".
- A cloud-safe artifact is a projection with its own byte hash. It never reuses the hash of
  the local evidence file, which is a different document.
- Synchronization failure never changes the local assessment or exit code.
- Tenant ownership is enforced on the server for every resource.

## Maintenance

Update this file when a package, data contract, JSON version or trust boundary changes, and
move items from "proposed" to "exists" only when they are on `main`.
