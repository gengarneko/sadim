import {describe, expect, it} from 'vitest';

import {Entity} from '../entity';
import {createTable, Table} from '../table';
// import {Tag} from '../Tag';
import {World} from '../world';
import {Vec3} from './_helpers';

const addToTable = (table: Table, entity: Entity, ...components: object[]) => {
  table.getColumn(Entity).push(entity);
  for (const component of components) {
    table.getColumn(component.constructor as any).push(component);
  }
};

describe('Table', () => {
  describe('basic operations', () => {
    it('should create an empty table', () => {
      const table = createTable([Entity]);
      expect(table.length).toBe(0);
      expect(table.hasColumn(Entity)).toBe(true);
      expect(table.id).toBeGreaterThanOrEqual(0);
      expect(typeof table.archetype).toBe('bigint');
    });

    it('should get correct column data', () => {
      const table = createTable([Entity, Vec3]);
      const entityColumn = table.getColumn(Entity);
      const vec3Column = table.getColumn(Vec3);

      expect(Array.isArray(entityColumn)).toBe(true);
      expect(Array.isArray(vec3Column)).toBe(true);
      expect(entityColumn.length).toBe(0);
      expect(vec3Column.length).toBe(0);
    });

    it('should correctly handle multi-component tables', () => {
      const table = createTable([Entity, Vec3]);
      expect(table.hasColumn(Entity)).toBe(true);
      expect(table.hasColumn(Vec3)).toBe(true);
      expect(table.hasColumn(World)).toBe(false);
    });

    it('adds an element', async () => {
      const world = new World();
      const table = createTable([Entity]);
      expect(table.length).toBe(0);

      addToTable(table, new Entity(world.entities, 0));
      expect(table.length).toBe(1);

      const entityColumn = table.getColumn(Entity);
      expect(entityColumn[0]!.id).toBe(0);

      addToTable(table, new Entity(world.entities, 3));
      expect(table.length).toBe(2);

      expect(entityColumn[0]!.id).toBe(0);
      expect(entityColumn[1]!.id).toBe(3);

      const e1 = new Entity(world.entities, 4);
      const e2 = new Entity(world.entities, 5);
      addToTable(table, e1);
      addToTable(table, e2);

      expect(entityColumn[2]).toBe(e1);
      expect(entityColumn[3]).toBe(e2);
    });
  });

  describe('getRow operations', () => {
    it('should return all components for a valid row', () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);
      const entity = new Entity(world.entities, 1);
      const vec3 = new Vec3(1, 2, 3);

      addToTable(table, entity, vec3);

      const row = table.getRow(0);
      expect(row.length).toBe(2);
      expect(row[0]).toBe(entity);
      expect(row[1]).toBe(vec3);
    });

    it('should return an empty array for an invalid row', () => {
      const table = createTable([Entity, Vec3]);
      expect(table.getRow(-1)).toEqual([]);
      expect(table.getRow(999)).toEqual([]);
    });

    it('should handle non-existent column access', () => {
      const table = createTable([Entity]);
      expect(() => table.getColumn(Vec3)).not.toThrow();
      expect(table.getColumn(Vec3)).toBeUndefined();
    });

    it('should maintain the length consistency of all columns', () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);
      const entity = new Entity(world.entities, 1);
      const vec3 = new Vec3(1, 2, 3);

      addToTable(table, entity, vec3);

      const entityColumn = table.getColumn(Entity);
      const vec3Column = table.getColumn(Vec3);
      expect(entityColumn.length).toBe(vec3Column.length);
      expect(table.length).toBe(entityColumn.length);
    });
  });

  describe('move operations', () => {
    it('should keep other components unchanged when updating a component within the same table', () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);
      const entity = new Entity(world.entities, 1);
      const oldVec3 = new Vec3(1, 2, 3);

      addToTable(table, entity, oldVec3);

      const newVec3 = new Vec3(4, 5, 6);
      table.move(0, table, [newVec3]);

      const vec3Column = table.getColumn(Vec3);
      expect(vec3Column[0]).toBe(newVec3);
      expect(table.getColumn(Entity)[0]).toBe(entity);
    });

    it('should correctly handle component subsets when moving across tables', () => {
      const world = new World();
      const sourceTable = createTable([Entity, Vec3]);
      const targetTable = createTable([Entity]);

      const entity = new Entity(world.entities, 1);
      const vec3 = new Vec3(1, 2, 3);

      addToTable(sourceTable, entity, vec3);
      sourceTable.move(0, targetTable, []);

      expect(sourceTable.length).toBe(0);
      expect(targetTable.length).toBe(1);
      expect(targetTable.getColumn(Entity)[0]).toBe(entity);
      expect(targetTable.hasColumn(Vec3)).toBe(false);
    });

    it('moves elements from one table to another', async () => {
      const world = new World();
      const fromTable = createTable([Entity, Vec3]);
      const toTable = createTable([Entity, Vec3]);

      addToTable(fromTable, new Entity(world.entities, 3), new Vec3(1, 2, 3));
      addToTable(fromTable, new Entity(world.entities, 1), new Vec3(7, 8, 9));
      addToTable(toTable, new Entity(world.entities, 4), new Vec3(0, 0, 0));

      expect(fromTable.length).toBe(2);
      expect(toTable.length).toBe(1);

      const fromTableEntityColumn = fromTable.getColumn(Entity);
      expect(fromTableEntityColumn[0]?.id).toBe(3);

      const fromTableVec3Column = fromTable.getColumn(Vec3);
      const toTableVec3Column = toTable.getColumn(Vec3);

      fromTable.move(0, toTable, []);
      expect(fromTable.length).toBe(1);
      expect(toTable.length).toBe(2);

      let v3 = toTableVec3Column[1]!;
      expect(v3.x).toBe(1);
      expect(v3.y).toBe(2);
      expect(v3.z).toBe(3);

      expect(fromTableEntityColumn[0]?.id).toBe(1);
      v3 = fromTableVec3Column[0]!;
      expect(v3.x).toBe(7);
      expect(v3.y).toBe(8);
      expect(v3.z).toBe(9);
    });

    it('should handle combined operations of component updates and moves', () => {
      const world = new World();
      const sourceTable = createTable([Entity, Vec3]);
      const targetTable = createTable([Entity, Vec3]);

      const entity = new Entity(world.entities, 1);
      const oldVec3 = new Vec3(1, 2, 3);
      const newVec3 = new Vec3(4, 5, 6);

      addToTable(sourceTable, entity, oldVec3);

      sourceTable.move(0, targetTable, [newVec3]);

      expect(sourceTable.length).toBe(0);
      expect(targetTable.length).toBe(1);
      expect(targetTable.getColumn(Vec3)[0]).toBe(newVec3);
    });

    it('should handle batch moves of multiple entities', () => {
      const world = new World();
      const sourceTable = createTable([Entity, Vec3]);
      const targetTable = createTable([Entity, Vec3]);

      for (let i = 0; i < 5; i++) {
        addToTable(
          sourceTable,
          new Entity(world.entities, i),
          new Vec3(i, i, i),
        );
      }

      for (let i = 0; i < 5; i++) {
        sourceTable.move(0, targetTable, []);
        expect(sourceTable.length).toBe(4 - i);
        expect(targetTable.length).toBe(i + 1);
      }
    });
  });

  describe('edge cases', () => {
    it('should not trigger backfill when moving the last entity', () => {
      const world = new World();
      const sourceTable = createTable([Entity]);
      const targetTable = createTable([Entity]);

      const entity = new Entity(world.entities, 1);
      addToTable(sourceTable, entity);

      sourceTable.move(0, targetTable, []);

      expect(sourceTable.length).toBe(0);
      expect(targetTable.length).toBe(1);
    });

    it('should not crash when handling invalid component types', () => {
      const table = createTable([Entity]);
      expect(() => {
        table.hasColumn(null as any);
      }).not.toThrow();

      expect(() => {
        table.getColumn(undefined as any);
      }).not.toThrow();
    });

    it('deletes elements, swaps in last elements', async () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);

      addToTable(table, new Entity(world.entities, 1));
      addToTable(table, new Entity(world.entities, 2));
      addToTable(table, new Entity(world.entities, 3));
      addToTable(table, new Entity(world.entities, 4));
      expect(table.length).toBe(4);

      const entityColumn = table.getColumn(Entity);
      const vecColumn = table.getColumn(Vec3);
      vecColumn.push(
        new Vec3(1, 2, 3),
        new Vec3(4, 5, 6),
        new Vec3(7, 8, 9),
        new Vec3(10, 11, 12),
      );

      table.move(1, createTable(), []);
      expect(table.length).toBe(3);
      expect(entityColumn[0]!.id).toBe(1);
      expect(vecColumn[0]!.x).toBe(1);
      expect(vecColumn[0]!.y).toBe(2);
      expect(vecColumn[0]!.z).toBe(3);
      expect(entityColumn[1]!.id).toBe(4);
      expect(vecColumn[1]!.x).toBe(10);
      expect(vecColumn[1]!.y).toBe(11);
      expect(vecColumn[1]!.z).toBe(12);
      expect(entityColumn[2]!.id).toBe(3);
      expect(vecColumn[2]!.x).toBe(7);
      expect(vecColumn[2]!.y).toBe(8);
      expect(vecColumn[2]!.z).toBe(9);
    });

    it('backfills elements for all stores', async () => {
      const world = new World();
      const fromTable = createTable([Entity, Vec3]);
      const toTable = createTable([Entity]);
      const fromTableEntityColumn = fromTable.getColumn(Entity);
      const fromTableVec3Column = fromTable.getColumn(Vec3);
      const toTableEntityColumn = toTable.getColumn(Entity);

      addToTable(fromTable, new Entity(world.entities, 3));
      addToTable(fromTable, new Entity(world.entities, 0));
      addToTable(toTable, new Entity(world.entities, 4));

      expect(fromTable.length).toBe(2);
      expect(toTable.length).toBe(1);
      expect(fromTableEntityColumn[0]!.id).toBe(3);

      fromTableVec3Column.push(new Vec3(1, 2, 3), new Vec3(7, 8, 9));
      fromTable.move(0, toTable, []);

      expect(toTableEntityColumn[1]!.id).toBe(3);
      expect(fromTableEntityColumn[0]!.id).toBe(0);
      expect(fromTableVec3Column[0]!.x).toBe(7);
      expect(fromTableVec3Column[0]!.y).toBe(8);
      expect(fromTableVec3Column[0]!.z).toBe(9);
    });

    it('should handle empty component arrays', () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);
      const entity = new Entity(world.entities, 1);
      const vec3 = new Vec3(1, 2, 3);

      addToTable(table, entity, vec3);
      expect(() => table.move(0, table, [])).not.toThrow();
    });

    it('should handle invalid move operations', () => {
      const table = createTable([Entity]);
      expect(() => table.move(-1, table, [])).not.toThrow();
      expect(() => table.move(999, table, [])).not.toThrow();
    });

    it('should handle mismatched component types', () => {
      const world = new World();
      const sourceTable = createTable([Entity, Vec3]);
      const targetTable = createTable([Entity]);

      const entity = new Entity(world.entities, 1);
      const vec3 = new Vec3(1, 2, 3);

      addToTable(sourceTable, entity, vec3);

      sourceTable.move(0, targetTable, [new Vec3(4, 5, 6)]);
      expect(targetTable.getColumn(Vec3)).toBeUndefined();
    });
  });

  describe('performance tests', () => {
    const SMALL_COUNT = 1_000;
    const MEDIUM_COUNT = 10_000;
    const LARGE_COUNT = 100_000;
    const PERFORMANCE_TIMEOUT = 100; // 100ms

    it('should handle large entity moves efficiently', () => {
      const world = new World();
      const sourceTable = createTable([Entity, Vec3]);
      const targetTable = createTable([Entity, Vec3]);

      const startTime = performance.now();

      for (let i = 0; i < LARGE_COUNT; i++) {
        addToTable(
          sourceTable,
          new Entity(world.entities, i),
          new Vec3(i, i, i),
        );
      }

      for (let i = 0; i < LARGE_COUNT; i++) {
        sourceTable.move(0, targetTable, []);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    it('should handle batch component updates efficiently', () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);

      // 预填充数据
      for (let i = 0; i < MEDIUM_COUNT; i++) {
        addToTable(table, new Entity(world.entities, i), new Vec3(i, i, i));
      }

      const startTime = performance.now();

      // 批量更新所有Vec3组件
      for (let i = 0; i < MEDIUM_COUNT; i++) {
        table.move(i, table, [new Vec3(i * 2, i * 2, i * 2)]);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    it('should handle frequent table-to-table entity moves efficiently', () => {
      const world = new World();
      const tables = [
        createTable([Entity, Vec3]),
        createTable([Entity, Vec3]),
        createTable([Entity, Vec3]),
        createTable([Entity, Vec3]),
      ];

      for (let i = 0; i < SMALL_COUNT; i++) {
        addToTable(
          tables[0]!,
          new Entity(world.entities, i),
          new Vec3(i, i, i),
        );
      }

      const startTime = performance.now();

      for (let i = 0; i < SMALL_COUNT; i++) {
        for (let j = 0; j < tables.length - 1; j++) {
          tables[j]!.move(0, tables[j + 1]!, []);
        }
        tables[tables.length - 1]!.move(0, tables[0]!, []);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    it('should handle large random accesses efficiently', () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);

      // 预填充数据
      for (let i = 0; i < MEDIUM_COUNT; i++) {
        addToTable(table, new Entity(world.entities, i), new Vec3(i, i, i));
      }

      const startTime = performance.now();

      // 随机访问组件
      for (let i = 0; i < MEDIUM_COUNT; i++) {
        const randomIndex = Math.floor(Math.random() * MEDIUM_COUNT);
        const row = table.getRow(randomIndex);
        expect(row.length).toBe(2);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    it('should handle mixed operations efficiently', () => {
      const world = new World();
      const sourceTable = createTable([Entity, Vec3]);
      const targetTable = createTable([Entity, Vec3]);

      const startTime = performance.now();

      // 混合添加、移动和更新操作
      for (let i = 0; i < SMALL_COUNT; i++) {
        // 添加
        addToTable(
          sourceTable,
          new Entity(world.entities, i),
          new Vec3(i, i, i),
        );

        // 随机决定是移动还是更新
        if (Math.random() > 0.5) {
          sourceTable.move(0, targetTable, []);
        } else {
          sourceTable.move(0, sourceTable, [new Vec3(i * 2, i * 2, i * 2)]);
        }

        // 随机访问
        if (i % 10 === 0) {
          const randomTable = Math.random() > 0.5 ? sourceTable : targetTable;
          const maxIndex = randomTable.length - 1;
          if (maxIndex >= 0) {
            const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
            const row = randomTable.getRow(randomIndex);
            expect(row.length).toBeGreaterThan(0);
          }
        }
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_TIMEOUT);
    });

    // TODO
    it('should maintain memory stability under large data scales', () => {
      const world = new World();
      const table = createTable([Entity, Vec3]);

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < LARGE_COUNT; i++) {
        addToTable(table, new Entity(world.entities, i), new Vec3(i, i, i));
      }

      const table2 = createTable([Entity]);
      for (let i = 0; i < LARGE_COUNT / 2; i++) {
        table.move(0, table2, []);
      }

      for (let i = 0; i < LARGE_COUNT / 2; i++) {
        addToTable(
          table,
          new Entity(world.entities, i + LARGE_COUNT),
          new Vec3(i, i, i),
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      const expectedMaxMemory = LARGE_COUNT * 300; // 18140288
      expect(memoryIncrease).toBeLessThan(expectedMaxMemory);
    });
  });
});

// it('does not create columns for ZSTs', async () => {
//   class ZST extends Tag {}
//   const table = createTable(Entity, Vec3, ZST);
//   expect(table.hasColumn(ZST)).toBe(false);
// });
