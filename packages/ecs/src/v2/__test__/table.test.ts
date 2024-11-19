import {expect, it} from 'vitest';

import {Entity} from '../entity';
import {createTable, Table} from '../table';
// import {Tag} from '../Tag';
import {World} from '../world';

class Vec3 {
  x: number;
  y: number;
  z: number;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

const addToTable = (table: Table, entity: Entity, ...components: object[]) => {
  table.getColumn(Entity).push(entity);
  for (const component of components) {
    table.getColumn(component.constructor as any).push(component);
  }
};

it('add() adds an item', async () => {
  const world = new World();
  const table = createTable([Entity]);
  const entityColumn = table.getColumn(Entity);
  expect(table.length).toBe(0);

  const e1 = new Entity(world.entities, 4);
  const e2 = new Entity(world.entities, 5);
  addToTable(table, e1);
  addToTable(table, e2);

  expect(entityColumn[0]).toBe(e1);
  expect(entityColumn[1]).toBe(e2);
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

// it('does not create columns for ZSTs', async () => {
//   class ZST extends Tag {}
//   const table = createTable(Entity, Vec3, ZST);
//   expect(table.hasColumn(ZST)).toBe(false);
// });
