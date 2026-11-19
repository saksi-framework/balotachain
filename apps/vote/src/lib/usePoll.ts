import { useCallback, useEffect, useRef, useState } from "react";

/** How often a waiting screen reads the console again (D9: every 2 to 3 s). */
export const POLL_MS = 2500;

/**
 * After this many failed reads in a row (about 7.5 s at `POLL_MS`), the
 * waiting screen says, in one quiet line, that it cannot reach the server.
 * Fewer failures show nothing: one dropped read on a phone hotspot is normal.
 */
export const POLL_FAILURES_SHOWN = 3;

/** A write still running after this long gets one line under its button. */
export const SLOW_MS = 10_000;

/** The loading screen offers Retry after this long (D12). */
export const LOADING_EXIT_MS = 15_000;

function visible(): boolean {
  return globalThis.document?.visibilityState !== "hidden";
}

export interface Poll {
  /** A read now, outside the timer ("Check now"). Shares the in-flight read. */
  checkNow: () => Promise<void>;
  /** A read started by `checkNow` is running. */
  checking: boolean;
  /** Failed reads in a row; 0 after any read that worked. */
  failures: number;
  /** What the last failed read threw (null after a read that worked). */
  lastError: unknown;
}

/**
 * "Poll while visible" (D9): calls `read` every `intervalMs` while the tab is
 * visible, never while it is hidden, once at once when it becomes visible
 * again, and never twice at the same time (a tick that finds the previous
 * read still running is skipped). Stops on unmount. A read that throws keeps
 * the screen as it is and is tried again on the next tick; `failures` counts
 * them so the screen can say so after `POLL_FAILURES_SHOWN`.
 */
export function usePollWhileVisible(
  read: () => Promise<void>,
  { intervalMs = POLL_MS, enabled = true } = {},
): Poll {
  const latest = useRef(read);
  latest.current = read;
  const inFlight = useRef<Promise<void> | null>(null);
  const alive = useRef(true);
  const [checking, setChecking] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lastError, setLastError] = useState<unknown>(null);

  const tick = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const p = (async () => {
      try {
        await latest.current();
        if (alive.current) {
          setFailures(0);
          setLastError(null);
        }
      } catch (e) {
        if (alive.current) {
          setFailures((n) => n + 1);
          setLastError(e);
        }
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) {
        timer = setInterval(() => {
          if (visible() && !inFlight.current) void tick();
        }, intervalMs);
      }
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (visible()) {
        void tick();
        start();
      } else {
        stop();
      }
    };
    if (visible()) start();
    globalThis.document?.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive.current = false;
      stop();
      globalThis.document?.removeEventListener(
        "visibilitychange",
        onVisibility,
      );
    };
  }, [enabled, intervalMs, tick]);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      await tick();
    } finally {
      if (alive.current) setChecking(false);
    }
  }, [tick]);

  return { checkNow, checking, failures, lastError };
}

/** True once `active` has stayed true for `ms` (the "still working" line). */
export function useSlow(active: boolean, ms: number = SLOW_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!active) return;
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return active && slow;
}
