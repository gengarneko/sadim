import { Class } from '../utils/class';


const COMPONENT_CLASS_ID = '__componentClassId__' as const;
let componentClassId: number = 1;

type Component<T> = {
  [K in keyof T]: T[K];
}

type ComponentId<T> = Component<T> & {
  [COMPONENT_CLASS_ID]: number;
};

/**
 * 获取组件类的ID
 *
 * @param component 组件类
 * @param createIfNotExists - 如果为 `true`，则在组件类之前未分配 ID 的情况下，
 *  将为其创建一个唯一的ID
 */
export function getComponentId<T>(
  component: Component<T>,
  createIfNotExists: boolean = false,
): number | undefined {
  if (component.hasOwnProperty(COMPONENT_CLASS_ID)) {
    return (component as ComponentId<T>)[COMPONENT_CLASS_ID];
  } else if (createIfNotExists) {
    return (component as ComponentId<T>)[COMPONENT_CLASS_ID] = componentClassId++;
  }
  return undefined;
}

/**
 * @internal
 */
export function getComponentClass<T extends K, K>(component: NonNullable<T>, resolveClass?: Class<K>) {
  let componentClass = Object.getPrototypeOf(component).constructor as Class<T>;
  if (!resolveClass) {
    return componentClass;
  }

  if (!(component instanceof resolveClass || componentClass === resolveClass)) {
    throw new Error('Resolve class should be an ancestor of component class');
  }
  componentClass = resolveClass as Class<T>;
  return componentClass;
}
