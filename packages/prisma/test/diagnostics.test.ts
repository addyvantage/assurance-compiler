import { describe, expect, it } from 'vitest';
import {
  firstErrorLine,
  parseMigrateDeployOutput,
  parsePsqlError,
  prismaErrorLine,
} from '../src/migration-execution/diagnostics.js';

/** Captured from `prisma migrate deploy` 6.19.3 against PostgreSQL 16.14. */
const P3018_OUTPUT = `Prisma schema loaded from prisma\\schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "127.0.0.1:55439"

2 migrations found in prisma/migrations

Applying migration \`0002_age\`
Error: P3018

A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve

Migration name: 0002_age

Database error code: 23502

Database error:
ERROR: column "age" of relation "User" contains null values

DbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E23502), message: "column \\"age\\" of relation \\"User\\" contains null values", detail: None, hint: None, position: None, where_: None, schema: Some("public"), table: Some("User"), column: Some("age"), datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(6116), routine: Some("ATRewriteTable") }
`;

describe('parseMigrateDeployOutput', () => {
  it('extracts the failing migration and database error from P3018 output', () => {
    expect(parseMigrateDeployOutput(P3018_OUTPUT)).toEqual({
      prismaCode: 'P3018',
      migration: '0002_age',
      databaseError: {
        sqlState: '23502',
        message: 'column "age" of relation "User" contains null values',
      },
    });
  });

  it('keeps no DETAIL content, which can contain row values', () => {
    const output = P3018_OUTPUT.replace(
      'Database error code: 23502',
      'Database error code: 23505',
    ).replace(
      'ERROR: column "age" of relation "User" contains null values',
      'ERROR: could not create unique index "User_email_key"\nDETAIL: Key (email)=(ada@example.com) is duplicated.',
    );

    const failure = parseMigrateDeployOutput(output);

    expect(failure.databaseError).toEqual({
      sqlState: '23505',
      message: 'could not create unique index "User_email_key"',
    });
    expect(JSON.stringify(failure)).not.toContain('ada@example.com');
  });

  it('drops messages of data exceptions, which quote input values', () => {
    const output = P3018_OUTPUT.replace(
      'Database error code: 23502',
      'Database error code: 22P02',
    ).replace(
      'ERROR: column "age" of relation "User" contains null values',
      'ERROR: invalid input syntax for type integer: "secret-value"',
    );

    expect(parseMigrateDeployOutput(output).databaseError).toEqual({ sqlState: '22P02' });
  });

  it('drops a message the migration raised itself, whatever SQLSTATE it chose', () => {
    const output = P3018_OUTPUT.replace(
      'Database error code: 23502',
      'Database error code: 23505',
    ).replace(
      'ERROR: column "age" of relation "User" contains null values',
      'ERROR: cannot migrate: ada@example.com, grace@example.com',
    );

    expect(parseMigrateDeployOutput(output).databaseError).toEqual({ sqlState: '23505' });
  });

  it('drops a known shape whose identifier slot exceeds the PostgreSQL identifier limit', () => {
    const output = P3018_OUTPUT.replace(
      'Database error code: 23502',
      'Database error code: 42P01',
    ).replace(
      'ERROR: column "age" of relation "User" contains null values',
      `ERROR: relation "${'ada@example.com, '.repeat(5)}" does not exist`,
    );

    expect(parseMigrateDeployOutput(output).databaseError).toEqual({ sqlState: '42P01' });
  });

  it('drops syntax errors, which quote SQL', () => {
    const output = P3018_OUTPUT.replace(
      'Database error code: 23502',
      'Database error code: 42601',
    ).replace(
      'ERROR: column "age" of relation "User" contains null values',
      'ERROR: syntax error at or near "RETURNIN"',
    );

    expect(parseMigrateDeployOutput(output).databaseError).toEqual({ sqlState: '42601' });
  });

  it('reports no database error for connection failures', () => {
    const output = "Error: P1001: Can't reach database server at `127.0.0.1:1`\n";

    expect(parseMigrateDeployOutput(output)).toEqual({ prismaCode: 'P1001' });
  });
});

describe('parsePsqlError', () => {
  it('reads the SQLSTATE and message but never the failing row', () => {
    const output = [
      'psql:D:/runs/seed.sql:1: ERROR:  23502: null value in column "email" of relation "User" violates not-null constraint',
      'DETAIL:  Failing row contains (3, null).',
      'LOCATION:  ExecConstraints, execMain.c:2063',
    ].join('\n');

    expect(parsePsqlError(output)).toEqual({
      sqlState: '23502',
      message: 'null value in column "email" of relation "User" violates not-null constraint',
    });
  });

  it('returns nothing when psql reports no database error', () => {
    expect(parsePsqlError('psql: error: connection to server failed')).toBeUndefined();
  });
});

describe('prismaErrorLine', () => {
  it('keeps a line carrying a Prisma error code', () => {
    expect(
      prismaErrorLine("Error: P1001: Can't reach database server at `127.0.0.1:1`\n", []),
    ).toBe("Error: P1001: Can't reach database server at `127.0.0.1:1`");
  });

  it('never returns raw database text, which Prisma can print with row values', () => {
    expect(prismaErrorLine('Error: Failing row contains (5, null).\n', [])).toBeUndefined();
  });
});

describe('firstErrorLine', () => {
  it('removes secrets and bounds the length', () => {
    const line = firstErrorLine(`noise\nError: failed for password hunter2 ${'x'.repeat(500)}`, [
      'hunter2',
    ]);

    expect(line).toContain('[redacted]');
    expect(line).not.toContain('hunter2');
    expect(line?.length).toBeLessThanOrEqual(300);
  });
});
