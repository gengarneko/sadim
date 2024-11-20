import {beforeEach, describe, expect, it, vi} from 'vitest';

import {cloneSystem, createSystem, System, World} from '../src';

describe('System', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  describe('System Definition', () => {
    it('should create basic system', () => {
      const system = vi.fn() as System;
      expect(typeof system).toBe('function');
    });

    it('should handle system with arguments', () => {
      const system = vi.fn((arg1: number, arg2: string) => {
        expect(arg1).toBe(1);
        expect(arg2).toBe('test');
      }) as System;

      system(1, 'test');
      expect(system).toHaveBeenCalledWith(1, 'test');
    });

    it('should handle async system', async () => {
      let completed = false;
      const system = vi.fn(async () => {
        await Promise.resolve();
        completed = true;
      }) as System;

      await system();
      expect(completed).toBe(true);
      expect(system).toHaveBeenCalled();
    });
  });

  describe('System Arguments', () => {
    it('should handle getSystemArguments', async () => {
      const system = vi.fn() as System;
      system.getSystemArguments = vi.fn((w: World) => {
        expect(w).toBe(world);
        return ['arg1', 'arg2'];
      });

      const args = system.getSystemArguments(world);
      expect(args).toEqual(['arg1', 'arg2']);
    });

    it('should handle system without getSystemArguments', () => {
      const system = vi.fn() as System;
      expect(system.getSystemArguments).toBeUndefined();
    });

    it('should handle empty arguments array', () => {
      const system = vi.fn() as System;
      system.getSystemArguments = vi.fn(() => []);
      expect(system.getSystemArguments(world)).toEqual([]);
    });
  });

  describe('System Cloning', () => {
    it('should clone basic system', () => {
      const original = (a: number) => (a + 1) as unknown as System;
      const cloned = cloneSystem(original as any);

      expect(cloned(1)).toBe(2);
    });

    it('should clone system with getSystemArguments', () => {
      const original = function () {} as System;
      original.getSystemArguments = () => ['test'];

      const cloned = cloneSystem(original);
      expect(cloned.getSystemArguments!(world)).toEqual(['test']);
    });

    it('should maintain system independence after cloning', async () => {
      let count = 0;
      const original = function () {
        count++;
      } as System;

      const cloned = cloneSystem(original);
      original();
      cloned();
      expect(count).toBe(2);
    });

    it('should handle async system cloning', async () => {
      let completed = false;
      const original = async function () {
        await Promise.resolve();
        completed = true;
      } as System;

      const cloned = cloneSystem(original);
      await cloned();
      expect(completed).toBe(true);
    });
  });

  describe('System Creation', () => {
    it('should create system entity', () => {
      const systemEntity = createSystem(world);
      expect(systemEntity).toBeDefined();
    });

    it('should create unique system entities', () => {
      const system1 = createSystem(world);
      const system2 = createSystem(world);
      expect(system1).not.toBe(system2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle system throwing error', () => {
      const system = vi.fn(() => {
        throw new Error('System error');
      }) as System;

      expect(() => system()).toThrow('System error');
    });

    it('should handle async system rejection', async () => {
      const system = vi.fn(async () => {
        throw new Error('Async error');
      }) as System;

      await expect(system()).rejects.toThrow('Async error');
    });

    // TODO
    // it('should handle system with modified prototype', () => {
    //   const system = vi.fn() as System;
    //   Object.setPrototypeOf(system, null);

    //   const cloned = cloneSystem(system);
    //   expect(() => cloned()).not.toThrow();
    // });

    it('should handle system with undefined arguments', () => {
      const system = vi.fn() as System;
      expect(() => system(undefined, null)).not.toThrow();
    });
  });

  describe('System Integration', () => {
    // it('should work with world queries', () => {
    //   const system = vi.fn((entities) => {
    //     expect(Array.isArray(entities)).toBe(true);
    //   }) as System;

    //   system.getSystemArguments = (w: World) => [w.query([])];
    //   const args = system.getSystemArguments(world);
    //   system(...args);
    //   expect(system).toHaveBeenCalled();
    // });

    it('should handle multiple system executions', () => {
      const system = vi.fn() as System;
      system(1);
      system(2);
      system(3);
      expect(system).toHaveBeenCalledTimes(3);
    });
  });
});
