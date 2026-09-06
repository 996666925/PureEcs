import type { ComponentClass } from './component';
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
