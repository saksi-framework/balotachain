/**
 * Which page `/admin/` is: the live presenter or the study wizard. The same
 * rule as the board and the trustee page (apps/auditor `probeEntry`):
 *
 * - 200 from `GET /api/live/election` is live;
 * - 404 with exactly "no live election has been set up" is live, Setup step;
 * - any other answer below 500 that is not 408 or 429 (404 "live mode is
 *   off", a non-JSON page, 401, 403) is the study wizard;
 * - an answer that says nothing (a network error, 5xx, 408, 429, or no answer
 *   within `PROBE_LIMIT_MS`) is tried again, `PROBE_TRIES` times in all, and
 *   then the page says so and offers to probe again. Never the study wizard
 *   on silence, never an endless skeleton.
 */
import type { LiveElectionView } from "./types";

export type Entry =
  | { kind: "live"; view: LiveElectionView | null }
  | { kind: "study" }
  | { kind: "unanswered" };

/** One try waits this long for an answer. */
export const PROBE_LIMIT_MS = 4000;
/** Tries in all before the page says it got no answer. */
export const PROBE_TRIES = 4;
/** Waits between tries: a short backoff. */
export const PROBE_BACKOFF_MS = [500, 1000, 2000];

const BASE: string = (import.meta.env.VITE_CONSOLE_URL ?? "").replace(
  /\/$/,
  "",
);

const NO_LIVE_ELECTION = "no live election has been set up";

/** A status that says nothing about the page. */
export function saysNothing(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

function isElectionView(body: unknown): body is LiveElectionView {
  if (typeof body !== "object" || body === null) return false;
  const v = body as Record<string, unknown>;
  return (
    typeof v.run_id === "string" &&
    v.run_id !== "" &&
    typeof v.state === "string"
  );
}

/** The answer says its body is JSON. */
function saysJson(res: Response): boolean {
  return /\bjson\b/i.test(res.headers.get("Content-Type") ?? "");
}

/** One question to the console; null when it said nothing. */
async function ask(signal: AbortSignal): Promise<Entry | null> {
  let res: Response;
  try {
    res = await fetch(BASE + "/api/live/election", {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch {
    return null;
  }
  if (saysNothing(res.status)) return null;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    if (signal.aborted) return null;
    // A 200 that says it is JSON but does not parse was cut off on the way:
    // it says nothing, and is asked again, never taken as the study wizard.
    if (res.ok && saysJson(res)) return null;
    // A non-JSON page (an older console's catch-all): an answer, not live.
    return { kind: "study" };
  }
  if (res.status === 404) {
    const error = (body as { error?: unknown } | null)?.error;
    return error === NO_LIVE_ELECTION
      ? { kind: "live", view: null }
      : { kind: "study" };
  }
  if (res.ok && isElectionView(body)) return { kind: "live", view: body };
  return { kind: "study" };
}

/** Waits `ms`, or less if `signal` aborts; the timer never outlives it. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = window.setTimeout(done, ms);
    function done() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done);
  });
}

/** One try with a time limit; its own abort and timer are cleaned up. */
async function tryOnce(signal: AbortSignal): Promise<Entry | null> {
  const inner = new AbortController();
  const stop = () => inner.abort();
  signal.addEventListener("abort", stop);
  let timer: number | undefined;
  const limit = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => {
      inner.abort();
      resolve(null);
    }, PROBE_LIMIT_MS);
  });
  try {
    return await Promise.race([ask(inner.signal), limit]);
  } finally {
    window.clearTimeout(timer);
    inner.abort();
    signal.removeEventListener("abort", stop);
  }
}

export async function probeEntry(signal: AbortSignal): Promise<Entry> {
  for (let i = 0; i < PROBE_TRIES; i++) {
    if (i > 0) await sleep(PROBE_BACKOFF_MS[i - 1] ?? 2000, signal);
    if (signal.aborted) break;
    const entry = await tryOnce(signal);
    if (entry) return entry;
  }
  return { kind: "unanswered" };
}
