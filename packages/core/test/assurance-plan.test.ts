import { describe, expect, it } from 'vitest';
import {
  buildAssurancePlan,
  planVerdict,
  type ChangedFile,
  type ChangeDetector,
  type ChangeSet,
} from '../src/index.js';

const schemaFile: ChangedFile = { status: 'modified', path: 'db/schema.sql' };
const codeFile: ChangedFile = { status: 'modified', path: 'src/index.ts' };

const changeSet: ChangeSet = {
  base: { ref: 'main', commit: 'a'.repeat(40) },
  head: { ref: 'HEAD', commit: 'b'.repeat(40) },
  mergeBase: 'c'.repeat(40),
  files: [schemaFile, codeFile],
};

/** A detector that reports a database schema change whenever `db/schema.sql` changed. */
function schemaDetector(id: string): ChangeDetector {
  return {
    id,
    detect: (files) =>
      files.some((file) => file.path === schemaFile.path)
        ? [{ surface: 'DATABASE_SCHEMA_CHANGE', detector: id, files: [schemaFile] }]
        : [],
  };
}

const silentDetector: ChangeDetector = { id: 'silent', detect: () => [] };

describe('buildAssurancePlan', () => {
  it('connects detected changes to the requirements they impose', () => {
    const plan = buildAssurancePlan(changeSet, [schemaDetector('sql')]);

    expect(plan.changes).toEqual([
      { surface: 'DATABASE_SCHEMA_CHANGE', detector: 'sql', files: [schemaFile] },
    ]);
    expect(plan.requirements).toEqual([
      {
        requirement: 'NONEMPTY_MIGRATION_EXECUTION',
        triggeredBy: ['DATABASE_SCHEMA_CHANGE'],
        assessment: { state: 'MISSING' },
      },
    ]);
    expect(planVerdict(plan)).toBe('INCOMPLETE');
  });

  it('records every detector that examined the change, including those that found nothing', () => {
    const plan = buildAssurancePlan(changeSet, [silentDetector, schemaDetector('sql')]);

    expect(plan.detectors).toEqual(['silent', 'sql']);
  });

  it('orders detections deterministically, independent of detector order', () => {
    const forwards = buildAssurancePlan(changeSet, [schemaDetector('a'), schemaDetector('b')]);
    const backwards = buildAssurancePlan(changeSet, [schemaDetector('b'), schemaDetector('a')]);

    expect(backwards.changes).toEqual(forwards.changes);
    expect(forwards.changes.map((detection) => detection.detector)).toEqual(['a', 'b']);
  });

  it('produces an empty plan when nothing assurance-sensitive is detected', () => {
    const plan = buildAssurancePlan(changeSet, [silentDetector]);

    expect(plan.changes).toEqual([]);
    expect(plan.requirements).toEqual([]);
    expect(plan.changeSet).toBe(changeSet);
  });
});
