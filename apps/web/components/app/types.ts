import type { StatusKind } from '@/lib/status-kind';

export interface ShellRepository {
  readonly id: string;
  readonly name: string;
  readonly kind: StatusKind;
  /** The status in words, for anyone who cannot see the icon. */
  readonly label: string;
}

export interface ShellRun {
  readonly id: string;
  readonly repositoryName: string;
  readonly kind: StatusKind;
  readonly label: string;
  readonly candidate: string;
  readonly startedAt: string;
}
