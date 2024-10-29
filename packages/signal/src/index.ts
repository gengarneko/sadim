type Handler = (...args: any[]) => any;
type Priority = number;

type SignalHandler<T extends Handler> = {
  handler: T;
  priority: Priority;
};

/**
 * 创建 handler
 */
const createHandler = <T extends Handler>(
  handler: T,
  priority: Priority = 0,
): SignalHandler<T> => ({
  handler,
  priority,
});

/**
 * 创建 signal
 */
export const createSignal = <T extends Handler>() => {
  const handlers = new Set<SignalHandler<T>>();

  const getSortedHandlers = () =>
    Array.from(handlers).sort(handlerOptions.comparePriority);

  return {
    /**
     * 是否存在 handlers
     */
    hasHandlers: (): boolean => handlers.size > 0,

    /**
     * handlers 数量
     */
    handlersAmount: (): number => handlers.size,

    /**
     * 连接 handler
     */
    connect: (handler: T, priority: Priority = 0) => {
      const existingHandler = Array.from(handlers).find((it) =>
        handlerOptions.equals(it, handler),
      );

      let needSort = false;
      if (existingHandler !== undefined) {
        needSort = existingHandler.priority !== priority;
        existingHandler.priority = priority;
      } else {
        const lastHandler = Array.from(handlers)[handlers.size - 1];
        const newHandler = createHandler(handler, priority);
        handlers.add(newHandler);
        needSort = lastHandler !== undefined && lastHandler.priority > priority;
      }
      if (needSort) {
        getSortedHandlers();
      }
    },

    /**
     * 移除 handler
     */
    disconnect: (handler: T) => {
      const existingHandler = Array.from(handlers).find((it) =>
        handlerOptions.equals(it, handler),
      );
      if (existingHandler) {
        handlers.delete(existingHandler);
      }
    },

    /**
     * 清空 handlers
     */
    clear: () => handlers.clear(),

    /**
     * 触发
     */
    emit: (...args: Parameters<T>) => {
      getSortedHandlers().forEach((handler) =>
        handlerOptions.handle(handler, ...args),
      );
    },
  };
};

const handlerOptions = {
  // 比较 handler 和 listener
  equals: <T extends Handler>(a: SignalHandler<T>, b: Handler): boolean =>
    a.handler === b,

  // 执行 handlers
  handle: <T extends Handler>(
    signalHandler: SignalHandler<T>,
    ...args: any[]
  ): void => signalHandler.handler(...args),

  // 比较 handlers 优先级
  comparePriority: <T extends Handler>(
    a: SignalHandler<T>,
    b: SignalHandler<T>,
  ): number => a.priority - b.priority,
};
