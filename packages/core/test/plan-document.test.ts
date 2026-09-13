import { describe, expect, it } from 'vitest';
import { toPlanDocument, type AssurancePlan, type RequirementInstance } from '../src/index.js';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const MERGE_BASE = 'c'.repeat(40);

const missingRequirement: RequirementInstance = {
  requirement: 'NONEMPTY_MIGRATION_EXECUTION',
  triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
  assessment: { state: 'MISSING' },
};

function planWith(requirement: RequirementInstance): AssurancePlan {
  return {
    changeSet: {
      base: { ref: 'main', commit: BASE },
      head: { ref: 'HEAD', commit: HEAD },
      mergeBase: MERGE_BASE,
      files: [
        {
          status: 'renamed',
          previousPath: 'prisma/migrations/1/up.sql',
          path: 'prisma/migrations/1/migration.sql',
        },
        { status: 'modified', path: 'prisma/schema.prisma' },
        { status: 'added', path: 'src/users/service.ts' },
      ],
    },
    detectors: ['prisma'],
    changes: [
      {
        surface: 'DATABASE_SCHEMA_CHANGE',
        detector: 'prisma',
        files: [
          {
            status: 'renamed',
            previousPath: 'prisma/migrations/1/up.sql',
            path: 'prisma/migrations/1/migration.sql',
          },
          { status: 'modified', path: 'prisma/schema.prisma' },
        ],
      },
    ],
    requirements: [requirement],
  };
}

describe('toPlanDocument', () => {
  it('serializes a plan as a version 1 document', () => {
    expect(toPlanDocument(planWith(missingRequirement))).toEqual({
      version: 1,
      base: { ref: 'main', commit: BASE },
      head: { ref: 'HEAD', commit: HEAD },
      mergeBase: MERGE_BASE,
      detectors: ['prisma'],
      changes: [
        {
          surface: 'DATABASE_SCHEMA_CHANGE',
          detector: 'prisma',
          files: [
            {
              path: 'prisma/migrations/1/migration.sql',
              status: 'renamed',
              previousPath: 'prisma/migrations/1/up.sql',
            },
            { path: 'prisma/schema.prisma', status: 'modified' },
          ],
        },
      ],
      requirements: [
        {
          id: 'NONEMPTY_MIGRATION_EXECUTION',
          state: 'MISSING',
          triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
          evidence: [],
        },
      ],
      verdict: 'INCOMPLETE',
    });
  });

  it('keeps a stable key order', () => {
    const document = toPlanDocument(planWith(missingRequirement));

    expect(Object.keys(document)).toEqual([
      'version',
      'base',
      'head',
      'mergeBase',
      'detectors',
      'changes',
      'requirements',
      'verdict',
    ]);
    expect(Object.keys(document.requirements[0] ?? {})).toEqual([
      'id',
      'state',
      'triggeredBy',
      'evidence',
    ]);
  });

  it('includes evidence and derives the verdict from it', () => {
    const document = toPlanDocument(
      planWith({
        ...missingRequirement,
        assessment: {
          state: 'PROVEN',
          evidence: [
            {
              requirement: 'NONEMPTY_MIGRATION_EXECUTION',
              provider: 'migration-executor',
              commit: HEAD,
              outcome: 'SATISFIES',
              summary: 'Applied 1 migration to a database with 1,000 rows.',
            },
          ],
        },
      }),
    );

    expect(document.requirements[0]?.evidence).toEqual([
      {
        provider: 'migration-executor',
        commit: HEAD,
        outcome: 'SATISFIES',
        summary: 'Applied 1 migration to a database with 1,000 rows.',
      },
    ]);
    expect(document.verdict).toBe('COMPLETE');
  });

  it('states why a requirement is not applicable, and only then', () => {
    const notApplicable = toPlanDocument(
      planWith({
        ...missingRequirement,
        assessment: { state: 'NOT_APPLICABLE', reason: 'The migration only creates new tables.' },
      }),
    );
    const missing = toPlanDocument(planWith(missingRequirement));

    expect(notApplicable.requirements[0]?.reason).toBe('The migration only creates new tables.');
    expect(missing.requirements[0]).not.toHaveProperty('reason');
  });

  it('round-trips through JSON without loss', () => {
    const document = toPlanDocument(planWith(missingRequirement));

    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
  });
});
