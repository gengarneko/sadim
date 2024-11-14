import {field} from '@lastolivegames/becsy';
import * as becsy from '@lastolivegames/becsy';
import * as thyseus from 'thyseus';
import * as miniplex from 'miniplex';
import * as tick from 'tick-knock';
import * as bitecs from 'bitecs';

const entityCount = 2_000_000; // 200w
const thyseusWorld = await new thyseus.World();
const miniplexWorld = new miniplex.World();
const tickWorld = new tick.Engine();
const bitecsWorld = bitecs.createWorld(entityCount);

// * --------------------------------------------------------------------------
// * create entities
// * --------------------------------------------------------------------------

@becsy.component class Acceleration {
  // @ts-ignore
  @field({type: becsy.Type.float64, default: 0.1}) declare value: number;
}

@becsy.component class Position {
  // @ts-ignore
  @field({type: becsy.Type.float64, default: 0}) declare x: number;
  // @ts-ignore
  @field({type: becsy.Type.float64, default: 0}) declare y: number;
  // @ts-ignore
  @field({type: becsy.Type.float64, default: 0}) declare z: number;
}

// const becsyWorld = await becsy.World.create({
//   defs: [Acceleration, Position],
//   maxEntities: entityCount,
// });

class ThyAcceleration {
  constructor(public value: number = 0.1) {}
}

class ThyPosition {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}
}

async function runBenchmark() {
  // * --------------------------------------------------------------------------
  // * 创建实体的基准测试
  // * --------------------------------------------------------------------------
  console.log('\n=== Entity Creation ===');

  // console.time('Becsy Creation');
  // for (let i = 0; i < entityCount; i++) {
  //   becsyWorld.createEntity(Acceleration, Position);
  // }
  // console.timeEnd('Becsy Creation');

  console.time('Thyseus Creation');
  for (let i = 0; i < entityCount; i++) {
    thyseusWorld.spawn()
      .add(new ThyAcceleration(0.1))
      .add(new ThyPosition(0, 0, 0));
  }
  console.timeEnd('Thyseus Creation');

  console.time('Thyseus Query');
  const query = new thyseus.Query<[ThyAcceleration, ThyPosition]>(
    thyseusWorld,
    [0n, 0n],
    false,
    [ThyAcceleration, ThyPosition]
  );
  thyseusWorld.entities.update();
  console.log(query.length);
  console.timeEnd('Thyseus Query');

  console.time('Thyseus Update');
  for (const [acc, pos] of query) {
    pos.x += acc.value;
  }
  console.timeEnd('Thyseus Update');

  console.time('Miniplex Creation');
  for (let i = 0; i < entityCount; i++) {
    miniplexWorld.add({
      position: [0, 0, 0],
      acceleration: 0.1,
    });
  }
  console.timeEnd('Miniplex Creation');

  console.time('Tick Creation');
  for (let i = 0; i < entityCount; i++) {
    const entity = new tick.Entity()
      .add(new ThyAcceleration())
      .add(new ThyPosition());
    tickWorld.addEntity(entity);
  }
  console.timeEnd('Tick Creation');

  console.time('Bitecs Creation');
  const Vector3 = {
    x: bitecs.Types.f32,
    y: bitecs.Types.f32,
    z: bitecs.Types.f32,
    // x: number,
    // y: number,
    // z: number,
  };
  const Pos = bitecs.defineComponent(Vector3);
  const Velocity = bitecs.defineComponent(Vector3);
  for (let i = 0; i < entityCount; i++) {
    const eid = bitecs.addEntity(bitecsWorld);
    bitecs.addComponent(bitecsWorld, Pos, eid);
    bitecs.addComponent(bitecsWorld, Velocity,eid);
  }
  console.timeEnd('Bitecs Creation');

  // * --------------------------------------------------------------------------
  // * 查询性能测试
  // * --------------------------------------------------------------------------

  // console.log('\n=== Query Performance ===');
  // console.time('Becsy Query');
  // const becsyQuery = becsyWorld.query(q => q.current.with(Position, Acceleration));
  // for (const entity of becsyQuery) {
  //   // 简单读取操作
  //   const pos = entity.read(Position);
  //   const acc = entity.read(Acceleration);
  // }
  // console.timeEnd('Becsy Query');

  // console.time('Thyseus Query');
  // for (const [pos, acc] of thyseusWorld.query(ThyPosition, ThyAcceleration)) {
  //   // 简单读取操作
  //   const x = pos.x;
  //   const value = acc.value;
  // }
  // console.timeEnd('Thyseus Query');
}


runBenchmark();
