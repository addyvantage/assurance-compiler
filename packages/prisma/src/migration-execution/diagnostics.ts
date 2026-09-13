/** A database error reduced to what evidence may safely contain. */
export interface DatabaseError {
  readonly sqlState: string;
  readonly message?: string;
}

/**
 * PostgreSQL's own messages whose only variable parts are quoted schema identifiers, each at
 * most 63 characters as PostgreSQL limits them. A message is kept only when it has one of these
 * shapes. Any other text is dropped, including messages the migration itself raises
 * (`RAISE … USING ERRCODE`), which can carry any SQLSTATE and any row values, and syntax
 * errors, which quote SQL. DETAIL lines are never kept. Identifiers themselves are retained:
 * a migration that builds them from data puts that data into schema names, and into evidence.
 */
const IDENTIFIER = '"[^"]{1,63}"';
const KNOWN_MESSAGES = [
  'column {} of relation {} contains null values',
  'null value in column {} of relation {} violates not-null constraint',
  'duplicate key value violates unique constraint {}',
  'could not create unique index {}',
  'check constraint {} of relation {} is violated by some row',
  'new row for relation {} violates check constraint {}',
  'insert or update on table {} violates foreign key constraint {}',
  'update or delete on table {} violates foreign key constraint {} on table {}',
  'relation {} does not exist',
  'relation {} already exists',
  'column {} does not exist',
  'column {} of relation {} does not exist',
  'column {} of relation {} already exists',
  'constraint {} of relation {} does not exist',
  'type {} does not exist',
  'type {} already exists',
].map((template) => new RegExp(`^${template.replaceAll('{}', IDENTIFIER)}$`));
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
  return message !== undefined && KNOWN_MESSAGES.some((known) => known.test(message))
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
