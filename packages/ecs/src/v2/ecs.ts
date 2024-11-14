import {DEV_ASSERT} from './utils/dev';

export type Class = {
  new (...args: any[]): object;
};

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

  get id(): number;

  /** if this entity is still alive or has been despawned */
  get isAlive(): boolean;

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
  this._entities = entities;
  this._id = id;
}

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

Object.defineProperty(Entity.prototype, 'id', {
  get(): number {
    return this._id;
  },
});

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

Entities.prototype.remove = function (entity: Readonly<Entity>, type: Class) {
  const val = this._destinations.get(entity) ?? this.getArchetype(entity);
  const componentId = this._world.getComponentId(type);
  this._destinations.set(entity, val ^ (1n << BigInt(componentId)));
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
// * Query
// * --------------------------------------------------------------------------

const EMPTY_COLUMN: [] = [];

/**
 * A collection that matches against entities that have a set of components and match a particular filter.
 */
// @ts-ignore force TypeScript to check the generic parameters
export class Query<A extends Accessor | Accessor[], F extends Filter = Filter> {
  static intoArgument(
    world: World,
    accessors: AccessorDescriptor | AccessorDescriptor[],
    filter?: Filter,
  ) {
    const isIndividual = !Array.isArray(accessors);
    accessors = Array.isArray(accessors) ? accessors : [accessors];
    const components = accessors.map((x) => (Maybe.isMaybe(x) ? x.type : x));
    const initial = world.getArchetype(
      ...accessors.filter((x): x is Class => !Maybe.isMaybe(x)),
    );
    const filters = filter ? filter.execute([initial, 0n]) : [initial, 0n];
    return new Query(world, filters, isIndividual, components);
  }

  _world: World;
  _columns: Array<object[]>;
  _filters: bigint[];
  _isIndividual: boolean;
  _components: Class[];
  constructor(
    world: World,
    filters: bigint[],
    isIndividual: boolean,
    components: Class[],
  ) {
    this._world = world;
    this._filters = filters;
    this._isIndividual = isIndividual;
    this._components = components;
    this._columns = [];
    this._world.addEventListener('createTable', (table) => {
      if (this._testArchetype(table.archetype)) {
        this._columns.push(table.getColumn(Entity));
        for (const component of this._components) {
          this._columns.push(
            table.hasColumn(component)
              ? table.getColumn(component)
              : EMPTY_COLUMN,
          );
        }
      }
    });
  }

  /**
   * The number of entities that match this query.
   */
  get length(): number {
    let result = 0;
    const span = this._components.length + 1;
    for (let i = 0; i < this._columns.length; i += span) {
      result += this._columns[i]!.length;
    }
    return result;
  }

  *[Symbol.iterator](): IterableIterator<A> {
    const elements = [];
    const componentCount = this._components.length;
    const groupSpan = componentCount + 1;
    for (
      let columnGroup = 0;
      columnGroup < this._columns.length;
      columnGroup += groupSpan
    ) {
      const {length} = this._columns[columnGroup]!;
      for (let iterations = 0; iterations < length; iterations++) {
        for (let offset = 0; offset < componentCount; offset++) {
          elements[offset] =
            this._columns[columnGroup + offset + 1]![iterations];
        }
        yield (this._isIndividual ? elements[0] : elements) as A;
      }
    }
  }

  /**
   * Calls the provided callback function for all entities in the query.
   * @param callback The callback to be called for all entities in this query.
   */
  forEach(callback: (args: A, index: number) => void) {
    let index = 0;
    for (const result of this) {
      callback(result, index++);
    }
  }

  /**
   * Calls the provided callback function for all the entities in the query.
   * The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
   * @param callback The callback to be called for every entity in the query.
   * @param initialValue The initial value for the accumulated result.
   * @returns The accumulated result.
   */
  reduce<T>(
    callback: (acc: T, args: A, index: number) => T,
    initialValue: T,
  ): T {
    let index = 0;
    for (const result of this) {
      initialValue = callback(initialValue, result, index++);
    }
    return initialValue;
  }

  /**
   * Returns the queried components for the provided entity if it is alive and matched by this query.
   * Otherwise, returns null.
   * @param entity The entity
   * @returns The queried-for components, or null if the entity no longer exists or does not match.
   */
  get(entity: Entity): A | null {
    const [tableId, row] = entity.locate();
    const table = this._world.tables[tableId];
    if (!this._testArchetype(table!.archetype)) {
      return null;
    }
    const result = [];
    for (const component of this._components) {
      result.push(table!.getColumn(component)[row]);
    }
    return (this._isIndividual ? result[0] : result) as A;
  }

  /**
   * Returns the first entity of this query.
   *
   * Queries using this method **should only have one match**;
   * in dev, this method will throw if the query matches more than one entity.
   * @returns The single matching entity.
   */
  single(): A {
    DEV_ASSERT(
      this.length === 1,
      'Query.p.single was used for a query that matched multiple entities.',
    );
    const [result] = this;
    return result as A;
  }

  /**
   * Iterates all _unique_ pairs in the query.
   */
  *pairs(): IterableIterator<[A, A]> {
    const result: [A, A] = [null, null] as any;
    let i = 0;
    for (const iter1 of this) {
      let j = 0;
      for (const iter2 of this) {
        if (i <= j) {
          continue;
        }
        result[0] = iter1;
        result[1] = iter2;
        yield result;
        j++;
      }
      i++;
    }
  }

  /**
   * Tests if a given archetype matches this queries filters.
   * @param n The archetype to test.
   * @returns A boolean, `true` if the archetype matches and `false` if it does not.
   */
  _testArchetype(archetype: bigint): boolean {
    for (let i = 0; i < this._filters.length; i += 2) {
      const withFilter = this._filters[i]!;
      const withoutFilter = this._filters[i + 1]!;
      if (
        (withFilter & archetype) === withFilter &&
        (withoutFilter & archetype) === 0n
      ) {
        return true;
      }
    }
    return false;
  }
}

// * --------------------------------------------------------------------------
// * Filter
// * --------------------------------------------------------------------------

/**
 * The base class for a condition (or conditions) that entities must satisfy in
 * order to match a query.
 */
export class Filter<T extends object[] = object[]> {
  static intoArgument<T extends object[]>(
    world: World,
    ...children: T
  ): Filter<T> {
    return new this(world, children);
  }

  world: World;
  children: T;
  constructor(world: World, children: T) {
    this.world = world;
    this.children = children;
  }

  execute(current: bigint[]): bigint[] {
    return current;
  }
}
/**
 * A predicate that ensures only entities **with** the specified components will match a query.
 */
export class With<
  A extends object,
  B extends object = object,
  C extends object = object,
  D extends object = object,
> extends Filter<Class[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return current.map((val, i) =>
      i % 2 === 0 ? val | this.world.getArchetype(...this.children) : val,
    );
  }
}

/**
 * A predicate that ensures only entities **without** the specified components will match a query.
 */
export class Without<
  A extends object,
  B extends object = object,
  C extends object = object,
  D extends object = object,
> extends Filter<Class[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return current.map((val, i) =>
      i % 2 === 1
        ? val | (this.world.getArchetype(...this.children) ^ 1n)
        : val,
    );
  }
}

/**
 * A connective that ensures that **all** of the provided conditions must be met for a query to match.
 */
export class And<
  A extends Filter,
  B extends Filter,
  C extends Filter = any,
  D extends Filter = any,
> extends Filter<Filter[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return this.children.reduce((acc, filter) => filter.execute(acc), current);
  }
}

/**
 * A connective that ensures that **at least one** of the provided conditions must be met for a query to match.
 */
export class Or<
  A extends Filter,
  B extends Filter,
  C extends Filter = any,
  D extends Filter = any,
> extends Filter<Filter[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return this.children.flatMap((filter) => filter.execute(current));
  }
}

export function DEV_ASSERT_FILTER_VALID(filters: bigint[]) {
  DEV_ASSERT(
    filters.some((f, i) => i % 2 === 0 && (f & filters[i + 1]!) === 0n),
    'Impossible query - cannot match any entities.',
  );
}

// * --------------------------------------------------------------------------
// * modifier
// * --------------------------------------------------------------------------

/**
 * A type that may or may not be present.
 */
export type Maybe<T> = T | undefined;
export const Maybe = {
  intoArgument(_: World, type: Class) {
    return {modifier: 'maybe', type};
  },
  isMaybe(value: any): value is {modifier: string; type: Class} {
    return typeof value === 'object' && value.modifier === 'maybe';
  },
};

export type AccessorDescriptor = Class | {modifier: string; type: Class};
export type Accessor = Maybe<object>;

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
Table.prototype.move = function ({
  row,
  targetTable,
  components,
}: {
  row: number;
  targetTable: Table;
  components: object[];
}): Entity | undefined {
  for (let i = 0; i < this._components.length; i++) {
    const componentType = this._components[i]!;
    const column = this._columns[i]!;
    const element = swapRemove(column, row)!;
    if (targetTable.hasColumn(componentType)) {
      targetTable.getColumn(componentType).push(element);
    }
  }
  for (const component of components) {
    if (targetTable.hasColumn(component.constructor as any)) {
      targetTable.getColumn(component.constructor as any)?.push(component);
    }
  }
  return this._columns[0]?.[this._columns[0].length - 1] as Entity | undefined;
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
function swapRemove<T>(array: T[], index: number): T | undefined {
  const temp = array[index];
  const last = array[array.length - 1];
  if (last !== undefined) {
    array[index] = last;
  }
  array.pop();
  return temp;
}

/**
 * A function that accepts world data and reads or writes it.
 */
type System = ((...args: any[]) => void | Promise<void>) & {
  getSystemArguments?(world: World): any[];
};

/**
 * Cloned system does not preserve the system's `this` value.
 */
function cloneSystem<T extends System>(system: T): T {
  const clone = system.bind(null) as T;
  clone.getSystemArguments = system.getSystemArguments!;
  return clone;
}

function createSystem(world: World) {
  return world.spawn();
}

// * --------------------------------------------------------------------------
// * WorldConfig
// * --------------------------------------------------------------------------

/**
 * Configuration used by a `World`.
 * May be accessed by resources or other data in a world.
 */
export type WorldConfig = {
  /**
   * A function that accepts the URL of a module and returns a `Worker`-like object for that module.
   *
   * Defaults to a module-friendly browser-oriented worker creation function.
   *
   * @param url The URL of the worker module.
   * @returns A `Worker`-like object.
   */
  createWorker(url: string): Worker;
  /**
   * Specify when entities should update to add/remove components.
   * Can be one of three values:
   *
   * - `"before"` - updates before systems are executed in `World.p.runSchedule()`.
   * - `"after"`  - updates after systems are executed in `World.p.runSchedule()`.
   * - `"custom"` - does not run by default, you must add a system to execute it.
   */
  entityUpdateTiming: 'before' | 'after' | 'custom';
} & Record<string, unknown>;

/**
 * Completes the config for a world.
 * @param config The partial config for the world.
 * @returns The completed config.
 */
export function getCompleteConfig(
  config?: Partial<WorldConfig> | undefined,
): WorldConfig {
  return {
    createWorker(url) {
      return new Worker(url, {type: 'module'});
    },
    entityUpdateTiming: 'after',
    ...config,
  };
}

/*---------*\
|   TESTS   |
\*---------*/
// if (import.meta.vitest) {
//   const {it, expect, afterEach, vi} = import.meta.vitest;

//   afterEach(() => {
//     vi.restoreAllMocks();
//   });

//   it('completes partial config', () => {
//     const result = getCompleteConfig();
//     expect(result).toHaveProperty('createWorker');
//   });
// }

// * --------------------------------------------------------------------------
// * World
// * --------------------------------------------------------------------------

/**
 * The entry point for a Thyseus application.
 *
 * Contains data and types used by the app, such as entities, components, resources, and systems.
 */
export class World {
  static intoArgument(world: World): World {
    return world;
  }

  /**
   * A list of tables in the world.
   * Tables group entities with the same components together.
   */
  tables: Table[] = [createTable()];
  /**
   * A list of resources in the world.
   */
  resources: object[] = [];
  /**
   * The schedules that exist in this world.
   */
  schedules: Map<ScheduleType, Schedule> = new Map();
  /**
   * A list of components currently used by this world.
   */
  components: Class[] = [Entity];
  /**
   * The entities handler for this world.
   */
  entities: Entities = new Entities(this);

  /**
   * A list of async plugins that have been started.
   */
  _pendingPlugins: Promise<any>[] = [];
  /**
   * A lookup for archetypes (`bigint`s) to tables.
   */
  _archetypeToTable: Map<bigint, Table> = new Map([[0n, this.tables[0]!]]);
  /**
   * The event listeners for this world.
   */
  _listeners: WorldEventListeners = {
    start: [],
    stop: [],
    createTable: [],
  };

  /**
   * The config used to create this world.
   */
  config: Readonly<WorldConfig>;
  constructor(config: Partial<WorldConfig> = {}) {
    this.config = getCompleteConfig(config);
  }

  /**
   * Passes this `World` to the provided plugin function.
   * @param plugin The plugin to add.
   * @returns `this`, for chaining.
   */
  addPlugin(plugin: Plugin): this {
    const result = plugin(this);
    if (result instanceof Promise) {
      this._pendingPlugins.push(result);
    }
    return this;
  }

  /**
   * Adds systems to the provided schedule.
   * @param scheduleType The schedule **class** to add systems to.
   * @param systems The system or systems to add.
   * @returns `this`, for chaining.
   */
  addSystems(scheduleType: ScheduleType, systems: System | System[]): this {
    if (!this.schedules.has(scheduleType)) {
      this.schedules.set(scheduleType, new scheduleType(this));
    }
    this.schedules.get(scheduleType)?.addSystems(systems);
    return this;
  }

  /**
   * Prepares the world by preparing all the system arguments for every schedule in the world.
   * @returns `Promise<this>`, for chaining.
   */
  async prepare(): Promise<this> {
    await Promise.all(this._pendingPlugins);
    this._pendingPlugins = [];
    for (const schedule of this.schedules.values()) {
      await schedule.prepare();
    }
    return this;
  }

  /**
   * Runs the specified schedule.
   * Throws if that schedule cannot be found.
   * @param schedule The schedule to run.
   * @returns A promise that resolves when the schedule has completed
   */
  async runSchedule(scheduleType: ScheduleType): Promise<void> {
    DEV_ASSERT(
      this.schedules.has(scheduleType),
      `Could not find schedule "${String(scheduleType.name)}" in the world!`,
    );
    if (this.config.entityUpdateTiming === 'before') {
      this.entities.update();
    }
    await this.schedules.get(scheduleType)!.run();
    if (this.config.entityUpdateTiming === 'after') {
      this.entities.update();
    }
  }

  /**
   * Spawns a new entity in the world (alias for `world.entities.spawn()`).
   * @returns The newly created `Entity`
   */
  spawn(): Entity {
    return this.entities.spawn();
  }

  /**
   * Returns the resource of the provided type, creating it if it doesn't yet exist.
   * @param resourceType The type of the resource to get
   * @returns The resource instance.
   */
  async getResource<T extends Class>(
    resourceType: T,
  ): Promise<InstanceType<T>> {
    let res = this.resources.find((r) => r.constructor === resourceType) as
      | InstanceType<T>
      | undefined;
    if (res) {
      return res;
    }
    res =
      'fromWorld' in resourceType
        ? await (resourceType as any).fromWorld(this)
        : new resourceType();
    DEV_ASSERT(
      res !== undefined,
      `${resourceType.name}.fromWorld() returned undefined; expected an object.`,
    );
    this.resources.push(res);
    return res;
  }

  /**
   * Inserts the provided object as a resource into the world.
   * If a resource of the same type already exists, the provided value will override that resource.
   * @param `resource` The resource object to insert.
   * @returns `this`, for chaining.
   */
  insertResource(resource: object): this {
    const resourceIndex = this.resources.findIndex(
      (res) => res.constructor === resource.constructor,
    );
    if (resourceIndex === -1) {
      this.resources.push(resource);
    } else {
      this.resources[resourceIndex] = resource;
    }
    return this;
  }

  /**
   * Gets the internal id for a component in this world.
   * If the provided component type doesn't yet have an id in this world, an id will be reserved.
   * @param componentType The component type to get an id for.
   * @returns The numeric id of the component.
   */
  getComponentId(componentType: Class): number {
    const componentId = this.components.indexOf(componentType);
    if (componentId !== -1) {
      return componentId;
    }
    this.components.push(componentType);
    return this.components.length - 1;
  }

  /**
   * Returns the matching archetype (bigint) for a set of components.
   * @param ...componentTypes The components to get an archetype for.
   * @returns The archetype for this set of components.
   */
  getArchetype(...componentTypes: Class[]): bigint {
    let result = 1n;
    for (const componentType of componentTypes) {
      result |= 1n << BigInt(this.getComponentId(componentType));
    }
    return result;
  }

  /**
   * Given an archetype (`bigint)`, returns the array of components that matches this archetype.
   * @param archetype The archetype to get components for
   * @returns An array of components (`Class[]`).
   */
  getComponentsForArchetype(archetype: bigint): Class[] {
    const components = [];
    let temp = archetype;
    let i = 0;
    while (temp !== 0n) {
      if ((temp & 1n) === 1n) {
        components.push(this.components[i]);
      }
      temp >>= 1n;
      i++;
    }
    return components as Class[];
  }

  /**
   * Gets a table for the provided archetype.
   * If it doesn't exist, creates the table.
   * @param archetype The archetype for the table to find.
   * @returns The table matching the provided archetype.
   */
  getTable(archetype: bigint): Table {
    let table = this._archetypeToTable.get(archetype);
    if (table) {
      return table;
    }
    table = new Table({
      id: this.tables.length,
      archetype,
      components: this.getComponentsForArchetype(archetype),
    });
    this.tables.push(table);
    this._archetypeToTable.set(archetype, table);
    for (const listener of this._listeners.createTable) {
      listener(table);
    }
    return table;
  }

  /**
   * Emits the `"start"` event in this world.
   */
  start(): void {
    for (const listener of this._listeners.start) {
      listener(this);
    }
  }

  /**
   * Emits the `"stop"` event in this world.
   */
  stop(): void {
    for (const listener of this._listeners.stop) {
      listener(this);
    }
  }

  /**
   * Adds a listener for a specific event to the world.
   * @param type The type of event to listen to.
   * @param listener The callback to be run when the event is emitted.
   */
  addEventListener<T extends keyof WorldEventListeners>(
    type: T,
    listener: WorldEventListeners[T][0],
  ): this {
    DEV_ASSERT(
      type in this._listeners,
      `Unrecognized World event listener ("${type}")`,
    );
    this._listeners[type].push(listener as any);
    return this;
  }

  /**
   * Removes a listener for an event from the world.
   * @param type The type of event to remove a listener from.
   * @param listener The callback to be removed.
   */
  removeEventListener<T extends keyof WorldEventListeners>(
    type: T,
    listener: WorldEventListeners[T][0],
  ): this {
    DEV_ASSERT(
      type in this._listeners,
      `Unrecognized World event listener ("${type}")`,
    );
    const arr = this._listeners[type];
    arr.splice(arr.indexOf(listener as any), 1);
    return this;
  }
}

// * --------------------------------------------------------------------------
// * Schedule
// * --------------------------------------------------------------------------

/**
 * A class that contains systems to be run, as well as the arguments to provide these systems.
 *
 * Can be extended to create custom schedules.
 */
export class Schedule {
  _systems: System[] = [];
  _args: Array<any[]> = [];

  _world: World;
  constructor(world: World) {
    this._world = world;
  }

  /**
   * Adds systems to this schedule.
   * @param system The system to add.
   * @returns `this`, for chaining.
   */
  addSystems(systems: System | System[]): this {
    for (const system of Array.isArray(systems) ? systems : [systems]) {
      DEV_ASSERT(
        !this.hasSystem(system),
        `Cannot add the same system to a schedule twice (adding ${system.name} to ${this.constructor.name})`,
      );
      this._systems.push(system);
    }
    return this;
  }

  /**
   * Removes a system from this schedule.
   * @param system The system to remove.
   * @returns `this`, for chaining.
   */
  removeSystem(system: System): this {
    DEV_ASSERT(
      this.hasSystem(system),
      `Cannot remove a system from a schedule it isn't in (removing ${system.name} from ${this.constructor.name})`,
    );
    this._systems.splice(this._systems.indexOf(system), 1);
    return this;
  }

  /**
   * Returns whether the schedule has the specified system.
   * @param system The system to check the presence of.
   * @returns `true` if the schedule has the system, `false` otherwise.
   */
  hasSystem(system: System): boolean {
    return this._systems.includes(system);
  }

  /**
   * Prepares the system arguments for this schedule, grabbing new arguments for all systems.
   * Any previous arguments will be replaced.
   * @returns A promise that resolves once all systems are ready to be run.
   */
  async prepare(): Promise<void> {
    for (let i = 0; i < this._systems.length; i++) {
      this._args[i] = await Promise.all(
        this._systems[i]!.getSystemArguments?.(this._world) ?? [],
      );
    }
  }

  /**
   * Runs all the systems in this schedule with their arguments.
   * @returns A promise that resolves once all systems have finished executing.
   */
  async run(): Promise<void> {
    const systems = this._systems;
    const args = this._args;
    for (let i = 0; i < systems.length; i++) {
      await systems[i]!(...(args[i] ?? []));
    }
  }
}
export type ScheduleType = typeof Schedule;

// * --------------------------------------------------------------------------
// * WorldEventListeners
// * --------------------------------------------------------------------------

type WorldEventListeners = {
  createTable: Array<(table: Table) => void>;
  start: Array<(world: World) => void>;
  stop: Array<(world: World) => void>;
};

/**
 * A function that takes a world and may add event listeners, systems, and data to it.
 */
export type Plugin =
  | ((world: World) => Promise<void>)
  | ((world: World) => void);
