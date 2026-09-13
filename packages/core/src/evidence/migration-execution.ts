import type { Assessment } from './assessment.js';
import type { Evidence } from './evidence.js';

const REQUIREMENT = 'NONEMPTY_MIGRATION_EXECUTION';

/** The stages that verify NONEMPTY_MIGRATION_EXECUTION, in the order they must run. */
export const MIGRATION_EXECUTION_STAGES = [
  'environment',
  'baseline-migrations',
  'seed',
  'population-check',
  'candidate-migrations',
] as const;

export type MigrationExecutionStage = (typeof MIGRATION_EXECUTION_STAGES)[number];

/** The lifecycle of a stage. It describes execution, never whether a requirement holds. */
export type StageStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface StageRecord {
  readonly name: MigrationExecutionStage;
  readonly status: StageStatus;
  readonly startedAt?: string;
  readonly durationMs?: number;
  /** The command that ran, with run-local paths abbreviated and no credentials. */
  readonly command?: string;
  /** A bounded, redacted account of the outcome. Never contains row values or credentials. */
  readonly detail?: string;
}

export interface MigrationIdentity {
  readonly name: string;
  /** Git blob ID of the migration's `migration.sql`. */
  readonly blob: string;
}

/**
 * Exactly what a verification must be about, derived from immutable Git objects before any
 * provider runs. An observation about anything else is not evidence for this change.
 */
export interface MigrationExecutionSubject {
  /** The merge base: the database state the candidate migrations are applied on top of. */
  readonly baseline: string;
  readonly candidate: string;
  readonly schema: { readonly baseline: string; readonly candidate: string };
  readonly seed: { readonly path: string; readonly blob: string };
  readonly baselineMigrations: readonly MigrationIdentity[];
  /** The migrations the candidate appends to the baseline history, in apply order. */
  readonly candidateMigrations: readonly MigrationIdentity[];
  /** Tables, as `schema.table`, that must contain rows before candidate migrations run. */
  readonly expectedTables: readonly string[];
}

/** A database error raised while a candidate migration was applied. */
export interface MigrationFailure {
  readonly migration: string;
  readonly sqlState: string;
  /** The primary error message, omitted when it could contain row values. */
  readonly message?: string;
}

/**
 * What a provider reports about one run. It is untrusted input: only
 * `assessMigrationExecution` turns it into an assessment.
 */
export interface MigrationExecutionObservation {
  readonly requirement: string;
  readonly runId: string;
  readonly origin: 'local';
  readonly provider: { readonly id: string; readonly version: string };
  /** Versions of the tools that actually ran. */
  readonly environment: { readonly postgres?: string; readonly prisma?: string };
  readonly subject: MigrationExecutionSubject;
  readonly stages: readonly StageRecord[];
  readonly populatedTables: readonly { readonly table: string; readonly populated: boolean }[];
  readonly migrationFailure?: MigrationFailure;
  readonly cleanup: {
    readonly status: 'succeeded' | 'failed';
    /** Resources this run created that could not be removed. */
    readonly leftovers: readonly string[];
  };
}

/**
 * SQLSTATE classes a candidate migration can raise because of what it does to the data:
 * data exceptions (22), integrity constraint violations (23), and invalid statements (42).
 * Connection, resource and server errors are operational and never count as a violation.
 */
const VIOLATION_CLASSES = new Set(['22', '23', '42']);

/**
 * Verification deliberately runs migrations without superuser privileges. A privilege error
 * reflects that environment, not the migration, so it is never a violation.
 */
const INSUFFICIENT_PRIVILEGE = '42501';

/**
 * The single authority that turns a provider observation into an assessment.
 *
 * It never trusts the provider's framing: the observation must be about exactly the expected
 * subject, record a coherent stage lifecycle, and support its outcome. Anything malformed,
 * contradictory or about other inputs is NOT_PROVEN and carries no evidence.
 */
export function assessMigrationExecution(
  subject: MigrationExecutionSubject,
  observation: MigrationExecutionObservation,
): Assessment {
  const rejection = findRejection(subject, observation);
  if (rejection !== undefined) {
    return { state: 'NOT_PROVEN', evidence: [], reason: `Evidence rejected: ${rejection}` };
  }

  const blocked = observation.stages.find((stage) => stage.status !== 'succeeded');
  if (blocked === undefined) {
    const summary = provenSummary(subject, observation);
    return { state: 'PROVEN', evidence: [evidence(subject, observation, 'SATISFIES', summary)] };
  }

  const { migrationFailure } = observation;
  if (blocked.name === 'candidate-migrations' && blocked.status === 'failed' && migrationFailure) {
    const { sqlState } = migrationFailure;
    if (VIOLATION_CLASSES.has(sqlState.slice(0, 2)) && sqlState !== INSUFFICIENT_PRIVILEGE) {
      const summary = failedSummary(migrationFailure, observation);
      return { state: 'FAILED', evidence: [evidence(subject, observation, 'VIOLATES', summary)] };
    }
    const reason = `Candidate migration ${migrationFailure.migration} stopped with SQLSTATE ${migrationFailure.sqlState}, an operational error rather than evidence about the migration.`;
    return notProven(subject, observation, reason);
  }

  const detail = blocked.detail === undefined ? '' : `: ${blocked.detail}`;
  return notProven(subject, observation, `The ${blocked.name} stage ${blocked.status}${detail}`);
}

function findRejection(
  subject: MigrationExecutionSubject,
  observation: MigrationExecutionObservation,
): string | undefined {
  if (observation.requirement !== REQUIREMENT) {
    return `it is about ${observation.requirement}, not ${REQUIREMENT}.`;
  }
  const mismatch = subjectMismatch(subject, observation.subject);
  if (mismatch !== undefined) return `it was produced for a different ${mismatch}.`;
  if (subject.candidateMigrations.length === 0) {
    return 'there is no candidate migration to verify.';
  }
  if (
    observation.runId === '' ||
    observation.provider.id === '' ||
    observation.provider.version === ''
  ) {
    return 'the run or provider identity is missing.';
  }
  return lifecycleProblem(subject, observation);
}

function subjectMismatch(
  expected: MigrationExecutionSubject,
  actual: MigrationExecutionSubject,
): string | undefined {
  if (actual.baseline !== expected.baseline) return 'baseline commit';
  if (actual.candidate !== expected.candidate) return 'candidate commit';
  if (!sameJson(actual.schema, expected.schema)) return 'Prisma schema';
  if (!sameJson(actual.seed, expected.seed)) return 'seed fixture';
  if (!sameJson(actual.baselineMigrations, expected.baselineMigrations)) {
    return 'baseline migration history';
  }
  if (!sameJson(actual.candidateMigrations, expected.candidateMigrations)) {
    return 'set of candidate migrations';
  }
  if (!sameJson(actual.expectedTables, expected.expectedTables)) return 'set of expected tables';
  return undefined;
}

function lifecycleProblem(
  subject: MigrationExecutionSubject,
  observation: MigrationExecutionObservation,
): string | undefined {
  const { stages } = observation;
  const names = stages.map((stage) => stage.name);
  if (!sameJson(names, MIGRATION_EXECUTION_STAGES))
    return 'its stages are incomplete or out of order.';

  const firstUnfinished = stages.findIndex((stage) => stage.status !== 'succeeded');
  if (firstUnfinished !== -1) {
    const stage = stages[firstUnfinished];
    if (stage?.status === 'pending' || stage?.status === 'running') {
      return `the ${stage.name} stage never finished.`;
    }
    if (stages.slice(firstUnfinished + 1).some((later) => later.status !== 'pending')) {
      return 'a stage ran after an earlier stage did not succeed.';
    }
  }

  const reachedDatabase = stages[0]?.status === 'succeeded';
  if (reachedDatabase && (!observation.environment.postgres || !observation.environment.prisma)) {
    return 'the PostgreSQL or Prisma version that ran is not recorded.';
  }

  const populationChecked = stages[3]?.status === 'succeeded';
  const observedTables = observation.populatedTables.map((entry) => entry.table);
  if (
    populationChecked &&
    (!sameJson(observedTables, subject.expectedTables) ||
      observation.populatedTables.some((entry) => !entry.populated))
  ) {
    return 'the population check succeeded without every expected table containing rows.';
  }

  const failure = observation.migrationFailure;
  if (failure !== undefined) {
    if (stages[4]?.status !== 'failed') {
      return 'it reports a migration failure for a candidate stage that did not fail.';
    }
    if (!subject.candidateMigrations.some((migration) => migration.name === failure.migration)) {
      return `the failing migration ${failure.migration} is not a candidate migration.`;
    }
    if (!/^[0-9A-Z]{5}$/.test(failure.sqlState)) return 'the reported SQLSTATE is malformed.';
  }
  return undefined;
}

function notProven(
  subject: MigrationExecutionSubject,
  observation: MigrationExecutionObservation,
  reason: string,
): Assessment {
  return {
    state: 'NOT_PROVEN',
    evidence: [evidence(subject, observation, 'INSUFFICIENT', reason)],
    reason,
  };
}

function evidence(
  subject: MigrationExecutionSubject,
  observation: MigrationExecutionObservation,
  outcome: Evidence['outcome'],
  summary: string,
): Evidence {
  return {
    requirement: REQUIREMENT,
    provider: observation.provider.id,
    commit: subject.candidate,
    outcome,
    summary,
  };
}

/** Claims name the PostgreSQL version, because a result only holds for the version that ran. */
function provenSummary(
  subject: MigrationExecutionSubject,
  observation: MigrationExecutionObservation,
): string {
  const names = subject.candidateMigrations.map((migration) => migration.name).join(', ');
  return `Candidate migrations (${names}) applied without error on PostgreSQL ${String(observation.environment.postgres)} to the merge-base database populated by ${subject.seed.path}, with rows in ${subject.expectedTables.join(', ')}.`;
}

function failedSummary(
  failure: MigrationFailure,
  observation: MigrationExecutionObservation,
): string {
  const message = failure.message === undefined ? '' : `: ${failure.message}`;
  return `Candidate migration ${failure.migration} failed on PostgreSQL ${String(observation.environment.postgres)} against the populated merge-base database with SQLSTATE ${failure.sqlState}${message}.`;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
