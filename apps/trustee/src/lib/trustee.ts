/**
 * Typed client for one live trustee process (`saksi-campaign trustee`).
 *
 * Each of the five trustees is its own process on its own host; it serves this
 * app at `/trustee/` and its own API under `/api/trustee/`, so every call here
 * is same-origin. The contract is saksi's `docs/live/trustee-api.md`. Field
 * names are copied from the Go JSON tags (`trustee_http.go` `TrusteeStatus`
 * and its parts, `trustee.go` `trusteeAlarm` and `stepStatus`). Keep them in
 * lock-step.
 *
 * Sign-in (`/api/login`, `/api/logout`, `/api/me`) keeps the console's shapes
 * and is reused from `./bulletin`.
 */
import { ApiError } from "./bulletin";

const BASE: string = (import.meta.env.VITE_CONSOLE_URL ?? "").replace(
  /\/$/,
  "",
);

/** `steps.<step>.state` (trustee-api.md, "Fields"). */
export type StepState =
  | "idle"
  | "running"
  | "waiting"
  | "done"
  | "failed"
  | "refused"
  | "blocked";

export type StepName = "join" | "decrypt" | "sign";

/** Go `stepStatus`. `updated_at` is Go's zero time for a step never touched. */
export type StepStatus = {
  state: StepState;
  detail?: string;
  error?: string;
  updated_at?: string;
};

/** Go `trusteeAlarm`. */
export type TrusteeAlarm = {
  code: string;
  message: string;
  blocks: StepName[] | null;
  at: string;
};

/** Go `LivePosition`. */
export type LivePosition = { id: string; candidates: string[] };

/** Go `TrusteeElection`. `state` is the console's, for display. */
export type TrusteeElection = {
  election_id: string;
  title: string;
  state: string;
  trustees: number;
  threshold: number;
  positions: LivePosition[] | null;
  contest_ids: string[] | null;
  params_checked: boolean;
  ballot_records: number;
};

/** Go `TrusteeRosterEntry`. */
export type TrusteeRosterEntry = {
  trustee_id: number;
  receive_key_fingerprint: string;
  self: boolean;
  peer_check: "self" | "pending" | "ok" | "waiting" | "mismatch";
  detail?: string;
};

/** Go `TrusteeCeremony`. */
export type TrusteeCeremony = {
  receive_key_posted: boolean;
  roster_complete: boolean;
  roster_digest?: string;
  roster: TrusteeRosterEntry[] | null;
  roster_checked: boolean;
  dealt: boolean;
  received: boolean;
  acknowledged: boolean;
  joint_public_key?: string;
  verification_key?: string;
  transcript_published: boolean;
  transcript_check: "" | "ok" | "mismatch";
  ceremony_error?: string;
};

/** Go `TrusteePeerBallotCheck`. */
export type TrusteePeerBallotCheck = {
  trustee_id: number;
  /**
   * `reported`: the peer states a ballot set, and this trustee has none of
   * its own to compare it with. `unreachable`: no statement from the peer;
   * `detail` is "not reachable: ..." when it did not answer, or "answered
   * 503" / "its answer could not be read" when it answered unusably.
   */
  state: "ok" | "waiting" | "mismatch" | "reported" | "unreachable";
  detail?: string;
};

/** Go `TrusteeDecryption`. */
export type TrusteeDecryption = {
  min_ballots: number;
  /**
   * The fewest ballot records the chain must hold before Decrypt can run
   * (`min_ballots` x positions; 0 until the positions are known). Absent
   * from an older process.
   */
  min_ballot_records?: number;
  ballot_count: number;
  ballots_by_position: Record<string, number> | null;
  ballots_digest?: string;
  peer_checks: TrusteePeerBallotCheck[] | null;
  partial_computed: boolean;
  partial_recorded: boolean;
  partial_read_back: "" | "ok" | "mismatch";
  trustees_decrypted: number;
  threshold: number;
};

/** Go `trusteeContestTotal`. */
export type ContestTotal = { contest_id: string; total: number };

/**
 * `tally.signing` (trustee-api.md, "Fields"): where this trustee's own
 * signature stands. The process signs by itself after its own Decrypt; the
 * Sign tally press is only the retry (`retry`).
 */
export type SigningState =
  | "signed"
  | "blocked"
  | "not_needed"
  | "not_decrypted"
  | "refused"
  | "retry"
  | "signing"
  | "waiting";

/** `tally.sign_problem`: why the last automatic attempt did not post. */
export type SignProblem =
  | "console_unreachable"
  | "post_failed"
  | "chain_unreadable"
  | "error";

/** Go `TrusteeTally`. */
export type TrusteeTally = {
  totals: number[] | null;
  contests: ContestTotal[] | null;
  /** Absent only from a process older than automatic signing. */
  signing?: SigningState;
  /** Present only while `signing` is `retry`, `waiting` or `signing`. */
  sign_problem?: SignProblem;
  /**
   * Sign attempts that failed since the last request (the automatic one, or
   * the press); 0 before any and once one posts. Absent from an older
   * process.
   */
  sign_attempts?: number;
  /** The attempts the process makes by itself for one request (3). */
  sign_attempts_max?: number;
  /**
   * True only when Sign tally may be pressed: `signing` is `retry` and the
   * totals are shown. The page's single test for the Sign tally button.
   */
  ready_to_sign: boolean;
  signature_posted: boolean;
  signature_note?: string;
  published: boolean;
  published_totals: number[] | null;
  matches: boolean | null;
};

/** `GET /api/trustee/status` (Go `TrusteeStatus`). */
export type TrusteeStatus = {
  trustee_id: number;
  console: { url: string; reachable: boolean; error?: string };
  identity: { checked: boolean; ok: boolean; error?: string };
  election: TrusteeElection | null;
  step: "" | StepName;
  steps: Partial<Record<StepName, StepStatus>>;
  alarms: TrusteeAlarm[] | null;
  fingerprints: {
    receive_key?: string;
    roster?: string;
    share?: string;
    joint_key?: string;
    ballots?: string;
  };
  ceremony: TrusteeCeremony;
  decryption: TrusteeDecryption;
  tally: TrusteeTally;
  updated_at: string;
};

/** The process's own words: `{"error": "..."}`, or plain text from its guard. */
async function errorText(res: Response): Promise<string> {
  const text = (await res.text()).trim();
  try {
    const body = JSON.parse(text) as { error?: unknown };
    if (typeof body?.error === "string") return body.error;
  } catch {
    // plain text
  }
  return text || `request failed (${res.status})`;
}

/** What `GET /api/trustee/peer` said about this page. */
export type ProbeAnswer =
  | { kind: "live"; id: number }
  | { kind: "study" }
  | { kind: "unknown"; reason: string };

/** One probe gives up after this long without an answer. */
export const PROBE_TIMEOUT_MS = 5000;
/** Tries in all before the page says it cannot tell. */
export const PROBE_TRIES = 4;
/** The wait before each retry. */
export const PROBE_BACKOFF_MS = [500, 1000, 2000];

/**
 * Whether this page is served by a live trustee process, and which trustee.
 *
 * `GET /api/trustee/peer` is public on a trustee process and answers 200 with
 * JSON carrying its numeric `trustee_id`. The study console has no such
 * route: its `/` catch-all answers 404 (plain text) without auth and 401 or
 * 403 (the admin-only access entry for unknown paths) with auth on.
 *
 * Definitive: 200 with a positive integer `trustee_id` is live; 404, 401,
 * 403, or a 200 without that id (a dev server's HTML fallback included) is
 * the study console. Anything else says nothing (a network error, a 5xx,
 * 408, 429, no answer within `PROBE_TIMEOUT_MS`) and is `unknown`.
 */
export async function probeLiveTrustee(
  signal?: AbortSignal,
): Promise<ProbeAnswer> {
  if (signal?.aborted) return STOPPED;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  const stop = () => ctrl.abort();
  signal?.addEventListener("abort", stop);
  try {
    const res = await fetch(BASE + "/api/trustee/peer", {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 200) {
      let body: { trustee_id?: unknown } | null = null;
      try {
        body = (await res.json()) as { trustee_id?: unknown };
      } catch {
        if (ctrl.signal.aborted)
          return { kind: "unknown", reason: "no answer within 5 seconds" };
        return { kind: "study" };
      }
      const id = body?.trustee_id;
      return typeof id === "number" && Number.isInteger(id) && id > 0
        ? { kind: "live", id }
        : { kind: "study" };
    }
    if (res.status === 404 || res.status === 401 || res.status === 403)
      return { kind: "study" };
    return {
      kind: "unknown",
      reason: `the server answered ${res.status} ${res.statusText}`.trim(),
    };
  } catch {
    if (signal?.aborted) return STOPPED;
    return {
      kind: "unknown",
      reason: ctrl.signal.aborted
        ? "no answer within 5 seconds"
        : "the server could not be reached",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

/** What a probe stopped by its caller (the page went away) returns. */
const STOPPED: ProbeAnswer = { kind: "unknown", reason: "stopped" };

/** Waits `ms`, or less if `signal` aborts first. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const t = setTimeout(done, ms);
    signal?.addEventListener("abort", done);
  });
}

/**
 * `probeLiveTrustee` until it gives a definitive answer, `PROBE_TRIES` tries
 * in all with a short backoff. An answer that says nothing is never read as
 * the study console; after the last try it comes back as `unknown`.
 */
export async function probeWithRetry(
  signal?: AbortSignal,
): Promise<ProbeAnswer> {
  let last: ProbeAnswer = { kind: "unknown", reason: "not asked yet" };
  for (let i = 0; i < PROBE_TRIES; i++) {
    if (i > 0) await sleep(PROBE_BACKOFF_MS[i - 1] ?? 2000, signal);
    // Aborted (the page went away): no further request goes out.
    if (signal?.aborted) return STOPPED;
    last = await probeLiveTrustee(signal);
    if (last.kind !== "unknown") return last;
  }
  return last;
}

export async function getStatus(signal?: AbortSignal): Promise<TrusteeStatus> {
  const res = await fetch(BASE + "/api/trustee/status", {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new ApiError(res.status, await errorText(res));
  return (await res.json()) as TrusteeStatus;
}

/**
 * A button press. The process answers 202 with the status at once and keeps
 * working; 409 and 502 carry `{"error"}` in its own words. No timeout: the
 * console can hold a call for minutes during a block wait.
 */
async function press(path: string, body: unknown): Promise<TrusteeStatus> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await errorText(res));
  return (await res.json()) as TrusteeStatus;
}

export function join(): Promise<TrusteeStatus> {
  return press("/api/trustee/join", {});
}

export function decrypt(): Promise<TrusteeStatus> {
  return press("/api/trustee/decrypt", {});
}

/** Sends back exactly the totals the screen showed (`tally.totals`). */
export function sign(totals: number[]): Promise<TrusteeStatus> {
  return press("/api/trustee/sign", { totals });
}
