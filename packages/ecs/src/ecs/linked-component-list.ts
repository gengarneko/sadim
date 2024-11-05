import {LinkedComponent} from './linked-component';

declare class LinkedComponentList<T extends LinkedComponent> {
  /** @internal */
  _head: T | undefined;

  constructor();

  /** @internal */
  _findNode: (component: T) => [prev: T | undefined, current: T | undefined];

  get head(): T | undefined;

  get isEmpty(): boolean;

  add: (linkedComponent: T) => this;

  remove: (linkedComponent: T) => this;

  iterate: (action: (value: T) => void) => void;

  nodes: () => Generator<T>;

  clear: () => void;

  find: (linkedComponent: T) => [prev: T | undefined, current: T | undefined];
}

/** @internal */
// This enables better control of the transpiled output size.
function LinkedComponentList<T extends LinkedComponent>(
  this: LinkedComponentList<T>,
) {
  this._head = undefined;
}

Object.defineProperty(LinkedComponentList.prototype, 'head', {
  get: function () {
    return this._head;
  },
});

Object.defineProperty(LinkedComponentList.prototype, 'isEmpty', {
  get: function () {
    return this._head === undefined;
  },
});

/** 添加 component 到链表 */
LinkedComponentList.prototype.add = function (
  linkedComponent: LinkedComponent,
) {
  let prev: LinkedComponent | undefined = undefined;
  let current: LinkedComponent | undefined = this._head;
  while (current !== undefined) {
    if (current === linkedComponent) {
      throw new Error(
        'Component is already appended, appending it once again will break linked items order',
      );
    }
    prev = current;
    current = current.next as LinkedComponent | undefined;
  }
  if (this._head === undefined) {
    this._head = linkedComponent;
  } else {
    prev!.next = linkedComponent;
  }
  return this;
};

/** 从链表中移除 component */
LinkedComponentList.prototype.remove = function (
  linkedComponent: LinkedComponent,
) {
  const [prev, current] = this.find(linkedComponent);
  if (current === undefined) {
    return this;
  }
  if (prev === undefined) {
    this._head = current.next as LinkedComponent | undefined;
  } else {
    prev.next = current.next;
  }
  return this;
};

/** 遍历链表 */
LinkedComponentList.prototype.nodes = function* () {
  let node = this._head;
  while (node !== undefined) {
    yield node;
    node = node.next as LinkedComponent | undefined;
  }
};

/** 迭代链表 */
LinkedComponentList.prototype.iterate = function (
  action: (value: LinkedComponent) => void,
) {
  for (const node of this.nodes()) {
    action(node);
  }
};

/** 清空链表 */
LinkedComponentList.prototype.clear = function () {
  this._head = undefined;
};

/** 查找链表中的 component */
LinkedComponentList.prototype.find = function (
  linkedComponent: LinkedComponent,
) {
  let prev: LinkedComponent | undefined;
  let current: LinkedComponent | undefined = this._head;
  while (current !== undefined) {
    if (current === linkedComponent) {
      return [prev, current];
    }
    prev = current;
    current = current.next as LinkedComponent | undefined;
  }
  return [undefined, undefined];
};

/** 创建空组件链表 */
function linkedComponentList<T extends LinkedComponent>() {
  return new LinkedComponentList<T>();
}

export {linkedComponentList, LinkedComponentList};
