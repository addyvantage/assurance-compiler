import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/*
 * Better Auth tables. Property names must match Better Auth's field names; the database
 * column names are ours.
 */

export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);

export const account = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('accounts_user_idx').on(table.userId)],
);

export const verification = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Pending and completed CLI device-authorization requests (Better Auth plugin). */
export const deviceCode = pgTable('device_codes', {
  id: text('id').primaryKey(),
  deviceCode: text('device_code').notNull().unique(),
  userCode: text('user_code').notNull().unique(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: text('status').notNull(),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  pollingInterval: integer('polling_interval'),
  clientId: text('client_id'),
  scope: text('scope'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/*
 * Product tables. Every row belongs to exactly one workspace, and every query filters by the
 * workspace resolved from the caller's session, never from client input.
 */

export const workspace = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repository = pgTable(
  'repositories',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** A URL the user typed. It proves nothing about access to that remote. */
    remoteUrl: text('remote_url'),
    /** How the repository is connected. Only `manual` exists in this slice. */
    connection: text('connection').notNull().default('manual'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('repositories_workspace_name_idx').on(table.workspaceId, table.name)],
);

/** A CLI that completed device authorization. Its auth session is the credential. */
export const cliSession = pgTable(
  'cli_sessions',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    /** Null once revoked: the credential is gone, the run history stays. */
    authSessionId: text('auth_session_id')
      .unique()
      .references(() => session.id, { onDelete: 'set null' }),
    /** Host name the CLI reported. Untrusted text. */
    label: text('label').notNull(),
    cliVersion: text('cli_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('cli_sessions_workspace_idx').on(table.workspaceId)],
);

/** A CLI session bound to a repository. Linking is per CLI, not a device presence signal. */
export const cliLink = pgTable(
  'cli_links',
  {
    cliSessionId: text('cli_session_id')
      .notNull()
      .references(() => cliSession.id, { onDelete: 'cascade' }),
    repositoryId: text('repository_id')
      .notNull()
      .references(() => repository.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.cliSessionId, table.repositoryId] }),
    index('cli_links_repository_idx').on(table.repositoryId),
  ],
);

/**
 * One local execution reported by a CLI. `status` is synchronization state only: whether the
 * terminal report has arrived. Assessment lives inside the validated report.
 */
export const run = pgTable(
  'runs',
  {
    /** The CLI's run ID (UUID). Equals the provider's run ID when verification ran. */
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    repositoryId: text('repository_id')
      .notNull()
      .references(() => repository.id, { onDelete: 'cascade' }),
    cliSessionId: text('cli_session_id')
      .notNull()
      .references(() => cliSession.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ['running', 'reported'] }).notNull(),
    requestedBase: text('requested_base').notNull(),
    baseCommit: text('base_commit').notNull(),
    headCommit: text('head_commit').notNull(),
    mergeBase: text('merge_base').notNull(),
    cliVersion: text('cli_version').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Denormalized from the report for listing and filtering. */
    verdict: text('verdict', { enum: ['COMPLETE', 'INCOMPLETE', 'FAILED'] }),
    /** The validated cloud report (payload version 1), exactly as accepted. */
    report: jsonb('report'),
    /** sha256 of the canonical report bytes. Not the local evidence file's hash. */
    reportHash: text('report_hash'),
    /** Whether the engine, rerun on the reported observation, agrees with the reported states. */
    reassessmentAgrees: boolean('reassessment_agrees'),
  },
  (table) => [
    index('runs_workspace_started_idx').on(table.workspaceId, table.startedAt),
    index('runs_repository_started_idx').on(table.repositoryId, table.startedAt),
  ],
);

/** Stage transitions in per-run order. Idempotent on (run, sequence). */
export const runEvent = pgTable(
  'run_events',
  {
    runId: text('run_id')
      .notNull()
      .references(() => run.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull(),
    stage: jsonb('stage').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.runId, table.sequence] })],
);
