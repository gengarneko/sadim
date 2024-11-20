/**
 * Core ECS World Implementation
 *
 * The World class serves as the central container and coordinator for the ECS system.
 * It manages entities, components, systems, and their relationships.
 *
 * Key Concepts:
 * -------------
 * 1. Entities: Unique identifiers for game objects
 * 2. Components: Data containers that can be attached to entities
 * 3. Systems: Logic that operates on entities with specific components
 * 4. Tables: Data structures that group entities with identical component sets
 * 5. Archetypes: Unique identifiers for component combinations
 *
 * Memory Management:
 * -----------------
 * - Tables are created on-demand for each unique archetype
 * - Component data is stored in contiguous arrays for cache efficiency
 * - Entity updates are batched based on entityUpdateTiming config
 *
 * Event System:
 * ------------
 * - Supports table creation notifications
 * - System start/stop events
 * - Entity lifecycle events (planned)
 *
 * Performance Considerations:
 * -------------------------
 * - Archetype calculations use bitwise operations
 * - Table lookups are cached
 * - Entity updates can be configured for optimal timing
 */

import type {Class} from './utils/class';

import {Entities, Entity} from './entity';
import {Plugin} from './plugin';
import {Schedule, ScheduleType} from './schedule';
import {System} from './system';
import {createTable, Table} from './table';
import {DEV_ASSERT} from './utils/dev';
import {Event} from './utils/event';

// * --------------------------------------------------------------------------
// * WorldConfig
// * --------------------------------------------------------------------------

/**
 * Configuration interface for World initialization and behavior.
 *
 * @property createWorker - Factory function for worker threads
 * @property entityUpdateTiming - Controls when entity changes are processed:
 *   - 'before': Updates before system execution
 *   - 'after': Updates after system execution
 *   - 'custom': Manual update timing
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
 * Utility function to complete partial world configurations with defaults.
 *
 * @param config - Partial configuration object
 * @returns Complete configuration with defaults applied
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

// * --------------------------------------------------------------------------
// * World
// * --------------------------------------------------------------------------

export class StartupSchedule extends Schedule {}
export class PreUpdateSchedule extends Schedule {}
export class UpdateSchedule extends Schedule {}
export class PostUpdateSchedule extends Schedule {}

/**
 * Central coordinator for the ECS system.
 *
 * Responsibilities:
 * 1. Entity management and lifecycle
 * 2. Component registration and ID assignment
 * 3. System scheduling and execution
 * 4. Resource management
 * 5. Event coordination
 *
 * Usage Example:
 * ```typescript
 * const world = new World();
 * world.addPlugin(myPlugin)
 *      .addSystem(UpdateSchedule, mySystem)
 *      .spawn()
 *      .addComponent(Position, {x: 0, y: 0});
 * await world.prepare();
 * await world.runSchedule(UpdateSchedule);
 * ```
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
   * If the world has started.
   */
  _hasStarted = false;

  /**
   * The config used to create this world.
   */
  config: Readonly<WorldConfig>;

  private defaultSchedules: ScheduleType[] = [
    StartupSchedule,
    PreUpdateSchedule,
    UpdateSchedule,
    PostUpdateSchedule,
  ];

  constructor(config: Partial<WorldConfig> = {}) {
    this.config = getCompleteConfig(config);
    this.defaultSchedules.forEach((schedule) => {
      this.schedules.set(schedule, new schedule(this));
    });
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
      this.entities.flush();
    }
    await this.schedules.get(scheduleType)!.run();
    if (this.config.entityUpdateTiming === 'after') {
      this.entities.flush();
    }
  }

  /**
   * Runs the world.
   */
  async run(): Promise<void> {
    if (!this._hasStarted) {
      await this.runSchedule(StartupSchedule);
      this._hasStarted = true;
    }

    try {
      if (this.config.entityUpdateTiming === 'before') {
        this.entities.flush();
      }
      await this.runSchedule(PreUpdateSchedule);
      await this.runSchedule(UpdateSchedule);
      await this.runSchedule(PostUpdateSchedule);
      if (this.config.entityUpdateTiming === 'after') {
        this.entities.flush();
      }
    } catch (error) {
      console.error('Error during world update:', error);
      throw error;
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
   * Returns the components for the provided entity.
   * @param entity The entity to get the components for.
   * @returns An array of components.
   */
  entity(entityId: Entity['id']): object[] {
    return this.entities.entity(entityId);
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
   * Computes a unique archetype identifier (bitfield) for a given set of component types.
   *
   * An archetype is represented as a bigint where each bit position corresponds to a
   * component ID. The least significant bit (position 0) is always 1 to ensure non-zero
   * archetypes.
   *
   * Example:
   * - Position(id:1), Velocity(id:2) => 111n (binary: 0...0111)
   * - Position(id:1) => 011n (binary: 0...0011)
   *
   * @param componentTypes - Array of component classes to include in the archetype.
   *                        Order doesn't matter as the result is a bitfield.
   *
   * @returns A bigint where:
   *          - Bit 0 is always 1 (base archetype)
   *          - Bit N is 1 if component with ID N is present
   *          - All other bits are 0
   *
   * Performance Note:
   * - Uses bitwise operations for efficient archetype computation
   * - Result is cached by caller for frequently used component combinations
   *
   * Memory Note:
   * - BigInt is used to support more than 32 component types
   * - Each unique combination creates a new table in the world
   */
  getArchetype(...componentTypes: Class[]): bigint {
    let result = 1n;
    for (const componentType of componentTypes) {
      result |= 1n << BigInt(this.getComponentId(componentType));
    }
    return result;
  }

  /**
   * Gets or creates a table for the specified archetype.
   *
   * A table is a data structure that stores entities with the same component types.
   * Each unique combination of components (archetype) has its own table.
   *
   * @param archetype - A bitfield representing the component types.
   *                   Each bit position corresponds to a component ID.
   *                   1 means the component is present, 0 means absent.
   *
   * @returns The existing table for this archetype, or a newly created one.
   *
   * Process:
   * 1. Check if a table already exists for this archetype
   * 2. If not, create a new table with:
   *    - A unique table ID
   *    - The archetype bitfield
   *    - The decoded component types
   * 3. Register the new table in the world's data structures
   * 4. Notify all listeners about the new table
   * 5. Emit a table update event
   *
   * Memory Consideration:
   * - Each table allocates memory for its component columns
   * - Initial capacity is determined by the Table constructor
   * - Tables grow dynamically as needed
   */
  getTable(archetype: bigint): Table {
    let table = this._archetypeToTable.get(archetype);
    if (table) {
      return table;
    }

    table = new Table(
      this.tables.length, // Unique table ID
      archetype, // Component bits
      decodeArchetype(this.components, archetype), // Component types
    );

    // Register the new table
    this.tables.push(table);
    this._archetypeToTable.set(archetype, table);

    // Notify listeners about new table
    for (const listener of this._listeners.createTable) {
      listener(table);
    }

    // Emit table update event
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
