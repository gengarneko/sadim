import {ILinkedComponent} from './linked-component';

/**
 * 组件链表
 *
 * 作用:
 *  管理一组相关联的组件
 *  维护组件之间的顺序关系
 *  提供便捷的遍历和操作方法
 *  确保组件链表的完整性（防止重复添加、正确删除等）
 */

export class LinkedComponentList<T extends ILinkedComponent> {
  private _head: T | undefined;

  public get head(): T | undefined {
    return this._head;
  }

  public get isEmpty(): boolean {
    return this._head === undefined;
  }

  public add(linkedComponent: T): void {
    let prev: T | undefined = undefined;
    let current: T | undefined = this._head;
    while (current !== undefined) {
      if (current === linkedComponent) {
        throw new Error('Component is already appended, appending it once again will break linked items order');
      }
      prev = current;
      current = current.next as (T | undefined);
    }
    if (this._head === undefined) {
      this._head = linkedComponent;
    } else {
      prev!.next = linkedComponent;
    }
  }

  public remove(linkedComponent: T): boolean {
    const [prev, current] = this.find(linkedComponent);
    if (current === undefined) {
      return false;
    }
    if (prev === undefined) {
      this._head = current.next as (T | undefined);
    } else {
      // @ts-ignore
      prev.next = current.next
    }
    return true;
  }

  public* nodes() {
    let node = this.head;
    while (node !== undefined) {
      yield node;
      node = node.next as (T | undefined);
    }
  }

  public iterate(action: (value: T) => void): void {
    for (const node of this.nodes()) {
      action(node);
    }
  }

  public clear(): void {
    this._head = undefined;
  }

  private find(linkedComponent: T): [prev: T | undefined, current: T | undefined] {
    let prev: T | undefined;
    let current: T | undefined = this._head;

    while (current !== undefined) {
      if (current === linkedComponent) {
        return [prev, current];
      }
      prev = current;
      current = current.next as (T | undefined);
    }
    return [undefined, undefined];
  }
}
