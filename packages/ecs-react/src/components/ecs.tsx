import {createContext, ProviderProps} from 'react';

import {Engine, Entity} from '@sadim/ecs';

import {System} from '../lib/system';
import {SystemsManager} from '../lib/systems-manager';

export const ECSContext = createContext<ECS>(null as unknown as ECS);

/**
 * 实现一个相比较 ecs lib 中 ECS 的简化版本
 *
 * ECS 类是一个适配层 Adapter:
 *  包含了原始的 engine 实例
 *  添加了 React Context 集成
 *  使用 SystemsManager 管理器来管理系统优先级
 *  简化了对外的接口
 *
 * 使用示例:
 *  const ecs = new ECS(
 *    [system_move, system_attack], // 初始系统
 *    [entity_player, entity_enemy] // 初始实体
 *  );
 *  <ECSContext.Provider value={ecs}>
 *    <Game />
 *  </ECSContext.Provider>
 */
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
      <ECSContext.Provider value={this}> {props.children} </ECSContext.Provider>
    );
  }
}
