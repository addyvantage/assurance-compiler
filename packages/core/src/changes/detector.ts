import { compareOrdinal } from '../shared/ordering.js';
import type { ChangedFile } from './changed-file.js';
import type { ChangeDetection } from './change-detection.js';
import { compareChangeSurfaces } from './change-surface.js';

/**
 * Classifies changed files into change surfaces.
 *
 * Detectors are ecosystem-specific (Prisma, OpenAPI, ...) and must be deterministic:
 * the same files always produce the same detections, in the same order.
 */
export interface ChangeDetector {
  /** Stable identifier recorded on each detection and in plan output, such as `prisma`. */
  readonly id: string;
  detect(files: readonly ChangedFile[]): readonly ChangeDetection[];
}

/** Runs every detector and returns their detections in canonical order. */
export function detectChanges(
  files: readonly ChangedFile[],
  detectors: readonly ChangeDetector[],
): readonly ChangeDetection[] {
  return detectors
    .flatMap((detector) => detector.detect(files))
    .sort(
      (a, b) =>
        compareChangeSurfaces(a.surface, b.surface) || compareOrdinal(a.detector, b.detector),
    );
}
