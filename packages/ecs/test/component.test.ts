import {describe, expect, it} from 'vitest';

import {
  Class,
  createTag,
  Entity,
  isSizedComponent,
  isTagComponent,
  Query,
  World,
} from '../src';

class Name {
  name: string = '';
  constructor(name: string = '') {
    this.name = name;
  }
}

const ZST = createTag('ZST');
class Vec3 {}

const createWorld = (...components: Class[]) => {
  const world = new World();
  // register components
  for (const component of components) {
    world.getComponentId(component);
  }
  return world;
};
describe('Components', () => {
  describe('Constructor', () => {
    it('Should have one table as the storage data structure', () => {
      const world = new World();
      expect(world.tables.length).toBe(1);
    });
    it('Should have one `Entity` component as the base component', () => {
      const world = new World();
      expect(world.components.length).toBe(1);
      expect(world.components[0]).toBe(Entity);
    });
  });
  describe('Components id', () => {
    it('Register components with getComponentId', () => {
      const world = new World();
      class Position {}
      expect(world.getComponentId(Position)).toBeDefined();
      expect(world.getComponentId(Position)).toBe(1);
    });
    it('Getting next components for getComponentId twice', () => {
      const world = new World();
      expect(world.getComponentId(class Position {})).toBeDefined();
      expect(world.getComponentId(class Position {})).toBe(2);
    });
    it('Getting component id return equal values for same component twice', () => {
      const world = new World();
      class Test1 {}
      class Test2 {}
      expect(world.getComponentId(Test1)).toBe(world.getComponentId(Test1));
      expect(world.getComponentId(Test2)).toBe(world.getComponentId(Test2));
    });
    it('Getting component id return different values for different components', () => {
      const world = new World();
      class Test1 {}
      class Test2 {}
      const id1 = world.getComponentId(Test1);
      const id2 = world.getComponentId(Test2);
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toEqual(id2);
    });
  });
  // describe('New type', () => {
  //   it('Should create a new component with javascript class', () => {
  //     const world = new World();
  //     class TestComponent {}
  //     world.spawn().add(new TestComponent());
  //     expect(world.components.length).toBe(2);
  //     expect(world.components[1]).toBe(TestComponent);
  //   });
  //   // TODO: should be warning when directly adding object
  //   it('Should work with simple objects', () => {
  //     const world = new World();
  //     world.spawn().add({x: 0, y: 0});
  //     expect(world.components.length).toBe(2);
  //     expect(world.components[1]).toBe(Object);
  //   });
  // });
  // describe('Marker components', () => {
  //   it('Should create a new component with new type', async () => {
  //     const world = new World();
  //     class Marker extends Tag {}
  //     world.spawn().addTag(Marker);
  //     expect(world.components[1]).toBe(Marker);
  //   });
  //   it("Components can't be tag", () => {
  //     const world = new World();
  //     class Position {}
  //     const addTagToWorld = () =>
  //       world.spawn().addTag(Position as TagComponent);
  //     expect(addTagToWorld).toThrow();
  //   });
  // });
});

describe('Removing Components', () => {
  it('should create a new component with new type', async () => {
    const world = await new World();
  });
});

describe('Required Components', () => {
  it('should create a new component with new type', async () => {
    const world = await new World();
  });
});
