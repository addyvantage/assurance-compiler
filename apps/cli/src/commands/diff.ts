import { buildAssurancePlan, toPlanDocument, type AssurancePlan } from '@assurance-compiler/core';
import { findRepositoryRoot, hasUncommittedChanges, readChangeSet } from '@assurance-compiler/git';
import { detectors } from '../detectors.js';
import { ExitCode } from '../exit-codes.js';
import type { CliEnvironment } from '../io.js';
import { renderError } from '../output/error-text.js';
import { layoutWidth } from '../output/layout.js';
import { renderPlanText } from '../output/plan-text.js';
import { createTheme } from '../output/theme.js';

export interface DiffRequest {
  readonly base: string;
  readonly json: boolean;
  readonly debug: boolean;
}

/** Plans the assurance required by the change HEAD introduces relative to a base ref. */
export async function runDiff(
  request: DiffRequest,
  environment: CliEnvironment,
): Promise<ExitCode> {
  const { stdout, stderr } = environment;
  try {
    const root = await findRepositoryRoot(environment.cwd);
    const [changeSet, uncommittedChanges] = await Promise.all([
      readChangeSet(root, request.base),
      hasUncommittedChanges(root),
    ]);
    const plan = buildAssurancePlan(changeSet, detectors);

    if (request.json) {
      stdout.write(renderJson(plan));
      if (uncommittedChanges) {
        stderr.write('note: uncommitted changes are not included in this plan\n');
      }
    } else {
      stdout.write(
        renderPlanText(plan, {
          theme: createTheme(stdout.color),
          width: layoutWidth(stdout.columns),
          uncommittedChanges,
        }),
      );
    }
    return ExitCode.Success;
  } catch (error) {
    stderr.write(renderError(error, createTheme(stderr.color), request.debug));
    return ExitCode.Error;
  }
}

function renderJson(plan: AssurancePlan): string {
  return `${JSON.stringify(toPlanDocument(plan), null, 2)}\n`;
}
