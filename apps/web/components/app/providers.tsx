'use client';

import { MotionConfig } from 'motion/react';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

/** Motion honours the reduced-motion preference; tooltips share one delay; toasts sit bottom right. */
export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 520, damping: 40 }}>
      <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
        {children}
        <Toaster position="bottom-right" gap={8} visibleToasts={3} />
      </Tooltip.Provider>
    </MotionConfig>
  );
}
