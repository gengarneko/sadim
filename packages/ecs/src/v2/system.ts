import {World} from './world';

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

export {cloneSystem, createSystem, type System};
