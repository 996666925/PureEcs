import type { ComponentClass } from './component';
import { getComponentId } from './component';
import { Entity, EntityAlloc } from './entity';
import { SparseSet } from './storage';
import { QueryEngine, type QueryFilter } from './query';
import { ResourceStore } from './resource';
import { Commands } from './commands';
import { ChangeTrackers, Mut } from './change-tracking';
import { Scheduler, Stages, type Stage, type SystemConfig, type SystemFn, SystemBuilder } from './scheduler';

export type { SystemFn };

/**
 * The World is the core container holding all entities, components, resources,
 * and managing system execution.
 */
export class World {
  private entityAlloc = new EntityAlloc();
  private storages: Map<number, SparseSet> = new Map();
  private resources = new ResourceStore();
  private changeTrackers = new ChangeTrackers();
  private scheduler = new Scheduler();
  private _commands: Commands = new Commands();

  // ─── Entity operations ───

  spawn(): Entity {
    return this.entityAlloc.alloc();
  }

  despawn(entity: Entity): boolean {
    if (!this.entityAlloc.dealloc(entity)) return false;
    for (const storage of this.storages.values()) {
      storage.remove(entity.id);
    }
    return true;
  }

  isAlive(entity: Entity): boolean {
    return this.entityAlloc.isAlive(entity);
  }

  /** @internal Get an Entity handle from its raw id */
  getEntityById(id: number): Entity | null {
    return this.entityAlloc.getEntity(id);
  }

  // ─── Component operations ───

  insertComponent<T>(entity: Entity, component: T): void {
    const componentId = getComponentId(component!.constructor as ComponentClass);
    let storage = this.storages.get(componentId);
    if (!storage) {
      storage = new SparseSet<T>();
      this.storages.set(componentId, storage);
    }
    const isNew = !storage.has(entity.id);
    storage.insert(entity.id, component);
    if (isNew) {
      this.changeTrackers.markAdded(componentId, entity.id);
    }
  }

  removeComponent<T>(entity: Entity, type: ComponentClass<T>): T | undefined {
    const componentId = getComponentId(type);
    const storage = this.storages.get(componentId);
    if (!storage) return undefined;
    return storage.remove(entity.id) as T | undefined;
  }

  getComponent<T>(entity: Entity, type: ComponentClass<T>): T | undefined {
    const componentId = getComponentId(type);
    const storage = this.storages.get(componentId);
    if (!storage) return undefined;
    return storage.get(entity.id) as T | undefined;
  }

  getComponentMut<T>(entity: Entity, type: ComponentClass<T>): Mut<T> | undefined {
    const componentId = getComponentId(type);
    const storage = this.storages.get(componentId);
    if (!storage) return undefined;
    const value = storage.get(entity.id) as T | undefined;
    if (value === undefined) return undefined;
    return new Mut(value, componentId, entity.id, this.changeTrackers);
  }

  hasComponent(entity: Entity, type: ComponentClass): boolean {
    const componentId = getComponentId(type);
    return this.storages.get(componentId)?.has(entity.id) ?? false;
  }

  getComponentStorage(type: ComponentClass): SparseSet | undefined {
    const componentId = getComponentId(type);
    return this.storages.get(componentId);
  }

  // ─── Change tracking ───

  /** @internal */
  isComponentAdded(entityId: number, type: ComponentClass): boolean {
    return this.changeTrackers.isAdded(getComponentId(type), entityId);
  }

  /** @internal */
  isComponentChanged(entityId: number, type: ComponentClass): boolean {
    return this.changeTrackers.isChanged(getComponentId(type), entityId);
  }

  // ─── Resource operations ───

  insertResource<T>(resource: T): void {
    this.resources.insert(resource!.constructor as ComponentClass<T>, resource);
  }

  insertResourceAs<T>(type: ComponentClass<T>, resource: T): void {
    this.resources.insert(type, resource);
  }

  getResource<T>(type: ComponentClass<T>): T | undefined {
    return this.resources.get(type);
  }

  removeResource<T>(type: ComponentClass<T>): void {
    this.resources.remove(type);
  }

  hasResource(type: ComponentClass): boolean {
    return this.resources.has(type);
  }

  // ─── Query ───

  query(...types: ComponentClass[]): IterableIterator<[number, unknown[]]> {
    const q = new QueryEngine(types);
    return q.iter(this);
  }

  queryFiltered(
    types: ComponentClass[],
    filters: QueryFilter[],
  ): IterableIterator<[number, unknown[]]> {
    const q = new QueryEngine(types, filters);
    return q.iter(this);
  }

  // ─── Systems ───

  /**
   * Add a system. Stage goes first, defaults to `Stages.Update` when omitted.
   *
   * @example
   * ```ts
   * world.addSystem(movement);
   * world.addSystem(Stages.PreUpdate, input);
   * world.addSystem(Stages.PostUpdate, render, { after: [movement] });
   * ```
   */
  addSystem(stage: Stage, fn: SystemFn, ordering?: SystemAddOptions): this;
  addSystem(fn: SystemFn): this;
  addSystem(stageOrFn: Stage | SystemFn, fn?: SystemFn, ordering?: SystemAddOptions): this {
    let stage: Stage;
    let systemFn: SystemFn;
    if (typeof stageOrFn === 'function') {
      systemFn = stageOrFn;
      stage = Stages.Update;
    } else {
      stage = stageOrFn;
      systemFn = fn!;
    }
    const config: SystemConfig = {
      fn: systemFn,
      stage,
      before: ordering?.before ?? [],
      after: ordering?.after ?? [],
    };
    this.scheduler.addSystem(config);
    return this;
  }

  /**
   * Add a system from a pre-built SystemConfig.
   */
  addSystemConfig(config: SystemConfig | SystemBuilder): this {
    const resolved = config instanceof SystemBuilder ? config.build() : config;
    this.scheduler.addSystem(resolved);
    return this;
  }

  /**
   * Add a startup system (runs once before the first update).
   */
  addStartupSystem(fn: SystemFn): this {
    this.scheduler.addSystem({ fn, stage: Stages.Startup, before: [], after: [] });
    return this;
  }

  /**
   * Insert a custom stage before an existing stage.
   */
  addStageBefore(newStage: Stage, before: Stage): this {
    this.scheduler.addStageBefore(newStage, before);
    return this;
  }

  /**
   * Insert a custom stage after an existing stage.
   */
  addStageAfter(newStage: Stage, after: Stage): this {
    this.scheduler.addStageAfter(newStage, after);
    return this;
  }

  // ─── Commands ───

  get commands(): Commands {
    return this._commands;
  }

  // ─── Execution ───

  private startupRun = false;

  update(): void {
    // Startup phase (once)
    if (!this.startupRun) {
      const startupByStage = this.scheduler.getStartupSystemsByStage();
      for (const [, systems] of startupByStage) {
        for (const sys of systems) {
          sys.fn(this);
        }
      }
      this.startupRun = true;
      this._commands.apply(this);
    }

    // Update loop — iterate stages in order
    const updateByStage = this.scheduler.getUpdateSystemsByStage();
    for (const [, systems] of updateByStage) {
      for (const sys of systems) {
        sys.fn(this);
      }
      // Apply commands after each stage
      this._commands.apply(this);
    }

    this.changeTrackers.clear();
  }

  run(ticks: number = 1): void {
    for (let i = 0; i < ticks; i++) {
      this.update();
    }
  }

  get entityCount(): number {
    return this.entityAlloc.aliveCount();
  }
}

/** Ordering constraints for addSystem (stage goes as the first positional arg) */
export interface SystemAddOptions {
  before?: SystemFn[];
  after?: SystemFn[];
}
