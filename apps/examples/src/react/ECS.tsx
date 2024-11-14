import React, {createContext, ProviderProps} from 'react';

import {World} from '../core/ecs';

export const ECSContext = createContext<World>(null as unknown as World);

export class ECS {
  world = new World();

  constructor() {
    this.update = this.update.bind(this);
    this.Provider = this.Provider.bind(this);
  }

  update(dt: number) {
    this.world.runSchedule();
  }

  Provider(props: Omit<ProviderProps<ECS>, 'value'>) {
    return (
      <ECSContext.Provider value={this}>{props.children}</ECSContext.Provider>
    );
  }
}

// export class ECS {
//   engine = new Engine();
//   systems = new SystemsManager();

//   constructor(systems: System[] = [], entities: Entity[] = []) {
//     this.update = this.update.bind(this);
//     this.Provider = this.Provider.bind(this);
//     systems.forEach((s) => this.systems.add(s));
//     entities.forEach((e) => this.engine.addEntity(e));
//   }

//   update(dt: number) {
//     this.systems.update(dt);
//   }

//   Provider(props: Omit<ProviderProps<ECS>, 'value'>) {
//     return (
//       <ECSContext.Provider value={this}>{props.children}</ECSContext.Provider>
//     );
//   }
// }
