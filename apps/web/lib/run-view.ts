import type { CloudRunReport, CloudStage } from '@assurance-compiler/sync';
import type { getRun, SyncState } from './runs';

/** Everything the run detail renders, serializable, so fixtures and real rows share one view. */
export interface RunView {
  readonly id: string;
  readonly repository: { readonly id: string; readonly name: string };
  readonly requestedBase: string;
  readonly baseCommit: string;
  readonly headCommit: string;
  readonly mergeBase: string;
  readonly cliLabel: string;
  readonly cliVersion: string;
  readonly startedAt: string;
  readonly receivedAt: string;
  readonly finishedAt: string | null;
  readonly sync: SyncState;
  readonly report: CloudRunReport | null;
  readonly events: readonly {
    readonly sequence: number;
    readonly at: string;
    readonly stage: CloudStage;
  }[];
  readonly reassessmentAgrees: boolean | null;
  readonly reportHash: string | null;
}

export function toRunView(found: NonNullable<Awaited<ReturnType<typeof getRun>>>): RunView {
  const { run, repository, cli } = found;
  return {
    id: run.id,
    repository: { id: repository.id, name: repository.name },
    requestedBase: run.requestedBase,
    baseCommit: run.baseCommit,
    headCommit: run.headCommit,
    mergeBase: run.mergeBase,
    cliLabel: cli.label,
    cliVersion: run.cliVersion,
    startedAt: run.startedAt.toISOString(),
    receivedAt: run.createdAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    sync: found.sync,
    report: found.report,
    events: found.events.map((event) => ({
      sequence: event.sequence,
      at: event.at.toISOString(),
      stage: event.stage as CloudStage,
    })),
    reassessmentAgrees: run.reassessmentAgrees,
    reportHash: run.reportHash,
  };
}
