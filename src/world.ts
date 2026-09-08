import type { ComponentClass } from './component';
import { getComponentId } from './component';
import { Entity, EntityAlloc } from './entity';
import { SparseSet } from './storage';
import { QueryEngine, type QueryFilter } from './query';
import { ResourceStore } from './resource';
import { Commands } from './commands';
import { ChangeTrackers, Mut, ResourceMut } from './change-tracking';
import { Events } from './event';
import { Scheduler, Stages, type Stage, type SystemConfig, type SystemFn, SystemBuilder } from './scheduler';

export type { SystemFn };

/**
 * The World is the core container holding all entities, components, resources,
 * and managing system execution.
 */
export class World {
  private entityAlloc = new EntityAlloc();
  /** Component storages indexed directly by their compact component ID. */
  private storages: (SparseSet | undefined)[] = [];
  /** Component storage IDs owned by each entity (kept sparse by entity ID). */
  private entityComponentIds: (number[] | undefined)[] = [];
  private storageVersion = 0;
  private resources = new ResourceStore();
  private changeTrackers = new ChangeTrackers();
  private scheduler = new Scheduler();
  private _commands: Commands = new Commands();
  private events: Map<number, Events<unknown>> = new Map();

  // ─── Entity operations ───

  spawn(): Entity {
    return this.entityAlloc.alloc();
  }

  /**
   * Spawn an entity and attach its initial components in one operation.
   * This avoids repeating the entity liveness check for every component.
   */
  spawnWith(...components: unknown[]): Entity {
    const entity = this.entityAlloc.alloc();
    for (const component of components) {
      this.insertComponentUnchecked(entity.id, component);
    }
    return entity;
  }

  despawn(entity: Entity): boolean {
    if (!this.entityAlloc.dealloc(entity)) return false;
    const componentIds = this.entityComponentIds[entity.id];
    if (componentIds) {
      for (let i = 0; i < componentIds.length; i++) {
        this.storages[componentIds[i]]!.remove(entity.id);
      }
      this.entityComponentIds[entity.id] = undefined;
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

  /** @internal Iterate all currently alive entity IDs for Entity-only queries. */
  forEachAliveEntity(callback: (id: number) => void): void {
    this.entityAlloc.forEachAlive(callback);
  }

  // ─── Component operations ───

  insertComponent<T>(entity: Entity, component: T): boolean {
    if (!this.isAlive(entity)) return false;
    this.insertComponentUnchecked(entity.id, component);
    return true;
  }

  /** Insert a component for an entity known to be alive. */
  private insertComponentUnchecked<T>(entityId: number, component: T): void {
    const componentId = getComponentId(component!.constructor as ComponentClass);
    let storage = this.storages[componentId];
    if (!storage) {
      storage = new SparseSet<T>();
      this.storages[componentId] = storage;
      this.storageVersion++;
    }
    const isNew = storage.insert(entityId, component);
    if (isNew) {
      let componentIds = this.entityComponentIds[entityId];
      if (!componentIds) {
        componentIds = [];
        this.entityComponentIds[entityId] = componentIds;
      }
      componentIds.push(componentId);
      this.changeTrackers.markAdded(componentId, entityId);
    }
  }

  removeComponent<T>(entity: Entity, type: ComponentClass<T>): T | undefined {
    if (!this.isAlive(entity)) return undefined;
    const componentId = getComponentId(type);
    const storage = this.storages[componentId];
    if (!storage) return undefined;
    const removed = storage.remove(entity.id) as T | undefined;
    if (removed !== undefined) {
      const componentIds = this.entityComponentIds[entity.id];
      if (componentIds) {
        const index = componentIds.indexOf(componentId);
        if (index !== -1) {
          componentIds[index] = componentIds[componentIds.length - 1];
          componentIds.pop();
          if (componentIds.length === 0) this.entityComponentIds[entity.id] = undefined;
        }
      }
    }
    return removed;
  }

  getComponent<T>(entity: Entity, type: ComponentClass<T>): T | undefined {
    if (!this.isAlive(entity)) return undefined;
    const componentId = getComponentId(type);
    const storage = this.storages[componentId];
    if (!storage) return undefined;
    return storage.get(entity.id) as T | undefined;
  }

  getComponentMut<T>(entity: Entity, type: ComponentClass<T>): Mut<T> | undefined {
    if (!this.isAlive(entity)) return undefined;
    const componentId = getComponentId(type);
    const storage = this.storages[componentId];
    if (!storage) return undefined;
    const value = storage.get(entity.id) as T | undefined;
    if (value === undefined) return undefined;
    return new Mut(value, componentId, entity.id, this.changeTrackers);
  }

  hasComponent(entity: Entity, type: ComponentClass): boolean {
    if (!this.isAlive(entity)) return false;
    const componentId = getComponentId(type);
    return this.storages[componentId]?.has(entity.id) ?? false;
  }

  getComponentStorage(type: ComponentClass): SparseSet | undefined {
    const componentId = getComponentId(type);
    return this.storages[componentId];
  }

  /** @internal Fast storage lookup for precompiled query plans. */
  getComponentStorageById(componentId: number): SparseSet | undefined {
    return this.storages[componentId];
  }

  /** @internal Monotonic version used to invalidate compiled query storage refs. */
  get componentStorageVersion(): number {
    return this.storageVersion;
  }

  // ─── Change tracking ───

  /** @internal */
  isComponentAdded(entityId: number, type: ComponentClass): boolean {
    return this.changeTrackers.isAdded(getComponentId(type), entityId);
  }

  /** @internal Fast change-tracking lookup for precompiled query plans. */
  isComponentAddedById(entityId: number, componentId: number): boolean {
    return this.changeTrackers.isAdded(componentId, entityId);
  }

  /** @internal */
  isComponentChanged(entityId: number, type: ComponentClass): boolean {
    return this.changeTrackers.isChanged(getComponentId(type), entityId);
  }

  /** @internal Fast change-tracking lookup for precompiled query plans. */
  isComponentChangedById(entityId: number, componentId: number): boolean {
    return this.changeTrackers.isChanged(componentId, entityId);
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

  removeResource<T>(type: ComponentClass<T>): T | undefined {
    return this.resources.remove(type);
  }

  /** Get a resource or throw when the system's required dependency is absent. */
  getRequiredResource<T>(type: ComponentClass<T>): T {
    const resource = this.getResource(type);
    if (resource === undefined) {
      throw new Error(`Required resource is missing: ${type.name || '<anonymous>'}`);
    }
    return resource;
  }

  getResourceMut<T>(type: ComponentClass<T>): ResourceMut<T> | undefined {
    const resource = this.getResource(type);
    if (resource === undefined) return undefined;
    return new ResourceMut(resource, getComponentId(type), this.changeTrackers);
  }

  getRequiredResourceMut<T>(type: ComponentClass<T>): ResourceMut<T> {
    const resource = this.getResourceMut(type);
    if (resource === undefined) {
      throw new Error(`Required resource is missing: ${type.name || '<anonymous>'}`);
    }
    return resource;
  }

  isResourceChanged(type: ComponentClass): boolean {
    return this.changeTrackers.isResourceChanged(getComponentId(type));
  }

  // ─── Events ───

  initEvent<T>(type: ComponentClass<T>): Events<T> {
    const id = getComponentId(type);
    let events = this.events.get(id);
    if (!events) {
      events = new Events<T>();
      this.events.set(id, events);
    }
    return events as Events<T>;
  }

  getEvents<T>(type: ComponentClass<T>): Events<T> | undefined {
    return this.events.get(getComponentId(type)) as Events<T> | undefined;
  }

  getRequiredEvents<T>(type: ComponentClass<T>): Events<T> {
    const events = this.getEvents(type);
    if (!events) {
      throw new Error(`Event type is not registered: ${type.name || '<anonymous>'}`);
    }
    return events;
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

  /** Iterate a query without materializing result arrays. */
  forEachQuery(
    types: ComponentClass[],
    callback: (entityId: number, components: unknown[]) => void,
  ): void {
    new QueryEngine(types).forEach(this, callback);
  }

  /** Iterate a filtered query without materializing result arrays. */
  forEachQueryFiltered(
    types: ComponentClass[],
    filters: QueryFilter[],
    callback: (entityId: number, components: unknown[]) => void,
  ): void {
    new QueryEngine(types, filters).forEach(this, callback);
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
      runIf: [],
      enabled: true,
      sets: [],
      beforeSets: [],
      afterSets: [],
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
    this.scheduler.addSystem({
      fn,
      stage: Stages.Startup,
      before: [],
      after: [],
      runIf: [],
      enabled: true,
      sets: [],
      beforeSets: [],
      afterSets: [],
    });
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
          if (this.scheduler.shouldRun(sys, this)) sys.fn(this);
        }
      }
      this.startupRun = true;
      this._commands.apply(this);
    }

    // Update loop — iterate stages in order
    const updateByStage = this.scheduler.getUpdateSystemsByStage();
    for (const [, systems] of updateByStage) {
      for (const sys of systems) {
        if (this.scheduler.shouldRun(sys, this)) sys.fn(this);
      }
      // Apply commands after each stage
      this._commands.apply(this);
    }

    this.changeTrackers.clear();
    for (const events of this.events.values()) {
      events.clear();
    }
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
