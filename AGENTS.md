# Assurance Compiler: repository instructions

Assurance Compiler decides what verification a specific code change requires and whether that
verification exists and holds. CI reports whether the checks someone configured passed; this
product reports whether the change received the verification it actually needed. Changes may be
authored by people or by agents.

## The model

`CHANGE → REQUIREMENT → EVIDENCE`. A change touches surfaces, a surface imposes requirements, a
provider produces evidence about a requirement for one exact commit. See
[docs/thesis.md](docs/thesis.md) and [docs/product-context.md](docs/product-context.md).

The engine (`packages/core`) owns assurance semantics: what a requirement means, which states
exist, and how an observation becomes an assessment. CLIs, providers, servers and browsers
render or transport that truth; they never reinterpret it.

Keep these distinct everywhere, in code, copy and reports:

- Evidence versus claims. A stage that ran, an upload that succeeded, or a provider's own
  framing is not evidence that a requirement holds.
- Missing evidence versus failure. `MISSING` and `NOT_PROVEN` are not `FAILED`.
- Execution state versus assessment state. A completed process is not a proven requirement; a
  cancelled or disconnected run is not a failed migration.

## Repository map

| Path                     | Contents                                                                      |
| ------------------------ | ----------------------------------------------------------------------------- |
| `packages/core`          | Surfaces, requirements, evidence, assessment, planner, JSON document contract |
| `packages/git`           | Change sets, trees and blobs read from immutable Git objects via `git`        |
| `packages/prisma`        | Prisma change detector; PostgreSQL migration-execution provider               |
| `apps/cli`               | The `assure` command: `diff`, `check`, text and JSON rendering                |
| `fixtures/`              | Tiny repositories as `base/` and `head/` trees, used by tests and demos       |
| `test/support`           | Shared test helpers: temporary Git repositories, integration prerequisites    |
| `docs/`                  | Thesis, product context, architecture, design system, project status          |
| `POLICY.md`              | Engineering, risk, dependency, security and review policy                     |
| `CONTRIBUTING.md`        | Verified commands and the development workflow                                |
| `docs/project-status.md` | Dated milestone state, evidence and next checkpoint                           |

There is no web application on `main` yet. Check `docs/project-status.md` and open branches
before assuming what exists.

## Starting a task

1. Read the request and classify its risk using [POLICY.md](POLICY.md). Read POLICY.md for any
   implementation or review task, [docs/design-system.md](docs/design-system.md) for web or UX
   work, and [docs/architecture.md](docs/architecture.md) before crossing a package or trust
   boundary.
2. Inspect the actual state: branch, remote, uncommitted or unrelated work, the code paths the
   task touches, and the tests that cover them. `docs/project-status.md` says what was last
   verified; the code is the authority.
3. Reuse what exists: helpers, types, patterns and installed dependencies. Look before writing.
4. Make the smallest diff that solves the problem at its root. No unrelated refactors, no
   speculative scaffolding, no new dependencies without explicit approval (POLICY.md §B).
5. Run the relevant checks from the package scripts (CONTRIBUTING.md), not a full suite for its
   own sake. Provider or CLI changes need the integration tests.
6. Review the final diff before reporting.
7. Report what was actually verified, on which commit and environment, and what remains
   unverified, blocked or not run. Use the labels in POLICY.md §D.

## Task scope

- A request to review, diagnose, explain or write a prompt does not authorize application
  changes.
- An implementation request authorizes ordinary in-scope edits and their tests.
- Do not re-ask for permission the user has already granted in the session.
- Resolve routine, reversible choices from the user's instructions and repository context.
- Ask when a decision needs new authority: credentials, a purchase, an external service, a new
  dependency, or a material change of scope.
- The roadmap in `docs/product-context.md` is direction, not authorization to build all of it.

## How the documents relate

`AGENTS.md` routes work. `POLICY.md` is the authoritative rule set; if another document
disagrees with it on policy, POLICY.md wins. `CONTRIBUTING.md` is the practical how-to.
`docs/architecture.md` describes what exists and separates it from what is proposed.
`docs/design-system.md` is the product standard for anything a user sees. `docs/project-status.md`
is the only document that carries fast-changing status and test counts. `README.md` stays
introductory and links here. `CLAUDE.md` is a thin entry point for Claude Code that defers to
this file.
