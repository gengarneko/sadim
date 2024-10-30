import { createContext, ProviderProps } from 'react';

import { Engine, Entity } from '@ecs-pcl/ecs';

import { SystemsManager } from '../lib/systems-manager';
import { System } from '../lib/system';

export const ECSContext = createContext<ECS>(null as unknown as ECS);

/** 实现一个相比较 ecs lib 中 ECS 的简化版本 */
export class ECS {
  engine = new Engine();
  systems = new SystemsManager();

  constructor(systems: System[] = [], entities: Entity[] = []) {
    this.update = this.update.bind(this);
    this.Provider = this.Provider.bind(this);
    systems.forEach((s) => this.systems.add(s));
    entities.forEach((e) => this.engine.addEntity(e));
  }

  update(dt: number) {
    this.systems.update(dt);
  }

  Provider(props: Omit<ProviderProps<ECS>, 'value'>) {
    return (
      <ECSContext.Provider value= { this} > { props.children } </ECSContext.Provider>
      );
  }
}

