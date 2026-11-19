import { afterEach, describe, expect, it, vi } from "vitest";
import { pollSignal } from "./pollSignal.js";

afterEach(() => vi.useRealTimers());

describe("pollSignal", () => {
  it("aborts after the time limit, the parent untouched", () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const { signal } = pollSignal(parent.signal, 10_000);
    vi.advanceTimersByTime(9_999);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
    expect((signal.reason as Error).message).toBe("no answer within 10 s");
    expect(parent.signal.aborted).toBe(false);
  });

  it("aborts with the parent", () => {
    const parent = new AbortController();
    const { signal } = pollSignal(parent.signal);
    parent.abort();
    expect(signal.aborted).toBe(true);
  });

  it("starts aborted under an aborted parent", () => {
    const parent = new AbortController();
    parent.abort();
    expect(pollSignal(parent.signal).signal.aborted).toBe(true);
  });

  it("done clears the timer", () => {
    vi.useFakeTimers();
    const { signal, done } = pollSignal(undefined, 100);
    done();
    vi.advanceTimersByTime(1000);
    expect(signal.aborted).toBe(false);
  });
});
