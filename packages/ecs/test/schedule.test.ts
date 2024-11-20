import {beforeEach, describe, expect, it, vi} from 'vitest';

import {Schedule, System, World} from '../src';

describe('Schedule', () => {
  let world: World;
  let schedule: Schedule;

  const mockSystem1 = vi.fn() as System;
  const mockSystem2 = vi.fn() as System;

  beforeEach(() => {
    world = new World();
    schedule = new Schedule(world);
    vi.clearAllMocks();
  });

  describe('System Management', () => {
    describe('Adding Systems', () => {
      it('should add single system', () => {
        schedule.addSystems(mockSystem1);
        expect(schedule._systems).toContain(mockSystem1);
        expect(schedule._systems).toHaveLength(1);
      });

      it('should add multiple systems as array', () => {
        schedule.addSystems([mockSystem1, mockSystem2]);
        expect(schedule._systems).toContain(mockSystem1);
        expect(schedule._systems).toContain(mockSystem2);
        expect(schedule._systems).toHaveLength(2);
      });

      it('should maintain system order when adding multiple systems', () => {
        schedule.addSystems([mockSystem1, mockSystem2]);
        expect(schedule._systems[0]).toBe(mockSystem1);
        expect(schedule._systems[1]).toBe(mockSystem2);
      });

      it('should handle adding empty array of systems', () => {
        schedule.addSystems([]);
        expect(schedule._systems).toHaveLength(0);
      });

      it('should prevent adding duplicate systems', () => {
        schedule.addSystems(mockSystem1);
        expect(() => schedule.addSystems(mockSystem1)).toThrow();
      });

      it('should prevent adding duplicate systems in array', () => {
        expect(() => {
          schedule.addSystems([mockSystem1, mockSystem1]);
        }).toThrow();
      });
    });

    describe('Removing Systems', () => {
      beforeEach(() => {
        schedule.addSystems([mockSystem1, mockSystem2]);
      });

      it('should remove system', () => {
        schedule.removeSystem(mockSystem1);
        expect(schedule._systems).not.toContain(mockSystem1);
        expect(schedule._systems).toHaveLength(1);
      });

      it('should maintain remaining systems after removal', () => {
        schedule.removeSystem(mockSystem1);
        expect(schedule._systems).toContain(mockSystem2);
      });

      it('should throw when removing non-existent system', () => {
        const nonExistentSystem = vi.fn() as System;
        expect(() => schedule.removeSystem(nonExistentSystem)).toThrow();
      });

      it('should handle removing last system', () => {
        schedule.removeSystem(mockSystem1);
        schedule.removeSystem(mockSystem2);
        expect(schedule._systems).toHaveLength(0);
      });
    });

    describe('System Presence Check', () => {
      it('should correctly identify present system', () => {
        schedule.addSystems(mockSystem1);
        expect(schedule.hasSystem(mockSystem1)).toBe(true);
      });

      it('should correctly identify absent system', () => {
        expect(schedule.hasSystem(mockSystem1)).toBe(false);
      });

      it('should handle checking undefined/null', () => {
        // @ts-expect-error Testing invalid input
        expect(schedule.hasSystem(undefined)).toBe(false);
        // @ts-expect-error Testing invalid input
        expect(schedule.hasSystem(null)).toBe(false);
      });
    });
  });

  describe('System Execution', () => {
    describe('Basic Execution', () => {
      it('should run systems in order', async () => {
        const order: number[] = [];
        // @ts-expect-error Mock implementation
        const sys1 = vi.fn(() => order.push(1)) as System;
        // @ts-expect-error Mock implementation
        const sys2 = vi.fn(() => order.push(2)) as System;

        schedule.addSystems([sys1, sys2]);
        await schedule.run();
        expect(order).toEqual([1, 2]);
      });

      it('should pass empty args array when no args prepared', async () => {
        const spy = vi.fn() as System;
        schedule.addSystems(spy);
        await schedule.run();
        expect(spy).toHaveBeenCalledWith();
      });
    });

    describe('Async Behavior', () => {
      it('should handle async systems', async () => {
        let completed = false;
        const asyncSystem = vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          completed = true;
        }) as System;

        schedule.addSystems(asyncSystem);
        await schedule.run();
        expect(completed).toBe(true);
      });

      it('should wait for each system to complete before running next', async () => {
        const order: number[] = [];
        const slowSystem = vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          order.push(1);
        }) as System;
        // @ts-expect-error Mock implementation
        const fastSystem = vi.fn(() => order.push(2)) as System;

        schedule.addSystems([slowSystem, fastSystem]);
        await schedule.run();
        expect(order).toEqual([1, 2]);
      });
    });

    describe('Error Handling', () => {
      it('should handle system errors', async () => {
        const errorSystem = vi.fn(() => {
          throw new Error('System error');
        }) as System;

        schedule.addSystems(errorSystem);
        await expect(schedule.run()).rejects.toThrow('System error');
      });

      it('should stop execution on first error', async () => {
        const error = new Error('System error');
        const sys1 = vi.fn(() => {
          throw error;
        }) as System;
        const sys2 = vi.fn() as System;

        schedule.addSystems([sys1, sys2]);
        await expect(schedule.run()).rejects.toThrow(error);
        expect(sys2).not.toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty schedule', async () => {
      await expect(schedule.prepare()).resolves.toBeUndefined();
      await expect(schedule.run()).resolves.toBeUndefined();
    });

    it('should handle system removal during execution', async () => {
      const sys1 = vi.fn(() => {
        schedule.removeSystem(sys2);
      }) as System;
      const sys2 = vi.fn() as System;

      schedule.addSystems([sys1, sys2]);
      await schedule.run();
      expect(sys1).toHaveBeenCalled();
      expect(sys2).not.toHaveBeenCalled();
    });

    it('should handle adding system during execution', async () => {
      const newSystem = vi.fn() as System;
      const sys1 = vi.fn(() => {
        schedule.addSystems(newSystem);
      }) as System;

      schedule.addSystems(sys1);
      await schedule.run();
      expect(newSystem).toHaveBeenCalled();
    });

    it('should handle prepare() with no systems', async () => {
      await expect(schedule.prepare()).resolves.toBeUndefined();
      expect(schedule._args).toHaveLength(0);
    });

    it('should handle multiple prepare() calls', async () => {
      schedule.addSystems(mockSystem1);
      await schedule.prepare();
      await schedule.prepare();
      expect(schedule._args).toHaveLength(1);
    });

    describe('Runtime System Modifications', () => {
      it('should execute systems added during execution', async () => {
        const order: number[] = [];
        const newSystem = vi.fn(() => order.push(2)) as unknown as System;
        const sys1 = vi.fn(() => {
          order.push(1);
          schedule.addSystems(newSystem);
        }) as System;

        schedule.addSystems(sys1);
        await schedule.run();

        expect(order).toEqual([1, 2]);
        expect(newSystem).toHaveBeenCalled();
      });

      it('should execute systems in correct order when adding during execution', async () => {
        const order: number[] = [];
        const sys3 = vi.fn(() => order.push(3)) as unknown as System;
        const sys2 = vi.fn(() => {
          order.push(2);
          schedule.addSystems(sys3);
        }) as System;
        // @ts-expect-error Mock implementation
        const sys1 = vi.fn(() => order.push(1)) as System;

        schedule.addSystems([sys1, sys2]);
        await schedule.run();

        expect(order).toEqual([1, 2, 3]);
        expect(sys3).toHaveBeenCalled();
      });

      it('should handle multiple systems being added during execution', async () => {
        const order: number[] = [];
        // @ts-expect-error Mock implementation
        const sys3 = vi.fn(() => order.push(3)) as System;
        // @ts-expect-error Mock implementation
        const sys4 = vi.fn(() => order.push(4)) as System;
        const sys2 = vi.fn(() => {
          order.push(2);
          schedule.addSystems([sys3, sys4]);
        }) as System;
        // @ts-expect-error Mock implementation
        const sys1 = vi.fn(() => order.push(1)) as System;

        schedule.addSystems([sys1, sys2]);
        await schedule.run();

        expect(order).toEqual([1, 2, 3, 4]);
        expect(sys3).toHaveBeenCalled();
        expect(sys4).toHaveBeenCalled();
      });
    });
  });
});
