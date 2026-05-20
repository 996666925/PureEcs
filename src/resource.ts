import type { ComponentClass } from './component';
import { getComponentId } from './component';

/**
 * Resource storage. Resources are singleton data identified by their class.
 */
export class ResourceStore {
  private resources: Map<number, unknown> = new Map();

  insert<T>(type: ComponentClass<T>, resource: T): void {
    const id = getComponentId(type);
    this.resources.set(id, resource);
  }

  get<T>(type: ComponentClass<T>): T | undefined {
    const id = getComponentId(type);
    return this.resources.get(id) as T | undefined;
  }

  has(type: ComponentClass): boolean {
    const id = getComponentId(type);
    return this.resources.has(id);
  }

  remove<T>(type: ComponentClass<T>): T | undefined {
    const id = getComponentId(type);
    return this.resources.delete(id) ? undefined : undefined;
  }

  clear(): void {
    this.resources.clear();
  }
}
