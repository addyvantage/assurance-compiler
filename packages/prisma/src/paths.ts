/** Prisma's default schema location, relative to the repository root. */
export const PRISMA_SCHEMA_PATH = 'prisma/schema.prisma';

/** Prisma Migrate's default migrations directory, relative to the repository root. */
export const PRISMA_MIGRATIONS_DIRECTORY = 'prisma/migrations/';

export function isPrismaSchemaPath(path: string): boolean {
  return path === PRISMA_SCHEMA_PATH;
}

/** True for any file inside the migrations directory, including `migration_lock.toml`. */
export function isPrismaMigrationPath(path: string): boolean {
  return (
    path.startsWith(PRISMA_MIGRATIONS_DIRECTORY) && path.length > PRISMA_MIGRATIONS_DIRECTORY.length
  );
}
