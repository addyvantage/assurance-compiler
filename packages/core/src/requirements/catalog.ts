import { nonemptyMigrationExecution } from './nonempty-migration-execution.js';
import type { RequirementDefinition, RequirementId } from './requirement-definition.js';

/** The definition of every requirement. Total over `RequirementId`. */
export const requirementDefinitions: {
  readonly [Id in RequirementId]: RequirementDefinition<Id>;
} = {
  NONEMPTY_MIGRATION_EXECUTION: nonemptyMigrationExecution,
};
