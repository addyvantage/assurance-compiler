import type { NonEmptyReadonlyArray } from '../shared/non-empty.js';
import type { ChangedFile } from './changed-file.js';
import type { ChangeSurface } from './change-surface.js';

/** An observation that a change touches a change surface, and the files that show it. */
export interface ChangeDetection {
  readonly surface: ChangeSurface;
  /** Identifier of the detector that made the observation. */
  readonly detector: string;
  /** The files that caused the detection, ordered by path. */
  readonly files: NonEmptyReadonlyArray<ChangedFile>;
}
