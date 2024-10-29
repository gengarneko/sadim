import { createSignal } from "../src";
import { describe, it, expect } from "vitest";

describe("Signals", () => {
  it("should create a signal", () => {
    const signal = createSignal();
    expect(signal).toBeDefined();
  });

  it("连接 handler 可以正确增加", () => {
    const signal = createSignal();
    signal.connect(() => {});
    expect(signal.hasHandlers()).toBeTruthy();
    expect(signal.handlersAmount()).toEqual(1);
  });

  it("重复的连接只会添加一次", () => {
    const signal = createSignal();
    const handler = () => {};
    signal.connect(handler);
    signal.connect(handler);
    expect(signal.handlersAmount()).toEqual(1);
  });

  it("断开 handler 可以正确减少", () => {
    const signal = createSignal();
    const handler = () => {};
    signal.connect(handler);
    signal.disconnect(handler);
    expect(signal.handlersAmount()).toEqual(0);
  });

  it("点开未添加的 handler 不会增加 handler 数量", () => {
    const signal = createSignal();
    const addedHandler = (value: number) => {};
    const wrongHandler = (value: number) => {};
    signal.connect(addedHandler);
    signal.disconnect(wrongHandler);
    expect(signal.handlersAmount()).toEqual(1);
  });

  it("清空所有的 handler", () => {
    const signal = createSignal();
    signal.connect(() => {});
    signal.connect(() => {});
    expect(signal.handlersAmount()).toEqual(2);
    signal.clear();
    expect(signal.handlersAmount()).toEqual(0);
  });
});
