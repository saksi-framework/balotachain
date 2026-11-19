import { idToName } from "@balotachain/ui";
import {
  ALREADY_CHECKED_IN,
  BAD_DATE,
  BAD_SIGNATURE,
  CHECKIN_ENDED,
  CHECKIN_IN_PROGRESS,
  NAME_TOO_LONG,
  NO_VOTER_LIST,
  NOT_ON_LIST,
  rateLimited,
} from "./checkin";
import {
  LiveError,
  type Checkin,
  type CheckinState,
  type ElectionStatus,
  type FoundVoter,
  type ListEntry,
  type ListSignature,
  type LiveErrorDetail,
  type LiveErrorKind,
  type LookupResult,
  type VoterDetails,
} from "./live";
import type {
  LiveTransport,
  ShownBallot,
  SubmitOptions,
  TransportElection,
} from "./transport";

/**
 * `LiveTransport` over the live console's HTTP API (saksi
 * `docs/live/http-api.md`, built from the document at saksi `25cbafd`).
 *
 * Same origin only: the console serves this app at `/vote/` and sends no
 * CORS headers, so every path here is relative.
 *
 * What goes over the wire, and nothing else:
 * - check-in (saksi `docs/live/voter-list-api.md`): last name, first name
 *   and date of birth, to find the name and once more with the
 *   declaration; then the signature's numbers. The console answers with the
 *   HttpOnly `saksi_checkin` cookie, which the browser sends back on every
 *   `/api/live/` call made `same-origin`; this page never reads it;
 * - issuance: `blinded_commitment`, then `e_prime`, with the check-in
 *   cookie (with check-in, the only identity-bearing calls);
 * - a ballot: `{"ballot": hex}` exactly as the wasm built it, with
 *   `credentials: "omit"`, no account field and no header naming the voter;
 * - public reads (`GET /api/live/election`, the board's verify-code route),
 *   also without the cookie.
 * Never a credential, an issuance state, an opening, a challenged ballot,
 * or a report that a check failed. Nothing here logs.
 */

export type Route =
  | "checkin"
  | "find"
  | "declare"
  | "checkin-sign"
  | "election"
  | "presign"
  | "sign"
  | "ballot"
  | "verify-code";

export const PATHS = {
  checkin: "/api/live/checkin",
  find: "/api/live/checkin/find",
  declare: "/api/live/checkin/declare",
  "checkin-sign": "/api/live/checkin/sign",
  election: "/api/live/election",
  presign: "/api/live/issue/presign",
  sign: "/api/live/issue/sign",
  ballot: "/api/live/ballot",
} as const;

export function verifyCodePath(runId: string, code: string): string {
  return `/api/verify-code/${encodeURIComponent(runId)}/${encodeURIComponent(code)}`;
}

/**
 * Every request has a timeout, in ms. The ballot's is long: one on-chain
 * write takes about 2 s, but the console waits for the block and reads the
 * record back, and a slow chain can take much longer. Cutting it short only
 * turns a recorded ballot into an unknown one. `sign` is long for the same
 * reason: a lost answer spends the account.
 */
export const TIMEOUT_MS: Record<Route, number> = {
  checkin: 15_000,
  find: 15_000,
  declare: 15_000,
  "checkin-sign": 30_000,
  election: 15_000,
  presign: 30_000,
  sign: 60_000,
  ballot: 150_000,
  "verify-code": 20_000,
};

/** How often a ballot is resent after a 429, and the longest wait honoured. */
export const MAX_RATE_LIMIT_WAITS = 3;
export const MAX_RETRY_AFTER_S = 10;

/** The body of a console error: `{"error"}`, sometimes with more fields. */
export interface ErrorBody {
  error?: string;
  code?: string;
  refused?: boolean;
  gate?: string;
  reason?: string;
}

/** One failed request, before it becomes a `LiveError`. */
export type Failure =
  | { status: "transport"; message: string }
  | { status: "timeout"; ms: number }
  | {
      status: number;
      body: ErrorBody;
      /** The console's own text: `error`, or the plain-text body. */
      text: string;
      retryAfter: number | null;
    };

type HttpFailure = Extract<Failure, { status: number }>;

export interface ErrorRow {
  /** `"*"`: every route; a list: any of those. */
  route: Route | readonly Route[] | "*";
  /** An HTTP status, several, or a failure that never reached the console. */
  status:
    | number
    | readonly number[]
    | "transport"
    | "timeout"
    | "other-5xx"
    | "other";
  /** An extra condition on the console's body. */
  when?: (b: ErrorBody) => boolean;
  kind: LiveErrorKind;
  message: (f: Failure) => string;
  detail?: (f: Failure) => LiveErrorDetail;
}

function text(f: Failure, fallback: string): string {
  return typeof f.status === "number" && f.text ? f.text : fallback;
}

/** Seconds to wait: the `Retry-After` header, or 1 when there was none. */
function retryAfterOf(f: Failure): number {
  return typeof f.status === "number" && f.retryAfter !== null
    ? f.retryAfter
    : 1;
}

/** " Try again in N s." only when the console sent a `Retry-After` header. */
function retrySuffix(f: Failure): string {
  return typeof f.status === "number" && f.retryAfter !== null
    ? ` Try again in ${f.retryAfter} s.`
    : "";
}

/** A row condition: the console's `code` is this one. */
function code(c: string): (b: ErrorBody) => boolean {
  return (b) => b.code === c;
}

/** The check-in route's `code`, for the screens that branch on it. */
function checkinDetail(f: Failure): LiveErrorDetail {
  const b = typeof f.status === "number" ? f.body : {};
  return { type: "checkin", code: typeof b.code === "string" ? b.code : "" };
}

function refusal(f: Failure): LiveErrorDetail {
  const b = typeof f.status === "number" ? f.body : {};
  return {
    type: "chain-refusal",
    gate: typeof b.gate === "string" ? b.gate : "",
    reason: typeof b.reason === "string" ? b.reason : "",
  };
}

function refusalMessage(f: Failure): string {
  const d = refusal(f) as Extract<LiveErrorDetail, { type: "chain-refusal" }>;
  const head = text(f, "The ledger refused this transaction.");
  return `${head} (gate ${d.gate || "none"}): ${d.reason}`;
}

export const ALREADY_ISSUED =
  "This voter's credential was already issued for this election, to this phone or to one that lost it. A credential is issued only once per voter, so this phone cannot get one. See the Electoral Board.";

export const ISSUANCE_RELOAD =
  "This phone's request for a credential is no longer open on the server. Reload this page and get your credential again.";

export const ISSUANCE_BUSY =
  "This phone is already getting a voting credential in another tab or window. Finish there, then reload this page.";

/**
 * How every failed request maps to a `LiveError` kind. First match wins.
 * The kind decides what happens to a ballot: only `network` keeps it for a
 * retry. Each row is tested (`http.test.ts`).
 *
 * The presign and sign 409s are read together with the election state: the
 * transport re-reads `GET /api/live/election` first, and a 409 while the
 * election is not open becomes `not-open` or `closed` (the console answers
 * both "wrong state" and "already issued" with 409 and no code).
 */
/** M8: a tracking code the board finds on more than one ballot record. */
export const AMBIGUOUS_CODE =
  "More than one ballot on the board has this tracking code, so this phone cannot say which one is yours. Show this screen to an election officer.";

export const ERROR_TABLE: readonly ErrorRow[] = [
  // Never reached the console, or no answer in time: retryable.
  {
    route: "*",
    status: "transport",
    kind: "network",
    message: () =>
      "Can't reach the election server. Check this phone's connection, then try again.",
  },
  {
    route: "*",
    status: "timeout",
    kind: "network",
    message: (f) =>
      `The election server did not answer within ${Math.round((f.status === "timeout" ? f.ms : 0) / 1000)} s. Check this phone's connection, then try again.`,
  },
  // http-api.md, Conventions: 500 generic, 502 the chain did not answer.
  {
    route: "*",
    status: [500, 502, 503, 504],
    kind: "network",
    message: (f) =>
      text(f, "The election server or the ledger did not answer."),
  },
  // voter-list-api.md: the check-in and issuance answers carry a `code`.
  {
    route: "*",
    status: 409,
    when: code("no-voter-list"),
    kind: "refused",
    message: () => NO_VOTER_LIST,
    detail: () => ({ type: "no-voter-list" }),
  },
  // No check-in, or one the Board ended: read the check-in again.
  {
    route: ["checkin-sign", "presign", "sign"],
    status: 403,
    when: code("no-checkin"),
    kind: "auth",
    message: () => CHECKIN_ENDED,
  },
  {
    route: ["checkin-sign", "presign", "sign"],
    status: 409,
    when: (b) => b.code === "wrong-state" || b.code === "not-signed",
    kind: "auth",
    message: () => CHECKIN_ENDED,
    detail: (f) => checkinDetail(f),
  },
  {
    route: ["presign", "sign"],
    status: 409,
    when: code("already-issued"),
    kind: "refused",
    message: () => ALREADY_ISSUED,
    detail: () => ({ type: "already-issued" }),
  },
  {
    route: ["find", "declare", "checkin-sign"],
    status: 409,
    when: code("not-open"),
    kind: "not-open",
    message: () => "Check-in is open only while voting is open.",
  },
  {
    route: ["find", "declare"],
    status: 429,
    kind: "refused",
    message: (f) =>
      rateLimited(typeof f.status === "number" ? f.retryAfter : null),
    detail: (f) => ({
      type: "rate-limited",
      retryAfterSeconds: retryAfterOf(f),
    }),
  },
  {
    route: ["find", "declare"],
    status: 404,
    when: code("not-on-list"),
    kind: "refused",
    message: () => NOT_ON_LIST,
    detail: checkinDetail,
  },
  {
    route: ["find", "declare"],
    status: 409,
    when: code("already-checked-in"),
    kind: "refused",
    message: () => ALREADY_CHECKED_IN,
    detail: checkinDetail,
  },
  {
    route: ["find", "declare"],
    status: 400,
    when: code("bad-date"),
    kind: "refused",
    message: () => BAD_DATE,
    detail: checkinDetail,
  },
  {
    route: ["find", "declare"],
    status: 400,
    when: code("bad-request"),
    kind: "refused",
    message: () => NAME_TOO_LONG,
    detail: checkinDetail,
  },
  {
    route: "declare",
    status: 400,
    when: code("declaration-required"),
    kind: "refused",
    message: () => "Tick the declaration before sending it.",
    detail: checkinDetail,
  },
  {
    route: "declare",
    status: 409,
    when: code("checkin-in-progress"),
    kind: "refused",
    message: () => CHECKIN_IN_PROGRESS,
    detail: checkinDetail,
  },
  {
    route: "checkin-sign",
    status: 400,
    when: code("bad-signature"),
    kind: "refused",
    message: () => BAD_SIGNATURE,
    detail: checkinDetail,
  },
  // No route of this page answers 401 any more (no account sign-in); if
  // one does, the check-in is read again.
  {
    route: "*",
    status: 401,
    kind: "auth",
    message: () => CHECKIN_ENDED,
  },
  // `guard`'s plain-text 403s (a Host off the allowlist, another Origin).
  {
    route: "*",
    status: 403,
    kind: "refused",
    message: (f) => text(f, "The election server refused this request."),
  },
  {
    route: "*",
    status: 404,
    kind: "not-open",
    message: () => "No election has been set up on this server yet.",
  },
  // http-api.md, POST /api/live/ballot: 409 = the election is not open.
  {
    route: "ballot",
    status: 409,
    kind: "closed",
    message: (f) => text(f, "The election is not accepting ballots."),
  },
  {
    route: "presign",
    status: 409,
    kind: "refused",
    message: () => ALREADY_ISSUED,
    detail: () => ({ type: "already-issued" }),
  },
  {
    route: "sign",
    status: 409,
    kind: "refused",
    message: (f) =>
      `${text(f, "The issuance could not finish.")} If the credential was already issued to this voter, it cannot be issued again: see the Electoral Board.`,
  },
  // M8: the board's 409 for a tracking code that matches more than one
  // ballot record; the phone says it in its own words, not the console's.
  {
    route: "verify-code",
    status: 409,
    kind: "refused",
    message: () => AMBIGUOUS_CODE,
  },
  {
    route: "*",
    status: 409,
    kind: "refused",
    message: (f) => text(f, "The election server refused this request."),
  },
  // A ballot for another election: this phone holds a stale election.
  {
    route: "ballot",
    status: 400,
    when: (b) => b.code === "wrong-election",
    kind: "refused",
    message: () =>
      "This ballot was made for an election the server is no longer running. Load the current election and vote again.",
    detail: () => ({ type: "stale-election" }),
  },
  {
    route: "*",
    status: [400, 413],
    kind: "refused",
    message: (f) => text(f, "The election server refused this request."),
  },
  // http-api.md, Conventions: 422 is a chaincode refusal with gate and reason.
  {
    route: "ballot",
    status: 422,
    when: (b) => b.gate === "nullifier",
    kind: "already-voted",
    message: refusalMessage,
    detail: refusal,
  },
  {
    route: "ballot",
    status: 422,
    when: (b) => b.gate === "election-open" || b.gate === "election-closed",
    kind: "closed",
    message: refusalMessage,
    detail: refusal,
  },
  {
    route: "*",
    status: 422,
    kind: "refused",
    message: refusalMessage,
    detail: refusal,
  },
  {
    route: "*",
    status: 429,
    kind: "network",
    message: (f) =>
      `${text(f, "The election server is busy.")}${retrySuffix(f)}`,
    detail: (f) => ({
      type: "rate-limited",
      retryAfterSeconds: retryAfterOf(f),
    }),
  },
  // Any other server error: retryable, so a ballot is kept rather than lost.
  {
    route: "*",
    status: "other-5xx",
    kind: "network",
    message: (f) =>
      text(f, "The election server gave an answer this app does not know."),
  },
  // Any other answer (405 and the like): a retry would get the same answer.
  {
    route: "*",
    status: "other",
    kind: "refused",
    message: (f) =>
      text(f, "The election server gave an answer this app does not know."),
  },
];

function statusMatches(row: ErrorRow, f: Failure): boolean {
  if (row.status === "other") return true;
  if (row.status === "other-5xx") {
    return typeof f.status === "number" && f.status >= 500;
  }
  if (typeof row.status === "string") return row.status === f.status;
  if (typeof f.status !== "number") return false;
  return typeof row.status === "number"
    ? row.status === f.status
    : row.status.includes(f.status);
}

/** The table row for this failure (always one: the last row matches all). */
export function errorRow(route: Route, f: Failure): ErrorRow {
  return ERROR_TABLE.find(
    (row) =>
      (row.route === "*" ||
        row.route === route ||
        (Array.isArray(row.route) && row.route.includes(route))) &&
      statusMatches(row, f) &&
      (!row.when || (typeof f.status === "number" && row.when(f.body))),
  )!;
}

/** A `LiveError` from one request, with the HTTP status when there was one. */
export class HttpError extends LiveError {
  readonly status: number | null;
  /** The console's own text ("" when there was no HTTP answer). */
  readonly text: string;
  /** The console's `code` ("" when it sent none). */
  readonly code: string;
  constructor(row: ErrorRow, f: Failure) {
    super(row.kind, row.message(f), row.detail?.(f));
    this.status = typeof f.status === "number" ? f.status : null;
    this.text = typeof f.status === "number" ? f.text : "";
    this.code =
      typeof f.status === "number" && typeof f.body.code === "string"
        ? f.body.code
        : "";
  }
}

/**
 * What a presign or sign 409 says, from the texts in saksi
 * `packages/saksi-campaign/live_issue.go` at 25cbafd (`checkIssuable`,
 * `sign`):
 * - "credentials are issued while the election is open; it is <state>"
 * - "this account has been issued its credential for this election already; …"
 * - "no issuance session is open for this account; start again with presign"
 * - "the issuance session expired; start again with presign"
 */
export function issuanceText(
  t: string,
):
  | { kind: "state"; status: ElectionStatus }
  | { kind: "issued" }
  | { kind: "no-session" }
  | { kind: "unknown" } {
  const state = t.match(
    /credentials are issued while the election is open; it is ([a-z]+)/,
  );
  if (state && STATE_MAP[state[1]!]) {
    return { kind: "state", status: STATE_MAP[state[1]!]! };
  }
  if (t.includes("has been issued its credential")) return { kind: "issued" };
  if (
    t.includes("no issuance session is open") ||
    t.includes("the issuance session expired")
  ) {
    return { kind: "no-session" };
  }
  return { kind: "unknown" };
}

export function classify(route: Route, f: Failure): HttpError {
  return new HttpError(errorRow(route, f), f);
}

/** The console's states, mapped to what the screens show. */
export const STATE_MAP: Record<string, ElectionStatus> = {
  setup: "setup",
  ceremony: "setup",
  open: "open",
  closed: "closed",
  tallied: "tallied",
  verified: "tallied",
  // Given up before any credential or ballot existed; a new election may
  // follow, so the phone waits as before an election opens.
  abandoned: "setup",
};

function parseRetryAfter(v: string | null, now: number): number | null {
  if (v === null) return null;
  const n = Number(v.trim());
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}

function malformed(what: string): LiveError {
  return new LiveError(
    "refused",
    `The election server's answer is missing ${what}.`,
  );
}

function str(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v !== "string" || v === "") throw malformed(k);
  return v;
}

function optStr(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === "string" && v !== "" ? v : undefined;
}

type Json = Record<string, unknown>;

const CHECKIN_STATES: readonly CheckinState[] = [
  "not_checked_in",
  "at_desk",
  "approved",
  "signed",
  "credential_issued",
  "refused",
  "reset",
];

/** The body of `find` and `declare`: exactly these three fields. */
function detailsBody(d: VoterDetails): Json {
  return {
    last_name: d.lastName.trim(),
    first_name: d.firstName.trim(),
    date_of_birth: d.dateOfBirth,
  };
}

function listEntry(v: Json): ListEntry {
  if (typeof v.seq !== "number" || !Number.isInteger(v.seq) || v.seq < 1) {
    throw malformed("seq");
  }
  return {
    seq: v.seq,
    lastName: str(v, "last_name"),
    firstName: str(v, "first_name"),
    middleName: typeof v.middle_name === "string" ? v.middle_name : "",
  };
}

/** The poll view (`GET /api/live/checkin`, and the answers of declare and sign). */
function checkinView(v: Json): Checkin {
  const state = str(v, "state");
  if (!(CHECKIN_STATES as readonly string[]).includes(state)) {
    throw new LiveError(
      "refused",
      `The election server reports a check-in state this app does not know: ${state}.`,
    );
  }
  const out: Checkin = {
    state: state as CheckinState,
    // The contract shows both on every poll view; an ended check-in
    // (`refused`, `reset`) is not refused for leaving one out.
    electionId: optStr(v, "election_id") ?? "",
    precinctLabel: optStr(v, "precinct_label") ?? "",
  };
  if (v.entry && typeof v.entry === "object") {
    out.entry = listEntry(v.entry as Json);
  }
  return out;
}

export interface HttpTransportOptions {
  /** Defaults to the page's `fetch`. */
  fetch?: typeof fetch;
  /** Defaults to `navigator.locks` (Web Locks), when the browser has it. */
  locks?: Pick<LockManager, "request"> | null;
  /** Waits for `Retry-After`; tests pass one that does not sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Overrides `TIMEOUT_MS` per route (tests). */
  timeouts?: Partial<Record<Route, number>>;
}

const LOCK_NAME = "balotachain-vote-issuance";
/** This page's own hold on the issuance, whatever the browser has. */
let issuingHere = false;

/** For tests: this page holds the issuance flag. */
export function issuanceHeldHere(): boolean {
  return issuingHere;
}

/**
 * Run `run` as the only issuance on this phone. Across tabs and windows of
 * this origin it holds the Web Lock `balotachain-vote-issuance`
 * (`ifAvailable`, so a second tab is refused at once instead of queueing);
 * without Web Locks only this page is covered. A closed tab releases its
 * Web Lock.
 */
export async function withIssuanceLock<T>(
  locks: Pick<LockManager, "request"> | null | undefined,
  run: () => Promise<T>,
): Promise<T> {
  if (issuingHere) throw new LiveError("refused", ISSUANCE_BUSY);
  issuingHere = true;
  try {
    if (!locks) return await run();
    return await locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) throw new LiveError("refused", ISSUANCE_BUSY);
      return run();
    });
  } finally {
    issuingHere = false;
  }
}

export class HttpTransport implements LiveTransport {
  private readonly fetchFn: typeof fetch;
  private readonly locks: Pick<LockManager, "request"> | null;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeouts: Record<Route, number>;

  /** From the last election view. */
  private electionId: string | null = null;
  private runId: string | null = null;
  private issuerKey: string | null = null;

  /** Inside `exclusiveIssuance`. */
  private issuing = false;
  /** A presign answered in this issuance and no sign was sent after it. */
  private presigned = false;
  /** Ballots whose send ended without a known outcome (network failure). */
  private readonly uncertain = new Set<string>();

  constructor(opts: HttpTransportOptions = {}) {
    this.fetchFn = opts.fetch ?? ((...a) => globalThis.fetch(...a));
    this.locks =
      opts.locks !== undefined
        ? opts.locks
        : (globalThis.navigator?.locks ?? null);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.timeouts = { ...TIMEOUT_MS, ...opts.timeouts };
  }

  /**
   * One request. Resolves with the parsed JSON body (null for 204); every
   * failure is a `LiveError` from `ERROR_TABLE`.
   */
  private async call(
    route: Route,
    path: string,
    init: {
      method: "GET" | "POST";
      credentials: RequestCredentials;
      body?: unknown;
    },
  ): Promise<Json | null> {
    const ms = this.timeouts[route];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    try {
      let res: Response;
      try {
        res = await this.fetchFn(path, {
          method: init.method,
          credentials: init.credentials,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          cache: "no-store",
          signal: ctrl.signal,
        });
      } catch (e) {
        throw classify(
          route,
          ctrl.signal.aborted
            ? { status: "timeout", ms }
            : {
                status: "transport",
                message: e instanceof Error ? e.message : String(e),
              },
        );
      }
      let raw: string;
      try {
        raw = await res.text();
      } catch {
        throw classify(
          route,
          ctrl.signal.aborted
            ? { status: "timeout", ms }
            : { status: "transport", message: "the answer was cut off" },
        );
      }
      let parsed: unknown = null;
      try {
        parsed = raw.trim() === "" ? null : JSON.parse(raw);
      } catch {
        parsed = undefined;
      }
      if (res.ok) {
        const json =
          parsed !== null && typeof parsed === "object"
            ? (parsed as Json)
            : null;
        // A 2xx on the ballot route may mean the ballot is recorded: an
        // empty or unreadable body goes to `checkRecorded` as `{}` (an
        // alarm), never a plain refusal.
        if (route === "ballot") return json ?? {};
        if (res.status === 204 || parsed === null) return null;
        if (json === null) throw malformed("a JSON body");
        return json;
      }
      const body: ErrorBody =
        parsed && typeof parsed === "object" ? (parsed as ErrorBody) : {};
      const failure: HttpFailure = {
        status: res.status,
        body,
        text: typeof body.error === "string" ? body.error : (raw ?? "").trim(),
        retryAfter: parseRetryAfter(res.headers.get("Retry-After"), Date.now()),
      };
      throw classify(route, failure);
    } finally {
      clearTimeout(timer);
    }
  }

  // --- check-in (voter-list-api.md, Routes) ------------------------------

  /** `GET /api/live/checkin`: the phone's check-in, or null for none. */
  async checkin(): Promise<Checkin | null> {
    let v: Json | null;
    try {
      v = await this.call("checkin", PATHS.checkin, {
        method: "GET",
        credentials: "same-origin",
      });
    } catch (e) {
      // 404 `no-checkin`: no cookie, or one the console does not know.
      if (e instanceof HttpError && e.status === 404 && e.code === "no-checkin")
        return null;
      throw e;
    }
    if (!v) throw malformed("the check-in");
    return checkinView(v);
  }

  async findVoter(d: VoterDetails): Promise<FoundVoter> {
    const v = await this.call("find", PATHS.find, {
      method: "POST",
      credentials: "same-origin",
      body: detailsBody(d),
    });
    if (!v) throw malformed("the list entry");
    const entry = v.entry;
    if (!entry || typeof entry !== "object") throw malformed("entry");
    return {
      precinctLabel: str(v, "precinct_label"),
      entry: listEntry(entry as Json),
    };
  }

  async declare(d: VoterDetails): Promise<Checkin> {
    const v = await this.call("declare", PATHS.declare, {
      method: "POST",
      credentials: "same-origin",
      body: { ...detailsBody(d), declaration: true },
    });
    if (!v) throw malformed("the check-in");
    return checkinView(v);
  }

  async signList(s: ListSignature): Promise<Checkin> {
    const v = await this.call("checkin-sign", PATHS["checkin-sign"], {
      method: "POST",
      credentials: "same-origin",
      body: "cannotSign" in s ? { cannot_sign: true } : { strokes: s.strokes },
    });
    if (!v) throw malformed("the check-in");
    return checkinView(v);
  }

  // --- the election (http-api.md, GET /api/live/election) ------------------

  async election(): Promise<TransportElection> {
    const v = await this.call("election", PATHS.election, {
      method: "GET",
      credentials: "omit",
    });
    if (!v) throw malformed("the election");
    const state = str(v, "state");
    let status = STATE_MAP[state];
    if (!status) {
      throw new LiveError(
        "refused",
        `The election server reports a state this app does not know: ${state}.`,
      );
    }
    const dkg = optStr(v, "dkg") ?? null;
    // Before the key ceremony finishes there is no transcript to vote under.
    if (dkg === null && status === "open") status = "setup";
    const out: TransportElection = {
      title: str(v, "title"),
      status,
      params: str(v, "params"),
      dkg,
      issuerPublicKey: str(v, "issuer_public_key"),
      electionId: str(v, "election_id"),
      runId: str(v, "run_id"),
    };
    const jkf = optStr(v, "joint_key_fingerprint");
    if (jkf) out.jointKeyFingerprint = jkf;
    const precinct = optStr(v, "precinct_label");
    if (precinct) out.precinctLabel = precinct;
    this.electionId = out.electionId!;
    this.runId = out.runId!;
    this.issuerKey = out.issuerPublicKey;
    return out;
  }

  // --- issuance (http-api.md, POST /api/live/issue/presign and sign) -------

  exclusiveIssuance<T>(run: () => Promise<T>): Promise<T> {
    return withIssuanceLock(this.locks, async () => {
      this.issuing = true;
      this.presigned = false;
      try {
        return await run();
      } finally {
        this.issuing = false;
        this.presigned = false;
      }
    });
  }

  /**
   * A 409 on presign or sign with no `code` is "wrong state" or "no open
   * session" (voter-list-api.md gives the election not being open no code;
   * consoles before the voter list gave none at all). The state is re-read, and
   * the console's text (`live_issue.go` at 25cbafd) breaks the tie: a text
   * that names a state or says "already issued" wins over the re-read.
   */
  private async issuanceConflict(e: unknown): Promise<unknown> {
    // A `code` (voter-list-api.md) already says which conflict it is.
    if (!(e instanceof HttpError) || e.status !== 409 || e.code !== "") {
      return e;
    }
    let status: ElectionStatus | null = null;
    try {
      status = (await this.election()).status;
    } catch {
      // The text alone decides below.
    }
    const said = issuanceText(e.text);
    if (said.kind === "state") status = said.status;
    else if (said.kind === "issued") {
      return new LiveError("refused", ALREADY_ISSUED, {
        type: "already-issued",
      });
    } else if (said.kind === "no-session") {
      return new LiveError("refused", ISSUANCE_RELOAD);
    }
    if (status === null) return e;
    if (status === "setup") {
      return new LiveError(
        "not-open",
        "Voting credentials are issued once voting opens.",
      );
    }
    if (status !== "open") {
      return new LiveError("closed", "Voting has closed.");
    }
    return e;
  }

  private checkIssuer(v: Json): void {
    const key = str(v, "issuer_public_key");
    if (this.issuerKey !== null && key !== this.issuerKey) {
      throw new LiveError(
        "refused",
        "The election authority answered with an issuer key that is not the election's, so this phone stopped before asking for the signature.",
      );
    }
  }

  async issuePresign(blindedCommitment: string): Promise<{ r: string }> {
    if (!this.issuing) {
      throw new LiveError("refused", "Issuance must run on its own.");
    }
    this.presigned = false;
    let v: Json | null;
    try {
      v = await this.call("presign", PATHS.presign, {
        method: "POST",
        credentials: "same-origin",
        body: { blinded_commitment: blindedCommitment },
      });
    } catch (e) {
      throw await this.issuanceConflict(e);
    }
    if (!v) throw malformed("r");
    const r = str(v, "r");
    this.checkIssuer(v);
    this.presigned = true;
    return { r };
  }

  async issueSign(ePrime: string): Promise<{ sIss: string }> {
    // Never twice: one sign per presign, and never after a failed sign.
    if (!this.issuing || !this.presigned) {
      throw new LiveError(
        "refused",
        "The issuance must start again from the beginning.",
      );
    }
    this.presigned = false;
    let v: Json | null;
    try {
      v = await this.call("sign", PATHS.sign, {
        method: "POST",
        credentials: "same-origin",
        body: { e_prime: ePrime },
      });
    } catch (e) {
      throw await this.issuanceConflict(e);
    }
    if (!v) throw malformed("s_iss");
    const sIss = str(v, "s_iss");
    this.checkIssuer(v);
    return { sIss };
  }

  // --- ballots (http-api.md, POST /api/live/ballot) ------------------------

  async submitBallot(
    positionId: string,
    ballot: string,
    shown?: ShownBallot,
    opts: SubmitOptions = {},
  ): Promise<{ txId: string; block: number }> {
    // Sent before, outcome unknown (a reload lost this transport's memory).
    if (opts.resend) this.uncertain.add(ballot);
    for (let waits = 0; ; waits++) {
      let v: Json | null;
      try {
        v = await this.call("ballot", PATHS.ballot, {
          method: "POST",
          // Anonymous: no cookie, so the ballot is never linked to a session.
          credentials: "omit",
          body: { ballot },
        });
      } catch (e) {
        if (!(e instanceof LiveError)) throw e;
        // 429 comes before the console does anything: wait and resend.
        if (e.detail?.type === "rate-limited" && waits < MAX_RATE_LIMIT_WAITS) {
          const s = Math.min(e.detail.retryAfterSeconds, MAX_RETRY_AFTER_S);
          await this.sleep(Math.max(s, 1) * 1000);
          continue;
        }
        // A resend after an unknown outcome, refused because the nullifier
        // is spent: the earlier send may have been this very ballot.
        if (e.kind === "already-voted" && shown && this.uncertain.has(ballot)) {
          const own = await this.ownRecord(shown).catch(() => null);
          if (own) {
            this.uncertain.delete(ballot);
            return own;
          }
        }
        if (e.kind === "network") this.uncertain.add(ballot);
        else this.uncertain.delete(ballot);
        throw e;
      }
      this.uncertain.delete(ballot);
      return this.checkRecorded(positionId, v ?? {}, shown);
    }
  }

  /**
   * The console's answer must name the ballot the phone showed: the same
   * position, tracking code and fingerprint, read back byte for byte.
   * Anything else is an alarm (never a success, never a retry).
   */
  private checkRecorded(
    positionId: string,
    v: Json,
    shown?: ShownBallot,
  ): { txId: string; block: number } {
    const recordedTrackingCode = optStr(v, "tracking_code") ?? "";
    const recordedFingerprint = optStr(v, "ballot_fingerprint") ?? "";
    const recordedBytesMatch = v.recorded_bytes_match === true;
    const txId = optStr(v, "tx_id") ?? "";
    const block = typeof v.block_number === "number" ? v.block_number : 0;
    const ok =
      recordedBytesMatch &&
      txId !== "" &&
      typeof v.block_number === "number" &&
      v.position_id === positionId &&
      (this.electionId === null || v.election_id === this.electionId) &&
      shown !== undefined &&
      recordedTrackingCode === shown.trackingCode &&
      recordedFingerprint === shown.fingerprint;
    if (ok) return { txId, block };
    throw new LiveError(
      "refused",
      "The election server's answer does not match the ballot this phone showed you. Do not vote again from this phone: show this screen to an election officer.",
      {
        type: "record-mismatch",
        positionId,
        shown: shown ?? { trackingCode: "", fingerprint: "" },
        recorded: {
          recordedTrackingCode,
          recordedFingerprint,
          recordedBytesMatch,
          txId,
          block,
        },
      },
    );
  }

  /** The board's record for `shown`, when it is exactly that ballot. */
  private async ownRecord(
    shown: ShownBallot,
  ): Promise<{ txId: string; block: number } | null> {
    const v = await this.verifyCode(shown.trackingCode);
    if (
      v?.found === true &&
      v.tracking_code === shown.trackingCode &&
      v.ballot_fingerprint === shown.fingerprint &&
      typeof v.tx_id === "string" &&
      v.tx_id !== "" &&
      typeof v.block_number === "number"
    ) {
      return { txId: v.tx_id, block: v.block_number };
    }
    return null;
  }

  // --- the board (GET /api/verify-code/<run>/<code>) ---------------------

  private async verifyCode(code: string): Promise<Json | null> {
    if (this.runId === null) await this.election();
    return this.call("verify-code", verifyCodePath(this.runId!, code), {
      method: "GET",
      credentials: "omit",
    });
  }

  async lookup(trackingCode: string): Promise<LookupResult> {
    // Fresh, for the run id and whether the tally is published.
    const e = await this.election();
    const v = await this.verifyCode(trackingCode);
    if (!v || v.found !== true) {
      return { trackingCode, recorded: false, counted: false };
    }
    const out: LookupResult = {
      trackingCode: optStr(v, "tracking_code") ?? trackingCode,
      recorded: true,
      counted: e.status === "tallied",
    };
    const positionId = optStr(v, "position_id");
    const title =
      optStr(v, "position_label") ??
      (positionId !== undefined ? idToName(positionId) : undefined);
    if (title) out.positionTitle = title;
    const fp = optStr(v, "ballot_fingerprint");
    if (fp) out.fingerprint = fp;
    return out;
  }
}
