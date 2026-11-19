/**
 * The seam between the phone voter screens and whatever does the work.
 *
 * Task 5a shipped the screens on `MockLiveClient` (in memory). `RealLiveClient`
 * has two halves: the voter's cryptography (the saksi WebAssembly module,
 * `voterCrypto.ts`, task 5b-1) and a `LiveTransport` to the console
 * (`transport.ts`, filled in by task 5b-2). The screens only ever see the
 * types below: no hex,
 * no proofs, no HTTP paths. Anything the real client needs to carry between
 * calls (ciphertexts, opened randomness, the credential itself) stays inside
 * the client, keyed by the opaque ids these types expose.
 */

export type ElectionStatus = "setup" | "open" | "closed" | "tallied";

export interface Candidate {
  id: string;
  name: string;
  /** One short line under the name (party, course, "Placeholder"). */
  detail?: string;
}

export interface Position {
  id: string;
  title: string;
  candidates: Candidate[];
}

export interface ElectionInfo {
  id: string;
  title: string;
  status: ElectionStatus;
  positions: Position[];
  /**
   * The election key's fingerprint (`XXXX-…`, 8 groups), the value every
   * trustee page shows, so people can confirm this phone encrypts under the
   * key the trustees made. Absent on the mock.
   */
  keyFingerprint?: string;
  /**
   * The console's run id for this election, which names it on the public
   * board (`/board/?run=<id>`). Absent on the mock and the local test
   * election, which have no board.
   */
  runId?: string;
  /**
   * The precinct as the console names it on every screen, e.g. "Precinct
   * 0001A (demonstration)" (saksi docs/live/voter-list-api.md). Absent for
   * an election with no voter list.
   */
  precinctLabel?: string;
}

/**
 * Where this phone's check-in stands (voter-list-api.md, "Check-in states"):
 * the list entry's state, or for a check-in the Electoral Board ended,
 * `refused` (at the desk) or `reset` (by the presenter).
 */
export type CheckinState =
  | "not_checked_in"
  | "at_desk"
  | "approved"
  | "signed"
  | "credential_issued"
  | "refused"
  | "reset";

/** One entry of the precinct's list, as the console returns it. */
export interface ListEntry {
  /** The sequence number on the list, 1 to N. */
  seq: number;
  lastName: string;
  firstName: string;
  /** "" when the list has none. */
  middleName: string;
}

/** The phone's check-in (`GET /api/live/checkin`). */
export interface Checkin {
  state: CheckinState;
  /** The console's election id the check-in belongs to. */
  electionId: string;
  precinctLabel: string;
  /** Absent for `refused` and `reset`. */
  entry?: ListEntry;
}

/**
 * What the voter types to find their name. Held in memory only, until the
 * declaration is sent; never stored, never logged.
 */
export interface VoterDetails {
  lastName: string;
  firstName: string;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string;
}

/** A name found on the list (`POST /api/live/checkin/find`). */
export interface FoundVoter {
  precinctLabel: string;
  entry: ListEntry;
}

/**
 * The signature on the election-day list: strokes of integer points in a
 * 1000 x 400 box, or "I cannot sign" (voter-list-api.md, "The signature").
 */
export type ListSignature =
  | { strokes: [number, number][][] }
  | { cannotSign: true };

/** Which voting software (the WebAssembly crypto build) runs on this phone. */
export interface SoftwareInfo {
  /** One line for people, e.g. "saksi-wasm 0.1.0 · 6d2555f · saksi-live-wire-v1". */
  label: string;
  /** False on the mock, which does no cryptography. */
  real: boolean;
}

/** One step of getting the voting credential, reported as it happens. */
export interface EnrolStep {
  /** 0-based position of this step in the sequence. */
  index: number;
  total: number;
  label: string;
  state: "running" | "done";
}

/** What `enrol` reports when it finishes. */
/** The steps `enrol` reports, in order. */
export const ENROL_STEPS = [
  "Asking the election authority to start",
  "Blinding the request on this phone",
  "Authority signs the blinded request",
  "Unblinding and checking the signature",
  "Storing the credential on this phone",
] as const;

export interface EnrolResult {
  /**
   * The credential was committed to this phone's storage and survives a
   * reload. False when the browser refused to store it (private window,
   * storage blocked): it then lives only until the page closes.
   */
  persistent: boolean;
}

/** The voter's pick for one position. */
export interface Choice {
  positionId: string;
  candidateId: string;
}

export interface EncryptedPosition {
  positionId: string;
  /**
   * `BC-XXXX-XXXX`, the first 8 hex digits of the ballot's nullifier,
   * upper-cased. It names the voter's slot for this position, not a
   * particular ballot: every ballot this voter builds for the position,
   * including one thrown away after a challenge, has the same code.
   */
  trackingCode: string;
  /**
   * Names this particular encrypted ballot: the first 128 bits of the
   * SHA-256 of its bytes, upper-case hex in eight groups of four
   * (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`). Shown before the voter
   * chooses submit or challenge; a fresh ballot always has a new one.
   */
  fingerprint: string;
}

/** A position sent without a known outcome (see `LiveClient.unconfirmed`). */
export interface UnconfirmedPosition extends EncryptedPosition {
  /**
   * A resend was answered "this position is taken", and the board did not
   * show this phone's ballot. Without it: the phone never heard back.
   */
  takenUnconfirmed?: boolean;
}

/**
 * A ballot encrypted on this phone and not yet sent. `ballotId` is a handle
 * the client resolves internally; it means nothing to the screens.
 */
export interface EncryptedBallot {
  ballotId: string;
  positions: EncryptedPosition[];
}

/**
 * Benaloh check for one position of a challenged ballot. Every field except
 * `positionId` is what the check found in the ballot it opened, never what
 * the voter asked for or was shown: the screen compares them with those.
 */
export interface ChallengeResult {
  /** The position of the encrypted ballot this result is for. */
  positionId: string;
  /** The position of the ballot the check actually opened. */
  checkedPositionId: string;
  trackingCode: string;
  /** The candidate the opened ballot encrypts; null when it does not open to one. */
  candidateId: string | null;
  /** The fingerprint of the ballot the check actually opened. */
  fingerprint: string;
  /**
   * True when the opened randomness reproduces the ballot exactly and it
   * holds one candidate. This alone does not pass the check: the position,
   * the candidate and the fingerprint must also be the ones the voter chose
   * and saw.
   */
  matches: boolean;
}

/** The ledger's answer for one position's ballot. */
export interface SubmitReceipt {
  positionId: string;
  trackingCode: string;
  /** The fingerprint of the ballot that was sent (see `EncryptedPosition`). */
  fingerprint: string;
  txId: string;
  block: number;
  /**
   * Set when the console's answer for this position did not match what the
   * phone showed before the cast (another fingerprint or tracking code, or
   * the console's read-back of the chain's bytes differed). Something is on
   * the ledger under this voter's tracking code, but not provably the
   * ballot the phone showed; the screens raise the alarm and keep it.
   */
  alarm?: RecordAlarm;
}

/** What the console reported for a position whose answer did not match. */
export interface RecordAlarm {
  /** The tracking code in the console's answer ("" when it sent none). */
  recordedTrackingCode: string;
  /** The fingerprint in the console's answer ("" when it sent none). */
  recordedFingerprint: string;
  /** The console's `recorded_bytes_match`; false when absent. */
  recordedBytesMatch: boolean;
}

export interface LookupResult {
  trackingCode: string;
  /** The board has a ballot with this code. */
  recorded: boolean;
  /** That ballot is in the published tally. */
  counted: boolean;
  /** Which position the ballot is for, when the board says. */
  positionTitle?: string;
  /**
   * The fingerprint of the recorded bytes, as the board computes it (live
   * elections only), to compare with the one on the receipt.
   */
  fingerprint?: string;
}

export type LiveErrorKind =
  /** The phone could not reach the console, or it answered 5xx. Retryable. */
  | "network"
  /**
   * This phone has no check-in, or the Electoral Board ended it: the app
   * reads the check-in again and shows the screen it calls for.
   */
  | "auth"
  /** The election is not accepting this action in its current status. */
  | "not-open"
  | "closed"
  /** This account's ballot is already on the ledger. */
  | "already-voted"
  /** The console or chaincode refused the request; `message` says why. */
  | "refused"
  /** This browser cannot run the voting software (WebAssembly). */
  | "unsupported";

/**
 * What a screen needs beyond the kind and the message, for the few failures
 * that have their own screen or wording. The kind alone still decides what
 * happens to a ballot (only `network` keeps it for a retry).
 */
export type LiveErrorDetail =
  /** The account already has its credential for this election: no retry. */
  | { type: "already-issued" }
  /** The chaincode refused the transaction; both fields are the console's. */
  | { type: "chain-refusal"; gate: string; reason: string }
  /** The console's answer to a ballot did not match what the phone showed. */
  | {
      type: "record-mismatch";
      positionId: string;
      shown: { trackingCode: string; fingerprint: string };
      recorded: RecordAlarm & { txId: string; block: number };
    }
  /**
   * The ballot names another election than the console's live one (400
   * `wrong-election`): the phone holds a stale election and must reload it.
   */
  | { type: "stale-election" }
  /**
   * The credential this phone holds does not check out for the console's
   * election (a new election started mid-ballot): the phone reads the
   * check-in again instead of building a ballot with it.
   */
  | { type: "stale-credential" }
  /** The console asked the phone to wait (429 with `Retry-After`). */
  | { type: "rate-limited"; retryAfterSeconds: number }
  /**
   * The election has no voter list (409 `no-voter-list`): check-in is not
   * possible on any phone.
   */
  | { type: "no-voter-list" }
  /**
   * A check-in route refused the request with this `code`
   * (voter-list-api.md): `not-on-list`, `already-checked-in`, `bad-date`,
   * `bad-request`, `declaration-required`, `checkin-in-progress`,
   * `bad-signature`, `wrong-state`, `not-signed`.
   */
  | { type: "checkin"; code: string }
  /**
   * This phone's storage failed to read receipts, markers or the
   * credential, so nothing was built or sent (N2). Kind `network`: the same
   * request may be tried again once storage reads.
   */
  | { type: "storage-read" };

/** N2: the error screen's title when this phone's storage would not read. */
export const STORAGE_READ_TITLE = "This phone could not read its records";

/** N2: the message, also shown inline on Review and while sending. */
export const STORAGE_READ_MESSAGE =
  "This phone could not read its own records, so nothing was built or sent. If this keeps happening, show this screen to an election officer.";

/** Read a record whose absence would let the phone build or send. */
export async function readStrict<T>(
  store: { getStrict<U>(key: string): Promise<U | undefined> },
  key: string,
): Promise<T | undefined> {
  try {
    return await store.getStrict<T>(key);
  } catch {
    // Never "nothing stored": stop here, before anything is built or sent.
    throw new LiveError("network", STORAGE_READ_MESSAGE, {
      type: "storage-read",
    });
  }
}

/** Every failure the screens can show. `message` is user-facing text. */
export class LiveError extends Error {
  readonly kind: LiveErrorKind;
  readonly detail?: LiveErrorDetail;
  constructor(kind: LiveErrorKind, message: string, detail?: LiveErrorDetail) {
    super(message);
    this.name = "LiveError";
    this.kind = kind;
    if (detail) this.detail = detail;
  }
}

export function isLiveError(e: unknown): e is LiveError {
  return e instanceof LiveError;
}

export interface LiveClient {
  /**
   * True only for the mock: a practice election in memory. The screens then
   * show the practice banner on every screen.
   */
  readonly practice?: boolean;
  /**
   * The practice election's own line under the check-in form (who is on its
   * list). Only the mock has one, so the default build carries none.
   */
  readonly practiceNote?: string;
  /**
   * Load the voting software (the WebAssembly crypto) if it is not loaded
   * yet, and say which build it is. Fails with `unsupported` when the
   * browser cannot run it.
   */
  software(): Promise<SoftwareInfo>;
  /**
   * This phone's check-in, or null when it has none (no cookie, or one for
   * another election). Fails `not-open` with no detail when no election is
   * set up, and with the `no-voter-list` detail for an election with no list.
   */
  checkin(): Promise<Checkin | null>;
  /** Look for the one list entry with these details. Changes nothing. */
  findVoter(details: VoterDetails): Promise<FoundVoter>;
  /**
   * The same details again with the declaration: the entry goes to the
   * Electoral Board's desk and this phone holds the check-in.
   */
  declare(details: VoterDetails): Promise<Checkin>;
  /** Sign the election-day list (state `approved`). */
  signList(signature: ListSignature): Promise<Checkin>;
  election(): Promise<ElectionInfo>;
  /** A voting credential for this election is stored on this phone. */
  hasCredential(): Promise<boolean>;
  /** Get the voting credential and store it on this phone. */
  enrol(onStep: (s: EnrolStep) => void): Promise<EnrolResult>;
  /**
   * Encrypt one choice per position still to be sent. Nothing is sent.
   *
   * The ballot covers every position of the election that this phone has
   * neither recorded (a receipt) nor sent without hearing back (see
   * `unconfirmed`), so after a partly recorded ballot it covers only the
   * missing positions (D11). A choice for a recorded or unconfirmed
   * position is refused (`already-voted`): such a position is never built
   * again.
   */
  encrypt(choices: Choice[]): Promise<EncryptedBallot>;
  /**
   * Open the ballot (Benaloh challenge) and check it, on this phone. The
   * opened ballot is discarded for good: `submit` refuses it afterwards, and
   * neither it nor its opening ever leaves the client. Encrypting the same
   * choices again gives a fresh ballot: new fingerprints, same tracking codes.
   */
  challenge(ballot: EncryptedBallot): Promise<ChallengeResult[]>;
  /**
   * Remember, on this phone only, that a challenge check failed for this
   * election. The stored value is `{ electionId, checkFailed: true }` and
   * nothing else; it never goes to the transport. There is no call to clear
   * it: a later passed check does not undo a failed one.
   */
  recordFailedCheck(electionId: string): Promise<void>;
  /** A failed check was recorded on this phone for this election. */
  failedCheckRecorded(electionId: string): Promise<boolean>;
  /**
   * Send the ballot, one ledger transaction per position, in position order.
   * `onPosition` fires as each position is recorded.
   *
   * Partial sends: a receipt is stored as soon as its position is recorded.
   * If the send is cut off, calling `submit` again with the same ballot must
   * resume from the first unrecorded position (calling `onPosition` again for
   * the ones already recorded is allowed) and never re-send a recorded one.
   * If the ballot can no longer be resumed (for example the page reloaded and
   * the encrypted ballot is gone), `receipts()` returns the shorter list and
   * the screens show the ballot as partly recorded.
   *
   * The already-voted rule is per position (each has its own nullifier): a
   * ballot holding a position that is already recorded from another ballot
   * is refused whole, before anything is sent. After any receipt with an
   * alarm nothing is sent at all. Resolves with every receipt of this
   * account, the earlier ones included.
   */
  submit(
    ballot: EncryptedBallot,
    onPosition: (r: SubmitReceipt) => void,
  ): Promise<SubmitReceipt[]>;
  /**
   * Positions whose ballot this phone sent without learning the outcome (the
   * connection dropped, or the ledger said the position is taken but the
   * board did not show this exact ballot). Kept on the phone across a
   * reload. Such a position is neither "Recorded" nor "Not sent": only
   * `resendUnconfirmed` may send it, the same bytes again.
   */
  unconfirmed(): Promise<UnconfirmedPosition[]>;
  /**
   * A handle for sending the unconfirmed positions again, byte for byte the
   * ballot sent before (pass it to `submit`), or null when there are none.
   * The ledger records a position once, and a resend that the ledger turns
   * away counts as recorded only when the board shows this exact ballot.
   */
  resendUnconfirmed(): Promise<EncryptedBallot | null>;
  /**
   * Receipts stored on this phone for this election, or null when
   * nothing was sent. Fewer receipts than positions means a send was cut off
   * (see `submit`).
   */
  receipts(): Promise<SubmitReceipt[] | null>;
  /**
   * Ask the public board about a tracking code. The screens only call this
   * with a code that passes `TRACKING_CODE`, in the upper-case `BC-XXXX-XXXX`
   * form. The real client owns the mapping to the board's form: it must strip
   * the `BC-` prefix and the dash and match the hex case the board uses.
   */
  lookup(trackingCode: string): Promise<LookupResult>;
}

/** A ballot fingerprint: 128 bits, upper-case hex, eight groups of four. */
export const FINGERPRINT = /^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/;

/** `BC-` then the first 8 hex digits of the nullifier, upper-cased. */
export const TRACKING_CODE = /^BC-[0-9A-F]{4}-[0-9A-F]{4}$/;

/** Upper-case, trim, and add the `BC-` and dash the voter may have left out. */
export function normaliseTrackingCode(input: string): string {
  let raw = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (raw.length === 10 && raw.startsWith("BC")) raw = raw.slice(2);
  if (raw.length !== 8) return input.trim().toUpperCase();
  return `BC-${raw.slice(0, 4)}-${raw.slice(4)}`;
}
