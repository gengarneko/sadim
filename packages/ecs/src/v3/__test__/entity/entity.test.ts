import {describe, expect, it} from 'vitest';

import {Entity} from '../../entity/entity';

describe('Entity', () => {
  describe('constructor', () => {
    it('should create valid entity', () => {
      const entity = new Entity(1, 1);
      expect(entity.index).toBe(1);
      expect(entity.generation).toBe(1);
    });

    it('should throw on invalid index', () => {
      expect(() => new Entity(-1, 1)).toThrow('Invalid entity index');
      expect(() => new Entity(0xffffffff + 1, 1)).toThrow(
        'Invalid entity index',
      );
    });

    it('should throw on invalid generation', () => {
      expect(() => new Entity(0, 0)).toThrow(
        "Entity's generation must be greater than 0",
      );
      expect(() => new Entity(0, -1)).toThrow(
        "Entity's generation must be greater than 0",
      );
    });
  });

  describe('static methods', () => {
    it('PLACEHOLDER should be valid', () => {
      expect(Entity.PLACEHOLDER.index).toBe(0xffffffff);
      expect(Entity.PLACEHOLDER.generation).toBe(1);
    });

    it('fromRaw should create entity with generation 1', () => {
      const entity = Entity.fromRaw(42);
      expect(entity.index).toBe(42);
      expect(entity.generation).toBe(1);
    });

    it('validate should check bounds', () => {
      expect(() => Entity.validate(0, 1)).not.toThrow();
      expect(() => Entity.validate(-1, 1)).toThrow();
      expect(() => Entity.validate(0, 0)).toThrow();
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize', () => {
      const original = new Entity(42, 7);
      const serialized = original.serialize();
      const deserialized = Entity.deserialize(serialized);

      expect(deserialized.equals(original)).toBe(true);
    });

    it('deserialize should validate data', () => {
      expect(() => Entity.deserialize('{"index":-1,"generation":1}')).toThrow();
      expect(() => Entity.deserialize('{"index":0,"generation":0}')).toThrow();
      expect(() => Entity.deserialize('invalid json')).toThrow();
      expect(() => Entity.deserialize('{"foo":"bar"}')).toThrow();
    });
  });

  describe('equality', () => {
    it('should compare entities correctly', () => {
      const e1 = new Entity(1, 1);
      const e2 = new Entity(1, 1);
      const e3 = new Entity(1, 2);
      const e4 = new Entity(2, 1);

      expect(e1.equals(e2)).toBe(true);
      expect(e1.equals(e3)).toBe(false);
      expect(e1.equals(e4)).toBe(false);
    });

    it('reference equality should work as expected', () => {
      const e1 = new Entity(1, 1);
      const e2 = new Entity(1, 1);
      const e3 = e1;

      expect(e1 === e2).toBe(false); // 不同实例
      expect(e1 === e3).toBe(true); // 相同引用
    });
  });

  describe('toString', () => {
    it('should format entity correctly', () => {
      const entity = new Entity(42, 7);
      expect(entity.toString()).toBe('42v7');
    });

    it('should handle PLACEHOLDER specially', () => {
      expect(Entity.PLACEHOLDER.toString()).toBe('PLACEHOLDER');
    });
  });

  describe('edge cases', () => {
    it('should handle maximum valid values', () => {
      expect(() => new Entity(0xffffffff, 1)).not.toThrow();
      expect(() => new Entity(0, Number.MAX_SAFE_INTEGER)).not.toThrow();
    });

    it('should handle minimum valid values', () => {
      expect(() => new Entity(0, 1)).not.toThrow();
    });
  });

  describe('immutability', () => {
    it('should not allow modification of properties', () => {
      const entity = new Entity(1, 1);

      // @ts-expect-error Property '#index' is not accessible
      expect(() => (entity.index = 2)).toThrow(TypeError);
      // @ts-expect-error Property '#generation' is not accessible
      expect(() => (entity.generation = 2)).toThrow(TypeError);

      expect(entity.index).toBe(1);
      expect(entity.generation).toBe(1);
    });
  });

  describe('type safety', () => {
    it('should handle invalid input types', () => {
      expect(() =>
        Entity.deserialize('{"index":"1","generation":1}'),
      ).toThrow();
      expect(() =>
        Entity.deserialize('{"index":1,"generation":"1"}'),
      ).toThrow();
    });
  });
});
