/** 链表组件 可以通过 Entity.append 方法将多个组件串联 */
declare class LinkedComponent {
  id: string | undefined;
  next: LinkedComponent | undefined;

  constructor(id?: string);
}

function LinkedComponent(this: LinkedComponent, id?: string) {
  this.id = id;
  this.next = undefined;
}

/** 检查是否为链表组件 */
const isLinkedComponent = (component: any): component is LinkedComponent => {
  return component !== undefined && component.hasOwnProperty('next');
}

function linkedComponent(id?: string) {
  return new LinkedComponent(id);
}

export { linkedComponent, LinkedComponent, isLinkedComponent };
