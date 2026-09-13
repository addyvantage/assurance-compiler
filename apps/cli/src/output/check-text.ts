import {
  planVerdict,
  type AssurancePlan,
  type MigrationExecutionObservation,
  type RequirementInstance,
  type StageRecord,
} from '@assurance-compiler/core';
import { indent, wrap, wrapAfter } from './layout.js';
import { scopeLine } from './plan-text.js';
import { renderRequirementScope } from './requirement-text.js';
import type { Theme } from './theme.js';
import { verdictTone } from './vocabulary.js';

export interface CheckTextInput {
  readonly plan: AssurancePlan;
  readonly verification: MigrationExecutionObservation | null;
  readonly artifact: { readonly path: string; readonly sha256: string } | undefined;
  readonly uncommittedChanges: boolean;
}

export interface CheckTextOptions {
  readonly theme: Theme;
  readonly width: number;
}

const UNCOMMITTED_NOTICE = 'Uncommitted changes are not included. Commit them to check them.';
const LABEL_WIDTH = 11;
const STAGE_STATUS_WIDTH = 'succeeded'.length;
const STAGE_NAME_WIDTH = 'candidate-migrations'.length;

export function renderCheckText(input: CheckTextInput, { theme, width }: CheckTextOptions): string {
  const lines =
    input.plan.changes.length === 0
      ? renderNothingEvaluated(input, theme)
      : renderResult(input, theme, width);
  return `${lines.join('\n')}\n`;
}

/** Says exactly how little was established: nothing the current detectors recognize changed. */
function renderNothingEvaluated(
  { plan, uncommittedChanges }: CheckTextInput,
  theme: Theme,
): string[] {
  return [
    'No supported assurance-sensitive changes detected.',
    'No assurance requirements were evaluated for this change.',
    theme.muted(scopeLine(plan)),
    ...(uncommittedChanges ? [theme.caution(UNCOMMITTED_NOTICE)] : []),
  ];
}

function renderResult(input: CheckTextInput, theme: Theme, width: number): string[] {
  const { plan, verification, artifact } = input;
  const verdict = planVerdict(plan);
  const bodyWidth = width - 2;

  return [
    `${theme.strong('Verdict:')} ${theme.strong(theme[verdictTone[verdict]](verdict))}`,
    ...plan.requirements.flatMap((instance) => wrap(explain(instance), width)),
    ...(input.uncommittedChanges ? [theme.caution(UNCOMMITTED_NOTICE)] : []),
    '',
    theme.strong('Change'),
    ...indent(renderChange(plan, theme, bodyWidth)),
    '',
    theme.strong('Requirement'),
    ...plan.requirements.flatMap((instance) =>
      indent(renderRequirementScope(instance, theme, bodyWidth)),
    ),
    ...(verification === null
      ? []
      : [
          '',
          theme.strong('Verification'),
          ...indent(renderVerification(verification, theme, bodyWidth)),
        ]),
    '',
    ...renderNext(plan, verification, artifact, theme, width),
  ];
}

function explain(instance: RequirementInstance): string {
  const { requirement, assessment } = instance;
  switch (assessment.state) {
    case 'PROVEN':
      return `${requirement} is proven for this change. ${assessment.evidence[0].summary}`;
    case 'FAILED':
      return `${requirement} failed. ${assessment.evidence[0].summary}`;
    case 'NOT_PROVEN':
      return `${requirement} is not proven. ${assessment.reason}`;
    case 'MISSING':
      return `${requirement} is missing: no migration verification is configured.`;
    case 'NOT_APPLICABLE':
      return `${requirement} does not apply. ${assessment.reason}`;
  }
}

function renderChange(plan: AssurancePlan, theme: Theme, width: number): string[] {
  const { base, head, mergeBase } = plan.changeSet;
  const files = plan.changes.flatMap((detection) =>
    detection.files.map((file) => `${file.status.padEnd('modified'.length)}  ${file.path}`),
  );
  return [
    ...row('Base', `${base.ref} at ${short(base.commit)}`, theme, width),
    ...row(
      'Baseline',
      `${short(mergeBase)}  merge base; migrations are verified on top of it`,
      theme,
      width,
    ),
    ...row('Candidate', `${short(head.commit)}  ${head.ref}`, theme, width),
    ...row('Detected', plan.changes.map((detection) => detection.surface).join(', '), theme, width),
    ...files.map((line) => `${' '.repeat(LABEL_WIDTH)}${theme.muted(line)}`),
    ...row(
      'Scope',
      `Only changes the ${plan.detectors.join(', ')} detector recognizes are checked.`,
      theme,
      width,
    ),
  ];
}

function renderVerification(
  observation: MigrationExecutionObservation,
  theme: Theme,
  width: number,
): string[] {
  const { subject, environment, cleanup } = observation;
  const candidates = subject.candidateMigrations.map((migration) => migration.name).join(', ');
  const cleanupText =
    cleanup.status === 'succeeded'
      ? 'succeeded'
      : `failed; still present: ${cleanup.leftovers.join('; ')}`;
  return [
    ...row('Fixture', `${subject.seed.path} (blob ${short(subject.seed.blob)})`, theme, width),
    ...row('Tables', subject.expectedTables.join(', '), theme, width),
    ...row(
      'Migrations',
      `${String(subject.baselineMigrations.length)} baseline; candidate ${candidates}`,
      theme,
      width,
    ),
    ...row(
      'Tools',
      `PostgreSQL ${environment.postgres ?? 'not started'}; Prisma ${environment.prisma ?? 'not found'}`,
      theme,
      width,
    ),
    ...row(
      'Run',
      `${observation.runId} (${observation.origin}, ${observation.provider.id} ${observation.provider.version})`,
      theme,
      width,
    ),
    ...row('Cleanup', cleanupText, theme, width),
    '',
    theme.muted('Stages'),
    ...observation.stages.flatMap((stage) => renderStage(stage, theme, width)),
  ];
}

/** Stage lines use no status colour: a stage succeeding is not assurance being established. */
function renderStage(stage: StageRecord, theme: Theme, width: number): string[] {
  const status = (stage.status === 'pending' ? 'not run' : stage.status).padEnd(STAGE_STATUS_WIDTH);
  const duration = stage.durationMs === undefined ? '' : `${(stage.durationMs / 1000).toFixed(1)}s`;
  const summary = `${status}  ${stage.name.padEnd(STAGE_NAME_WIDTH)}  ${duration}`.trimEnd();
  const emphasized = stage.status === 'failed' || stage.status === 'cancelled';
  const detailIndent = STAGE_STATUS_WIDTH + 2;
  return [
    emphasized
      ? theme.strong(summary)
      : stage.status === 'pending'
        ? theme.muted(summary)
        : summary,
    ...(stage.detail === undefined || !emphasized
      ? []
      : wrap(stage.detail, width - detailIndent).map(
          (line) => `${' '.repeat(detailIndent)}${line}`,
        )),
  ];
}

function renderNext(
  plan: AssurancePlan,
  verification: MigrationExecutionObservation | null,
  artifact: CheckTextInput['artifact'],
  theme: Theme,
  width: number,
): string[] {
  if (artifact !== undefined) {
    return row('Evidence', `${artifact.path} (sha256 ${artifact.sha256})`, theme, width);
  }
  if (plan.requirements.some((instance) => instance.assessment.state === 'MISSING')) {
    // A command is never wrapped, so it can be copied as printed.
    const command = `assure check ${plan.changeSet.base.ref} --seed-sql <path> --expect-table <schema.table>`;
    return [`${theme.muted('Next'.padEnd(LABEL_WIDTH))}${command}`];
  }
  return verification === null
    ? []
    : row(
        'Evidence',
        'not saved; use --evidence-out <path>, or --json for the full record',
        theme,
        width,
      );
}

function row(label: string, value: string, theme: Theme, width: number): string[] {
  return wrapAfter(theme.muted(label.padEnd(LABEL_WIDTH)), LABEL_WIDTH, value, width);
}

function short(id: string): string {
  return id.slice(0, 7);
}
