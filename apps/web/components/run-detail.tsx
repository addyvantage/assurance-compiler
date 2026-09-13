import { requirementDefinitions } from '@assurance-compiler/core';
import Link from 'next/link';
import { explainReport, latestStages } from '@/lib/explain';
import { iso, plural, when } from '@/lib/format';
import type { RunView } from '@/lib/run-view';
import { Identifier } from './copy-button';
import { RunLive } from './run-live';
import { StageList } from './stages';
import { StateChip, SyncChip, verdictTone } from './status';

/** Typed as string on purpose: the catalog has one requirement today, and this must not assume it. */
const REQUIREMENT = 'NONEMPTY_MIGRATION_EXECUTION' as string;
const definition = requirementDefinitions.NONEMPTY_MIGRATION_EXECUTION;

/** Fields the CLI never sends. Listed so the reader knows what is missing by design. */
const NOT_UPLOADED =
  'database messages, stage details, tool output, SQL, seed contents, source files, row values and local paths';

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
  const running = report === null;
  const tone = running ? 'accent' : verdictTone(report.verdict);

  return (
    <article>
      <section className={`verdict ${tone}`} aria-labelledby="verdict-heading">
        <div className="verdict-line">
          <h1 id="verdict-heading">{running ? 'Run in progress' : `Verdict: ${report.verdict}`}</h1>
          {running ? <SyncChip state={view.sync} /> : null}
          {explanation !== null && explanation.state !== 'NONE' ? (
            <StateChip state={explanation.state} />
          ) : null}
        </div>
        {explanation === null ? (
          <p className="muted">
            {view.sync === 'stale'
              ? 'The CLI has not reported for a while. The check may still be running on that machine, or it may have been stopped. No result has been recorded; a disconnected run is not a failed migration.'
              : 'A linked CLI is running the check locally and reporting each stage as it finishes. The assessment arrives with the final report.'}
          </p>
        ) : (
          <>
            <p>
              <strong>{explanation.headline}</strong> {explanation.detail}
            </p>
            <p className="muted">Next: {explanation.nextAction}</p>
          </>
        )}
        <div className="origin">
          <span>
            Reported by linked local CLI <span className="mono">{view.cliLabel}</span> (assure{' '}
            {view.cliVersion})
          </span>
          <span title={view.startedAt}>started {when(view.startedAt)}</span>
          {view.finishedAt !== null ? (
            <span title={view.finishedAt}>finished {when(view.finishedAt)}</span>
          ) : null}
          <span>
            run <span className="mono">{view.id.slice(0, 8)}</span>
          </span>
          {view.reassessmentAgrees !== null ? (
            <span>
              engine reassessment:{' '}
              {view.reassessmentAgrees
                ? 'agrees with the reported states'
                : 'disagrees with the reported states'}
            </span>
          ) : null}
        </div>
        {view.reassessmentAgrees === false ? (
          <p className="notice warn">
            The engine, rerun on the reported observation, does not reach the state the CLI
            reported. Treat this run as not proven until the discrepancy is understood.
          </p>
        ) : null}
      </section>

      <div className="change-strip" aria-label="Change identity">
        <div>
          <span>Repository</span>
          <Link href={`/repositories/${view.repository.id}`}>{view.repository.name}</Link>
        </div>
        <div>
          <span>Requested base</span>
          <span className="mono">{view.requestedBase}</span>
        </div>
        <div>
          <span>Base tip</span>
          <Identifier value={view.baseCommit} label="base commit" />
        </div>
        <div>
          <span>Merge base (baseline)</span>
          <Identifier value={view.mergeBase} label="merge base" />
        </div>
        <div>
          <span>Candidate</span>
          <Identifier value={view.headCommit} label="candidate commit" />
        </div>
        {report !== null ? (
          <div>
            <span>Detected</span>
            <span>
              {report.changes.length === 0
                ? 'nothing supported'
                : report.changes.map((c) => c.surface).join(', ')}
              {report.changes.length > 0
                ? ` · ${plural(
                    report.changes.reduce((n, c) => n + c.files.length, 0),
                    'file',
                  )}`
                : ''}
            </span>
          </div>
        ) : null}
      </div>

      <section className="section" aria-labelledby="stages-heading">
        <div className="section-title">
          <h2 id="stages-heading">Stages</h2>
          {running ? null : <span className="faint">Execution lifecycle, not assurance</span>}
        </div>
        {running ? (
          <RunLive runId={view.id} initialEvents={view.events} startedAt={view.startedAt} />
        ) : verification === null ? (
          <p className="notice">No provider ran for this change. {explanation?.detail}</p>
        ) : (
          <StageList stages={verification.stages} live={false} />
        )}
        {running && view.events.length === 0 ? (
          <p className="faint" style={{ marginTop: 8 }}>
            No stage has reported yet. {latestStages([]).length} stages will run in this order.
          </p>
        ) : null}
      </section>

      {report !== null && requirement !== undefined ? (
        <section className="section" aria-labelledby="requirement-heading">
          <div className="section-title">
            <h2 id="requirement-heading">Requirement</h2>
            <StateChip state={requirement.state} />
          </div>
          <dl className="kv">
            <dt>Requirement</dt>
            <dd>
              <span className="mono">{requirement.id}</span> · {definition.title}
            </dd>
            <dt>Triggered by</dt>
            <dd className="mono">{requirement.triggeredBy.join(', ')}</dd>
            <dt>Provider</dt>
            <dd>
              {verification === null
                ? 'none ran'
                : `${verification.provider.id} ${verification.provider.version}`}
            </dd>
            <dt>Why it exists</dt>
            <dd className="muted">{definition.rationale}</dd>
            <dt>Establishes</dt>
            <dd>{definition.establishes}</dd>
            <dt>Does not establish</dt>
            <dd>
              <ul className="limits">
                {definition.limitations.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
                <li>
                  Rollback safety, schema equivalence, or compatibility with later target-branch
                  commits
                </li>
              </ul>
            </dd>
          </dl>
        </section>
      ) : null}

      {report !== null && report.changes.length > 0 ? (
        <section className="section" aria-labelledby="files-heading">
          <div className="section-title">
            <h2 id="files-heading">Changed files the detector recognized</h2>
          </div>
          <ul className="limits" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {report.changes.flatMap((change) =>
              change.files.map((file) => (
                <li key={`${change.surface}:${file.path}`}>
                  <span className="faint" style={{ display: 'inline-block', width: 72 }}>
                    {file.status}
                  </span>
                  <span className="mono">{file.path}</span>
                  {file.status === 'renamed' ? (
                    <span className="faint"> from {file.previousPath}</span>
                  ) : null}
                </li>
              )),
            )}
          </ul>
        </section>
      ) : null}

      {verification !== null ? (
        <section className="section" aria-labelledby="evidence-heading">
          <div className="section-title">
            <h2 id="evidence-heading">Evidence</h2>
            <span className="faint">Exact inputs and the environment that ran</span>
          </div>
          <div className="two-col">
            <dl className="kv">
              <dt>Baseline commit</dt>
              <dd>
                <Identifier value={verification.subject.baseline} label="baseline commit" />
              </dd>
              <dt>Candidate commit</dt>
              <dd>
                <Identifier value={verification.subject.candidate} label="candidate commit" />
              </dd>
              <dt>Schema blobs</dt>
              <dd>
                baseline{' '}
                <Identifier
                  value={verification.subject.schema.baseline}
                  label="baseline schema blob"
                />
                <br />
                candidate{' '}
                <Identifier
                  value={verification.subject.schema.candidate}
                  label="candidate schema blob"
                />
              </dd>
              <dt>Seed fixture</dt>
              <dd>
                <span className="mono">{verification.subject.seed.path}</span>{' '}
                <Identifier value={verification.subject.seed.blob} label="seed blob" />
              </dd>
              <dt>Baseline migrations</dt>
              <dd>
                {verification.subject.baselineMigrations.length === 0 ? (
                  <span className="faint">none</span>
                ) : (
                  verification.subject.baselineMigrations.map((m) => (
                    <div key={m.name}>
                      <span className="mono">{m.name}</span>{' '}
                      <Identifier value={m.blob} label={`${m.name} blob`} />
                    </div>
                  ))
                )}
              </dd>
              <dt>Candidate migrations</dt>
              <dd>
                {verification.subject.candidateMigrations.map((m) => (
                  <div key={m.name}>
                    <span className="mono">{m.name}</span>{' '}
                    <Identifier value={m.blob} label={`${m.name} blob`} />
                  </div>
                ))}
              </dd>
              <dt>Expected tables</dt>
              <dd className="mono">{verification.subject.expectedTables.join(', ')}</dd>
            </dl>
            <dl className="kv">
              <dt>PostgreSQL</dt>
              <dd>
                {verification.environment.postgres ?? <span className="faint">not started</span>}
              </dd>
              <dt>Prisma</dt>
              <dd>{verification.environment.prisma ?? <span className="faint">not found</span>}</dd>
              <dt>Population</dt>
              <dd>
                {verification.populatedTables.length === 0 ? (
                  <span className="faint">not checked</span>
                ) : (
                  verification.populatedTables.map((t) => (
                    <div key={t.table}>
                      <span className="mono">{t.table}</span>:{' '}
                      {t.populated ? 'rows present' : 'no rows'}
                    </div>
                  ))
                )}
              </dd>
              {verification.migrationFailure !== undefined ? (
                <>
                  <dt>Failure</dt>
                  <dd>
                    <span className="mono">{verification.migrationFailure.migration}</span> ·
                    SQLSTATE <span className="mono">{verification.migrationFailure.sqlState}</span>
                  </dd>
                </>
              ) : null}
              <dt>Cleanup</dt>
              <dd>
                {verification.cleanup.status === 'succeeded'
                  ? 'succeeded'
                  : `failed; ${plural(verification.cleanup.leftoverCount, 'resource')} left on the CLI machine`}
              </dd>
              <dt>Provider run</dt>
              <dd>
                <Identifier value={verification.runId} shortLength={8} label="provider run ID" />
              </dd>
            </dl>
          </div>
        </section>
      ) : null}

      {report !== null ? (
        <section className="section" aria-labelledby="artifact-heading">
          <div className="section-title">
            <h2 id="artifact-heading">Artifacts and provenance</h2>
          </div>
          <dl className="kv">
            <dt>Cloud report</dt>
            <dd>
              payload version {report.version}, sha256{' '}
              {view.reportHash === null ? (
                <span className="faint">not recorded</span>
              ) : (
                <Identifier value={view.reportHash} shortLength={12} label="cloud report hash" />
              )}
              {view.reportHash !== null ? (
                <>
                  {' '}
                  · <a href={`/api/runs/${view.id}/artifact`}>Download cloud report</a>
                </>
              ) : null}
            </dd>
            <dt>Local evidence file</dt>
            <dd>
              {report.localArtifact === undefined ? (
                <span className="faint">not written locally (no --evidence-out)</span>
              ) : (
                <>
                  sha256{' '}
                  <Identifier
                    value={report.localArtifact.sha256}
                    shortLength={12}
                    label="local evidence hash"
                  />
                  <span className="faint"> · stays on the machine that ran the check</span>
                </>
              )}
            </dd>
            <dt>Not uploaded</dt>
            <dd className="muted">{NOT_UPLOADED}. Open the local evidence file for them.</dd>
            <dt>Received</dt>
            <dd title={iso(view.receivedAt)}>{when(view.receivedAt)}</dd>
          </dl>
          {previousRunId !== undefined ? (
            <div style={{ marginTop: 12 }}>
              <Link
                href={`/runs/${view.id}/compare?with=${previousRunId}`}
                className="button small"
              >
                Compare with the previous run of this repository
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
