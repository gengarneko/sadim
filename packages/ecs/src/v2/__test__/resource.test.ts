import {beforeEach, describe, expect, it, vi} from 'vitest';

import {Local, Res} from '../resource';
import {World} from '../world';

describe('Resource', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('Global Resources (Res)', () => {
    class GameSettings {
      difficulty: number = 1;
      soundEnabled: boolean = true;
    }

    it('should retrieve existing resource', async () => {
      const settings = new GameSettings();
      world.insertResource(settings);

      const result = await Res.intoArgument(world, GameSettings);
      expect(result).toBe(settings);
    });

    it('should create new resource if not exists', async () => {
      const result = await Res.intoArgument(world, GameSettings);
      expect(result).toBeInstanceOf(GameSettings);
    });

    it('should maintain singleton nature', async () => {
      const result1 = await Res.intoArgument(world, GameSettings);
      const result2 = await Res.intoArgument(world, GameSettings);
      expect(result1).toBe(result2);
    });

    it('should preserve resource state', async () => {
      const result = (await Res.intoArgument(
        world,
        GameSettings,
      )) as GameSettings;
      result.difficulty = 2;

      const retrieved = (await Res.intoArgument(
        world,
        GameSettings,
      )) as GameSettings;
      expect(retrieved.difficulty).toBe(2);
    });
  });

  describe('Local Resources (Local)', () => {
    class BasicTimer {
      lastSpawn: number = 0;
    }

    class CustomTimer {
      lastSpawn: number = 0;
      static fromWorld(world: World) {
        const timer = new CustomTimer();
        timer.lastSpawn = 100;
        return timer;
      }
    }

    class AsyncTimer {
      lastSpawn: number = 0;
      static async fromWorld(world: World) {
        const timer = new AsyncTimer();
        timer.lastSpawn = 200;
        return timer;
      }
    }

    it('should create new instance without fromWorld', async () => {
      const result = await Local.intoArgument(world, BasicTimer);
      expect(result).toBeInstanceOf(BasicTimer);
      expect(result.lastSpawn).toBe(0);
    });

    it('should use static fromWorld when available', async () => {
      const result = await Local.intoArgument(world, CustomTimer);
      expect(result).toBeInstanceOf(CustomTimer);
      expect(result.lastSpawn).toBe(100);
    });

    it('should handle async fromWorld', async () => {
      const result = await Local.intoArgument(world, AsyncTimer);
      expect(result).toBeInstanceOf(AsyncTimer);
      expect(result.lastSpawn).toBe(200);
    });

    it('should create independent instances', async () => {
      const result1 = await Local.intoArgument(world, BasicTimer);
      const result2 = await Local.intoArgument(world, BasicTimer);

      expect(result1).not.toBe(result2);
      expect(result1).toBeInstanceOf(BasicTimer);
      expect(result2).toBeInstanceOf(BasicTimer);
    });

    it('should maintain independent state', async () => {
      const timer1 = (await Local.intoArgument(
        world,
        BasicTimer,
      )) as BasicTimer;
      const timer2 = (await Local.intoArgument(
        world,
        BasicTimer,
      )) as BasicTimer;

      timer1.lastSpawn = 100;
      timer2.lastSpawn = 200;

      expect(timer1.lastSpawn).toBe(100);
      expect(timer2.lastSpawn).toBe(200);
    });

    it('should throw when fromWorld returns undefined', async () => {
      class InvalidTimer {
        static fromWorld() {
          return undefined;
        }
      }

      await expect(Local.intoArgument(world, InvalidTimer)).rejects.toThrow(
        'Resource.fromWorld must return an object',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle async fromWorld initialization', async () => {
      class AsyncResource {
        value: number = 0;
        static async fromWorld() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          const resource = new AsyncResource();
          resource.value = 42;
          return resource;
        }
      }

      const result = (await Local.intoArgument(
        world,
        AsyncResource,
      )) as AsyncResource;
      expect(result.value).toBe(42);
    });

    it('should handle resource inheritance', async () => {
      class BaseResource {
        baseValue: number = 1;
      }

      class DerivedResource extends BaseResource {
        derivedValue: number = 2;
      }

      const result = (await Res.intoArgument(
        world,
        DerivedResource,
      )) as DerivedResource;
      expect(result.baseValue).toBe(1);
      expect(result.derivedValue).toBe(2);
    });

    it('should handle multiple resource types', async () => {
      class Resource1 {
        value = 1;
      }
      class Resource2 {
        value = 2;
      }

      const res1 = await Res.intoArgument(world, Resource1);
      const res2 = await Res.intoArgument(world, Resource2);

      expect(res1).toBeInstanceOf(Resource1);
      expect(res2).toBeInstanceOf(Resource2);
    });

    it('should handle resource replacement', async () => {
      class GameState {
        score: number = 0;
      }

      const original = new GameState();
      original.score = 100;
      world.insertResource(original);

      const replacement = new GameState();
      replacement.score = 200;
      world.insertResource(replacement);

      const result = (await Res.intoArgument(world, GameState)) as GameState;
      expect(result.score).toBe(200);
    });
  });
});
