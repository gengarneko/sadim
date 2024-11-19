import {Class} from './utils/class';

// * --------------------------------------------------------------------------
// * Types
// * --------------------------------------------------------------------------

/**
 * Components are just javascript classes with constructor.
 */
export type Component = Class;
export type ComponentConstructor = new (...args: any[]) => Component;

export interface TagComponent {
  readonly IS_ZST: true;
}

// * --------------------------------------------------------------------------
// * Tag
// * --------------------------------------------------------------------------

/**
 * Tag is a empty component that can be used to identify entities.
 * Tag components are treated as zero-sized types (ZSTs) -
 * they are not constructed and do not take up space for storage.
 * Use it to replace creating a new component class when you don't need extra data.
 */
class Tag {
  static readonly IS_ZST = true as const;
}

/**
 * create a tag component
 */
export function createTag(name?: string) {
  const TagClass = class extends Tag {};
  Object.defineProperty(TagClass, 'name', {value: name ?? 'AnonymousTag'});
  return TagClass;
}

// * --------------------------------------------------------------------------
// * Type Guards
// * --------------------------------------------------------------------------

/**
 * Determine if the provided component type is a tag.
 * @param item The component type to check.
 * @returns A boolean indicating if the provided component is a tag.
 */
export function isSizedComponent(component: Component): boolean {
  return !isTagComponent(component);
}

/**
 * Determine if the provided component type is a tag.
 * @param item The component type to check.
 * @returns A boolean indicating if the provided component is a tag.
 */
export function isTagComponent(component: Component): boolean {
  return 'IS_ZST' in component && component.IS_ZST === true;
}
