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
  move: (args: {row: number; targetTable: Table; components: object[]}) => {
    tableId: number;
    tableRow: number;
  };

  /** if this table contains a column for the provided component type */
  hasColumn(componentType: Class): boolean;

  /** the column for the provided component */
  getColumn<T extends Class>(componentType: T): InstanceType<T>[];

  getRow(row: number): object[];
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
  if (this === targetTable) {
    for (const component of components) {
      const componentType = component.constructor as any;
      const columnIndex = this._components.indexOf(componentType);
      if (columnIndex !== -1) {
        this._columns[columnIndex]![row] = component;
      }
    }
    return {tableId: this.id, tableRow: row};
  }

  const newRow = targetTable.getColumn(Entity)?.length ?? 0;
  const finalComponents = new Map();

  // 1. move component data
  for (let i = 0; i < this._components.length; i++) {
    const componentType = this._components[i]!;
    const column = this._columns[i]!;

    const removed = swapRemove(column, row);
    if (!removed) continue;

    if (componentType === Entity) {
      const backfilledEntity = column[row] as Entity;
      if (backfilledEntity) {
        backfilledEntity.setLocation({tableRow: row});
      }
    }

    if (targetTable.hasColumn(componentType)) {
      finalComponents.set(componentType, removed);
    }
  }

  // 2. add or overwrite existing components
  for (const component of components) {
    const componentType = component.constructor as any;
    if (targetTable.hasColumn(componentType)) {
      finalComponents.set(componentType, component);
    }
  }

  // 3. add new components (only if not the same table)
  for (const [componentType, component] of finalComponents) {
    targetTable.getColumn(componentType)?.push(component);
  }

  return {tableId: targetTable.id, tableRow: newRow};
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
 * @param componentType The component type to get the column for.
 * @returns The column for the provided component type.
 */
Table.prototype.getRow = function (row: number) {
  if (row < 0 || row > (this._columns[0]?.length ?? 0)) {
    return [];
  }
  const components: object[] = [];
  for (let i = 0; i < this._columns.length; i++) {
    const column = this._columns[i];
    if (column?.[row] !== undefined) {
      components.push(column[row]);
    }
  }
  return components;
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
