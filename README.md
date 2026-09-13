# Assurance Compiler

CI tells you whether the checks you configured passed.
Assurance Compiler tells you whether the change received the verification it required.

> **Early prototype.** Detects Prisma database-schema changes, infers one assurance
> requirement, `NONEMPTY_MIGRATION_EXECUTION`, and can verify that requirement against a
> populated PostgreSQL baseline. Nothing else is verified.

The core abstraction is **CHANGE → REQUIREMENT → EVIDENCE**. See [docs/thesis.md](docs/thesis.md).

| Change surface           | Detected from                                  | Requires                       |
| ------------------------ | ---------------------------------------------- | ------------------------------ |
| `DATABASE_SCHEMA_CHANGE` | `prisma/schema.prisma`, `prisma/migrations/**` | `NONEMPTY_MIGRATION_EXECUTION` |

`NONEMPTY_MIGRATION_EXECUTION` establishes that the candidate migrations apply without error to a
database that already contains data. Even when proven, it does not establish that data is
preserved correctly, that the migration fits production time or lock budgets, that application
code stays compatible during rollout, or that the test data reflects production.

## `assure check`

Verifies the requirements a change imposes, and exits with the result.

```
assure check <base> [--seed-sql <path> --expect-table <schema.table>...] [--evidence-out <path>] [--json] [--debug]
```

An unsafe migration (a required column with no default, while `User` has rows):

```console
$ assure check main --seed-sql prisma/seed.sql --expect-table public.User --evidence-out evidence.json
Verdict: FAILED
NONEMPTY_MIGRATION_EXECUTION failed. Candidate migration
20260913_add_age failed on PostgreSQL 16.14 against the populated
merge-base database with SQLSTATE 23502: column "age" of relation "User"
contains null values.

Change
  Base       main at b03fa8c
  Baseline   b03fa8c merge base; migrations are verified on top of it
  Candidate  4e7d641 HEAD
  Detected   DATABASE_SCHEMA_CHANGE
             added     prisma/migrations/20260913_add_age/migration.sql
             modified  prisma/schema.prisma
  Scope      Only changes the prisma detector recognizes are checked.

Requirement
  NONEMPTY_MIGRATION_EXECUTION
  Migrations execute against a populated database
  …Why, Establishes and Does not establish, as above…

Verification
  Fixture    prisma/seed.sql (blob 78dde6d)
  Tables     public.User
  Migrations 1 baseline; candidate 20260913_add_age
  Tools      PostgreSQL 16.14; Prisma 6.19.3
  Run        93f597ac-a4c0-4d98-8ceb-1d7539d06102 (local,
             prisma-postgresql 0.1.0)
  Cleanup    succeeded

  Stages
  succeeded  environment           5.1s
  succeeded  baseline-migrations   1.8s
  succeeded  seed                  1.6s
  succeeded  population-check      0.1s
  failed     candidate-migrations  1.6s
             Prisma P3018: migration 20260913_add_age failed with
             SQLSTATE 23502: column "age" of relation "User" contains
             null values.

Evidence   evidence.json (sha256
           8266cc4dd2726921fd688cabd4352671ff7eeb78f54cdb0c7c4663eaa8cca7fe)
$ echo $?
1
```

The corrected migration (`… NOT NULL DEFAULT 0`) against the same baseline and seed fixture:

```console
$ assure check main --seed-sql prisma/seed.sql --expect-table public.User
Verdict: COMPLETE
NONEMPTY_MIGRATION_EXECUTION is proven for this change. Candidate
migrations (20260913_add_age) applied without error on PostgreSQL 16.14
to the merge-base database populated by prisma/seed.sql, with rows in
public.User.
…
  Stages
  succeeded  environment           5.9s
  succeeded  baseline-migrations   1.9s
  succeeded  seed                  1.6s
  succeeded  population-check      0.1s
  succeeded  candidate-migrations  2.0s
$ echo $?
0
```

When nothing supported changed, no database is started:

```console
$ assure check main --seed-sql prisma/seed.sql --expect-table public.User
No supported assurance-sensitive changes detected.
No assurance requirements were evaluated for this change.
1 changed file in main...HEAD · detectors: prisma
```

### What `check` does

1. Resolves `<base>` to its tip commit, `HEAD` to the candidate commit, and computes their
   **merge base**. The merge base is the verification baseline, matching what `diff` classifies.
   Compatibility with commits that land on the base branch afterwards is not established.
2. Reads the schema, migrations and seed fixture from **immutable Git objects**. Uncommitted
   changes are never used. Every input is identified by its Git blob ID.
3. Rejects unsupported inputs before starting anything (see below).
4. Creates a PostgreSQL cluster owned by this invocation, applies the baseline migrations with
   `prisma migrate deploy`, loads the seed with `prisma db execute`, checks that every
   `--expect-table` has rows, then applies the candidate migrations.
5. A single authoritative assessment turns the provider's observation into a requirement state.
6. Stops the server and removes the run directory on success, failure, timeout and cancellation
   (Ctrl+C once). Anything it cannot remove is reported by name. A forced kill or host crash can
   still leave resources behind.

### Configuration

- No `--seed-sql`/`--expect-table`: nothing verifies the requirement, so it is `MISSING`.
- `--seed-sql` is a repository-relative path using `/`. The file must exist at the **merge base**.
  A fixture added later is `NOT_PROVEN`.
- `--expect-table` is `schema.table` with plain identifiers, case-sensitive as Prisma creates
  them (`public.User`). It is repeatable. `_prisma_migrations` is not accepted.
- One of the two without the other, or a malformed value, is a usage error.

### States and exit codes

| State            | Meaning                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `PROVEN`         | Valid evidence establishes exactly this requirement                                     |
| `FAILED`         | Valid evidence shows a candidate migration raised a data, constraint or statement error |
| `NOT_PROVEN`     | Verification was configured or attempted, but did not establish the requirement         |
| `MISSING`        | No verification is configured for the requirement                                       |
| `NOT_APPLICABLE` | The requirement does not apply, with a reason                                           |

| Exit | `assure check`                                                                   |
| ---- | -------------------------------------------------------------------------------- |
| `0`  | Every applicable requirement is `PROVEN`, or no supported requirement applied    |
| `1`  | `FAILED`: at least one requirement has valid violation evidence                  |
| `2`  | Invalid arguments or configuration, including an existing `--evidence-out` path  |
| `3`  | `INCOMPLETE`: `MISSING`, `NOT_PROVEN`, an operational error, or a failed cleanup |

`FAILED` takes precedence over incomplete requirements. Operational problems (a tool that is not
installed, a server that does not start, connection loss, timeouts, cancellation, privilege
errors) are `NOT_PROVEN`, never `FAILED`. An internal error produces no assessment at all.

### Evidence

`--json` prints the plan document (below) plus a `verification` record. The record includes the
run ID and `local` origin, the provider and its version, the PostgreSQL and Prisma versions that
ran, the baseline, candidate, seed and migration identities, the expected tables and population
results, and each stage's status, timing, sanitized command and bounded detail. It also carries
any `migrationFailure` and the cleanup result.

`--evidence-out <path>` writes the same document to a new file, never overwriting one, and
reports its sha256. Stage statuses (`pending`, `running`, `succeeded`, `failed`, `cancelled`)
describe execution; only requirement states describe assurance.

Evidence never contains credentials, row values, source files or SQL. A database message is kept
only when it has the shape of one of PostgreSQL's own constraint or catalog messages, whose only
variable parts are schema identifiers of at most 63 characters (for example `column "age" of
relation "User" contains null values`). Every other message is withheld with only its SQLSTATE,
including messages a migration raises itself with `RAISE … USING ERRCODE`, and syntax errors,
which quote SQL. Schema identifiers are retained as named: a migration that derives table or
column names from data puts that data into evidence.

### Supported scope

- One Prisma project at the repository root (`prisma/schema.prisma`, `prisma/migrations/`).
- A PostgreSQL datasource with `url = env("DATABASE_URL")`, without `directUrl` or
  `shadowDatabaseUrl`.
- Prisma CLI **6.x**, installed in the repository (`node_modules/prisma`).
- Candidates that only **append** migrations. Edited, deleted or out-of-order migrations, lock
  file changes, symbolic links, unexpected files in the migrations directory, and a schema
  change without a new migration are all `NOT_PROVEN` with a reason.
- PostgreSQL server tools (`initdb`, `pg_ctl`, `psql`) on `PATH`. The result holds for the
  PostgreSQL version that ran, which is recorded. Docker is not used.

### Isolation and trust

- The cluster listens only on `127.0.0.1` on a free port, with no Unix socket. It is protected
  by random passwords and confirmed by its data directory before use.
- Migrations and the seed run as a non-superuser that owns the database, so repository SQL
  cannot run host programs or read server files. Trusted extensions such as `pgcrypto` work;
  untrusted ones produce `NOT_PROVEN`.
- Tools receive a minimal environment: `DATABASE_URL`, `PGPASSWORD` and other connection
  settings are never inherited. Arguments are passed directly, never through a shell.
- Prisma runs in a directory containing only the materialized schema and migrations, so no
  repository `.env` or config file is loaded. Update checks and engine downloads are disabled.
- The Prisma CLI in `node_modules` is the repository's own code and is executed as such. Do not
  run `check` on repositories whose dependencies you do not trust.

## `assure diff`

Plans the requirements a change imposes without verifying anything. It always exits `0` when a
plan is produced (`1` if it cannot run, `2` for invalid usage).

```console
$ assure diff main
────────────────────────────────────────────────────────────────────────
Assurance plan                                               main...HEAD
────────────────────────────────────────────────────────────────────────

2 of 3 changed files are assurance-sensitive

DATABASE_SCHEMA_CHANGE

  added     prisma/migrations/20260913_add_age/migration.sql
  modified  prisma/schema.prisma

Requires

  NONEMPTY_MIGRATION_EXECUTION
  …

Verdict: INCOMPLETE
────────────────────────────────────────────────────────────────────────
```

For both commands, the base ref is given positionally or once with `--base`. Supplying both, or
repeating `--base`, is a usage error.

### JSON

```json
{
  "version": 1,
  "base": { "ref": "main", "commit": "9c1e…" },
  "head": { "ref": "HEAD", "commit": "3f2a…" },
  "mergeBase": "9c1e…",
  "detectors": ["prisma"],
  "changes": [
    {
      "surface": "DATABASE_SCHEMA_CHANGE",
      "detector": "prisma",
      "files": [{ "path": "prisma/schema.prisma", "status": "modified" }]
    }
  ],
  "requirements": [
    {
      "id": "NONEMPTY_MIGRATION_EXECUTION",
      "state": "MISSING",
      "triggeredBy": ["DATABASE_SCHEMA_CHANGE"],
      "evidence": []
    }
  ],
  "verdict": "INCOMPLETE"
}
```

`reason` is present for `NOT_PROVEN` and `NOT_APPLICABLE`. `assure check` adds `verification`
(`null` when nothing ran) and, with `--evidence-out`, `artifact: { path, sha256 }`. Incompatible
changes to this shape will increment `version`.

## Current limitations

- Only Prisma's default root layout is detected. Nested monorepo projects, custom schema
  locations, multi-file schemas and Prisma 7+ configuration are not supported.
- Detection is path-based. The schema is not parsed, and migrations are not checked for
  semantic equivalence with it.
- Declared tables are trusted to be relevant. The check verifies they contain rows, not that the
  migration touches them.
- Only local evidence exists. No CI evidence is collected.

## Repository

```
packages/core     Domain model: surfaces, requirements, evidence, assessment, planner, JSON document
packages/git      Change sets, trees and blobs, read with the git executable
packages/prisma   Prisma change detector and the PostgreSQL migration-execution provider
apps/cli          The assure command
fixtures/         Tiny repositories used by tests and demonstrations
test/support      Shared test helpers
docs/thesis.md    Why this exists
```

## Development

Prerequisites: Node.js 22.12+, pnpm 9.15, Git 2.28+. Real verification and integration tests
also need PostgreSQL server tools on `PATH` (verified with 16.14) and Prisma 6.x (verified with
6.19.3). Docker is not required.

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                      # fast unit tests
pnpm build
ASSURE_TEST_PRISMA_NODE_MODULES=/path/to/node_modules pnpm test:integration
```

`test:integration` fails, rather than skipping, when PostgreSQL tools or Prisma are unavailable.
`ASSURE_TEST_PRISMA_NODE_MODULES` names a `node_modules` directory that contains `prisma@6`.

### macOS (Apple Silicon) setup and verification

Verified on macOS 26.5.1 (Darwin 25.5.0, arm64) with Node.js 24.5.0, pnpm 9.15.0, Git 2.53.0,
PostgreSQL 16.14 (Homebrew) and Prisma 6.19.3: every check below, 203 unit tests, 16 integration
tests, and the built-CLI cases below. The same suite was earlier reported on Windows 11 with
different tool versions; that was not a controlled comparison, and Windows has not been re-run
for changes made since.

```sh
brew install node@24 pnpm postgresql@16
# node@24 and postgresql@16 are keg-only. Put them first for this shell; do not relink globally.
# If a shell hook (nvm, asdf) selects another Node, `node -v` must still print 22.12 or newer:
# pnpm runs on whichever `node` is first on PATH, and so do the tools the tests start.
export PATH="$(brew --prefix node@24)/bin:$(brew --prefix postgresql@16)/bin:$PATH"
node -v && pnpm -v   # pnpm must print 9.15.0, the version package.json declares

git clone https://github.com/addyvantage/assurance-compiler && cd assurance-compiler
pnpm install --frozen-lockfile          # never copy node_modules from another platform
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build

# Prisma for the integration tests lives outside the repository; it is not a project dependency.
mkdir -p ~/assure-tooling && npm install --prefix ~/assure-tooling prisma@6.19.3
ASSURE_TEST_PRISMA_NODE_MODULES=~/assure-tooling/node_modules pnpm test:integration
```

Then run the real failing and passing cases with the built CLI. Each demo repository gets a
local Git identity; nothing global is changed.

```sh
REPO="$PWD"
for case in unsafe corrected; do
  DEMO="$(mktemp -d)/$case" && mkdir -p "$DEMO" && cd "$DEMO" || break
  git init -q -b main
  git config user.name "Assure Demo" && git config user.email "demo@assurance.invalid"
  cp -R "$REPO/fixtures/prisma-migration-$case/base/." . && git add -A && git commit -qm "Baseline"
  git switch -qc feature && git rm -rq . && cp -R "$REPO/fixtures/prisma-migration-$case/head/." .
  git add -A && git commit -qm "Add User.age"
  ln -s ~/assure-tooling/node_modules node_modules && echo node_modules >> .git/info/exclude
  node "$REPO/apps/cli/dist/main.js" check main --seed-sql prisma/seed.sql --expect-table public.User \
    --evidence-out "$DEMO/evidence.json"
  echo "$case exited $?"
  # Cleanup is verified per invocation: the run ID names the only directory this run owned.
  RUN_ID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).verification.runId)' "$DEMO/evidence.json")
  [ -n "$RUN_ID" ] || { echo "no evidence file, nothing to verify"; cd "$REPO"; continue; }
  ls "${TMPDIR:-/tmp}" | grep "assure-run-${RUN_ID:0:8}" && echo "LEFTOVER" || echo "run $RUN_ID cleaned up"
  cd "$REPO"
done
```

Expected: `unsafe` prints `Verdict: FAILED` with SQLSTATE 23502 and exits `1`. `corrected` prints
`Verdict: COMPLETE` and exits `0`. Each run reports `Cleanup succeeded` and leaves no directory
named after its run ID. Other `assure-run-*` directories belong to other invocations; a forced
kill or host crash can leave one behind, and only its owner should remove it.
