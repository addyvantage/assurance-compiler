# Fixtures

Each fixture describes one change to a tiny Prisma project as two complete file trees:

- `base/` is the repository on `main`.
- `head/` is the repository after the change, committed on a feature branch.

Tests materialize a fixture into a temporary Git repository (see
`test/support/fixture-repository.ts`), so file additions, modifications,
deletions and renames all come from real Git history.

| Fixture                              | Change                                           |
| ------------------------------------ | ------------------------------------------------ |
| `prisma-no-change`                   | Application code only                            |
| `prisma-schema-change`               | `prisma/schema.prisma`                           |
| `prisma-migration-change`            | A new migration under `prisma/migrations/`       |
| `prisma-schema-and-migration-change` | Schema, a new migration, and application code    |
| `prisma-migration-unsafe`            | Adds a required column with no default           |
| `prisma-migration-corrected`         | Adds the same column with a default              |

The two migration fixtures share one baseline with seed files in `base/prisma/`:
`seed.sql` inserts rows, `seed-empty.sql` inserts none, and `seed-invalid.sql` violates the
baseline schema. They drive the real PostgreSQL integration tests and the demonstration in the
main README.
