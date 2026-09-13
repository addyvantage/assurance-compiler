'use client';

import { X } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button } from './button';
import { cn } from './cn';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export const OVERLAY =
  'fixed inset-0 z-50 bg-[rgb(10_11_14/0.42)] backdrop-blur-[1.5px] data-[state=closed]:animate-[fade-out_120ms_ease-in] data-[state=open]:animate-[fade-in_160ms_ease-out]';

export const PANEL =
  'fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-raised shadow-overlay outline-none data-[state=closed]:animate-[fade-out_120ms_ease-in] data-[state=open]:animate-[dialog-in_200ms_var(--ease-out-quint)]';

/** The close button comes after the content, so opening a dialog focuses its first field. */
export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={OVERLAY} />
      <Primitive.Content className={cn(PANEL, 'p-5', className)}>
        <div className="mb-4 pr-8">
          <Primitive.Title className="text-base font-semibold tracking-[-0.01em]">
            {title}
          </Primitive.Title>
          {description === undefined ? (
            <Primitive.Description className="sr-only">{title}</Primitive.Description>
          ) : (
            <Primitive.Description className="mt-1 text-sm text-ink-2">
              {description}
            </Primitive.Description>
          )}
        </div>
        {children}
        <Primitive.Close asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            className="absolute top-4 right-4"
          >
            <X />
          </Button>
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
