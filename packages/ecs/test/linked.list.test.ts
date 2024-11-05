import { describe, expect, it } from 'vitest';

import { linkedComponent } from '../src/ecs/linked-component';
import { linkedComponentList } from '../src/ecs/linked-component-list';

const component = linkedComponent();

describe('Linked list', () => {
  it(`添加组件到空链表, head 指向组件`, () => {
    const list = linkedComponentList();
    list.add(component);
    expect(list.head).toBe(component);
  });

  it(`添加组件到空链表, 链表非空`, () => {
    const list = linkedComponentList();
    expect(list.isEmpty).toBeTruthy();
    list.add(component);
    expect(list.isEmpty).toBeFalsy();
  });

  it(`从链表中移除组件, 链表为空`, () => {
    const list = linkedComponentList();
    list.add(component);
    expect(list.remove(component)).toBeTruthy();
    expect(list.isEmpty).toBeTruthy();
  });

  it(`从空链表中移除组件, 找不到此组件`, () => {
    const list = linkedComponentList();
    list.add(component);
    expect(list.find(component)).toEqual([undefined, component]);
    list.remove(component);
    expect(list.find(component)).toEqual([undefined, undefined]);
  });

  it(`从链表中移除组件, 链表非空`, () => {
    const list = linkedComponentList();
    const component1 = linkedComponent();
    const component2 = linkedComponent();
    list.add(component1);
    list.add(component2);
    list.remove(component2);
    expect(list.isEmpty).toBeFalsy();
  });

  it(`遍历链表`, () => {
    const list = linkedComponentList();
    const components = [
      linkedComponent(),
      linkedComponent(),
      linkedComponent(),
    ];
    components.forEach((component) => list.add(component));
    list.iterate((component) => {
      const index = components.indexOf(component);
      expect(index).not.toBe(-1);
      components.splice(index, 1);
    });
    expect(components.length).toBe(0);
  });

  it('在遍历过程中移除当前组件不会破坏遍历', () => {
    const list = linkedComponentList();
    const components = [
      linkedComponent(),
      linkedComponent(),
      linkedComponent(),
    ];
    components.forEach((component) => list.add(component));
    list.iterate((component) => {
      list.remove(component);
      const index = components.indexOf(component);
      expect(index).not.toBe(-1);
      components.splice(index, 1);
    });
    expect(components.length).toBe(0);
  });

  it('从链表中移除所有组件', () => {
    const list = linkedComponentList();
    list.add(linkedComponent());
    list.add(linkedComponent());
    list.add(linkedComponent());
    list.clear();
    expect(list.isEmpty).toBeTruthy();
  });
});
