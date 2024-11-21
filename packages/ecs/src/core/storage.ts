import {EventBus} from 'src/utils/event-bus';

import {Class} from '../utils/class';
import {EntitiesUpdateEvent, Entity, EntityLocation} from './entity';
import {Table} from './table';
import {Locations} from './world';

interface EntityChange {
  entity: Entity;
  archetype: bigint;
  components: object[];
}

type StorageConfig = {
  components: Class[];
  locations: Locations;
};

/**
 * A table is a data structure that stores entities with the same component types.
 * Each unique combination of components (archetype) has its own table.
 */
export class Storage {
  private readonly _components: Class[];
  private readonly _locations: Locations;

  private _tables: Table[] = [];
  private _nextTableId: number = 0;
  private _archetypeToTableId: Map<bigint, Table['id']> = new Map();

  readonly onTableUpdated = new EventBus();

  constructor(config: StorageConfig) {
    this._components = config.components;
    this._locations = config.locations;
  }

  get length(): number {
    return this._tables.length;
  }

  /**
   * Initialize storage with empty table (archetype = 0)
   */
  init() {
    const [id, archetype] = [0, 0n];
    this._tables.push(new Table(id, archetype, []));
    this._archetypeToTableId.set(archetype, id);
  }

  /**
   * Create new table for given archetype
   */
  addTable(archetype: bigint, components: Class[]): Table {
    const tableId = ++this._nextTableId;
    const tableComponents = decodeArchetype(components, archetype);
    const table = new Table(tableId, archetype, tableComponents);
    this._tables.push(table);
    this._archetypeToTableId.set(archetype, tableId);
    return table;
  }

  /**
   * Remove table and clean up references
   */
  removeTable(removedTable: Table): Table {
    this._tables = this._tables.filter((t) => t !== removedTable);
    this._archetypeToTableId.delete(removedTable.archetype);
    return removedTable;
  }

  /**
   * Get or create table for archetype
   */
  acquireTable(archetype: bigint, components: Class[]): Table {
    const tableId = this._archetypeToTableId.get(archetype);
    const table =
      tableId !== undefined
        ? this._tables[tableId]!
        : this.addTable(archetype, components);
    return table;
  }

  /**
   * Get table by ID
   */
  getTable(tableId: number): Table | undefined {
    return this._tables[tableId];
  }

  /**
   * Reset storage state
   */
  clear(): void {
    this._tables = [];
    this._archetypeToTableId.clear();
  }

  /**
   * Handle batch entity changes
   */
  public handleEntitiesChanged = ({updates}: EntitiesUpdateEvent) => {
    for (const change of updates) {
      const table = this.moveEntityToTable(change);
    }
    this.onTableUpdated.emit();
  };

  /**
   * Move entity between tables based on archetype change
   */
  private moveEntityToTable({entity, archetype, components}: EntityChange) {
    const {tableId, tableRow} = entity.getLocation();
    const sourceTable = this.getTable(tableId)!;
    const targetTable = this.acquireTable(archetype, this._components);

    const location = sourceTable.move(tableRow, targetTable, components);

    this.updateEntityLocation(entity, location);
    return targetTable;
  }

  /**
   * Update entity location after table move
   */
  private updateEntityLocation(entity: Entity, location: EntityLocation) {
    entity.setLocation(location);
    this._locations.set(entity.id, location);
  }

  /**
   * Iterate over all tables
   */
  *[Symbol.iterator](): IterableIterator<Table> {
    yield* this._tables;
  }
}

// * --------------------------------------------------------------------------
// * Utils
// * --------------------------------------------------------------------------

/**
 * Decodes an archetype bits into its component types.
 *
 * Algorithm Overview:
 * ------------------
 * 1. Initialize empty result array
 * 2. For each bit in archetype:
 *    - If bit is 1, add corresponding component to result
 *    - Shift archetype right by 1
 * 3. Continue until no bits remain
 *
 * Performance:
 * - Time Complexity: O(n) where n is number of components
 * - Space Complexity: O(k) where k is number of active components
 *
 * Example:
 *
 * ```ts
 * const components = [Entity, Position, Velocity]
 * const archetype = 5n // binary: 101
 * const result = calcArchetype(components, archetype) // [Entity, Velocity]
 * ```
 *
 * Explanation:
 *
 * components = [Entity, Position, Velocity, Health]  // components
 * archetype = 11n                                    // binary: 1011
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │ initial state                                            │
 * ├────────────────┬────────────┬────────────┬───────────────┤
 * │    index       │     0      │     1      │      2        │
 * │    component   │   Entity   │  Position  │   Velocity    │
 * │    archetype   │     1      │     1      │      0        │
 * └────────────────┴────────────┴────────────┴───────────────┘
 *
 * 1️⃣ first loop (i = 0):
 * temp = 1011
 * temp & 1n = 1  ✓ add `Entity` to result
 * temp >>= 1n    → 0101
 *
 * ┌──────────────────┐
 * │ result=[Entity]  │
 * └──────────────────┘
 *
 * 2️⃣ second loop (i = 1):
 * temp = 0101
 * temp & 1n = 1  ✓ add `Position` to result
 * temp >>= 1n    → 0010
 *
 * ┌──────────────────────────┐
 * │ result=[Entity,Position] │
 * └──────────────────────────┘
 *
 * 3️⃣ third loop (i = 2):
 * temp = 0010
 * temp & 1n = 0  ✗ skip `Velocity`
 * temp >>= 1n    → 0001
 *
 * ┌──────────────────────────┐
 * │ result=[Entity,Position] │
 * └──────────────────────────┘
 *
 * 4️⃣ fourth loop (i = 3):
 * temp = 0001
 * temp & 1n = 1  ✓ add `Health` to result
 * temp >>= 1n    → 0000
 *
 * ┌─────────────────────────────────┐
 * │ result=[Entity,Position,Health] │
 * └─────────────────────────────────┘
 *
 * 5️⃣ end loop (temp = 0)
 *
 * Space O(1), Time O(n)
 */
function decodeArchetype<T extends Class>(
  components: T[],
  archetype: bigint,
): T[] {
  const presentComponents: T[] = [];
  let remainingBits = archetype;
  let componentIndex = 0;

  while (remainingBits !== 0n) {
    const hasComponent = (remainingBits & 1n) === 1n;
    if (hasComponent) {
      const componentType = components[componentIndex];
      componentType && presentComponents.push(componentType);
    }
    remainingBits >>= 1n;
    componentIndex++;
  }
  return presentComponents;
}
