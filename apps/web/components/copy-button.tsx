'use client';

import { useEffect, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

/** Copies text and says so, in a live region, for a moment. A failure is announced too. */
export function CopyButton({ text, label }: { readonly text: string; readonly label: string }) {
  const [state, setState] = useState<CopyState>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => {
      setState('idle');
    }, 2200);
    return () => {
      clearTimeout(timer);
    };
  }, [state]);
  const announcement =
    state === 'copied'
      ? `Copied ${label}`
      : state === 'failed'
        ? `Could not copy ${label}. Select the value and copy it manually.`
        : '';
  return (
    <>
      <button
        type="button"
        className="copy"
        data-copied={state === 'copied'}
        aria-label={state === 'idle' ? `Copy ${label}` : announcement}
        title={state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : 'Copy'}
        onClick={async () => {
          setState((await copy(text)) ? 'copied' : 'failed');
        }}
      >
        {state === 'copied' ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2 6.5l2.5 2.5L10 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect
              x="4"
              y="4"
              width="7"
              height="7"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M8 4V2.5A1.5 1.5 0 006.5 1h-4A1.5 1.5 0 001 2.5v4A1.5 1.5 0 002.5 8H4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}

/** Resolves false when the clipboard is unavailable, denied, or left pending by a prompt. */
async function copy(text: string): Promise<boolean> {
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

/** A long identifier: short form, full value on expand, and a copy control. */
export function Identifier({
  value,
  shortLength = 7,
  label,
}: {
  readonly value: string;
  readonly shortLength?: number;
  readonly label: string;
}) {
  return (
    <div className="ident">
      <details>
        <summary title={value}>
          <code>{value.slice(0, shortLength)}</code>
          <span className="sr-only">Show full {label}</span>
        </summary>
        <code>{value}</code>
      </details>
      <CopyButton text={value} label={label} />
    </div>
  );
}

export function Command({ text }: { readonly text: string }) {
  return (
    <div className="command">
      <code>{text}</code>
      <CopyButton text={text} label="command" />
    </div>
  );
}
