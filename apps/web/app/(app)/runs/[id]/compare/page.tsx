import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell';
import { explainReport } from '@/lib/explain';
import { duration, short, when } from '@/lib/format';
import { getRun } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';

export const metadata: Metadata = { title: 'Compare runs' };

type Row = readonly [label: string, left: string, right: string];

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
  if (left.report === null || right.report === null) {
    return (
      <>
        <PageHeader title="Compare runs" crumbs={[{ href: '/runs', label: 'Runs' }]} />
        <p className="notice">Both runs need a final report before they can be compared.</p>
      </>
    );
  }
  const a = left.report;
  const b = right.report;
  const sa = a.verification?.subject;
  const sb = b.verification?.subject;
  const list = (items: readonly { name: string; blob: string }[] | undefined) =>
    items === undefined ? '—' : items.map((m) => `${m.name} ${short(m.blob)}`).join(', ');
  const stages = (report: typeof a) =>
    report.verification === null
      ? '—'
      : report.verification.stages
          .map(
            (s) =>
              `${s.name}: ${s.status}${s.durationMs === undefined ? '' : ` ${duration(s.durationMs)}`}`,
          )
          .join('\n');
  const rows: readonly Row[] = [
    ['Repository', left.repository.name, right.repository.name],
    ['Started', when(a.startedAt), when(b.startedAt)],
    ['Requested base', a.base.ref, b.base.ref],
    ['Base tip', short(a.base.commit), short(b.base.commit)],
    ['Merge base', short(a.mergeBase), short(b.mergeBase)],
    ['Candidate', short(a.head.commit), short(b.head.commit)],
    ['Verdict', a.verdict, b.verdict],
    ['Requirement state', a.requirements[0]?.state ?? 'none', b.requirements[0]?.state ?? 'none'],
    ['Explanation', explainReport(a).detail, explainReport(b).detail],
    [
      'Seed fixture',
      sa === undefined ? '—' : `${sa.seed.path} ${short(sa.seed.blob)}`,
      sb === undefined ? '—' : `${sb.seed.path} ${short(sb.seed.blob)}`,
    ],
    ['Baseline migrations', list(sa?.baselineMigrations), list(sb?.baselineMigrations)],
    ['Candidate migrations', list(sa?.candidateMigrations), list(sb?.candidateMigrations)],
    ['Expected tables', sa?.expectedTables.join(', ') ?? '—', sb?.expectedTables.join(', ') ?? '—'],
    [
      'PostgreSQL',
      a.verification?.environment.postgres ?? '—',
      b.verification?.environment.postgres ?? '—',
    ],
    [
      'Prisma',
      a.verification?.environment.prisma ?? '—',
      b.verification?.environment.prisma ?? '—',
    ],
    [
      'Provider',
      a.verification === null
        ? '—'
        : `${a.verification.provider.id} ${a.verification.provider.version}`,
      b.verification === null
        ? '—'
        : `${b.verification.provider.id} ${b.verification.provider.version}`,
    ],
    [
      'Failure',
      a.verification?.migrationFailure === undefined
        ? '—'
        : `${a.verification.migrationFailure.migration} SQLSTATE ${a.verification.migrationFailure.sqlState}`,
      b.verification?.migrationFailure === undefined
        ? '—'
        : `${b.verification.migrationFailure.migration} SQLSTATE ${b.verification.migrationFailure.sqlState}`,
    ],
    ['Stages', stages(a), stages(b)],
    ['Cloud report hash', left.run.reportHash ?? '—', right.run.reportHash ?? '—'],
  ];
  const differing = rows.filter(([, x, y]) => x !== y).length;

  return (
    <>
      <PageHeader
        title="Compare runs"
        description={`${String(differing)} of ${String(rows.length)} rows differ. Each run keeps its own evidence; a comparison never merges them.`}
        crumbs={[{ href: '/runs', label: 'Runs' }]}
      />
      <div className="compare-grid">
        <div className="head">Field</div>
        <div className="head">
          <Link href={`/runs/${left.run.id}`} className="mono">
            {left.run.id.slice(0, 8)}
          </Link>{' '}
          (this run)
        </div>
        <div className="head">
          <Link href={`/runs/${right.run.id}`} className="mono">
            {right.run.id.slice(0, 8)}
          </Link>
        </div>
        {rows.map(([label, x, y]) => {
          const diff = x !== y;
          return (
            <div key={label} style={{ display: 'contents' }}>
              <div className="muted">{label}</div>
              <div
                className={diff ? 'diff' : ''}
                style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {x}
              </div>
              <div
                className={diff ? 'diff' : ''}
                style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {y}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
