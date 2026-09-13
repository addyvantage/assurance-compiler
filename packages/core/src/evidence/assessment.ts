import type { NonEmptyReadonlyArray } from '../shared/non-empty.js';
import type { Evidence } from './evidence.js';

/**
 * A requirement's assurance state together with what justifies it.
 *
 * The union rules out incoherent combinations: nothing is `PROVEN` or `FAILED` without
 * evidence, `MISSING` cannot carry evidence, and `NOT_PROVEN` and `NOT_APPLICABLE` must say why.
 */
export type Assessment =
  | { readonly state: 'PROVEN'; readonly evidence: NonEmptyReadonlyArray<Evidence> }
  | { readonly state: 'FAILED'; readonly evidence: NonEmptyReadonlyArray<Evidence> }
  | {
      readonly state: 'NOT_PROVEN';
      readonly evidence: readonly Evidence[];
      readonly reason: string;
    }
  | { readonly state: 'MISSING' }
  | { readonly state: 'NOT_APPLICABLE'; readonly reason: string };

export function evidenceOf(assessment: Assessment): readonly Evidence[] {
  return 'evidence' in assessment ? assessment.evidence : [];
}
