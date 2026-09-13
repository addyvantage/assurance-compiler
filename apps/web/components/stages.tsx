import type { CloudStage } from '@assurance-compiler/sync';
import { STAGE_LABELS } from '@/lib/explain';
import { duration, when } from '@/lib/format';

const STATUS_TEXT: Record<CloudStage['status'], string> = {
  pending: 'Not run',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const GLYPH: Record<CloudStage['status'], string> = {
  pending: '',
  running: '',
  succeeded: '✓',
  failed: '✕',
  cancelled: '–',
};

/** The five stages in fixed order. Rows never move; only their status changes. */
export function StageList({
  stages,
  live,
}: {
  readonly stages: readonly CloudStage[];
  readonly live: boolean;
}) {
  return (
    <ol className="stages" aria-label="Verification stages" aria-live={live ? 'polite' : 'off'}>
      {stages.map((stage) => (
        <li key={stage.name} className="stage" data-status={stage.status}>
          <span className="stage-glyph" data-status={stage.status} aria-hidden="true">
            {GLYPH[stage.status]}
          </span>
          <span className="stage-name">
            {STAGE_LABELS[stage.name]}
            <span className="sr-only">: {STATUS_TEXT[stage.status]}</span>
          </span>
          <span className="stage-meta">
            <span aria-hidden="true">{STATUS_TEXT[stage.status]}</span>
            {stage.startedAt !== undefined ? (
              <span title={stage.startedAt}>{when(stage.startedAt)}</span>
            ) : null}
            <span className="num">{duration(stage.durationMs)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
