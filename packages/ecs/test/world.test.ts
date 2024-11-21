import {beforeEach, describe, expect, it, vi} from 'vitest';

import {Entity, World} from '../src';

// 模拟组件类
class Position {
  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}
}

class Velocity {
  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}
}

class Health {
  constructor(public value: number = 100) {}
}

describe('World', () => {
  describe('Initialization', () => {
    it('should create with default config', () => {
      const world = new World();
      world.addEntity();
      expect(world.config.entityUpdateTiming).toBe('after');
      expect(world.components).toContain(Entity);
      expect(world.storage.length).toBe(1);
    });

    it('should create with custom config', () => {
      const world = new World({entityUpdateTiming: 'before'});
      expect(world.config.entityUpdateTiming).toBe('before');
    });
  });

  describe('Component Management', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should assign unique component IDs', () => {
      const id1 = world.getComponentId(Position);
      const id2 = world.getComponentId(Velocity);
      const id3 = world.getComponentId(Health);

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should return same ID for same component', () => {
      const id1 = world.getComponentId(Position);
      const id2 = world.getComponentId(Position);
      expect(id1).toBe(id2);
    });
  });

  describe('Archetype System', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should create correct archetype for components', () => {
      const archetype = world.getArchetype(Position, Velocity);

      // Position's ID is 1, Velocity's ID is 2, plus the base Entity(0)
      // Should generate binary 111 (7n)
      expect(archetype).toBe(7n);
    });

    it('should decode archetype correctly', () => {
      const archetype = world.getArchetype(Position, Health);
      const table = world.acquireTable(archetype);

      expect(table.getColumn(Position)).toBeDefined();
      expect(table.getColumn(Health)).toBeDefined();
      expect(table.getColumn(Velocity)).toBeUndefined();
    });
  });

  describe('Table Management', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should create new table for unique archetype', () => {
      const initialTableCount = world.storage.length;
      const archetype = world.getArchetype(Position, Velocity);
      world.acquireTable(archetype);
      expect(world.storage.length).toBe(initialTableCount + 1);
    });

    it('should reuse existing table for same archetype', () => {
      const archetype = world.getArchetype(Position);
      const table1 = world.acquireTable(archetype);
      const table2 = world.acquireTable(archetype);

      expect(table1).toBe(table2);
    });
  });

  describe('Resource Management', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should create resource on first access', async () => {
      class GameState {
        score = 0;
      }

      const state = await world.getResource(GameState);
      expect(state).toBeInstanceOf(GameState);
    });

    it('should return same resource instance', async () => {
      class GameState {
        score = 0;
      }

      const state1 = await world.getResource(GameState);
      const state2 = await world.getResource(GameState);
      expect(state1).toBe(state2);
    });

    it('should override existing resource', () => {
      class GameState {
        constructor(public score: number = 0) {}
      }

      const newState = new GameState(100);
      world.insertResource(newState);

      const found = world.resources.find((r) => r instanceof GameState);
      expect(found).toBe(newState);
    });
  });

  describe('Event System', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should handle start/stop events', () => {
      const startListener = vi.fn();
      const stopListener = vi.fn();

      world.addEventListener('start', startListener);
      world.addEventListener('stop', stopListener);

      world.start();
      world.stop();

      expect(startListener).toHaveBeenCalledTimes(1);
      expect(stopListener).toHaveBeenCalledTimes(1);
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      world.addEventListener('start', listener);
      world.removeEventListener('start', listener);

      world.start();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Plugin System', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should handle sync plugins', () => {
      const mockPlugin = vi.fn((w: World) => w);
      world.addPlugin(mockPlugin);
      expect(mockPlugin).toHaveBeenCalledWith(world);
    });

    it('should handle async plugins', async () => {
      const mockPlugin = vi.fn(async (w: World) => {
        await Promise.resolve();
        return w;
      });
      world.addPlugin(mockPlugin);
      await world.prepare();
      expect(mockPlugin).toHaveBeenCalledWith(world);
    });

    it('should chain multiple plugins', () => {
      const plugin1 = vi.fn((w: World) => w);
      const plugin2 = vi.fn((w: World) => w);

      world.addPlugin(plugin1).addPlugin(plugin2);

      expect(plugin1).toHaveBeenCalledWith(world);
      expect(plugin2).toHaveBeenCalledWith(world);
    });
  });

  describe('Resource System', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should handle async resource initialization', async () => {
      class AsyncResource {
        static async fromWorld() {
          await Promise.resolve();
          return new AsyncResource();
        }
      }

      const resource = await world.getResource(AsyncResource);
      expect(resource).toBeInstanceOf(AsyncResource);
    });

    it('should throw on undefined fromWorld result', async () => {
      class BadResource {
        static async fromWorld() {
          return undefined;
        }
      }

      await expect(world.getResource(BadResource)).rejects.toThrow();
    });

    it('should handle multiple resource types', async () => {
      class Resource1 {}
      class Resource2 {}

      const r1 = await world.getResource(Resource1);
      const r2 = await world.getResource(Resource2);

      expect(r1).toBeInstanceOf(Resource1);
      expect(r2).toBeInstanceOf(Resource2);
      expect(world.resources).toHaveLength(2);
    });
  });

  describe('Event System Edge Cases', () => {
    let world: World;

    beforeEach(() => {
      world = new World();
    });

    it('should handle removing non-existent listener', () => {
      const listener = vi.fn();
      expect(() => {
        world.removeEventListener('start', listener);
      }).not.toThrow();
    });

    it('should handle multiple identical listeners', () => {
      const listener = vi.fn();
      world.addEventListener('start', listener);
      world.addEventListener('start', listener);

      world.start();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should handle removing listener during event emission', () => {
      const listener1 = vi.fn(() => {
        world.removeEventListener('start', listener2);
      });
      const listener2 = vi.fn();

      world.addEventListener('start', listener1);
      world.addEventListener('start', listener2);

      world.start();
      expect(listener1).toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });
});
