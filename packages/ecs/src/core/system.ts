/**
 * ECS System Module
 *
 * Core Concepts:
 * -------------
 * 1. System Definition
 *    - A system is a function that operates on components and entities
 *    - Systems contain the game logic and behavior
 *    - Systems can be synchronous or asynchronous
 *
 * 2. System Arguments
 *    - Systems can request specific data from the world via getSystemArguments
 *    - Arguments typically include:
 *      a) Queried entities with specific components
 *      b) Resources from the world
 *      c) Time and other global state
 *
 * 3. System Execution
 *    - Systems run in a defined order within schedules
 *    - Each system processes its entities and components
 *    - Systems can modify component data and entity state
 *
 * 4. System Types
 *    - Query Systems: Process entities matching specific component queries
 *    - Resource Systems: Operate on global resources
 *    - Startup Systems: Run once during initialization
 *    - Event Systems: React to specific game events
 */

import {World} from './world';

/**
 * System Type Definition
 *
 * Example Usage:
 * ```ts
 * const moveSystem: System = (entities, dt) => {
 *   for (const entity of entities) {
 *     // Update position
 *   }
 * };
 *
 * moveSystem.getSystemArguments = (world) => [
 *   world.query([Position, Velocity]),
 *   world.time.delta
 * ];
 * ```
 */
type System = ((...args: any[]) => void | Promise<void>) & {
  getSystemArguments?(world: World): any[];
};

/**
 * Clones a system to ensure it can be executed independently.
 * Note: Clone preserves functionality but not 'this' context
 *
 * @param system Original system to clone
 * @returns New system instance with same behavior
 */
function cloneSystem<T extends System>(system: T): T {
  const clone = system.bind(null) as T;
  clone.getSystemArguments = system.getSystemArguments!;
  return clone;
}

/**
 * Creates a new system entity in the world.
 * Used for system-specific data storage.
 *
 * @param world World instance to create system in
 * @returns New system entity
 */
function createSystem(world: World) {
  return world.addEntity();
}

export {cloneSystem, createSystem, type System};
