'use client';

import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';

/** A short hint on hover or keyboard focus. Never the only way to reach a value. */
export function Tip({
  content,
  children,
  side = 'top',
}: {
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-w-[320px] rounded-md bg-ink px-2 py-1 text-xs text-panel shadow-overlay data-[state=closed]:animate-[fade-out_90ms_ease-in] data-[state=delayed-open]:animate-[pop-in_130ms_var(--ease-out-quint)] data-[state=instant-open]:animate-[fade-in_90ms_ease-out]"
        >
          {content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
