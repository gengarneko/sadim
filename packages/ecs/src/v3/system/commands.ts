import {World} from './world';

/**
 * shiyong
 */

export interface CommandMeta {
  execute: (world: World) => void;
}
