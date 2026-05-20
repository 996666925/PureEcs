import type { ComponentClass } from './component';
import type { World } from './world';

// ─── Filter types ───

/** Base filter type for runtime */
export type QueryFilter =
  | { type: 'added'; component: ComponentClass }
  | { type: 'changed'; component: ComponentClass }
  | { type: 'with'; component: ComponentClass }
  | { type: 'without'; component: ComponentClass };

/** Typed With filter — must have this component (also marks as fetch when used as Query() first arg) */
export interface WithFilter<T = unknown> {
  type: 'with';
  component: ComponentClass<T>;
}

/** Typed Without filter — must NOT have this component */
export interface WithoutFilter<T = unknown> {
  type: 'without';
  component: ComponentClass<T>;
}

/** Typed Added filter — component was just added this tick */
export interface AddedFilter<T = unknown> {
  type: 'added';
  component: ComponentClass<T>;
}

/** Typed Changed filter — component was mutated this tick */
export interface ChangedFilter<T = unknown> {
  type: 'changed';
  component: ComponentClass<T>;
}

// ─── Query engine (internal) ───

/**
 * Internal query engine that iterates over a World.
 */
export class QueryEngine {
  readonly fetches: readonly ComponentClass[];
  readonly filters: readonly QueryFilter[];
  /** Positions in `fetches` that refer to the Entity itself (not a component) */
  readonly entityPositions: ReadonlySet<number>;

  constructor(
    fetches: readonly ComponentClass[],
    filters: readonly QueryFilter[] = [],
    entityPositions: ReadonlySet<number> = new Set(),
  ) {
    this.fetches = fetches;
    this.filters = filters;
    this.entityPositions = entityPositions;
  }

  /**
   * Execute the query against a world, returning matching (entityId, components[]) tuples.
   */
  *iter(world: World): IterableIterator<[number, unknown[]]> {
    if (this.fetches.length === 0) return;

    // Map each fetch to a storage (entity fetches have no storage)
    const storages = this.fetches.map((t, i) =>
      this.entityPositions.has(i) ? undefined : world.getComponentStorage(t),
    );

    // Find the smallest storage among actual components
    let smallestIdx = -1;
    let smallestLen = Infinity;
    for (let i = 0; i < storages.length; i++) {
      if (this.entityPositions.has(i)) continue; // skip entity fetches
      const len = storages[i]?.length ?? Infinity;
      if (len < smallestLen) {
        smallestLen = len;
        smallestIdx = i;
      }
    }

    // All fetches are entity — no component storages
    if (smallestIdx < 0) return;

    const smallestStorage = storages[smallestIdx];
    if (!smallestStorage) return;

    for (const entityId of smallestStorage.entityIds()) {
      const components: unknown[] = [];
      let allPresent = true;

      for (let i = 0; i < this.fetches.length; i++) {
        if (this.entityPositions.has(i)) {
          // Entity fetch — construct from world
          components.push(world.getEntityById(entityId));
          continue;
        }
        const storage = storages[i];
        if (!storage || !storage.has(entityId)) {
          allPresent = false;
          break;
        }
        components.push(storage.get(entityId));
      }

      if (!allPresent) continue;

      let passesFilters = true;
      for (const filter of this.filters) {
        const storage = world.getComponentStorage(filter.component);
        switch (filter.type) {
          case 'with':
            if (!storage?.has(entityId)) passesFilters = false;
            break;
          case 'without':
            if (storage?.has(entityId)) passesFilters = false;
            break;
          case 'added':
            if (!world.isComponentAdded(entityId, filter.component)) passesFilters = false;
            break;
          case 'changed':
            if (!world.isComponentChanged(entityId, filter.component)) passesFilters = false;
            break;
        }
        if (!passesFilters) break;
      }

      if (passesFilters) {
        yield [entityId, components];
      }
    }
  }
}

// ─── Filter builder functions ───

/** Filter: entity must have this component */
export function With<T>(component: ComponentClass<T>): WithFilter<T> {
  return { type: 'with', component };
}

/** Filter: entity must NOT have this component */
export function Without<T>(component: ComponentClass<T>): WithoutFilter<T> {
  return { type: 'without', component };
}

/** Filter: component was just added this tick */
export function Added<T>(component: ComponentClass<T>): AddedFilter<T> {
  return { type: 'added', component };
}

/** Filter: component was mutated this tick */
export function Changed<T>(component: ComponentClass<T>): ChangedFilter<T> {
  return { type: 'changed', component };
}
