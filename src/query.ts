import type { ComponentClass } from './component';
import { getComponentId } from './component';
import type { World } from './world';
import type { SparseSet } from './storage';

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
  private readonly fetchIds: readonly number[];
  private readonly entityPositionFlags: readonly boolean[];
  private readonly filterIds: readonly number[];
  private readonly worldCaches = new WeakMap<World, {
    version: number;
    storages: (SparseSet | undefined)[];
    filterStorages: (SparseSet | undefined)[];
  }>();

  constructor(
    fetches: readonly ComponentClass[],
    filters: readonly QueryFilter[] = [],
    entityPositions: ReadonlySet<number> = new Set(),
  ) {
    this.fetches = fetches;
    this.filters = filters;
    this.entityPositions = entityPositions;
    this.entityPositionFlags = fetches.map((_type, index) => entityPositions.has(index));
    this.fetchIds = fetches.map((type, index) =>
      this.entityPositionFlags[index] ? -1 : getComponentId(type),
    );
    this.filterIds = filters.map((filter) => getComponentId(filter.component));
  }

  private resolveStorages(world: World): {
    storages: (SparseSet | undefined)[];
    filterStorages: (SparseSet | undefined)[];
  } {
    const version = world.componentStorageVersion;
    const cached = this.worldCaches.get(world);
    if (cached && cached.version === version) return cached;
    const value = {
      version,
      storages: this.fetchIds.map((componentId, i) =>
        this.entityPositionFlags[i] ? undefined : world.getComponentStorageById(componentId),
      ),
      filterStorages: this.filters.map((filter, index) =>
        filter.type === 'with' || filter.type === 'without'
          ? world.getComponentStorageById(this.filterIds[index])
          : undefined,
      ),
    };
    this.worldCaches.set(world, value);
    return value;
  }

  /**
   * Iterate matching entities without allocating a generator result tuple for
   * every entity. The components array passed to the callback is reused and
   * must not be retained by the callback.
   */
  forEach(world: World, callback: (entityId: number, components: unknown[]) => void): void {
    if (this.fetches.length === 0) return;

    const { storages, filterStorages } = this.resolveStorages(world);

    let smallestIdx = -1;
    let smallestLen = Infinity;
    for (let i = 0; i < storages.length; i++) {
      if (this.entityPositionFlags[i]) continue;
      const len = storages[i]?.length ?? Infinity;
      if (len < smallestLen) {
        smallestLen = len;
        smallestIdx = i;
      }
    }

    if (smallestIdx < 0) return;
    const smallestStorage = storages[smallestIdx];
    if (!smallestStorage) return;

    const components: unknown[] = new Array(this.fetches.length);
    for (const entityId of smallestStorage.entityIds()) {
      let allPresent = true;
      for (let i = 0; i < this.fetches.length; i++) {
        if (this.entityPositionFlags[i]) {
          components[i] = world.getEntityById(entityId);
          continue;
        }
        const storage = storages[i];
        if (!storage || !storage.has(entityId)) {
          allPresent = false;
          break;
        }
        components[i] = storage.get(entityId);
      }
      if (!allPresent) continue;

      let passesFilters = true;
      for (let i = 0; i < this.filters.length; i++) {
        const filter = this.filters[i];
        const storage = filterStorages[i];
        switch (filter.type) {
          case 'with':
            if (!storage?.has(entityId)) passesFilters = false;
            break;
          case 'without':
            if (storage?.has(entityId)) passesFilters = false;
            break;
          case 'added':
            if (!world.isComponentAddedById(entityId, this.filterIds[i])) passesFilters = false;
            break;
          case 'changed':
            if (!world.isComponentChangedById(entityId, this.filterIds[i])) passesFilters = false;
            break;
        }
        if (!passesFilters) break;
      }
      if (passesFilters) callback(entityId, components);
    }
  }

  /**
   * Execute the query against a world, returning matching (entityId, components[]) tuples.
   */
  *iter(world: World): IterableIterator<[number, unknown[]]> {
    if (this.fetches.length === 0) return;
    const { storages, filterStorages } = this.resolveStorages(world);
    let smallestIdx = -1;
    let smallestLen = Infinity;
    for (let i = 0; i < storages.length; i++) {
      if (this.entityPositionFlags[i]) continue;
      const len = storages[i]?.length ?? Infinity;
      if (len < smallestLen) { smallestLen = len; smallestIdx = i; }
    }
    const smallestStorage = smallestIdx < 0 ? undefined : storages[smallestIdx];
    if (!smallestStorage) return;
    for (const entityId of smallestStorage.entityIds()) {
      const components: unknown[] = new Array(this.fetches.length);
      let allPresent = true;
      for (let i = 0; i < this.fetches.length; i++) {
        if (this.entityPositionFlags[i]) components[i] = world.getEntityById(entityId);
        else {
          const storage = storages[i];
          if (!storage || !storage.has(entityId)) { allPresent = false; break; }
          components[i] = storage.get(entityId);
        }
      }
      if (!allPresent) continue;
      let passesFilters = true;
      for (let i = 0; i < this.filters.length; i++) {
        const filter = this.filters[i];
        const storage = filterStorages[i];
        switch (filter.type) {
          case 'with': if (!storage?.has(entityId)) passesFilters = false; break;
          case 'without': if (storage?.has(entityId)) passesFilters = false; break;
          case 'added': if (!world.isComponentAddedById(entityId, this.filterIds[i])) passesFilters = false; break;
          case 'changed': if (!world.isComponentChangedById(entityId, this.filterIds[i])) passesFilters = false; break;
        }
        if (!passesFilters) break;
      }
      if (passesFilters) yield [entityId, components];
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
