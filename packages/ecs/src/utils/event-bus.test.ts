import {describe, expect, it} from 'vitest';

import {eventBus} from './event-bus';

describe('Events', () => {
  it('create event', () => {
    const test = eventBus();
    expect(test).toBeDefined();
  });

  it('subscribe handler can increase correctly', () => {
    const test = eventBus().subscribe(() => {});
    expect(test.hasSubscribers).toBeTruthy();
    expect(test.subscriberCount).toEqual(1);
  });

  it('repeat subscribe handler only add once', () => {
    const test = eventBus();
    const handler = () => {};
    test.subscribe(handler);
    test.subscribe(handler);
    expect(test.subscriberCount).toEqual(1);
  });

  it('unsubscribe handler can decrease correctly', () => {
    const test = eventBus();
    const handler = () => {};
    test.subscribe(handler);
    test.unsubscribe(handler);
    expect(test.subscriberCount).toEqual(0);
  });

  it('unsubscribe handler that not subscribe will not affect the count', () => {
    const test = eventBus();
    const addedHandler = () => {};
    const wrongHandler = () => {};
    test.subscribe(addedHandler);
    test.unsubscribe(wrongHandler);
    expect(test.subscriberCount).toEqual(1);
  });

  it('clear all subscribers', () => {
    const test = eventBus()
      .subscribe(() => {})
      .subscribe(() => {});
    expect(test.subscriberCount).toEqual(2);
    test.clear();
    expect(test.subscriberCount).toEqual(0);
  });
});
