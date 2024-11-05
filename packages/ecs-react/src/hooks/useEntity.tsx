import {createContext, useContext} from 'react';

import {Entity} from '@ecs-pcl/ecs';

export const EntityContext = createContext<Entity | null>(null);

export function useEntity() {
  const entity = useContext(EntityContext);
  if (!entity) {
    throw new Error('Missing Entity instance in EntityContext!');
  }
  return entity as Entity;
}
