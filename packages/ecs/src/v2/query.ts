import {Entity} from './entity';
import {Table} from './table';
import {Class} from './utils/class';
import {DEV_ASSERT} from './utils/dev';
import {World} from './world';

// * --------------------------------------------------------------------------
// * Query
// * --------------------------------------------------------------------------

const EMPTY_COLUMN: [] = [];

declare class Query<
  A extends Accessor | Accessor[],
  F extends Filter = Filter,
> {
  /** ref to the world */
  _world: World;

  /** column-based storage, good for queries cache & SIMD */
  _columns: Array<object[]>;

  /** the components that are being queried */
  _components: Class[];

  /** the filters that are being applied */
  _filters: bigint[];

  /** whether the query is for individual elements */
  _isIndividual: boolean;

  constructor(
    world: World,
    accessors: AccessorDescriptor | AccessorDescriptor[],
    filters?: Filter,
  );

  /** test if an archetype matches the query */
  _testArchetype: (archetype: bigint) => boolean;

  /** the number of entities that match this query */
  get length(): number;

  /** iterate over the queries */
  [Symbol.iterator](): IterableIterator<A>;

  /** iterate over the queries */
  iter(): IterableIterator<A>;

  /** iterate over the queries */
  forEach(cb: (args: A, index: number) => void): void;

  /** reduce the queries to a single value */
  reduce<T>(cb: (acc: T, args: A, i: number) => T, initial: T): T;

  /** get the components of an entity */
  get(entity: Entity): A | null;

  /** get the single entity of a query */
  single(): A;

  /** iterate over all unique pairs of queries */
  pairs(): IterableIterator<[A, A]>;

  /** subscribe to table updates */
  tableUpdated(table: Table): void;

  /** update _columns when a table is matched */
  matchTable(table: Table): void;
}

/**
 * @internal
 * This enables better control of the transpiled output size.
 */
function Query<A extends Accessor | Accessor[], F extends Filter = Filter>(
  this: Query<A, F>,
  world: World,
  accessors: AccessorDescriptor | AccessorDescriptor[], // components: Class[],
  filters: Filter | undefined,
) {
  const isIndividual = !Array.isArray(accessors);
  const accessorArr = Array.isArray(accessors) ? accessors : [accessors];
  const components = accessorArr.map((x) => (Maybe.isMaybe(x) ? x.type : x));
  const initial = world.getArchetype(
    ...accessorArr.filter((x): x is Class => !Maybe.isMaybe(x)),
  );
  this._columns = [];
  this._world = world;
  this._components = components;
  this._isIndividual = isIndividual;
  this._filters = filters ? filters.execute([initial, 0n]) : [initial, 0n];

  // update if table already exists
  for (const table of world.tables) {
    this.matchTable(table);
  }
  /**
   * sync table creates & updates
   * TODO: execute after table's move, not after entities' update
   */
  this._world.onTableUpdated.subscribe((table) => this.matchTable(table));
}

/**
 * @param table - a table that has been updated
 */
Query.prototype.tableUpdated = function (table: Table) {
  this.matchTable(table);
};

/**
 * @param table - target table
 */
Query.prototype.matchTable = function (table: Table) {
  if (!this._testArchetype(table.archetype)) {
    return;
  }
  this._columns.push(table.getColumn(Entity));
  for (const component of this._components) {
    const column = table.hasColumn(component)
      ? table.getColumn(component)
      : EMPTY_COLUMN;
    this._columns.push(column);
  }
};

/**
 * Example:
 * ```ts
 * _columns = [
 *   // Table 1 (span = 3)
 *   [e1, e2, e3],      // i = 0: column of Entity
 *   [p1, p2, p3],      // i = 1: column of Position
 *   [v1, v2, v3],      // i = 2: column of Velocity
 *
 *   // Table 2 (span = 3)
 *   [e4, e5],          // i = 3: column of Entity
 *   [p4, p5],          // i = 4: column of Position
 *   [v4, v5],          // i = 5: column of Velocity
 * ];
 *
 * length calculation
 * 1st group: this._columns[0].length = 3
 * 2nd group: this._columns[3].length = 2
 * total: 3 + 2 = 5
 * ```
 */
Object.defineProperty(Query.prototype, 'length', {
  get() {
    let result = 0;
    const span = this._components.length + 1;
    for (let i = 0; i < this._columns.length; i += span) {
      result += this._columns[i]!.length;
    }
    return result;
  },
});

/**
 * example:
 * ```ts
 * for (const [position, velocity] of query) {
 *   position.x += velocity.x;
 *   position.y += velocity.y;
 * }
 * ```
 */
Query.prototype[Symbol.iterator] = function* <
  A extends Accessor | Accessor[],
  F extends Filter,
>(this: Query<A, F>) {
  const elements = [];
  const componentCount = this._components.length;
  const groupSpan = componentCount + 1;

  for (
    let columnGroup = 0;
    columnGroup < this._columns.length;
    columnGroup += groupSpan
  ) {
    const {length} = this._columns[columnGroup]!;
    for (let iterations = 0; iterations < length; iterations++) {
      for (let offset = 0; offset < componentCount; offset++) {
        elements[offset] = this._columns[columnGroup + offset + 1]![iterations];
      }
      yield (this._isIndividual ? elements[0] : elements) as A;
    }
  }
};

/**
 * equal to `[Symbol.iterator]`
 *
 * example:
 * ```ts
 * for (const column of query.iter()) {
 *   console.log(column);
 * }
 * ```
 */
Query.prototype.iter = Query.prototype[Symbol.iterator];

/**
 * example:
 * ```ts
 * query.forEach((entity, index) => {
 *   console.log(entity.id);
 * });
 * ```
 */
Query.prototype.forEach = function (
  callback: (args: Accessor[], index: number) => void,
) {
  let index = 0;
  for (const entity of this) {
    callback(entity, index++);
  }
};

/**
 * example:
 * ```ts
 * query.reduce((entities, entity, index) => {
 *   return entities.concat(entity);
 * }, []);
 * ```
 */
Query.prototype.reduce = function <T>(
  callback: (acc: T, entity: Accessor[], index: number) => T,
  initialValue: T,
) {
  let index = 0;
  for (const result of this) {
    initialValue = callback(initialValue, result, index++);
  }
  return initialValue;
};

/**
 * example:
 * ```ts
 * query.get(entity);
 * ```
 */
Query.prototype.get = function (entity: Entity): Accessor[] | null {
  const {tableId, tableRow} = entity.getLocation();
  const table = this._world.tables[tableId];
  if (!this._testArchetype(table!.archetype)) {
    return null;
  }
  const result: Accessor[] = [];
  for (const component of this._components) {
    result.push(table!.getColumn(component)[tableRow]);
  }
  return result;
};

/**
 * example:
 * ```ts
 * query.single();
 * ```
 */
Query.prototype.single = function (): Accessor {
  const [result] = this;
  return result as Accessor;
};

/**
 * Iterates all _unique_ pairs in the query.
 *
 * example:
 * ```ts
 * for (const [entity1, entity2] of query.pairs()) {
 *   console.log(entity1, entity2);
 * }
 * ```
 */
Query.prototype.pairs = function* (): IterableIterator<[Accessor, Accessor]> {
  const result: [Accessor, Accessor] = [null, null] as any;
  let i = 0;
  for (const iter1 of this) {
    let j = 0;
    for (const iter2 of this) {
      if (i <= j) {
        continue;
      }
      result[0] = iter1;
      result[1] = iter2;
      yield result;
      j++;
    }
    i++;
  }
};

/**
 * @internal
 * test if an archetype matches the query, return false before update()
 */
Query.prototype._testArchetype = function (archetype: bigint): boolean {
  for (let i = 0; i < this._filters.length; i += 2) {
    const withFilter = this._filters[i]!;
    const withoutFilter = this._filters[i + 1]!;
    if (
      (withFilter & archetype) === withFilter &&
      (withoutFilter & archetype) === 0n
    ) {
      return true;
    }
  }
  return false;
};

// * --------------------------------------------------------------------------
// * Filter
// * --------------------------------------------------------------------------

/**
 * The base class for a condition (or conditions) that entities must satisfy in
 * order to match a query.
 */
export class Filter<T extends object[] = object[]> {
  static intoArgument<T extends object[]>(
    world: World,
    ...children: T
  ): Filter<T> {
    return new this(world, children);
  }

  world: World;
  children: T;
  constructor(world: World, children: T) {
    this.world = world;
    this.children = children;
  }

  execute(current: bigint[]): bigint[] {
    return current;
  }
}
/**
 * A predicate that ensures only entities **with** the specified components will match a query.
 */
export class With<
  A extends object,
  B extends object = object,
  C extends object = object,
  D extends object = object,
> extends Filter<Class[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return current.map((val, i) =>
      i % 2 === 0 ? val | this.world.getArchetype(...this.children) : val,
    );
  }
}

/**
 * A predicate that ensures only entities **without** the specified components will match a query.
 */
export class Without<
  A extends object,
  B extends object = object,
  C extends object = object,
  D extends object = object,
> extends Filter<Class[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return current.map((val, i) =>
      i % 2 === 1
        ? val | (this.world.getArchetype(...this.children) ^ 1n)
        : val,
    );
  }
}

/**
 * A connective that ensures that **all** of the provided conditions must be met for a query to match.
 */
export class And<
  A extends Filter,
  B extends Filter,
  C extends Filter = any,
  D extends Filter = any,
> extends Filter<Filter[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return this.children.reduce((acc, filter) => filter.execute(acc), current);
  }
}

/**
 * A connective that ensures that **at least one** of the provided conditions must be met for a query to match.
 */
export class Or<
  A extends Filter,
  B extends Filter,
  C extends Filter = any,
  D extends Filter = any,
> extends Filter<Filter[]> {
  // @ts-ignore force TypeScript to check the generic parameters
  __: [A, B, C, D] = true as any;
  override execute(current: bigint[]): bigint[] {
    return this.children.flatMap((filter) => filter.execute(current));
  }
}

export function DEV_ASSERT_FILTER_VALID(filters: bigint[]) {
  DEV_ASSERT(
    filters.some((f, i) => i % 2 === 0 && (f & filters[i + 1]!) === 0n),
    'Impossible query - cannot match any entities.',
  );
}

// * --------------------------------------------------------------------------
// * modifier
// * --------------------------------------------------------------------------

/**
 * A type that may or may not be present.
 */
export type Maybe<T> = T | undefined;
export const Maybe = {
  intoArgument(_: World, type: Class) {
    return {modifier: 'maybe', type};
  },
  isMaybe(value: any): value is {modifier: string; type: Class} {
    return typeof value === 'object' && value.modifier === 'maybe';
  },
};

export type AccessorDescriptor = Class | {modifier: string; type: Class};
export type Accessor = Maybe<object>;
export {Query};
