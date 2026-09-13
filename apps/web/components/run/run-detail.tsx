import { requirementDefinitions } from '@assurance-compiler/core';
import {
  CircleSlash,
  Download,
  FileCode2,
  GitBranch,
  GitCompareArrows,
  Info,
  Laptop,
  RotateCcw,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { explainReport, type Explanation } from '@/lib/explain';
import { formatMs, traceSpan, when } from '@/lib/format';
import type { RunView } from '@/lib/run-view';
import { Prop, PropertyGroup } from '../app/properties';
import { PageBody, Topbar } from '../app/topbar';
import { buttonClass } from '../ui/button';
import { cn } from '../ui/cn';
import { Identifier } from '../ui/copy';
import { StatePill, StatusIcon, SyncBadge } from '../ui/status';
import { Tip } from '../ui/tooltip';
import { RunLive } from './run-live';
import { ExecutionTrace } from './trace';

/** Typed as string on purpose: the catalog has one requirement today, and this must not assume it. */
const REQUIREMENT = 'NONEMPTY_MIGRATION_EXECUTION' as string;
const definition = requirementDefinitions.NONEMPTY_MIGRATION_EXECUTION;
const LIMITS = [
  ...definition.limitations,
  'Rollback safety, schema equivalence, or compatibility with later target-branch commits',
];

const NEXT_ICON: Record<Explanation['state'], ReactNode> = {
  FAILED: <Wrench />,
  NOT_PROVEN: <RotateCcw />,
  MISSING: <Terminal />,
  PROVEN: <Info />,
  NOT_APPLICABLE: <Info />,
  NONE: <Info />,
};

const FILE_STATUS: Record<string, string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
};

export function RunDetail({
  view,
  previousRunId,
}: {
  readonly view: RunView;
  readonly previousRunId?: string | undefined;
}) {
  const report = view.report;
  const explanation = report === null ? null : explainReport(report);
  const requirement = report?.requirements.find((r) => r.id === REQUIREMENT);
  const verification = report?.verification ?? null;
  const total = verification === null ? null : traceSpan(verification.stages);
  const stale = view.sync === 'stale';

  return (
    <>
      <Topbar
        crumbs={[
          { label: 'Runs', href: '/runs' },
          { label: view.repository.name, href: `/repositories/${view.repository.id}` },
          { label: view.id.slice(0, 8), mono: true },
        ]}
        actions={
          <>
            {previousRunId === undefined ? null : (
              <Link
                href={`/runs/${view.id}/compare?with=${previousRunId}`}
                className={buttonClass('secondary', 'sm')}
              >
                <GitCompareArrows />
                <span className="hidden sm:inline">Compare with previous</span>
              </Link>
            )}
            {view.reportHash === null ? null : (
              <a href={`/api/runs/${view.id}/artifact`} className={buttonClass('secondary', 'sm')}>
                <Download />
                <span className="hidden sm:inline">Cloud report</span>
              </a>
            )}
          </>
        }
      />
      <PageBody wide>
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <header className="animate-[rise_420ms_var(--ease-out-quint)_both]">
              <div className="flex flex-wrap items-center gap-2.5">
                {explanation === null ? (
                  <SyncBadge stale={stale} />
                ) : (
                  <StatePill state={explanation.state} tone="soft" />
                )}
                {requirement === undefined ? null : (
                  <Tip content="The requirement this change imposed">
                    <span tabIndex={0} className="rounded-[4px] font-mono text-2xs text-ink-3">
                      {requirement.id}
                    </span>
                  </Tip>
                )}
              </div>
              <h1 className="mt-3 max-w-[32ch] text-2xl font-semibold tracking-[-0.025em]">
                {explanation?.title ??
                  (stale ? 'Waiting for the CLI to report' : 'Run in progress')}
              </h1>
              <p className="mt-2.5 max-w-[70ch] text-base text-ink-2">
                {explanation?.detail ??
                  (stale
                    ? 'The CLI has not reported for a while. The check may still be running on that machine, or it may have stopped. Nothing is recorded as failed.'
                    : 'A linked CLI is running the check on its own machine and reporting each stage as it finishes. The assessment arrives with the final report.')}
              </p>
              {explanation === null ? null : (
                <div className="mt-5 flex max-w-[70ch] items-start gap-3 rounded-lg border border-line bg-raised px-3.5 py-3 text-sm shadow-raised">
                  <span className="mt-0.5 text-ink-3 [&_svg]:size-4">
                    {NEXT_ICON[explanation.state]}
                  </span>
                  <p>
                    <span className="font-medium text-ink">Next step. </span>
                    <span className="text-ink-2">{explanation.nextAction}</span>
                  </p>
                </div>
              )}
              {view.reassessmentAgrees === false ? (
                <div className="mt-3 flex max-w-[70ch] items-start gap-3 rounded-lg border border-[color-mix(in_oklab,var(--warn),transparent_60%)] bg-warn-soft px-3.5 py-3 text-sm text-warn-ink">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>
                    The engine, rerun on the reported observation, does not reach the state the CLI
                    reported. Treat this run as not proven until the difference is understood.
                  </p>
                </div>
              ) : null}
            </header>

            <Section
              id="trace"
              title="Execution trace"
              hint="Stages that ran on the CLI machine. Execution, not assurance."
              aside={
                total === null ? undefined : (
                  <span className="font-mono text-xs text-ink-2 tabular-nums">
                    {formatMs(total)}
                  </span>
                )
              }
              className="animate-[rise_420ms_var(--ease-out-quint)_80ms_both]"
            >
              {report === null ? (
                <RunLive runId={view.id} initialEvents={view.events} />
              ) : verification === null ? (
                <Card className="px-4 py-5 text-sm text-ink-2">
                  {explanation?.state === 'MISSING'
                    ? 'No stages ran: migration verification was not configured for this run.'
                    : 'No stages ran: no supported change was detected, so no provider was needed.'}
                </Card>
              ) : (
                <ExecutionTrace stages={verification.stages} />
              )}
            </Section>

            {report !== null && requirement !== undefined ? (
              <Section id="claim" title="What this requirement can establish">
                <Card className="grid md:grid-cols-2">
                  <div className="border-b border-line p-4 md:border-r md:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-medium text-ink-2">When proven</h3>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          requirement.state === 'PROVEN' ? 'text-good-ink' : 'text-ink-3',
                        )}
                      >
                        {requirement.state === 'PROVEN'
                          ? 'Established by this run'
                          : 'Not established by this run'}
                      </span>
                    </div>
                    <p className="mt-2.5 flex gap-2.5 text-sm text-ink">
                      <ShieldCheck
                        className={cn(
                          'mt-0.5 size-4 shrink-0',
                          requirement.state === 'PROVEN' ? 'text-good' : 'text-ink-3',
                        )}
                      />
                      {definition.establishes}
                    </p>
                    <p className="mt-3 pl-6.5 text-xs text-ink-3">{definition.rationale}</p>
                  </div>
                  <div className="p-4">
                    <h3 className="text-xs font-medium text-ink-2">
                      Never established, even when proven
                    </h3>
                    <ul className="mt-2.5 grid gap-2">
                      {LIMITS.map((limit) => (
                        <li key={limit} className="flex gap-2.5 text-sm text-ink-2">
                          <CircleSlash className="mt-0.5 size-4 shrink-0 text-ink-3" />
                          {limit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Section>
            ) : null}

            {verification === null ? null : (
              <Section
                id="inputs"
                title="Inputs"
                hint="The exact Git objects the provider executed"
              >
                <Card>
                  <dl className="divide-y divide-line">
                    <Row label="Baseline commit">
                      <Identifier value={verification.subject.baseline} label="baseline commit" />
                    </Row>
                    <Row label="Candidate commit">
                      <Identifier value={verification.subject.candidate} label="candidate commit" />
                    </Row>
                    <Row label="Prisma schema">
                      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs text-ink-3">baseline</span>
                        <Identifier
                          value={verification.subject.schema.baseline}
                          label="baseline schema blob"
                        />
                        <span className="text-xs text-ink-3">candidate</span>
                        <Identifier
                          value={verification.subject.schema.candidate}
                          label="candidate schema blob"
                        />
                      </span>
                    </Row>
                    <Row label="Seed fixture">
                      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-[12.5px] break-all">
                          {verification.subject.seed.path}
                        </span>
                        <Identifier value={verification.subject.seed.blob} label="seed blob" />
                      </span>
                    </Row>
                    <Row label="Baseline migrations">
                      {verification.subject.baselineMigrations.length === 0 ? (
                        <span className="text-ink-3">None</span>
                      ) : (
                        <MigrationList migrations={verification.subject.baselineMigrations} />
                      )}
                    </Row>
                    <Row label="Candidate migrations">
                      <MigrationList
                        migrations={verification.subject.candidateMigrations}
                        failure={verification.migrationFailure}
                      />
                    </Row>
                    <Row label="Expected tables">
                      <ul className="grid gap-1">
                        {verification.subject.expectedTables.map((table) => {
                          const observed = verification.populatedTables.find(
                            (entry) => entry.table === table,
                          );
                          return (
                            <li key={table} className="flex items-center gap-2.5">
                              <span className="font-mono text-[12.5px]">{table}</span>
                              <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                                {observed === undefined ? (
                                  'not checked'
                                ) : (
                                  <>
                                    <StatusIcon
                                      status={observed.populated ? 'succeeded' : 'failed'}
                                      size={12}
                                    />
                                    {observed.populated ? 'rows present' : 'no rows'}
                                  </>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </Row>
                  </dl>
                </Card>
              </Section>
            )}

            {report === null || report.changes.length === 0 ? null : (
              <Section id="files" title="Changed files" hint="Paths the Prisma detector recognized">
                <Card>
                  <ul className="divide-y divide-line">
                    {report.changes.flatMap((change) =>
                      change.files.map((file) => (
                        <li
                          key={`${change.surface}:${file.path}`}
                          className="flex min-h-10 items-center gap-3 px-4 py-2"
                        >
                          <FileCode2 className="size-4 shrink-0 text-ink-3" />
                          <span className="min-w-0 font-mono text-[12.5px] break-all">
                            {file.path}
                            {file.status === 'renamed' ? (
                              <span className="text-ink-3"> from {file.previousPath}</span>
                            ) : null}
                          </span>
                          <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-px text-2xs text-ink-2">
                            {FILE_STATUS[file.status] ?? file.status}
                          </span>
                        </li>
                      )),
                    )}
                  </ul>
                </Card>
              </Section>
            )}
          </div>

          <aside className="grid content-start gap-6 lg:sticky lg:top-20 lg:self-start">
            <PropertyGroup title="Change">
              <Prop label="Repository">
                <Link
                  href={`/repositories/${view.repository.id}`}
                  className="truncate font-medium text-ink hover:underline"
                >
                  {view.repository.name}
                </Link>
              </Prop>
              <Prop label="Base">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <GitBranch className="size-3.5 shrink-0 text-ink-3" />
                  <span className="truncate font-mono text-[12.5px]">{view.requestedBase}</span>
                </span>
              </Prop>
              <Prop label="Base tip">
                <Identifier value={view.baseCommit} label="base commit" />
              </Prop>
              <Prop label="Merge base">
                <Identifier value={view.mergeBase} label="merge base" />
              </Prop>
              <Prop label="Candidate">
                <Identifier value={view.headCommit} label="candidate commit" />
              </Prop>
            </PropertyGroup>
            <PropertyGroup title="Origin">
              <Prop label="Reported by">
                <span className="inline-flex items-center gap-1.5">
                  <Laptop className="size-3.5 text-ink-3" />
                  Linked local CLI
                </span>
              </Prop>
              <Prop label="Machine">
                <span className="truncate font-mono text-[12.5px]" title={view.cliLabel}>
                  {view.cliLabel}
                </span>
              </Prop>
              <Prop label="CLI">assure {view.cliVersion}</Prop>
              <Prop label="Started">
                <time dateTime={view.startedAt} title={view.startedAt}>
                  {when(view.startedAt)}
                </time>
              </Prop>
              <Prop label="Run">
                <Identifier value={view.id} label="run ID" chars={8} />
              </Prop>
              <p className="text-xs text-ink-3">
                Checked on arrival for shape and ownership. That shows the report is well formed,
                not that the check ran as reported.
              </p>
            </PropertyGroup>
            {verification === null ? null : (
              <PropertyGroup title="Environment">
                <Prop label="Provider">
                  <span className="truncate">
                    {verification.provider.id} {verification.provider.version}
                  </span>
                </Prop>
                <Prop label="PostgreSQL">
                  {verification.environment.postgres ?? (
                    <span className="text-ink-3">Not started</span>
                  )}
                </Prop>
                <Prop label="Prisma">
                  {verification.environment.prisma ?? <span className="text-ink-3">Not found</span>}
                </Prop>
                <Prop label="Cleanup">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusIcon
                      status={verification.cleanup.status === 'succeeded' ? 'succeeded' : 'failed'}
                      size={12}
                    />
                    {verification.cleanup.status === 'succeeded'
                      ? 'Succeeded'
                      : `${String(verification.cleanup.leftoverCount)} left behind`}
                  </span>
                </Prop>
                {view.reassessmentAgrees === null ? null : (
                  <Prop label="Reassessed">
                    <Tip content="The server reran the engine's assessment on the reported observation.">
                      <span tabIndex={0} className="inline-flex items-center gap-1.5 rounded-[4px]">
                        <StatusIcon
                          status={view.reassessmentAgrees ? 'succeeded' : 'not-proven'}
                          size={12}
                        />
                        {view.reassessmentAgrees ? 'Agrees' : 'Disagrees'}
                      </span>
                    </Tip>
                  </Prop>
                )}
              </PropertyGroup>
            )}
            {report === null ? null : (
              <PropertyGroup title="Provenance">
                <Prop label="Cloud report">
                  {view.reportHash === null ? (
                    <span className="text-ink-3">Not recorded</span>
                  ) : (
                    <Identifier value={view.reportHash} label="cloud report hash" chars={10} />
                  )}
                </Prop>
                <Prop label="Local file">
                  {report.localArtifact === undefined ? (
                    <span className="text-ink-3">Not written</span>
                  ) : (
                    <Identifier
                      value={report.localArtifact.sha256}
                      label="local evidence hash"
                      chars={10}
                    />
                  )}
                </Prop>
                <p className="text-xs text-ink-3">
                  Database messages, SQL, row values and local paths stay on the CLI machine, in the
                  local evidence file.
                </p>
              </PropertyGroup>
            )}
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Section({
  id,
  title,
  hint,
  aside,
  className,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly hint?: string;
  readonly aside?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn('mt-11', className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 id={`${id}-title`} className="text-sm font-semibold">
            {title}
          </h2>
          {hint === undefined ? null : <span className="text-xs text-ink-3">{hint}</span>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Card({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-line bg-raised shadow-raised',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function MigrationList({
  migrations,
  failure,
}: {
  readonly migrations: readonly { readonly name: string; readonly blob: string }[];
  readonly failure?: { readonly migration: string; readonly sqlState: string } | undefined;
}) {
  return (
    <ul className="grid gap-1.5">
      {migrations.map((migration) => {
        const failed = failure?.migration === migration.name;
        return (
          <li key={migration.name} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {failed ? <StatusIcon status="failed" size={13} /> : null}
            <span className={cn('font-mono text-[12.5px] break-all', failed && 'font-medium')}>
              {migration.name}
            </span>
            <Identifier value={migration.blob} label={`${migration.name} blob`} />
            {failed ? (
              <span className="rounded-full bg-bad-soft px-2 py-px font-mono text-2xs text-bad-ink">
                SQLSTATE {failure.sqlState}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
