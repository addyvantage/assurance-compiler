import type { AssuranceState, Verdict } from '@assurance-compiler/core';
import type { SyncState } from '@/lib/runs';

const STATE_TONE: Record<AssuranceState | 'NONE', string> = {
  PROVEN: 'proven',
  FAILED: 'failed',
  NOT_PROVEN: 'caution',
  MISSING: 'caution',
  NOT_APPLICABLE: '',
  NONE: '',
};

const STATE_LABEL: Record<AssuranceState | 'NONE', string> = {
  PROVEN: 'Proven',
  FAILED: 'Failed',
  NOT_PROVEN: 'Not proven',
  MISSING: 'Missing',
  NOT_APPLICABLE: 'Not applicable',
  NONE: 'Nothing evaluated',
};

export function StateChip({ state }: { readonly state: AssuranceState | 'NONE' }) {
  return <span className={`chip ${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>;
}

const VERDICT_TONE: Record<Verdict, string> = {
  COMPLETE: 'proven',
  FAILED: 'failed',
  INCOMPLETE: 'caution',
};

export function VerdictChip({ verdict }: { readonly verdict: Verdict }) {
  return <span className={`chip ${VERDICT_TONE[verdict]}`}>{verdict}</span>;
}

export function verdictTone(verdict: Verdict | null): string {
  return verdict === null ? 'accent' : VERDICT_TONE[verdict];
}

const SYNC_LABEL: Record<SyncState, string> = {
  live: 'Running',
  stale: 'No update from the CLI',
  reported: 'Reported',
};

/** Synchronization state names what the server has heard, never the migration's outcome. */
export function SyncChip({ state }: { readonly state: SyncState }) {
  const tone = state === 'live' ? 'accent live' : state === 'stale' ? 'caution' : '';
  return (
    <span className={`chip ${tone}`} title="Synchronization state, not the assessment">
      {SYNC_LABEL[state]}
    </span>
  );
}
