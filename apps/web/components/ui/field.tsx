import { CircleAlert } from 'lucide-react';
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-ink', className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-line-strong bg-raised px-3 text-sm text-ink shadow-raised transition-[border-color,box-shadow] outline-none placeholder:text-ink-3 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] aria-invalid:border-bad',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint === undefined ? null : <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function FormError({
  id,
  children,
}: {
  readonly id?: string;
  readonly children: ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--bad),transparent_70%)] bg-bad-soft px-3 py-2 text-sm text-bad-ink"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
