import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const BASE =
  'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-offset-2 transition-[background-color,color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-solid text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.12)] hover:bg-[color-mix(in_oklab,var(--accent-solid),white_9%)]',
  secondary:
    'border border-line-strong bg-raised text-ink shadow-raised hover:bg-[color-mix(in_oklab,var(--raised),var(--ink)_4%)]',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink',
  danger:
    'border border-line-strong bg-raised text-bad-ink shadow-raised hover:border-[color-mix(in_oklab,var(--bad),transparent_55%)] hover:bg-bad-soft',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5',
  md: 'h-8 rounded-md px-3 text-sm [&_svg]:size-4',
  lg: 'h-9 rounded-md px-4 text-sm [&_svg]:size-4',
  icon: 'size-8 rounded-md [&_svg]:size-4',
  'icon-sm': 'size-7 rounded-md [&_svg]:size-3.5',
};

/** Class names for anything that should look like a button, such as a link. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cn(BASE, VARIANTS[variant], SIZES[size]);
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}) {
  return <button type={type} className={cn(buttonClass(variant, size), className)} {...props} />;
}

export function Kbd({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line bg-sunken px-1 text-[10.5px] font-medium text-ink-3',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
