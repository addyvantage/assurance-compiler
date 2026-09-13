@AGENTS.md

# Claude Code notes

AGENTS.md above is the repository instruction set. The points below apply only to working here
with Claude Code.

- Inspect the applicable instructions (`AGENTS.md`, `POLICY.md`, the docs it routes to) and the
  actual repository state before acting.
- Use Ponytail full for implementation restraint when the plugin is installed, and Ponytail
  review for a focused over-engineering pass on a diff. Ponytail is not a security or
  correctness review; do not report it as one.
- Use the frontend-design skill when frontend implementation or visual design is in scope.
- Verify that a skill or command actually exists in this session before relying on it. Do not
  describe a missing tool as active or a review that did not happen as done.
- Scope inspection to the task. A narrow task does not call for a whole-repository audit.
- For substantial changes, obtain an independent review through the available agent workflow
  and say what it found. It is not human sign-off (POLICY.md §A).
- When simplifying, keep input validation at trust boundaries, error handling that prevents
  data loss, and security checks intact.
- Browser verification means exercising the real behavior in a browser: the click, the reload,
  the keyboard path. A screenshot alone is inspection, not verification.
