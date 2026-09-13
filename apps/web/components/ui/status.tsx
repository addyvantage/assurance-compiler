'use client';

import type { AssuranceState } from '@assurance-compiler/core';
import { AnimatePresence, motion } from 'motion/react';
import { STATE_KIND, STATE_LABEL, type StatusKind } from '@/lib/status-kind';
import { cn } from './cn';

const FILL: Partial<Record<StatusKind, string>> = {
  succeeded: 'var(--ink-2)',
  failed: 'var(--bad)',
  cancelled: 'var(--warn)',
  proven: 'var(--good)',
  'not-proven': 'var(--warn)',
};

/** Status glyph. A change of status cross-fades; the first render does not animate. */
export function StatusIcon({
  status,
  size = 16,
  className,
}: {
  readonly status: StatusKind;
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.svg
          key={status}
          width={size}
          height={size}
          viewBox="0 0 16 16"
          className="col-start-1 row-start-1 overflow-visible"
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.55, opacity: 0 }}
        >
          <Glyph status={status} />
        </motion.svg>
      </AnimatePresence>
    </span>
  );
}

const MARK = {
  fill: 'none',
  stroke: 'var(--raised)',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Glyph({ status }: { readonly status: StatusKind }) {
  const fill = FILL[status];
  switch (status) {
    case 'pending':
      return (
        <circle
          cx="8"
          cy="8"
          r="6.25"
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth="1.5"
          opacity="0.65"
        />
      );
    case 'running':
      return (
        <g>
          <circle
            cx="8"
            cy="8"
            r="6.25"
            fill="none"
            stroke="var(--accent-soft)"
            strokeWidth="1.75"
          />
          <path
            d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="origin-center animate-spin [animation-duration:900ms]"
          />
        </g>
      );
    case 'succeeded':
    case 'proven':
      return (
        <g>
          <circle cx="8" cy="8" r="7" fill={fill} />
          <motion.path
            d="M5 8.2l2 2 4-4.3"
            {...MARK}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut', delay: 0.05 }}
          />
        </g>
      );
    case 'failed':
      return (
        <g>
          <circle cx="8" cy="8" r="7" fill={fill} />
          <path d="M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6" {...MARK} />
        </g>
      );
    case 'cancelled':
      return (
        <g>
          <circle cx="8" cy="8" r="7" fill={fill} />
          <path d="M5.2 8h5.6" {...MARK} />
        </g>
      );
    case 'not-proven':
      return (
        <g>
          <circle cx="8" cy="8" r="7" fill={fill} />
          <path d="M8 4.7v3.9" {...MARK} />
          <circle cx="8" cy="11.2" r="1" fill="var(--raised)" />
        </g>
      );
    case 'missing':
      return (
        <circle
          cx="8"
          cy="8"
          r="6.25"
          fill="none"
          stroke="var(--warn)"
          strokeWidth="1.75"
          strokeDasharray="3.2 2.3"
        />
      );
    case 'stale':
      return (
        <g>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--warn)" strokeWidth="1.5" />
          <path
            d="M8 4.8V8l2.2 1.4"
            fill="none"
            stroke="var(--warn)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      );
    case 'nothing':
      return (
        <g>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" />
          <path d="M5.6 8h4.8" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
  }
}

const TONE: Record<AssuranceState | 'NONE', string> = {
  PROVEN: 'bg-good-soft text-good-ink',
  FAILED: 'bg-bad-soft text-bad-ink',
  NOT_PROVEN: 'bg-warn-soft text-warn-ink',
  MISSING: 'bg-warn-soft text-warn-ink',
  NOT_APPLICABLE: 'bg-hover text-ink-2',
  NONE: 'bg-hover text-ink-2',
};

/** Requirement state. `soft` adds a tinted ground for headers; `plain` is icon and label. */
export function StatePill({
  state,
  tone = 'plain',
  className,
}: {
  readonly state: AssuranceState | 'NONE';
  readonly tone?: 'plain' | 'soft';
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        tone === 'soft' ? cn('h-6 rounded-full pr-2.5 pl-1.5', TONE[state]) : 'text-ink-2',
        className,
      )}
    >
      <StatusIcon status={STATE_KIND[state]} size={14} />
      {STATE_LABEL[state]}
    </span>
  );
}

/**
 * What the server knows about a run without its final report. The live connection is shown
 * beside the trace, by the component that holds it. Never a statement about the migration.
 */
export function SyncBadge({ stale }: { readonly stale: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full pr-2.5 pl-1.5 text-xs font-medium',
        stale ? 'bg-warn-soft text-warn-ink' : 'bg-accent-soft text-accent-ink',
      )}
    >
      <StatusIcon status={stale ? 'stale' : 'running'} size={14} />
      {stale ? 'No recent update' : 'Awaiting report'}
    </span>
  );
}
