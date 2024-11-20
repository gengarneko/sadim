/**
 * Entity Component System (ECS) - Entity Management
 *
 * Core Concepts & Data Structure:
 * ------------------------------
 * ┌─────────────────────────────────────────┐
 * │               Entity                    │
 * ├─────────────────┬───────────────────────┤
 * │     EntityId    │ Unique identifier     │
 * │   TableId       │ Current table         │
 * │   TableRow      │ Position in table     │
 * └─────────────────┴───────────────────────┘
 *
 * Entity Location System:
 * ---------------------
 * ┌─────────────┐      ┌──────────────┐
 * │   Entity    │      │    Table     │
 * │  ID: 1      │────►│   ID: 2      │
 * │ Table: 2    │      │ ┌──────────┐ │
 * │  Row: 3     │      │ │Position  │ │
 * └─────────────┘      │ │Velocity  │ │
 *                      │ │Row 3 ◄──┼──┘
 *                      └──────────────┘
 *
 * Component Mask System:
 * --------------------
 * Components:    Entity   Position   Velocity
 * Component ID:    0         1          2
 *
 * Bitmask:      0b001     0b010      0b100
 * Combined:     0b111 (Entity + Position + Velocity)
 *
 *           MSB ◄────────────────────► LSB
 * Archetype: 0000 0000 0000 0000 0111
 *                                └┬┘
 *                          Component Bits
 */

import type {Component} from './component';
import type {Class} from './utils/class';
import type {World} from './world';

import {DEV_ASSERT} from './utils/dev';

// import type {TagComponent} from './component';
// import {isSizedComponent, isTagComponent} from './component';

export type EntityId = number;
export type TableId = number;
export type TableRow = number;

// * --------------------------------------------------------------------------
// * EntityLocation
// * --------------------------------------------------------------------------

/**
 * Entity location in the table system
 *
 * Example:
 * Table(0b0111): [Entity, Position, Velocity]
 * location = {
 *   tableId: 1,    // Which table contains the entity
 *   tableRow: 2    // Which row in that table's columns
 * }
 */
export interface EntityLocation {
  /**
   * Table identifier
   * Indicates which archetype table contains the entity
   */
  tableId: TableId;

  /**
   * Row within the table
   * Direct index to entity's components in table columns
   */
  tableRow: TableRow;
}

// * --------------------------------------------------------------------------
// * Entity
// * --------------------------------------------------------------------------

/**
 * Represents an entity in the ECS system
 *
 * Core Concepts:
 * 1. Entity
 *    - Unique identifier (entityId)
 *    - No inherent data/behavior
 *    - Container for components
 *    - No data of its own, just an ID
 *
 * 2. Component Operations
 *    - Add:    entity.insert(new Position(x, y))
 *    - Remove: entity.remove(Position)
 *    - Query:  entity.has(Position)
 *
 * 3. Table System
 *    - Organizes entities by their component types
 *    - Each table stores entities with identical components
 *    - Example tables:
 *      Table1: [Entity, Position]
 *      Table2: [Entity, Position, Velocity]
 *
 * Memory Layout:
 * Table(0b0111): SPAWNED + Position + Velocity
 *
 * | Row | Entity  | Position  | Velocity  |
 * |-----|---------|-----------|-----------|
 * |  0  | Entity0 | Pos(1,1)  | Vel(2,2)  |
 * |  1  | Entity1 | Pos(3,3)  | Vel(4,4)  |
 * |  2  | Entity2 | Pos(5,5)  | Vel(6,6)  |
 *
 * Location Example:
 * Entity2's location = {
 *   tableId: 1,    // Which table stores the entity
 *   tableRow: 2    // Which row in that table
 * }
 *
 * Memory Benefits:
 * 1. Components of same type are contiguous
 *    [P1, P2, P3] [V1, V2, V3]
 *    Better cache utilization
 *
 * 2. Fast iteration over entities with specific components
 *    Each table = one component combination
 *
 * 3. Efficient component access
 *    Direct indexing using tableRow
 *
 * State Changes:
 * 1. Add Velocity:
 *    Before: Table[1](0b0011) -> [Entity, Position]
 *    After:  Table[2](0b0111) -> [Entity, Position, Velocity]
 *
 * 2. Remove Position:
 *    Before: Table[2](0b0111) -> [Entity, Position, Velocity]
 *    After:  Table[3](0b0101) -> [Entity, Velocity]
 *
 * Performance:
 * - O(1) component access via table row
 * - Efficient iteration over similar entities
 * - Cache-friendly component storage
 */
export class Entity {
  /** Current location in table system */
  private location: EntityLocation = {
    tableId: 0, // 0 = not spawned/destroyed
    tableRow: 0, // Row within component arrays
  };

  constructor(
    /** Reference to entity manager */
    private readonly entities: Entities,
    /** Unique entity identifier */
    private readonly entityId: EntityId,
  ) {}

  /** Debug representation */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Entity(${this.entityId}in${this.location.tableId}#${this.location.tableRow})`;
  }

  /** Entity is active if it has a valid table */
  get isAlive(): boolean {
    return this.location.tableId !== 0;
  }

  /** Unique identifier */
  get id(): EntityId {
    return this.entityId;
  }

  /** Check for component presence */
  has(component: Component): boolean {
    return this.entities.has(this, component);
  }

  /** Add/update component instance */
  insert(component: object): Entity {
    this.entities.insert(this, component);
    return this;
  }

  /** Register component type */
  insertTag(component: Class): Entity {
    this.entities.updateArchetype(this, component);
    return this;
  }

  /** Remove component */
  remove(component: Component): Entity {
    this.entities.remove(this, component);
    return this;
  }

  /** Remove entity from table */
  despawn(): void {
    this.entities.despawn(this);
  }

  get<T extends Component>(componentType: T): InstanceType<T> | undefined {
    return this.entities.get(this, componentType);
  }

  /** Update table location */
  setLocation(location: Partial<EntityLocation>): void {
    if (location.tableId !== undefined && location.tableId < 0) {
      DEV_ASSERT(false, `Invalid tableId: ${location.tableId}`);
    }
    if (location.tableRow !== undefined && location.tableRow < 0) {
      DEV_ASSERT(false, `Invalid tableRow: ${location.tableRow}`);
    }
    this.location = {...this.location, ...location};
  }

  /** Get current location */
  getLocation(): EntityLocation {
    return this.location;
  }

  /** String representation */
  toString(): string {
    return `
      entityId: ${this.id},
      tableId: ${this.location.tableId},
      tableRow: ${this.location.tableRow}
    `;
  }
}

// * --------------------------------------------------------------------------
// * EntityState
// * --------------------------------------------------------------------------

/**
 * Entity state constants
 */
const ENTITY_STATE = {
  /** Entity is destroyed */
  DESPAWNED: 0n,
  /** Entity is active */
  SPAWNED: 1n,
} as const;

/**
 * Internal state manager for the entity system
 * Handles entity ID generation, component staging, and entity destinations
 *
 * Entity State Management Flow:
 * --------------------------
 * ┌──────────┐    ┌────────────┐    ┌──────────┐
 * │  Spawn   │──►│ Component  │──►│  Flush   │
 * │  Entity  │    │  Changes   │    │   to     │
 * │          │    │ (Pending)  │    │ Tables   │
 * └──────────┘    └────────────┘    └──────────┘
 *
 * State Management:
 * 1. Entity IDs
 *    nextId: 0 -> 1 -> 2 -> 3
 *    Ensures unique entity identification
 *
 * 2. Pending Components
 *    Map {
 *      Entity0 => [Entity0, Position(1,2), Velocity(3,4)]
 *      Entity1 => [Entity1, Position(5,6)]
 *    }
 *    Stages component changes before flush
 *
 * 3. Destinations
 *    Map {
 *      Entity0 => 0b0111  // Target: SPAWNED + Pos + Vel
 *      Entity1 => 0b0011  // Target: SPAWNED + Pos
 *    }
 *    Tracks target archetypes for entities
 *
 * Example Flow:
 * 1. Create Entity
 *    entity = createEntity() // ID: 0
 *
 * 2. Add Components
 *    setPending(entity, [Entity0, Position])
 *    setDestination(entity, 0b0011)
 *
 * 3. Flush Changes
 *    iterate destinations -> move entities to target tables
 *    clear() -> reset state for next frame
 */
class EntityState {
  /** Entity ID counter for unique identification */
  private nextId = 0;

  /**
   * Staged components for entities
   * Stores component instances before they are committed to tables
   */
  private pending = new Map<Entity, object[]>();

  /**
   * Entity archetype destinations
   * Maps entities to their target component combinations
   */
  private destinations = new Map<Entity, bigint>();

  /**
   * Create new entity with unique ID
   * Increments ID counter after each creation
   */
  createEntity(entities: Entities): Entity {
    return new Entity(entities, this.nextId++);
  }

  /**
   * Stage components for entity
   * Components are stored temporarily until flush
   */
  setPending(entity: Entity, components: object[]): void {
    this.pending.set(entity, components);
  }

  /**
   * Get staged components for entity
   * Returns undefined if no pending changes
   */
  getPending(entity: Entity): object[] | undefined {
    return this.pending.get(entity);
  }

  /**
   * Set entity's target archetype
   * Only updates if destination has changed
   */
  setDestination(entity: Entity, destination: bigint): void {
    const current = this.destinations.get(entity);
    if (current === destination) return;
    this.destinations.set(entity, destination);
  }

  /**
   * Get entity's target archetype
   * Returns undefined if no pending changes
   */
  getDestination(entity: Entity): bigint | undefined {
    return this.destinations.get(entity);
  }

  /**
   * Clear all staged state
   * Called after changes are flushed to tables
   */
  clear(): void {
    this.pending.clear();
    this.destinations.clear();
  }

  /**
   * Support iteration over destinations
   * Used by flush() to process pending changes
   */
  [Symbol.iterator](): IterableIterator<[Entity, bigint]> {
    return this.destinations.entries();
  }
}

// * --------------------------------------------------------------------------
// * Entities
// * --------------------------------------------------------------------------

/**
 * Cache of component masks
 *
 * calculate mask every time when query/update component:
 * - entity.has(Position)  // calculate mask
 * - entity.insert(pos)    // calculate mask
 * - entity.remove(pos)    // calculate mask
 *
 * only calculate once:
 * - entity.has(Position)  // read from Map
 * - entity.insert(pos)    // read from Map
 * - entity.remove(pos)    // read from Map
 */
const COMPONENT_MASKS = new Map<Class, bigint>();

/**
 * Manages entity lifecycle and state changes
 * Handles component operations and table movements
 */
export class Entities {
  private state = new EntityState();
  private locationMap = new Map<EntityId, EntityLocation>();

  constructor(readonly world: World) {}

  private updateEntityLocation(entityId: EntityId, location: EntityLocation) {
    this.locationMap.set(entityId, location);
  }

  /**
   * Get archetype from entity's current table
   *
   * Flow:
   * 1. Entity Location
   *    entity -> { tableId: 1, tableRow: 0 }
   *
   * 2. Table Lookup
   *    tables[1] -> Table {
   *      archetype: 0b0011,  // SPAWNED + Position
   *      columns: [
   *        [Entity0, Entity1],
   *        [Pos(1,1), Pos(2,2)]
   *      ]
   *    }
   *
   * 3. Return Archetype
   *    0b0011 (current table's component mask)
   *
   * Example:
   * - Table1(0b0011): [Entity, Position]
   * - Table2(0b0111): [Entity, Position, Velocity]
   * entity in Table1 -> returns 0b0011
   */
  private getTableArchetype(entity: Entity): bigint {
    const {tableId} = entity.getLocation();
    DEV_ASSERT(this.world.tables[tableId], `Table ${tableId} does not exist`);
    return this.world.tables[tableId]!.archetype;
  }

  /**
   * Get entity's target or current archetype
   *
   * Flow:
   * 1. Check Pending Changes
   *    state.destinations -> Map {
   *      Entity0 => 0b0111  // Target: add Velocity
   *      Entity1 => 0b0001  // Target: remove all but SPAWNED
   *    }
   *
   * 2. Return Value
   *    a) Has pending: return destination archetype
   *    b) No pending: return current table archetype
   *
   * Example:
   * entity.insert(new Velocity())
   * - Current: 0b0011 (SPAWNED + Position)
   * - Pending: 0b0111 (SPAWNED + Position + Velocity)
   * - Returns: 0b0111 (pending change)
   */
  private getEntityArchetype(entity: Entity): bigint {
    return this.state.getDestination(entity) ?? this.getTableArchetype(entity);
  }

  /**
   * Calculate component bitmask
   *
   * Flow:
   * 1. Get Component ID
   *    Example components and their IDs:
   *    - Entity:   0  (reserved)
   *    - Position: 1
   *    - Velocity: 2
   *    - Name:     3
   *
   * 2. Check Cache
   *    COMPONENT_MASKS = Map {
   *      Position => 2n,   // 1n << 1 = 0b0010
   *      Velocity => 4n,   // 1n << 2 = 0b0100
   *      Name     => 8n    // 1n << 3 = 0b1000
   *    }
   *
   * 3. Calculate Mask (if not cached)
   *    Example for Position (ID: 1):
   *    1n << BigInt(1):
   *    - Start:     1n     = 0b0001
   *    - Shift <<1: 2n     = 0b0010
   *
   * 4. Handle Remove Flag
   *    Normal:  mask      = 0b0010  (add component)
   *    Remove: ~mask      = 0b1101  (remove component)
   *
   * Example Usage:
   * 1. Adding Position:
   *    mask = getComponentMask(Position)     // 0b0010
   *    archetype |= mask                     // Adds Position
   *
   * 2. Removing Position:
   *    mask = getComponentMask(Position, true) // 0b1101
   *    archetype &= mask                       // Removes Position
   */
  private getComponentMask(componentType: Class, isRemove = false): bigint {
    const componentId = this.world.getComponentId(componentType);
    let mask = COMPONENT_MASKS.get(componentType);
    if (mask === undefined) {
      mask = 1n << BigInt(componentId);
      COMPONENT_MASKS.set(componentType, mask);
    }
    return isRemove ? ~mask : mask;
  }

  /**
   * Create new entity with optional components
   *
   * Flow:
   * 1. Create Entity
   *    Entity(0) -> { tableId: 0, tableRow: 0 }
   *
   * 2. Set Initial State
   *    SPAWNED (1n) = 0b0001
   *
   * 3. Calculate Combined Mask
   *    Example components: [Position(x,y), Velocity(vx,vy)]
   *
   *    Initial:    mask = SPAWNED     = 0b0001
   *    Position:   mask |= (1n << 1)  = 0b0011
   *    Velocity:   mask |= (1n << 2)  = 0b0111
   *
   *    Final mask: 0b0111 (7n)
   *    Meaning: Entity has SPAWNED + Position + Velocity
   *
   * 4. Set Destination
   *    entity -> archetype: 0b0111
   *
   * 5. Set Pending Components
   *    [
   *      Entity(0),           // Always first
   *      Position(x,y),       // Component instances
   *      Velocity(vx,vy)      // in original order
   *    ]
   *
   * Example:
   * world.spawn([
   *   new Position(1, 2),    // componentId: 1
   *   new Velocity(3, 4)     // componentId: 2
   * ]);
   *
   * Results in:
   * - Entity with id 0
   * - Archetype 0b0111 (SPAWNED | Position | Velocity)
   * - Pending components array with Entity and component instances
   */
  spawn(components: object[] = []): Entity {
    const entity = this.state.createEntity(this);
    this.state.setDestination(entity, ENTITY_STATE.SPAWNED);

    let mask = ENTITY_STATE.SPAWNED;
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (!component) continue;
      const componentType = component.constructor as Class;
      mask |= this.getComponentMask(componentType);
    }

    this.state.setDestination(entity, mask);
    this.state.setPending(entity, [entity, ...components]);
    return entity;
  }

  /**
   * Destroy entity and clean up its state
   *
   * Flow:
   * 1. Set Destination State
   *    - Current:  0b0111 (SPAWNED + Position + Velocity)
   *    - Change to: 0b0000 (DESPAWNED)
   *
   *    Example:
   *    entity -> {
   *      before: archetype = 0b0111
   *      after:  archetype = 0b0000 (DESPAWNED)
   *    }
   *
   * 2. Clear Pending Components
   *    - Before: [Entity(0), Position(x,y), Velocity(vx,vy)]
   *    - After:  []
   *
   * Effects:
   * 1. Entity State
   *    - isAlive becomes false (tableId will be 0)
   *    - All components are removed
   *    - Entity is moved to despawned table
   *
   * 2. Memory Cleanup
   *    - Pending components array is cleared
   *    - References to components are removed
   *    - Entity remains in ID pool but is inactive
   *
   * Example:
   * world.despawn(entity);
   * entity.isAlive        // false
   * entity.has(Position)  // false
   * entity.getLocation()  // { tableId: 0, tableRow: 0 }
   */
  despawn(entity: Entity): void {
    this.state.setDestination(entity, ENTITY_STATE.DESPAWNED);
    if (this.state.getPending(entity)) {
      this.state.getPending(entity)!.length = 0;
    }
    this.locationMap.delete(entity.id);
  }

  /**
   * Add component instance to entity
   *
   * Flow:
   * 1. Validate Component
   *    instance = Position { x: 1, y: 2 }
   *    - Must be object
   *    - Must not be null/undefined
   *
   * 2. Register Component Type
   *    Example:
   *    Position -> {
   *      before: archetype = 0b0001 (just SPAWNED)
   *      after:  archetype = 0b0011 (SPAWNED + Position)
   *    }
   *
   * 3. Handle Pending Components
   *    Three scenarios:
   *
   *    a) No pending components:
   *       [Entity(0)] -> [Entity(0), Position(x,y)]
   *
   *    b) Update existing component:
   *       [Entity(0), Position(1,1)] -> [Entity(0), Position(2,2)]
   *
   *    c) Add new component:
   *       [Entity(0), Velocity(1,1)] -> [Entity(0), Velocity(1,1), Position(2,2)]
   *
   * Example Usage:
   * 1. First insertion:
   *    entity.insert(new Position(1, 2))
   *    -> components = [Entity(0), Position(1,2)]
   *    -> archetype = 0b0011
   *
   * 2. Update existing:
   *    entity.insert(new Position(3, 4))
   *    -> components = [Entity(0), Position(3,4)]
   *    -> archetype = 0b0011 (unchanged)
   *
   * 3. Add different component:
   *    entity.insert(new Velocity(1, 1))
   *    -> components = [Entity(0), Position(3,4), Velocity(1,1)]
   *    -> archetype = 0b0111
   */
  insert(entity: Entity, instance: object): Entity {
    if (!instance || typeof instance !== 'object') {
      DEV_ASSERT(false, 'Invalid component instance');
    }

    const componentType = instance.constructor as Class;
    this.updateArchetype(entity, componentType);

    const components = this.state.getPending(entity);
    if (!components) {
      this.state.setPending(entity, [entity, instance]);
      return entity;
    }

    for (let i = 0; i < components.length; i++) {
      if (components[i]!.constructor === componentType) {
        components[i] = instance;
        return entity;
      }
    }

    components.push(instance);
    return entity;
  }

  /**
   * Update entity's archetype with new component type
   *
   * Flow:
   * 1. Get Current Archetype
   *    Example: entity has SPAWNED + Position
   *    currentType = 0b0011
   *
   *    SPAWNED  (0b0001)
   *    Position (0b0010)
   *    Total:    0b0011
   *
   * 2. Get Component Mask
   *    Example: adding Velocity
   *    componentMask = 0b0100
   *
   * 3. Combine Using OR (|)
   *    currentType   = 0b0011
   *    componentMask = 0b0100
   *    result        = 0b0111
   *
   * Example:
   * Before: Entity(SPAWNED + Position)     = 0b0011
   * Action: Add Velocity                   = 0b0100
   * After:  Entity(SPAWNED + Pos + Vel)    = 0b0111
   */
  updateArchetype(entity: Entity, component: Class): void {
    const currentType = this.getEntityArchetype(entity);
    const componentMask = this.getComponentMask(component);
    this.state.setDestination(entity, currentType | componentMask);
  }

  /**
   * Remove component from entity
   *
   * Flow:
   * 1. Get Current State
   *    Example: Entity has SPAWNED + Position + Velocity
   *    currentType = 0b0111
   *
   *    SPAWNED  (0b0001)
   *    Position (0b0010)
   *    Velocity (0b0100)
   *    Total:    0b0111
   *
   * 2. Get Inverted Component Mask
   *    Example: removing Position (ID: 1)
   *    Original:    0b0010 (Position mask)
   *    Inverted: ~  0b0010
   *             =   0b1101 (keeps all bits except Position)
   *
   * 3. Apply AND (&) Operation
   *    currentType   = 0b0111 (SPAWNED + Pos + Vel)
   *    ~mask        = 0b1101 (everything except Pos)
   *    result       = 0b0101 (SPAWNED + Vel)
   *
   * Example:
   * Before: Entity(SPAWNED + Pos + Vel)    = 0b0111
   * Action: Remove Position                = ~0b0010 = 0b1101
   * After:  Entity(SPAWNED + Vel)          = 0b0101
   *
   * Bit Operations:
   *   0b0111  (current state)
   * & 0b1101  (inverted Position mask)
   * --------
   *   0b0101  (final state - Position removed)
   */
  remove(entity: Entity, component: Class): void {
    const currentType = this.getEntityArchetype(entity);
    const componentMask = this.getComponentMask(component, true);
    this.state.setDestination(entity, currentType & componentMask);
  }

  /**
   * Apply all pending changes to entities
   * Moves entities between tables based on their component changes
   *
   * Flow Example:
   * Initial State:
   * Table1 (0b0011 = SPAWNED + Position):
   * - Entity(0) at row 0: [Entity(0), Position(1,2)]
   *
   * Pending Changes:
   * entity0.insert(new Velocity(3,4))
   * - Destination: 0b0111 (SPAWNED + Position + Velocity)
   * - Pending: [Entity(0), Position(1,2), Velocity(3,4)]
   *
   * Flush Process:
   * 1. For Each Pending Entity:
   *    entity0 -> {
   *      current: Table1(0b0011) at row 0
   *      target:  Table2(0b0111)
   *    }
   *
   * 2. Move Operation:
   *    Source: Table1
   *    - Before: [Entity(0), Position(1,2)]
   *    - After:  [] (row cleared)
   *
   *    Target: Table2
   *    - Before: []
   *    - After:  [Entity(0), Position(1,2), Velocity(3,4)]
   *
   * 3. Update Location:
   *    Entity(0) -> {
   *      before: { tableId: 1, row: 0 }
   *      after:  { tableId: 2, row: 0 }
   *    }
   *
   * Final State:
   * Table2 (0b0111 = SPAWNED + Position + Velocity):
   * - Entity(0) at row 0: [Entity(0), Position(1,2), Velocity(3,4)]
   *
   * Memory Layout:
   * Before:
   * Table1: [E0][P0][ ][ ]  // E=Entity, P=Position
   * Table2: [ ][ ][ ][ ]    // Empty
   *
   * After:
   * Table1: [ ][ ][ ][ ]    // Empty
   * Table2: [E0][P0][V0][ ] // E=Entity, P=Position, V=Velocity
   */
  flush(): void {
    const world = this.world;
    for (const [entity, archetype] of this.state) {
      const components = this.state.getPending(entity);
      const {tableId, tableRow} = entity.getLocation();
      const sourceTable = world.tables[tableId]!;
      const targetTable = world.getTable(archetype);
      const location = sourceTable.move(
        tableRow,
        targetTable,
        components ?? [],
      );
      entity.setLocation(location);
      this.locationMap.set(entity.id, location);
    }
    this.state.clear();
  }

  /**
   * Check if entity has specific component
   *
   * Flow:
   * 1. Get Entity's Current Archetype
   *    Example: Entity has SPAWNED + Position + Velocity
   *    currentArchetype = 0b0111
   *
   * 2. Get Component's Bit Position
   *    Example: checking for Position (ID: 1)
   *    1n << 1 = 0b0010
   *
   * 3. Check Using AND (&)
   *    currentArchetype = 0b0111
   *    componentMask    = 0b0010
   *    result           = 0b0010 (non-zero = has component)
   *
   * Examples:
   * 1. Has Position:
   *    0b0111 & 0b0010 = 0b0010 (true)
   *
   * 2. No Position:
   *    0b0101 & 0b0010 = 0b0000 (false)
   */
  has(entity: Entity, component: Component): boolean {
    const currentArchetype = this.getTableArchetype(entity);
    const componentId = this.world.getComponentId(component);
    return (currentArchetype & (1n << BigInt(componentId))) !== 0n;
  }

  /**
   * Get entity's components from table's row
   *
   * Flow:
   * Example Table Layout:
   * Table(0b0111): SPAWNED + Position + Velocity
   *
   * Memory Layout:
   * Row | Entity  | Position | Velocity
   * ----+---------+----------+---------
   *  0  | Entity0 | Pos(1,1) | Vel(2,2)
   *  1  | Entity1 | Pos(3,3) | Vel(4,4)
   *  2  | Entity2 | Pos(5,5) | Vel(6,6)
   *
   * Example:
   * 1. Get Location
   *    entity2 -> { tableId: 1, tableRow: 2 }
   *
   * 2. Get Components
   *    table.getRow(2) -> [
   *      Entity2,      // Entity component
   *      Pos(5,5),     // Position component
   *      Vel(6,6)      // Velocity component
   *    ]
   *
   * Return:
   * - Found:     [Entity2, Position(5,5), Velocity(6,6)]
   * - Not Found: []
   */
  entity(entityId: Entity['id']): object[] {
    const location = this.locationMap.get(entityId);
    if (!location) {
      return [];
    }
    const {tableId, tableRow} = location;
    const table = this.world.tables[tableId];
    const components = table?.getRow(tableRow);
    return components ?? [];
  }

  /**
   * Get component instance by type for an entity
   *
   * Flow:
   * 1. Get all components for entity
   * 2. Find component matching the requested type
   *
   * Example:
   * const position = entities.get(entity, Position);
   * if (position) {
   *   position.x += 1;
   * }
   */
  get<T>(entity: Entity, componentType: Component): T | undefined {
    const components = this.entity(entity.id);
    return components.find((c) => c.constructor === componentType) as
      | T
      | undefined;
  }
}

/**
 * Factory function to create entity manager instance
 */
export const createEntities = (world: World) => new Entities(world);

/**
 * Factory function to create entity manager factory
 * Returns a function that creates entity managers
 */
export const makeEntities = () => (world: World) => new Entities(world);
