import React from 'react';

import { Entity as _Entity } from '@ecs-pcl/ecs';
import { useMount, useUnmount } from 'ahooks';

import { EntityContext } from '../hooks/useEntity';
import { ECSContext } from './ecs';

export type EntityRef = {
  entity: _Entity;
};

export type EntityProps = {
  children: React.ReactNode;
  entity?: _Entity;
};

export const EntityComponent: React.ForwardRefRenderFunction<
  EntityRef,
  EntityProps
> = ({ children, entity: providedEntity }, ref) => {
  const { engine } = React.useContext(ECSContext);
  const entity = React.useMemo(
    () => providedEntity || new _Entity(),
    [providedEntity],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      entity,
    }),
    [entity],
  );

  useMount(() => {
    engine.addEntity(entity);
  });

  useUnmount(() => {
    entity.clear();
    entity.invalidate();
    engine.removeEntity(entity);
  });

  return (
    <EntityContext.Provider value={entity}>{children}</EntityContext.Provider>
  );
};

export const Entity = React.forwardRef(EntityComponent);
