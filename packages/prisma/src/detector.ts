import {
  compareChangedFiles,
  isNonEmpty,
  touchedPaths,
  type ChangedFile,
  type ChangeDetector,
} from '@assurance-compiler/core';
import { isPrismaMigrationPath, isPrismaSchemaPath } from './paths.js';

export const PRISMA_DETECTOR_ID = 'prisma';

/**
 * Detects changes to a Prisma project's database schema.
 *
 * Detection is path-based and anchored at the repository root: it recognizes
 * `prisma/schema.prisma` and anything under `prisma/migrations/`. The schema is not
 * parsed. However many matching files changed, the result is a single
 * `DATABASE_SCHEMA_CHANGE` carrying all of them.
 */
export const prismaDetector: ChangeDetector = {
  id: PRISMA_DETECTOR_ID,
  detect(files) {
    const schemaFiles = files.filter(touchesDatabaseSchema).sort(compareChangedFiles);
    if (!isNonEmpty(schemaFiles)) return [];
    return [
      { surface: 'DATABASE_SCHEMA_CHANGE', detector: PRISMA_DETECTOR_ID, files: schemaFiles },
    ];
  },
};

function touchesDatabaseSchema(file: ChangedFile): boolean {
  return touchedPaths(file).some((path) => isPrismaSchemaPath(path) || isPrismaMigrationPath(path));
}
