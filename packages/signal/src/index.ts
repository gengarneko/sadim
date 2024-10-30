type Handler = (...args: any[]) => any;
type Priority = number;

type SignalHandler<T extends Handler> = {
  handler: T;
  priority: Priority;
};

declare class Signal<T extends Handler> {
  /** @internal */
  _handlers: SignalHandler<T>[];

  constructor();

  /** @internal */
  _sort: () => void;

  hasHandlers(): boolean;

  handlersAmount(): number;

  connect(handler: T, priority?: number): this;

  disconnect(handler: T): this;

  clear(): void;

  emit(...args: Parameters<T>): void;
}

/** @internal */
// This enables better control of the transpiled output size.
function Signal<T extends Handler>(this: Signal<T>) {
  this._handlers = [];
}

/** 优先级高的靠后, 更晚执行 */
Signal.prototype._sort = function () {
  this._handlers.sort((a, b) => a.priority - b.priority);
};

/** 是否存在 handlers */
Signal.prototype.hasHandlers = function () {
  return this._handlers.length > 0;
};

/** handlers 数量 */
Signal.prototype.handlersAmount = function () {
  return this._handlers.length;
};

/** 连接 handler */
Signal.prototype.connect = function <T>(handler: T, priority: number = 0) {
  const existingHandler = this._handlers.find((it) =>
    it.handler === handler
  );

  console.log('existingHandler', existingHandler)

  let needSort = false;

  if (existingHandler !== undefined) {
    needSort = existingHandler.priority !== priority;
    existingHandler.priority = priority;
  } else {
    const lastHandler = this._handlers[this._handlers.length - 1];
    this._handlers.push({ handler, priority });
    needSort = (lastHandler !== undefined && lastHandler.priority > priority);
  }
  if (needSort) {
    this._sort();
  }

  return this;
};

/** 移除 handler */
Signal.prototype.disconnect = function <T>(handler: T) {
  const existingHandlerIndex = this._handlers.findIndex((it) => it.handler === handler);
  if (existingHandlerIndex >= 0) {
    this._handlers.splice(existingHandlerIndex, 1);
  }
  return this;
};

/** 清空 handlers */
Signal.prototype.clear = function () {
  this._handlers.length = 0;
  return this;
};

/** 触发 handlers */
Signal.prototype.emit = function (...args: Parameters<Handler>) {
  this._handlers.forEach((it) => it.handler(...args));
  return this;
};

/** 创建空 signal */
export function signal() {
  return new Signal();
}
