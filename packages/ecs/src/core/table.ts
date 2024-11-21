import {Class} from '../utils/class';
import {isSizedComponent} from './component';
import {Entity, EntityLocation} from './entity';

// * --------------------------------------------------------------------------
// * Table
// * --------------------------------------------------------------------------

/**
 * Table stores entities with identical component types
 *
 * Memory Layout:
 * | Row | Entity  | Position  | Velocity  |
 * |-----|---------|-----------|-----------|
 * |  0  | Entity0 | Pos(1,1)  | Vel(2,2)  |
 * |  1  | Entity1 | Pos(3,3)  | Vel(4,4)  |
 *
 * Features:
 * 1. Column-based storage for better cache locality
 * 2. O(1) component access via row index
 * 3. Efficient entity movement between tables
 */
export class Table {
  private _columns: object[][];
  private _components: Class[];

  constructor(
    public readonly id: number,
    public readonly archetype: bigint,
    components: Class[],
  ) {
    this._columns = components.map(() => []);
    this._components = components.filter(isSizedComponent);
  }

  get length(): number {
    return this._columns[0]?.length ?? 0;
  }

  /**
   * Update components in same table
   */
  private updateInPlace(row: number, components: object[]) {
    for (const component of components) {
      const componentType = component.constructor as Class;
      const columnIndex = this._components.indexOf(componentType);
      if (columnIndex !== -1) {
        this._columns[columnIndex]![row] = component;
      }
    }
    return {tableId: this.id, tableRow: row};
  }

  /**
   * Move entity to different table
   */
  private moveToNewTable(
    row: number,
    table: Table,
    components: object[],
  ): EntityLocation {
    const newRow = table.getColumn(Entity)?.length ?? 0;
    const finalComponents = this.collectComponents(row, table, components);
    for (const [componentType, component] of finalComponents) {
      table.getColumn(componentType)?.push(component);
    }
    return {tableId: table.id, tableRow: newRow};
  }

  /**
   * Collect components from source and new components
   */
  private collectComponents(
    row: number,
    targetTable: Table,
    newComponents: object[],
  ) {
    const finalComponents = new Map<Class, object>();

    // collectExistingComponents
    for (let i = 0; i < this._components.length; i++) {
      const componentType = this._components[i]!;
      const column = this._columns[i]!;

      const removed = swapRemove(column, row);
      if (!removed) continue;

      if (componentType === Entity) {
        this.updateBackfilledEntity(column, row);
      }

      if (targetTable.hasColumn(componentType)) {
        finalComponents.set(componentType, removed);
      }
    }

    // collectNewComponents
    for (const component of newComponents) {
      const componentType = component.constructor as Class;
      if (targetTable.hasColumn(componentType)) {
        finalComponents.set(componentType, component);
      }
    }

    return finalComponents;
  }

  /**
   * Update backfilled entity's location after swap remove
   *
   * When using swap-remove, the last entity is moved to the removed position.
   * This entity needs its location updated to reflect its new row.
   *
   * Example:
   * Before swap-remove at row 1:
   * | Row | Entity  | Position  |
   * |-----|---------|-----------|
   * |  0  | Entity0 | Pos(1,1)  |
   * |  1  | Entity1 | Pos(2,2)  | <- Remove this
   * |  2  | Entity2 | Pos(3,3)  | <- Will move to row 1
   *
   * After swap-remove:
   * | Row | Entity  | Position  |
   * |-----|---------|-----------|
   * |  0  | Entity0 | Pos(1,1)  |
   * |  1  | Entity2 | Pos(3,3)  | <- Need to update Entity2.tableRow to 1
   *
   * @param column - The entity column after swap-remove
   * @param row - The row where the swap occurred
   */
  private updateBackfilledEntity(column: object[], row: number) {
    const backfilledEntity = column[row] as Entity;
    if (backfilledEntity) {
      backfilledEntity.setLocation({tableRow: row});
    }
  }

  /**
   * Move entity between tables
   *
   * Flow:
   * 1. Same Table (In-Place Update):
   *    Before: Entity0 [Pos(1,1), Vel(2,2)]
   *    Update: Position(3,3)
   *    After:  Entity0 [Pos(3,3), Vel(2,2)]
   *
   * 2. Different Table (Table Transfer):
   *    Source Table (Entity + Position):
   *    | Row | Entity  | Position  |
   *    |-----|---------|-----------|
   *    |  0  | Entity0 | Pos(1,1)  | <- Moving this
   *    |  1  | Entity1 | Pos(2,2)  |
   *
   *    Target Table (Entity + Position + Velocity):
   *    | Row | Entity  | Position  | Velocity  |
   *    |-----|---------|-----------|-----------|
   *    |  0  | Entity2 | Pos(3,3)  | Vel(4,4)  |
   *    |  1  | Entity0 | Pos(1,1)  | Vel(5,5)  | <- New location
   *
   * Performance:
   * - Same table: O(1) component updates
   * - Different table: O(1) removal + O(1) insertion
   */
  move(row: number, targetTable: Table, components: object[]) {
    return this === targetTable
      ? this.updateInPlace(row, components)
      : this.moveToNewTable(row, targetTable, components);
  }

  /**
   * Check if table has column for component type
   */
  hasColumn(componentType: Class): boolean {
    return this._components.includes(componentType);
  }

  /**
   * Get column for component type
   *
   * _columns = [
   *   [Entity0, Entity1],
   *   [Pos(1,1), Pos(2,2)],
   *   [Vel(3,3), Vel(4,4)]
   * ]
   * getColumn(Position) -> [Pos(1,1), Pos(2,2)]
   */
  getColumn<T extends Class>(componentType: T): InstanceType<T>[] {
    return this._columns[
      this._components.indexOf(componentType)
    ] as InstanceType<T>[];
  }

  /**
   * Get all components at row
   *
   * | Row | Entity  | Position  | Velocity  |
   * |-----|---------|-----------|-----------|
   * |  0  | Entity0 | Pos(1,1)  | Vel(2,2)  |
   * |  1  | Entity1 | Pos(3,3)  | Vel(4,4)  |
   *
   * getRow(0) -> [Entity0, Pos(1,1), Vel(2,2)]
   * getRow(1) -> [Entity1, Pos(3,3), Vel(4,4)]
   */
  getRow(row: number): object[] {
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
  }
}

/** Create table with components */
export function createTable(components: Class[] = []): Table {
  return new Table(0, 0n, components);
}

// * --------------------------------------------------------------------------
// * Utils
// * --------------------------------------------------------------------------

/**
 * Swap with last element and pop, O(1) removal for unordered arrays
 *
 * array.splice(index, 1);  // O(n)
 */
function swapRemove<T>(array: T[], index: number): T | undefined {
  const temp = array[index];
  const last = array[array.length - 1];
  if (last !== undefined) {
    array[index] = last;
  }
  array.pop();
  return temp;
}
