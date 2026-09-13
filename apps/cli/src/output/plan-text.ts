import {
  ASSURANCE_STATES,
  planVerdict,
  type AssurancePlan,
  type ChangedFile,
  type ChangeDetection,
} from '@assurance-compiler/core';
import { countOf, indent } from './layout.js';
import { renderRequirement } from './requirement-text.js';
import type { Theme } from './theme.js';
import { stateCountLabel, verdictTone } from './vocabulary.js';

export interface PlanTextOptions {
  readonly theme: Theme;
  readonly width: number;
  /** Whether the working tree has changes the plan could not include. */
  readonly uncommittedChanges: boolean;
}

const UNCOMMITTED_NOTICE = 'Uncommitted changes are not included. Commit them to plan them.';

/** Aligns file paths after the longest file status, `modified`. */
const FILE_STATUS_WIDTH = 'modified'.length;

export function renderPlanText(plan: AssurancePlan, options: PlanTextOptions): string {
  const lines =
    plan.changes.length === 0 ? renderNothingDetected(plan, options) : renderPlan(plan, options);
  return `${lines.join('\n')}\n`;
}

/**
 * Deliberately modest: the absence of detections only means the current detectors
 * recognized nothing, so the output names the detectors and makes no safety claim.
 */
function renderNothingDetected(
  plan: AssurancePlan,
  { theme, uncommittedChanges }: PlanTextOptions,
) {
  return [
    'No assurance-sensitive changes detected.',
    theme.muted(scopeLine(plan)),
    ...(uncommittedChanges ? [theme.caution(UNCOMMITTED_NOTICE)] : []),
  ];
}

function renderPlan(plan: AssurancePlan, { theme, width, uncommittedChanges }: PlanTextOptions) {
  const rule = theme.muted('─'.repeat(width));
  const bodyWidth = width - 2;

  return [
    rule,
    renderHeader(plan, theme, width),
    rule,
    '',
    renderSensitiveFileCount(plan),
    ...(uncommittedChanges ? [theme.caution(UNCOMMITTED_NOTICE)] : []),
    '',
    ...plan.changes.flatMap((detection) => [...renderDetection(detection, theme), '']),
    ...(plan.requirements.length === 0
      ? []
      : [
          theme.strong('Requires'),
          '',
          ...plan.requirements.flatMap((instance) => [
            ...indent(renderRequirement(instance, theme, bodyWidth)),
            '',
          ]),
        ]),
    ...renderSummary(plan, theme),
    '',
    renderVerdict(plan, theme),
    rule,
  ];
}

function renderHeader(plan: AssurancePlan, theme: Theme, width: number): string {
  const title = 'Assurance plan';
  const range = rangeOf(plan);
  const gap = ' '.repeat(Math.max(width - title.length - range.length, 2));
  return `${theme.strong(title)}${gap}${theme.muted(range)}`;
}

function renderSensitiveFileCount(plan: AssurancePlan): string {
  const sensitive = new Set(
    plan.changes.flatMap((detection) => detection.files.map((file) => file.path)),
  ).size;
  const total = countOf(plan.changeSet.files.length, 'changed file');
  return `${String(sensitive)} of ${total} ${sensitive === 1 ? 'is' : 'are'} assurance-sensitive`;
}

function renderDetection(detection: ChangeDetection, theme: Theme): string[] {
  return [
    theme.strong(detection.surface),
    '',
    ...indent(detection.files.map((file) => renderFile(file, theme))),
  ];
}

function renderFile(file: ChangedFile, theme: Theme): string {
  const status = theme.muted(file.status.padEnd(FILE_STATUS_WIDTH));
  const path = file.status === 'renamed' ? `${file.previousPath} → ${file.path}` : file.path;
  return `${status}  ${path}`;
}

function renderSummary(plan: AssurancePlan, theme: Theme): string[] {
  const states = plan.requirements.map((instance) => instance.assessment.state);
  const counts = ASSURANCE_STATES.map((state) => ({
    state,
    count: states.filter((candidate) => candidate === state).length,
  }))
    .filter(({ state, count }) => state === 'PROVEN' || count > 0)
    .map(({ state, count }) => `${String(count)} ${stateCountLabel[state]}`);

  return [
    theme.strong('Summary'),
    '',
    ...indent([countOf(plan.requirements.length, 'requirement'), ...counts]),
  ];
}

function renderVerdict(plan: AssurancePlan, theme: Theme): string {
  const verdict = planVerdict(plan);
  return `${theme.strong('Verdict:')} ${theme.strong(theme[verdictTone[verdict]](verdict))}`;
}

/** Which changes were examined, and by which detectors: the limits of what a plan knows. */
export function scopeLine(plan: AssurancePlan): string {
  const files = countOf(plan.changeSet.files.length, 'changed file');
  return `${files} in ${rangeOf(plan)} · detectors: ${plan.detectors.join(', ')}`;
}

function rangeOf(plan: AssurancePlan): string {
  return `${plan.changeSet.base.ref}...${plan.changeSet.head.ref}`;
}
