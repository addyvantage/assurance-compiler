# Thesis

Existing CI answers:

    Did the checks we configured pass?

Assurance Compiler asks:

    Did this change receive the verification it actually required?

The system models:

    CHANGE → REQUIREMENT → EVIDENCE

## The gap

A CI pipeline is a list of checks chosen before any particular change existed. It runs the
same checks against every change and reports whether they passed. It cannot notice that a
change needs verification nobody configured.

Consider a pull request that adds a required column. The unit tests pass against a freshly
migrated, empty database. The integration tests pass. The pipeline is green. In production,
the migration fails because existing rows have no value for the new column. Every check told
the truth. None of them was asked the question this change raised.

The problem is not a missing tool. It is the missing link between what changed and what must
therefore be demonstrated.

## The model

**Change.** What a change touches, classified into change surfaces such as
`DATABASE_SCHEMA_CHANGE`. Classification is deterministic and derived from the change itself.

**Requirement.** What must be demonstrated because of that change, such as
`NONEMPTY_MIGRATION_EXECUTION`. A requirement has a fixed meaning: the property it establishes
when proven, and the properties it does not establish even then.

**Evidence.** The result of a verification, bound to one requirement and to the exact commit
it observed.

Joining the three produces an assurance plan, in which every requirement is in exactly one
state: `PROVEN`, `FAILED`, `NOT_PROVEN`, `MISSING` or `NOT_APPLICABLE`.

## Principles

**1. A passing check only proves the property that check establishes.**
A green test suite that runs against an empty database says nothing about a populated one. The
system reasons about which property a check establishes, not whether a check with a reassuring
name exists.

**2. Missing evidence is different from failed evidence.**
`FAILED` means verification ran and showed the requirement is violated. `MISSING` means nothing
is in place to verify it. `NOT_PROVEN` means something ran but did not settle the question.
Collapsing these into pass/fail hides exactly the information a reviewer needs.

**3. The product must never claim more certainty than the evidence supports.**
Every requirement states its limitations. When no detector recognizes a change, the output says
so, and does not call the change safe. A verdict describes the requirements in a plan, never the
change as a whole.

**4. Recommendations should eventually become executable verification, not generic advice.**
"Test your migrations" is advice. A gate that applies the candidate migrations to a populated
database and records the result is verification. The system exists to produce the latter.

**5. The long-term system should integrate existing verification providers instead of
reimplementing every scanner.**
Test runners, migration tools, contract checkers and scanners already produce useful signals.
The system's job is to know which requirement a signal bears on and what it does and does not
establish, not to rebuild those tools.

**6. The requirement layer and evidence-provider layer must remain independent.**
A requirement defines what must be demonstrated. A provider supplies evidence about it. Adding,
replacing or removing a provider never changes what a requirement means. This independence is
what allows evidence from different tools to be compared, and what keeps a convenient tool from
quietly redefining the question.

## What it is not

It is not a CI runner, an AI code reviewer, a GitHub Actions generator, a vulnerability scanner
or a static engineering scorecard. It decides what a specific change needs verified, and
whether that verification exists and holds.

## Where it starts

The first slice is deliberately narrow: Prisma schema and migration changes impose
`NONEMPTY_MIGRATION_EXECUTION`. Getting one surface, one requirement and the state model exactly
right comes before adding breadth.
