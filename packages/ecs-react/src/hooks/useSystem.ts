import { useContext, useEffect } from 'react';

import { ECSContext } from '../components/ecs';
import { System } from '../lib/system';

export const useSystem = (callback: System, priority = 0) => {
  const { systems } = useContext(ECSContext);

  useEffect(() => {
    systems.add(callback, priority);
    return () => {
      systems.remove(callback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, priority]);
  return null;
};
