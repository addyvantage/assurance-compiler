# Project status

Dated 2026-09-13. Inspected commit: `a3cde95` (merge of PR #1, implementation commit
`ef53101`) on `main`. This is the only document that carries milestone status and test counts;
durable rules link here instead of repeating them.

## Implemented on `main`

- Engine: surfaces, requirement catalog with one requirement, five-state assessment, planner,
  JSON document `version: 1`.
- `assure diff`: plans requirements for `HEAD` against a base ref's merge base.
- `assure check`: verifies `NONEMPTY_MIGRATION_EXECUTION` with the native PostgreSQL and
  repository-installed Prisma 6 provider, writes evidence files, exits 0/1/2/3.
- Privacy hardening from PR #1: database messages retained by template match only; owner
  database queries after repository SQL share one reduced failure path; the engine rejects an
  empty expected-table set.

## Verification record

Environment for the results below: macOS 26.5.1 (Darwin 25.5.0, arm64), Node 24.5.0, pnpm
9.15.0, Git 2.53.0, PostgreSQL 16.14 (Homebrew), Prisma 6.19.3 installed outside the
repository.

| Result                                                                                                                     | Commit    | Label                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| typecheck, lint, format, build pass                                                                                        | `ef53101` | agent-reported, rerun by a second agent                          |
| 207 unit tests pass                                                                                                        | `ef53101` | agent-reported, rerun by a second agent                          |
| 16 integration tests pass (real PostgreSQL and Prisma)                                                                     | `ef53101` | agent-reported                                                   |
| 13 built-CLI demonstrations, including unsafe FAILED / exit 1 and corrected COMPLETE / exit 0, no leftover run directories | `ef53101` | agent-reported                                                   |
| 203 unit and 15 integration tests on Windows 11                                                                            | `d8aba0b` | reported by the implementation agent, not rerun on Windows since |

"Rerun by a second agent" means a separate agent run repeated the command on the same Mac; no
human has independently rerun these results.

## Current milestone

The first account-based web slice is authorized by the founder. The journey to deliver:

    sign in → workspace → repository and CLI linking → local execution →
    live browser progress → verdict → evidence → local fix → separate rerun

Authorization is not completion. Nothing of the web application is on `main`.

In progress on branch `web-control-plane` (not merged, not reviewed): an `onStage` progress
hook in the provider and a dependency-free `packages/sync` package defining cloud payload
version 1 with projection, ingress validation and its own hash. That branch reports 222 unit
tests passing; treat as agent-reported until reviewed.

## Blockers and required review

- The web application's dependencies (framework, auth, persistence, primitives, keychain,
  browser tests) require explicit approval under POLICY.md §B before installation. A
  consolidated proposal has been presented to the founder.
- Red-tier changes (auth, tenancy, ingestion, CLI credentials) require human sign-off before
  merge. No branch protection or CI enforces this today.

## Next acceptance checkpoint

The unsafe and corrected fixtures run through a linked CLI, with real stage updates observed in
the browser and two independent persisted results, on a preview served from a local database,
with the browser flows in `docs/design-system.md` exercised.

## Deferred

Policy configuration, billing, invitations and roles, GitHub App and CI integration, additional
providers or Prisma majors, Docker backend, run comparison if it threatens the primary journey.

## Maintenance

Update at milestone boundaries: when something lands on `main`, when verification is rerun, or
when a blocker changes. Not a diary.
