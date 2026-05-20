/**
 * SparseSet-based component storage.
 * Provides O(1) insert, remove, lookup, and efficient iteration.
 */
export class SparseSet<T = unknown> {
  /** Maps entity id -> index in dense array */
  private sparse: Map<number, number> = new Map();
  /** Dense array of component data */
  private dense: T[] = [];
  /** Dense array of entity ids (parallel to dense) */
  private entities: number[] = [];

  get length(): number {
    return this.dense.length;
  }

  insert(entityId: number, component: T): void {
    const denseIndex = this.sparse.get(entityId);
    if (denseIndex !== undefined) {
      // Update existing
      this.dense[denseIndex] = component;
    } else {
      // Insert new
      const newIndex = this.dense.length;
      this.sparse.set(entityId, newIndex);
      this.dense.push(component);
      this.entities.push(entityId);
    }
  }

  remove(entityId: number): T | undefined {
    const denseIndex = this.sparse.get(entityId);
    if (denseIndex === undefined) return undefined;

    const lastDenseIndex = this.dense.length - 1;
    const removed = this.dense[denseIndex];

    if (denseIndex !== lastDenseIndex) {
      // Swap with last element
      const lastEntityId = this.entities[lastDenseIndex];
      this.dense[denseIndex] = this.dense[lastDenseIndex];
      this.entities[denseIndex] = lastEntityId;
      this.sparse.set(lastEntityId, denseIndex);
    }

    // Remove last
    this.dense.pop();
    this.entities.pop();
    this.sparse.delete(entityId);

    return removed;
  }

  get(entityId: number): T | undefined {
    const denseIndex = this.sparse.get(entityId);
    if (denseIndex === undefined) return undefined;
    return this.dense[denseIndex];
  }

  has(entityId: number): boolean {
    return this.sparse.has(entityId);
  }

  /**
   * Iterate over all (entityId, component) pairs.
   */
  *entries(): IterableIterator<[number, T]> {
    for (let i = 0; i < this.dense.length; i++) {
      yield [this.entities[i], this.dense[i]];
    }
  }

  /**
   * Iterate over all entity ids in this set.
   */
  *entityIds(): IterableIterator<number> {
    for (let i = 0; i < this.entities.length; i++) {
      yield this.entities[i];
    }
  }

  /**
   * Iterate over all components in this set.
   */
  *values(): IterableIterator<T> {
    for (let i = 0; i < this.dense.length; i++) {
      yield this.dense[i];
    }
  }

  clear(): void {
    this.sparse.clear();
    this.dense.length = 0;
    this.entities.length = 0;
  }
}
