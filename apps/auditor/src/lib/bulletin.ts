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
  partial?: boolean;
  partial_reason?: string;
};

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
  /** Ledger commit time. Null offline — there is no receipt to read one from. */
  recorded_at?: string;
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

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `${path} returned ${res.status}: ${(await res.text()).trim()}`,
    );
  }
  return (await res.json()) as T;
}

export function listRuns(signal?: AbortSignal): Promise<RunView[]> {
  // /runs, not /api/trail: the trail index dials Fabric on every request and
  // fails without a network, while /runs is a pure filesystem listing.
  return get<RunView[]>("/runs", signal);
}

export function loadBoard(runId: string, signal?: AbortSignal): Promise<Board> {
  return get<Board>(`/api/board/${encodeURIComponent(runId)}`, signal);
}

export async function verifyTrackingCode(
  runId: string,
  code: string,
): Promise<VerifyOutcome> {
  const res = await fetch(
    `${BASE}/api/verify-code/${encodeURIComponent(runId)}/${encodeURIComponent(code)}`,
    { headers: { Accept: "application/json" } },
  );
  if (res.status === 409) return { kind: "ambiguous" };
  if (!res.ok) {
    throw new Error(
      `verify-code returned ${res.status}: ${(await res.text()).trim()}`,
    );
  }
  const record = (await res.json()) as BallotRecord;
  return record.found ? { kind: "found", record } : { kind: "missing" };
}

/** Direct download URL for one of a run's artifacts. */
export function exportUrl(runId: string, artifact: string): string {
  return `${BASE}/export/${encodeURIComponent(runId)}/${encodeURIComponent(artifact)}`;
}

/** The console's own public trail page for this election. */
export function verifierUrl(runId: string): string {
  return `${BASE}/trail/${encodeURIComponent(runId)}`;
}
