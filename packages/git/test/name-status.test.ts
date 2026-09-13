import { describe, expect, it } from 'vitest';
import { parseNameStatus, UnexpectedNameStatusError } from '../src/name-status.js';

/** Builds `git diff-tree -z --name-status` output from records. */
const zOutput = (...fields: string[]): string => fields.map((field) => `${field}\0`).join('');

describe('parseNameStatus', () => {
  it('parses added, modified, deleted and renamed files', () => {
    const output = zOutput(
      'A',
      'src/added.ts',
      'M',
      'src/modified.ts',
      'D',
      'src/deleted.ts',
      'R087',
      'docs/guide.md',
      'docs/handbook.md',
    );

    expect(parseNameStatus(output)).toEqual([
      { status: 'added', path: 'src/added.ts' },
      { status: 'modified', path: 'src/modified.ts' },
      { status: 'deleted', path: 'src/deleted.ts' },
      { status: 'renamed', previousPath: 'docs/guide.md', path: 'docs/handbook.md' },
    ]);
  });

  it('reports a type change as modified and a copy as added', () => {
    const output = zOutput(
      'T',
      'bin/tool',
      'C100',
      'template.sql',
      'prisma/migrations/2/migration.sql',
    );

    expect(parseNameStatus(output)).toEqual([
      { status: 'modified', path: 'bin/tool' },
      { status: 'added', path: 'prisma/migrations/2/migration.sql' },
    ]);
  });

  it('keeps paths verbatim, including spaces, tabs and non-ASCII characters', () => {
    const output = zOutput('M', 'docs/release notes\tdraft/überblick.md');

    expect(parseNameStatus(output)).toEqual([
      { status: 'modified', path: 'docs/release notes\tdraft/überblick.md' },
    ]);
  });

  it('returns no files for empty output', () => {
    expect(parseNameStatus('')).toEqual([]);
  });

  it('rejects statuses it does not understand', () => {
    expect(() => parseNameStatus(zOutput('X', 'unknown'))).toThrow(UnexpectedNameStatusError);
  });

  it('rejects a truncated record', () => {
    expect(() => parseNameStatus(zOutput('R100', 'only-the-source.md'))).toThrow(
      UnexpectedNameStatusError,
    );
  });
});
