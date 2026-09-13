import type { RequirementDefinition } from './requirement-definition.js';

export const nonemptyMigrationExecution = {
  id: 'NONEMPTY_MIGRATION_EXECUTION',
  title: 'Migrations execute against a populated database',
  rationale: 'A migration that succeeds on an empty database may still fail against existing rows.',
  establishes:
    'The candidate migrations apply without error to a database that already contains data.',
  limitations: [
    'Existing data is preserved or transformed correctly',
    'The migration completes within production time or lock budgets',
    'Application code stays compatible with the schema during rollout',
    'The populated data reflects every shape of production data',
  ],
} satisfies RequirementDefinition;
