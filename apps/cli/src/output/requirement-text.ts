import {
  changeSurfaceDefinitions,
  evidenceOf,
  requirementDefinitions,
  type Assessment,
  type Evidence,
  type RequirementInstance,
} from '@assurance-compiler/core';
import { wrap, wrapAfter } from './layout.js';
import type { Theme } from './theme.js';
import { stateExplanation, stateTone } from './vocabulary.js';

const BULLET = '· ';

/** Renders one requirement: what it is, why it applies, what it covers, and its state. */
export function renderRequirement(
  instance: RequirementInstance,
  theme: Theme,
  width: number,
): string[] {
  return [
    ...renderRequirementScope(instance, theme, width),
    '',
    ...section('Status', renderAssessment(instance.assessment, theme, width), theme),
  ];
}

/** What the requirement is, why it applies, and what it does and does not establish. */
export function renderRequirementScope(
  instance: RequirementInstance,
  theme: Theme,
  width: number,
): string[] {
  const definition = requirementDefinitions[instance.requirement];
  const why = [
    ...instance.triggeredBy.map((surface) => changeSurfaceDefinitions[surface].description),
    definition.rationale,
  ].join(' ');

  return [
    theme.strong(definition.id),
    ...wrap(definition.title, width).map((line) => theme.muted(line)),
    '',
    ...section('Why', wrap(why, width), theme),
    '',
    ...section('Establishes', wrap(definition.establishes, width), theme),
    '',
    ...section(
      'Does not establish',
      definition.limitations.flatMap((limitation) =>
        wrapAfter(BULLET, BULLET.length, limitation, width),
      ),
      theme,
    ),
  ];
}

function section(label: string, body: readonly string[], theme: Theme): string[] {
  return [theme.muted(label), ...body];
}

function renderAssessment(assessment: Assessment, theme: Theme, width: number): string[] {
  const { state } = assessment;
  const explanation =
    assessment.state === 'NOT_PROVEN' || assessment.state === 'NOT_APPLICABLE'
      ? assessment.reason
      : stateExplanation[assessment.state];
  const prefix = `${theme[stateTone[state]](state)}  `;

  return [
    ...wrapAfter(prefix, state.length + 2, explanation, width),
    ...evidenceOf(assessment).flatMap((evidence) => renderEvidence(evidence, theme, width)),
  ];
}

/** Names the source of the evidence on one line, then what it observed beneath it. */
function renderEvidence(evidence: Evidence, theme: Theme, width: number): string[] {
  const source = `${evidence.provider} ${evidence.outcome} ${evidence.commit.slice(0, 7)}`;
  const continuation = ' '.repeat(BULLET.length);
  return [
    `${BULLET}${theme.muted(source)}`,
    ...wrap(evidence.summary, width - BULLET.length).map((line) => `${continuation}${line}`),
  ];
}
