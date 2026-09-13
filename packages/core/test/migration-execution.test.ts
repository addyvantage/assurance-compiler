import { describe, expect, it } from 'vitest';
import {
  MIGRATION_EXECUTION_STAGES,
  assessMigrationExecution,
  type MigrationExecutionObservation,
  type MigrationExecutionStage,
  type MigrationExecutionSubject,
  type StageRecord,
} from '../src/index.js';

const subject: MigrationExecutionSubject = {
  baseline: 'a'.repeat(40),
  candidate: 'b'.repeat(40),
  schema: { baseline: '1'.repeat(40), candidate: '2'.repeat(40) },
  seed: { path: 'prisma/seed.sql', blob: '3'.repeat(40) },
  baselineMigrations: [{ name: '20260801_init', blob: '4'.repeat(40) }],
  candidateMigrations: [{ name: '20260913_add_age', blob: '5'.repeat(40) }],
  expectedTables: ['public.User'],
};

const violation = {
  migration: '20260913_add_age',
  sqlState: '23502',
  message: 'column "age" of relation "User" contains null values',
};

function succeeded(name: MigrationExecutionStage): StageRecord {
  return { name, status: 'succeeded', startedAt: '2026-09-13T00:00:00.000Z', durationMs: 5 };
}

/** Stages that succeed up to `name`, which ends with `status`, followed by stages never run. */
function stopsAt(name: MigrationExecutionStage, status: 'failed' | 'cancelled'): StageRecord[] {
  const index = MIGRATION_EXECUTION_STAGES.indexOf(name);
  return MIGRATION_EXECUTION_STAGES.map((stage, position) => {
    if (position < index) return succeeded(stage);
    return position === index
      ? { name: stage, status, detail: `${stage} ${status}` }
      : { name: stage, status: 'pending' };
  });
}

function observation(
  overrides: Partial<MigrationExecutionObservation> = {},
): MigrationExecutionObservation {
  return {
    requirement: 'NONEMPTY_MIGRATION_EXECUTION',
    runId: '5f0c8a2e-0000-4000-8000-000000000000',
    origin: 'local',
    provider: { id: 'prisma-postgresql', version: '0.1.0' },
    environment: { postgres: '16.14', prisma: '6.19.3' },
    subject,
    stages: MIGRATION_EXECUTION_STAGES.map(succeeded),
    populatedTables: [{ table: 'public.User', populated: true }],
    cleanup: { status: 'succeeded', leftovers: [] },
    ...overrides,
  };
}

describe('assessMigrationExecution', () => {
  it('is PROVEN only when every stage succeeded for exactly the expected inputs', () => {
    expect(assessMigrationExecution(subject, observation())).toMatchObject({
      state: 'PROVEN',
      evidence: [
        {
          requirement: 'NONEMPTY_MIGRATION_EXECUTION',
          provider: 'prisma-postgresql',
          commit: subject.candidate,
          outcome: 'SATISFIES',
        },
      ],
    });
  });

  it('is FAILED when a candidate migration raises a data or constraint error', () => {
    const assessment = assessMigrationExecution(
      subject,
      observation({
        stages: stopsAt('candidate-migrations', 'failed'),
        migrationFailure: violation,
      }),
    );

    expect(assessment).toMatchObject({
      state: 'FAILED',
      evidence: [{ outcome: 'VIOLATES', commit: subject.candidate }],
    });
    expect(assessment.state === 'FAILED' && assessment.evidence[0].summary).toContain(
      'SQLSTATE 23502',
    );
  });

  it.each(['08006', '57P01', '53100', 'XX000', '42501'])(
    'treats candidate SQLSTATE %s as operational, not as a violation',
    (sqlState) => {
      const assessment = assessMigrationExecution(
        subject,
        observation({
          stages: stopsAt('candidate-migrations', 'failed'),
          migrationFailure: { migration: violation.migration, sqlState },
        }),
      );

      expect(assessment).toMatchObject({
        state: 'NOT_PROVEN',
        evidence: [{ outcome: 'INSUFFICIENT' }],
      });
    },
  );

  it.each(MIGRATION_EXECUTION_STAGES)('is NOT_PROVEN when the %s stage fails', (stage) => {
    const populationChecked =
      MIGRATION_EXECUTION_STAGES.indexOf(stage) >
      MIGRATION_EXECUTION_STAGES.indexOf('population-check');
    const assessment = assessMigrationExecution(
      subject,
      observation({
        stages: stopsAt(stage, 'failed'),
        ...(populationChecked ? {} : { populatedTables: [] }),
      }),
    );

    expect(assessment).toMatchObject({
      state: 'NOT_PROVEN',
      reason: expect.stringContaining(stage) as unknown,
    });
  });

  it('is NOT_PROVEN when the run is cancelled', () => {
    const assessment = assessMigrationExecution(
      subject,
      observation({ stages: stopsAt('candidate-migrations', 'cancelled') }),
    );

    expect(assessment.state).toBe('NOT_PROVEN');
  });

  it.each<[string, Partial<MigrationExecutionObservation>]>([
    ['another requirement', { requirement: 'API_BACKWARD_COMPATIBILITY' }],
    ['another candidate commit', { subject: { ...subject, candidate: 'c'.repeat(40) } }],
    ['another baseline commit', { subject: { ...subject, baseline: 'c'.repeat(40) } }],
    [
      'another schema',
      { subject: { ...subject, schema: { ...subject.schema, candidate: '9'.repeat(40) } } },
    ],
    [
      'another seed fixture',
      { subject: { ...subject, seed: { ...subject.seed, blob: '9'.repeat(40) } } },
    ],
    ['another baseline history', { subject: { ...subject, baselineMigrations: [] } }],
    [
      'other candidate migrations',
      {
        subject: {
          ...subject,
          candidateMigrations: [{ name: '20260913_add_age', blob: '9'.repeat(40) }],
        },
      },
    ],
    ['other expected tables', { subject: { ...subject, expectedTables: ['public.Post'] } }],
    ['a missing run identity', { runId: '' }],
    ['a missing stage', { stages: MIGRATION_EXECUTION_STAGES.slice(0, 4).map(succeeded) }],
    ['stages out of order', { stages: [...MIGRATION_EXECUTION_STAGES].reverse().map(succeeded) }],
    [
      'a stage that never finished',
      {
        stages: MIGRATION_EXECUTION_STAGES.map((name, index) =>
          index === 4 ? { name, status: 'running' } : succeeded(name),
        ),
      },
    ],
    [
      'a stage that ran after a failure',
      {
        stages: stopsAt('seed', 'failed').map((stage) =>
          stage.name === 'population-check' ? succeeded(stage.name) : stage,
        ),
      },
    ],
    ['unrecorded tool versions', { environment: {} }],
    [
      'an unpopulated table behind a successful check',
      { populatedTables: [{ table: 'public.User', populated: false }] },
    ],
    ['a population check that skipped a table', { populatedTables: [] }],
    ['a migration failure for a candidate stage that succeeded', { migrationFailure: violation }],
    [
      'a failure attributed to a baseline migration',
      {
        stages: stopsAt('candidate-migrations', 'failed'),
        migrationFailure: { ...violation, migration: '20260801_init' },
      },
    ],
    [
      'a malformed SQLSTATE',
      {
        stages: stopsAt('candidate-migrations', 'failed'),
        migrationFailure: { ...violation, sqlState: '23' },
      },
    ],
  ])('rejects evidence with %s', (_description, overrides) => {
    expect(assessMigrationExecution(subject, observation(overrides))).toEqual({
      state: 'NOT_PROVEN',
      evidence: [],
      reason: expect.stringMatching(/^Evidence rejected: /) as unknown,
    });
  });

  it('cannot prove a change that adds no candidate migration', () => {
    const withoutCandidates = { ...subject, candidateMigrations: [] };

    expect(
      assessMigrationExecution(withoutCandidates, observation({ subject: withoutCandidates }))
        .state,
    ).toBe('NOT_PROVEN');
  });
});
