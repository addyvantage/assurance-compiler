'use client';

import { Check } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from './cn';

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

const ITEM =
  'relative flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm text-ink-2 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover data-[highlighted]:text-ink [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3';

export function MenuContent({
  children,
  align = 'start',
  className,
}: {
  readonly children: ReactNode;
  readonly align?: 'start' | 'center' | 'end';
  readonly className?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          'z-50 min-w-[220px] origin-(--radix-dropdown-menu-content-transform-origin) rounded-lg bg-raised p-1 shadow-overlay data-[state=closed]:animate-[pop-out_100ms_ease-in] data-[state=open]:animate-[pop-in_150ms_var(--ease-out-quint)]',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  asChild = false,
}: {
  readonly children: ReactNode;
  readonly onSelect?: (event: Event) => void;
  readonly asChild?: boolean;
}) {
  return (
    <DropdownMenu.Item
      asChild={asChild}
      {...(onSelect === undefined ? {} : { onSelect })}
      className={ITEM}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuRadioItem({
  value,
  children,
}: {
  readonly value: string;
  readonly children: ReactNode;
}) {
  return (
    <DropdownMenu.RadioItem value={value} className={cn(ITEM, 'pr-8')}>
      {children}
      <DropdownMenu.ItemIndicator className="absolute right-2 inline-flex">
        <Check className="size-4 text-ink!" strokeWidth={2.2} />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export function MenuLabel({ children }: { readonly children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-xs text-ink-3">
      {children}
    </DropdownMenu.Label>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
