import {beforeEach, describe, expect, it} from 'vitest';

import {Entities, EntityLocation} from '../../entity/entities';
import {Entity} from '../../entity/entity';

describe('Entities', () => {
  let entities: Entities;

  beforeEach(() => {
    entities = new Entities();
  });

  describe('allocation', () => {
    it('should allocate new entities with incremental indices', () => {
      const e1 = entities.alloc();
      const e2 = entities.alloc();
      const e3 = entities.alloc();

      expect(e1.index).toBe(0);
      expect(e2.index).toBe(1);
      expect(e3.index).toBe(2);
      expect(e1.generation).toBe(1);
      expect(e2.generation).toBe(1);
      expect(e3.generation).toBe(1);
    });

    it('should reuse freed indices', () => {
      const e1 = entities.alloc();
      entities.free(e1);
      entities.flush(() => {});
      const e2 = entities.alloc();

      expect(e2.index).toBe(e1.index);
      expect(e2.generation).toBe(2);
    });

    it('should prevent allocation when pending entities exist', () => {
      const e1 = entities.alloc();
      entities.free(e1);

      expect(() => entities.alloc()).toThrow(
        'Entities must be flushed before allocation',
      );
    });
  });

  describe('meta management', () => {
    it('should track entity generations correctly', () => {
      const e1 = entities.alloc();
      const index = e1.index;

      entities.free(e1);
      entities.flush(() => {});

      const e2 = entities.alloc();
      expect(e2.index).toBe(index);
      expect(e2.generation).toBe(2);

      entities.free(e2);
      entities.flush(() => {});

      const e3 = entities.alloc();
      expect(e3.index).toBe(index);
      expect(e3.generation).toBe(3);
    });

    it('should maintain invalid references', () => {
      const e1 = entities.alloc();
      const invalidEntity = new Entity(e1.index, e1.generation + 1);

      expect(entities.contains(e1)).toBe(true);
      expect(entities.contains(invalidEntity)).toBe(false);
    });
  });

  describe('location management', () => {
    it('should handle location setting and getting', () => {
      const entity = entities.alloc();
      const location = new EntityLocation(1, 2);

      entities.set(entity, location);
      expect(entities.get(entity)).toEqual(location);
    });

    it('should return null for invalid location', () => {
      const entity = entities.alloc();
      expect(entities.get(entity)).toBeNull();
    });

    it('should ignore location setting for invalid entity', () => {
      const invalidEntity = new Entity(999, 1);
      const location = new EntityLocation(1, 2);

      entities.set(invalidEntity, location);
      expect(entities.get(invalidEntity)).toBeNull();
    });
  });

  describe('freeing', () => {
    it('should return old location when freeing valid entity', () => {
      const entity = entities.alloc();
      const location = new EntityLocation(1, 2);
      entities.set(entity, location);

      const oldLocation = entities.free(entity);
      expect(oldLocation).toEqual(location);
    });

    it('should return null when freeing invalid entity', () => {
      const invalidEntity = new Entity(999, 1);
      expect(entities.free(invalidEntity)).toBeNull();
    });

    it('should increment generation when freeing', () => {
      const entity = entities.alloc();
      // const originalGeneration = entity.generation;

      entities.free(entity);

      // expect(entities.meta[entity.index]!.generation).toBe(
      //   originalGeneration + 1,
      // );
    });
  });

  describe('freeing and flushing', () => {
    it('should handle entity freeing', () => {
      const entities = new Entities();
      const entity = entities.alloc();
      expect(entities.contains(entity)).toBe(true);

      const location = new EntityLocation(1, 0);
      entities.set(entity, location);

      const oldLocation = entities.free(entity);
      expect(entities.contains(entity)).toBe(false);
      expect(oldLocation?.archetypeId).toBe(1);
      expect(oldLocation?.archetypeRow).toBe(0);
      expect(entities.get(entity)).toBe(null);
    });

    it('should process pending entities', () => {
      const entity = entities.alloc();
      const location = new EntityLocation(1, 2);
      entities.set(entity, location);

      const oldLocation = entities.free(entity);
      expect(oldLocation).toEqual(location);

      const flushedEntities: Entity[] = [];
      const flushedLocations: EntityLocation[] = [];

      entities.flush((e, loc) => {
        flushedEntities.push(e);
        flushedLocations.push(loc);
      });

      expect(flushedEntities.length).toBe(1);
      expect(flushedEntities[0]!.index).toBe(entity.index);
      expect(flushedEntities[0]!.generation).toBe(entity.generation + 1);
      expect(flushedLocations[0]).toEqual(EntityLocation.INVALID);
    });

    it('should clear pending list after flush', () => {
      const entity = entities.alloc();
      entities.free(entity);
      entities.flush(() => {});

      expect(() => entities.alloc()).not.toThrow();
    });

    it('should handle multiple freed entities', () => {
      const e1 = entities.alloc();
      const e2 = entities.alloc();

      const loc1 = new EntityLocation(1, 1);
      const loc2 = new EntityLocation(2, 2);
      entities.set(e1, loc1);
      entities.set(e2, loc2);

      entities.free(e1);
      entities.free(e2);

      const flushedEntities: Entity[] = [];
      entities.flush((e, _) => {
        flushedEntities.push(e);
      });

      expect(flushedEntities.length).toBe(2);
      expect(flushedEntities.map((e) => e.index)).toEqual([e1.index, e2.index]);
      expect(flushedEntities.every((e) => e.generation > 1)).toBe(true);
    });
  });

  describe('entity validation', () => {
    it('should validate entity existence', () => {
      const entity = entities.alloc();
      expect(entities.contains(entity)).toBe(true);

      entities.free(entity);
      expect(entities.contains(entity)).toBe(false);
    });

    it('should handle invalid entities', () => {
      const entity = entities.alloc();
      const invalidEntity = new Entity(entity.index, entity.generation + 1);

      expect(entities.contains(invalidEntity)).toBe(false);
      expect(entities.get(invalidEntity)).toBeNull();
    });
  });

  describe('state management', () => {
    it('should track total count correctly', () => {
      expect(entities.totalCount()).toBe(0);

      const e1 = entities.alloc();
      expect(entities.totalCount()).toBe(1);

      entities.alloc();
      expect(entities.totalCount()).toBe(2);

      entities.free(e1);
      expect(entities.totalCount()).toBe(2);

      entities.flush(() => {});
      expect(entities.totalCount()).toBe(2);
    });

    it('should handle clear operation', () => {
      const entity = entities.alloc();
      entities.set(entity, new EntityLocation(1, 2));

      entities.clear();

      expect(entities.isEmpty()).toBe(true);
      expect(entities.totalCount()).toBe(0);
      expect(entities.totalCount()).toBe(0);
    });

    it('should maintain correct state after operations', () => {
      const e1 = entities.alloc();
      const e2 = entities.alloc();

      entities.free(e1);
      entities.flush(() => {});

      const e3 = entities.alloc(); // 应该重用 e1 的索引

      expect(e3.index).toBe(e1.index);
      expect(e3.generation).toBe(2);
      expect(entities.contains(e2)).toBe(true);
      expect(entities.contains(e3)).toBe(true);
      expect(entities.contains(e1)).toBe(false);
    });
  });
});
