// Use MAX_U32 to represent the maximum index value.
const MAX_INDEX = 0xffffffff;

// Use MIN_GENERATION to represent the minimum non-zero generation value.
const MIN_GENERATION = 1;

interface EntityData {
  index: number;
  generation: number;
}

/**
 * Lightweight identifier of an entity.
 */
export class Entity {
  /**
   * An entity ID with a placeholder value. This may or may not correspond to an actual entity,
   * and should be overwritten by a new value before being used.
   *
   * ## Examples
   *
   * Initializing a collection with a known size:
   *
   * const entities: Entity[] = Array(10).fill(Entity.PLACEHOLDER);
   */
  static readonly PLACEHOLDER = new Entity(MAX_INDEX, MIN_GENERATION);

  /**
   * Validate the index and generation of an entity.
   */
  static validate(index: number, generation: number): void {
    if (index < 0 || index > MAX_INDEX) {
      throw new Error('Invalid entity index');
    }
    if (generation < MIN_GENERATION) {
      throw new Error("Entity's generation must be greater than 0");
    }
  }

  /**
   * Creates a new entity ID with the specified `index` and a generation of 1.
   */
  static fromRaw(index: number): Entity {
    return new Entity(index, MIN_GENERATION);
  }

  /**
   * Create an entity from a JSON string.
   */
  static deserialize(data: string): Entity {
    try {
      const parsed = JSON.parse(data) as EntityData;
      if (
        typeof parsed !== 'object' ||
        typeof parsed.index !== 'number' ||
        typeof parsed.generation !== 'number'
      ) {
        throw new Error('Invalid entity data format');
      }
      return new Entity(parsed.index, parsed.generation);
    } catch (e) {
      throw new Error(`Failed to deserialize entity: ${e}`);
    }
  }

  /**
   * The identifier is implemented using a [generational index].
   * This allows fast insertion after data removal in an array while minimizing loss of spatial locality.
   *
   * [generational index]: https://lucassardois.medium.com/generational-indices-guide-8e3c5f7fd594
   */
  #index: number;
  /**
   * Use a generation number to avoid dangling references.
   */
  #generation: number;

  constructor(index: number, generation: number) {
    Entity.validate(index, generation);
    this.#index = index;
    this.#generation = generation;
  }

  /**
   * Return a transiently unique identifier.
   *
   * No two simultaneously-live entities share the same index.
   * Dead entities' indices may collide with both live and dead entities.
   *
   * Useful for compactly representing entities within a specific snapshot of the world.
   *
   */
  get index(): number {
    return this.#index;
  }

  /**
   * Returns the generation of this Entity's index.
   *
   * The generation is incremented each time an entity with a given index is despawned.
   */
  get generation(): number {
    return this.#generation;
  }

  /**
   * Strict equality check.
   */
  equals(other: Entity): boolean {
    return (
      this.#index === other.#index && this.#generation === other.#generation
    );
  }

  /**
   * Serialize to a JSON string.
   */
  serialize(): string {
    return JSON.stringify({
      index: this.#index,
      generation: this.#generation,
    });
  }

  /**
   * Return a string representation of this entity.
   */
  toString(): string {
    if (this === Entity.PLACEHOLDER) {
      return 'PLACEHOLDER';
    }
    return `${this.#index}v${this.#generation}`;
  }
}
