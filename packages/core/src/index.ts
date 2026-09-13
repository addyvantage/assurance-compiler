export { isNonEmpty, type NonEmptyReadonlyArray } from './shared/non-empty.js';

export {
  compareChangedFiles,
  touchedPaths,
  type AddedFile,
  type ChangedFile,
  type ChangedFileStatus,
  type DeletedFile,
  type ModifiedFile,
  type RenamedFile,
} from './changes/changed-file.js';
export type { ChangeSet, Revision } from './changes/change-set.js';
export {
  CHANGE_SURFACES,
  changeSurfaceDefinitions,
  compareChangeSurfaces,
  type ChangeSurface,
  type ChangeSurfaceDefinition,
} from './changes/change-surface.js';
export type { ChangeDetection } from './changes/change-detection.js';
export { detectChanges, type ChangeDetector } from './changes/detector.js';

export {
  REQUIREMENTS,
  type RequirementDefinition,
  type RequirementId,
} from './requirements/requirement-definition.js';
export { requirementDefinitions } from './requirements/catalog.js';
export type { RequirementInstance } from './requirements/requirement-instance.js';

export { ASSURANCE_STATES, type AssuranceState } from './evidence/assurance-state.js';
export type { Evidence, EvidenceOutcome } from './evidence/evidence.js';
export { evidenceOf, type Assessment } from './evidence/assessment.js';
export {
  MIGRATION_EXECUTION_STAGES,
  assessMigrationExecution,
  type MigrationExecutionObservation,
  type MigrationExecutionStage,
  type MigrationExecutionSubject,
  type MigrationFailure,
  type MigrationIdentity,
  type StageRecord,
  type StageStatus,
} from './evidence/migration-execution.js';

export { inferRequirements, requirementsBySurface } from './planner/inference.js';
export {
  buildAssurancePlan,
  withAssessment,
  type AssurancePlan,
} from './planner/assurance-plan.js';
export { planVerdict, reduceVerdict, type Verdict } from './planner/verdict.js';

export {
  toCheckDocument,
  toPlanDocument,
  type CheckDocument,
  type ChangeDocument,
  type EvidenceDocument,
  type FileDocument,
  type PlanDocument,
  type RequirementDocument,
  type RevisionDocument,
} from './report/plan-document.js';
