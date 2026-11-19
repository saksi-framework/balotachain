/**
 * Typed client for the saksi-campaign console HTTP API.
 *
 * The board is served BY the console (see `--web-dir` in the console runbook),
 * so in production every path here is same-origin and `BASE` is empty. In dev
 * Vite proxies these prefixes to the console; `VITE_CONSOLE_URL` is only for
 * pointing a dev build at a console on another host.
 *
 * Field names mirror the Go structs in
 * `saksi/packages/saksi-campaign/board.go` — snake_case, as encoding/json
 * emits them. Keep them in lock-step.
 */

const BASE: string = (import.meta.env.VITE_CONSOLE_URL ?? "").replace(
  /\/$/,
  "",
);

/** One run in `GET /runs` (Go `runView`). */
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

export type BoardCandidate = {
  id: string;
  label: string;
  votes: number;
  /** 1-based; candidates on the same count share a rank. */
  rank: number;
  elected: boolean;
  /** Percent of this race's votes. */
  share: number;
};

export type BoardContest = {
  id: string;
  label: string;
  seats: number;
  total_votes: number;
  /**
   * The cut is not decided — more candidates are level at the last elected
   * place than there are seats left, so nothing is awarded. Under a uniform
   * distribution this is the normal outcome, not an error.
   */
  contested: boolean;
  candidates: BoardCandidate[];
};

export type BoardIntegrity = {
  voters: number;
  positions: number;
  candidates: number;
  ballot_records: number;
  verified: number;
  rejected: number;
  rejected_note?: string;
  turnout_pct: number;
  turnout_note: string;
};

export type BoardCrypto = {
  tally_proof_verified: boolean;
  trustees_submitted: number;
  trustees_total: number;
  threshold: number;
  tally_sha256?: string;
  dkg_sha256?: string;
  ballots_sha256?: string;
  issuer_public_key?: string;
  binding_context?: string;
  chain_height?: number;
  tip_hash?: string;
  committed_nullifiers?: number;
};

export type BoardCheck = { name: string; pass: boolean; detail: string };

/** `GET /api/capabilities` (`handleCapabilities`, server.go). */
export type Capabilities = { fabric: boolean; peer?: string; channel?: string };

export type Board = {
  election_id: string;
  name: string;
  mode: string;
  distribution: string;
  on_chain: boolean;
  status?: string;
  opened_at: string;
  closed_at?: string;
  published_at?: string;
  /** No tally published yet — the board shows the pending state, no results. */
  sealed: boolean;
  verified: boolean;
  contests?: BoardContest[];
  integrity: BoardIntegrity;
  crypto: BoardCrypto;
  checks: BoardCheck[];
  artifacts: string[];
  /**
   * The public verification records served at `fileUrl`. Empty (or null)
   * while the board is sealed: the console refuses them until the tally is
   * published.
   */
  files?: string[] | null;
  partial?: boolean;
  partial_reason?: string;
  /** Present on a live run only (`mode: "live"`, board.go `Live`). */
  live?: LiveBoard;
};

// --- live election ---------------------------------------------------------
//
// Field names copied from the Go JSON tags in
// `saksi/packages/saksi-campaign/live_http.go` (`LiveCounts`,
// `LiveElectionView`), `live.go` (`LivePosition`, `LiveTx`) and
// `live_board.go` (`LiveBoard`, `LiveBoardDecryption`, `LiveBoardBallot`).

/** The live election's states (docs/live/http-api.md, "States"). */
export type LiveState =
  | "setup"
  | "ceremony"
  | "open"
  | "closed"
  | "tallied"
  | "verified"
  | "abandoned";

/** `LiveCounts`. */
export type LiveCounts = {
  voters_on_roll: number;
  /**
   * The entries on the precinct's voter list (voter-list-api.md, "Counts in
   * the election view and on the board"). Sent by a console with the voter
   * list; read only when it is a number.
   */
  voters_on_list?: number;
  /** Entries that signed the list (`signed` plus `credential_issued`). */
  checked_in?: number;
  credentials_issued: number;
  /** The chain's committed nullifier count, or the console's own count. */
  ballot_records: number;
  /** "chain", or "console" when the chain did not answer. */
  ballot_records_source: string;
  /**
   * The console's figure for the fewest ballot records decryption needs
   * (http-api.md): from `open` on; absent from an older console.
   */
  min_ballot_records?: number;
  trustees_decrypted: number;
  tally_signatures: number;
  /**
   * Trustees whose receive key is in. Added by a later console; read only
   * when it is a number.
   */
  trustees_joined?: number;
};

/** `LivePosition`. */
export type LivePosition = { id: string; candidates: string[] };

/** `LiveTx`. */
export type LiveTx = { tx_id: string; block_number: number };

/** `GET /api/live/election` (`LiveElectionView`). */
export type LiveElectionView = {
  run_id: string;
  election_id: string;
  title: string;
  state: string;
  positions: LivePosition[] | null;
  trustees: number;
  threshold: number;
  params: string;
  contest_ids: string[] | null;
  issuer_public_key: string;
  dkg?: string;
  joint_public_key?: string;
  joint_key_fingerprint?: string;
  verification_keys?: unknown;
  roster_fingerprint?: string;
  ceremony_error?: string;
  /**
   * The voter list's public facts (voter-list-api.md): no name, no date.
   * Absent for an election made before the voter list.
   */
  precinct?: string;
  precinct_label?: string;
  voter_list_fingerprint?: string;
  voter_list_fingerprint_short?: string;
  counts: LiveCounts;
  lifecycle: Record<string, LiveTx> | null;
  totals?: number[];
  verify_overall?: string;
  created_at: string;
  updated_at: string;
};

/** `LiveBoardBallot`. */
export type LiveBoardBallot = {
  index: number;
  position_id: string;
  tracking_code: string;
  ballot_fingerprint: string;
  tx_id?: string;
  block_number?: number;
};

/** `LiveBoardDecryption`: k of threshold. */
export type LiveBoardDecryption = {
  trustees_decrypted: number;
  threshold: number;
  trustees: number;
  decrypted: number[] | null;
  tally_signatures: number[] | null;
};

/** `LiveBoard`, the board answer's `live` object. */
export type LiveBoard = {
  state: string;
  title: string;
  /**
   * The voter list's public facts (voter-list-api.md): no name, no date.
   * Absent for an election made before the voter list.
   */
  precinct?: string;
  precinct_label?: string;
  voter_list_fingerprint?: string;
  voter_list_fingerprint_short?: string;
  /** The sentence the board shows next to the list's facts. */
  voter_list_note?: string;
  counts: LiveCounts;
  decryption: LiveBoardDecryption;
  joint_key_fingerprint?: string;
  roster_fingerprint?: string;
  ballots: LiveBoardBallot[] | null;
  totals?: number[];
  contest_ids: string[] | null;
  verify_overall?: string;
  failed_checks?: string[] | null;
};

/**
 * What `GET /api/live/election` said: a live election, live mode with nothing
 * set up yet, or anything else (live mode off, an older console, a page that
 * is not the console's route).
 */
export type LiveProbe =
  | { kind: "live"; view: LiveElectionView }
  | { kind: "none" }
  | { kind: "off" };

/** The console's 404 body before any live election is set up. */
const NO_LIVE_ELECTION = "no live election has been set up";

/**
 * Ask the console for its live election. A network failure, or an answer
 * that says nothing (5xx, 408, 429), throws; every other answer that is not
 * the console's live route reads as `off`.
 */
export async function getLiveElection(
  signal?: AbortSignal,
): Promise<LiveProbe> {
  const res = await fetch(BASE + "/api/live/election", {
    signal,
    headers: { Accept: "application/json" },
  });
  if (saysNothing(res.status)) {
    throw new HttpError(
      `/api/live/election returned ${res.status}`,
      res.status,
    );
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (e) {
    // A 200 that says it is JSON but does not parse was cut off on the way:
    // it says nothing (the caller tries again), never "not a live console".
    if (res.ok && /\bjson\b/i.test(res.headers.get("Content-Type") ?? "")) {
      throw e;
    }
    return { kind: "off" };
  }
  if (res.status === 404) {
    const error = (body as { error?: unknown } | null)?.error;
    return error === NO_LIVE_ELECTION ? { kind: "none" } : { kind: "off" };
  }
  if (res.ok && isElectionView(body)) return { kind: "live", view: body };
  return { kind: "off" };
}

function isElectionView(body: unknown): body is LiveElectionView {
  if (typeof body !== "object" || body === null) return false;
  const v = body as Record<string, unknown>;
  return (
    typeof v.run_id === "string" &&
    v.run_id !== "" &&
    typeof v.state === "string" &&
    typeof v.counts === "object" &&
    v.counts !== null
  );
}

/**
 * One ballot RECORD. Nullifiers are derived per voter per position, so a
 * tracking code names one position of one voter, never a whole ballot.
 */
export type BallotRecord = {
  found: boolean;
  tracking_code: string;
  ballot_index: number;
  position_id?: string;
  position_label?: string;
  nullifier?: string;
  ballot_sha256?: string;
  /** Live runs only: the fingerprint of the recorded bytes, as the phone showed it. */
  ballot_fingerprint?: string;
  /** Ledger commit time, from the ballot's commit receipt. Absent offline, and
   * absent on-chain when no per-ballot receipt was recorded. */
  recorded_at?: string;
  /** Block and transaction from the ballot's commit receipt, when one exists. */
  block_number?: number;
  tx_id?: string;
  committed_on_chain: boolean;
};

/**
 * An 8-hex-character prefix is 32 bits, so two ballots can share one. The
 * console refuses that case rather than showing someone else's record, and the
 * UI has to be able to say so.
 */
export type VerifyOutcome =
  | { kind: "found"; record: BallotRecord }
  | { kind: "missing" }
  | { kind: "ambiguous" };

/** The console answered with an HTTP error; `status` says which. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * An HTTP status that says nothing about the page: the server failed (5xx),
 * timed out (408) or asked to slow down (429). Anything else below 500 is an
 * answer.
 */
export function saysNothing(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new HttpError(
      `${path} returned ${res.status}: ${(await res.text()).trim()}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export function listRuns(signal?: AbortSignal): Promise<RunView[]> {
  // /runs, not /api/trail: the trail index dials Fabric on every request and
  // fails without a network, while /runs is a pure filesystem listing.
  return get<RunView[]>("/runs", signal);
}

export function getCapabilities(signal?: AbortSignal): Promise<Capabilities> {
  return get<Capabilities>("/api/capabilities", signal);
}

export function loadBoard(runId: string, signal?: AbortSignal): Promise<Board> {
  return get<Board>(`/api/board/${encodeURIComponent(runId)}`, signal);
}

export async function verifyTrackingCode(
  runId: string,
  code: string,
): Promise<VerifyOutcome> {
  const res = await fetch(verifyCodeUrl(runId, code), {
    headers: { Accept: "application/json" },
  });
  if (res.status === 409) return { kind: "ambiguous" };
  if (!res.ok) {
    throw new Error(
      `verify-code returned ${res.status}: ${(await res.text()).trim()}`,
    );
  }
  const record = (await res.json()) as BallotRecord;
  return record.found ? { kind: "found", record } : { kind: "missing" };
}

/** Where anyone can check one tracking code against a run's ballot records. */
export function verifyCodeUrl(runId: string, code: string): string {
  return `${BASE}/api/verify-code/${encodeURIComponent(runId)}/${encodeURIComponent(code)}`;
}

/**
 * Public download URL for one of `Board.files`. A name can hold a folder
 * (`ledger/header.json`), so each segment is encoded and the slash kept.
 */
export function fileUrl(runId: string, name: string): string {
  const path = name.split("/").map(encodeURIComponent).join("/");
  return `${BASE}/api/board/${encodeURIComponent(runId)}/files/${path}`;
}

/** The console's own public trail page for this election. */
export function verifierUrl(runId: string): string {
  return `${BASE}/trail/${encodeURIComponent(runId)}`;
}
