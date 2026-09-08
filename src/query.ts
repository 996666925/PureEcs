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

    let smallestStorage: SparseSet | undefined;
    let smallestLen = Infinity;
    for (let i = 0; i < storages.length; i++) {
      if (this.entityPositionFlags[i]) continue;
      const storage = storages[i];
      const len = storage?.length ?? Infinity;
      if (len < smallestLen) {
        smallestLen = len;
        smallestStorage = storage;
      }
    }

    // A sparse With() filter is also a valid and often better candidate set.
    // Without() cannot be used as a candidate because it has no positive set.
    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i].type !== 'with') continue;
      const storage = filterStorages[i];
      const len = storage?.length ?? Infinity;
      if (len < smallestLen) {
        smallestLen = len;
        smallestStorage = storage;
      }
    }

    if (!smallestStorage) return;

    const components: unknown[] = new Array(this.fetches.length);
    smallestStorage.forEachEntity((entityId) => {
      let allPresent = true;
      for (let i = 0; i < this.fetches.length; i++) {
        if (this.entityPositionFlags[i]) {
          components[i] = world.getEntityById(entityId);
          continue;
        }
        const storage = storages[i];
        // Components are never stored as undefined (insertComponent rejects
        // undefined values when resolving the component constructor), so a
        // single lookup is enough to test presence and fetch the value.
        const component = storage?.get(entityId);
        if (component === undefined) {
          allPresent = false;
          break;
        }
        components[i] = component;
      }
      if (!allPresent) return;

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
    });
  }

  /** @internal Allocation-free fast path for a one-fetch query. */
  forEach1(world: World, callback: (component: unknown) => void): void {
    this.forEachMatchedEntity(world, (entityId, storages) => {
      const component = this.resolveFetch(world, entityId, storages, 0);
      if (component !== undefined) callback(component);
    });
  }

  /** @internal Allocation-free fast path for a two-fetch query. */
  forEach2(world: World, callback: (first: unknown, second: unknown) => void): void {
    this.forEachMatchedEntity(world, (entityId, storages) => {
      const first = this.resolveFetch(world, entityId, storages, 0);
      const second = this.resolveFetch(world, entityId, storages, 1);
      if (first !== undefined && second !== undefined) callback(first, second);
    });
  }

  /** @internal Allocation-free fast path for a three-fetch query. */
  forEach3(world: World, callback: (first: unknown, second: unknown, third: unknown) => void): void {
    this.forEachMatchedEntity(world, (entityId, storages) => {
      const first = this.resolveFetch(world, entityId, storages, 0);
      const second = this.resolveFetch(world, entityId, storages, 1);
      const third = this.resolveFetch(world, entityId, storages, 2);
      if (first !== undefined && second !== undefined && third !== undefined) {
        callback(first, second, third);
      }
    });
  }

  private resolveFetch(
    world: World,
    entityId: number,
    storages: (SparseSet | undefined)[],
    index: number,
  ): unknown {
    if (this.entityPositionFlags[index]) return world.getEntityById(entityId);
    return storages[index]?.get(entityId);
  }

  /** Iterate matching IDs for the specialized allocation-free query paths. */
  private forEachMatchedEntity(
    world: World,
    callback: (entityId: number, storages: (SparseSet | undefined)[]) => void,
  ): void {
    if (this.fetches.length === 0) return;
    const { storages, filterStorages } = this.resolveStorages(world);

    let candidate: SparseSet | undefined;
    let candidateLength = Infinity;
    for (let i = 0; i < storages.length; i++) {
      if (this.entityPositionFlags[i]) continue;
      const storage = storages[i];
      const length = storage?.length ?? Infinity;
      if (length < candidateLength) {
        candidateLength = length;
        candidate = storage;
      }
    }
    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i].type !== 'with') continue;
      const storage = filterStorages[i];
      const length = storage?.length ?? Infinity;
      if (length < candidateLength) {
        candidateLength = length;
        candidate = storage;
      }
    }
    if (!candidate) return;

    candidate.forEachEntity((entityId) => {
      for (let i = 0; i < this.filters.length; i++) {
        const filter = this.filters[i];
        const storage = filterStorages[i];
        switch (filter.type) {
          case 'with': if (!storage?.has(entityId)) return; break;
          case 'without': if (storage?.has(entityId)) return; break;
          case 'added': if (!world.isComponentAddedById(entityId, this.filterIds[i])) return; break;
          case 'changed': if (!world.isComponentChangedById(entityId, this.filterIds[i])) return; break;
        }
      }
      callback(entityId, storages);
    });
  }

  /**
   * Execute the query against a world, returning matching (entityId, components[]) tuples.
   */
  *iter(world: World): IterableIterator<[number, unknown[]]> {
    if (this.fetches.length === 0) return;
    const { storages, filterStorages } = this.resolveStorages(world);
    let smallestStorage: SparseSet | undefined;
    let smallestLen = Infinity;
    for (let i = 0; i < storages.length; i++) {
      if (this.entityPositionFlags[i]) continue;
      const storage = storages[i];
      const len = storage?.length ?? Infinity;
      if (len < smallestLen) { smallestLen = len; smallestStorage = storage; }
    }

    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i].type !== 'with') continue;
      const storage = filterStorages[i];
      const len = storage?.length ?? Infinity;
      if (len < smallestLen) { smallestLen = len; smallestStorage = storage; }
    }

    if (!smallestStorage) return;
    for (let denseIndex = 0; denseIndex < smallestStorage.length; denseIndex++) {
      const entityId = smallestStorage.entityAt(denseIndex);
      const components: unknown[] = new Array(this.fetches.length);
      let allPresent = true;
      for (let i = 0; i < this.fetches.length; i++) {
        if (this.entityPositionFlags[i]) components[i] = world.getEntityById(entityId);
        else {
          const storage = storages[i];
          const component = storage?.get(entityId);
          if (component === undefined) { allPresent = false; break; }
          components[i] = component;
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
