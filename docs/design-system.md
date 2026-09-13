# Design system

The product standard for anything a user sees: the CLI today, the web control plane as it is
built. User experience comes first; the finish must be authored, cohesive and professional, at
the level of the best developer tools.

## Principle

The product tells a developer exactly what their change has and has not established. Every
screen serves that: the verdict and its explanation first, then the requirements, then the
evidence, then deeper diagnostics. Nothing decorative stands between the reader and that answer.

## Visual metaphor

A precise engineering instrument: calibrated, quiet, legible at a glance, honest about what it
measures.

## References

Inspiration, not brands to copy, and not evidence that their current products were inspected:
Linear (hierarchy, density, navigational consistency), Tembo (the founder's quality reference),
Raycast, Vercel, Sentry, Axiom and Resend for individual workflows. Distinguish a marketing site
from product UI when borrowing a principle.

Component sources the founder supplied: Skiper UI, UI SFX, Beautiful UI, Open Source UI. Adopt
code from them only selectively after reviewing source, license, dependencies and keyboard
behavior, and only within the dependency policy. Choose one accessible primitive foundation for
dialogs, menus and similar; do not layer several collections. Sound is optional inspiration,
outside the critical path, and silent by default.

## Visual direction

Prefer:

- Clear hierarchy and compact, readable density.
- Excellent sans-serif typography; monospace for identities, hashes and commands; tabular
  numerals wherever durations and counts align.
- Neutral surfaces: warm porcelain in light, graphite in dark. A restrained indigo interaction
  accent. Semantic color only on meaningful status, separate from the accent.
- Thin separators, consistent spacing, compact radii. Legible secondary text.
- Deliberate light and dark themes that honor the system preference first.
- State conveyed by text and icon as well as color.
- A restrained wordmark; no logo detour.

Avoid: generic dashboard templates, decorative gradients, glass and glow effects, repeated
oversized rounded cards, big-number tiles, fake scores, AI sparkle motifs, chatbot-centered
layouts, decorative charts, and any motion that suggests progress that is not happening.

### Tokens

No web tokens are implemented yet. The founder's starting palette is a proposal and has not
been contrast-validated; treat every value as provisional until measured against WCAG 2.2 AA in
both themes:

| Role               | Proposed  |
| ------------------ | --------- |
| Light surface      | `#F7F7F5` |
| Dark surface       | `#0F1115` |
| Interaction accent | `#5468FF` |
| Positive status    | `#1F8F66` |
| Caution status     | `#B77418` |

When tokens are implemented, record them here with their validated contrast ratios and the
file that defines them.

## UX hierarchy

    verdict and explanation → requirements → evidence → deeper diagnostics

Run detail, the flagship screen, exposes in this order:

- Change identity: repository, requested base, resolved base tip, merge base, candidate.
- Origin and timestamps: local CLI, reported, or attested; when it ran and when it was received.
- The requirement, its state and a bounded explanation.
- Stage outcomes in their real order with durations.
- Tool environment: provider and version, PostgreSQL and Prisma versions.
- Exact inputs: seed path and blob, schema blobs, migration names and blobs, expected tables.
- The bounded claim ("establishes") and "does not establish", from the engine's definition.
- Cleanup outcome and artifact provenance.
- The appropriate next action.

Separate execution state, assessment state and synchronization state visually and in copy. A
disconnected browser says the view is stale, not that the run failed.

## Quality standard

Every implemented flow handles: empty, loading, running, failed, missing and not-proven states;
disconnection and recovery; session expiry; long paths and identifiers with copy and expansion
controls; desktop and narrow layouts without unusable overflow; copy actions with feedback and
no secret leakage; keyboard access with visible focus and correct focus return; stable row order
and focus during live updates; reduced motion; no dead controls; deep links and reload.

Copy is written from the user's side: plain verbs, sentence case, controls that name what
happens, errors that say what went wrong and what to do next. Never show a success state before
the operation succeeded.

Aim for WCAG 2.2 AA in implemented flows. Do not claim certification, and do not treat a
primitive library's accessibility claims as evidence about this product.

Browser QA exercises actual flows: sign-in to run, reload and direct links, keyboard-only
navigation, theme switching, zoom, connection loss. Screenshots record what was seen; they do
not establish usability.

## Maintenance

Update this file when a reusable design decision changes or when tokens and components are
implemented. Keep it a standard, not a gallery.
