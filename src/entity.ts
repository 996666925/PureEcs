/**
 * Entity identifier using generational indexing.
 * This allows safe entity reuse after despawning.
 */
export class Entity {
  readonly id: number;
  readonly generation: number;

  constructor(id: number, generation: number) {
    this.id = id;
    this.generation = generation;
  }

  equals(other: Entity): boolean {
    return this.id === other.id && this.generation === other.generation;
  }

  toString(): string {
    return `Entity(${this.id}v${this.generation})`;
  }
}

/**
 * Internal entity allocation manager using generational indices.
 */
export class EntityAlloc {
  private entities: { generation: number; alive: boolean }[] = [];
  private freeList: number[] = [];

  alloc(): Entity {
    if (this.freeList.length > 0) {
      const id = this.freeList.pop()!;
      const entry = this.entities[id];
      entry.alive = true;
      return new Entity(id, entry.generation);
    }
    const id = this.entities.length;
    this.entities.push({ generation: 0, alive: true });
    return new Entity(id, 0);
  }

  dealloc(entity: Entity): boolean {
    const entry = this.entities[entity.id];
    if (!entry || !entry.alive || entry.generation !== entity.generation) {
      return false;
    }
    entry.alive = false;
    entry.generation += 1;
    this.freeList.push(entity.id);
    return true;
  }

  isAlive(entity: Entity): boolean {
    const entry = this.entities[entity.id];
    return entry !== undefined && entry.alive && entry.generation === entity.generation;
  }

  /** Construct an Entity handle from its id (or null if not alive). */
  getEntity(id: number): Entity | null {
    const entry = this.entities[id];
    if (!entry || !entry.alive) return null;
    return new Entity(id, entry.generation);
  }

  aliveCount(): number {
    let count = 0;
    for (const entry of this.entities) {
      if (entry.alive) count++;
    }
    return count;
  }
}
