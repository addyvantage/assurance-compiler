import type { ChangedFile } from '@assurance-compiler/core';
import { describe, expect, it } from 'vitest';
import { prismaDetector } from '../src/index.js';

const added = (path: string): ChangedFile => ({ status: 'added', path });
const modified = (path: string): ChangedFile => ({ status: 'modified', path });
const deleted = (path: string): ChangedFile => ({ status: 'deleted', path });
const renamed = (previousPath: string, path: string): ChangedFile => ({
  status: 'renamed',
  previousPath,
  path,
});

describe('prismaDetector', () => {
  it('detects a change to prisma/schema.prisma', () => {
    expect(prismaDetector.detect([modified('prisma/schema.prisma')])).toEqual([
      {
        surface: 'DATABASE_SCHEMA_CHANGE',
        detector: 'prisma',
        files: [modified('prisma/schema.prisma')],
      },
    ]);
  });

  it('detects a new migration SQL file', () => {
    const migration = added('prisma/migrations/20260913_add_age/migration.sql');

    expect(prismaDetector.detect([migration])).toEqual([
      { surface: 'DATABASE_SCHEMA_CHANGE', detector: 'prisma', files: [migration] },
    ]);
  });

  it('produces a single detection carrying every matching file, ordered by path', () => {
    const schema = modified('prisma/schema.prisma');
    const migration = added('prisma/migrations/20260913_add_age/migration.sql');
    const code = modified('src/users/service.ts');

    expect(prismaDetector.detect([schema, code, migration])).toEqual([
      { surface: 'DATABASE_SCHEMA_CHANGE', detector: 'prisma', files: [migration, schema] },
    ]);
  });

  it('ignores unrelated TypeScript changes', () => {
    expect(prismaDetector.detect([modified('src/users/service.ts')])).toEqual([]);
  });

  it('ignores an empty change', () => {
    expect(prismaDetector.detect([])).toEqual([]);
  });

  it.each([
    'docs/prisma/schema.prisma.md',
    'examples/prisma-copy/schema.prisma',
    'packages/db/prisma/schema.prisma',
    'schema.prisma',
    'prisma/schema.prisma.bak',
    'prisma/other.prisma',
    'Prisma/schema.prisma',
    'prisma/migrations',
    'prisma/migrations-archive/001/migration.sql',
    'src/prisma/migrations/001/migration.sql',
  ])('does not mistake %s for a Prisma schema surface', (path) => {
    expect(prismaDetector.detect([modified(path)])).toEqual([]);
  });

  it.each<[string, ChangedFile]>([
    ['a deleted migration', deleted('prisma/migrations/20260801_init/migration.sql')],
    ['a changed migration lock', modified('prisma/migrations/migration_lock.toml')],
    ['a schema moved away', renamed('prisma/schema.prisma', 'db/schema.prisma')],
    [
      'a file moved into migrations',
      renamed('sql/add_age.sql', 'prisma/migrations/2/migration.sql'),
    ],
  ])('detects %s', (_description, file) => {
    expect(prismaDetector.detect([file])).toEqual([
      { surface: 'DATABASE_SCHEMA_CHANGE', detector: 'prisma', files: [file] },
    ]);
  });

  it('does not reorder or modify its input', () => {
    const files = [modified('prisma/schema.prisma'), added('prisma/migrations/1/migration.sql')];
    const snapshot = structuredClone(files);

    prismaDetector.detect(files);

    expect(files).toEqual(snapshot);
  });
});
