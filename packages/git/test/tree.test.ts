import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestRepository } from '../../../test/support/git-repository.js';
import { listTree, readBlob } from '../src/index.js';

describe('listTree', () => {
  it('lists entries with their mode, object ID and size', async () => {
    const repository = createTestRepository();
    repository.write('db fixtures/überblick seed.sql', 'SELECT 1;\n');
    const commit = repository.commit('fixture');

    const entries = await listTree(repository.root, commit, ['db fixtures']);

    expect(entries).toEqual([
      {
        mode: '100644',
        type: 'blob',
        oid: repository.git('rev-parse', `${commit}:db fixtures/überblick seed.sql`).trim(),
        size: 10,
        path: 'db fixtures/überblick seed.sql',
      },
    ]);
  });

  it('matches paths literally, never as glob patterns', async () => {
    const repository = createTestRepository();
    repository.write('prisma/seed.sql', 'SELECT 1;\n');
    repository.write('prisma/[seed].sql', 'SELECT 2;\n');
    const commit = repository.commit('fixtures');

    expect(await listTree(repository.root, commit, ['prisma/s*'])).toEqual([]);
    expect(
      (await listTree(repository.root, commit, ['prisma/[seed].sql'])).map((entry) => entry.path),
    ).toEqual(['prisma/[seed].sql']);
  });
});

describe('readBlob', () => {
  it('returns the exact committed bytes', async () => {
    const repository = createTestRepository();
    writeFileSync(join(repository.root, 'seed.sql'), 'SELECT 1;\r\n');
    const commit = repository.commit('crlf');

    const bytes = await readBlob(
      repository.root,
      repository.git('rev-parse', `${commit}:seed.sql`).trim(),
    );

    expect(new TextDecoder().decode(bytes)).toBe('SELECT 1;\r\n');
  });
});
