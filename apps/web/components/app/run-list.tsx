import type { AssuranceState } from '@assurance-compiler/core';
import { GitBranch } from 'lucide-react';
import Link from 'next/link';
import { dayLabel, formatMs, hm, short } from '@/lib/format';
import type { StatusKind } from '@/lib/status-kind';
import { StatePill, StatusIcon } from '../ui/status';

export interface RunListItem {
  readonly id: string;
  readonly repositoryName: string;
  readonly requestedBase: string;
  readonly mergeBase: string;
  readonly headCommit: string;
  readonly startedAt: Date;
  readonly status: { readonly kind: StatusKind; readonly label: string };
  readonly requirementState: AssuranceState | 'NONE' | null;
  readonly durationMs: number | null;
}

/** Runs grouped by day. Each row leads with its status and ends with when it started. */
export function RunList({
  items,
  showRepository = true,
}: {
  readonly items: readonly RunListItem[];
  readonly showRepository?: boolean;
}) {
  const now = new Date();
  const groups: { label: string; items: RunListItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.startedAt, now);
    const group = groups.at(-1);
    if (group?.label === label) group.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-raised shadow-raised">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <div className="border-b border-line bg-sunken px-4 py-1.5 text-2xs font-medium text-ink-3 [section+section_&]:border-t">
            {group.label}
          </div>
          <ul className="divide-y divide-line">
            {group.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/runs/${item.id}`}
                  className="grid min-h-13 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-3.5 px-4 py-2 transition-colors -outline-offset-2 hover:bg-hover md:grid-cols-[18px_minmax(0,1.1fr)_minmax(0,1fr)_128px_64px_48px]"
                >
                  <StatusIcon status={item.status.kind} size={16} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {showRepository ? item.repositoryName : `Run ${item.id.slice(0, 8)}`}
                      {showRepository ? (
                        <span className="sr-only">, {item.status.label}</span>
                      ) : null}
                    </span>
                    <span className="block truncate font-mono text-2xs text-ink-3">
                      {showRepository ? item.id.slice(0, 8) : item.status.label}
                    </span>
                  </span>
                  <span className="hidden min-w-0 items-center gap-1.5 md:flex">
                    <GitBranch className="size-3.5 shrink-0 text-ink-3" />
                    <span className="truncate font-mono text-xs text-ink-2">
                      {item.requestedBase}
                    </span>
                    <span className="font-mono text-xs whitespace-nowrap text-ink-3">
                      {short(item.mergeBase)}..{short(item.headCommit)}
                    </span>
                  </span>
                  <span className="hidden md:block">
                    {item.requirementState === null ? (
                      <span className="text-xs text-ink-3">Awaiting report</span>
                    ) : (
                      <StatePill state={item.requirementState} />
                    )}
                  </span>
                  <span className="hidden text-right font-mono text-xs text-ink-2 tabular-nums md:block">
                    {item.durationMs === null ? '' : formatMs(item.durationMs)}
                  </span>
                  <time
                    dateTime={item.startedAt.toISOString()}
                    title={item.startedAt.toISOString()}
                    className="text-right font-mono text-xs text-ink-3 tabular-nums"
                  >
                    {hm(item.startedAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
