import {useContext} from 'react';

import {ECSContext} from '../components/ecs';

export const useEngine = () => {
  const {engine} = useContext(ECSContext);
  return engine;
};
