import { Engine } from "./engine";
import { Entity } from "./entity";

/**
 * System 是应用的基础，用以处理实体和组件。
 */
declare class System {
  /** @internal */
  _priority: number;

  /** @internal */
  _engine?: Engine | undefined;

  /** @internal */
  _isRemovalRequested: boolean;

  /** 获取引擎实例 */
  get engine(): Engine;

  /** 指示系统是否应在当前更新周期结束时从引擎中删除 */
  get isRemovalRequested(): boolean;

  /** 获取共享配置实体 */
  get sharedConfig(): Entity;

  /** 获取系统优先级 */
  get priority(): number;

  /** 更新系统 */
  update(dt: number): void;

  /** 添加到引擎时调用 */
  onAddedToEngine(): void;

  /** 从引擎中移除时调用 */
  onRemovedFromEngine(): void;

  /** message dispatcher */
  dispatch<T>(message: T): void;

  /** @internal */
  setEngine(engine: Engine | undefined): void;

  /** @internal */
  setPriority(priority: number): void

  /** @internal */
  requestRemoval(): void;
}

function System(this: System) {
  this._priority = 0;
  this._engine = undefined;
  this._isRemovalRequested = false;
}

Object.defineProperty(System.prototype, 'engine', {
    get() {
      if (this._engine === undefined)
      throw new Error(
        `Property "engine" can't be accessed when system is not added to the engine`,
    );
    return this._engine;
  },
});

Object.defineProperty(System.prototype, 'isRemovalRequested', {
  get() {
    return this._isRemovalRequested;
  },
});

Object.defineProperty(System.prototype, 'sharedConfig', {
  get() {
    if (this._engine === undefined)
      throw new Error(
        `Property "sharedConfig" can't be accessed when system is not added to the engine`,
      );
    return this._engine.sharedConfig;
  },
});

Object.defineProperty(System.prototype, 'priority', {
  get() {
    return this._priority;
  },
});

// @ts-ignore
System.prototype.update = function (dt: number) {};

System.prototype.onAddedToEngine = function () {};

System.prototype.onRemovedFromEngine = function () {};

System.prototype.dispatch = function <T>(message: T) {
  if (this._engine === undefined) {
    throw new Error(
      "Dispatching a message can't be done while system is not attached to the engine",
    );
  }
  this.engine.dispatch(message);
};

System.prototype.setEngine = function (engine: Engine | undefined) {
  this._engine = engine;
};

System.prototype.setPriority = function (priority: number) {
  this._priority = priority;
};

System.prototype.requestRemoval = function () {
  this._isRemovalRequested = true;
};

export function system() {
  return new System();
}

export { System };
