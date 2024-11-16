import {Entity} from '../entity/entity';

type ComponentType = any; // 组件类型
type ComponentId = number; // 组件ID
type Tick = number; // 计时器

function getCurrentTick(): number {
  return Date.now(); // 简化的实现
}

// * --------------------------------------------------------------------------
// * Column
// * --------------------------------------------------------------------------

export class Column<T = any> {
  data: T[];
  addedTicks: Tick[];
  changedTicks: Tick[];

  constructor(capacity: number = 0) {
    this.data = new Array(capacity);
    this.addedTicks = new Array(capacity);
    this.changedTicks = new Array(capacity);
  }

  init(row: number, value: T, tick: number) {
    this.data[row] = value;
    this.addedTicks[row] = tick;
    this.changedTicks[row] = tick;
  }

  get(row: number): T | undefined {
    return this.data[row];
  }

  set(row: number, value: T, tick: number) {
    this.data[row] = value;
    this.changedTicks[tick] = tick;
  }
}

// * --------------------------------------------------------------------------
// * Table
// * --------------------------------------------------------------------------

export class Table {
  private columns: Map<ComponentId, Column<any>> = new Map();
  private entities: Entity[] = [];

  constructor(components: ComponentId[]) {
    for (const component of components) {
      this.columns.set(component, new Column());
    }
  }

  allocate(entity: Entity): number {
    const row = this.entities.length;
    this.entities[row] = entity;
    return row;
  }

  remove(row: number): Entity | undefined {
    const lastRow = this.entities.length;
    if (row === lastRow) {
      return this.entities.pop();
    }
    for (const column of this.columns.values()) {
      const temp = column.get(row);
      column.set(row, column.get(lastRow), getCurrentTick());
      column.set(lastRow, temp, getCurrentTick());
    }
    const movedEntity = this.entities[lastRow]!;
    this.entities[row] = movedEntity;
    return this.entities.pop();
  }

  // 获取组件
  getColumn<T>(componentType: any): Column<T> | undefined {
    return this.columns.get(componentType) as Column<T>;
  }

  // 移动实体到新表格
  move(
    row: number,
    targetTable: Table,
  ): {
    newRow: number;
    swapped: Entity | undefined;
  } {
    const entity = this.entities[row]!;
    const newRow = targetTable.allocate(entity);

    // 移动共享的组件
    for (const [componentType, column] of this.columns) {
      if (targetTable.hasColumn(componentType)) {
        const value = column.get(row);
        targetTable
          .getColumn(componentType)
          ?.set(newRow, value, getCurrentTick());
      }
    }

    // 移除原表格中的实体
    const swapped = this.remove(row);

    return {
      newRow,
      swapped: swapped === entity ? undefined : swapped,
    };
  }

  hasColumn(componentType: ComponentType): boolean {
    return this.columns.has(componentType);
  }

  get length(): number {
    return this.entities.length;
  }
}

// * --------------------------------------------------------------------------
// * Tables
// * --------------------------------------------------------------------------

export class Tables {
  private tables: Table[] = [];
  private tablesByComponents = new Map<string, number>();

  getOrCreate(components: ComponentType[]): number {
    const key = components
      .map((c) => c.name)
      .sort()
      .join(',');
    let tableId = this.tablesByComponents.get(key);

    if (tableId === undefined) {
      tableId = this.tables.length;
      this.tables.push(new Table(components));
      this.tablesByComponents.set(key, tableId);
    }

    return tableId;
  }

  get(tableId: number): Table | undefined {
    return this.tables[tableId];
  }
}
