import type {Class} from './utils/class';

import {World} from './world';

/**
 * A class that holds a queue of events and can be used to read those events.
 */
export class EventReader<T extends object> {
  static async intoArgument(
    world: World,
    eventType: Class,
  ): Promise<EventReader<any>> {
    return (await world.getResource(Events)).getReader(eventType);
  }

  _type: Class;
  _queue: T[];
  constructor(type: {new (...args: any[]): T}, queue: T[]) {
    this._type = type;
    this._queue = queue;
  }

  /**
   * The number of events currently in this queue.
   */
  get length(): number {
    return this._queue.length;
  }

  /**
   * The event type for this queue.
   */
  get type(): Class {
    return this._type;
  }

  [Symbol.iterator](): IterableIterator<Readonly<T>> {
    return this._queue[Symbol.iterator]();
  }
}

/**
 * A class that holds a queue of events and can be used to read or write those events.
 */
export class EventWriter<T extends object> extends EventReader<T> {
  static override async intoArgument(
    world: World,
    eventType: Class,
  ): Promise<EventWriter<any>> {
    return (await world.getResource(Events)).getWriter(eventType);
  }
  override _queue: T[];

  constructor(type: {new (...args: any[]): T}, queue: T[]) {
    super(type, queue);
    this._queue = queue;
  }

  /**
   * Adds the provided event to the queue.
   * @param instance The event to add to the event queue.
   * @returns `this`, for chaining.
   */
  create(instance: T): this {
    this._queue.push(instance);
    return this;
  }

  /**
   * Immediately clears all events in this queue.
   */
  clear(): void {
    this._queue.length = 0;
  }
}

/**
 * A resource responsible for creating & holding all event queues in a world.
 */
export class Events {
  /**
   * An array of `EventReaders` in a world.
   * Each member in the `readers` array has a corresponding member at the same index in `writers`.
   */
  readers: EventReader<any>[];
  /**
   * An array of `EventWriters` in a world.
   * Each member in the `writers` array has a corresponding member at the same index in `readers`.
   */
  writers: EventWriter<any>[];

  static fromWorld() {
    return new this();
  }
  constructor() {
    this.readers = [];
    this.writers = [];
  }

  _addType<T extends Class>(
    type: Class,
    isRead: 'readers',
  ): EventReader<InstanceType<T>>;
  _addType<T extends Class>(
    type: Class,
    isRead: 'writers',
  ): EventWriter<InstanceType<T>>;
  _addType(type: Class, accessType: 'readers' | 'writers') {
    const eventQueue: object[] = [];
    this.readers.push(new EventReader(type, eventQueue));
    this.writers.push(new EventWriter(type, eventQueue));
    return this[accessType][this.readers.length - 1];
  }

  getReader<T extends Class>(eventType: T): EventReader<InstanceType<T>> {
    return (
      this.readers.find((reader) => reader.type === eventType) ??
      this._addType(eventType, 'readers')
    );
  }
  getWriter<T extends Class>(eventType: T): EventWriter<InstanceType<T>> {
    return (
      this.writers.find((writer) => writer.type === eventType) ??
      this._addType(eventType, 'writers')
    );
  }
}

export function clearAllEventQueues({writers}: Events) {
  for (const writer of writers) {
    writer.clear();
  }
}
clearAllEventQueues.getSystemArguments = (world: World) => [
  world.getResource(Events),
];
