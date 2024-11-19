/**
 * Schedule System for ECS
 *
 * Schedule manages and executes systems in a specific order. It's responsible for:
 * 1. System registration and management
 * 2. System argument preparation
 * 3. Sequential system execution
 *
 * Workflow Diagram:
 * ----------------
 * ┌─────────────────┐
 * │     World       │
 * └────────┬────────┘
 *          │ creates
 *          ▼
 * ┌─────────────────┐    add      ┌─────────────┐
 * │    Schedule     │◄───────────│   Systems   │
 * └────────┬────────┘             └─────────────┘
 *          │ prepare
 *          ▼
 * ┌──────────────────┐
 * │ System Arguments │
 * └────────┬─────────┘
 *          │ run
 *          ▼
 * ┌──────────────────┐
 * │ System Execution │
 * └──────────────────┘
 */

import {DEV_ASSERT} from 'src/v2/utils/dev';

import {System} from './system';
import {World} from './world';

// * --------------------------------------------------------------------------
// * Schedule
// * --------------------------------------------------------------------------

/**
 * A class that contains systems to be run, as well as the arguments to provide these systems.
 *
 * Can be extended to create custom schedules.
 *
 * Internal Structure:
 * ------------------
 * ┌───────────────────────────────┐
 * │           Schedule            │
 * ├───────────────┬───────────────┤
 * │  _systems[]   │   _args[][]   │
 * ├───────────┬───┴───┬───────────┤
 * │ System 1  │ Arg 1 │   ...     │
 * │ System 2  │ Arg 2 │   ...     │
 * │    ...    │  ...  │   ...     │
 * └───────────┴───────┴───────────┘
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
