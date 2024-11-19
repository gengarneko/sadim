import {beforeEach, describe, expect, it} from 'vitest';

import {Entities} from '../entity';
import {Query} from '../query';
import {World} from '../world';
import {Name, Position, Velocity} from './_helpers';

describe('Entity', () => {
  let world: World;
  let entities: Entities;
  beforeEach(() => {
    world = new World();
    entities = world.entities;
  });

  describe('Creation', () => {
    it('should create an basic entity', () => {
      const entity = entities.spawn();
      expect(entity.id).toBe(0);
    });

    it('should create multiple entities with unique ids', () => {
      const entity1 = entities.spawn();
      const entity2 = entities.spawn();
      const entity3 = entities.spawn();

      expect(entity1.id).toBe(0);
      expect(entity2.id).toBe(1);
      expect(entity3.id).toBe(2);
    });

    it('should create an entity with id', () => {
      const entity = entities.spawn([
        new Position(0, 0),
        new Velocity(0, 0),
        new Name('name1'),
      ]);

      entities.flush();

      expect(entity.has(Position)).toBeTruthy();
      expect(entity.has(Velocity)).toBeTruthy();
      expect(entity.has(Name)).toBeTruthy();
    });

    it('should create entity with multiple initial components', () => {
      const pos = new Position(1, 1);
      const vel = new Velocity(2, 2);
      const name = new Name('test');

      const entity = entities.spawn([pos, vel, name]);
      entities.flush();

      const components = entities.entity(entity);
      expect(components.find((c) => c === pos)).toBeTruthy();
      expect(components.find((c) => c === vel)).toBeTruthy();
      expect(components.find((c) => c === name)).toBeTruthy();
    });
  });

  describe('Component Operations', () => {
    describe('Insert', () => {
      it('should handle single component insert', () => {
        const entity = entities.spawn();
        entity.insert(new Position(1, 1));
        entities.flush();
        expect(entity.has(Position)).toBeTruthy();
      });

      it('should handle multiple component inserts', () => {
        const entity = entities.spawn();
        entity.insert(new Position(1, 1)).insert(new Velocity(1, 1));
        entities.flush();

        expect(entity.has(Position)).toBeTruthy();
        expect(entity.has(Velocity)).toBeTruthy();
      });

      it('should override previous component', () => {
        const entity = entities.spawn();
        const pos1 = new Position(1, 1);
        const pos2 = new Position(2, 2);

        entity.insert(pos1);
        entities.flush();
        expect(entity.has(Position)).toBeTruthy();

        entity.insert(pos2);
        entities.flush();

        const components = entities.entity(entity);
        expect(components.includes(pos2)).toBeTruthy();
        expect(components.includes(pos1)).toBeFalsy();
      });

      it('should override previous component in single flush', () => {
        const entity = entities.spawn();
        entity
          .insert(new Position(1, 1))
          .insert(new Position(2, 2))
          .insert(new Position(3, 3));

        entities.flush();

        const query = new Query<Position>(world, Position);
        for (const position of query) {
          expect(position.x).toBe(3);
          expect(position.y).toBe(3);
        }
      });

      it('should maintain component values after flush', () => {
        const entity = entities.spawn();
        const pos = new Position(1.5, 2.5);
        entity.insert(pos);
        entities.flush();

        const components = entities.entity(entity);
        const retrievedPos = components.find(
          (c) => c instanceof Position,
        ) as Position;
        expect(retrievedPos.x).toBe(1.5);
        expect(retrievedPos.y).toBe(2.5);
      });

      it('should handle component updates with different values', () => {
        const entity = entities.spawn();

        entity.insert(new Position(1, 1));
        entities.flush();

        entity.insert(new Position(2, 2));
        entities.flush();

        entity.insert(new Position(3, 3));
        entities.flush();

        const query = new Query<Position>(world, Position);
        for (const position of query) {
          expect(position.x).toBe(3);
          expect(position.y).toBe(3);
        }
      });
    });

    describe('Remove', () => {
      it('should remove single component', () => {
        const entity = entities.spawn().insert(new Position(1, 1));
        entities.flush();
        expect(entity.has(Position)).toBeTruthy();

        entity.remove(Position);
        entities.flush();
        expect(entity.has(Position)).toBeFalsy();
      });

      it('should handle multiple component removals', () => {
        const entity = entities
          .spawn()
          .insert(new Position(1, 1))
          .insert(new Velocity(1, 1));
        expect(entity.has(Position)).toBeFalsy();
        expect(entity.has(Velocity)).toBeFalsy();

        entities.flush();
        expect(entity.has(Position)).toBeTruthy();
        expect(entity.has(Velocity)).toBeTruthy();

        entity.remove(Position).remove(Velocity);
        entities.flush();
        expect(entity.has(Position)).toBeFalsy();
        expect(entity.has(Velocity)).toBeFalsy();
      });

      it('should ignore removing non-existent component', () => {
        const entity = entities.spawn();
        entities.flush();

        expect(() => entity.remove(Position)).not.toThrow();
        entities.flush();
        expect(entity.has(Position)).toBeFalsy();
      });

      it('should handle remove then insert of same component type', () => {
        const entity = entities.spawn([new Position(1, 1)]);
        entities.flush();

        entity.remove(Position);
        entities.flush();
        expect(entity.has(Position)).toBeFalsy();

        entity.insert(new Position(2, 2));
        entities.flush();
        expect(entity.has(Position)).toBeTruthy();

        const components = entities.entity(entity);
        const pos = components.find((c) => c instanceof Position) as Position;
        expect(pos.x).toBe(2);
      });

      it('should handle remove of multiple component types', () => {
        const entity = entities.spawn([
          new Position(1, 1),
          new Velocity(1, 1),
          new Name('test'),
        ]);
        entities.flush();

        entity.remove(Position).remove(Name);
        entities.flush();

        expect(entity.has(Position)).toBeFalsy();
        expect(entity.has(Velocity)).toBeTruthy();
        expect(entity.has(Name)).toBeFalsy();
      });
    });

    describe('Mixed Operations', () => {
      it('should handle mixed insert and remove operations', () => {
        const entity = entities
          .spawn()
          .insert(new Position(1, 1))
          .insert(new Velocity(1, 1));
        entities.flush();

        entity
          .remove(Position)
          .insert(new Name('test'))
          .remove(Velocity)
          .insert(new Position(2, 2));
        entities.flush();

        expect(entity.has(Position)).toBeTruthy();
        expect(entity.has(Velocity)).toBeFalsy();
        expect(entity.has(Name)).toBeTruthy();
      });

      it('should handle complex component operations sequence', () => {
        const entity = entities.spawn([new Position(1, 1)]);
        entities.flush();

        entity
          .insert(new Velocity(1, 1))
          .remove(Position)
          .insert(new Name('test'))
          .insert(new Position(2, 2))
          .remove(Name)
          .insert(new Name('updated'));

        entities.flush();

        expect(entity.has(Position)).toBeTruthy();
        expect(entity.has(Velocity)).toBeTruthy();
        expect(entity.has(Name)).toBeTruthy();

        const components = entities.entity(entity);

        const pos = components.find((c) => c instanceof Position) as Position;
        const name = components.find((c) => c instanceof Name) as Name;

        expect(pos.x).toBe(2);
        expect(name.name).toBe('updated');
      });

      it('should handle insert after remove in same flush', () => {
        const entity = entities.spawn([new Position(1, 1)]);
        entities.flush();

        entity.remove(Position).insert(new Position(2, 2));

        entities.flush();

        const components = entities.entity(entity);
        const pos = components.find((c) => c instanceof Position) as Position;
        expect(pos.x).toBe(2);
      });
    });
  });

  describe('Entity Lifecycle', () => {
    it('should handle multiple spawn and despawn cycles', () => {
      const entity1 = entities.spawn();
      const entity2 = entities.spawn();
      entities.flush();

      entities.despawn(entity1);
      entities.flush();

      const entity3 = entities.spawn();
      entities.flush();

      expect(entity1.isAlive).toBeFalsy();
      expect(entity2.isAlive).toBeTruthy();
      expect(entity3.isAlive).toBeTruthy();
    });

    // TODO
    it('should handle operations on despawned entity', () => {
      const entity = entities.spawn([new Position(1, 1)]);
      entities.flush();

      entities.despawn(entity);
      entities.flush();

      // expect(() => entity.insert(new Position(2, 2))).toThrow();
      // expect(() => entity.remove(Position)).toThrow();
    });
  });

  describe('Entity Location', () => {
    it('should correctly set and get entity location', () => {
      const entity = entities.spawn();
      const location = {tableId: 1, tableRow: 2};

      entity.setLocation(location);
      expect(entity.getLocation()).toEqual(location);
    });

    it('should not accept invalid location values', () => {
      const entity = entities.spawn();

      expect(() => {
        entity.setLocation({tableId: -1});
      }).toThrow();

      expect(() => {
        entity.setLocation({tableRow: -1});
      }).toThrow();
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch updates with same component instance', () => {
      const arr = Array.from({length: 3}, () => world.spawn());
      const pos = new Position(1, 1);

      arr.forEach((entity) => entity.insert(pos));
      entities.flush();

      const query = new Query<Position>(world, Position);
      const positions = Array.from(query);
      expect(positions.length).toBe(3);
      positions.forEach((p) => {
        expect(p).toBe(pos);
      });
    });

    it('should handle batch updates with different component instances', () => {
      Array.from({length: 3}, (_, i) => entities.spawn([new Position(i, i)]));
      entities.flush();

      const query = new Query<Position>(world, Position);
      const positions = Array.from(query);
      expect(positions.length).toBe(3);
      positions.forEach((p, i) => {
        expect(p.x).toBe(i);
        expect(p.y).toBe(i);
      });
    });
  });
});
