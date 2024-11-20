import {beforeEach, describe, expect, it} from 'vitest';

// import {Tag} from '../component';
import {
  And,
  Class,
  DEV_ASSERT_FILTER_VALID,
  Entity,
  Maybe,
  Or,
  Query,
  With,
  Without,
  World,
} from '../src';
import {Name, Position, Velocity} from './_helpers';

// class ZST extends Tag {}
class ZST {}

// * --------------------------------------------------------------------------
// * Utils
// * --------------------------------------------------------------------------

const setupEntitiesWithPosition = (world: World, count: number) => {
  for (let i = 0; i < count; i++) {
    world.spawn().insert(new Position(i, i));
  }
  world.entities.flush();
};

const setupEntities = (world: World, count: number) => {
  for (let i = 0; i < count; i++) {
    world.spawn().insert(new Position(i, i));
  }
  world.entities.flush();
};

// * --------------------------------------------------------------------------
// * Tests
// * --------------------------------------------------------------------------

describe('Query', () => {
  let world: World;
  let query: Query<Position>;
  beforeEach(() => {
    world = new World();
    query = new Query(world, Position);
  });

  describe('Basic Query Features', () => {
    describe('Query Creation Timing', () => {
      it('should match tables after entities update', () => {
        const world = new World();
        const query = new Query(world, Position);
        expect(query.length).toBe(0);

        world.spawn().insert(new Position(0, 0));
        world.entities.flush();
        expect(query.length).toBe(1);
      });

      it('should match existing tables when created after entity update', () => {
        const world = new World();
        // Create entities first
        world.spawn().insert(new Position(0, 0));
        world.spawn().insert(new Position(1, 1));
        world.entities.flush();
        // Create query after
        const query = new Query(world, Position);
        expect(query.length).toBe(2);
      });

      it('should handle multiple component types', () => {
        const world = new World();
        const query = new Query(world, [Position, Velocity]);

        world.spawn().insert(new Position(0, 0)).insert(new Velocity(1, 1));
        world.entities.flush();

        expect(query.length).toBe(1);
      });
    });

    describe('Basic Filters', () => {
      it('should correctly match basic components', () => {
        const world = new World();
        const queryPos = new Query(world, Position);
        const queryVel = new Query(world, Velocity);
        const queryBoth = new Query(world, [Position, Velocity]);

        world.spawn().insert(new Position(0, 0));
        world.spawn().insert(new Position(1, 1)).insert(new Velocity(1, 1));
        world.spawn().insert(new Velocity(2, 2));
        world.entities.flush();

        expect(queryPos.length).toBe(2);
        expect(queryVel.length).toBe(2);
        expect(queryBoth.length).toBe(1);
      });

      it('TODO: should handle tag components', () => {
        const world = new World();
        const query = new Query(world, ZST);

        world.spawn().insertTag(ZST);
        world.spawn().insert(new Position(0, 0));
        world.entities.flush();

        // expect(query.length).toBe(1);
      });

      it('should handle entity removal', () => {
        const world = new World();
        const query = new Query(world, Position);

        const entity = world.spawn().insert(new Position(0, 0));
        world.entities.flush();
        expect(query.length).toBe(1);

        entity.despawn();
        world.entities.flush();
        expect(query.length).toBe(0);
      });

      it('should handle component removal', () => {
        const world = new World();
        const query = new Query(world, Position);

        const entity = world
          .spawn()
          .insert(new Position(0, 0))
          .insert(new Velocity(1, 1));
        world.entities.flush();
        expect(query.length).toBe(1);

        entity.remove(Position);
        world.entities.flush();
        expect(query.length).toBe(0);
      });
    });

    describe('Query Results Consistency', () => {
      it('should maintain consistent results between updates', () => {
        const world = new World();
        const query = new Query(world, Position);

        // Initial entities
        world.spawn().insert(new Position(0, 0));
        world.spawn().insert(new Position(1, 1));
        world.entities.flush();
        expect(query.length).toBe(2);

        // Add more entities without update
        world.spawn().insert(new Position(2, 2));
        expect(query.length).toBe(2); // Should not change until update

        world.entities.flush();
        expect(query.length).toBe(3); // Now reflects new entity
      });

      it('should handle multiple table transitions', () => {
        const world = new World();
        const query = new Query(world, Position);

        const entity = world.spawn().insert(new Position(0, 0));
        world.entities.flush();
        expect(query.length).toBe(1);

        // Transition to different archetype
        entity.insert(new Velocity(1, 1));
        world.entities.flush();
        expect(query.length).toBe(1); // Still matches Position

        // Remove Position
        entity.remove(Position);
        world.entities.flush();
        expect(query.length).toBe(0); // No longer matches
      });
    });
  });

  describe('Query Modifiers', () => {
    describe('Maybe Modifier', () => {
      it('should match entities with and without optional component', () => {
        const world = new World();
        const query = new Query<[Entity, Maybe<Position>]>(world, [
          Entity,
          Maybe.intoArgument(world, Position),
        ]);

        // Entity without Position
        world.spawn();
        // Entity with Position
        world.spawn().insert(new Position(1, 1));
        world.entities.flush();

        expect(query.length).toBe(2);

        let withPos = 0;
        let withoutPos = 0;
        for (const [_, pos] of query) {
          if (pos) {
            withPos++;
            expect(pos).toBeInstanceOf(Position);
          } else {
            withoutPos++;
            expect(pos).toBeUndefined();
          }
        }
        expect(withPos).toBe(1);
        expect(withoutPos).toBe(1);
      });

      it('should handle multiple Maybe components', () => {
        const world = new World();
        const query = new Query<[Maybe<Position>, Maybe<Velocity>]>(world, [
          Maybe.intoArgument(world, Position),
          Maybe.intoArgument(world, Velocity),
        ]);

        world.spawn();
        world.spawn().insert(new Position(0, 0));
        world.spawn().insert(new Velocity(1, 1));
        world.spawn().insert(new Position(2, 2)).insert(new Velocity(2, 2));

        world.entities.flush();
        expect(query.length).toBe(4);
      });
    });

    describe('With Filter', () => {
      it('should match entities with required components', () => {
        const world = new World();
        const query = new Query<Position>(
          world,
          Position,
          new With(world, [Velocity]),
        );

        // Won't match: no Velocity
        world.spawn().insert(new Position(0, 0));
        // Will match: has both
        world.spawn().insert(new Position(1, 1)).insert(new Velocity(1, 1));

        world.entities.flush();
        expect(query.length).toBe(1);

        for (const pos of query) {
          expect(pos.x).toBe(1);
          expect(pos.y).toBe(1);
        }
      });

      it('should handle multiple With filters', () => {
        const world = new World();
        const query = new Query<Entity>(
          world,
          Entity,
          new With(world, [Position, Velocity, Name]),
        );

        // Won't match: missing components
        world.spawn().insert(new Position(0, 0)).insert(new Velocity(0, 0));

        // Will match: has all required components
        world
          .spawn()
          .insert(new Position(1, 1))
          .insert(new Velocity(1, 1))
          .insert(new Name('test'));

        world.entities.flush();
        expect(query.length).toBe(1);
      });
    });

    describe('Without Filter', () => {
      it('should match entities without specified components', () => {
        const world = new World();
        const query = new Query<Position>(
          world,
          Position,
          new Without(world, [Velocity]),
        );

        world.spawn().insert(new Position(0, 0));
        world.spawn().insert(new Position(1, 1)).insert(new Velocity(1, 1));
        world.entities.flush();
        expect(query.length).toBe(1);

        for (const pos of query) {
          expect(pos.x).toBe(0);
          expect(pos.y).toBe(0);
        }
      });

      it('should handle multiple Without filters', () => {
        const world = new World();
        const query = new Query<Entity>(
          world,
          Entity,
          new Without(world, [Position, Velocity]),
        );

        world.spawn();
        world.spawn().insert(new Position(0, 0));
        world.spawn().insert(new Velocity(1, 1));
        world.spawn().insert(new Position(2, 2)).insert(new Velocity(2, 2));

        world.entities.flush();
        expect(query.length).toBe(1);
      });
    });

    // TODO: Filters can be combined with AND, OR, NOT operators
    describe('Combined Filters', () => {
      it('TODO: should handle With and Without together', () => {
        // ... test code
      });

      it('should handle Maybe with filters', () => {
        const world = new World();
        const query = new Query<[Entity, Maybe<Position>]>(
          world,
          [Entity, Maybe.intoArgument(world, Position)],
          new Without(world, [Velocity]),
        );

        world.spawn();
        world.spawn().insert(new Position(1, 1));
        world.spawn().insert(new Position(2, 2)).insert(new Velocity(2, 2));

        world.entities.flush();
        expect(query.length).toBe(2);
      });
    });
  });

  describe('Query Iteration', () => {
    describe('Basic Iteration', () => {
      it('should iterate over all matching entities', () => {
        const world = new World();
        const query = new Query<[Position, Entity]>(world, [Position, Entity]);

        // Create test entities
        for (let i = 0; i < 5; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();

        expect(query.length).toBe(5);

        let count = 0;
        for (const [pos, entity] of query) {
          expect(pos).toBeInstanceOf(Position);
          expect(pos.x).toBe(count);
          expect(pos.y).toBe(count);
          expect(entity).toBeInstanceOf(Entity);
          expect(entity.id).toBe(count);
          count++;
        }
        expect(count).toBe(5);
      });

      it('should return single elements for non-tuple queries', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        // Create test entities
        for (let i = 0; i < 3; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();

        let count = 0;
        for (const pos of query) {
          expect(pos).toBeInstanceOf(Position);
          expect(pos.x).toBe(count);
          expect(pos.y).toBe(count);
          count++;
        }
        expect(count).toBe(3);
      });

      it('should handle empty queries', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        let iterationCount = 0;
        for (const _ of query) {
          iterationCount++;
        }
        expect(iterationCount).toBe(0);
      });
    });

    describe('Iterator Methods', () => {
      it('should have iter() equivalent to Symbol.iterator', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        for (let i = 0; i < 3; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();

        const iterResults = [...query.iter()];
        const symbolResults = [...query];

        expect(iterResults).toHaveLength(3);
        expect(iterResults).toEqual(symbolResults);
        expect(query.iter).toBe(query[Symbol.iterator]);
      });

      it('should iterate with forEach', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        for (let i = 0; i < 3; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();

        const positions: Position[] = [];
        const indices: number[] = [];

        query.forEach((pos, index) => {
          positions.push(pos);
          indices.push(index);
        });

        expect(positions).toHaveLength(3);
        expect(indices).toEqual([0, 1, 2]);
        positions.forEach((pos, i) => {
          expect(pos.x).toBe(i);
          expect(pos.y).toBe(i);
        });
      });

      it('should accumulate values with reduce', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        for (let i = 0; i < 3; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();

        const sumX = query.reduce((acc, pos) => acc + pos.x, 0);
        const sumY = query.reduce((acc, pos) => acc + pos.y, 0);

        expect(sumX).toBe(0 + 1 + 2);
        expect(sumY).toBe(0 + 1 + 2);
      });

      it('should iterate entity pairs', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        for (let i = 0; i < 3; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();

        const pairs: [Position, Position][] = [];

        for (const [pos1, pos2] of query.pairs()) {
          expect(pos1).not.toBe(pos2);
          pairs.push([pos1, pos2]);
        }

        // For n entities, we should have n * (n-1) / 2 pairs
        expect(pairs).toHaveLength(3); // 3 * 2 / 2 = 3 pairs
      });
    });

    describe('Advanced Iteration Features', () => {
      it('should handle component mutation during iteration', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        for (let i = 0; i < 3; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();

        // mutate components during iteration
        for (const pos of query) {
          pos.x += 10;
          pos.y += 10;
        }

        // verify mutations
        let i = 0;
        for (const pos of query) {
          expect(pos.x).toBe(i + 10);
          expect(pos.y).toBe(i + 10);
          i++;
        }
      });

      it('should return first element with single()', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        world.spawn().insert(new Position(42, 42));
        world.entities.flush();

        const pos = query.single();
        expect(pos).toBeInstanceOf(Position);
        expect(pos.x).toBe(42);
        expect(pos.y).toBe(42);
      });

      it('should handle Maybe components in iteration', () => {
        const world = new World();
        const query = new Query<[Entity, Maybe<Position>]>(world, [
          Entity,
          Maybe.intoArgument(world, Position),
        ]);

        world.spawn();
        world.spawn().insert(new Position(1, 1));
        world.entities.flush();

        let withPos = 0;
        let withoutPos = 0;

        for (const [_, pos] of query) {
          if (pos) {
            withPos++;
            expect(pos.x).toBe(1);
            expect(pos.y).toBe(1);
          } else {
            withoutPos++;
            expect(pos).toBeUndefined();
          }
        }

        expect(withPos).toBe(1);
        expect(withoutPos).toBe(1);
      });
    });
  });

  describe('Entity Operations', () => {
    describe('Component Modification', () => {
      it('should modify components in query results', () => {
        const world = new World();
        const query = new Query<[Entity, Position]>(world, [Entity, Position]);

        // Setup test entities
        for (let i = 0; i < 5; i++) {
          world.spawn().insert(new Position(i, i));
        }
        world.entities.flush();
        expect(query.length).toBe(5);

        // Modify components through query
        for (const [_, pos] of query) {
          pos.x += 10;
          pos.y *= 2;
        }

        // Verify modifications
        for (const [entity, pos] of query) {
          expect(pos.x).toBe(entity.id + 10);
          expect(pos.y).toBe(entity.id * 2);
        }
      });

      it('should maintain modifications across multiple queries', () => {
        const world = new World();
        const queryA = new Query<Position>(world, Position);
        const queryB = new Query<[Position, Velocity]>(world, [
          Position,
          Velocity,
        ]);

        // Create entity with both components
        world.spawn().insert(new Position(1, 1)).insert(new Velocity(2, 2));
        world.entities.flush();

        // Modify through first query
        for (const pos of queryA) {
          pos.x = 10;
          pos.y = 20;
        }

        // Verify through second query
        for (const [pos, vel] of queryB) {
          expect(pos.x).toBe(10);
          expect(pos.y).toBe(20);
        }
      });
    });

    describe('Component Addition', () => {
      it('should add components to queried entities', () => {
        const world = new World();
        const queryInitial = new Query<Entity>(world, Entity);
        const queryFinal = new Query<[Entity, Position, Velocity]>(world, [
          Entity,
          Position,
          Velocity,
        ]);
        const queryPos = new Query<Position>(world, Position);

        // Create initial entities
        for (let i = 0; i < 3; i++) {
          world.spawn();
        }
        world.entities.flush();
      });

      it('TODO: should handle tag component addition', () => {
        const world = new World();
        const queryBase = new Query<Entity>(world, Entity);
        const queryWithTag = new Query<Entity>(
          world,
          Entity,
          new With(world, [ZST]),
        );

        // Create base entities
        for (let i = 0; i < 3; i++) {
          world.spawn();
        }
        world.entities.flush();

        // expect(queryWithTag.length).toBe(0);

        // Add tag to entities
        queryBase.forEach((entity) => {
          entity.insertTag(ZST);
        });
        world.entities.flush();

        // expect(queryWithTag.length).toBe(3);
      });
    });

    describe('Component Removal', () => {
      it('should safely remove components from queried entities', () => {
        const world = new World();
        const queryAll = new Query<Entity>(world, Entity);
        const queryWithPos = new Query<[Entity, Position]>(world, [
          Entity,
          Position,
        ]);

        for (let i = 0; i < 3; i++) {
          world.spawn().insert(new Position(i, i)).insert(new Velocity(i, i));
        }
        world.entities.flush();

        expect(queryWithPos.length).toBe(3);

        // Collect entities first to avoid iterator invalidation
        const entities = [...queryWithPos].map(([entity]) => entity);

        entities.forEach((entity) => {
          entity.remove(Position);
        });
        world.entities.flush();
        expect(queryWithPos.length).toBe(2);
      });

      it('should handle multiple component removals', () => {
        const world = new World();
        const queryInitial = new Query<[Entity, Position, Velocity]>(world, [
          Entity,
          Position,
          Velocity,
        ]);

        // Create entity with multiple components
        world.spawn().insert(new Position(0, 0)).insert(new Velocity(1, 1));
        world.entities.flush();

        expect(queryInitial.length).toBe(1);

        // Get entity and remove components
        const [entity] = queryInitial.single();
        entity.remove(Position);
        entity.remove(Velocity);
        world.entities.flush();

        expect(queryInitial.length).toBe(0);
      });

      it('should maintain entity state after component removal', () => {
        const world = new World();
        const queryPos = new Query<[Entity, Position]>(world, [
          Entity,
          Position,
        ]);
        const queryVel = new Query<[Entity, Velocity]>(world, [
          Entity,
          Velocity,
        ]);

        // Create entity with both components
        const entity = world
          .spawn()
          .insert(new Position(1, 1))
          .insert(new Velocity(2, 2));
        world.entities.flush();

        expect(queryPos.length).toBe(1);
        expect(queryVel.length).toBe(1);

        // Remove Position but keep Velocity
        entity.remove(Position);
        world.entities.flush();

        expect(queryPos.length).toBe(0);
        expect(queryVel.length).toBe(1);

        // Verify remaining Velocity component
        const [_, vel] = queryVel.single();
        expect(vel.vx).toBe(2);
        expect(vel.vy).toBe(2);
      });
    });
  });

  describe('Utility Methods', () => {
    describe('get() Method', () => {
      it('should return components for a specific entity', () => {
        const world = new World();
        const query = new Query<[Position, Velocity]>(world, [
          Position,
          Velocity,
        ]);

        const entity = world
          .spawn()
          .insert(new Position(1, 1))
          .insert(new Velocity(2, 2));
        world.entities.flush();

        const components = query.get(entity);
        expect(components).toBeDefined();
        const [pos, vel] = components!;

        expect(pos).toBeInstanceOf(Position);
        expect(pos.x).toBe(1);
        expect(pos.y).toBe(1);

        expect(vel).toBeInstanceOf(Velocity);
        expect(vel.vx).toBe(2);
        expect(vel.vy).toBe(2);
      });

      // it('should return undefined for non-matching entities', () => {
      //   const world = new World();
      //   const query = new Query<[Position, Velocity]>(world, [
      //     Position,
      //     Velocity,
      //   ]);

      //   // Entity with only Position
      //   const entity = world.spawn().insert(new Position(1, 1));
      //   world.entities.flush();

      //   const components = query.get(entity);
      //   expect(components).toBeUndefined();
      // });

      // it('should handle Maybe components in get()', () => {
      //   const world = new World();
      //   const query = new Query<[Entity, Maybe<Position>]>(world, [
      //     Entity,
      //     Maybe.intoArgument(world, Position),
      //   ]);

      //   const entityWithout = world.spawn();
      //   const entityWith = world.spawn().insert(new Position(1, 1));
      //   world.entities.flush();

      //   const componentsWithout = query.get(entityWithout);
      //   expect(componentsWithout).toBeDefined();
      //   expect(componentsWithout![1]).toBeUndefined();

      //   const componentsWith = query.get(entityWith);
      //   expect(componentsWith).toBeDefined();
      //   expect(componentsWith![1]).toBeInstanceOf(Position);
      // });
    });

    describe('single() Method', () => {
      it('should return the first matching entity components', () => {
        const world = new World();
        const query = new Query<[Entity, Position]>(world, [Entity, Position]);

        world.spawn().insert(new Position(1, 1));
        world.spawn().insert(new Position(2, 2));
        world.entities.flush();

        const [entity, pos] = query.single();
        expect(entity).toBeInstanceOf(Entity);
        expect(pos).toBeInstanceOf(Position);
        expect(pos.x).toBe(1);
        expect(pos.y).toBe(1);
      });

      it('should return undefined for empty query', () => {
        const world = new World();
        const query = new Query<Position>(world, Position);

        const result = query.single();
        expect(result).toBeUndefined();
      });

      it('should work with Maybe components', () => {
        const world = new World();
        const query = new Query<[Entity, Maybe<Position>]>(world, [
          Entity,
          Maybe.intoArgument(world, Position),
        ]);

        world.spawn(); // Entity without Position
        world.entities.flush();

        const [entity, pos] = query.single();
        expect(entity).toBeInstanceOf(Entity);
        expect(pos).toBeUndefined();
      });
    });

    describe('find() Method', () => {
      it('should find entity matching predicate', () => {
        // test code
      });

      it('should return undefined when no match found', () => {
        // test code
      });
    });

    class MyComponent {}

    describe('Maybe', () => {
      it('intoArgument() returns a maybe descriptor', () => {
        expect(Maybe.intoArgument({} as any, MyComponent)).toStrictEqual({
          modifier: 'maybe',
          type: MyComponent,
        });
      });
      it('isMaybe() returns true iff a value is a maybe descriptor', () => {
        const maybeComp = Maybe.intoArgument({} as any, MyComponent);
        expect(Maybe.isMaybe(maybeComp)).toBe(true);
        expect(Maybe.isMaybe(MyComponent)).toBe(false);
      });
    });
  });

  describe('iteration', () => {
    it('yields normal elements for all table members', () => {
      const world = new World();
      const query = new Query<[Position, Entity]>(world, [Position, Entity]);
      expect(query.length).toBe(0);

      for (let i = 0; i < 5; i++) {
        world.spawn().insert(new Position(0, 0));
      }
      for (let i = 0; i < 5; i++) {
        world.spawn().insert(new Position(0, 0)).insertTag(ZST);
      }
      world.entities.flush();

      expect(query.length).toBe(10);
      let j = 0;
      for (const [pos, ent] of query) {
        expect(pos).toBeInstanceOf(Position);
        expect(ent).toBeInstanceOf(Entity);
        expect(ent.id).toBe(j);
        j++;
      }
      expect(j).toBe(10);
    });

    it('yields individual elements for non-tuple iterators', () => {
      setupEntitiesWithPosition(world, 10);
      let j = 0;
      for (const pos of query) {
        expect(pos).toBeInstanceOf(Position);
        j++;
      }
      expect(j).toBe(10);
    });

    it('yields undefined for Maybe values', () => {
      const world = new World();
      const query: Query<Position | undefined> = new Query(
        world,
        Maybe.intoArgument(world, Position),
      );

      expect(query.length).toBe(0);
      for (let i = 0; i < 5; i++) {
        world.spawn();
      }
      for (let i = 0; i < 5; i++) {
        world.spawn().insert(new Position(0, 0));
      }
      world.entities.flush();

      expect(query.length).toBe(10);
      let undef = 0;
      let def = 0;
      for (const pos of query) {
        if (pos) {
          def++;
          expect(pos).toBeInstanceOf(Position);
        } else {
          undef++;
          expect(pos).toBeUndefined();
        }
      }
      expect(undef).toBe(5);
      expect(def).toBe(5);
    });

    it('iter() fn is equal to [Symbol.iterator]', () => {
      setupEntitiesWithPosition(world, 5);
      expect(query.iter).toBe(query[Symbol.iterator]);

      const resultsFromIter = [...query.iter()];
      const resultsFromIterator = [...query];
      expect(resultsFromIter).toHaveLength(5);
      expect(resultsFromIter).toEqual(resultsFromIterator);

      let result = 0;
      for (const _ of query.iter()) {
        result++;
      }
      expect(result).toBe(5);
    });

    it('forEach will iterate over all elements', () => {
      setupEntitiesWithPosition(world, 5);
      let result = 0;
      query.forEach((_, index) => (result += index));
      expect(result).toBe(0 + 1 + 2 + 3 + 4);
    });

    it('pairs will yield pairs of entities', () => {
      setupEntitiesWithPosition(world, 5);
      let result = 0;
      for (const [ent1, ent2] of query.pairs()) {
        expect(ent1).not.toBe(ent2);
        result++;
      }
      expect(result).toBe(10);
    });

    it('reduce will accumulate values', () => {
      setupEntitiesWithPosition(world, 5);
      const result = query.reduce((acc, pos) => acc + pos.x, 0);
      expect(result).toBe(0 + 1 + 2 + 3 + 4);
    });

    it('single will return the first matched element', () => {
      setupEntitiesWithPosition(world, 5);
      const result = query.single();
      expect(result).toBeInstanceOf(Position);
      expect(result.x).toBe(0);
    });

    it('mutate components from query', () => {
      const world = new World();
      const query = new Query<[Entity, Position]>(world, [Entity, Position]);
      expect(query.length).toBe(0);

      new Array(5).fill(0).forEach(() => {
        const entity = world.spawn();
        const entityId = entity.id;
        entity.insert(new Position(entityId, entityId));
      });
      world.entities.flush();
      expect(query.length).toBe(5);

      for (const [_, pos] of query) {
        pos.x += 1;
      }
      for (const [entity, pos] of query) {
        expect(pos.x).toBe(entity.id + 1);
      }
    });

    it('add a component to entities in query', () => {
      setupEntitiesWithPosition(world, 5);
      const queryAll = new Query<Entity>(world, Entity);
      expect(queryAll.length).toBe(5);

      queryAll.forEach((entity, index) => {
        entity.insert(new Velocity(index, index));
      });
      world.entities.flush();
      const queryVel = new Query<[Entity, Velocity]>(world, [Entity, Velocity]);
      expect(queryVel.length).toBe(5);
      queryVel.forEach(([_, velocity], index) => {
        expect(velocity).toBeInstanceOf(Velocity);
        expect(velocity.vx).toBe(index);
        expect(velocity.vy).toBe(index);
      });
    });

    it('remove a component from entities in query', () => {
      const world = new World();
      world.spawn().insert(new Position(0, 0)).insert(new Velocity(0, 0));
      world.spawn().insert(new Position(0, 0));
      world.spawn();

      const queryAll = new Query<Entity>(world, Entity);
      const queryPos = new Query<[Entity, Position]>(world, [Entity, Position]);
      const queryVel = new Query<[Entity, Velocity]>(world, [Entity, Velocity]);

      expect(queryAll.length).toBe(0);
      expect(queryPos.length).toBe(0);
      expect(queryVel.length).toBe(0);

      world.entities.flush();

      expect(queryAll.length).toBe(3);
      expect(queryPos.length).toBe(2);
      expect(queryVel.length).toBe(1);

      // TODO: entity applied component removed should collected in entities._removes
      // TODO: implement command queue to execute removes
      // NOTICE: iter() should not yield removed entities, will cause archetype mismatch
      const entities = [...queryAll];
      entities.forEach((entity) => {
        entity.remove(Position);
      });
      world.entities.flush();

      expect(queryAll.length).toBe(3);
      expect(queryPos.length).toBe(0);
      expect(queryVel.length).toBe(1);
    });
  });

  describe('Query filters', () => {
    class _EntityPlaceholder {}
    class A {}
    class B {}
    class C {}
    class D {}
    class E {}
    const components: Class[] = [_EntityPlaceholder, A, B, C, D, E];

    const world = {
      getArchetype: (...comps: Class[]) =>
        comps.reduce(
          (acc, val) => acc | (1n << BigInt(components.indexOf(val))),
          1n,
        ),
    };
    const f = <T extends Class>(filterType: T, ...args: any): InstanceType<T> =>
      new filterType(world, args) as InstanceType<T>;
    describe('createArchetypeFilter()', () => {
      it('works with simple With filters', () => {
        for (let i = 0; i < components.length; i++) {
          expect(f(With, components[i]).execute([1n, 0n])).toStrictEqual([
            1n | (1n << BigInt(i)),
            0n,
          ]);
        }
      });

      it('works with simple Without filters', () => {
        // Skip Entity placeholder because Without<Entity> is always invalid
        for (let i = 1; i < components.length; i++) {
          expect(f(Without, components[i]).execute([1n, 0n])).toStrictEqual([
            1n,
            1n << BigInt(i),
          ]);
        }
      });

      it('works with And filter', () => {
        expect(
          f(And, f(With, A, B, D), f(Without, C, E)).execute([1n, 0n]),
        ).toStrictEqual([0b010111n, 0b101000n]);
      });

      it('works with simple Or filters', () => {
        expect(f(Or, f(With, A), f(With, B)).execute([1n, 0n])).toStrictEqual([
          0b000011n,
          0n,
          0b000101n,
          0n,
        ]);

        expect(
          f(Or, f(With, E), f(Without, C)).execute([1n, 0n]),
        ).toStrictEqual([0b100001n, 0n, 1n, 0b001000n]);
      });

      it('works with complex Or filters', () => {
        expect(
          // A && !B && (D || E)
          f(
            And,
            f(With, A),
            f(Or, f(With, D), f(With, E)),
            f(Without, B),
          ).execute([1n, 0n]),
        ).toStrictEqual([0b010011n, 0b000100n, 0b100011n, 0b000100n]);

        expect(
          f(
            // A || (B || C)
            Or,
            f(With, A),
            f(Or, f(With, B), f(With, C)),
          ).execute([1n, 0n]),
        ).toStrictEqual([0b0011n, 0n, 0b0101n, 0n, 0b1001n, 0n]);

        expect(
          f(
            // (A || B) && (!C || !D)
            And,
            f(Or, f(With, A), f(With, B)),
            f(Or, f(Without, C), f(Without, D)),
          ).execute([1n, 0n]),
        ).toStrictEqual([
          0b00011n,
          0b01000n,
          0b00101n,
          0b01000n,
          0b00011n,
          0b10000n,
          0b00101n,
          0b10000n,
        ]);
      });

      it('works with initial values', () => {
        expect(
          f(And, f(With, C), f(Without, D)).execute([0b00011n, 0b00100n]),
        ).toStrictEqual([0b01011n, 0b10100n]);
      });
    });

    it('throws if filters are impossible', () => {
      expect(() =>
        DEV_ASSERT_FILTER_VALID(
          f(And, f(With, A), f(Without, B)).execute([1n, 0n]),
        ),
      ).not.toThrow();
      expect(() =>
        DEV_ASSERT_FILTER_VALID(
          f(Or, f(With, A), f(Without, A)).execute([1n, 0n]),
        ),
      ).not.toThrow(/cannot match any entities/);
      expect(() =>
        DEV_ASSERT_FILTER_VALID(
          f(And, f(With, A), f(Without, A)).execute([1n, 0n]),
        ),
      ).toThrow(/cannot match any entities/);
    });
  });
});
