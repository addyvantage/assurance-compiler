import type { AssuranceState } from '../evidence/assurance-state.js';
import type { AssurancePlan } from './assurance-plan.js';

/**
 * The overall standing of a plan's requirements.
 *
 * - `FAILED`      At least one requirement has evidence that it is violated.
 * - `INCOMPLETE`  Nothing failed, but at least one requirement is `MISSING` or `NOT_PROVEN`.
 * - `COMPLETE`    Every applicable requirement is `PROVEN`.
 *
 * A verdict describes the requirements in the plan, never the change as a whole. A plan
 * with no applicable requirements is vacuously `COMPLETE`.
 */
export type Verdict = 'COMPLETE' | 'INCOMPLETE' | 'FAILED';

export function reduceVerdict(states: Iterable<AssuranceState>): Verdict {
  let verdict: Verdict = 'COMPLETE';
  for (const state of states) {
    switch (state) {
      case 'FAILED':
        return 'FAILED';
      case 'MISSING':
      case 'NOT_PROVEN':
        verdict = 'INCOMPLETE';
        break;
      case 'PROVEN':
      case 'NOT_APPLICABLE':
        break;
    }
  }
  return verdict;
}

export function planVerdict(plan: AssurancePlan): Verdict {
  return reduceVerdict(plan.requirements.map((instance) => instance.assessment.state));
}
