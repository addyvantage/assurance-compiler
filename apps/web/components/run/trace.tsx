'use client';

import type { CloudStage } from '@assurance-compiler/sync';
import { useEffect, useState } from 'react';
import { STAGE_LABELS } from '@/lib/explain';
import { formatMs } from '@/lib/format';
import { cn } from '../ui/cn';
import { StatusIcon } from '../ui/status';
import { Tip } from '../ui/tooltip';

/** A 1, 2 or 5 step that splits the span into at most six intervals, at any scale. */
function niceStep(span: number): number {
  const rough = span / 6;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10]
    .map((factor) => factor * magnitude)
    .find((candidate) => candidate >= rough);
  return step ?? 10 * magnitude;
}

const BAR: Record<CloudStage['status'], string> = {
  pending: '',
  running:
    'bg-[linear-gradient(90deg,var(--accent)_20%,color-mix(in_oklab,var(--accent),white_38%)_50%,var(--accent)_80%)] bg-[length:200%_100%] animate-[shimmer_1.3s_linear_infinite]',
  succeeded: 'bg-bar',
  failed: 'bg-bad',
  cancelled: 'bg-warn',
};

const STATUS_TEXT: Record<CloudStage['status'], string> = {
  pending: 'Not run',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const COLUMNS =
  'grid grid-cols-[minmax(128px,176px)_minmax(0,1fr)_64px] gap-x-4 sm:grid-cols-[196px_minmax(0,1fr)_76px]';

/** The current time, ticking only while something is running. `null` until mounted. */
function useNow(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 200);
    return () => {
      clearInterval(timer);
    };
  }, [active]);
  return now;
}

function tickLabel(ms: number, step: number): string {
  if (ms === 0) return '0';
  if (step < 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (step < 60_000) return `${String(Math.round(ms / 1000))}s`;
  if (step < 3_600_000) return `${String(Math.round(ms / 60_000))}m`;
  return `${String(Math.round((ms / 3_600_000) * 10) / 10)}h`;
}

/**
 * A waterfall of the stages in the order they ran, on one time axis. Each row also states its
 * status and duration as text, so nothing depends on colour or on hovering.
 */
export function ExecutionTrace({
  stages,
  live = false,
  framed = true,
}: {
  readonly stages: readonly CloudStage[];
  readonly live?: boolean;
  /** False when the trace already sits inside a card. */
  readonly framed?: boolean;
}) {
  const now = useNow(live && stages.some((stage) => stage.status === 'running'));
  const starts = stages.flatMap((stage) =>
    stage.startedAt === undefined ? [] : [Date.parse(stage.startedAt)],
  );
  const origin = starts.length === 0 ? 0 : Math.min(...starts);
  // ponytail: a running bar measures the browser clock against the CLI's start time, so clock
  // skew between the two machines lengthens or shortens it; it never changes a status.
  const spans = stages.map((stage) => {
    if (stage.startedAt === undefined) return null;
    const start = Date.parse(stage.startedAt);
    const duration =
      stage.durationMs ??
      (stage.status === 'running' && now !== null ? Math.max(0, now - start) : 0);
    return { offset: start - origin, duration };
  });
  const end = Math.max(
    0,
    ...spans.map((span) => (span === null ? 0 : span.offset + span.duration)),
  );
  const span = Math.max(end, 1000);
  const step = niceStep(span);
  const max = Math.ceil(span / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step);
  const at = (ms: number) => `${String((ms / max) * 100)}%`;

  return (
    <div
      role="table"
      aria-label="Execution trace"
      className={cn(
        'overflow-hidden',
        framed && 'rounded-lg border border-line bg-raised shadow-raised',
      )}
    >
      <div role="rowgroup">
        {stages.map((stage, index) => {
          const timing = spans[index] ?? null;
          const label = STAGE_LABELS[stage.name];
          const emphasis = stage.status === 'failed' || stage.status === 'cancelled';
          return (
            <div
              role="row"
              key={stage.name}
              className={cn(
                COLUMNS,
                'items-center border-b border-line px-4 last:border-b-0',
                stage.status === 'failed' && 'bg-bad-soft',
              )}
            >
              <div role="rowheader" className="flex h-11 min-w-0 items-center gap-2.5">
                <StatusIcon status={stage.status} size={15} />
                <span
                  className={cn(
                    'truncate text-sm',
                    stage.status === 'pending' ? 'text-ink-3' : 'text-ink',
                    emphasis && 'font-medium',
                  )}
                >
                  {label}
                </span>
                <span className="sr-only">
                  {`, ${STATUS_TEXT[stage.status]}`}
                  {timing === null ? '' : `, started ${formatMs(timing.offset)} into the run`}
                </span>
              </div>
              <Tip
                content={
                  <span className="grid gap-0.5">
                    <span className="font-medium">
                      {label}: {STATUS_TEXT[stage.status]}
                    </span>
                    {timing === null ? (
                      <span>This stage did not run.</span>
                    ) : (
                      <span className="font-mono text-2xs">
                        +{formatMs(timing.offset)} start, {formatMs(timing.duration)}
                        {stage.status === 'running' ? ' so far' : ''}
                      </span>
                    )}
                  </span>
                }
              >
                <div role="cell" className="relative h-11">
                  {ticks.map((tick) => (
                    <span
                      key={tick}
                      className="absolute inset-y-0 w-px bg-line"
                      style={{ left: at(tick) }}
                    />
                  ))}
                  {timing === null ? null : (
                    <span
                      className="absolute inset-y-0 flex items-center transition-[left,width] duration-200 ease-linear"
                      style={{ left: at(timing.offset), width: `max(${at(timing.duration)}, 3px)` }}
                    >
                      <span className={cn('h-2 w-full rounded-[3px]', BAR[stage.status])} />
                    </span>
                  )}
                </div>
              </Tip>
              <div
                role="cell"
                className={cn(
                  'text-right font-mono text-xs tabular-nums',
                  stage.status === 'running' ? 'text-accent-ink' : 'text-ink-2',
                  stage.status === 'pending' && 'font-sans text-ink-3',
                )}
              >
                {timing === null ? 'Not run' : formatMs(timing.duration)}
              </div>
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className={cn(COLUMNS, 'border-t border-line bg-sunken px-4 py-1.5')}>
        <span className="text-2xs text-ink-3">Time since start</span>
        <div className="relative h-4">
          {ticks.map((tick, index) => (
            <span
              key={tick}
              className={cn(
                'absolute top-0 font-mono text-2xs text-ink-3 tabular-nums',
                index === 0
                  ? 'translate-x-0'
                  : index === ticks.length - 1
                    ? '-translate-x-full'
                    : '-translate-x-1/2',
              )}
              style={{ left: at(tick) }}
            >
              {tickLabel(tick, step)}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}
