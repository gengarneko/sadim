import {isSizedComponent} from './component';
import {Entity, EntityLocation} from './entity';
import {Class} from './utils/class';

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
  /** @internal Columns storing component instances */
  private _columns: object[][];

  /** @internal Component types stored in this table */
  private _components: Class[];

  constructor(
    /** Unique table identifier */
    public readonly id: number,
    /** Bitmap of component types */
    public readonly archetype: bigint,
    /** Component types in this table */
    components: Class[],
  ) {
    this._columns = components.map(() => []);
    this._components = components.filter(isSizedComponent);
  }

  /** Number of entities in this table */
  get length(): number {
    return this._columns[0]?.length ?? 0;
  }

  /**
   * Update components in-place when target is same table
   *
   * Flow:
   * 1. For each new component:
   *    - Get component type
   *    - Find matching column
   *    - Update value at row
   *
   * Example:
   * Table before:
   * | Row | Entity  | Position  | Velocity  |
   * |-----|---------|-----------|-----------|
   * |  0  | Entity0 | Pos(1,1)  | Vel(2,2)  |
   *
   * Update Position at row 0:
   * components = [Position(3,3)]
   * - Find Position column (index 1)
   * - Update: columns[1][0] = Position(3,3)
   *
   * Table after:
   * | Row | Entity  | Position  | Velocity  |
   * |-----|---------|-----------|-----------|
   * |  0  | Entity0 | Pos(3,3)  | Vel(2,2)  |
   */
  private updateInPlace(row: number, components: object[]) {
    // Update each component in its column
    for (const component of components) {
      const componentType = component.constructor as Class;
      const columnIndex = this._components.indexOf(componentType);

      // If column exists, update value at row
      if (columnIndex !== -1) {
        this._columns[columnIndex]![row] = component;
      }
    }

    // Return same location since table didn't change
    return {tableId: this.id, tableRow: row};
  }

  /**
   * Move entity to a different table
   *
   * Flow:
   * 1. Calculate new row in target table
   * 2. Collect components to move
   * 3. Add components to target table
   *
   * Example:
   * Source Table (0b0011: Entity + Position):
   * | Row | Entity  | Position  |
   * |-----|---------|-----------|
   * |  0  | Entity0 | Pos(1,1)  |
   *
   * Target Table (0b0111: Entity + Position + Velocity):
   * | Row | Entity  | Position  | Velocity  |
   * |-----|---------|-----------|-----------|
   * |  0  | Entity1 | Pos(2,2)  | Vel(3,3)  |
   *
   * Move Entity0 with new Velocity:
   * - New row = 1 (append to target)
   * - Collect: [Entity0, Pos(1,1), Vel(4,4)]
   * - Add to target table
   *
   * Result:
   * | Row | Entity  | Position  | Velocity  |
   * |-----|---------|-----------|-----------|
   * |  0  | Entity1 | Pos(2,2)  | Vel(3,3)  |
   * |  1  | Entity0 | Pos(1,1)  | Vel(4,4)  |
   */
  private moveToNewTable(
    row: number,
    table: Table,
    components: object[],
  ): EntityLocation {
    // Calculate new row (append to end)
    const newRow = table.getColumn(Entity)?.length ?? 0;

    // Collect components from source and new components
    const finalComponents = this.collectComponents(row, table, components);

    // Add all components to target table
    for (const [componentType, component] of finalComponents) {
      table.getColumn(componentType)?.push(component);
    }

    // Return new location in target table
    return {tableId: table.id, tableRow: newRow};
  }

  /**
   * Collect components from source and new components
   *
   * Flow:
   * 1. Collect Existing Components:
   *    - Remove from source columns using swap-remove
   *    - Update backfilled entity location if needed
   *    - Keep components that exist in target table
   *
   * 2. Collect New Components:
   *    - Add/override components that exist in target
   *
   * Example:
   * Source Table (Entity + Position):
   * | Row | Entity  | Position  |
   * |-----|---------|-----------|
   * |  0  | Entity0 | Pos(1,1)  | <- Moving this
   * |  1  | Entity1 | Pos(2,2)  | <- Will be swapped to row 0
   *
   * New Components: [Velocity(3,3)]
   * Target Table Schema: [Entity, Position, Velocity]
   *
   * Steps:
   * 1. Remove from source:
   *    - Remove Entity0, Pos(1,1)
   *    - Update Entity1 location to row 0
   *    - Keep both for target
   *
   * 2. Add new:
   *    finalComponents = {
   *      Entity   -> Entity0
   *      Position -> Pos(1,1)
   *      Velocity -> Vel(3,3)
   *    }
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
   * Flow:
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
   *
   * @param row - Source row to move
   * @param targetTable - Destination table
   * @param components - New/updated components
   * @returns New entity location {tableId, tableRow}
   */
  move(row: number, targetTable: Table, components: object[]) {
    return this === targetTable
      ? this.updateInPlace(row, components) // Same table: update in-place
      : this.moveToNewTable(row, targetTable, components); // Different table: transfer
  }

  /**
   * Check if table has column for component type
   *
   * Example:
   * Table Schema: [Entity, Position, Velocity]
   * hasColumn(Position) -> true
   * hasColumn(Health)   -> false
   */
  hasColumn(componentType: Class): boolean {
    return this._components.includes(componentType);
  }

  /**
   * Get column for component type
   *
   * Memory Layout:
   * _columns = [
   *   [Entity0, Entity1],      // Entity column
   *   [Pos(1,1), Pos(2,2)],   // Position column
   *   [Vel(3,3), Vel(4,4)]    // Velocity column
   * ]
   *
   * Example:
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
   * Example Table:
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
