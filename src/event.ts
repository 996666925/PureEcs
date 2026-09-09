import type { ComponentClass } from './component';
import { getComponentId } from './component';
import type { Entity } from './entity';
import type { World } from './world';

interface EventEntry<T> {
  id: number;
  value: T;
}

/** Per-event-type channel. Events are available for the current tick only. */
export class Events<T> {
  private entries: EventEntry<T>[] = [];
  private nextId = 0;

  send(event: T): void {
    this.entries.push({ id: this.nextId++, value: event });
  }

  clear(): void {
    this.entries.length = 0;
  }

  readAfter(lastId: number): { events: T[]; lastId: number } {
    const entries = this.entries.filter((entry) => entry.id > lastId);
    return {
      events: entries.map((entry) => entry.value),
      lastId: entries.length > 0 ? entries[entries.length - 1].id : lastId,
    };
  }
}

/** Runtime writer injected by the EventWriter() parameter descriptor. */
export interface EventWriter<T> {
  send(event: T): void;
}

/** Runtime reader injected by the EventReader() parameter descriptor. */
export interface EventReader<T> {
  read(): readonly T[];
}

/** Context passed to an observer when an event is synchronously triggered. */
export class Trigger<T> {
  readonly event: T;
  readonly target: Entity | undefined;

  /** @internal */
  constructor(event: T, target?: Entity) {
    this.event = event;
    this.target = target;
  }
}

/** A synchronous callback registered for one event type. */
export type Observer<T> = (trigger: Trigger<T>, world: World) => void;

interface ObserverEntry<T> {
  observer: Observer<T>;
  target: Entity | undefined;
}

/** @internal Stores global and entity-targeted observers by event type. */
export class ObserverRegistry {
  private observers: Map<number, ObserverEntry<unknown>[]> = new Map();

  add<T>(eventType: ComponentClass<T>, observer: Observer<T>, target?: Entity): void {
    const id = getComponentId(eventType);
    let entries = this.observers.get(id);
    if (!entries) {
      entries = [];
      this.observers.set(id, entries);
    }
    entries.push({ observer: observer as Observer<unknown>, target });
  }

  trigger<T>(world: World, event: T, target?: Entity): void {
    const eventType = event?.constructor as ComponentClass<T> | undefined;
    if (!eventType) {
      throw new Error('Triggered events must be class instances');
    }
    const id = getComponentId(eventType);
    const entries = this.observers.get(id);
    if (!entries) return;

    // Targeted observers are scoped to their entity and stop participating
    // once that entity is despawned.
    const activeEntries = entries.filter((entry) => entry.target === undefined || world.isAlive(entry.target));
    if (activeEntries.length !== entries.length) this.observers.set(id, activeEntries);

    const trigger = new Trigger(event, target);
    // Snapshot registrations so observers added during this dispatch wait for
    // the next trigger, while nested triggers remain synchronous.
    for (const entry of [...activeEntries]) {
      if (
        !entry.target ||
        (world.isAlive(entry.target) && target !== undefined && entry.target.equals(target))
      ) {
        entry.observer(trigger, world);
      }
    }
  }
}

export class EventWriterDescriptor<T> {
  readonly eventType: ComponentClass<T>;
  declare readonly _type?: T;

  constructor(eventType: ComponentClass<T>) {
    this.eventType = eventType;
  }
}

export class EventReaderDescriptor<T> {
  readonly eventType: ComponentClass<T>;
  declare readonly _type?: T;

  constructor(eventType: ComponentClass<T>) {
    this.eventType = eventType;
  }
}

/** Declare an event writer parameter. Register the event first with app.addEvent(). */
export function EventWriter<T>(eventType: ComponentClass<T>): EventWriterDescriptor<T> {
  return new EventWriterDescriptor(eventType);
}

/** Declare an event reader parameter. Register the event first with app.addEvent(). */
export function EventReader<T>(eventType: ComponentClass<T>): EventReaderDescriptor<T> {
  return new EventReaderDescriptor(eventType);
}

/** @internal */
export function createEventWriter<T>(world: World, eventType: ComponentClass<T>): EventWriter<T> {
  return { send: (event) => world.getRequiredEvents(eventType).send(event) };
}

/** @internal */
export function createEventReader<T>(world: World, eventType: ComponentClass<T>): EventReader<T> {
  let lastId = -1;
  return {
    read: () => {
      const result = world.getRequiredEvents(eventType).readAfter(lastId);
      lastId = result.lastId;
      return result.events;
    },
  };
}
