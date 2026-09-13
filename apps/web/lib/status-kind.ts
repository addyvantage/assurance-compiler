import type { AssuranceState, StageStatus, Verdict } from '@assurance-compiler/core';
import type { SyncState } from './runs';

/**
 * One icon vocabulary for execution, assurance and synchronization. Execution success is
 * neutral; only a proven requirement is green. Usable on the server and in the browser.
 */
export type StatusKind = StageStatus | 'proven' | 'not-proven' | 'missing' | 'nothing' | 'stale';

export const STATE_KIND: Record<AssuranceState | 'NONE', StatusKind> = {
  PROVEN: 'proven',
  FAILED: 'failed',
  NOT_PROVEN: 'not-proven',
  MISSING: 'missing',
  NOT_APPLICABLE: 'nothing',
  NONE: 'nothing',
};

export const STATE_LABEL: Record<AssuranceState | 'NONE', string> = {
  PROVEN: 'Proven',
  FAILED: 'Failed',
  NOT_PROVEN: 'Not proven',
  MISSING: 'Missing',
  NOT_APPLICABLE: 'Not applicable',
  NONE: 'Nothing evaluated',
};

/**
 * A run's status in lists. The engine calls a plan with nothing to verify COMPLETE, so a
 * COMPLETE verdict is green only when the requirement itself was proven.
 */
export function runStatus(
  verdict: Verdict | null,
  sync: SyncState,
  requirement: AssuranceState | 'NONE' | null,
): { readonly kind: StatusKind; readonly label: string } {
  if (verdict === null) {
    return sync === 'stale'
      ? { kind: 'stale', label: 'No recent update' }
      : { kind: 'running', label: 'Running' };
  }
  if (verdict === 'FAILED') return { kind: 'failed', label: 'Failed' };
  if (verdict === 'INCOMPLETE') return { kind: 'not-proven', label: 'Incomplete' };
  return requirement === 'PROVEN'
    ? { kind: 'proven', label: 'Proven' }
    : { kind: 'nothing', label: 'Nothing verified' };
}
