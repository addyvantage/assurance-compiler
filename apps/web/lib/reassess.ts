import { assessMigrationExecution, reduceVerdict } from '@assurance-compiler/core';
import type { CloudRunReport } from '@assurance-compiler/sync';

/** Typed as string on purpose: the catalog has one requirement today, and this must not assume it. */
const REQUIREMENT = 'NONEMPTY_MIGRATION_EXECUTION' as string;

/**
 * Reruns the engine on the reported observation and compares the result with the states the
 * CLI reported. Agreement means the report is internally coherent under the same semantics;
 * it does not mean the execution happened. Disagreement is stored and displayed.
 */
export function reassess(report: CloudRunReport): { agrees: boolean; detail: string } {
  const reported = report.requirements.find((r) => r.id === REQUIREMENT);
  if (reported === undefined) {
    return report.verification === null
      ? { agrees: true, detail: 'No requirement applied and no verification was reported.' }
      : { agrees: false, detail: 'A verification was reported for a requirement that is absent.' };
  }
  if (report.verification === null) {
    const agrees = reported.state === 'MISSING' || reported.state === 'NOT_PROVEN';
    return {
      agrees,
      detail: agrees
        ? 'No verification ran; the reported state does not claim evidence.'
        : `The CLI reported ${reported.state} without any verification record.`,
    };
  }
  const verification = report.verification;
  const assessment = assessMigrationExecution(verification.subject, {
    requirement: 'NONEMPTY_MIGRATION_EXECUTION',
    runId: verification.runId,
    origin: 'local',
    provider: verification.provider,
    environment: verification.environment,
    subject: verification.subject,
    stages: verification.stages,
    populatedTables: verification.populatedTables,
    ...(verification.migrationFailure === undefined
      ? {}
      : { migrationFailure: verification.migrationFailure }),
    cleanup: { status: verification.cleanup.status, leftovers: [] },
  });
  const verdict = reduceVerdict(report.requirements.map((r) => r.state));
  const agrees = assessment.state === reported.state && verdict === report.verdict;
  return {
    agrees,
    detail: agrees
      ? `The engine reaches ${assessment.state} from the reported observation.`
      : `The engine reaches ${assessment.state} from the reported observation, but the CLI reported ${reported.state}.`,
  };
}
