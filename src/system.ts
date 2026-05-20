/**
 * params()-based system builder with automatic type inference.
 * Each callback parameter is an array of matching component instances (SoA/AoS),
 * except resource parameters (Res) which are injected as single values.
 *
 * @example
 * ```ts
 * // Simple fetch — each arg is a component array (SoA)
 * params(Position, Velocity).system((positions, velocities) => {
 *   for (let i = 0; i < positions.length; i++) {
 *     positions[i].x += velocities[i].x;
 *   }
 * });
 *
 * // Multi-fetch via Query() — tuple per entity (AoS)
 * params(Query(Position, Hp)).system((rows) => {
 *   // rows: [Position, Hp][]
 *   for (const [pos, hp] of rows) {
 *     pos.x += 1; hp.value -= 5;
 *   }
 * });
 *
 * // Query with scoped filters
 * params(Query(Position, With(Enemy), Without(Player)), Health).system((positions, healths) => {
 *   // positions: Position[], healths: Health[]
 * });
 *
 * // Query with Entity — includes entity handle in the tuple
 * params(Query(Position, Entity)).system((rows) => {
 *   // rows: [Position, Entity][]
 *   for (const [pos, entity] of rows) {
 *     console.log(`Entity ${entity}: (${pos.x}, ${pos.y})`);
 *   }
 * });
 *
 * // System-local state — lazy init, persists across frames
 * params(Position, Local(() => new Map())).system((positions, cache) => {
 *   // cache: Map<any, any> (single value, same instance each frame)
 * });
 *
 * // Resource parameters — injected as single values
 * params(Position, Res(GameConfig)).system((positions, config) => {
 *   // config: GameConfig (single value)
 * });
 * ```
 */

import type { ComponentClass } from './component';
import type { QueryFilter } from './query';
import type { SystemFn } from './scheduler';
import type { World } from './world';
import type { Commands } from './commands';
import { QueryEngine } from './query';
import { Entity } from './entity';

// ─── Type helpers ───

/** Extract the component instance type from a class */
type Instance<C> = C extends ComponentClass<infer T> ? T : never;

// ─── QueryDescriptor ───

/**
 * Describes a query parameter: one or more components to fetch + optional filters.
 * Single fetch → callback gets Instance<C>[] (SoA).
 * Multi fetch → callback gets [Instance<C1>, Instance<C2>, ...][] (AoS tuple).
 *
 * Use `Entity` as a fetch to include the entity handle in the result tuple:
 * `Query(Position, Entity)` → `[Position, Entity][]`
 */
export class QueryDescriptor<T = unknown> {
  readonly fetches: ComponentClass[];
  readonly filters: QueryFilter[];
  /** Positions in fetches that are Entity (not component) */
  readonly entityPositions: ReadonlySet<number>;
  /** Phantom — holds the component type for inference */
  declare readonly _type?: T;

  constructor(fetches: ComponentClass[], filters: QueryFilter[], entityPositions: ReadonlySet<number> = new Set()) {
    this.fetches = fetches;
    this.filters = filters;
    this.entityPositions = entityPositions;
  }
}

// ─── ResourceDescriptor ───

/**
 * Describes a resource parameter — injected as a single value (not an array).
 *
 * - `Res(MyResource)` → callback receives `MyResource`
 */
export class ResourceDescriptor<T = unknown> {
  readonly resourceType: ComponentClass<T>;
  /** Phantom — holds the resource type for inference */
  declare readonly _type?: T;

  constructor(resourceType: ComponentClass<T>) {
    this.resourceType = resourceType;
  }
}

/**
 * Declare a resource parameter. The resource is injected as a single value
 * (mutable by reference, same as `world.getResource()`).
 *
 * @example
 * ```ts
 * params(Position, Res(GameConfig)).system((positions, config) => {
 *   // config: GameConfig (single value)
 * });
 * ```
 */
export function Res<T>(resourceType: ComponentClass<T>): ResourceDescriptor<T> {
  return new ResourceDescriptor(resourceType);
}

// ─── CommandsDescriptor ───

/**
 * Describes a Commands parameter — injected as a single value.
 *
 * - `Cmd()` → callback receives `Commands`
 */
export class CommandsDescriptor {
  /** Phantom — holds the Commands type for inference */
  declare readonly _type?: Commands;
}

/**
 * Declare a Commands parameter. Injects world.commands for deferred mutations.
 *
 * @example
 * ```ts
 * params(Position, Cmd()).system((positions, commands) => {
 *   commands.spawn().with(new Position(0, 0));
 * });
 * ```
 */
export function Cmd(): CommandsDescriptor {
  return new CommandsDescriptor();
}

// ─── LocalDescriptor ───

/**
 * Describes a system-local state parameter — injected as a single value,
 * lazily initialized on first invocation and reused across frames.
 *
 * - `Local(() => new Counter(0))` → callback receives `Counter`
 */
export class LocalDescriptor<T = unknown> {
  readonly init: () => T;
  /** Phantom — holds the type for inference */
  declare readonly _type?: T;

  constructor(init: () => T) {
    this.init = init;
  }
}

/**
 * Declare a system-local state parameter. The `init` factory runs on first
 * invocation, and the returned value is reused on subsequent calls.
 *
 * @example
 * ```ts
 * params(Position, Local(() => ({ count: 0 }))).system((positions, counter) => {
 *   counter.count++;
 * });
 * ```
 */
export function Local<T>(init: () => T): LocalDescriptor<T> {
  return new LocalDescriptor(init);
}

/** A parameter descriptor: ComponentClass, QueryDescriptor, ResourceDescriptor, CommandsDescriptor, or LocalDescriptor */
type ParamDescriptor = ComponentClass | QueryDescriptor<any> | ResourceDescriptor<any> | CommandsDescriptor | LocalDescriptor<any>;

/** Extract the instance type from a parameter descriptor */
type InferParam<P> =
  P extends CommandsDescriptor ? Commands :
  P extends LocalDescriptor<infer T> ? T :
  P extends ResourceDescriptor<infer T> ? T :
  P extends ComponentClass<infer T> ? T :
  P extends QueryDescriptor<infer T> ? T :
  never;

/**
 * Map a tuple of descriptors to callback argument types.
 * Resource/Commands/Local descriptors produce a single value; others produce arrays.
 */
type InferParams<D extends readonly ParamDescriptor[]> = {
  [K in keyof D]: D[K] extends CommandsDescriptor | ResourceDescriptor<any> | LocalDescriptor<any> ? InferParam<D[K]> : InferParam<D[K]>[];
};

// ─── Query() function ───

/**
 * Create a query descriptor. Bare component classes are fetched; filter objects
 * (With/Without/Added/Changed) add runtime filter conditions.
 *
 * - `Query(Position)` → fetch Position → `Position[]`
 * - `Query(Position, Hp)` → fetch both as tuple → `[Position, Hp][]`
 * - `Query(Position, With(Enemy))` → fetch Position, filter by Enemy → `Position[]`
 * - `Query(Position, Hp, With(Enemy))` → fetch both as tuple, filter by Enemy → `[Position, Hp][]`
 * - `Query(Position, Entity)` → fetch Position + entity handle → `[Position, Entity][]`
 *
 * Old filter-as-first-arg syntax is also supported:
 * - `Query(With(Position), Without(Health))` → `Position[]`
 * - `Query(Changed(Position))` → `Position[]`
 */

// 2-component multi-fetch (no filters)
export function Query<C1 extends ComponentClass, C2 extends ComponentClass>(
  c1: C1, c2: C2,
): QueryDescriptor<[Instance<C1>, Instance<C2>]>;

// 3-component multi-fetch (no filters)
export function Query<C1 extends ComponentClass, C2 extends ComponentClass, C3 extends ComponentClass>(
  c1: C1, c2: C2, c3: C3,
): QueryDescriptor<[Instance<C1>, Instance<C2>, Instance<C3>]>;

// 4-component multi-fetch (no filters)
export function Query<C1 extends ComponentClass, C2 extends ComponentClass, C3 extends ComponentClass, C4 extends ComponentClass>(
  c1: C1, c2: C2, c3: C3, c4: C4,
): QueryDescriptor<[Instance<C1>, Instance<C2>, Instance<C3>, Instance<C4>]>;

// 2-component multi-fetch + filters
export function Query<C1 extends ComponentClass, C2 extends ComponentClass>(
  c1: C1, c2: C2, ...filters: QueryFilter[]
): QueryDescriptor<[Instance<C1>, Instance<C2>]>;

// 3-component multi-fetch + filters
export function Query<C1 extends ComponentClass, C2 extends ComponentClass, C3 extends ComponentClass>(
  c1: C1, c2: C2, c3: C3, ...filters: QueryFilter[]
): QueryDescriptor<[Instance<C1>, Instance<C2>, Instance<C3>]>;

// Single component (no filters)
export function Query<C1 extends ComponentClass>(
  c1: C1,
): QueryDescriptor<Instance<C1>>;

// Single component + filters
export function Query<C1 extends ComponentClass>(
  c1: C1, ...filters: QueryFilter[]
): QueryDescriptor<Instance<C1>>;

// Backward-compat: filter-as-first-arg (With/Added/Changed)
export function Query<T>(
  fetch: { type: 'with' | 'added' | 'changed'; component: ComponentClass<T> },
  ...filters: QueryFilter[]
): QueryDescriptor<T>;

// Implementation
export function Query(
  ...args: (ComponentClass<any> | QueryFilter)[]
): QueryDescriptor<any> {
  const fetches: ComponentClass[] = [];
  const filters: QueryFilter[] = [];
  const entityPositions = new Set<number>();

  for (const arg of args) {
    if (typeof arg === 'function') {
      const idx = fetches.length;
      fetches.push(arg as ComponentClass);
      if (arg === (Entity as unknown)) {
        entityPositions.add(idx);
      }
    } else if (arg && typeof arg === 'object') {
      const f = arg as QueryFilter;
      // If filter has 'component' property and is With/Added/Changed and no fetches yet,
      // treat it as the primary fetch + filter
      if (
        (f.type === 'with' || f.type === 'added' || f.type === 'changed') &&
        fetches.length === 0
      ) {
        fetches.push(f.component);
      }
      filters.push(f);
    }
  }

  return new QueryDescriptor(fetches, filters, entityPositions);
}

// ─── params() function ───

/**
 * Create a system builder from query parameter descriptors.
 * Each descriptor maps to one callback argument (as array).
 *
 * @example
 * ```ts
 * // Simple: each arg is a component array (SoA)
 * params(Position, Velocity).system((positions, velocities) => { ... });
 *
 * // Multi-fetch via Query() — tuple per entity (AoS)
 * params(Query(Position, Hp)).system((rows) => {
 *   // rows: [Position, Hp][]
 *   for (const [pos, hp] of rows) { ... }
 * });
 *
 * // Scoped filters via Query()
 * params(Query(Position, With(Enemy)), Health).system((positions, healths) => { ... });
 * ```
 */
export function params<D extends readonly ParamDescriptor[]>(
  ...descriptors: [...D]
): ParamsBuilder<D> {
  return new ParamsBuilder(descriptors);
}

// ─── ParamsBuilder ───

export class ParamsBuilder<D extends readonly ParamDescriptor[]> {
  private descriptors: ParamDescriptor[];

  // Pre-grouped plain ComponentClass descriptors for batch query
  private plainGroup: { idx: number; type: ComponentClass }[];
  // Pre-grouped QueryDescriptor indices
  private queryIndices: number[];
  // Pre-grouped ResourceDescriptor entries
  private resourceEntries: { idx: number; descriptor: ResourceDescriptor }[];
  // Pre-grouped CommandsDescriptor indices
  private commandsIndices: number[];
  // Pre-grouped LocalDescriptor entries
  private localEntries: { idx: number; descriptor: LocalDescriptor }[];

  constructor(descriptors: ParamDescriptor[]) {
    this.descriptors = descriptors;
    this.plainGroup = [];
    this.queryIndices = [];
    this.resourceEntries = [];
    this.commandsIndices = [];
    this.localEntries = [];
    for (let i = 0; i < descriptors.length; i++) {
      if (descriptors[i] instanceof CommandsDescriptor) {
        this.commandsIndices.push(i);
      } else if (descriptors[i] instanceof LocalDescriptor) {
        this.localEntries.push({ idx: i, descriptor: descriptors[i] as LocalDescriptor });
      } else if (descriptors[i] instanceof ResourceDescriptor) {
        this.resourceEntries.push({ idx: i, descriptor: descriptors[i] as ResourceDescriptor });
      } else if (descriptors[i] instanceof QueryDescriptor) {
        this.queryIndices.push(i);
      } else {
        this.plainGroup.push({ idx: i, type: descriptors[i] as ComponentClass });
      }
    }
  }

  /**
   * Create a system that collects matching entities' components into arrays.
   * Plain ComponentClass descriptors are batched into a single joint query.
   * Each QueryDescriptor runs independently (filters are scoped).
   * Resource/Local descriptors inject single values.
   */
  system(fn: (...args: InferParams<D>) => void): SystemFn {
    const { plainGroup, queryIndices, resourceEntries, commandsIndices, localEntries } = this;
    const totalArgs = this.descriptors.length;

    // Per-closure cache for Local descriptors (lazy init on first run)
    const localCache: { idx: number; value: unknown }[] = [];

    return (world: World) => {
      const args: unknown[] = new Array(totalArgs);

      // Resolve Commands parameter
      for (const idx of commandsIndices) {
        args[idx] = world.commands;
      }

      // Resolve Local parameters (lazy init, cache persists across frames)
      for (const { idx, descriptor } of localEntries) {
        let entry = localCache.find((e) => e.idx === idx);
        if (!entry) {
          entry = { idx, value: descriptor.init() };
          localCache.push(entry);
        }
        args[idx] = entry.value;
      }

      // Resolve resource parameters
      for (const { idx, descriptor } of resourceEntries) {
        args[idx] = world.getResource(descriptor.resourceType);
      }

      // Batch query for all plain ComponentClass descriptors
      if (plainGroup.length > 0) {
        const fetches = plainGroup.map((p) => p.type);
        const arrays: unknown[][] = fetches.map(() => []);
        for (const [, comps] of world.query(...fetches)) {
          for (let j = 0; j < comps.length; j++) {
            arrays[j].push(comps[j]);
          }
        }
        for (let j = 0; j < plainGroup.length; j++) {
          args[plainGroup[j].idx] = arrays[j];
        }
      }

      // Independent query for each QueryDescriptor
      for (const idx of queryIndices) {
        args[idx] = executeQueryDescriptor(
          world,
          this.descriptors[idx] as QueryDescriptor,
        );
      }

      fn(...(args as InferParams<D>));
    };
  }

  /**
   * Create a system with entity IDs array as the first callback argument,
   * followed by component arrays.
   * Entity IDs come from the batch query (if plain descriptors exist)
   * or the first QueryDescriptor.
   */
  systemWithEntity(fn: (entityIds: number[], ...args: InferParams<D>) => void): SystemFn {
    const { plainGroup, queryIndices, resourceEntries, commandsIndices, localEntries } = this;
    const totalArgs = this.descriptors.length;

    const localCache: { idx: number; value: unknown }[] = [];

    return (world: World) => {
      const ids: number[] = [];
      const args: unknown[] = new Array(totalArgs);

      // Resolve Commands parameter
      for (const idx of commandsIndices) {
        args[idx] = world.commands;
      }

      // Resolve Local parameters
      for (const { idx, descriptor } of localEntries) {
        let entry = localCache.find((e) => e.idx === idx);
        if (!entry) {
          entry = { idx, value: descriptor.init() };
          localCache.push(entry);
        }
        args[idx] = entry.value;
      }

      // Resolve resource parameters
      for (const { idx, descriptor } of resourceEntries) {
        args[idx] = world.getResource(descriptor.resourceType);
      }

      // Batch query for all plain ComponentClass descriptors
      if (plainGroup.length > 0) {
        const fetches = plainGroup.map((p) => p.type);
        const arrays: unknown[][] = fetches.map(() => []);
        for (const [id, comps] of world.query(...fetches)) {
          ids.push(id);
          for (let j = 0; j < comps.length; j++) {
            arrays[j].push(comps[j]);
          }
        }
        for (let j = 0; j < plainGroup.length; j++) {
          args[plainGroup[j].idx] = arrays[j];
        }
      }

      // Independent queries for QueryDescriptors
      for (const idx of queryIndices) {
        const result = executeQueryDescriptorWithIds(
          world,
          this.descriptors[idx] as QueryDescriptor,
        );
        // Use the first query's entity IDs if no plain descriptors
        if (ids.length === 0 && idx === queryIndices[0]) {
          ids.push(...result.ids);
        }
        args[idx] = result.items;
      }

      fn(ids, ...(args as InferParams<D>));
    };
  }

  /**
   * Create a system with World access + entity IDs array + component arrays.
   */
  systemWithWorld(fn: (world: World, entityIds: number[], ...args: InferParams<D>) => void): SystemFn {
    const { plainGroup, queryIndices, resourceEntries, commandsIndices, localEntries } = this;
    const totalArgs = this.descriptors.length;

    const localCache: { idx: number; value: unknown }[] = [];

    return (world: World) => {
      const ids: number[] = [];
      const args: unknown[] = new Array(totalArgs);

      // Resolve Commands parameter
      for (const idx of commandsIndices) {
        args[idx] = world.commands;
      }

      // Resolve Local parameters
      for (const { idx, descriptor } of localEntries) {
        let entry = localCache.find((e) => e.idx === idx);
        if (!entry) {
          entry = { idx, value: descriptor.init() };
          localCache.push(entry);
        }
        args[idx] = entry.value;
      }

      // Resolve resource parameters
      for (const { idx, descriptor } of resourceEntries) {
        args[idx] = world.getResource(descriptor.resourceType);
      }

      // Batch query for all plain ComponentClass descriptors
      if (plainGroup.length > 0) {
        const fetches = plainGroup.map((p) => p.type);
        const arrays: unknown[][] = fetches.map(() => []);
        for (const [id, comps] of world.query(...fetches)) {
          ids.push(id);
          for (let j = 0; j < comps.length; j++) {
            arrays[j].push(comps[j]);
          }
        }
        for (let j = 0; j < plainGroup.length; j++) {
          args[plainGroup[j].idx] = arrays[j];
        }
      }

      // Independent queries for QueryDescriptors
      for (const idx of queryIndices) {
        const result = executeQueryDescriptorWithIds(
          world,
          this.descriptors[idx] as QueryDescriptor,
        );
        if (ids.length === 0 && idx === queryIndices[0]) {
          ids.push(...result.ids);
        }
        args[idx] = result.items;
      }

      fn(world, ids, ...(args as InferParams<D>));
    };
  }
}

// ─── QueryDescriptor execution ───

/** Run a QueryDescriptor — multi-fetch returns tuple arrays, single-fetch returns plain arrays */
function executeQueryDescriptor(world: World, qd: QueryDescriptor): unknown[] {
  const qe = new QueryEngine(qd.fetches, qd.filters, qd.entityPositions);
  const items: unknown[] = [];
  if (qd.fetches.length === 1) {
    for (const [, comps] of qe.iter(world)) {
      items.push(comps[0]);
    }
  } else {
    for (const [, comps] of qe.iter(world)) {
      items.push(comps); // tuple: [C1, C2, ...]
    }
  }
  return items;
}

/** Same as above but also collects entity IDs */
function executeQueryDescriptorWithIds(world: World, qd: QueryDescriptor): { ids: number[]; items: unknown[] } {
  const qe = new QueryEngine(qd.fetches, qd.filters, qd.entityPositions);
  const ids: number[] = [];
  const items: unknown[] = [];
  if (qd.fetches.length === 1) {
    for (const [id, comps] of qe.iter(world)) {
      ids.push(id);
      items.push(comps[0]);
    }
  } else {
    for (const [id, comps] of qe.iter(world)) {
      ids.push(id);
      items.push(comps); // tuple: [C1, C2, ...]
    }
  }
  return { ids, items };
}
