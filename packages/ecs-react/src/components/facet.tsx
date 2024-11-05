import {Component, ContextType} from 'react';

import {configure, makeObservable, observable} from 'mobx';

import {EntityContext} from '../hooks/use-entity';
import {NonFunctionProperties} from '../lib/utils';

configure({enforceActions: 'never'});

const filteredProps = ['props', 'context', 'refs', 'updater', 'meta'];

/**
 * 用于在 ECS 中实现 Component 功能
 */
export class Facet<T extends {}> extends Component<
  NonFunctionProperties<Omit<T, 'meta'>>,
  NonFunctionProperties<Omit<T, ''>>
> {
  static override contextType = EntityContext;
  declare context: ContextType<typeof EntityContext>;

  createFake() {
    const ctor = Object.getPrototypeOf(this).constructor;
    return new ctor();
  }

  /**
   * 获取组件中需要被 MobX 观察的属性列表
   *
   * class MyFacet extends Facet<any> {
   *  position = { x: 0, y: 0 };
   *  name = "player";
   *  componentRef = null;  // 会被排除
   *  props = {};          // 会被排除
   * }
   *
   * getAnnotations return:
   *  {
   *    position: observable,
   *    name: observable,
   *  }
   */
  getAnnotations(fake: unknown) {
    const entries = new Map(
      Object.getOwnPropertyNames(fake)
        .filter((k) => !filteredProps.includes(k) && !k.endsWith('Ref'))
        .map((k) => [k, observable]),
    ).entries();
    return Object.fromEntries(entries) as any;
  }

  asComponent() {
    return this as NonNullable<Facet<T>>;
  }

  /**
   * 当组件挂载时：
   * 1. props 中的值会被复制到组件实例
   * 2. position 和 name 等属性会变成响应式属性
   * 3. 组件会被添加到实体系统中
   */
  override componentDidMount() {
    if (this.context) {
      Object.assign(this, this.props);
      const fake = this.createFake();
      const annotations = this.getAnnotations(fake);
      makeObservable(this, annotations, {autoBind: true});
      this.context.add(this as any);
    } else {
      console.error(`Data Component without Entity Context!`);
    }
  }

  override render() {
    Object.assign(this, this.props);
    return null;
  }
}
