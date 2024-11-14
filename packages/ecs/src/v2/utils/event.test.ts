import {describe, expect, it} from 'vitest';

import {event} from './event';

describe('Events', () => {
  it('create event', () => {
    const test = event();
    expect(test).toBeDefined();
  });

  it('subscribe handler can increase correctly', () => {
    const test = event().subscribe(() => {});
    expect(test.hasSubscribers).toBeTruthy();
    expect(test.subscriberCount).toEqual(1);
  });

  it('repeat subscribe handler only add once', () => {
    const test = event();
    const handler = () => {};
    test.subscribe(handler);
    test.subscribe(handler);
    expect(test.subscriberCount).toEqual(1);
  });

  it('unsubscribe handler can decrease correctly', () => {
    const test = event();
    const handler = () => {};
    test.subscribe(handler);
    test.unsubscribe(handler);
    expect(test.subscriberCount).toEqual(0);
  });

  it('unsubscribe handler that not subscribe will not affect the count', () => {
    const test = event();
    const addedHandler = () => {};
    const wrongHandler = () => {};
    test.subscribe(addedHandler);
    test.unsubscribe(wrongHandler);
    expect(test.subscriberCount).toEqual(1);
  });

  it('clear all subscribers', () => {
    const test = event()
      .subscribe(() => {})
      .subscribe(() => {});
    expect(test.subscriberCount).toEqual(2);
    test.clear();
    expect(test.subscriberCount).toEqual(0);
  });
});
