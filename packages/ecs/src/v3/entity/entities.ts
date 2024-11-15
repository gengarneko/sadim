import {Entity} from './entity';

// * --------------------------------------------------------------------------
// * EntityLocation
// * --------------------------------------------------------------------------

/**
 * 实体在存储中的位置
 */
export class EntityLocation {
  constructor(
    public readonly archetypeId: number,
    public readonly archetypeRow: number,
    // public readonly tableId: number,
    // public readonly tableRow: number,
  ) {}

  // 无效位置常量
  static readonly INVALID = new EntityLocation(-1, -1);

  equals(other: EntityLocation): boolean {
    return (
      this.archetypeId === other.archetypeId &&
      this.archetypeRow === other.archetypeRow
    );
  }
}

export interface EntityMeta {
  generation: Entity['generation'];
  location: EntityLocation;
}

export const EMPTY_META: EntityMeta = {
  generation: 1,
  location: EntityLocation.INVALID,
};

// * --------------------------------------------------------------------------
// * Entities
// * --------------------------------------------------------------------------

export class Entities {
  /** 存储所有实体的元数据 */
  #meta: EntityMeta[] = [];

  /** 待处理的实体索引 */
  #pending: number[] = [];

  /** 可重用的索引列表 */
  #freelist: number[] = []; // 添加 freelist 存储可重用的索引

  // debug
  // get meta(): EntityMeta[] {
  //   return this.#meta;
  // }

  private verifyFlushed(): void {
    if (this.#pending.length > 0) {
      throw new Error('Entities must be flushed before allocation');
    }
  }

  /**
   * 获取实体的元数据
   * @returns null 如果实体无效
   */
  getMeta(entity: Entity): EntityMeta | null {
    const meta = this.#meta[entity.index];
    return meta && meta.generation === entity.generation ? meta : null;
  }

  /**
   * Allocate an entity ID directly.
   */
  alloc(): Entity {
    this.verifyFlushed();
    if (this.#freelist.length > 0) {
      const index = this.#freelist.pop()!;
      return new Entity(index, this.#meta[index]!.generation);
    } else {
      const index = this.#meta.length;
      this.#meta.push({...EMPTY_META});
      return Entity.fromRaw(index);
    }
  }

  /**
   * 释放实体
   */
  free(entity: Entity): EntityLocation | null {
    const meta = this.#meta[entity.index];
    if (!meta) return null;

    const oldLocation = meta.location;
    meta.generation++;
    meta.location = EntityLocation.INVALID;

    // 加入待处理列表
    this.#pending.push(entity.index);
    this.#freelist.push(entity.index);

    return oldLocation;
  }

  /**
   * 执行刷新
   */
  flush(f: (entity: Entity, location: EntityLocation) => void): void {
    for (const index of this.#pending) {
      const meta = this.#meta[index]!;
      f(new Entity(index, meta.generation), meta.location);
    }
    this.#pending = [];
  }

  /**
   * 检查实体是否存在
   */
  contains(entity: Entity): boolean {
    return this.getMeta(entity) !== null;
  }

  /**
   * 获取实体的位置
   */
  get(entity: Entity): EntityLocation | null {
    const meta = this.getMeta(entity);
    if (!meta || meta.location.equals(EntityLocation.INVALID)) {
      return null;
    }
    return meta.location;
  }

  /**
   * 设置实体的位置
   */
  set(entity: Entity, location: EntityLocation): void {
    const meta = this.getMeta(entity);
    if (meta) {
      meta.location = location;
    }
  }

  clear(): void {
    this.#meta = [];
    this.#pending = [];
    this.#freelist = [];
  }

  isEmpty(): boolean {
    return this.#meta.length === 0;
  }

  totalCount(): number {
    return this.#meta.length;
  }
}
