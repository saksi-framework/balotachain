import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { POLL_MS, usePollWhileVisible, useSlow } from "./usePoll";

let hidden = false;

function setVisibility(h: boolean) {
  hidden = h;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() =>
    hidden ? "hidden" : "visible",
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Let the read's promise chain settle under fake timers. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("usePollWhileVisible (D9)", () => {
  it("reads every 2 to 3 seconds while the page is visible", async () => {
    expect(POLL_MS).toBeGreaterThanOrEqual(2000);
    expect(POLL_MS).toBeLessThanOrEqual(3000);
    const read = vi.fn(async () => {});
    renderHook(() => usePollWhileVisible(read));
    expect(read).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(POLL_MS - 1));
    expect(read).toHaveBeenCalledTimes(0);
    await act(async () => vi.advanceTimersByTime(1));
    expect(read).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 3; i++) {
      await flush();
      await act(async () => vi.advanceTimersByTime(POLL_MS));
    }
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("does not read while hidden, and reads once at once on return", async () => {
    const read = vi.fn(async () => {});
    renderHook(() => usePollWhileVisible(read));
    act(() => setVisibility(true));
    await act(async () => vi.advanceTimersByTime(POLL_MS * 10));
    expect(read).not.toHaveBeenCalled();
    act(() => setVisibility(false));
    expect(read).toHaveBeenCalledTimes(1);
    await flush();
    await act(async () => vi.advanceTimersByTime(POLL_MS));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("never overlaps reads: a tick while one is in flight is skipped", async () => {
    let finish!: () => void;
    const read = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const { result } = renderHook(() => usePollWhileVisible(read));
    await act(async () => vi.advanceTimersByTime(POLL_MS * 5));
    expect(read).toHaveBeenCalledTimes(1);
    // "Check now" during the read joins it rather than sending another.
    let joined = false;
    act(() => {
      void result.current.checkNow().then(() => (joined = true));
    });
    expect(result.current.checking).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await flush();
    expect(joined).toBe(true);
    expect(result.current.checking).toBe(false);
    await act(async () => vi.advanceTimersByTime(POLL_MS));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps going after failures and counts them; a good read resets the count", async () => {
    let fail = true;
    const read = vi.fn(async () => {
      if (fail) throw new Error("offline");
    });
    const { result } = renderHook(() => usePollWhileVisible(read));
    for (let i = 1; i <= 3; i++) {
      await act(async () => vi.advanceTimersByTime(POLL_MS));
      await flush();
      expect(result.current.failures).toBe(i);
    }
    fail = false;
    await act(async () => vi.advanceTimersByTime(POLL_MS));
    await flush();
    expect(result.current.failures).toBe(0);
  });

  it("stops on unmount", async () => {
    const read = vi.fn(async () => {});
    const { unmount } = renderHook(() => usePollWhileVisible(read));
    unmount();
    await act(async () => vi.advanceTimersByTime(POLL_MS * 5));
    act(() => setVisibility(false));
    expect(read).not.toHaveBeenCalled();
  });
});

describe("useSlow", () => {
  it("turns true after 10 s of the same running write, and false when it ends", async () => {
    const { result, rerender } = renderHook(({ on }) => useSlow(on), {
      initialProps: { on: true },
    });
    await act(async () => vi.advanceTimersByTime(9_999));
    expect(result.current).toBe(false);
    await act(async () => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
  });
});
