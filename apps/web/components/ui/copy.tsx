'use client';

import { Check, Copy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from './cn';
import { Tip } from './tooltip';

/** Resolves false when the clipboard is unavailable, denied, or left pending by a prompt. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('timeout'));
        }, 800);
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label,
  className,
}: {
  readonly value: string;
  readonly label: string;
  readonly className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1600);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      onClick={async () => {
        if (await writeClipboard(value)) {
          setCopied(true);
          toast.success(`Copied ${label}`);
        } else {
          toast.error(`Could not copy ${label}`, {
            description: 'Select the value and copy it manually.',
          });
        }
      }}
      className={cn(
        'relative inline-grid size-6 shrink-0 place-items-center rounded-[5px] text-ink-3 transition-colors hover:bg-hover hover:text-ink',
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={copied ? 'done' : 'copy'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className={cn('col-start-1 row-start-1', copied && 'text-good')}
        >
          {copied ? (
            <Check className="size-3.5" strokeWidth={2.4} />
          ) : (
            <Copy className="size-3.5" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** A long identifier: its short form, the full value on hover or focus, and copy. */
export function Identifier({
  value,
  label,
  chars = 7,
  className,
}: {
  readonly value: string;
  readonly label: string;
  readonly chars?: number;
  readonly className?: string;
}) {
  const short = value.length > chars ? value.slice(0, chars) : value;
  return (
    <span className={cn('inline-flex max-w-full items-center gap-0.5 align-middle', className)}>
      <Tip content={<span className="font-mono break-all">{value}</span>}>
        <span
          tabIndex={0}
          className="truncate rounded-[4px] px-1 -mx-1 font-mono text-[12.5px] text-ink outline-offset-1 hover:bg-hover"
        >
          {short}
          {short !== value ? <span className="sr-only">, full value {value}</span> : null}
        </span>
      </Tip>
      <CopyButton value={value} label={label} />
    </span>
  );
}

/** A command to run in a terminal, with its own copy control. */
export function CommandBlock({
  command,
  className,
}: {
  readonly command: string;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'group flex min-w-0 items-center gap-2 rounded-lg border border-line bg-sunken py-1.5 pr-1.5 pl-3',
        className,
      )}
    >
      <span aria-hidden="true" className="font-mono text-[12.5px] text-ink-3 select-none">
        $
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto py-0.5 text-[12.5px] whitespace-pre text-ink [scrollbar-width:none]">
        {command}
      </code>
      <CopyButton value={command} label="command" />
    </div>
  );
}
