export type Callback<T extends any[] = any[]> = (...args: T) => void;
export type Priority = number;

export type PriorityHandler<T extends Callback = Callback> = {
  callback: T;
  priority: Priority;
};

declare class Event<T extends Callback> {
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

  subscribe(callback: Callback, priority?: number): Event<T>;

  unsubscribe(callback: Callback): Event<T>;

  clear(): void;

  emit(...args: Parameters<Callback>): void;
}

/** @internal */
// This enables better control of the transpiled output size.
function Event<T extends Callback>(this: Event<T>) {
  this._subscribers = [];
}

/** priority higher, execute later */
Event.prototype._sort = function () {
  this._subscribers.sort((a, b) => a.priority - b.priority);
};

/** if has subscribers */
Object.defineProperty(Event.prototype, 'hasSubscribers', {
  get(): boolean {
    return this._subscribers.length > 0;
  },
});

/** subscribers count */
Object.defineProperty(Event.prototype, 'subscriberCount', {
  get(): number {
    return this._subscribers.length;
  },
});

/** subscribe */
Event.prototype.subscribe = function (
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
Event.prototype.unsubscribe = function (callback: Callback) {
  const existingHandlerIndex = this._subscribers.findIndex(
    (it) => it.callback === callback,
  );
  if (existingHandlerIndex >= 0) {
    this._subscribers.splice(existingHandlerIndex, 1);
  }
  return this;
};

/** clear */
Event.prototype.clear = function () {
  this._subscribers.length = 0;
  return this;
};

/** emit */
Event.prototype.emit = function (...args: Parameters<Callback>) {
  this._subscribers.forEach((it) => it.callback(...args));
  return this;
};

/** create plain event */
function event() {
  return new Event();
}

export {Event, event};
