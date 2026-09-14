/**
 * Typed client for the saksi-campaign console HTTP API.
 *
 * The trustee console is served BY the console (see `--web-dir` in the console
 * runbook), so in production every path here is same-origin — which is what
 * keeps the console's cross-origin POST guard protecting `/ceremony/submit`
 * and `/ceremony/publish`. In dev Vite proxies these prefixes and strips the
 * browser's `Origin` header so the guard sees a non-browser caller.
 *
 * Field names mirror the Go structs in `saksi/packages/saksi-campaign`
 * (`ceremonyview.go`, `ceremony.go`). Keep them in lock-step.
 */

const BASE: string = (import.meta.env.VITE_CONSOLE_URL ?? "").replace(
  /\/$/,
  "",
);

export type RunView = {
  run_id: string;
  created_at: string;
  config: {
    name: string;
    mode: string;
    voters: number;
    positions: number;
    candidates: number;
    threshold: number;
  };
  artifacts: string[] | null;
};

/** One institution's row (Go `CeremonyTrustee`). Ids are "1".."n". */
export type CeremonyTrustee = {
  id: string;
  name: string;
  submitted: boolean;
  /** Partial decryptions this trustee owns — one per contest. */
  contests: number;
  submitted_at?: string;
};

export type CeremonyEvent = {
  at?: string;
  kind: "setup" | "trustee" | "published" | "chain";
  who?: string;
  text: string;
  tx_id?: string;
  block?: number;
};

/** `GET /api/ceremony/<run>` (Go `CeremonyView`, embedding `CeremonyState`). */
export type Ceremony = {
  threshold: number;
  trustees: CeremonyTrustee[];
  submitted: number;
  unlocked: boolean;
  published: boolean;
  on_chain: boolean;
  /** Setup has run and trustees may act. False = ceremony not started. */
  ready: boolean;
  started_at?: string;
  closed_at?: string;
  published_at?: string;
  election_id: string;
  name: string;
  mode: string;
  positions: number;
  position_ids?: string[];
  contests: number;
  ballot_records: number;
  ballots_sha256?: string;
  dkg_sha256?: string;
  events: CeremonyEvent[];
};

/** A phase progress line from the console's SSE stream (Go `Event`). */
export type ConsoleEvent = {
  phase: string;
  level: "info" | "error" | "done";
  msg: string;
};

/**
 * A non-2xx answer, carrying the status so the app can tell "sign in" (401)
 * from "not allowed" (403) from "no auth routes on this console" (404).
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** `GET /api/me`. `trustee_id` is set for trustees only. */
export type Session = {
  username: string;
  role: "admin" | "trustee";
  trustee_id?: string;
};

/**
 * The console's error text: `http.Error` writes plain prose, the auth routes
 * write `{"error": "..."}`. Both are user-facing already.
 */
async function errorText(res: Response): Promise<string> {
  const text = (await res.text()).trim();
  try {
    const body = JSON.parse(text) as { error?: unknown };
    if (typeof body?.error === "string") return body.error;
  } catch {
    // plain text
  }
  return text;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new ApiError(
      res.status,
      `${path} returned ${res.status}: ${await errorText(res)}`,
    );
  }
  return (await res.json()) as T;
}

/**
 * A phase POST returns 202 "accepted", not "done" — the console dispatches it
 * asynchronously under the run's busy lock. The caller re-polls the ceremony to
 * see the result. The console's error bodies are already user-facing prose (the
 * threshold 409 in particular), so they are surfaced verbatim.
 */
async function post(path: string, body?: unknown): Promise<void> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (await errorText(res)) || `request failed (${res.status})`,
    );
  }
}

/**
 * The signed-in user, or `null` when the console has no auth routes — a
 * console without auth answers `/api/me` from its 404 catch-all, and the page
 * then works as before, without a login. No session is a 401.
 */
export async function getMe(signal?: AbortSignal): Promise<Session | null> {
  try {
    return await get<Session>("/api/me", signal);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function login(username: string, password: string): Promise<void> {
  return post("/api/login", { username, password });
}

export function logout(): Promise<void> {
  return post("/api/logout");
}

export function listRuns(signal?: AbortSignal): Promise<RunView[]> {
  // /runs, not /api/trail: the trail index dials Fabric on every request and
  // fails without a network, while /runs is a pure filesystem listing.
  return get<RunView[]>("/runs", signal);
}

export function loadCeremony(
  runId: string,
  signal?: AbortSignal,
): Promise<Ceremony> {
  return get<Ceremony>(`/api/ceremony/${encodeURIComponent(runId)}`, signal);
}

/**
 * Submits exactly one trustee's shares — one per contest. With console auth on
 * the id must be the session's own: another trustee's id is a 403.
 */
export function submitPartialDecryption(
  runId: string,
  trusteeId: string,
): Promise<void> {
  return post("/ceremony/submit", { run_id: runId, trustee_id: trusteeId });
}

/** 409 below the threshold, with the console's own "needs N of M" message. */
export function publishTally(runId: string): Promise<void> {
  return post("/ceremony/publish", { run_id: runId });
}

/**
 * Live progress lines. The console's hub drops events for a slow subscriber and
 * has no replay, so this is only ever a liveness cue — the ceremony poll is the
 * state of record.
 */
export function subscribeEvents(
  runId: string,
  onEvent: (e: ConsoleEvent) => void,
): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource(
    `${BASE}/events?run=${encodeURIComponent(runId)}`,
  );
  source.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as ConsoleEvent);
    } catch {
      // A malformed frame is not worth breaking the stream over.
    }
  };
  return () => source.close();
}

/** The public bulletin board for this election, served by the same console. */
export function boardUrl(runId: string): string {
  return `${BASE}/board/?run=${encodeURIComponent(runId)}`;
}
