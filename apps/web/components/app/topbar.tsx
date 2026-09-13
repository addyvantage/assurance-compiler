import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '../ui/cn';

export interface Crumb {
  readonly label: string;
  readonly href?: string;
  readonly mono?: boolean;
}

/** Where you are, and the actions that apply to this page. */
export function Topbar({
  crumbs,
  actions,
}: {
  readonly crumbs: readonly Crumb[];
  readonly actions?: ReactNode;
}) {
  return (
    <div className="sticky top-12 z-20 flex h-12 items-center justify-between gap-3 border-b border-line bg-panel/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-panel/70 lg:top-2 lg:rounded-t-xl lg:px-6">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1 text-sm">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li
                key={`${crumb.label}-${String(index)}`}
                className="flex min-w-0 items-center gap-1"
              >
                {index > 0 ? (
                  <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                ) : null}
                {crumb.href !== undefined && !last ? (
                  <Link
                    href={crumb.href}
                    className={cn(
                      'truncate rounded-[5px] px-1.5 py-0.5 text-ink-2 transition-colors hover:bg-hover hover:text-ink',
                      crumb.mono === true && 'font-mono text-[12.5px]',
                    )}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={cn(
                      'truncate px-1.5 font-medium text-ink',
                      crumb.mono === true && 'font-mono text-[12.5px]',
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {actions === undefined ? null : (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function PageBody({
  children,
  wide = false,
  className,
}: {
  readonly children: ReactNode;
  readonly wide?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-8 lg:px-8',
        wide ? 'max-w-[1240px]' : 'max-w-[1040px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeading({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: ReactNode;
}) {
  return (
    <div className="mb-7 min-w-0">
      <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
      {description === undefined ? null : (
        <p className="mt-1.5 max-w-[66ch] text-sm text-ink-2">{description}</p>
      )}
    </div>
  );
}
