/** A poll request that has not answered by then is given up (review 2, 6). */
export const POLL_TIMEOUT_MS = 10_000;

/**
 * A signal for one poll request: aborted when `parent` is (unmount, sign
 * out), or after `ms`, so one hung request (a Wi-Fi stall, a half-open TCP
 * connection) never holds the poll's in-flight slot for good. The caller
 * tells the two apart by `parent.aborted`: a timeout is a failed poll, shown
 * as one, and the next tick asks again. Call `done` once the request
 * settled, to clear the timer.
 */
export function pollSignal(
  parent?: AbortSignal | null,
  ms: number = POLL_TIMEOUT_MS,
): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort(parent?.reason);
  if (parent?.aborted) ctrl.abort(parent.reason);
  else parent?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () => ctrl.abort(new Error(`no answer within ${Math.round(ms / 1000)} s`)),
    ms,
  );
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}
