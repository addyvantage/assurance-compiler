import type { ReactNode } from 'react';

/** An empty or unavailable view: what is missing, and the action that fills it. */
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-10 place-items-center rounded-lg border border-line bg-raised text-ink-2 shadow-raised [&_svg]:size-5">
        {icon}
      </div>
      <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mt-1.5 max-w-[46ch] text-sm text-ink-2">{description}</p>
      {children === undefined ? null : <div className="mt-5 flex gap-2">{children}</div>}
    </div>
  );
}
