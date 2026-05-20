import type { Entity } from './entity';
import type { ComponentClass } from './component';

/**
 * Commands enable deferred world mutations.
 * They are queued during system execution and applied after all systems finish.
 * This avoids borrow conflicts and ensures consistent world state during system runs.
 */
export class Commands {
  private queue: Command[] = [];

  /** Spawn a new entity (deferred). Returns a handle to attach components. */
  spawn(): SpawnBuilder {
    const cmd: SpawnCommand = { type: 'spawn', components: [], callback: undefined };
    this.queue.push(cmd);
    return new SpawnBuilder(cmd);
  }

  /** Despawn an entity (deferred) */
  despawn(entity: Entity): void {
    this.queue.push({ type: 'despawn', entity });
  }

  /** Insert a component onto an existing entity (deferred) */
  insert(entity: Entity, component: unknown): void {
    this.queue.push({ type: 'insert', entity, component });
  }

  /** Remove a component from an entity (deferred) */
  remove(entity: Entity, componentType: ComponentClass): void {
    this.queue.push({ type: 'remove', entity, componentType });
  }

  /** Insert a resource (deferred) */
  insertResource(resource: unknown): void {
    this.queue.push({ type: 'insertResource', resource });
  }

  /** Remove a resource (deferred) */
  removeResource(type: ComponentClass): void {
    this.queue.push({ type: 'removeResource', componentType: type });
  }

  /**
   * Apply all queued commands to the world.
   * @internal Called by the scheduler after systems run.
   */
  apply(world: import('./world').World): void {
    for (const cmd of this.queue) {
      switch (cmd.type) {
        case 'spawn': {
          const entity = world.spawn();
          for (const comp of cmd.components) {
            world.insertComponent(entity, comp);
          }
          if (cmd.callback) {
            cmd.callback(entity);
          }
          break;
        }
        case 'despawn':
          world.despawn(cmd.entity);
          break;
        case 'insert':
          world.insertComponent(cmd.entity, cmd.component);
          break;
        case 'remove':
          world.removeComponent(cmd.entity, cmd.componentType);
          break;
        case 'insertResource':
          world.insertResource(cmd.resource);
          break;
        case 'removeResource':
          world.removeResource(cmd.componentType);
          break;
      }
    }
    this.queue.length = 0;
  }
}

/**
 * Builder for spawning entities with components via Commands.
 */
export class SpawnBuilder {
  private cmd: SpawnCommand;

  constructor(cmd: SpawnCommand) {
    this.cmd = cmd;
  }

  /** Add a component to the entity being spawned */
  with(component: unknown): this {
    this.cmd.components.push(component);
    return this;
  }

  /** Set a callback to receive the spawned entity after commands are applied */
  onSpawn(callback: (entity: Entity) => void): this {
    this.cmd.callback = callback;
    return this;
  }
}

// ─── Command types ───

interface SpawnCommand {
  type: 'spawn';
  components: unknown[];
  callback?: (entity: Entity) => void;
}

type Command =
  | SpawnCommand
  | { type: 'despawn'; entity: Entity }
  | { type: 'insert'; entity: Entity; component: unknown }
  | { type: 'remove'; entity: Entity; componentType: ComponentClass }
  | { type: 'insertResource'; resource: unknown }
  | { type: 'removeResource'; componentType: ComponentClass };
