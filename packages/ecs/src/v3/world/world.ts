import {Entities} from '../'

export class World {
  id: number = 0;

  // entities: Entities::new(),
  entities: Entities = new Entities();
  components: any[] = [];
  archetypes: Archetypes = new Archetypes();
  storages: any[] = [];
  bundles: any[] = [];
  observers: any[] = [];
  removed_components: any[] = [];

  change_tick: number = 1;
  last_change_tick: number = 0;
  last_check_tick: number = 0;
  last_trigger_id: number = 0;

  command_queue: any[] = [];
}


class World {
  private entities: Entities,
    pub(crate) components: Components,
    pub(crate) archetypes: Archetypes,
    pub(crate) storages: Storages,
    pub(crate) bundles: Bundles,
    pub(crate) observers: Observers,
    pub(crate) removed_components: RemovedComponentEvents,
    pub(crate) change_tick: AtomicU32,
    pub(crate) last_change_tick: Tick,
    pub(crate) last_check_tick: Tick,
    pub(crate) last_trigger_id: u32,
    pub(crate) command_queue: RawCommandQueue,
  constructor() {}
}

export {World};
