import type { CloudRunReport, CloudStage } from '@assurance-compiler/sync';
import type { RunView } from '@/lib/run-view';

/**
 * Development-only synthetic runs for reviewing difficult states. Nothing here is evidence
 * and none of it is stored.
 */

export const FIXTURE_STATES = ['running', 'stale', 'proven', 'failed', 'not-proven', 'missing', 'empty', 'disagree'] as const;
export type FixtureState = (typeof FIXTURE_STATES)[number];

const OID = (c: string) => c.repeat(40);
const T0 = '2026-09-13T10:00:00.000Z';
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();

const stagesAll = (last: CloudStage['status']): CloudStage[] => [
  { name: 'environment', status: 'succeeded', startedAt: at(0), durationMs: 5100 },
  { name: 'baseline-migrations', status: 'succeeded', startedAt: at(5), durationMs: 1800 },
  { name: 'seed', status: 'succeeded', startedAt: at(7), durationMs: 1600 },
  { name: 'population-check', status: 'succeeded', startedAt: at(9), durationMs: 100 },
  { name: 'candidate-migrations', status: last, startedAt: at(9), durationMs: 1600 },
];

function verification(): NonNullable<CloudRunReport['verification']> {
  return {
    runId: '93f597ac-a4c0-4d98-8ceb-1d7539d06102',
    provider: { id: 'prisma-postgresql', version: '0.1.0' },
    environment: { postgres: '16.14 (Homebrew)', prisma: '6.19.3' },
    subject: {
      baseline: OID('b'),
      candidate: OID('c'),
      schema: { baseline: OID('d'), candidate: OID('e') },
      seed: { path: 'prisma/seed.sql', blob: OID('f') },
      baselineMigrations: [{ name: '20260801_init', blob: OID('1') }],
      candidateMigrations: [{ name: '20260913_add_age', blob: OID('2') }],
      expectedTables: ['public.User'],
    },
    stages: stagesAll('succeeded'),
    populatedTables: [{ table: 'public.User', populated: true }],
    cleanup: { status: 'succeeded', leftoverCount: 0 },
  };
}

function report(overrides: Partial<CloudRunReport>): CloudRunReport {
  return {
    version: 1,
    runId: '93f597ac-a4c0-4d98-8ceb-1d7539d06102',
    cli: { version: '0.1.0' },
    startedAt: T0,
    finishedAt: at(12),
    base: { ref: 'main', commit: OID('b') },
    head: { ref: 'HEAD', commit: OID('c') },
    mergeBase: OID('b'),
    detectors: ['prisma'],
    changes: [
      {
        surface: 'DATABASE_SCHEMA_CHANGE',
        detector: 'prisma',
        files: [
          { path: 'prisma/migrations/20260913_add_age/migration.sql', status: 'added' },
          { path: 'prisma/schema.prisma', status: 'modified' },
        ],
      },
    ],
    requirements: [{ id: 'NONEMPTY_MIGRATION_EXECUTION', state: 'PROVEN', triggeredBy: ['DATABASE_SCHEMA_CHANGE'] }],
    verdict: 'COMPLETE',
    verification: verification(),
    localArtifact: { sha256: 'a'.repeat(64) },
    ...overrides,
  };
}

const base: Omit<RunView, 'report' | 'events' | 'sync' | 'reassessmentAgrees' | 'reportHash' | 'finishedAt'> = {
  id: '93f597ac-a4c0-4d98-8ceb-1d7539d06102',
  repository: { id: 'fixture-repo', name: 'billing-service (fixture)' },
  requestedBase: 'main',
  baseCommit: OID('b'),
  headCommit: OID('c'),
  mergeBase: OID('b'),
  cliLabel: 'dev-fixture.local',
  cliVersion: '0.1.0',
  startedAt: T0,
  receivedAt: at(1),
};

const done = (r: CloudRunReport, agrees = true): RunView => ({
  ...base,
  report: r,
  events: [],
  sync: 'reported',
  finishedAt: r.finishedAt,
  reassessmentAgrees: agrees,
  reportHash: '9'.repeat(64),
});

export function fixture(state: FixtureState): RunView {
  switch (state) {
    case 'running':
      return {
        ...base,
        report: null,
        finishedAt: null,
        sync: 'live',
        reassessmentAgrees: null,
        reportHash: null,
        events: [
          { sequence: 1, at: at(0), stage: { name: 'environment', status: 'running', startedAt: at(0) } },
          { sequence: 2, at: at(5), stage: { name: 'environment', status: 'succeeded', startedAt: at(0), durationMs: 5100 } },
          { sequence: 3, at: at(5), stage: { name: 'baseline-migrations', status: 'running', startedAt: at(5) } },
        ],
      };
    case 'stale':
      return { ...fixture('running'), sync: 'stale' };
    case 'proven':
      return done(report({}));
    case 'failed':
      return done(
        report({
          verdict: 'FAILED',
          requirements: [{ id: 'NONEMPTY_MIGRATION_EXECUTION', state: 'FAILED', triggeredBy: ['DATABASE_SCHEMA_CHANGE'] }],
          verification: {
            ...verification(),
            stages: stagesAll('failed'),
            migrationFailure: { migration: '20260913_add_age', sqlState: '23502' },
          },
        }),
      );
    case 'not-proven':
      return done(
        report({
          verdict: 'INCOMPLETE',
          requirements: [{ id: 'NONEMPTY_MIGRATION_EXECUTION', state: 'NOT_PROVEN', triggeredBy: ['DATABASE_SCHEMA_CHANGE'] }],
          verification: {
            ...verification(),
            stages: [
              { name: 'environment', status: 'succeeded', startedAt: at(0), durationMs: 5100 },
              { name: 'baseline-migrations', status: 'succeeded', startedAt: at(5), durationMs: 1800 },
              { name: 'seed', status: 'succeeded', startedAt: at(7), durationMs: 1600 },
              { name: 'population-check', status: 'failed', startedAt: at(9), durationMs: 100 },
              { name: 'candidate-migrations', status: 'pending' },
            ],
            populatedTables: [],
          },
        }),
      );
    case 'missing':
      return done(
        report({
          verdict: 'INCOMPLETE',
          requirements: [{ id: 'NONEMPTY_MIGRATION_EXECUTION', state: 'MISSING', triggeredBy: ['DATABASE_SCHEMA_CHANGE'] }],
          verification: null,
        }),
      );
    case 'empty':
      return done(report({ verdict: 'COMPLETE', changes: [], requirements: [], verification: null }));
    case 'disagree':
      return done(
        report({
          verdict: 'COMPLETE',
          verification: { ...verification(), stages: stagesAll('failed') },
        }),
        false,
      );
  }
}
