// * --------------------------------------------------------------------------
// * Component
// * --------------------------------------------------------------------------

/**
 * Components are just javascript classes with constructor.
 */

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
  static readonly IS_ZST = true;
}

type TagComponentType = typeof Tag;

/**
 * create a tag component
 */
function createTag() {
  class ZST extends Tag {}
  return ZST;
}

/**
 * Determine if the provided component type is a tag.
 * @param item The component type to check.
 * @returns A boolean indicating if the provided component is a tag.
 */
function isSizedComponent(item: any): item is TagComponentType {
  return !item.IS_ZST;
}

/**
 * Determine if the provided component type is a tag.
 * @param item The component type to check.
 * @returns A boolean indicating if the provided component is a tag.
 */
function isTagComponent(item: any): item is TagComponentType {
  return !isSizedComponent(item);
}

// * --------------------------------------------------------------------------
// * Export
// * --------------------------------------------------------------------------

export {
  Tag,
  createTag,
  isSizedComponent,
  isTagComponent,
  type TagComponentType,
};
