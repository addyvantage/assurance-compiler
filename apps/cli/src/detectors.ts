import type { ChangeDetector } from '@assurance-compiler/core';
import { prismaDetector } from '@assurance-compiler/prisma';

/** The detectors the CLI runs. A change is only classified as far as these can see. */
export const detectors: readonly ChangeDetector[] = [prismaDetector];
