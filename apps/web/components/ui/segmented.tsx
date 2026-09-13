'use client';

import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
}

/**
 * A single choice among a few options, keyboard-operated like native radios: Tab reaches the
 * selected option and arrow keys move the selection. The thumb slides to the chosen option.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly className?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        const step = STEP[event.key];
        if (step === undefined) return;
        event.preventDefault();
        const index =
          (options.findIndex((o) => o.value === value) + step + options.length) % options.length;
        const next = options[index];
        if (next === undefined) return;
        onChange(next.value);
        event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
      }}
      className={cn(
        'inline-flex h-8 items-center gap-0.5 rounded-lg border border-line bg-sunken p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              'relative inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors [&_svg]:size-3.5',
              selected ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`segment-${id}`}
                className="absolute inset-0 rounded-md border border-line bg-raised shadow-raised"
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
