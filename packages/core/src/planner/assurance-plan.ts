import type { ChangeDetection } from '../changes/change-detection.js';
import type { ChangeSet } from '../changes/change-set.js';
import type { ChangeDetector } from '../changes/detector.js';
import { detectChanges } from '../changes/detector.js';
import type { Assessment } from '../evidence/assessment.js';
import type { RequirementId } from '../requirements/requirement-definition.js';
import type { RequirementInstance } from '../requirements/requirement-instance.js';
import { inferRequirements } from './inference.js';

/**
 * What a change touches, what verification that requires, and how far evidence
 * supports each requirement.
 */
export interface AssurancePlan {
  readonly changeSet: ChangeSet;
  /**
   * The detectors that examined the change. A plan only knows what these detectors
   * recognize; an empty plan is not a statement that nothing needs verification.
   */
  readonly detectors: readonly string[];
  readonly changes: readonly ChangeDetection[];
  readonly requirements: readonly RequirementInstance[];
}

/** Returns the plan with one requirement's assessment replaced. */
export function withAssessment(
  plan: AssurancePlan,
  requirement: RequirementId,
  assessment: Assessment,
): AssurancePlan {
  return {
    ...plan,
    requirements: plan.requirements.map((instance) =>
      // RequirementId has a single member today, which makes this comparison look constant.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      instance.requirement === requirement ? { ...instance, assessment } : instance,
    ),
  };
}

export function buildAssurancePlan(
  changeSet: ChangeSet,
  detectors: readonly ChangeDetector[],
): AssurancePlan {
  const changes = detectChanges(changeSet.files, detectors);
  return {
    changeSet,
    detectors: detectors.map((detector) => detector.id),
    changes,
    requirements: inferRequirements(changes),
  };
}
