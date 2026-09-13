import type { ReactNode } from 'react';

/** A titled group of properties in a page's side column. */
export function PropertyGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="grid gap-2 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h2 className="mb-0.5 text-xs font-medium text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

/** One label and value. Its own list, so notes and links can sit between properties. */
export function Prop({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <dl className="grid min-h-6 grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
      <dt className="text-[12.5px] text-ink-2">{label}</dt>
      <dd className="flex min-w-0 items-center text-sm text-ink">{children}</dd>
    </dl>
  );
}
