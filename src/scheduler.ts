/**
 * System scheduling with stages, before/after ordering constraints.
 *
 * Stages run in a defined order. Within each stage, systems are
 * topologically sorted by before/after constraints using function references.
 */

export type SystemFn = (world: import('./world').World) => void;
export type SystemCondition = (world: import('./world').World) => boolean;

// ─── Stages ───

/**
 * A Stage is an ordered slot in the schedule.
 * Built-in stages mirror Bevy's schedule. Custom stages can be inserted anywhere.
 */
export class Stage {
  readonly label: string;

  constructor(label: string) {
    this.label = label;
  }

  toString(): string {
    return this.label;
  }
}

/** A named group used to apply shared conditions and ordering to systems. */
export class SystemSet {
  readonly label: string;
  private active = true;
  private conditions: SystemCondition[] = [];

  constructor(label: string) {
    this.label = label;
  }

  runIf(condition: SystemCondition): this {
    this.conditions.push(condition);
    return this;
  }

  enabled(enabled = true): this {
    this.active = enabled;
    return this;
  }

  /** @internal */
  shouldRun(world: import('./world').World): boolean {
    return this.active && this.conditions.every((condition) => condition(world));
  }

  toString(): string {
    return this.label;
  }
}

/** Built-in stages */
export const Stages = {
  /** Runs once at app start */
  Startup: new Stage('Startup'),
  /** First stage in the update loop, before anything else */
  First: new Stage('First'),
  /** Before the main update logic */
  PreUpdate: new Stage('PreUpdate'),
  /** Main update logic */
  Update: new Stage('Update'),
  /** After the main update logic */
  PostUpdate: new Stage('PostUpdate'),
  /** Last stage in the update loop */
  Last: new Stage('Last'),
} as const;

/** Default stage order for the update loop */
const DEFAULT_UPDATE_ORDER: Stage[] = [
  Stages.First,
  Stages.PreUpdate,
  Stages.Update,
  Stages.PostUpdate,
  Stages.Last,
];

// ─── System config ───

export interface SystemConfig {
  fn: SystemFn;
  stage: Stage;
  before: SystemFn[];
  after: SystemFn[];
  runIf?: SystemCondition[];
  enabled?: boolean;
  sets?: SystemSet[];
  beforeSets?: SystemSet[];
  afterSets?: SystemSet[];
}

// ─── Circular dependency error ───

export class CircularDependencyError extends Error {
  readonly cycle: string[];

  constructor(cycle: string[]) {
    super(`Circular dependency detected in system ordering: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

// ─── Scheduler ───

export class Scheduler {
  /** All registered system configs */
  private systems: SystemConfig[] = [];

  /** Ordered list of stages for the startup phase */
  private startupStages: Stage[] = [Stages.Startup];

  /** Ordered list of stages for the update loop */
  private updateStages: Stage[] = [...DEFAULT_UPDATE_ORDER];

  /** Cached sorted results, invalidated on mutation */
  private cachedStartup: Map<Stage, SystemConfig[]> | null = null;
  private cachedUpdate: Map<Stage, SystemConfig[]> | null = null;

  // ─── Stage management ───

  /**
   * Get the current update stage order (copy).
   */
  getUpdateStages(): Stage[] {
    return [...this.updateStages];
  }

  /**
   * Get the current startup stage order (copy).
   */
  getStartupStages(): Stage[] {
    return [...this.startupStages];
  }

  /**
   * Insert a custom stage before an existing stage in the update loop.
   */
  addStageBefore(newStage: Stage, before: Stage): void {
    const idx = this.updateStages.findIndex((s) => s === before);
    if (idx === -1) {
      this.updateStages.push(newStage);
    } else {
      this.updateStages.splice(idx, 0, newStage);
    }
    this.invalidateCache();
  }

  /**
   * Insert a custom stage after an existing stage in the update loop.
   */
  addStageAfter(newStage: Stage, after: Stage): void {
    const idx = this.updateStages.findIndex((s) => s === after);
    if (idx === -1) {
      this.updateStages.push(newStage);
    } else {
      this.updateStages.splice(idx + 1, 0, newStage);
    }
    this.invalidateCache();
  }

  /**
   * Append a custom stage at the end of the update loop.
   */
  addStage(stage: Stage): void {
    this.updateStages.push(stage);
    this.invalidateCache();
  }

  // ─── System management ───

  /**
   * Add a system configuration to the scheduler.
   */
  addSystem(config: SystemConfig): void {
    // Ensure the system's stage exists in the schedule
    const isInStartup = this.startupStages.includes(config.stage);
    const isInUpdate = this.updateStages.includes(config.stage);
    if (!isInStartup && !isInUpdate) {
      // Auto-add unknown stages to the update loop before Update
      this.addStageBefore(config.stage, Stages.Update);
    }
    this.systems.push(config);
    this.invalidateCache();
  }

  /**
   * Get systems grouped and sorted by stage for the startup phase.
   */
  getStartupSystemsByStage(): Map<Stage, SystemConfig[]> {
    if (!this.cachedStartup) {
      this.cachedStartup = this.sortByStages(this.startupStages);
    }
    return this.cachedStartup;
  }

  /**
   * Get systems grouped and sorted by stage for the update loop.
   */
  getUpdateSystemsByStage(): Map<Stage, SystemConfig[]> {
    if (!this.cachedUpdate) {
      this.cachedUpdate = this.sortByStages(this.updateStages);
    }
    return this.cachedUpdate;
  }

  shouldRun(config: SystemConfig, world: import('./world').World): boolean {
    if (config.enabled === false) return false;
    if (config.runIf && !config.runIf.every((condition) => condition(world))) return false;
    return config.sets?.every((set) => set.shouldRun(world)) ?? true;
  }

  // ─── Internal ───

  private invalidateCache(): void {
    this.cachedStartup = null;
    this.cachedUpdate = null;
  }

  private sortByStages(stages: Stage[]): Map<Stage, SystemConfig[]> {
    const result = new Map<Stage, SystemConfig[]>();
    for (const stage of stages) {
      const stageSystems = this.systems.filter((s) => s.stage === stage);
      result.set(stage, topologicalSort(stageSystems));
    }
    return result;
  }
}

// ─── Topological sort ───

function topologicalSort(systems: SystemConfig[]): SystemConfig[] {
  if (systems.length === 0) return [];

  const fnToIndex = new Map<SystemFn, number>();
  systems.forEach((s, i) => fnToIndex.set(s.fn, i));

  const adj: number[][] = Array.from({ length: systems.length }, () => []);
  const inDegree = new Array<number>(systems.length).fill(0);

  for (let i = 0; i < systems.length; i++) {
    const sys = systems[i];

    for (const afterFn of sys.after) {
      const j = fnToIndex.get(afterFn);
      if (j !== undefined) {
        adj[j].push(i);
        inDegree[i]++;
      }
    }

    for (const beforeFn of sys.before) {
      const j = fnToIndex.get(beforeFn);
      if (j !== undefined) {
        adj[i].push(j);
        inDegree[j]++;
      }
    }

    for (const afterSet of sys.afterSets ?? []) {
      for (let j = 0; j < systems.length; j++) {
        if (systems[j].sets?.includes(afterSet)) {
          adj[j].push(i);
          inDegree[i]++;
        }
      }
    }

    for (const beforeSet of sys.beforeSets ?? []) {
      for (let j = 0; j < systems.length; j++) {
        if (systems[j].sets?.includes(beforeSet)) {
          adj[i].push(j);
          inDegree[j]++;
        }
      }
    }
  }

  const queue: number[] = [];
  for (let i = 0; i < systems.length; i++) {
    if (inDegree[i] === 0) {
      queue.push(i);
    }
  }

  const sorted: SystemConfig[] = [];
  while (queue.length > 0) {
    const idx = queue.shift()!;
    sorted.push(systems[idx]);

    for (const neighbor of adj[idx]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== systems.length) {
    const remaining = systems
      .filter((s) => !sorted.includes(s))
      .map((s) => s.fn.name || '<anonymous>');
    throw new CircularDependencyError(remaining);
  }

  return sorted;
}

// ─── Builder ───

/**
 * Create a system config with a fluent builder API.
 *
 * @example
 * ```ts
 * system(movementFn).inStage(Stages.Update).after(inputFn).before(renderFn)
 * ```
 */
export function system(fn: SystemFn): SystemBuilder {
  return new SystemBuilder(fn);
}

export class SystemBuilder {
  private config: SystemConfig;

  constructor(fn: SystemFn) {
    this.config = {
      fn,
      stage: Stages.Update,
      before: [],
      after: [],
      runIf: [],
      enabled: true,
      sets: [],
      beforeSets: [],
      afterSets: [],
    };
  }

  /** Place this system in a specific stage. */
  inStage(stage: Stage): this {
    this.config.stage = stage;
    return this;
  }

  /** This system must run before the given system. */
  before(fn: SystemFn): this {
    this.config.before.push(fn);
    return this;
  }

  /** This system must run after the given system. */
  after(fn: SystemFn): this {
    this.config.after.push(fn);
    return this;
  }

  /** Run only when every supplied condition returns true. */
  runIf(condition: SystemCondition): this {
    this.config.runIf!.push(condition);
    return this;
  }

  /** Enable or disable this system without removing it from the schedule. */
  enabled(enabled = true): this {
    this.config.enabled = enabled;
    return this;
  }

  /** Add this system to a set with shared conditions. */
  inSet(set: SystemSet): this {
    this.config.sets!.push(set);
    return this;
  }

  /** Run after all systems in a set within the same stage. */
  afterSet(set: SystemSet): this {
    this.config.afterSets!.push(set);
    return this;
  }

  /** Run before all systems in a set within the same stage. */
  beforeSet(set: SystemSet): this {
    this.config.beforeSets!.push(set);
    return this;
  }

  /** Shorthand for .inStage(Stages.Startup) */
  startup(): this {
    this.config.stage = Stages.Startup;
    return this;
  }

  /** Get the built config. */
  build(): SystemConfig {
    return {
      ...this.config,
      before: [...this.config.before],
      after: [...this.config.after],
      runIf: [...this.config.runIf!],
      sets: [...this.config.sets!],
      beforeSets: [...this.config.beforeSets!],
      afterSets: [...this.config.afterSets!],
    };
  }
}
