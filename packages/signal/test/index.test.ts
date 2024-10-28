import {Signal} from '../src';
import { describe, it, expect } from "vitest"

describe('Signals', function () {
  it('连接 handler 可以正确增加', () => {
    const signal = new Signal<(value: number) => void>();
    signal.connect((value: number) => {});
    expect(signal.hasHandlers).toBeTruthy();
    expect(signal.handlersAmount).toEqual(1);
  });

  it('重复的连接只会添加一次', () => {
    const signal = new Signal<(value: number) => void>();
    const handler = (value: number) => {};
    signal.connect(handler);
    signal.connect(handler);
    expect(signal.handlersAmount).toBe(1);
  });

  it('断开 handler 可以正确减少', () => {
    const signal = new Signal<(value: number) => void>();
    const handler = (value: number) => {};
    signal.connect(handler);
    signal.disconnect(handler);
    expect(signal.hasHandlers).toBeFalsy();
  });

  it('点开未添加的 handler 不会增加 handler 数量', () => {
    const signal = new Signal<(value: number) => void>();
    const addedHandler = (value: number) => {};
    const wrongHandler = (value: number) => {};
    signal.connect(addedHandler);
    signal.disconnect(wrongHandler);
    expect(signal.handlersAmount).toEqual(1);
  });

  it('清空所有的 handler', () => {
    const signal = new Signal<(value: number) => void>();
    signal.connect(() => {});
    signal.connect(() => {});
    signal.connect(() => {});
    signal.disconnectAll();
    expect(signal.hasHandlers).toBeFalsy();
  });
});
