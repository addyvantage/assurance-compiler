import type { CheckDocument } from '@assurance-compiler/core';

const OID = 'a'.repeat(40);

/** A local FAILED check document, as the CLI would hold it, including fields that must stay local. */
export function localDocument(runId: string): CheckDocument {
  return {
    version: 1,
    base: { ref: 'main', commit: 'b'.repeat(40) },
    head: { ref: 'HEAD', commit: 'c'.repeat(40) },
    mergeBase: 'b'.repeat(40),
    detectors: ['prisma'],
    changes: [
      {
        surface: 'DATABASE_SCHEMA_CHANGE',
        detector: 'prisma',
        files: [{ path: 'prisma/migrations/20260913_add_age/migration.sql', status: 'added' }],
      },
    ],
    requirements: [
      {
        id: 'NONEMPTY_MIGRATION_EXECUTION',
        state: 'FAILED',
        triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
        evidence: [
          {
            provider: 'prisma-postgresql',
            commit: 'c'.repeat(40),
            outcome: 'VIOLATES',
            summary:
              'Candidate migration failed with SQLSTATE 23502: column "age" contains null values.',
          },
        ],
      },
    ],
    verdict: 'FAILED',
    verification: {
      requirement: 'NONEMPTY_MIGRATION_EXECUTION',
      runId,
      origin: 'local',
      provider: { id: 'prisma-postgresql', version: '0.1.0' },
      environment: { postgres: '16.14', prisma: '6.19.3' },
      subject: {
        baseline: 'b'.repeat(40),
        candidate: 'c'.repeat(40),
        schema: { baseline: OID, candidate: OID },
        seed: { path: 'prisma/seed.sql', blob: OID },
        baselineMigrations: [{ name: '20260801_init', blob: OID }],
        candidateMigrations: [{ name: '20260913_add_age', blob: OID }],
        expectedTables: ['public.User'],
      },
      stages: [
        {
          name: 'environment',
          status: 'succeeded',
          startedAt: '2026-09-13T10:00:00.000Z',
          durationMs: 5100,
          detail: 'local only',
        },
        {
          name: 'baseline-migrations',
          status: 'succeeded',
          startedAt: '2026-09-13T10:00:05.000Z',
          durationMs: 1800,
        },
        {
          name: 'seed',
          status: 'succeeded',
          startedAt: '2026-09-13T10:00:07.000Z',
          durationMs: 1600,
        },
        {
          name: 'population-check',
          status: 'succeeded',
          startedAt: '2026-09-13T10:00:09.000Z',
          durationMs: 100,
        },
        {
          name: 'candidate-migrations',
          status: 'failed',
          startedAt: '2026-09-13T10:00:09.000Z',
          durationMs: 1600,
          detail: 'local only',
        },
      ],
      populatedTables: [{ table: 'public.User', populated: true }],
      migrationFailure: { migration: '20260913_add_age', sqlState: '23502', message: 'local only' },
      cleanup: { status: 'succeeded', leftovers: [] },
    },
  };
}
