import type {TagComponentType} from './component';
import type {Class} from './utils/class';

import {isSizedComponent, isTagComponent} from './component';
import {DEV_ASSERT} from './utils/dev';
import {World} from './world';

// * --------------------------------------------------------------------------
// * Entity
// * --------------------------------------------------------------------------

declare class Entity {
  /** ref to the entity manager */
  _entities: Entities;

  /** @internal world-unique integer id */
  _id: number;

  /** @internal storage table */
  _table: number;

  /** @internal storage location */
  _row: number;

  constructor(entities: Entities, id: number);

  /** if this entity is still alive or has been despawned */
  get isAlive(): boolean;

  /** world-unique integer id */
  id(): number;

  /** if this entity has the provided component */
  has(component: Class): boolean;

  /** add a component to this entity */
  add<T extends object>(component: T extends Function ? never : T): this;

  /** add a tag to this entity */
  addTag(tag: TagComponentType): this;

  /** remove a component from this entity */
  remove(component: Class): this;

  /** despawn this entity */
  despawn(): void;

  // unsafe to use alone - use `Entities.p.update()` instead
  move(table: number, row: number): void;

  // provides the location of the entity
  locate(): [table: number, row: number];
}

/**
 * @internal
 * This enables better control of the transpiled output size.
 */
function Entity(this: Entity, entities: Entities, id: number) {
  this._table = 0;
  this._row = 0;
  this._entities = entities;
  this._id = id;
}

Entity.prototype.id = function () {
  return this._id;
};

Entity.prototype.has = function (component: Class) {
  return this._entities.hasComponent(this, component);
};

Entity.prototype.add = function <T extends object>(component: T) {
  const type = component.constructor as Class;
  DEV_ASSERT(
    type !== Entity,
    'Tried to add Entity component, which is forbidden.',
  );
  DEV_ASSERT(
    isSizedComponent(type),
    'ZSTs must be added with EntityCommands.addType().',
  );
  this._entities.add(this, component);
  return this;
};

Entity.prototype.addTag = function (tag: TagComponentType) {
  DEV_ASSERT(
    isTagComponent(tag),
    'Sized types must be added with EntityCommands.add()',
  );
  this._entities.addTag(this, tag);
  return this;
};

Entity.prototype.remove = function (type: Class) {
  DEV_ASSERT(
    type !== Entity,
    'Tried to remove Entity component, which is forbidden.',
  );
  this._entities.remove(this, type);
  return this;
};

Entity.prototype.despawn = function () {
  this._entities.remove(this, Entity);
};

Entity.prototype.move = function (table: number, row: number) {
  this._table = table;
  this._row = row;
};

Entity.prototype.locate = function () {
  return [this._table, this._row];
};

Object.defineProperty(Entity.prototype, 'isAlive', {
  get(): boolean {
    return this._table !== 0;
  },
});

/**
 * Create a plain entity.
 */
function createEntity(entities: Entities, id: number) {
  return new Entity(entities, id);
}

// * --------------------------------------------------------------------------
// * Entities
// * --------------------------------------------------------------------------

declare class Entities {
  /** ref to the world */
  _world: World;

  /** used to generate unique ids */
  _nextId: number;

  /** target archetype */
  _destinations: Map<Readonly<Entity>, bigint>;

  /** entities to be inserted */
  _inserts: Map<Readonly<Entity>, object[]>;

  /** empty array */
  _EMPTY: [];

  constructor(world: World);

  /** @internal update the destination archetype */
  _setDestination(entity: Readonly<Entity>, type: Class): void;

  /** create a new entity */
  spawn(): Entity;

  /** add a component to an entity */
  add(entity: Readonly<Entity>, instance: object): void;

  /** add a tag to an entity */
  addTag(entity: Readonly<Entity>, type: Class): void;

  /** remove a component from an entity */
  remove(entity: Readonly<Entity>, type: Class): void;

  /** update the entity manager */
  update(): void;

  /** get the archetype of an entity */
  getArchetype(entity: Readonly<Entity>): bigint;

  /** check if an entity has a component */
  hasComponent(entity: Readonly<Entity>, type: Class): boolean;
}

/**
 * @internal
 * This enables better control of the transpiled output size.
 */
function Entities(this: Entities, world: World) {
  this._nextId = 0;
  this._destinations = new Map();
  this._inserts = new Map();
  this._EMPTY = [];
  this._world = world;
}

Entities.prototype.spawn = function (this: Entities) {
  const entity = new Entity(this, this._nextId++);
  this._destinations.set(entity, 1n);
  this._inserts.set(entity, [entity]);
  return entity;
};

Entities.prototype.add = function (entity: Readonly<Entity>, instance: object) {
  this.addTag(entity, instance.constructor as Class);
  const inserts = this._inserts.get(entity) ?? [];
  inserts.push(instance);
  this._inserts.set(entity, inserts);
};

Entities.prototype.addTag = function (entity: Readonly<Entity>, type: Class) {
  const val = this._destinations.get(entity) ?? this.getArchetype(entity);
  const componentId = this._world.getComponentId(type);
  this._destinations.set(entity, val | (1n << BigInt(componentId)));
};

Entities.prototype._setDestination = function (
  entity: Readonly<Entity>,
  type: Class,
) {
  const val = this._destinations.get(entity) ?? this.getArchetype(entity);
  const componentId = this._world.getComponentId(type);
  this._destinations.set(entity, val | (1n << BigInt(componentId)));
};

/**
 * current archetype:       0000...0001  (only component0)
 * add component1:          0000...0010  (1 << 1)
 * after or:                0000...0011  (now has component0 and component1)
 * remove component1:       0000...0001  (1 << 1)
 * after xor:               0000...0000  (only component0)
 *
 * | (or) used for adding component: ensure the bit is 1
 * ^ (xor) used for removing component: flip the bit's state
 */
Entities.prototype.remove = function (entity: Readonly<Entity>, type: Class) {
  const val = this._destinations.get(entity) ?? this.getArchetype(entity);
  const componentId = this._world.getComponentId(type);
  const mask = ~(1n << BigInt(componentId));
  const newArchetype = val & mask;
  this._destinations.set(entity, newArchetype);
};

Entities.prototype.update = function (this: Entities) {
  const world = this._world;
  for (const [entity, archetype] of this._destinations) {
    const components = this._inserts.get(entity) ?? this._EMPTY;
    const [table, row] = entity.locate();
    const currentTable = world.tables[table];
    const targetTable = world.getTable(archetype);
    const backfilledEntity =
      currentTable?.move({row, targetTable, components}) ?? entity;
    backfilledEntity.move(table, row);
    entity.move(targetTable.id, targetTable.length - 1);
  }
  this._destinations.clear();
  this._inserts.clear();
};

Entities.prototype.getArchetype = function (entity: Readonly<Entity>): bigint {
  const [table] = entity.locate();
  return this._world.tables[table]!.archetype;
};

Entities.prototype.hasComponent = function (
  entity: Readonly<Entity>,
  component: Class,
) {
  const componentId = this._world.getComponentId(component);
  const archetype = this.getArchetype(entity);
  return (archetype & (1n << BigInt(componentId))) !== 0n;
};

/**
 * Create a plain entity manager.
 */
function createEntities(world: World) {
  return new Entities(world);
}

function applyEntityUpdates(entities: Entities) {
  entities.update();
}
applyEntityUpdates.getSystemArguments = (world: World) => [world.entities];

// * --------------------------------------------------------------------------
// * Export
// * --------------------------------------------------------------------------

export {
  // Entity
  Entity,
  createEntity,
  // Entities
  Entities,
  createEntities,
  applyEntityUpdates,
};
