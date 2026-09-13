/** What `assure check --sync` sends, and never sends. One list, wherever upload is explained. */
export const SENT = [
  'Run and repository IDs, commit and Git blob IDs',
  'The requested branch name',
  'Requirement and provider IDs',
  'Stage statuses and timings',
  'PostgreSQL and Prisma versions, cleanup status',
  'SQLSTATE codes',
  'Seed path, migration names and expected table names',
  'Changed file paths the detector recognized',
];

export const NEVER_SENT = [
  'Database messages and stage details',
  'Tool output and stack traces',
  'SQL, seed contents and source files',
  'Row values',
  'Local paths and credentials',
];
