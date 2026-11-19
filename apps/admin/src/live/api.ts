/**
 * The presenter's calls to the console's live routes (docs/live/http-api.md).
 * Same origin as the page: the admin session cookie rides along on the admin
 * routes, and the ballot relay is sent without it.
 */
import type {
  ListEntry,
  LiveElectionRequest,
  LiveElectionView,
  LiveLedger,
  PublishAnswer,
  VerifyAnswer,
  VoterListPreview,
  VoterListView,
} from "./types";

const BASE: string = (import.meta.env.VITE_CONSOLE_URL ?? "").replace(
  /\/$/,
  "",
);

/**
 * A non-2xx answer from a live route, with the console's own words. A chain
 * refusal (422) also carries `refused`, `gate` and `reason` exactly as sent.
 */
export class LiveError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly refused: boolean;
  readonly gate?: string;
  readonly reason?: string;
  /** Seconds, from `Retry-After` on a 429. */
  readonly retryAfter?: number;
  constructor(
    status: number,
    message: string,
    extra: {
      code?: string;
      refused?: boolean;
      gate?: string;
      reason?: string;
      retryAfter?: number;
    } = {},
  ) {
    super(message);
    this.name = "LiveError";
    this.status = status;
    this.code = extra.code;
    this.refused = extra.refused === true;
    this.gate = extra.gate;
    this.reason = extra.reason;
    this.retryAfter = extra.retryAfter;
  }
}

async function failure(res: Response): Promise<LiveError> {
  const text = (await res.text()).trim();
  let message = text;
  const extra: ConstructorParameters<typeof LiveError>[2] = {};
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (typeof body?.error === "string") message = body.error;
    if (typeof body?.code === "string") extra.code = body.code;
    if (body?.refused === true) extra.refused = true;
    if (typeof body?.gate === "string") extra.gate = body.gate;
    if (typeof body?.reason === "string") extra.reason = body.reason;
  } catch {
    // `guard` answers in plain text ("forbidden host"): already the message.
  }
  const retry = Number(res.headers.get("Retry-After"));
  if (res.status === 429 && Number.isFinite(retry) && retry > 0) {
    extra.retryAfter = retry;
  }
  return new LiveError(
    res.status,
    message || `request failed (${res.status})`,
    extra,
  );
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

const json = { Accept: "application/json" };

/** A fresh read of the election view; null when none is set up. */
export async function readElection(
  signal?: AbortSignal,
): Promise<LiveElectionView | null> {
  const res = await fetch(BASE + "/api/live/election", {
    signal,
    headers: json,
  });
  if (res.status === 404) {
    const err = await failure(res);
    if (err.message === "no live election has been set up") return null;
    throw err;
  }
  if (!res.ok) throw await failure(res);
  return (await res.json()) as LiveElectionView;
}

/** `POST /api/live/elections` (201 new, 200 a retried setup). */
export function createElection(
  body: LiveElectionRequest,
): Promise<LiveElectionView> {
  return call("/api/live/elections", {
    method: "POST",
    headers: { ...json, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * `POST /api/live/voter-list/preview`: the console parses the text and changes
 * nothing. A list in error is still a 200 with `valid: false`.
 */
export function previewVoterList(csv: string): Promise<VoterListPreview> {
  return call("/api/live/voter-list/preview", {
    method: "POST",
    headers: { ...json, "Content-Type": "application/json" },
    body: JSON.stringify({ csv }),
  });
}

/** `GET /api/live/voter-list`: the election-day list, never a date of birth. */
export function readVoterList(signal?: AbortSignal): Promise<VoterListView> {
  return call("/api/live/voter-list", { headers: json, signal });
}

export type DeskAction = "approve" | "refuse" | "reset";

/** `POST /api/live/desk/<action>` with `{"seq": n}`; answers the entry. */
export function deskWrite(action: DeskAction, seq: number): Promise<ListEntry> {
  return call(`/api/live/desk/${action}`, {
    method: "POST",
    headers: { ...json, "Content-Type": "application/json" },
    body: JSON.stringify({ seq }),
  });
}

/** The admin writes that take no body. */
const POST: RequestInit = { method: "POST", headers: json };

export function closeVoting(): Promise<LiveElectionView> {
  return call("/api/live/close", POST);
}

export function abandonElection(): Promise<LiveElectionView> {
  return call("/api/live/abandon", POST);
}

export function publishTally(): Promise<PublishAnswer> {
  return call("/api/live/tally/publish", POST);
}

export function verifyResult(): Promise<VerifyAnswer> {
  return call("/api/live/verify", POST);
}

/** `GET /api/live/ledger`: the election read back from the chain. */
export function readLedger(): Promise<LiveLedger> {
  return call("/api/live/ledger", { headers: json });
}

/**
 * `POST /api/live/ballot`, exactly as the phone sends it: the one field, and
 * no cookie (`credentials: "omit"`), since the relay is anonymous.
 */
export function sendBallot(ballotHex: string): Promise<unknown> {
  return call("/api/live/ballot", {
    method: "POST",
    credentials: "omit",
    headers: { ...json, "Content-Type": "application/json" },
    body: JSON.stringify({ ballot: ballotHex }),
  });
}
