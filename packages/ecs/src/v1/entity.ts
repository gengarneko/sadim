import type {Signal} from '@sadim/signal';
import type {LinkedComponent} from './linked-component';
import type {LinkedComponentList} from './linked-component-list';

import {signal} from '@sadim/signal';

import {Class} from './class';
import {getComponentClass, getComponentId} from './component-id';
import {isLinkedComponent} from './linked-component';
import {linkedComponentList} from './linked-component-list';
import {isTag, Tag} from './tag';

export interface ReadonlyEntity {
  /** 当 component 或者 tag 被添加到 entity 时触发 */
  readonly onComponentAdded: Signal<ComponentUpdateHandler>;

  /** 当 component 或者 tag 从 entity 中移除时触发 */
  readonly onComponentRemoved: Signal<ComponentUpdateHandler>;

  /** 当 entity 请求无效时触发 */
  readonly onInvalidationRequested: Signal<() => void>;

  /** 获取 entity 中所有的 components */
  readonly components: Readonly<Record<number, unknown>>;

  /** 获取 entity 中所有的 tags */
  readonly tags: ReadonlySet<Tag>;

  /** 检查 entity 是否包含某个 component 或者 tag */
  has<T>(componentClassOrTag: Class<T> | Tag, id?: string): boolean;

  /** 检查 entity 是否包含某个 component */
  hasComponent<T>(component: Class<T>, id?: string): boolean;

  /** 检查 entity 是否包含某个 tag */
  hasTag(tag: Tag): boolean;

  /** 检查 entity 是否包含多个 component 中的任意一个 */
  hasAny(...componentClassOrTag: Array<Class<unknown> | Tag>): boolean;

  /** 检查 entity 是否包含多个 component 中的所有 */
  hasAll(...componentClassOrTag: Array<Class<unknown> | Tag>): boolean;

  /** 检查 entity 是否包含某个 component */
  contains<T extends K, K>(component: T, resolveClass?: Class<K>): boolean;

  /** 获取 entity 中某个 component 或者 tag */
  get<T>(componentClass: Class<T>, id?: string): T | undefined;

  /** 获取 entity 中所有的 components */
  getComponents(): unknown[];

  /** 获取 entity 中所有的 tags */
  getTags(): Tag[];

  /** 遍历获取 entity 中所有的 components */
  getAll<T>(componentClass: Class<T>): Generator<T, void, T>;

  /** 遍历 entity 中所有的 components */
  iterate<T>(componentClass: Class<T>, action: (component: T) => void): void;

  /** 查找 entity 中指定 class 的 components 中第一个满足条件的 component */
  find<T>(
    componentClass: Class<T>,
    predicate: (component: T) => boolean,
  ): T | undefined;

  /** 获取 entity 中指定 class 的 components 数量 */
  lengthOf<T>(componentClass: Class<T>): number;
}

declare class Entity implements ReadonlyEntity {
  /** 当 component 或者 tag 被添加到 entity 时触发 */
  onComponentAdded: Signal<ComponentUpdateHandler>;

  /** 当 component 或者 tag 从 entity 中移除时触发 */
  onComponentRemoved: Signal<ComponentUpdateHandler>;

  /** 当 entity 请求无效时触发 */
  onInvalidationRequested: Signal<() => void>;

  /** 唯一标识 */
  id: number;

  constructor();

  /** 组件 */
  _components: Record<number, unknown>;

  /** 链表组件 */
  _linkedComponents: Record<number, LinkedComponentList<LinkedComponent>>;

  /** 标签 */
  _tags: Set<Tag>;

  /** 获取 entity 中所有的 components */
  get components(): Readonly<Record<number, unknown>>;

  /** 获取 entity 中所有的 tags */
  get tags(): ReadonlySet<Tag>;

  /** 添加 component 或者 tag */
  add<T extends K, K extends unknown>(
    componentOrTag: NonNullable<T> | Tag,
    resolveClass?: Class<K>,
  ): Entity;

  /** 添加 linked component */
  append<T extends K, K extends LinkedComponent>(
    component: NonNullable<T>,
    resolveClass?: Class<K>,
  ): Entity;

  /** 移除第一个添加的 component */
  withdraw<T>(componentClass: Class<T>): T | undefined;

  /** 移除指定 id 的 linked component */
  pick<T extends LinkedComponent>(
    resolveClass: Class<T>,
    id: string,
  ): T | undefined;
  /** 移除指定 component */
  pick<T>(component: NonNullable<T>, resolveClass?: Class<T>): T | undefined;
  pick<T>(
    componentOrResolveClass: NonNullable<T> | Class<T>,
    resolveClassOrId?: Class<T> | string,
  ): T | undefined;

  /** 添加 component */
  addComponent<T extends K, K extends unknown>(
    component: NonNullable<T>,
    resolveClass?: Class<K>,
  ): Entity;

  /** 添加 linked component */
  appendComponent<T extends K, K extends LinkedComponent>(
    component: NonNullable<T>,
    resolveClass?: Class<K>,
  ): Entity;

  /** 添加 tag */
  addTag(tag: Tag): Entity;

  /** 检查 entity 是否包含某个 component 或者 tag */
  has<T>(componentClassOrTag: Class<T> | Tag, id?: string): boolean;

  /** 检查 entity 是否包含某个 component */
  contains<T extends K, K>(
    component: NonNullable<T>,
    resolveClass?: Class<K>,
  ): boolean;

  /** 检查 entity 是否包含某个 component */
  hasComponent<T>(component: Class<T>, id?: string): boolean;

  /** 检查 entity 是否包含某个 tag */
  hasTag(tag: Tag): boolean;

  /** 检查 entity 是否包含多个 component 中的任意一个 */
  hasAny(...componentClassOrTag: Array<Class<unknown> | Tag>): boolean;

  /** 检查 entity 是否包含多个 component 中的所有 */
  hasAll(...componentClassOrTag: Array<Class<unknown> | Tag>): boolean;

  /** 获取 entity 中某个 component 或者 tag */
  get<T>(componentClass: Class<T>, id?: string): T | undefined;

  /** 获取 entity 中所有的 components */
  getComponents(): unknown[];

  /** 获取 entity 中所有的 tags */
  getTags(): Tag[];

  /** 移除 component 或者 tag */
  remove<T>(componentClassOrTag: Class<T> | Tag): T | undefined;

  /** 移除 component */
  removeComponent<T>(componentClassOrTag: Class<T>): T | undefined;

  /** 移除 tag */
  removeTag(tag: Tag): void;

  /** 清空 entity */
  clear(): void;

  /** 复制 entity */
  copyFrom(entity: Entity): this;

  /** 遍历 entity 中所有的 components */
  iterate<T>(componentClass: Class<T>, action: (component: T) => void): void;

  /** 获取 entity 中指定 class 的 components */
  getAll<T>(componentClass: Class<T>): Generator<T, void, T | undefined>;

  /** 查找 entity 中指定 class 的 components 中第一个满足条件的 component */
  find<T>(
    componentClass: Class<T>,
    predicate: (component: T) => boolean,
  ): T | undefined;

  /** 获取 entity 中指定 class 的 components 数量 */
  lengthOf<T>(componentClass: Class<T>): number;

  /** 使用此方法来通知 entity 的 component 属性已更改 */
  invalidate(): void;

  /** 获取 entity 的快照 */
  takeSnapshot<T>(
    result: EntitySnapshot,
    changedComponentOrTag?: T,
    resolveClass?: Class<T>,
  ): void;

  /** 获取 entity 中指定 class 的 linked component 链表 */
  getLinkedComponentList(
    componentClassOrId: number | Class<any>,
    createIfNotExists?: boolean,
  ): LinkedComponentList<any> | undefined;

  /** 移除 entity 中指定 class 的 linked component */
  withdrawComponent<T extends K, K extends LinkedComponent>(
    component: NonNullable<T>,
    resolveClass?: Class<K>,
  ): T | undefined;

  /** 通知 entity 的 component 属性已添加 */
  dispatchOnComponentAdded<T>(component: NonNullable<T>): void;

  /** 通知 entity 的 component 属性已移除 */
  dispatchOnComponentRemoved<T>(component: NonNullable<T>): void;
}

function Entity(this: Entity) {
  this.onComponentAdded = signal();
  this.onComponentRemoved = signal();
  this.onInvalidationRequested = signal();

  this.id = entityId++;

  this._components = {};
  this._linkedComponents = {};
  this._tags = new Set();
}

Object.defineProperty(Entity.prototype, 'components', {
  get: function () {
    return this._components;
  },
});

Object.defineProperty(Entity.prototype, 'tags', {
  get: function () {
    return new Set(this._tags);
  },
});

Entity.prototype.add = function <T extends K, K extends unknown>(
  componentOrTag: NonNullable<T> | Tag,
  resolveClass?: Class<K>,
) {
  if (isTag(componentOrTag)) {
    this.addTag(componentOrTag);
  } else {
    this.addComponent(componentOrTag, resolveClass);
  }
  return this;
};

Entity.prototype.append = function <T extends K, K extends LinkedComponent>(
  component: NonNullable<T>,
  resolveClass?: Class<K>,
): Entity {
  return this.appendComponent(component, resolveClass);
};

Entity.prototype.withdraw = function <T>(componentClass: Class<T>) {
  const component = this.get(componentClass);
  if (component === undefined) {
    return;
  }
  if (isLinkedComponent(component)) {
    return this.withdrawComponent(
      component,
      componentClass as Class<LinkedComponent>,
    );
  } else {
    return this.remove(componentClass);
  }
};

Entity.prototype.pick = function <T>(
  componentOrResolveClass: NonNullable<T> | Class<T>,
  resolveClassOrId?: Class<T> | string,
): T | undefined {
  if (typeof resolveClassOrId === 'string') {
    const component = this.find<T>(
      componentOrResolveClass as Class<T>,
      (component) =>
        isLinkedComponent(component) && component.id === resolveClassOrId,
    );
    if (isLinkedComponent(component)) {
      return this.withdrawComponent(
        component,
        componentOrResolveClass as Class<LinkedComponent>,
      );
    }
    return undefined;
  }
  if (isLinkedComponent(componentOrResolveClass)) {
    return this.withdrawComponent(
      componentOrResolveClass,
      resolveClassOrId as Class<LinkedComponent>,
    );
  }
  return this.remove(
    resolveClassOrId ??
      getComponentClass(componentOrResolveClass as NonNullable<T>),
  );
};

Entity.prototype.addComponent = function <T extends K, K extends unknown>(
  component: NonNullable<T>,
  resolveClass?: Class<K>,
) {
  const componentClass = getComponentClass(component, resolveClass);
  const id = getComponentId(componentClass, true)!;
  const linkedComponent = isLinkedComponent(component);
  if (this._components[id] !== undefined) {
    if (!linkedComponent && component === this._components[id]) {
      return this;
    }
    this.remove(componentClass);
  }
  if (linkedComponent) {
    this.append(
      component as LinkedComponent,
      resolveClass as Class<LinkedComponent>,
    );
  } else {
    this._components[id] = component;
    this.dispatchOnComponentAdded(component);
  }
  return this;
};

Entity.prototype.appendComponent = function <
  T extends K,
  K extends LinkedComponent,
>(component: NonNullable<T>, resolveClass?: Class<K>): Entity {
  const componentClass = getComponentClass(component, resolveClass);
  const componentId = getComponentId(componentClass, true)!;
  const componentList = this.getLinkedComponentList(componentId)!;
  componentList.add(component);
  if (this._components[componentId] === undefined) {
    this._components[componentId] = componentList.head;
  }
  this.dispatchOnComponentAdded(component);
  return this;
};

Entity.prototype.addTag = function (tag: Tag) {
  if (!this._tags.has(tag)) {
    this._tags.add(tag);
    this.dispatchOnComponentAdded(tag);
  }
  return this;
};

Entity.prototype.has = function <T>(
  componentClassOrTag: Class<T> | Tag,
  id?: string,
): boolean {
  if (isTag(componentClassOrTag)) {
    return this.hasTag(componentClassOrTag);
  }
  return this.hasComponent(componentClassOrTag, id);
};

Entity.prototype.contains = function <T extends K, K>(
  component: NonNullable<T>,
  resolveClass?: Class<K>,
): boolean {
  const componentClass = getComponentClass(component, resolveClass);
  if (isLinkedComponent(component)) {
    return (
      this.find(componentClass, (value) => value === component) !== undefined
    );
  }
  return this.get(componentClass) === component;
};

Entity.prototype.hasComponent = function <T>(
  component: Class<T>,
  id?: string,
): boolean {
  return this.get(component, id) !== undefined;
};

Entity.prototype.hasTag = function (tag: Tag): boolean {
  return this._tags.has(tag);
};

Entity.prototype.hasAny = function (
  ...componentClassOrTag: Array<Class<unknown> | Tag>
): boolean {
  return componentClassOrTag.some((value) => this.has(value));
};

Entity.prototype.hasAll = function (
  ...componentClassOrTag: Array<Class<unknown> | Tag>
): boolean {
  return componentClassOrTag.every((value) => this.has(value));
};

Entity.prototype.get = function <T>(
  componentClass: Class<T>,
  id?: string,
): T | undefined {
  const cid = getComponentId(componentClass);
  if (cid === undefined) return undefined;
  let component = this._components[cid];
  if (id !== undefined) {
    if (isLinkedComponent(component)) {
      while (component !== undefined) {
        if ((component as LinkedComponent).id === id) return component as T;
        component = (component as LinkedComponent).next;
      }
    }
    return undefined;
  }
  return this._components[cid] as T;
};

Entity.prototype.getComponents = function () {
  return Array.from(Object.values(this._components));
};

Entity.prototype.getTags = function () {
  return Array.from(this._tags);
};

Entity.prototype.remove = function <T>(
  componentClassOrTag: Class<T> | Tag,
): T | undefined {
  if (isTag(componentClassOrTag)) {
    this.removeTag(componentClassOrTag);
    return undefined;
  }
  return this.removeComponent(componentClassOrTag);
};

Entity.prototype.removeComponent = function <T>(
  componentClassOrTag: Class<T>,
): T | undefined {
  const id = getComponentId(componentClassOrTag);
  if (id === undefined || this._components[id] === undefined) {
    return undefined;
  }

  let value = this._components[id]!;
  if (isLinkedComponent(value)) {
    const list = this.getLinkedComponentList(componentClassOrTag)!;
    while (!list.isEmpty) {
      this.withdraw(componentClassOrTag);
    }
  } else {
    delete this._components[id];
    this.dispatchOnComponentRemoved(value);
  }

  return value as T;
};

Entity.prototype.removeTag = function (tag: Tag) {
  if (this._tags.has(tag)) {
    this._tags.delete(tag);
    this.dispatchOnComponentRemoved(tag);
  }
};

Entity.prototype.clear = function () {
  this._components = {};
  this._linkedComponents = {};
  this._tags.clear();
};

Entity.prototype.copyFrom = function (entity: Entity) {
  this._components = Object.assign({}, entity._components);
  this._linkedComponents = Object.assign({}, entity._linkedComponents);
  this._tags = new Set(entity._tags);
  return this;
};

Entity.prototype.iterate = function <T>(
  componentClass: Class<T>,
  action: (component: T) => void,
) {
  if (!this.hasComponent(componentClass)) return;
  this.getLinkedComponentList(componentClass)?.iterate(action);
};

Entity.prototype.getAll = function* <T>(componentClass: Class<T>) {
  if (!this.hasComponent(componentClass)) return;
  const list = this.getLinkedComponentList(componentClass, false);
  if (list === undefined) return undefined;
  yield* list.nodes();
};

Entity.prototype.find = function <T>(
  componentClass: Class<T>,
  predicate: (component: T) => boolean,
): T | undefined {
  const componentIdToFind = getComponentId(componentClass, false);
  if (componentIdToFind === undefined) return undefined;
  const component = this._components[componentIdToFind];
  if (component === undefined) return undefined;
  if (isLinkedComponent(component)) {
    let linkedComponent: LinkedComponent | undefined = component;
    while (linkedComponent !== undefined) {
      if (predicate(linkedComponent as T)) return linkedComponent as T;
      linkedComponent = linkedComponent.next;
    }
    return undefined;
  } else return predicate(component as T) ? (component as T) : undefined;
};

Entity.prototype.lengthOf = function <T>(componentClass: Class<T>) {
  let result = 0;
  this.iterate(componentClass, () => {
    result++;
  });
  return result;
};

Entity.prototype.invalidate = function () {
  this.onInvalidationRequested.emit(this);
};

Entity.prototype.takeSnapshot = function <T>(
  result: EntitySnapshot,
  changedComponentOrTag?: T,
  resolveClass?: Class<T>,
) {
  const previousState = result.previous as Entity;
  if (result.current !== this) {
    result.current = this;
    previousState.copyFrom(this);
  }

  if (changedComponentOrTag === undefined) {
    return;
  }

  if (isTag(changedComponentOrTag)) {
    const previousTags = previousState._tags;
    if (this.has(changedComponentOrTag)) {
      previousTags.delete(changedComponentOrTag);
    } else {
      previousTags.add(changedComponentOrTag);
    }
  } else {
    const componentClass =
      resolveClass ?? Object.getPrototypeOf(changedComponentOrTag).constructor;
    const componentId = getComponentId(componentClass!, true)!;
    const previousComponents = previousState._components;
    if (this.has(componentClass)) {
      delete previousComponents[componentId];
    } else {
      previousComponents[componentId] = changedComponentOrTag;
    }
  }
};

Entity.prototype.getLinkedComponentList = function (
  componentClassOrId: number | Class<any>,
  createIfNotExists = true,
) {
  if (typeof componentClassOrId !== 'number') {
    componentClassOrId = getComponentId(componentClassOrId)!;
  }
  if (
    this._linkedComponents[componentClassOrId] !== undefined ||
    !createIfNotExists
  ) {
    return this._linkedComponents[componentClassOrId];
  } else {
    return (this._linkedComponents[componentClassOrId] =
      linkedComponentList<LinkedComponent>());
  }
};

Entity.prototype.withdrawComponent = function <
  T extends K,
  K extends LinkedComponent,
>(component: NonNullable<T>, resolveClass?: Class<K>) {
  const componentClass = getComponentClass(component, resolveClass);
  const componentList = this.getLinkedComponentList(componentClass, false);
  if (!this.hasComponent(componentClass) || componentList === undefined)
    return undefined;
  const result = componentList.remove(component) ? component : undefined;
  const componentId = getComponentId(componentClass, true)!;
  if (componentList.isEmpty) {
    delete this._components[componentId];
    delete this._linkedComponents[componentId];
  } else {
    this._components[componentId] = componentList.head;
  }
  if (result !== undefined) {
    this.dispatchOnComponentRemoved(result);
  }
  return result;
};

Entity.prototype.dispatchOnComponentAdded = function <T>(
  component: NonNullable<T>,
) {
  if (this.onComponentAdded.hasHandlers) {
    this.onComponentAdded.emit(this, component);
  }
};

Entity.prototype.dispatchOnComponentRemoved = function <T>(
  value: NonNullable<T>,
) {
  if (this.onComponentRemoved.hasHandlers) {
    this.onComponentRemoved.emit(this, value);
  }
};

export function entity() {
  return new Entity();
}

export class EntitySnapshot {
  private _current?: Entity;
  private _previous: ReadonlyEntity = new Entity();

  /**
   * Gets an instance of the actual entity
   * @returns {Entity}
   */
  public get current(): Entity {
    return this._current!;
  }

  /**
   * @internal
   */
  public set current(value: Entity) {
    this._current = value;
  }

  /**
   * Gets an instance of the previous state of entity
   */
  public get previous(): ReadonlyEntity {
    return this._previous;
  }
}

/**
 * Component update handler type.
 * @see {@link Entity.onComponentAdded}
 * @see {@link Entity.onComponentRemoved}
 */
export type ComponentUpdateHandler = <T>(
  entity: Entity,
  component: NonNullable<T>,
  componentClass?: Class<NonNullable<T>>,
) => void;

/**
 * Entity ids enumerator
 */
let entityId: number = 1;

export {Entity};
