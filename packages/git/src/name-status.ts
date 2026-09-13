import type { ChangedFile } from '@assurance-compiler/core';

/**
 * Parses the output of `git diff-tree -r -z --name-status`.
 *
 * With `-z`, every field is NUL-terminated and paths are emitted verbatim, so no
 * unquoting is needed. Renames and copies carry a similarity score (`R087`) followed by
 * the source and destination paths.
 *
 * Status mapping:
 * - `A` added, `D` deleted, `M` modified
 * - `T` (type change, e.g. file to symlink) is reported as modified
 * - `R` renamed
 * - `C` copied is reported as added: the destination is new and the source is unchanged
 *
 * Throws `UnexpectedNameStatusError` on anything else, rather than guessing.
 */
export function parseNameStatus(output: string): ChangedFile[] {
  const fields = output.split('\0');
  if (fields.at(-1) === '') fields.pop();

  const files: ChangedFile[] = [];
  let cursor = 0;
  const take = (): string => {
    const field = fields[cursor];
    if (field === undefined) throw new UnexpectedNameStatusError('output ended mid-record');
    cursor += 1;
    return field;
  };

  while (cursor < fields.length) {
    files.push(parseRecord(take(), take));
  }
  return files;
}

function parseRecord(status: string, take: () => string): ChangedFile {
  switch (status.charAt(0)) {
    case 'A':
      return { status: 'added', path: take() };
    case 'M':
    case 'T':
      return { status: 'modified', path: take() };
    case 'D':
      return { status: 'deleted', path: take() };
    case 'R': {
      const previousPath = take();
      return { status: 'renamed', previousPath, path: take() };
    }
    case 'C': {
      take();
      return { status: 'added', path: take() };
    }
    default:
      throw new UnexpectedNameStatusError(`unsupported status \`${status}\``);
  }
}

export class UnexpectedNameStatusError extends Error {
  override readonly name = 'UnexpectedNameStatusError';
}
