import { lstat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  PRISMA_METADATA_TABLE,
  isRepositoryRelativePath,
  isTableName,
} from '@assurance-compiler/prisma';
import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { runCheck, type MigrationVerificationConfig } from './commands/check.js';
import { runLink, runLogin, runLogout, runSync } from './commands/cloud.js';
import { DEFAULT_SERVER } from './cloud/config.js';
import { runDiff } from './commands/diff.js';
import { ExitCode } from './exit-codes.js';
import type { CliEnvironment } from './io.js';
import { readVersion } from './version.js';

interface BaseOptions {
  readonly base?: string;
  readonly json?: boolean;
  readonly debug?: boolean;
}

interface CheckOptions extends BaseOptions {
  readonly seedSql?: string;
  readonly expectTable: readonly string[];
  readonly evidenceOut?: string;
  readonly sync?: boolean;
  readonly server?: string;
}

interface ServerOptions {
  readonly server: string;
}

/**
 * Runs the CLI against injected streams and returns the exit code, without touching
 * global process state. `main.ts` binds it to the real process.
 */
export async function runCli(
  argv: readonly string[],
  environment: CliEnvironment,
): Promise<number> {
  const outcome = { exitCode: 0 };
  const program = createProgram(environment, outcome);
  try {
    await program.parseAsync(argv, { from: 'user' });
    return outcome.exitCode;
  } catch (error) {
    // Commander has already written help, the version, or a usage error.
    if (error instanceof CommanderError) {
      return error.exitCode === 0 ? ExitCode.Success : ExitCode.Usage;
    }
    throw error;
  }
}

function createProgram(environment: CliEnvironment, outcome: { exitCode: number }): Command {
  const program = new Command('assure')
    .description('Infer the verification a code change requires.')
    .version(readVersion())
    .exitOverride()
    .configureOutput({
      writeOut: (text) => {
        environment.stdout.write(text);
      },
      writeErr: (text) => {
        environment.stderr.write(text);
      },
    });

  withBaseOptions(program.command('diff'))
    .description(
      'Plan the assurance required by the change HEAD introduces relative to a base ref.',
    )
    .addHelpText(
      'after',
      [
        '',
        'HEAD is compared with its merge base with the base ref, as in a pull request.',
        'Uncommitted changes are not included.',
        '',
        'Exits 0 whenever a plan is produced, including an INCOMPLETE plan.',
      ].join('\n'),
    )
    .action(async (positionalBase: string | undefined, options: BaseOptions, command: Command) => {
      const base = resolveBase(positionalBase, options.base, command);
      outcome.exitCode = await runDiff(
        { base, json: options.json === true, debug: options.debug === true },
        environment,
      );
    });

  withBaseOptions(program.command('check'))
    .description(
      'Verify the assurance required by the change HEAD introduces relative to a base ref.',
    )
    .option(
      '--seed-sql <path>',
      'repository-relative SQL fixture, committed at the merge base, that populates the baseline',
      onlyOnce('--seed-sql'),
    )
    .option(
      '--expect-table <schema.table>',
      'table that must contain rows before candidate migrations run (repeatable)',
      (value: string, previous: readonly string[]) => [...previous, value],
      [],
    )
    .option(
      '--evidence-out <path>',
      'write the result as a JSON evidence file (never overwrites)',
      onlyOnce('--evidence-out'),
    )
    .option('--sync', 'report progress and the result to the linked workspace')
    .option(
      '--server <url>',
      'control plane to report to (default: the linked server)',
      onlyOnce('--server'),
    )
    .addHelpText(
      'after',
      [
        '',
        'Candidate migrations are verified on top of the merge base with the base ref, in a',
        'temporary PostgreSQL cluster created by this run. Uncommitted changes are not included.',
        '',
        'Exit codes: 0 complete, 1 failed, 2 invalid usage, 3 incomplete or not verified.',
        '',
        'With --sync, stage progress and an allowlisted report go to the repository linked with',
        '`assure link`. A failed upload never changes the local result or the exit code.',
      ].join('\n'),
    )
    .action(async (positionalBase: string | undefined, options: CheckOptions, command: Command) => {
      const base = resolveBase(positionalBase, options.base, command);
      const verification = resolveVerificationConfig(options, command);
      const evidenceOut =
        options.evidenceOut === undefined
          ? undefined
          : await resolveEvidenceDestination(
              resolve(environment.cwd, options.evidenceOut),
              command,
            );
      outcome.exitCode = await runCheck(
        {
          base,
          verification,
          evidenceOut,
          json: options.json === true,
          debug: options.debug === true,
          sync: options.sync === true,
          server: options.server,
        },
        environment,
      );
    });

  program
    .command('login')
    .description('Authorize this machine with the web control plane through a browser.')
    .option('--server <url>', 'control plane URL', DEFAULT_SERVER)
    .action(async (options: ServerOptions) => {
      outcome.exitCode = await runLogin(options.server, environment);
    });

  program
    .command('logout')
    .description('Remove the stored credential for a control plane.')
    .option('--server <url>', 'control plane URL', DEFAULT_SERVER)
    .action(async (options: ServerOptions) => {
      outcome.exitCode = await runLogout(options.server, environment);
    });

  program
    .command('link')
    .description('Bind this checkout to a repository registered in your workspace.')
    .argument('[repository-id]', 'repository ID shown on the repository page; omit to list')
    .option('--server <url>', 'control plane URL', DEFAULT_SERVER)
    .action(async (repositoryId: string | undefined, options: ServerOptions) => {
      outcome.exitCode = await runLink(repositoryId, options.server, environment);
    });

  program
    .command('sync')
    .description('Deliver reports that could not be uploaded when their check ran.')
    .action(async () => {
      outcome.exitCode = await runSync(environment);
    });

  return program;
}

function withBaseOptions(command: Command): Command {
  return command
    .argument('[base]', 'base ref to compare against, such as main')
    .option(
      '--base <ref>',
      'base ref, as an alternative to the positional argument',
      onlyOnce('--base'),
    )
    .option('--json', 'print the result as JSON')
    .option('--debug', 'include diagnostic details in error output');
}

/** Option parser that rejects a repeated option instead of silently keeping the last value. */
function onlyOnce(flag: string): (value: string, previous: string | undefined) => string {
  return (value, previous) => {
    if (previous !== undefined) throw new InvalidArgumentError(`${flag} may be given only once.`);
    return value;
  };
}

function resolveBase(
  positional: string | undefined,
  option: string | undefined,
  command: Command,
): string {
  if (positional !== undefined && option !== undefined) {
    usageError(command, 'pass the base ref as an argument or with --base, not both');
  }
  const base = positional ?? option;
  if (base === undefined) {
    usageError(command, `missing base ref, for example \`assure ${command.name()} main\``);
  }
  return base;
}

/** Verification is configured by both a seed fixture and at least one expected table, or not at all. */
function resolveVerificationConfig(
  options: CheckOptions,
  command: Command,
): MigrationVerificationConfig | undefined {
  const { seedSql, expectTable } = options;
  if (seedSql === undefined && expectTable.length === 0) return undefined;
  if (seedSql === undefined) usageError(command, '--expect-table requires --seed-sql');
  if (expectTable.length === 0)
    usageError(command, '--seed-sql requires at least one --expect-table');
  if (!isRepositoryRelativePath(seedSql)) {
    usageError(
      command,
      `--seed-sql must be a repository-relative path using /, such as prisma/seed.sql`,
    );
  }
  for (const table of expectTable) {
    if (!isTableName(table)) {
      usageError(
        command,
        `--expect-table \`${table}\` must be schema.table using plain identifiers, such as public.User`,
      );
    }
    if (table.split('.')[1] === PRISMA_METADATA_TABLE) {
      usageError(
        command,
        `--expect-table cannot be ${PRISMA_METADATA_TABLE}: Prisma's own records say nothing about application data`,
      );
    }
  }
  return { seedPath: seedSql, expectedTables: [...new Set(expectTable)] };
}

async function resolveEvidenceDestination(path: string, command: Command): Promise<string> {
  // lstat, not access: a dangling symbolic link must also count as an existing destination.
  const accessible = (target: string) =>
    lstat(target).then(
      () => true,
      () => false,
    );
  if (await accessible(path)) {
    usageError(command, `--evidence-out ${path} already exists; choose a new path`);
  }
  if (!(await accessible(dirname(path)))) {
    usageError(command, `--evidence-out directory ${dirname(path)} does not exist`);
  }
  return path;
}

function usageError(command: Command, message: string): never {
  command.error(`error: ${message}`, { exitCode: ExitCode.Usage });
}
