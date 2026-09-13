import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestRepository, type TestRepository } from './git-repository.js';

export type FixtureName =
  | 'prisma-no-change'
  | 'prisma-schema-change'
  | 'prisma-migration-change'
  | 'prisma-schema-and-migration-change'
  | 'prisma-migration-unsafe'
  | 'prisma-migration-corrected';

const FIXTURES = fileURLToPath(new URL('../../fixtures/', import.meta.url));

/**
 * Materializes a fixture as a real repository: `base/` committed on `main`, and `head/`
 * committed on a checked-out `feature` branch.
 */
export function createFixtureRepository(name: FixtureName): TestRepository {
  const repository = createTestRepository();

  cpSync(join(FIXTURES, name, 'base'), repository.root, { recursive: true });
  repository.commit(`${name}: base`);

  repository.git('switch', '--quiet', '--create', 'feature');
  repository.git('rm', '-r', '--quiet', '.');
  cpSync(join(FIXTURES, name, 'head'), repository.root, { recursive: true });
  repository.commit(`${name}: head`);

  return repository;
}
