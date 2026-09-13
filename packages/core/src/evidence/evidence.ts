import type { RequirementId } from '../requirements/requirement-definition.js';

/**
 * What a single piece of evidence shows about its requirement.
 *
 * - `SATISFIES`     The observation establishes the requirement.
 * - `VIOLATES`      The observation shows the requirement does not hold.
 * - `INSUFFICIENT`  Verification ran, but what it observed (partial coverage, an aborted
 *                   run) neither establishes nor refutes the requirement.
 */
export type EvidenceOutcome = 'SATISFIES' | 'VIOLATES' | 'INSUFFICIENT';

/** The result of a verification, bound to one requirement and one commit. */
export interface Evidence {
  readonly requirement: RequirementId;
  /** Identifier of the evidence provider that produced it. */
  readonly provider: string;
  /** The commit that was verified. Evidence about one commit says nothing about another. */
  readonly commit: string;
  readonly outcome: EvidenceOutcome;
  /** A concise, factual account of what was observed. */
  readonly summary: string;
}
