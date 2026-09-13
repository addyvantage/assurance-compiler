import type { Assessment, AssurancePlan } from '@assurance-compiler/core';
import { describe, expect, it } from 'vitest';
import { renderPlanText } from '../src/output/plan-text.js';
import { createTheme } from '../src/output/theme.js';

const HEAD = 'b'.repeat(40);

function planAssessedAs(assessment: Assessment): AssurancePlan {
  return {
    changeSet: {
      base: { ref: 'main', commit: 'a'.repeat(40) },
      head: { ref: 'HEAD', commit: HEAD },
      mergeBase: 'a'.repeat(40),
      files: [
        {
          status: 'renamed',
          previousPath: 'prisma/migrations/1/up.sql',
          path: 'prisma/migrations/1/migration.sql',
        },
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
        ],
      },
    ],
    requirements: [
      {
        requirement: 'NONEMPTY_MIGRATION_EXECUTION',
        triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
        assessment,
      },
    ],
  };
}

const plain = { theme: createTheme(false), width: 72, uncommittedChanges: false };

describe('renderPlanText', () => {
  it('shows a renamed file with both of its paths', () => {
    const text = renderPlanText(planAssessedAs({ state: 'MISSING' }), plain);

    expect(text).toContain(
      '  renamed   prisma/migrations/1/up.sql → prisma/migrations/1/migration.sql\n',
    );
  });

  it('shows the evidence behind a PROVEN requirement', () => {
    const text = renderPlanText(
      planAssessedAs({
        state: 'PROVEN',
        evidence: [
          {
            requirement: 'NONEMPTY_MIGRATION_EXECUTION',
            provider: 'migration-executor',
            commit: HEAD,
            outcome: 'SATISFIES',
            summary: 'Applied 1 migration to 1,000 rows.',
          },
        ],
      }),
      plain,
    );

    expect(text).toContain('  PROVEN  Evidence satisfies this requirement.\n');
    expect(text).toContain(
      '  · migration-executor SATISFIES bbbbbbb\n    Applied 1 migration to 1,000 rows.\n',
    );
    expect(text).toContain('  1 requirement\n  1 proven\n\nVerdict: COMPLETE\n');
  });

  it('distinguishes a FAILED requirement from a missing one', () => {
    const text = renderPlanText(
      planAssessedAs({
        state: 'FAILED',
        evidence: [
          {
            requirement: 'NONEMPTY_MIGRATION_EXECUTION',
            provider: 'migration-executor',
            commit: HEAD,
            outcome: 'VIOLATES',
            summary: 'Column "age" cannot be NOT NULL: 12 rows are null.',
          },
        ],
      }),
      plain,
    );

    expect(text).toContain('  FAILED  Evidence shows this requirement is violated.\n');
    expect(text).toContain('  1 requirement\n  0 proven\n  1 failed\n\nVerdict: FAILED\n');
    expect(text).not.toContain('missing');
  });

  it('gives the reason a requirement does not apply', () => {
    const text = renderPlanText(
      planAssessedAs({ state: 'NOT_APPLICABLE', reason: 'The migration only creates new tables.' }),
      plain,
    );

    expect(text).toContain('  NOT_APPLICABLE  The migration only creates new tables.\n');
    expect(text).toContain('  0 proven\n  1 not applicable\n\nVerdict: COMPLETE\n');
  });

  it('fits rules and wrapped prose to the layout width', () => {
    const text = renderPlanText(planAssessedAs({ state: 'MISSING' }), { ...plain, width: 48 });
    const lines = text.split('\n');

    expect(lines[0]).toBe('─'.repeat(48));
    expect(lines.filter((line) => !line.includes('→')).every((line) => line.length <= 48)).toBe(
      true,
    );
  });

  it('uses colour only when the theme enables it', () => {
    const plan = planAssessedAs({ state: 'MISSING' });

    expect(renderPlanText(plan, plain)).not.toContain('[');
    expect(renderPlanText(plan, { ...plain, theme: createTheme(true) })).toContain('[');
  });
});
