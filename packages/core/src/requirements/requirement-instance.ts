import type { ChangeSurface } from '../changes/change-surface.js';
import type { Assessment } from '../evidence/assessment.js';
import type { NonEmptyReadonlyArray } from '../shared/non-empty.js';
import type { RequirementId } from './requirement-definition.js';

/** A requirement imposed on a specific change, with its current assessment. */
export interface RequirementInstance {
  readonly requirement: RequirementId;
  /** The detected change surfaces that impose this requirement, in canonical order. */
  readonly triggeredBy: NonEmptyReadonlyArray<ChangeSurface>;
  readonly assessment: Assessment;
}
