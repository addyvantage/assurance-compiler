import {
  ASSURANCE_STATES,
  CHANGE_SURFACES,
  MIGRATION_EXECUTION_STAGES,
  REQUIREMENTS,
} from '@assurance-compiler/core';
import type { MigrationExecutionSubject } from '@assurance-compiler/core';
import type { CloudRunEvent, CloudRunReport, CloudStage } from './report.js';
import { CLOUD_REPORT_VERSION } from './report.js';

/**
 * Ingress validation of the allowlist. Unknown keys are rejected, every string is bounded,
 * and identifiers must match their expected shape. The result is either a value of exactly
 * the payload type or the first reason it is not.
 */
export type Parsed<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/** Serialized size above which a payload is refused before parsing. */
export const MAX_REPORT_BYTES = 256 * 1024;
export const MAX_EVENT_BYTES = 4 * 1024;

const MAX_ITEMS = 500;
const SHORT = 128;
const PATH = 1024;
const STAGE_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'cancelled'] as const;
const VERDICTS = ['COMPLETE', 'INCOMPLETE', 'FAILED'] as const;
const FILE_STATUSES = ['added', 'modified', 'deleted', 'renamed'] as const;
const CLEANUP = ['succeeded', 'failed'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OID = /^[0-9a-f]{40,64}$/;
const SQLSTATE = /^[0-9A-Z]{5}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MIGRATION_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,62}\.[A-Za-z_][A-Za-z0-9_]{0,62}$/;

class Invalid extends Error {}

type Obj = Record<string, unknown>;

export function parseCloudRunReport(value: unknown): Parsed<CloudRunReport> {
  try {
    return { ok: true, value: readReport(value) };
  } catch (error) {
    return { ok: false, reason: error instanceof Invalid ? error.message : 'unreadable payload' };
  }
}

export function parseCloudRunEvent(value: unknown): Parsed<CloudRunEvent> {
  try {
    const event = object(value, 'event', ['version', 'runId', 'sequence', 'at', 'stage']);
    return {
      ok: true,
      value: {
        version: version(event['version']),
        runId: pattern(event['runId'], UUID, 'runId'),
        sequence: integer(event['sequence'], 1, 1_000_000, 'sequence'),
        at: isoDate(event['at'], 'at'),
        stage: readStage(event['stage']),
      },
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Invalid ? error.message : 'unreadable payload' };
  }
}

function readReport(value: unknown): CloudRunReport {
  const report = object(value, 'report', [
    'version',
    'runId',
    'cli',
    'startedAt',
    'finishedAt',
    'base',
    'head',
    'mergeBase',
    'detectors',
    'changes',
    'requirements',
    'verdict',
    'verification',
    'localArtifact',
  ]);
  const cli = object(report['cli'], 'cli', ['version']);
  const verification = report['verification'];
  const localArtifact = report['localArtifact'];
  return {
    version: version(report['version']),
    runId: pattern(report['runId'], UUID, 'runId'),
    cli: { version: text(cli['version'], SHORT, 'cli.version') },
    startedAt: isoDate(report['startedAt'], 'startedAt'),
    finishedAt: isoDate(report['finishedAt'], 'finishedAt'),
    base: readRevision(report['base'], 'base'),
    head: readRevision(report['head'], 'head'),
    mergeBase: pattern(report['mergeBase'], OID, 'mergeBase'),
    detectors: list(report['detectors'], 'detectors', (entry) => text(entry, SHORT, 'detector')),
    changes: list(report['changes'], 'changes', readChange),
    requirements: list(report['requirements'], 'requirements', readRequirement),
    verdict: oneOf(report['verdict'], VERDICTS, 'verdict'),
    verification: verification === null ? null : readVerification(verification),
    ...(localArtifact === undefined
      ? {}
      : {
          localArtifact: {
            sha256: pattern(
              object(localArtifact, 'localArtifact', ['sha256'])['sha256'],
              SHA256,
              'localArtifact.sha256',
            ),
          },
        }),
  };
}

function readRevision(value: unknown, name: string): { ref: string; commit: string } {
  const revision = object(value, name, ['ref', 'commit']);
  return {
    ref: text(revision['ref'], PATH, `${name}.ref`),
    commit: pattern(revision['commit'], OID, `${name}.commit`),
  };
}

function readChange(value: unknown): CloudRunReport['changes'][number] {
  const change = object(value, 'change', ['surface', 'detector', 'files']);
  return {
    surface: oneOf(change['surface'], CHANGE_SURFACES, 'change.surface'),
    detector: text(change['detector'], SHORT, 'change.detector'),
    files: list(change['files'], 'change.files', (entry) => {
      const file = object(entry, 'file', ['path', 'status', 'previousPath']);
      const status = oneOf(file['status'], FILE_STATUSES, 'file.status');
      const path = text(file['path'], PATH, 'file.path');
      if (status === 'renamed') {
        return { path, status, previousPath: text(file['previousPath'], PATH, 'previousPath') };
      }
      if (file['previousPath'] !== undefined) throw new Invalid('previousPath without rename');
      return { path, status };
    }),
  };
}

function readRequirement(value: unknown): CloudRunReport['requirements'][number] {
  const requirement = object(value, 'requirement', ['id', 'state', 'triggeredBy']);
  return {
    id: oneOf(requirement['id'], REQUIREMENTS, 'requirement.id'),
    state: oneOf(requirement['state'], ASSURANCE_STATES, 'requirement.state'),
    triggeredBy: list(requirement['triggeredBy'], 'triggeredBy', (entry) =>
      oneOf(entry, CHANGE_SURFACES, 'triggeredBy'),
    ),
  };
}

function readVerification(value: unknown): NonNullable<CloudRunReport['verification']> {
  const record = object(value, 'verification', [
    'runId',
    'provider',
    'environment',
    'subject',
    'stages',
    'populatedTables',
    'migrationFailure',
    'cleanup',
  ]);
  const provider = object(record['provider'], 'provider', ['id', 'version']);
  const environment = object(record['environment'], 'environment', ['postgres', 'prisma']);
  const cleanup = object(record['cleanup'], 'cleanup', ['status', 'leftoverCount']);
  const failure = record['migrationFailure'];
  return {
    runId: pattern(record['runId'], UUID, 'verification.runId'),
    provider: {
      id: text(provider['id'], SHORT, 'provider.id'),
      version: text(provider['version'], SHORT, 'provider.version'),
    },
    environment: {
      ...(environment['postgres'] === undefined
        ? {}
        : { postgres: text(environment['postgres'], SHORT, 'environment.postgres') }),
      ...(environment['prisma'] === undefined
        ? {}
        : { prisma: text(environment['prisma'], SHORT, 'environment.prisma') }),
    },
    subject: readSubject(record['subject']),
    stages: list(record['stages'], 'stages', readStage),
    populatedTables: list(record['populatedTables'], 'populatedTables', (entry) => {
      const row = object(entry, 'populatedTable', ['table', 'populated']);
      return {
        table: pattern(row['table'], TABLE, 'populatedTable.table'),
        populated: boolean(row['populated'], 'populatedTable.populated'),
      };
    }),
    ...(failure === undefined
      ? {}
      : {
          migrationFailure: (() => {
            const entry = object(failure, 'migrationFailure', ['migration', 'sqlState']);
            return {
              migration: pattern(entry['migration'], MIGRATION_NAME, 'migrationFailure.migration'),
              sqlState: pattern(entry['sqlState'], SQLSTATE, 'migrationFailure.sqlState'),
            };
          })(),
        }),
    cleanup: {
      status: oneOf(cleanup['status'], CLEANUP, 'cleanup.status'),
      leftoverCount: integer(cleanup['leftoverCount'], 0, MAX_ITEMS, 'cleanup.leftoverCount'),
    },
  };
}

function readSubject(value: unknown): MigrationExecutionSubject {
  const subject = object(value, 'subject', [
    'baseline',
    'candidate',
    'schema',
    'seed',
    'baselineMigrations',
    'candidateMigrations',
    'expectedTables',
  ]);
  const schema = object(subject['schema'], 'schema', ['baseline', 'candidate']);
  const seed = object(subject['seed'], 'seed', ['path', 'blob']);
  const migration = (entry: unknown) => {
    const item = object(entry, 'migration', ['name', 'blob']);
    return {
      name: pattern(item['name'], MIGRATION_NAME, 'migration.name'),
      blob: pattern(item['blob'], OID, 'migration.blob'),
    };
  };
  return {
    baseline: pattern(subject['baseline'], OID, 'subject.baseline'),
    candidate: pattern(subject['candidate'], OID, 'subject.candidate'),
    schema: {
      baseline: pattern(schema['baseline'], OID, 'schema.baseline'),
      candidate: pattern(schema['candidate'], OID, 'schema.candidate'),
    },
    seed: {
      path: text(seed['path'], PATH, 'seed.path'),
      blob: pattern(seed['blob'], OID, 'seed.blob'),
    },
    baselineMigrations: list(subject['baselineMigrations'], 'baselineMigrations', migration),
    candidateMigrations: list(subject['candidateMigrations'], 'candidateMigrations', migration),
    expectedTables: list(subject['expectedTables'], 'expectedTables', (entry) =>
      pattern(entry, TABLE, 'expectedTable'),
    ),
  };
}

function readStage(value: unknown): CloudStage {
  const stage = object(value, 'stage', ['name', 'status', 'startedAt', 'durationMs']);
  return {
    name: oneOf(stage['name'], MIGRATION_EXECUTION_STAGES, 'stage.name'),
    status: oneOf(stage['status'], STAGE_STATUSES, 'stage.status'),
    ...(stage['startedAt'] === undefined
      ? {}
      : { startedAt: isoDate(stage['startedAt'], 'stage.startedAt') }),
    ...(stage['durationMs'] === undefined
      ? {}
      : { durationMs: integer(stage['durationMs'], 0, 86_400_000, 'stage.durationMs') }),
  };
}

function object(value: unknown, name: string, allowed: readonly string[]): Obj {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Invalid(`${name} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Invalid(`${name}.${key} is not an allowed field`);
  }
  return value as Obj;
}

function list<T>(value: unknown, name: string, read: (entry: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Invalid(`${name} must be an array`);
  if (value.length > MAX_ITEMS)
    throw new Invalid(`${name} has more than ${String(MAX_ITEMS)} items`);
  return value.map(read);
}

function text(value: unknown, max: number, name: string): string {
  if (typeof value !== 'string' || value === '' || value.length > max) {
    throw new Invalid(`${name} must be a string of 1 to ${String(max)} characters`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    throw new Invalid(`${name} contains control characters`);
  }
  return value;
}

function pattern(value: unknown, shape: RegExp, name: string): string {
  const string = text(value, PATH, name);
  if (!shape.test(string)) throw new Invalid(`${name} has an unexpected shape`);
  return string;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  choices: T,
  name: string,
): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) {
    throw new Invalid(`${name} must be one of ${choices.join(', ')}`);
  }
  return value;
}

function integer(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Invalid(`${name} must be an integer between ${String(min)} and ${String(max)}`);
  }
  return value;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Invalid(`${name} must be a boolean`);
  return value;
}

function isoDate(value: unknown, name: string): string {
  const string = text(value, SHORT, name);
  if (Number.isNaN(Date.parse(string)) || !/^\d{4}-\d{2}-\d{2}T/.test(string)) {
    throw new Invalid(`${name} must be an ISO 8601 timestamp`);
  }
  return string;
}

function version(value: unknown): typeof CLOUD_REPORT_VERSION {
  if (value !== CLOUD_REPORT_VERSION) {
    throw new Invalid(`version must be ${String(CLOUD_REPORT_VERSION)}`);
  }
  return CLOUD_REPORT_VERSION;
}
