import {isSizedComponent} from './component';
import {Entity} from './entity';
import {Class} from './utils/class';

// * --------------------------------------------------------------------------
// * Table
// * --------------------------------------------------------------------------

type TableConfig = {
  id: number;
  archetype: bigint;
  components: Class[];
};

declare class Table {
  static createEmpty(): Table;

  id: number;

  /** A bitmap representing which components an entity has. */
  archetype: bigint;

  /** @internal */
  _components: Class[];

  /** @internal */
  _columns: [...Array<object[]>];

  constructor(tableConfig: TableConfig);

  /** entities's count in this table */
  get length(): number;

  /** move the entity at `row` and all its associated data into `targetTable` */
  move: (args: {
    row: number;
    targetTable: Table;
    components: object[];
  }) => Entity | undefined;

  /** if this table contains a column for the provided component type */
  hasColumn(componentType: Class): boolean;

  /** the column for the provided component */
  getColumn<T extends Class>(componentType: T): InstanceType<T>[];
}

/**
 * @internal
 * This enables better control of the transpiled output size.
 */
function Table(this: Table, tableConfig: TableConfig) {
  const {components, archetype, id} = tableConfig;
  this.id = id;
  this.archetype = archetype;
  this._columns = components.map(() => []);
  this._components = components.filter(isSizedComponent);
}

Object.defineProperty(Table.prototype, 'length', {
  get(this: Table) {
    return this._columns[0]?.length ?? 0;
  },
});

/**
 * @param row The row of the entity to move.
 * @param targetTable The table to move that entity to.
 * @param components The components to move to the target table.
 * @returns The entity that was moved, or undefined if the entity was not found.
 */
Table.prototype.move = function ({row, targetTable, components}) {
  const entity = this._columns[0]?.[row] as Entity;
  const newRow = targetTable.getColumn(Entity)?.length;

  // 1. move component data
  for (let i = 0; i < this._components.length; i++) {
    const componentType = this._components[i]!;
    const column = this._columns[i]!;

    if (componentType === Entity) {
      // remove current entity
      column.splice(row, 1);

      // update subsequent entities' row number
      for (let j = row; j < column.length; j++) {
        const e = column[j] as Entity;
        e._row = j;
      }

      // add to target table
      if (targetTable.hasColumn(Entity)) {
        targetTable.getColumn(Entity).push(entity);
      }
    } else {
      // other components move normally
      const element = column.splice(row, 1)[0]!;
      if (targetTable.hasColumn(componentType)) {
        targetTable.getColumn(componentType).push(element);
      }
    }
  }

  // 2. add new components
  for (const component of components) {
    if (targetTable.hasColumn(component.constructor as any)) {
      targetTable.getColumn(component.constructor as any).push(component);
    }
  }

  // 3. update moved entity's reference
  if (entity) {
    entity._table = targetTable.id;
    entity._row = newRow;
  }

  return entity;
};

/**
 * @param componentType The component type to check for.
 * @returns A boolean, true if this table has a column for the provided component type.
 */
Table.prototype.hasColumn = function (componentType: Class) {
  return this._components.includes(componentType);
};

/**
 * @param componentType The component type to get the column for.
 * @returns The column for the provided component type.
 */
Table.prototype.getColumn = function <T extends Class>(componentType: T) {
  return this._columns[
    this._components.indexOf(componentType)
  ] as InstanceType<T>[];
};

/**
 * Create a plain table.
 * @param components The components to include in the table.
 */
function createTable(...components: Class[]) {
  return new Table({components, archetype: 0n, id: 0});
}

/**
 * Given an array, swaps the element at the provided index with the last element, and then pops the now-last element off the array.
 *
 * splice:
 * array.splice(index, 1);  // O(n)
 *
 * swapRemove:
 * array[index] = array[array.length - 1];  // O(1)
 * array.pop();  // O(1)
 *
 * Used for unordered removal.
 *
 * @param array The array to modify.
 * @param index The index to swap and remove.
 * @returns The element that was removed.
 */
// @ts-ignore
function swapRemove<T>(array: T[], index: number): T | undefined {
  const temp = array[index];
  const last = array[array.length - 1];
  if (last !== undefined) {
    array[index] = last;
  }
  array.pop();
  return temp;
}

export {Table, createTable};
