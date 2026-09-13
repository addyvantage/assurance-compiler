import type { ChangedFile, ChangedFileStatus } from '../changes/changed-file.js';
import type { ChangeDetection } from '../changes/change-detection.js';
import type { Revision } from '../changes/change-set.js';
import type { ChangeSurface } from '../changes/change-surface.js';
import { evidenceOf } from '../evidence/assessment.js';
import type { AssuranceState } from '../evidence/assurance-state.js';
import type { Evidence, EvidenceOutcome } from '../evidence/evidence.js';
import type { MigrationExecutionObservation } from '../evidence/migration-execution.js';
import type { AssurancePlan } from '../planner/assurance-plan.js';
import { planVerdict, type Verdict } from '../planner/verdict.js';
import type { RequirementId } from '../requirements/requirement-definition.js';
import type { RequirementInstance } from '../requirements/requirement-instance.js';

/**
 * The machine-readable form of an assurance plan.
 *
 * These types are a public wire format, defined separately from the domain model so that
 * internal refactoring cannot silently change it. Any incompatible change to this shape
 * requires a new `version`. Human-readable copy (titles, rationale) is intentionally
 * absent: consumers derive it from the requirement and surface identifiers.
 */
export interface PlanDocument {
  readonly version: 1;
  readonly base: RevisionDocument;
  readonly head: RevisionDocument;
  readonly mergeBase: string;
  readonly detectors: readonly string[];
  readonly changes: readonly ChangeDocument[];
  readonly requirements: readonly RequirementDocument[];
  readonly verdict: Verdict;
}

export interface RevisionDocument {
  readonly ref: string;
  readonly commit: string;
}

export interface ChangeDocument {
  readonly surface: ChangeSurface;
  readonly detector: string;
  readonly files: readonly FileDocument[];
}

export type FileDocument =
  | { readonly path: string; readonly status: Exclude<ChangedFileStatus, 'renamed'> }
  | { readonly path: string; readonly status: 'renamed'; readonly previousPath: string };

export interface RequirementDocument {
  readonly id: RequirementId;
  readonly state: AssuranceState;
  readonly triggeredBy: readonly ChangeSurface[];
  readonly evidence: readonly EvidenceDocument[];
  /** Present only when `state` is `NOT_PROVEN` or `NOT_APPLICABLE`. */
  readonly reason?: string;
}

/**
 * The machine-readable result of `assure check`: the plan document plus the verification
 * record behind its assessments. The record is also the `--evidence-out` artifact format and
 * shares this document's `version`.
 */
export interface CheckDocument extends PlanDocument {
  /** The migration verification run, or `null` when none ran. */
  readonly verification: MigrationExecutionObservation | null;
}

export function toCheckDocument(
  plan: AssurancePlan,
  verification: MigrationExecutionObservation | null,
): CheckDocument {
  return { ...toPlanDocument(plan), verification };
}

export interface EvidenceDocument {
  readonly provider: string;
  readonly commit: string;
  readonly outcome: EvidenceOutcome;
  readonly summary: string;
}

export function toPlanDocument(plan: AssurancePlan): PlanDocument {
  const { base, head, mergeBase } = plan.changeSet;
  return {
    version: 1,
    base: toRevisionDocument(base),
    head: toRevisionDocument(head),
    mergeBase,
    detectors: plan.detectors,
    changes: plan.changes.map(toChangeDocument),
    requirements: plan.requirements.map(toRequirementDocument),
    verdict: planVerdict(plan),
  };
}

function toRevisionDocument(revision: Revision): RevisionDocument {
  return { ref: revision.ref, commit: revision.commit };
}

function toChangeDocument(detection: ChangeDetection): ChangeDocument {
  return {
    surface: detection.surface,
    detector: detection.detector,
    files: detection.files.map(toFileDocument),
  };
}

function toFileDocument(file: ChangedFile): FileDocument {
  return file.status === 'renamed'
    ? { path: file.path, status: file.status, previousPath: file.previousPath }
    : { path: file.path, status: file.status };
}

function toRequirementDocument(instance: RequirementInstance): RequirementDocument {
  const { assessment } = instance;
  return {
    id: instance.requirement,
    state: assessment.state,
    triggeredBy: instance.triggeredBy,
    evidence: evidenceOf(assessment).map(toEvidenceDocument),
    ...('reason' in assessment ? { reason: assessment.reason } : {}),
  };
}

function toEvidenceDocument(evidence: Evidence): EvidenceDocument {
  return {
    provider: evidence.provider,
    commit: evidence.commit,
    outcome: evidence.outcome,
    summary: evidence.summary,
  };
}
