export type Callback<T extends any[] = any[]> = (...args: T) => void;
export type Priority = number;

export type PriorityHandler<T extends Callback = Callback> = {
  callback: T;
  priority: Priority;
};

declare class EventBus<T extends Callback> {
  /**
   * @internal
   *
   * Use Array to keep priority, Set will random order.
   */
  _subscribers: PriorityHandler<T>[];

  constructor();

  /** @internal */
  _sort: () => void;

  get hasSubscribers(): boolean;

  get subscriberCount(): number;

  subscribe(callback: Callback, priority?: number): EventBus<T>;

  unsubscribe(callback: Callback): EventBus<T>;

  clear(): void;

  emit(...args: Parameters<Callback>): void;
}

/** @internal */
// This enables better control of the transpiled output size.
function EventBus<T extends Callback>(this: EventBus<T>) {
  this._subscribers = [];
}

/** priority higher, execute later */
EventBus.prototype._sort = function () {
  this._subscribers.sort((a, b) => a.priority - b.priority);
};

/** if has subscribers */
Object.defineProperty(EventBus.prototype, 'hasSubscribers', {
  get(): boolean {
    return this._subscribers.length > 0;
  },
});

/** subscribers count */
Object.defineProperty(EventBus.prototype, 'subscriberCount', {
  get(): number {
    return this._subscribers.length;
  },
});

/** subscribe */
EventBus.prototype.subscribe = function (
  callback: Callback,
  priority: number = 0,
) {
  const existingHandler = this._subscribers.find(
    (it) => it.callback === callback,
  );

  let needSort = false;

  if (existingHandler !== undefined) {
    needSort = existingHandler.priority !== priority;
    existingHandler.priority = priority;
  } else {
    const lastHandler = this._subscribers[this._subscribers.length - 1];
    this._subscribers.push({callback, priority});
    needSort = lastHandler !== undefined && lastHandler.priority > priority;
  }
  if (needSort) {
    this._sort();
  }

  return this;
};

/** unsubscribe */
EventBus.prototype.unsubscribe = function (callback: Callback) {
  const existingHandlerIndex = this._subscribers.findIndex(
    (it) => it.callback === callback,
  );
  if (existingHandlerIndex >= 0) {
    this._subscribers.splice(existingHandlerIndex, 1);
  }
  return this;
};

/** clear */
EventBus.prototype.clear = function () {
  this._subscribers.length = 0;
  return this;
};

/** emit */
EventBus.prototype.emit = function (...args: Parameters<Callback>) {
  this._subscribers.forEach((it) => it.callback(...args));
  return this;
};

/** create plain EventBus */
function eventBus() {
  return new EventBus();
}

export {eventBus, EventBus};
