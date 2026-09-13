import { compareOrdinal } from '../shared/ordering.js';

/**
 * A file that differs between two revisions.
 *
 * Paths are relative to the repository root and always use `/` as the separator.
 * A deleted file's `path` is the path it had before it was deleted.
 */
export type ChangedFile = AddedFile | ModifiedFile | DeletedFile | RenamedFile;

export type ChangedFileStatus = ChangedFile['status'];

export interface AddedFile {
  readonly status: 'added';
  readonly path: string;
}

export interface ModifiedFile {
  readonly status: 'modified';
  readonly path: string;
}

export interface DeletedFile {
  readonly status: 'deleted';
  readonly path: string;
}

export interface RenamedFile {
  readonly status: 'renamed';
  readonly path: string;
  readonly previousPath: string;
}

/**
 * Every path a change touches. A rename touches both the path it left and the path it
 * arrived at, so moving a file out of a sensitive location is itself a sensitive change.
 */
export function touchedPaths(file: ChangedFile): readonly string[] {
  return file.status === 'renamed' ? [file.previousPath, file.path] : [file.path];
}

export function compareChangedFiles(a: ChangedFile, b: ChangedFile): number {
  return compareOrdinal(a.path, b.path);
}
