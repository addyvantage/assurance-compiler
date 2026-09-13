'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { CommandBlock } from '@/components/ui/copy';
import { StatusIcon } from '@/components/ui/status';

export interface SetupStep {
  readonly id: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly command: string;
  readonly done: boolean;
  readonly doneText: string;
}

/**
 * Setup driven by what the server actually knows: a CLI is authorized, this repository is
 * linked, a run has arrived. The first unfinished step opens; finished steps stay reachable.
 */
export function SetupSteps({ steps }: { readonly steps: readonly SetupStep[] }) {
  const current = steps.findIndex((step) => !step.done);
  const [open, setOpen] = useState(current);
  const done = steps.filter((step) => step.done).length;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-raised shadow-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {current === -1 ? 'Connected' : 'Connect a local checkout'}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Runs arrive only from a linked CLI, and only while a check runs with --sync.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((step) => (
              <span
                key={step.id}
                className={cn(
                  'h-1.5 w-6 rounded-full transition-colors',
                  step.done ? 'bg-ink-2' : 'bg-line-strong',
                )}
              />
            ))}
          </div>
          <span className="text-xs text-ink-2 tabular-nums">
            {done} of {steps.length} done
          </span>
        </div>
      </div>
      <ol>
        {steps.map((step, index) => {
          const expanded = open === index;
          return (
            <li key={step.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`step-${step.id}`}
                onClick={() => {
                  setOpen(expanded ? -1 : index);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors -outline-offset-2 hover:bg-hover"
              >
                {step.done ? (
                  <StatusIcon status="succeeded" size={20} />
                ) : (
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full text-2xs font-semibold tabular-nums',
                      index === current
                        ? 'border-[1.5px] border-accent text-accent-ink'
                        : 'border border-line-strong text-ink-3',
                    )}
                  >
                    {index + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      step.done ? 'text-ink-2' : 'text-ink',
                    )}
                  >
                    {step.title}
                  </span>
                  {step.done ? (
                    <span className="block truncate text-xs text-ink-3">{step.doneText}</span>
                  ) : null}
                </span>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-ink-3 transition-transform duration-200',
                    expanded && 'rotate-180',
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div
                    id={`step-${step.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-3 pr-4 pb-4 pl-12">
                      <p className="max-w-[64ch] text-sm text-ink-2">{step.description}</p>
                      <CommandBlock command={step.command} />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
