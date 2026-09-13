/** A database error reduced to what evidence may safely contain. */
export interface DatabaseError {
  readonly sqlState: string;
  readonly message?: string;
}

/**
 * SQLSTATE classes whose PostgreSQL messages name schema objects but never row values:
 * integrity constraint violations (23) and invalid statements (42). Other messages, such as
 * data exceptions quoting the offending input, are dropped. DETAIL lines are never kept,
 * because they routinely contain row values.
 */
const IDENTIFIER_ONLY_CLASSES = new Set(['23', '42']);
const MAX_DETAIL_LENGTH = 300;

/** The failure described by `prisma migrate deploy` output, when it names one. */
export interface MigrateDeployFailure {
  readonly prismaCode?: string;
  readonly migration?: string;
  readonly databaseError?: DatabaseError;
}

export function parseMigrateDeployOutput(output: string): MigrateDeployFailure {
  const prismaCode = /^Error: (P\d{4})\b/m.exec(output)?.[1];
  const migration = /^Migration name: (\S+)\s*$/m.exec(output)?.[1];
  const sqlState = /^Database error code: ([0-9A-Z]{5})\s*$/m.exec(output)?.[1];
  const message = /^Database error:\s*\r?\n(?:ERROR|FATAL): (.+?)\s*$/m.exec(output)?.[1];
  return {
    ...(prismaCode === undefined ? {} : { prismaCode }),
    ...(migration === undefined ? {} : { migration }),
    ...(sqlState === undefined ? {} : { databaseError: databaseError(sqlState, message) }),
  };
}

/** Parses the first error psql reports with `VERBOSITY=verbose`, such as `ERROR:  23502: …`. */
export function parsePsqlError(output: string): DatabaseError | undefined {
  const match = /ERROR:\s+([0-9A-Z]{5}):\s+(.+?)\s*$/m.exec(output);
  return match?.[1] === undefined ? undefined : databaseError(match[1], match[2]);
}

export function describeDatabaseError(error: DatabaseError): string {
  return error.message === undefined
    ? `SQLSTATE ${error.sqlState}`
    : `SQLSTATE ${error.sqlState}: ${error.message}`;
}

/**
 * The first Prisma error line that starts with a Prisma error code, such as
 * `Error: P1001: Can't reach database server`. Other Prisma error text can quote row values
 * inline, so it is never returned.
 */
export function prismaErrorLine(output: string, secrets: readonly string[]): string | undefined {
  const line = /^Error: P\d{4}\b.*$/m.exec(output)?.[0];
  return line === undefined ? undefined : bound(redact(line.trim(), secrets));
}

/** The first line of tool output that reports an error, bounded and with secrets removed. */
export function firstErrorLine(output: string, secrets: readonly string[]): string | undefined {
  const line = output
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find(
      (candidate) =>
        /^(error|fatal|panic)\b|^[\w-]+: (error|fatal)\b/i.test(candidate) ||
        // Server log lines carry a timestamp prefix before the severity.
        /\b(FATAL|PANIC):/.test(candidate),
    );
  return line === undefined ? undefined : bound(redact(line, secrets));
}

function databaseError(sqlState: string, message: string | undefined): DatabaseError {
  return message !== undefined && IDENTIFIER_ONLY_CLASSES.has(sqlState.slice(0, 2))
    ? { sqlState, message: bound(message) }
    : { sqlState };
}

function redact(text: string, secrets: readonly string[]): string {
  return secrets.reduce(
    (redacted, secret) => (secret === '' ? redacted : redacted.replaceAll(secret, '[redacted]')),
    text,
  );
}

function bound(text: string): string {
  return text.length <= MAX_DETAIL_LENGTH ? text : `${text.slice(0, MAX_DETAIL_LENGTH - 1)}…`;
}
