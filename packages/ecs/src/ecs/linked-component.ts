/**
 * 链表组件的接口定义
 * @see {@link Entity.append} 可以通过 Entity.append 方法将多个组件串联
 */

export interface ILinkedComponent {
  id?: string;
  next?: ILinkedComponent;
}

/**
 * ILinkedComponent 接口的简单实现
 * @see {@link Entity.append}
 */
export class LinkedComponent implements ILinkedComponent {
  // @ts-ignore
  public next?: this = undefined;

  public constructor(public id?: string) {
  }
}

/**
 * @internal
 */
export function isLinkedComponent(component: any): component is ILinkedComponent {
  return component !== undefined && component.hasOwnProperty('next');
}
