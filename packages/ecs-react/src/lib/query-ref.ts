import {MutableRefObject} from 'react';

import {Entity, QueryPredicate} from '@sadim/ecs';

import {Query} from './query';
import {Constructor, Constructors, Instances} from './utils';

/**
 * 对 Query 进行包装，提供一些额外的功能
 *  空值检查
 *  更安全的访问
 */
export class QueryRef {
  ref: MutableRefObject<Query>;

  constructor(ref: MutableRefObject<Query>) {
    this.ref = ref;
  }

  get current() {
    return this.ref.current;
  }

  loop<T extends Constructor[], K extends Constructors<T>>(
    types: K,
    cb: (entity: Entity, instances: Instances<T, K>) => void,
  ) {
    if (this.current) {
      return this.current.loop(types, cb);
    }
  }

  get entities() {
    if (this.current) {
      return this.current.entities;
    }
    return [];
  }

  get first() {
    if (this.current) {
      return this.current.first;
    }
    return null;
  }

  get last() {
    if (this.current) {
      return this.current.last;
    }
    return null;
  }

  get length() {
    if (this.current) {
      return this.current.length;
    }
    return 0;
  }

  countBy(predicate: QueryPredicate) {
    if (this.current) {
      return this.current.countBy(predicate);
    }
    return 0;
  }

  filter(predicate: QueryPredicate): Entity[] {
    if (this.current) {
      return this.current.filter(predicate);
    }
    return [];
  }

  has(entity: Entity) {
    if (this.current) {
      return this.current.has(entity);
    }
    return false;
  }

  get isEmpty() {
    if (this.current) {
      return this.current.isEmpty;
    }
    return true;
  }

  clear() {
    if (this.current) {
      return this.current.clear();
    }
  }
}
