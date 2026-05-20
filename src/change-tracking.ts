/**
 * Change tracking for components.
 * Tracks which components were added or changed in the current tick.
 */

/**
 * Wrapper that marks a component as changed when mutated.
 */
export class Mut<T> {
  private _value: T;
  private componentId: number;
  private entityId: number;
  private trackers: ChangeTrackers;

  constructor(value: T, componentId: number, entityId: number, trackers: ChangeTrackers) {
    this._value = value;
    this.componentId = componentId;
    this.entityId = entityId;
    this.trackers = trackers;
  }

  /** Access the inner value and mark as changed */
  get(): T {
    this.trackers.markChanged(this.componentId, this.entityId);
    return this._value;
  }

  /** Peek at the value without marking as changed */
  peek(): T {
    return this._value;
  }
}

export class ChangeTrackers {
  /** Entities that had a component added this tick: componentId -> Set<entityId> */
  private added: Map<number, Set<number>> = new Map();
  /** Entities that had a component changed this tick: componentId -> Set<entityId> */
  private changed: Map<number, Set<number>> = new Map();

  /**
   * Mark a component as added for an entity.
   */
  markAdded(componentId: number, entityId: number): void {
    let set = this.added.get(componentId);
    if (!set) {
      set = new Set();
      this.added.set(componentId, set);
    }
    set.add(entityId);
  }

  /**
   * Mark a component as changed for an entity.
   */
  markChanged(componentId: number, entityId: number): void {
    let set = this.changed.get(componentId);
    if (!set) {
      set = new Set();
      this.changed.set(componentId, set);
    }
    set.add(entityId);
  }

  /**
   * Check if a component was added for an entity this tick.
   */
  isAdded(componentId: number, entityId: number): boolean {
    return this.added.get(componentId)?.has(entityId) ?? false;
  }

  /**
   * Check if a component was changed for an entity this tick.
   */
  isChanged(componentId: number, entityId: number): boolean {
    return this.changed.get(componentId)?.has(entityId) ?? false;
  }

  /**
   * Clear all tracking data. Called at the end of each tick.
   */
  clear(): void {
    this.added.clear();
    this.changed.clear();
  }
}
