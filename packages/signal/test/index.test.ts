import { signal } from "../src";
import { describe, it, expect } from "vitest";

describe("Signals", () => {
  it("should create a signal", () => {
    const test = signal();
    expect(test).toBeDefined();
  });

  it("连接 handler 可以正确增加", () => {
    const test = signal().connect(() => {});
    expect(test.hasHandlers).toBeTruthy();
    expect(test.handlersAmount()).toEqual(1);
  });

  it("重复的连接只会添加一次", () => {
    const test = signal();
    const handler = () => {};
    test.connect(handler);
    test.connect(handler);
    expect(test.handlersAmount()).toEqual(1);
  });

  it("断开 handler 可以正确减少", () => {
    const test = signal();
    const handler = () => {};
    test.connect(handler);
    test.disconnect(handler);
    expect(test.handlersAmount()).toEqual(0);
  });

  it("点开未添加的 handler 不会增加 handler 数量", () => {
    const test = signal();
    const addedHandler = (value: number) => {};
    const wrongHandler = (value: number) => {};
    test.connect(addedHandler);
    test.disconnect(wrongHandler);
    expect(test.handlersAmount()).toEqual(1);
  });

  it("清空所有的 handler", () => {
    const test = signal()
      .connect(() => {})
      .connect(() => {});
    expect(test.handlersAmount()).toEqual(2);
    test.clear();
    expect(test.handlersAmount()).toEqual(0);
  });
});