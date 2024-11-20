/**
 * Plugin Module for ECS
 *
 * A plugin is a modular unit that can extend and configure a World instance.
 * Plugins provide a way to organize and reuse game systems, components, and resources.
 *
 * Core Concepts:
 * -------------
 * 1. Modularity
 *    - Plugins encapsulate related functionality
 *    - Can be shared across different games/applications
 *    - Easy to enable/disable features
 *
 * 2. Configuration
 *    - Add systems to specific schedules
 *    - Register components and resources
 *    - Set up event listeners
 *
 * 3. Initialization
 *    - Can be synchronous or asynchronous
 *    - Handles resource loading
 *    - Sets up initial game state
 *
 * Usage Examples:
 * -------------
 * ```typescript
 * // Synchronous plugin
 * const physicsPlugin: Plugin = (world) => {
 *   world.addSystem(UpdateSchedule, moveSystem)
 *        .addSystem(UpdateSchedule, collisionSystem);
 * };
 *
 * // Asynchronous plugin
 * const assetsPlugin: Plugin = async (world) => {
 *   const textures = await loadTextures();
 *   world.insertResource(textures);
 * };
 * ```
 */

import {World} from './world';

/**
 * Plugin Type Definition
 *
 * A function that configures a World instance. Can be either:
 * 1. Synchronous: For immediate setup without loading/async operations
 * 2. Asynchronous: For setup that requires loading or async initialization
 *
 * Parameters:
 * @param world - The World instance to configure
 *
 * Returns:
 * - void for synchronous plugins
 * - Promise<void> for asynchronous plugins
 *
 * Responsibilities:
 * - Add systems to schedules
 * - Register components
 * - Insert resources
 * - Set up event listeners
 * - Initialize game state
 * - Load assets/data
 */
export type Plugin =
  | ((world: World) => Promise<void>)
  | ((world: World) => void);
