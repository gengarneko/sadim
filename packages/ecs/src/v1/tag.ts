/**
 * Tag（标签）是一个简单的标记，可以被视为没有数据的组件。
 * 当你不需要额外的数据时，可以使用它来代替创建新的组件类。
 * use it to replace creating a new component class when you don't need extra data.
 */
export type Tag = number | string;

/**
 * 这个断言函数可以帮助你判断一个项目是组件还是标签
 * @param item
 * @returns {item is Tag}
 */
export function isTag(item: unknown): item is Tag {
  const type = typeof item;
  return type === 'string' || type === 'number';
}
