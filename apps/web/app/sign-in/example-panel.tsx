import type { CloudStage } from '@assurance-compiler/sync';
import { ExecutionTrace } from '@/components/run/trace';
import { StatePill } from '@/components/ui/status';

/** A fixed, labelled example of a failed run. It never animates progress. */
const EXAMPLE: CloudStage[] = [
  {
    name: 'environment',
    status: 'succeeded',
    startedAt: '2026-09-13T10:00:00.000Z',
    durationMs: 1620,
  },
  {
    name: 'baseline-migrations',
    status: 'succeeded',
    startedAt: '2026-09-13T10:00:01.620Z',
    durationMs: 1880,
  },
  { name: 'seed', status: 'succeeded', startedAt: '2026-09-13T10:00:03.500Z', durationMs: 790 },
  {
    name: 'population-check',
    status: 'succeeded',
    startedAt: '2026-09-13T10:00:04.290Z',
    durationMs: 40,
  },
  {
    name: 'candidate-migrations',
    status: 'failed',
    startedAt: '2026-09-13T10:00:04.330Z',
    durationMs: 610,
  },
];

export function ExamplePanel() {
  return (
    <div className="w-full max-w-[580px] animate-[rise_600ms_var(--ease-out-quint)_140ms_both]">
      <h2 className="max-w-[24ch] text-[30px] leading-[1.12] font-semibold tracking-[-0.032em] text-ink">
        Know exactly what a migration check established.
      </h2>
      <p className="mt-3.5 max-w-[52ch] text-base text-ink-2">
        Candidate migrations run against a seeded copy of your merge base. Every run records what
        that proves, and what it never does.
      </p>
      <figure className="mt-9 overflow-hidden rounded-xl border border-line bg-raised shadow-overlay">
        <div className="px-5 pt-4.5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <StatePill state="FAILED" tone="soft" />
            <span className="rounded-full border border-line px-2 py-px text-2xs text-ink-3">
              Example run
            </span>
          </div>
          <p className="mt-3 text-base font-semibold tracking-[-0.015em] text-ink">
            A candidate migration failed on populated data
          </p>
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-mono text-[12.5px]">20260913_add_age</span> raised SQLSTATE 23502
            against rows seeded at the merge base.
          </p>
        </div>
        <div className="border-t border-line">
          <ExecutionTrace stages={EXAMPLE} framed={false} />
        </div>
        <figcaption className="sr-only">
          An example execution trace in which the candidate migration stage failed.
        </figcaption>
      </figure>
    </div>
  );
}
