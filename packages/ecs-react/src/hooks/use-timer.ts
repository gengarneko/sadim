import {useRef} from 'react';

import {useSystem} from './use-system';

export const useTimer = (interval: number, callback: () => void) => {
  const time = useRef(0);
  useSystem((dt) => {
    time.current += dt;
    if (time.current > interval) {
      time.current = 0;
      callback();
    }
  });
};
