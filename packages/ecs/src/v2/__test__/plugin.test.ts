import type {Plugin} from '../plugin';
import type {System} from '../system';

import {beforeEach, describe, expect, it, vi} from 'vitest';

import {Schedule} from '../schedule';
import {World} from '../world';

describe('Plugin Module', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('Synchronous Plugins', () => {
    it('should execute sync plugin', () => {
      const mockFn = vi.fn();
      const syncPlugin: Plugin = (world) => {
        mockFn();
      };

      world.addPlugin(syncPlugin);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should add systems to schedule', () => {
      class TestSchedule extends Schedule {}
      const testSystem = (() => {}) as System;

      const syncPlugin: Plugin = (world) => {
        world.addSystem(TestSchedule, testSystem);
      };

      world.addPlugin(syncPlugin);
      expect(world.schedules.get(TestSchedule)?._systems).toContain(testSystem);
    });

    it('should register multiple systems', () => {
      class TestSchedule extends Schedule {}
      const system1 = (() => {}) as System;
      const system2 = (() => {}) as System;

      const syncPlugin: Plugin = (world) => {
        world.addSystems(TestSchedule, [system1, system2]);
      };

      world.addPlugin(syncPlugin);
      const schedule = world.schedules.get(TestSchedule);
      expect(schedule?._systems).toContain(system1);
      expect(schedule?._systems).toContain(system2);
    });

    it('should set up event listeners', () => {
      const mockListener = vi.fn();
      const syncPlugin: Plugin = (world) => {
        world.addEventListener('start', mockListener);
      };

      world.addPlugin(syncPlugin);
      world.start();
      expect(mockListener).toHaveBeenCalledWith(world);
    });
  });

  describe('Asynchronous Plugins', () => {
    it('should execute async plugin', async () => {
      const mockFn = vi.fn();
      const asyncPlugin: Plugin = async (world) => {
        await Promise.resolve();
        mockFn();
      };

      await world.addPlugin(asyncPlugin).prepare();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle async resource initialization', async () => {
      class TestResource {
        value: number = 0;
      }

      const asyncPlugin: Plugin = async (world) => {
        const resource = new TestResource();
        await new Promise((resolve) => setTimeout(resolve, 10));
        resource.value = 42;
        world.insertResource(resource);
      };

      await world.addPlugin(asyncPlugin).prepare();
      const result = await world.getResource(TestResource);
      expect(result).toBeDefined();
      expect(result?.value).toBe(42);
    });

    it('should handle multiple async plugins', async () => {
      const order: number[] = [];

      const plugin1: Plugin = async () => {
        await Promise.resolve();
        order.push(1);
      };

      const plugin2: Plugin = async () => {
        await Promise.resolve();
        order.push(2);
      };

      await world.addPlugin(plugin1).addPlugin(plugin2).prepare();

      expect(order).toEqual([1, 2]);
    });

    it('should handle plugin errors', async () => {
      const errorPlugin: Plugin = async () => {
        throw new Error('Plugin error');
      };

      await expect(world.addPlugin(errorPlugin).prepare()).rejects.toThrow(
        'Plugin error',
      );
    });
  });

  describe('Complex Plugin Scenarios', () => {
    it('should handle plugin dependencies', async () => {
      class SharedResource {
        value: string = '';
      }

      const basePlugin: Plugin = (world) => {
        const resource = new SharedResource();
        resource.value = 'base';
        world.insertResource(resource);
      };

      const dependentPlugin: Plugin = async (world) => {
        const resource = await world.getResource(SharedResource);
        resource.value += '-dependent';
      };

      await world.addPlugin(basePlugin).addPlugin(dependentPlugin).prepare();

      const resource = await world.getResource(SharedResource);
      expect(resource.value).toBe('base-dependent');
    });

    it('should handle mixed sync and async plugins', async () => {
      const order: number[] = [];

      const syncPlugin: Plugin = () => {
        order.push(1);
      };

      const asyncPlugin: Plugin = async () => {
        await Promise.resolve();
        order.push(2);
      };

      await world.addPlugin(syncPlugin).addPlugin(asyncPlugin).prepare();

      expect(order).toEqual([1, 2]);
    });

    it('should support plugin composition', async () => {
      const subPlugin: Plugin = (world) => {
        world.addEventListener('start', () => {});
      };

      const mainPlugin: Plugin = (world) => {
        world.addPlugin(subPlugin);
      };

      await expect(
        world.addPlugin(mainPlugin).prepare(),
      ).resolves.toBeDefined();
    });

    it('should maintain world state across plugins', async () => {
      class GameState {
        count: number = 0;
      }

      const plugin1: Plugin = (world) => {
        const state = new GameState();
        world.insertResource(state);
      };

      const plugin2: Plugin = async (world) => {
        const state = await world.getResource(GameState);
        state.count += 1;
      };

      const plugin3: Plugin = async (world) => {
        const state = await world.getResource(GameState);
        state.count += 2;
      };

      await world
        .addPlugin(plugin1)
        .addPlugin(plugin2)
        .addPlugin(plugin3)
        .prepare();

      const finalState = await world.getResource(GameState);
      expect(finalState.count).toBe(3);
    });
  });
});
