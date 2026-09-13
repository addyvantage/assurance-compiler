import {
  MIGRATION_EXECUTION_STAGES,
  type AssuranceState,
  type MigrationExecutionStage,
} from '@assurance-compiler/core';
import type { CloudRunReport, CloudStage } from '@assurance-compiler/sync';

/**
 * Human-readable explanations built only from structured, allowlisted fields. Nothing here
 * reads free text the CLI sent, because none was accepted.
 */

export interface Explanation {
  readonly state: AssuranceState | 'NONE';
  /** A short sentence a person reads first. Never claims more than the state. */
  readonly title: string;
  readonly detail: string;
  readonly nextAction: string;
}

/** Typed as string on purpose: the catalog has one requirement today, and this must not assume it. */
const REQUIREMENT = 'NONEMPTY_MIGRATION_EXECUTION' as string;

export function explainReport(report: CloudRunReport): Explanation {
  const requirement = report.requirements.find((r) => r.id === REQUIREMENT);
  if (requirement === undefined) {
    return {
      state: 'NONE',
      title: 'No supported changes to verify',
      detail:
        'No assurance requirements were evaluated for this change. Only changes the Prisma detector recognizes are checked.',
      nextAction: 'Nothing to verify for this change.',
    };
  }
  const v = report.verification;
  const postgres = v?.environment.postgres ?? 'PostgreSQL';
  switch (requirement.state) {
    case 'PROVEN': {
      const names = v?.subject.candidateMigrations.map((m) => m.name).join(', ') ?? '';
      return {
        state: 'PROVEN',
        title: 'Migrations applied cleanly to populated data',
        detail: `Candidate migrations (${names}) applied without error on PostgreSQL ${postgres} to the merge-base database populated by ${v?.subject.seed.path ?? 'the seed fixture'}, with rows in ${v?.subject.expectedTables.join(', ') ?? 'the expected tables'}.`,
        nextAction:
          'Nothing further for this requirement. Read what it does not establish before relying on it.',
      };
    }
    case 'FAILED': {
      const failure = v?.migrationFailure;
      return {
        state: 'FAILED',
        title: 'A candidate migration failed on populated data',
        detail:
          failure === undefined
            ? `A candidate migration raised an error on PostgreSQL ${postgres} against the populated merge-base database.`
            : `Candidate migration ${failure.migration} failed on PostgreSQL ${postgres} against the populated merge-base database with SQLSTATE ${failure.sqlState}. The database message stays on the machine that ran the check.`,
        nextAction:
          'Fix the migration locally and run the check again. Each run is recorded separately; this result stays as it is.',
      };
    }
    case 'NOT_PROVEN': {
      const blocked = v?.stages.find((s) => s.status !== 'succeeded');
      const failure = v?.migrationFailure;
      const detail =
        v === null
          ? 'Verification was configured but could not start: the inputs were not supported or a prerequisite was missing. The reason was printed locally.'
          : failure !== undefined && blocked?.name === 'candidate-migrations'
            ? `Candidate migration ${failure.migration} stopped with SQLSTATE ${failure.sqlState}, an operational error rather than evidence about the migration.`
            : blocked === undefined
              ? 'The run finished without establishing the requirement.'
              : `The ${STAGE_LABELS[blocked.name].toLowerCase()} stage ${blocked.status}. This is an operational outcome, not evidence that the migration is unsafe.`;
      return {
        state: 'NOT_PROVEN',
        title:
          blocked?.status === 'cancelled'
            ? 'Not proven: the run was cancelled'
            : 'Not proven: the check stopped before a result',
        detail,
        nextAction:
          blocked?.status === 'cancelled'
            ? 'Run the check again when ready.'
            : 'Resolve the operational problem locally, then run the check again.',
      };
    }
    case 'MISSING':
      return {
        state: 'MISSING',
        title: 'Not verified: no migration check was configured',
        detail:
          'No migration verification was configured for this run, so nothing verified the requirement.',
        nextAction:
          'Run the check with --seed-sql and --expect-table so the provider can verify it.',
      };
    case 'NOT_APPLICABLE':
      return {
        state: 'NOT_APPLICABLE',
        title: 'The requirement does not apply',
        detail: 'The engine determined the requirement does not apply to this change.',
        nextAction: 'Nothing to verify for this change.',
      };
  }
}

/** The stages in the order the engine runs them, each with its latest known record. */
export function latestStages(events: readonly { stage: CloudStage }[]): CloudStage[] {
  const latest = new Map<string, CloudStage>();
  for (const event of events) latest.set(event.stage.name, event.stage);
  return MIGRATION_EXECUTION_STAGES.map((name) => latest.get(name) ?? { name, status: 'pending' });
}

export const STAGE_LABELS: Record<MigrationExecutionStage, string> = {
  environment: 'Environment',
  'baseline-migrations': 'Baseline migrations',
  seed: 'Seed',
  'population-check': 'Population check',
  'candidate-migrations': 'Candidate migrations',
};
