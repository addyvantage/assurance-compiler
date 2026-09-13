import type { NonEmptyReadonlyArray } from '../shared/non-empty.js';

/** Every requirement the compiler can infer, in canonical order. */
export const REQUIREMENTS = ['NONEMPTY_MIGRATION_EXECUTION'] as const;

export type RequirementId = (typeof REQUIREMENTS)[number];

/**
 * Something that must be demonstrated, independent of how it is demonstrated.
 *
 * A definition fixes what a requirement means. Evidence providers attach evidence to a
 * requirement; they never change what it establishes or what it leaves unproven.
 */
export interface RequirementDefinition<Id extends RequirementId = RequirementId> {
  readonly id: Id;
  readonly title: string;
  /** Why ordinary verification does not already cover this requirement. */
  readonly rationale: string;
  /** The property that holds once the requirement is proven. */
  readonly establishes: string;
  /**
   * Properties that proving this requirement does not establish. Every requirement has
   * limits, and stating them keeps the plan from implying more certainty than it has.
   */
  readonly limitations: NonEmptyReadonlyArray<string>;
}
