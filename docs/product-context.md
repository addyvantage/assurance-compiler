# Product context

Stable scope and direction. The reasoning behind the model is in [thesis.md](thesis.md); the
current implementation state is in [project-status.md](project-status.md).

## What the product is

Traditional CI asks whether the checks someone configured passed. Assurance Compiler asks
whether the software change received the verification it required. The chain is

    change → requirement → evidence → eventual enforcement

The product serves changes authored by people and by agents alike. An agent that ships a
migration needs the same question answered as a person does, and can be gated the same way.

## Requirements and providers are distinct

A requirement fixes what must be demonstrated and what demonstrating it does not establish. A
provider supplies evidence about a requirement. Two tools in the same category do not establish
the same property merely because they share a category: a test suite against an empty database
and a migration run against a populated one are different evidence about different
requirements.

## The current requirement

`NONEMPTY_MIGRATION_EXECUTION`, imposed by `DATABASE_SCHEMA_CHANGE`, which the Prisma detector
raises for changes under `prisma/schema.prisma` and `prisma/migrations/`.

It establishes that the candidate migrations execute without error against the specified
populated merge-base fixture under the recorded PostgreSQL and Prisma versions.

It does not establish:

- That the fixture is representative of production.
- That existing data is preserved or transformed correctly.
- Zero downtime, or that the migration fits production time or lock budgets.
- That the previous application version stays compatible during rollout.
- Rollback safety or reversibility.
- That the migration is equivalent to the schema change.
- Compatibility with commits that land on the target branch after divergence.

The engine's own list of limitations for this requirement lives in
`packages/core/src/requirements/nonempty-migration-execution.ts`; the CLI prints it under
"Does not establish". This document adds rollback, equivalence and post-divergence
compatibility, which the engine does not currently print. That is a documentation choice, not a
disagreement with the code: those limits follow from what the provider runs.

## States

As defined in `packages/core/src/evidence/assurance-state.ts`:

| State            | Meaning                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `PROVEN`         | Valid evidence establishes exactly this requirement for exactly these inputs       |
| `FAILED`         | Verification ran and its evidence shows the requirement is violated                |
| `NOT_PROVEN`     | A mechanism exists or was attempted, but its evidence does not settle the question |
| `MISSING`        | No provider or gate is configured for the requirement                              |
| `NOT_APPLICABLE` | The requirement was determined not to apply, with a reason                         |

A plan's verdict (`COMPLETE`, `INCOMPLETE`, `FAILED`) summarizes requirement states. It never
describes the change as a whole, and a plan with no applicable requirement is vacuously
`COMPLETE` while saying explicitly that nothing was evaluated.

Operational failures (tool missing, server not starting, timeout, cancellation, privilege
error) are `NOT_PROVEN`, never `FAILED`. A verifier crash produces no assessment at all.

## Long-term architecture

Four parts, in dependency order:

1. The assurance engine: surfaces, requirements, evidence, assessment (`packages/core`).
2. Local CLI and execution: `assure diff` and `assure check` with native providers.
3. GitHub and CI integration: evidence collected where changes are reviewed and merged.
4. An account-based, real-time web control plane: persistent history, collaboration, live
   runs, evidence inspection, policy and integration management.

The web control plane is a major product surface, not an afterthought. The founder has
authorized its first slice. The first journey is:

    sign in → workspace → repository and CLI linking → local execution →
    live browser progress → verdict → evidence → local fix → separate rerun

Everything beyond that journey (policy configuration, billing, further providers, GitHub
automation, organizations and invitations) is direction, not scope, until authorized.
`docs/architecture.md` separates what exists from what is proposed.

## Who it is for first

The initial demand hypothesis: serious TypeScript, Prisma and PostgreSQL teams that ship schema
changes frequently and have been burned by a migration that passed CI and failed on real rows.

## Learning discipline

When a recommendation or requirement is rejected, record why, and keep these reasons distinct:

- Not valid: the requirement was wrong or the evidence was misread.
- Valid but not worth enforcing (`VALID_BUT_NOT_WORTH_ENFORCING`): the team accepts the risk.
- Valid but the provider is unusable here: tooling, cost or environment.

Stars, compliments and hypothetical willingness to pay are not adoption. Adoption is a team
running checks on real changes and acting on the result.

## Maintenance

Update this file when scope or direction changes as a decision, not as speculation.
