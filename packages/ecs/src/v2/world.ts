import type {Class} from './utils/class';

import {Entities, Entity} from './entity';
import {Plugin} from './plugin';
import {Schedule, ScheduleType} from './schedule';
import {createTable, Table} from './storage';
import {System} from './system';
import {DEV_ASSERT} from './utils/dev';
import {Event} from './utils/event';

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

  // onEntityAdded = new Event();

  // onEntityRemoved = new Event();

  onTableUpdated = new Event();

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
   *
   * default has `Entity` for:
   * - tracking all entities
   * - auto registering all components
   * - used in archetype calculation as a base component
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
    return this;
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

  addSystem(scheduleType: ScheduleType, system: System): this {
    this.addSystems(scheduleType, system);
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
    this.onTableUpdated.emit(table);
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
// * WorldEventListeners
// * --------------------------------------------------------------------------

type WorldEventListeners = {
  createTable: Array<(table: Table) => void>;
  start: Array<(world: World) => void>;
  stop: Array<(world: World) => void>;
};
