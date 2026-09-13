import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  assessMigrationExecution,
  buildAssurancePlan,
  planVerdict,
  toCheckDocument,
  withAssessment,
  type AssurancePlan,
  type MigrationExecutionObservation,
  type Verdict,
} from '@assurance-compiler/core';
import { findRepositoryRoot, hasUncommittedChanges, readChangeSet } from '@assurance-compiler/git';
import { resolveMigrationInputs, verifyMigrationExecution } from '@assurance-compiler/prisma';
import { detectors } from '../detectors.js';
import { CheckExitCode } from '../exit-codes.js';
import type { CliEnvironment } from '../io.js';
import { renderCheckText } from '../output/check-text.js';
import { CliError, renderError } from '../output/error-text.js';
import { layoutWidth } from '../output/layout.js';
import { createTheme } from '../output/theme.js';

const REQUIREMENT = 'NONEMPTY_MIGRATION_EXECUTION';

export interface MigrationVerificationConfig {
  readonly seedPath: string;
  readonly expectedTables: readonly string[];
}

export interface CheckRequest {
  readonly base: string;
  /** `undefined` when no migration verification is configured. */
  readonly verification: MigrationVerificationConfig | undefined;
  /** Absolute path of a file that does not exist yet. */
  readonly evidenceOut: string | undefined;
  readonly json: boolean;
  readonly debug: boolean;
}

export interface EvidenceArtifact {
  readonly path: string;
  readonly sha256: string;
}

/** Verifies the assurance the change HEAD introduces requires, and exits with its verdict. */
export async function runCheck(
  request: CheckRequest,
  environment: CliEnvironment,
): Promise<CheckExitCode> {
  const { stdout, stderr } = environment;
  try {
    const root = await findRepositoryRoot(environment.cwd);
    const [changeSet, uncommittedChanges] = await Promise.all([
      readChangeSet(root, request.base),
      hasUncommittedChanges(root),
    ]);
    const { plan, verification } = await assess(
      buildAssurancePlan(changeSet, detectors),
      root,
      request.verification,
      environment.signal,
    );
    const document = toCheckDocument(plan, verification);

    let artifact: EvidenceArtifact | undefined;
    let artifactError: unknown;
    if (request.evidenceOut !== undefined) {
      artifact = await writeEvidence(
        request.evidenceOut,
        `${JSON.stringify(document, null, 2)}\n`,
      ).catch((error: unknown) => {
        artifactError = error;
        return undefined;
      });
    }

    if (request.json) {
      stdout.write(
        `${JSON.stringify(artifact === undefined ? document : { ...document, artifact }, null, 2)}\n`,
      );
      if (uncommittedChanges)
        stderr.write('note: uncommitted changes are not included in this check\n');
    } else {
      const theme = createTheme(stdout.color);
      stdout.write(
        renderCheckText(
          { plan, verification, artifact, uncommittedChanges },
          { theme, width: layoutWidth(stdout.columns) },
        ),
      );
    }

    if (artifactError !== undefined) {
      stderr.write(renderError(artifactError, createTheme(stderr.color), request.debug));
    }
    const operationalProblem =
      verification?.cleanup.status === 'failed' || artifactError !== undefined;
    return exitCodeFor(planVerdict(plan), operationalProblem);
  } catch (error) {
    stderr.write(renderError(error, createTheme(stderr.color), request.debug));
    return CheckExitCode.Incomplete;
  }
}

/**
 * Assesses NONEMPTY_MIGRATION_EXECUTION when the plan requires it and verification is configured.
 * No database is started unless the requirement applies and its inputs are valid.
 */
async function assess(
  plan: AssurancePlan,
  root: string,
  config: MigrationVerificationConfig | undefined,
  signal: AbortSignal | undefined,
): Promise<{ plan: AssurancePlan; verification: MigrationExecutionObservation | null }> {
  const required = plan.requirements.map((instance) => instance.requirement).includes(REQUIREMENT);
  if (!required || config === undefined) return { plan, verification: null };

  const resolution = await resolveMigrationInputs(root, {
    baseline: plan.changeSet.mergeBase,
    candidate: plan.changeSet.head.commit,
    seedPath: config.seedPath,
    expectedTables: config.expectedTables,
  });
  if (!resolution.ok) {
    const assessment = { state: 'NOT_PROVEN', evidence: [], reason: resolution.reason } as const;
    return { plan: withAssessment(plan, REQUIREMENT, assessment), verification: null };
  }

  const observation = await verifyMigrationExecution(
    root,
    resolution.inputs,
    signal === undefined ? {} : { signal },
  );
  const assessment = assessMigrationExecution(resolution.inputs.subject, observation);
  return { plan: withAssessment(plan, REQUIREMENT, assessment), verification: observation };
}

/** Creates the evidence file, refusing to replace anything that already exists. */
async function writeEvidence(path: string, content: string): Promise<EvidenceArtifact> {
  try {
    await writeFile(path, content, { flag: 'wx' });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
    throw new CliError(
      `Could not write the evidence file ${path} (${code}).`,
      'The result above was not saved.',
    );
  }
  return { path, sha256: createHash('sha256').update(content).digest('hex') };
}

/**
 * An operational problem, such as failed cleanup or an unwritten evidence file, never hides a
 * FAILED verdict, but it does prevent a successful exit.
 */
function exitCodeFor(verdict: Verdict, operationalProblem: boolean): CheckExitCode {
  if (verdict === 'FAILED') return CheckExitCode.Failed;
  if (verdict === 'INCOMPLETE' || operationalProblem) return CheckExitCode.Incomplete;
  return CheckExitCode.Complete;
}
