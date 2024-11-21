import {Class} from '../utils/class';
import {DEV_ASSERT} from '../utils/dev';
import {Entity} from './entity';
import {Table} from './table';
import {World} from './world';

// * --------------------------------------------------------------------------
// * Query
// * --------------------------------------------------------------------------

const EMPTY_COLUMN: [] = [];

export class Query<A extends Accessor | Accessor[], F extends Filter = Filter> {
  private _world: World;

  private _columns: Array<object[]>;
  private _components: Class[];
  private _filters: bigint[];

  private _isIndividual: boolean;

  constructor(
    world: World,
    /**  */
    accessors: AccessorDescriptor | AccessorDescriptor[],
    /**  */
    filter?: Filter,
  ) {
    this._world = world;
    const isIndividual = !Array.isArray(accessors);
    const accessorArr = Array.isArray(accessors) ? accessors : [accessors];
    const components = accessorArr.map((x) => (Maybe.isMaybe(x) ? x.type : x));

    // register optional components
    const optionalComponents = accessorArr.filter((x) => Maybe.isMaybe(x));
    if (optionalComponents.length > 0) {
      const componentTypes = optionalComponents.map((x) => x.type);
      world.getArchetype(...componentTypes);
    }

    // register required components, get archetype
    const initial = world.getArchetype(
      ...accessorArr.filter((x): x is Class => !Maybe.isMaybe(x)),
    );

    const filters = filter ? filter.execute([initial, 0n]) : [initial, 0n];
    this._columns = [];
    this._world = world;
    this._components = components;
    this._isIndividual = isIndividual;
    this._filters = filters;

    this.updateQueryTables();

    this._world.storage.onTableUpdated.subscribe(() => {
      this.updateQueryTables();
    });
  }

  /**
   * Test if archetype matches query filters
   */
  private _testArchetype(archetype: bigint): boolean {
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
  }

  /**
   * Update columns when table changes
   */
  private updateQueryTables(): void {
    this._columns = [];
    for (const table of this._world.storage) {
      if (!this._testArchetype(table.archetype)) continue;

      this._columns.push(table.getColumn(Entity));
      for (const component of this._components) {
        this._columns.push(
          table.hasColumn(component)
            ? table.getColumn(component)
            : EMPTY_COLUMN,
        );
      }
    }
  }

  /**
   * Match and update columns when table changes
   */
  public matchTable(table: Table): void {
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
  }

  /**
   * Get total number of matching entities
   */
  get length(): number {
    let result = 0;
    const span = this._components.length + 1;
    for (let i = 0; i < this._columns.length; i += span) {
      result += this._columns[i]!.length;
    }
    return result;
  }

  /**
   * Iterate over matching entities
   */
  *[Symbol.iterator](): IterableIterator<A> {
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
          elements[offset] =
            this._columns[columnGroup + offset + 1]![iterations];
        }
        yield (this._isIndividual ? elements[0] : elements) as A;
      }
    }
  }

  iter = this[Symbol.iterator];

  forEach(cb: (args: A, index: number) => void): void {
    let index = 0;
    for (const entity of this) {
      cb(entity, index++);
    }
  }

  reduce<T>(cb: (acc: T, args: A, i: number) => T, initial: T): T {
    let index = 0;
    for (const result of this) {
      initial = cb(initial, result, index++);
    }
    return initial;
  }

  get(entity: Entity): A | undefined {
    const {tableId, tableRow} = entity.getLocation();
    const table = this._world.getTableById(tableId);
    if (!this._testArchetype(table!.archetype)) {
      return undefined;
    }

    const result: Accessor[] = [];
    for (const component of this._components) {
      result.push(table!.getColumn(component)[tableRow]);
    }
    return (this._isIndividual ? result[0] : result) as A;
  }

  single(): A | undefined {
    const [result] = this;
    return result;
  }

  *pairs(): IterableIterator<[A, A]> {
    const result: [A, A] = [null!, null!];
    let i = 0;
    for (const iter1 of this) {
      let j = 0;
      for (const iter2 of this) {
        if (i <= j) continue;
        result[0] = iter1;
        result[1] = iter2;
        yield result;
        j++;
      }
      i++;
    }
  }
}

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
