import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageBody, PageHeading, Topbar } from '@/components/app/topbar';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusIcon } from '@/components/ui/status';
import { explainReport, STAGE_LABELS } from '@/lib/explain';
import { formatMs, short, when } from '@/lib/format';
import { getRun, requirementState } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';
import { runStatus } from '@/lib/status-kind';
import { GitCompareArrows } from 'lucide-react';
import { CompareTable, type CompareRow } from './compare-table';

export const metadata: Metadata = { title: 'Compare runs' };

export default async function ComparePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ with?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const { with: otherId } = await searchParams;
  if (otherId === undefined) notFound();
  const [left, right] = await Promise.all([
    getRun(workspace.id, id),
    getRun(workspace.id, otherId),
  ]);
  if (left === undefined || right === undefined) notFound();
  const crumbs = [
    { label: 'Runs', href: '/runs' },
    { label: id.slice(0, 8), href: `/runs/${id}`, mono: true },
    { label: 'Compare' },
  ];
  if (left.report === null || right.report === null) {
    return (
      <>
        <Topbar crumbs={crumbs} />
        <PageBody>
          <div className="rounded-lg border border-line bg-raised shadow-raised">
            <EmptyState
              icon={<GitCompareArrows />}
              title="Not ready to compare"
              description="Both runs need their final report before they can be compared."
            />
          </div>
        </PageBody>
      </>
    );
  }
  const a = left.report;
  const b = right.report;
  const sa = a.verification?.subject;
  const sb = b.verification?.subject;
  const list = (items: readonly { name: string; blob: string }[] | undefined) =>
    items === undefined || items.length === 0
      ? 'None'
      : items.map((m) => `${m.name} ${short(m.blob)}`).join('\n');
  const stages = (report: typeof a) =>
    report.verification === null
      ? 'No stages ran'
      : report.verification.stages
          .map(
            (s) =>
              `${STAGE_LABELS[s.name]}: ${s.status}${s.durationMs === undefined ? '' : `, ${formatMs(s.durationMs)}`}`,
          )
          .join('\n');
  const failure = (report: typeof a) =>
    report.verification?.migrationFailure === undefined
      ? 'None'
      : `${report.verification.migrationFailure.migration}, SQLSTATE ${report.verification.migrationFailure.sqlState}`;
  const rows: CompareRow[] = [
    { label: 'Verdict', left: a.verdict, right: b.verdict },
    {
      label: 'Requirement state',
      left: a.requirements[0]?.state ?? 'None',
      right: b.requirements[0]?.state ?? 'None',
    },
    { label: 'Explanation', left: explainReport(a).detail, right: explainReport(b).detail },
    { label: 'Requested base', left: a.base.ref, right: b.base.ref, mono: true },
    { label: 'Base tip', left: short(a.base.commit), right: short(b.base.commit), mono: true },
    { label: 'Merge base', left: short(a.mergeBase), right: short(b.mergeBase), mono: true },
    { label: 'Candidate', left: short(a.head.commit), right: short(b.head.commit), mono: true },
    {
      label: 'Seed fixture',
      left: sa === undefined ? 'None' : `${sa.seed.path} ${short(sa.seed.blob)}`,
      right: sb === undefined ? 'None' : `${sb.seed.path} ${short(sb.seed.blob)}`,
      mono: true,
    },
    {
      label: 'Baseline migrations',
      left: list(sa?.baselineMigrations),
      right: list(sb?.baselineMigrations),
      mono: true,
    },
    {
      label: 'Candidate migrations',
      left: list(sa?.candidateMigrations),
      right: list(sb?.candidateMigrations),
      mono: true,
    },
    {
      label: 'Expected tables',
      left: sa?.expectedTables.join(', ') ?? 'None',
      right: sb?.expectedTables.join(', ') ?? 'None',
      mono: true,
    },
    { label: 'Failure', left: failure(a), right: failure(b) },
    { label: 'Stages', left: stages(a), right: stages(b) },
    {
      label: 'PostgreSQL',
      left: a.verification?.environment.postgres ?? 'None',
      right: b.verification?.environment.postgres ?? 'None',
    },
    {
      label: 'Prisma',
      left: a.verification?.environment.prisma ?? 'None',
      right: b.verification?.environment.prisma ?? 'None',
    },
    {
      label: 'Provider',
      left:
        a.verification === null
          ? 'None'
          : `${a.verification.provider.id} ${a.verification.provider.version}`,
      right:
        b.verification === null
          ? 'None'
          : `${b.verification.provider.id} ${b.verification.provider.version}`,
    },
    {
      label: 'Cloud report hash',
      left: left.run.reportHash ?? 'None',
      right: right.run.reportHash ?? 'None',
      mono: true,
    },
  ];
  const differing = rows.filter((row) => row.left !== row.right).length;
  const card = (run: typeof left, title: string) => {
    const status = runStatus(run.run.verdict, run.sync, requirementState(run.run));
    return (
      <Link
        href={`/runs/${run.run.id}`}
        className="flex items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 shadow-raised transition-colors hover:bg-hover"
      >
        <StatusIcon status={status.kind} size={18} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-3">{title}</span>
          <span className="block truncate text-sm font-medium text-ink">
            {status.label}, candidate{' '}
            <span className="font-mono text-[12.5px]">{short(run.run.headCommit)}</span>
          </span>
        </span>
        <span className="text-xs whitespace-nowrap text-ink-3">{when(run.run.startedAt)}</span>
      </Link>
    );
  };

  return (
    <>
      <Topbar crumbs={crumbs} />
      <PageBody wide>
        <PageHeading
          title="Compare runs"
          description={`${String(differing)} of ${String(rows.length)} fields differ. Each run keeps its own evidence; comparing never merges them.`}
        />
        <div className="mb-8 grid gap-3 md:grid-cols-2">
          {card(left, 'This run')}
          {card(right, 'Compared with')}
        </div>
        <CompareTable
          rows={rows}
          leftTitle={`Run ${left.run.id.slice(0, 8)}`}
          rightTitle={`Run ${right.run.id.slice(0, 8)}`}
        />
      </PageBody>
    </>
  );
}
