import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  inferRequirements,
  type Assessment,
  type AssuranceState,
  type ChangeDetection,
} from '../src/index.js';

const schemaChange: ChangeDetection = {
  surface: 'DATABASE_SCHEMA_CHANGE',
  detector: 'prisma',
  files: [{ status: 'modified', path: 'prisma/schema.prisma' }],
};

describe('inferRequirements', () => {
  it('infers NONEMPTY_MIGRATION_EXECUTION from a DATABASE_SCHEMA_CHANGE', () => {
    expect(inferRequirements([schemaChange])).toEqual([
      {
        requirement: 'NONEMPTY_MIGRATION_EXECUTION',
        triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
        assessment: { state: 'MISSING' },
      },
    ]);
  });

  it('infers nothing when no change surface was detected', () => {
    expect(inferRequirements([])).toEqual([]);
  });

  it('infers a requirement once when several detections impose it', () => {
    const sameSurfaceFromAnotherDetector: ChangeDetection = { ...schemaChange, detector: 'other' };

    const requirements = inferRequirements([schemaChange, sameSurfaceFromAnotherDetector]);

    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.triggeredBy).toEqual(['DATABASE_SCHEMA_CHANGE']);
  });
});

describe('Assessment', () => {
  it('has a variant for every assurance state', () => {
    expectTypeOf<Assessment['state']>().toEqualTypeOf<AssuranceState>();
  });
});
