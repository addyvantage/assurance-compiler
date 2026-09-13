/**
 * Exit codes for `assure diff`.
 *
 * `diff` is analytical, not an enforcement gate: it exits `Success` whenever it produces a
 * plan, whatever the verdict.
 */
export const ExitCode = {
  /** The command did its job. For `diff`, a plan was produced. */
  Success: 0,
  /** The command could not complete, for example outside a Git repository. */
  Error: 1,
  /** The command was invoked incorrectly. */
  Usage: 2,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/** Exit codes for `assure check`, which is an enforcement gate. */
export const CheckExitCode = {
  /** Every applicable requirement is PROVEN, or no supported requirement applied. */
  Complete: 0,
  /** At least one requirement has valid evidence that it is violated. */
  Failed: 1,
  /** Invalid arguments or malformed verification configuration. */
  Usage: 2,
  /** A requirement is MISSING or NOT_PROVEN, or the check could not complete. */
  Incomplete: 3,
} as const;

export type CheckExitCode = (typeof CheckExitCode)[keyof typeof CheckExitCode];
