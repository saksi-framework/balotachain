/**
 * The live election's JSON shapes, copied from the Go JSON tags in
 * `saksi/packages/saksi-campaign`. The election view types are the same as
 * `apps/auditor/src/lib/bulletin.ts` (the apps do not import from each other);
 * the answers of the presenter's own routes are added here.
 */

/** `LiveCounts` (live_http.go). */
export type LiveCounts = {
  /** The older name of `voters_on_list`, with the same value. */
  voters_on_roll: number;
  /** Entries on the voter list (voter-list-api.md); absent from an older console. */
  voters_on_list?: number;
  /** Entries that signed the list: `signed` plus `credential_issued`. */
  checked_in?: number;
  credentials_issued: number;
  /** The chain's committed nullifier count, or the console's own count. */
  ballot_records: number;
  /** "chain", or "console" when the chain did not answer. */
  ballot_records_source: string;
  /**
   * The console's figure for the fewest ballot records decryption needs
   * (http-api.md): present from `open` on, absent from an older console.
   */
  min_ballot_records?: number;
  trustees_decrypted: number;
  tally_signatures: number;
  /**
   * Trustees whose receive key is in the roster. Added by a later console;
   * read only when it is a number.
   */
  trustees_joined?: number;
};

/** `LivePosition` (live.go). */
export type LivePosition = { id: string; candidates: string[] };

/** `LiveTx` (live.go). */
export type LiveTx = { tx_id: string; block_number: number };

/** `GET /api/live/election` (`LiveElectionView`, live_http.go). */
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
  /** Always sent by the console; typed optional so a missing one is "not known". */
  counts?: LiveCounts;
  lifecycle: Record<string, LiveTx> | null;
  totals?: number[];
  verify_overall?: string;
  /**
   * The console's automatic verification since it started (http-api.md,
   * "Verification is automatic"): null when none ran. Not saved: null after
   * a restart until a new automatic run starts.
   */
  auto_verify?: AutoVerify | null;
  created_at: string;
  updated_at: string;
};

/** `auto_verify` in the election view. */
export type AutoVerify = {
  /** `done`: a verdict was recorded (`verify_overall`); `error`: none. */
  state: "running" | "done" | "error";
  error?: string;
  at?: string;
};

/** `LiveElectionRequest` (live.go): the body of `POST /api/live/elections`. */
export type LiveElectionRequest = {
  title: string;
  positions: LivePosition[];
  trustees: number;
  threshold: number;
  /** The CSV text the preview had (voter-list-api.md). */
  voter_list?: string;
  /** The preview's fingerprint for that text. */
  voter_list_fingerprint?: string;
};

// --- the voter list and the desk (docs/live/voter-list-api.md) -----------------

/** One error in a list file: `line` 0 is the whole file. */
export type VoterListError = { line: number; code: string; message: string };

/** One row of the preview. The date itself is never sent. */
export type VoterListPreviewRow = {
  seq: number;
  line: number;
  last_name: string;
  first_name: string;
  middle_name: string;
  date_of_birth_valid: boolean;
};

/** `POST /api/live/voter-list/preview`. */
export type VoterListPreview = {
  precinct: string;
  precinct_label: string;
  valid: boolean;
  count: number;
  max_rows: number;
  rows: VoterListPreviewRow[] | null;
  errors: VoterListError[] | null;
  fingerprint: string;
  fingerprint_short: string;
};

/** A check-in state, as the console names it. */
export type CheckinStatus =
  | "not_checked_in"
  | "at_desk"
  | "approved"
  | "signed"
  | "credential_issued";

/** Strokes of `[x, y]` integer points in a 1000 by 400 box, or "I cannot sign". */
export type Signature = {
  strokes?: unknown;
  cannot_sign?: boolean;
};

/** One entry of the election-day list (and the desk routes' answer). */
export type ListEntry = {
  seq: number;
  last_name: string;
  first_name: string;
  middle_name: string;
  /** Typed as a string: a state this page does not know is shown as sent. */
  status: string;
  signature?: Signature;
};

/** `GET /api/live/voter-list`. */
export type VoterListView = {
  election_id: string;
  election_state: string;
  precinct: string;
  precinct_label: string;
  fingerprint: string;
  fingerprint_short: string;
  count: number;
  counts?: {
    not_checked_in?: number;
    at_desk?: number;
    approved?: number;
    signed?: number;
    credential_issued?: number;
    checked_in?: number;
  };
  desk: ListEntry[] | null;
  entries: ListEntry[] | null;
};

/** `LiveLedgerBallot` (live_tally.go). */
export type LiveLedgerBallot = {
  nullifier: string;
  position_id: string;
  tracking_code: string;
  ballot_fingerprint: string;
  ballot: string;
};

/** `LiveLedger` (live_tally.go): `GET /api/live/ledger`, read from the chain. */
export type LiveLedger = {
  election_id: string;
  status: string;
  params: string;
  dkg?: string;
  tally?: string;
  nullifier_count: number;
  ballots: LiveLedgerBallot[] | null;
  partials:
    | { trustee_id: string; contest_id: string; partial: string }[]
    | null;
};

/** One entry of the verdict's `failed_checks` (wire-format.md, verify-live). */
export type FailedCheck = {
  check: string;
  status?: string;
  passed?: number;
  failed?: number;
  detail?: string;
};

/** `POST /api/live/verify`'s answer (live_tally.go `verify`). */
export type VerifyAnswer = {
  state: string;
  overall: string;
  failed_checks: FailedCheck[] | null;
  expected_ballots: number;
  verdict?: unknown;
  verified_at: string;
};

/** `POST /api/live/tally/publish`'s answer (live_tally.go `publishLocked`). */
export type PublishAnswer = {
  published: boolean;
  already_on_chain?: boolean;
  totals?: number[];
  signatures_used?: number;
  tx_id?: string;
  block_number?: number;
};
