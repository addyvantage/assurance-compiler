/**
 * How far evidence supports a requirement. These states are deliberately not a
 * pass/fail pair: the absence of evidence is never reported as a failure, and never
 * as a success.
 *
 * - `PROVEN`          Verification produced evidence that satisfies the requirement.
 * - `FAILED`          Verification ran and produced evidence that the requirement is violated.
 * - `NOT_PROVEN`      A verification mechanism exists or was attempted, but its evidence does
 *                     not establish the requirement.
 * - `MISSING`         No evidence provider or gate exists for the requirement.
 * - `NOT_APPLICABLE`  The requirement was determined not to apply to this change.
 */
export const ASSURANCE_STATES = [
  'PROVEN',
  'FAILED',
  'NOT_PROVEN',
  'MISSING',
  'NOT_APPLICABLE',
] as const;

export type AssuranceState = (typeof ASSURANCE_STATES)[number];
