import type { ChangeDetection } from '../changes/change-detection.js';
import { compareChangeSurfaces, type ChangeSurface } from '../changes/change-surface.js';
import type { Assessment } from '../evidence/assessment.js';
import { REQUIREMENTS, type RequirementId } from '../requirements/requirement-definition.js';
import type { RequirementInstance } from '../requirements/requirement-instance.js';
import { isNonEmpty } from '../shared/non-empty.js';

/**
 * The requirements each change surface imposes.
 *
 * This table is the only place CHANGE is connected to REQUIREMENT. It is total over
 * `ChangeSurface`, so a new surface does not compile until its requirements are decided.
 */
export const requirementsBySurface: Readonly<Record<ChangeSurface, readonly RequirementId[]>> = {
  DATABASE_SCHEMA_CHANGE: ['NONEMPTY_MIGRATION_EXECUTION'],
};

/**
 * No evidence providers exist yet, so every inferred requirement starts out `MISSING`.
 * Collecting evidence is a separate stage that replaces assessments; it never changes
 * which requirements a change imposes.
 */
const WITHOUT_EVIDENCE_PROVIDER: Assessment = { state: 'MISSING' };

/** Infers one requirement instance per required assurance, in canonical order. */
export function inferRequirements(
  detections: readonly ChangeDetection[],
): readonly RequirementInstance[] {
  return REQUIREMENTS.flatMap((requirement) => {
    const triggeredBy = surfacesRequiring(requirement, detections);
    return isNonEmpty(triggeredBy)
      ? [{ requirement, triggeredBy, assessment: WITHOUT_EVIDENCE_PROVIDER }]
      : [];
  });
}

function surfacesRequiring(
  requirement: RequirementId,
  detections: readonly ChangeDetection[],
): ChangeSurface[] {
  const surfaces = new Set(
    detections
      .map((detection) => detection.surface)
      .filter((surface) => requirementsBySurface[surface].includes(requirement)),
  );
  return [...surfaces].sort(compareChangeSurfaces);
}
