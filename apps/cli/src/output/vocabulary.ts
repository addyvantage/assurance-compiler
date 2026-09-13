import type { AssuranceState, Verdict } from '@assurance-compiler/core';
import type { Tone } from './theme.js';

export const stateTone: Readonly<Record<AssuranceState, Tone>> = {
  PROVEN: 'positive',
  FAILED: 'negative',
  NOT_PROVEN: 'caution',
  MISSING: 'caution',
  NOT_APPLICABLE: 'muted',
};

export const stateCountLabel: Readonly<Record<AssuranceState, string>> = {
  PROVEN: 'proven',
  FAILED: 'failed',
  NOT_PROVEN: 'not proven',
  MISSING: 'missing',
  NOT_APPLICABLE: 'not applicable',
};

/** What each state means for the requirement it is shown beside. The other states carry a reason. */
export const stateExplanation: Readonly<Record<'PROVEN' | 'FAILED' | 'MISSING', string>> = {
  PROVEN: 'Evidence satisfies this requirement.',
  FAILED: 'Evidence shows this requirement is violated.',
  MISSING: 'No evidence provider is available for this requirement.',
};

export const verdictTone: Readonly<Record<Verdict, Tone>> = {
  COMPLETE: 'positive',
  INCOMPLETE: 'caution',
  FAILED: 'negative',
};
