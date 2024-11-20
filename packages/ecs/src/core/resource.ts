/**
 * Resource Module for ECS
 *
 * Purpose:
 * --------
 * 1. Global State Management
 *    - Manages singleton data that's shared across systems
 *    - Provides centralized access to game-wide state
 *
 * 2. System-Local State
 *    - Manages state that's unique to each system
 *    - Prevents state sharing between systems
 *
 * Examples:
 * --------
 * 1. Global Resources (Res<T>):
 *    ```typescript
 *    // Game settings resource
 *    class GameSettings {
 *      difficulty: number = 1;
 *      soundEnabled: boolean = true;
 *    }
 *
 *    // Access in system
 *    function gameSystem(settings: Res<GameSettings>) {
 *      if (settings.soundEnabled) {
 *        // Play sound...
 *      }
 *    }
 *    ```
 *
 * 2. Local Resources (Local<T>):
 *    ```typescript
 *    // System-specific timer
 *    class SpawnTimer {
 *      lastSpawn: number = 0;
 *
 *      static async fromWorld(world: World) {
 *        return new SpawnTimer();
 *      }
 *    }
 *
 *    // Each system gets its own timer
 *    function spawnSystem(timer: Local<SpawnTimer>) {
 *      const now = Date.now();
 *      if (now - timer.lastSpawn > 1000) {
 *        // Spawn entity...
 *        timer.lastSpawn = now;
 *      }
 *    }
 *    ```
 */

import type {Class} from '../utils/class';
import type {World} from './world';

import {DEV_ASSERT} from '../utils/dev';

/**
 * Global Resource Type
 *
 * Used for:
 * - Game configuration
 * - Shared state (scores, time)
 * - Global services (input, audio)
 */
export type Res<T extends object> = T;
export const Res = {
  async intoArgument(world: World, resource: Class): Promise<object> {
    return world.getResource(resource);
  },
};

/**
 * System-Local Resource Type
 *
 * Used for:
 * - System-specific state
 * - Independent timers/counters
 * - System initialization data
 */
export type Local<T extends object> = T;
export const Local = {
  async intoArgument(world: World, resourceType: Class) {
    const result =
      'fromWorld' in resourceType
        ? await (resourceType as any).fromWorld(world)
        : new resourceType();
    DEV_ASSERT(
      result !== undefined,
      'Resource.fromWorld must return an object.',
    );
    return result;
  },
};
