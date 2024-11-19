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
// * Entity
// * --------------------------------------------------------------------------

/**
 * Entity location in the table system
 */
export interface EntityLocation {
  tableId: TableId; // Table identifier
  tableRow: TableRow; // Row within the table
}

/**
 * Represents an entity in the ECS system
 * Provides interface for component manipulation and state queries
 */
export class Entity {
  private location: EntityLocation = {
    tableId: 0,
    tableRow: 0,
  };

  constructor(
    private readonly entities: Entities,
    private readonly entityId: EntityId,
  ) {}

  /** Custom inspect method for debugging */
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `Entity(${this.entityId}in${this.location.tableId}#${this.location.tableRow})`;
  }

  /** Check if entity is currently active */
  get isAlive(): boolean {
    return this.location.tableId !== 0;
  }

  /** Get entity's unique identifier */
  get id(): EntityId {
    return this.entityId;
  }

  /** Check if entity has specific component */
  has(component: Component): boolean {
    return this.entities.has(this, component);
  }

  /** Add component instance to entity */
  insert(component: object): Entity {
    this.entities.insert(this, component);
    return this;
  }

  /** Add component type marker to entity */
  insertTag(component: Class): Entity {
    this.entities.insertTag(this, component);
    return this;
  }

  /** Remove component from entity */
  remove(component: Component): Entity {
    this.entities.remove(this, component);
    return this;
  }

  /** Update entity's location in tables */
  setLocation(location: Partial<EntityLocation>): void {
    if (location.tableId !== undefined && location.tableId < 0) {
      DEV_ASSERT(false, `Invalid tableId: ${location.tableId}`);
    }
    if (location.tableRow !== undefined && location.tableRow < 0) {
      DEV_ASSERT(false, `Invalid tableRow: ${location.tableRow}`);
    }
    this.location = {...this.location, ...location};
  }

  /** Get entity's current location */
  getLocation(): EntityLocation {
    return this.location;
  }

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
 * @internal
 */
class EntityState {
  /** Entity ID counter */
  private nextId = 0;

  /** Staged components for entities */
  private pending = new Map<Entity, object[]>();

  /** Entity archetype destinations */
  private destinations = new Map<Entity, bigint>();

  /** Create new entity with unique ID */
  createEntity(entities: Entities): Entity {
    return new Entity(entities, this.nextId++);
  }

  /** Stage components for entity */
  setPending(entity: Entity, components: object[]): void {
    this.pending.set(entity, components);
  }

  /** Get staged components for entity */
  getPending(entity: Entity): object[] | undefined {
    return this.pending.get(entity);
  }

  /** Set entity's target archetype */
  setDestination(entity: Entity, destination: bigint): void {
    const current = this.destinations.get(entity);
    if (current === destination) return;
    this.destinations.set(entity, destination);
  }

  /** Get entity's target archetype */
  getDestination(entity: Entity): bigint | undefined {
    return this.destinations.get(entity);
  }

  /** Clear all staged state */
  clear(): void {
    this.pending.clear();
    this.destinations.clear();
  }

  /** Support iteration over destinations */
  [Symbol.iterator](): IterableIterator<[Entity, bigint]> {
    return this.destinations.entries();
  }
}

// * --------------------------------------------------------------------------
// * Entities
// * --------------------------------------------------------------------------

/**
 * Manages entity lifecycle and state changes
 * Handles component operations and table movements
 */
export class Entities {
  private state = new EntityState();

  constructor(readonly world: World) {}

  /** Get archetype from entity's current table */
  private getTableArchetype(entity: Entity): bigint {
    const {tableId} = entity.getLocation();
    DEV_ASSERT(this.world.tables[tableId], `Table ${tableId} does not exist`);
    return this.world.tables[tableId]!.archetype;
  }

  /** Get entity's target or current archetype */
  private getEntityArchetype(entity: Entity): bigint {
    return this.state.getDestination(entity) ?? this.getTableArchetype(entity);
  }

  /** Calculate component bitmask */
  private getComponentMask(componentType: Class, isRemove = false): bigint {
    const componentId = this.world.getComponentId(componentType);
    const baseMask = 1n << BigInt(componentId);
    return isRemove ? ~baseMask : baseMask;
  }

  /**
   * Create new entity with optional components
   * @param components Optional array of component instances
   * @returns Newly created entity
   */
  spawn(components: object[] = []): Entity {
    const entity = this.state.createEntity(this);
    this.state.setDestination(entity, ENTITY_STATE.SPAWNED);

    let currentType = this.getEntityArchetype(entity);
    for (const component of components) {
      const componentMask = this.getComponentMask(
        component.constructor as Class,
      );
      currentType |= componentMask;
    }
    this.state.setDestination(entity, currentType);

    this.state.setPending(entity, [entity, ...components]);
    return entity;
  }

  /**
   * Destroy entity and clean up its state
   * @throws {Error} If entity doesn't exist or is already despawned
   */
  despawn(entity: Entity): void {
    this.state.setDestination(entity, ENTITY_STATE.DESPAWNED);
    if (this.state.getPending(entity)) {
      this.state.getPending(entity)!.length = 0;
    }
  }

  /**
   * Add component instance to entity
   * @param entity Target entity
   * @param instance Component instance to add
   */
  insert(entity: Entity, instance: object): Entity {
    this.insertTag(entity, instance.constructor as Class);
    const components = this.state.getPending(entity) ?? [];

    const componentType = instance.constructor;
    const existingIndex = components.findIndex(
      (c) => c.constructor === componentType,
    );
    if (existingIndex !== -1) {
      components[existingIndex] = instance;
    } else {
      components.push(instance);
    }

    this.state.setPending(entity, components);
    return entity;
  }

  /**
   * Add component type marker to entity
   * @param entity Target entity
   * @param component Component class to add
   */
  insertTag(entity: Entity, component: Class): void {
    const currentType = this.getEntityArchetype(entity);
    const componentMask = this.getComponentMask(component);
    this.state.setDestination(entity, currentType | componentMask);
  }

  /**
   * Remove component from entity
   * @param entity Target entity
   * @param component Component class to remove
   */
  remove(entity: Entity, component: Class): void {
    const currentType = this.getEntityArchetype(entity);
    const componentMask = this.getComponentMask(component, true);
    this.state.setDestination(entity, currentType & componentMask);
  }

  /**
   * Apply all pending changes to entities
   * Moves entities between tables based on their component changes
   */
  flush(): void {
    const world = this.world;
    for (const [entity, archetype] of this.state) {
      const components = this.state.getPending(entity);
      const {tableId, tableRow} = entity.getLocation();
      const sourceTable = world.tables[tableId]!;
      const targetTable = world.getTable(archetype);
      const location = sourceTable.move({
        row: tableRow,
        targetTable,
        components: components ?? [],
      });
      entity.setLocation(location);
    }
    this.state.clear();
  }

  /**
   * Check if entity has specific component
   * @param entity Target entity
   * @param component Component class to check
   * @returns True if entity has component
   */
  has(entity: Entity, component: Class): boolean {
    const currentArchetype = this.getTableArchetype(entity);
    const componentId = this.world.getComponentId(component);
    return (currentArchetype & (1n << BigInt(componentId))) !== 0n;
  }

  /**
   * Get entity's components from table's row
   */
  entity(entity: Entity): object[] {
    const {tableId, tableRow} = entity.getLocation();
    const table = this.world.tables[tableId];
    const components = table?.getRow(tableRow);
    return components ?? [];
  }
}

/**
 * Factory function to create entity manager instance
 * @param world World instance to manage entities for
 */
export const createEntities = (world: World) => new Entities(world);

/**
 * Factory function to create entity manager factory
 * Returns a function that creates entity managers
 */
export const makeEntities = () => (world: World) => new Entities(world);
