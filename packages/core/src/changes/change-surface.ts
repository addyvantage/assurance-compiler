import { byCanonicalOrder } from '../shared/ordering.js';

/**
 * A meaningful kind of software surface a change can touch.
 *
 * A surface describes *what* changed. It says nothing about what verification that
 * change needs; that relationship lives in the planner's inference table.
 */
export const CHANGE_SURFACES = ['DATABASE_SCHEMA_CHANGE'] as const;

export type ChangeSurface = (typeof CHANGE_SURFACES)[number];

export interface ChangeSurfaceDefinition<Id extends ChangeSurface = ChangeSurface> {
  readonly id: Id;
  /** One sentence, phrased about the change, stating what touching this surface means. */
  readonly description: string;
}

export const changeSurfaceDefinitions: {
  readonly [Id in ChangeSurface]: ChangeSurfaceDefinition<Id>;
} = {
  DATABASE_SCHEMA_CHANGE: {
    id: 'DATABASE_SCHEMA_CHANGE',
    description: 'This change modifies the database schema.',
  },
};

export const compareChangeSurfaces = byCanonicalOrder<ChangeSurface>(CHANGE_SURFACES);
