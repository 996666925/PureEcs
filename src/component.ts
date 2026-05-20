/**
 * Component type utilities.
 * Components are plain classes - their identity is derived from the constructor.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentClass<T = any> = new (...args: any[]) => T;

const componentIdMap = new WeakMap<ComponentClass, number>();
let nextComponentId = 0;

/**
 * Get or assign a unique numeric ID for a component class.
 * IDs are assigned sequentially starting from 0.
 */
export function getComponentId(type: ComponentClass): number {
  let id = componentIdMap.get(type);
  if (id === undefined) {
    id = nextComponentId++;
    componentIdMap.set(type, id);
  }
  return id;
}
