# Web control plane

The account-based web application for Assurance Compiler: sign in, register a repository, link
the CLI on your machine, run checks locally with `--sync`, follow them live in the browser, and
keep every run's evidence. Next.js 16 (App Router, Node runtime), Better Auth, Drizzle ORM on
PostgreSQL, Tailwind CSS 4 with Radix primitives, Motion, lucide icons, sonner toasts and a cmdk command menu.

## Run it locally

```sh
# PostgreSQL 16 on 127.0.0.1:5432, with a role that can create databases
createdb assure_web
cat > apps/web/.env.local <<'EOF'
DATABASE_URL=postgresql://127.0.0.1:5432/assure_web
BETTER_AUTH_SECRET=<32 random bytes, base64url>
BETTER_AUTH_URL=http://localhost:3000
EOF
pnpm build                      # workspace packages the app imports from dist/
pnpm web db:migrate             # applies apps/web/drizzle/*.sql
pnpm web dev                    # http://localhost:3000
```

`.env.local` is ignored by Git. Generate the secret with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## How it fits together

- **Engine authority.** `packages/core` decides every requirement state. The server reruns
  `assessMigrationExecution` on each reported observation and records whether it agrees with
  the states the CLI reported; the browser only renders.
- **Local execution.** `assure check` runs entirely on the developer's machine. With `--sync`
  it announces the run, streams stage transitions from the provider's `onStage` hook, then
  posts the terminal report. A sync failure prints a note and spools the report for
  `assure sync`; the local verdict and exit code never change.
- **Ingestion.** `app/api/cli/*` accept only bearer-authenticated CLIs that completed the
  device flow (`assure login`) and registered. Payloads are the version-1 allowlist from
  `packages/sync`, validated on ingress with unknown keys rejected, size-bounded, idempotent on
  `(run, sequence)` for events and first-report-wins for the snapshot.
- **Persistence.** `lib/db/schema.ts`: Better Auth tables plus `workspaces`, `repositories`,
  `cli_sessions`, `cli_links`, `runs`, `run_events`. Migrations in `drizzle/`.
- **Browser updates.** `app/api/runs/[id]/stream` is server-sent events with `Last-Event-ID`
  replay, backed by a one-second database poll per open stream.
- **Tenant boundary.** Every query starts from the workspace resolved from the session
  (`lib/session.ts`); no client-supplied workspace ID is trusted. CLI routes additionally scope
  runs to the CLI session that announced them.

## What synchronization sends

Only with `--sync` and only for a linked repository: run and repository IDs, commit and blob
IDs, the requested branch name, requirement and provider IDs, stage statuses and timings,
PostgreSQL and Prisma versions, SQLSTATE codes, cleanup status, the seed path, migration names,
expected table names and changed file paths the detector recognized. Never: database messages,
stage details, tool output, SQL, seed contents, source files, row values, local paths,
credentials or stacks. The cloud report has its own hash; the local evidence file keeps its own.

## Tests

```sh
pnpm test:web        # route handlers as functions against the local database
pnpm test:browser    # Playwright journey against a running `pnpm web dev`, system Chrome
```

`/dev/fixtures/<state>` renders the run detail with synthetic data in development only.
