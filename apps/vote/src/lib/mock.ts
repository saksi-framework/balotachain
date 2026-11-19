import { idToName } from "@balotachain/ui";
import {
  ALREADY_CHECKED_IN,
  CHECKIN_ENDED,
  CHECKIN_IN_PROGRESS,
  NO_VOTER_LIST,
  NOT_ON_LIST,
} from "./checkin";
import {
  ENROL_STEPS,
  LiveError,
  readStrict,
  type Choice,
  type ChallengeResult,
  type Checkin,
  type CheckinState,
  type ElectionInfo,
  type ElectionStatus,
  type EncryptedBallot,
  type EnrolResult,
  type EnrolStep,
  type FoundVoter,
  type ListEntry,
  type ListSignature,
  type LiveClient,
  type LiveErrorKind,
  type LookupResult,
  type Position,
  type UnconfirmedPosition,
  type SoftwareInfo,
  type SubmitReceipt,
  type VoterDetails,
} from "./live";
import { ALREADY_ISSUED } from "./http";
import { PHONE_SCOPE } from "./real";
import {
  failedCheckRecorded,
  keys,
  memoryStore,
  recordFailedCheck,
  type KeyValueStore,
  type PendingSend,
} from "./storage";

/**
 * In-memory stand-in for the live console and the WebAssembly crypto. Delays
 * follow the real network (about 2 s per ledger transaction) so the screens'
 * progress states are visible; tests pass `speed: 0`.
 *
 * The precinct's list holds three fictional voters (`MOCK_VOTERS`). The
 * mock's Electoral Board approves by itself a moment after the declaration
 * (`desk: "manual"` leaves it to `approve`, `refuse` and `resetCheckin`).
 */

export type MockOp =
  | "checkin"
  | "election"
  | "enrol"
  | "encrypt"
  | "challenge"
  | "submit"
  | "lookup";

export interface MockOptions {
  store?: KeyValueStore;
  status?: ElectionStatus;
  /** Multiplies every delay. 1 is realistic, 0 is instant. */
  speed?: number;
  /** Operations whose next call fails with a network error. */
  failOnce?: MockOp[];
  /**
   * Voting opens by itself this many ms after the client is made (the
   * status is `setup` until then), to watch the waiting screen move on.
   */
  opensAfterMs?: number;
  /**
   * The election's id (default `live-mock`). Receipts, markers and the
   * credential are kept per election, so another id is a second run.
   */
  electionId?: string;
  /** The positions on the ballot (default: President, Vice President). */
  positions?: Position[];
  /**
   * Act as a compromised phone on the next ballot, while its challenge still
   * reports that the randomness rebuilds the ballot. The Benaloh check must
   * catch each one:
   * - `true` or `"candidate"`: the first position encrypts another candidate;
   * - `"fingerprint"`: the challenge opens a different ballot from the one
   *   shown (another fingerprint);
   * - `"position"`: the challenge opens a ballot for another position.
   */
  tamper?: MockTamper;
  /** Who approves at the desk: the mock by itself (default), or the test. */
  desk?: "auto" | "manual";
  /** False: an election with no voter list (409 `no-voter-list`). */
  voterList?: boolean;
  /** List entries already checked in on other phones. */
  checkedInElsewhere?: number[];
}

export type MockTamper = boolean | "candidate" | "fingerprint" | "position";

/** The practice list. Fictional voters only; no row is a real person. */
export const MOCK_VOTERS: readonly (ListEntry & { dateOfBirth: string })[] = [
  {
    seq: 1,
    lastName: "Halimbawa",
    firstName: "Uno",
    middleName: "Pagsubok",
    dateOfBirth: "1990-01-01",
  },
  {
    seq: 2,
    lastName: "Peña",
    firstName: "Dos",
    middleName: "Santos-Reyes",
    dateOfBirth: "1991-02-02",
  },
  {
    seq: 3,
    lastName: "Sampol",
    firstName: "Tres",
    middleName: "",
    dateOfBirth: "1992-03-03",
  },
];

export const MOCK_PRECINCT = "Precinct 0001A (demonstration)";

const MOCK_NOTE =
  "Practice list: Uno Halimbawa, born 1 1 1990; Dos Peña, born 2 2 1991; Tres Sampol, born 3 3 1992 (month, day, year). The practice Electoral Board approves by itself.";

/** The voter-list API's match form: no accents, no case, no punctuation. */
export function matchForm(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[-\u2010-\u2015.]/g, " ")
    .replace(/['\u2019]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The mock's stand-in for the check-in cookie, kept in the phone's store. */
const CHECKIN_KEY = "mock-checkin";

interface MockCheckin {
  electionId: string;
  seq: number;
  state: CheckinState;
  /** When the declaration came in (the automatic desk approves after it). */
  deskAt: number;
}

const MOCK_ELECTION: Omit<ElectionInfo, "status"> = {
  id: "live-mock",
  title: "Student Council Election (mock)",
  positions: [
    {
      id: "president",
      title: "President",
      candidates: [
        { id: "p-a", name: "Candidate A", detail: "Placeholder" },
        { id: "p-b", name: "Candidate B", detail: "Placeholder" },
        { id: "p-c", name: "Candidate C", detail: "Placeholder" },
      ],
    },
    {
      id: "vice-president",
      title: "Vice President",
      candidates: [
        { id: "v-a", name: "Candidate D", detail: "Placeholder" },
        { id: "v-b", name: "Candidate E", detail: "Placeholder" },
        { id: "v-c", name: "Candidate F", detail: "Placeholder" },
      ],
    },
  ],
};

export { ENROL_STEPS };

/**
 * `?names=long`: positions whose ids are the longest names D19 allows, for
 * the layout check (D20). Shown the way the console's ids are, through
 * `idToName`. Mock only; a function, not a module-level value, so the
 * default build drops it with the rest of the mock.
 */
export function longNamePositions(): Position[] {
  return [
    "Chairperson-of-the-Student-Council-Committee-on-Rules-and-Ethics",
    "ChairpersonOfTheStudentCouncilCommitteeOnRulesEthicsAndAudits206",
  ].map((id, i) => ({
    id,
    title: idToName(id),
    candidates: [
      "Juan-P.-Dela-Cruz",
      "Maria-Santos",
      i === 0
        ? "Ana-Reyes"
        : "BartolomeDeLasCasasYSantiagoDeLaCruzMercadoRealondaDelRosarioIII",
    ].map((c) => ({ id: c, name: idToName(c) })),
  }));
}

/** Codes already on the mock board from voters on other phones. */
export const MOCK_BOARD_CODES = ["BC-4A7F-29C0", "BC-E31B-8D5A"] as const;

// The real code is the first 8 hex digits of the nullifier, upper-cased.
const CODE_ALPHABET = "0123456789ABCDEF";
const HEX = "0123456789abcdef";

function pick(alphabet: string, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * The real code comes from the nullifier, which is fixed per voter and
 * position: the mock derives it from the account and position the same way
 * (FNV-1a, not cryptography), so a fresh ballot keeps its code.
 */
export function mockTrackingCode(account: string, positionId: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${account}/${positionId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hex = h.toString(16).toUpperCase().padStart(8, "0");
  return `BC-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** A fresh ballot fingerprint in the real format (random, not a hash). */
function newFingerprint(): string {
  return Array.from({ length: 8 }, () => pick(CODE_ALPHABET, 4)).join("-");
}

const NETWORK =
  "Could not reach the election server. Check the Wi-Fi and try again.";

interface HeldBallot {
  account: string;
  choices: Choice[];
  codes: string[];
  fingerprints: string[];
  challenged: boolean;
  /** What the next challenge of this ballot misreports (see `MockTamper`). */
  tamper: Exclude<MockTamper, boolean | "candidate"> | null;
}

export class MockLiveClient implements LiveClient {
  /** A practice election: the screens show the practice banner. */
  readonly practice = true;
  private readonly store: KeyValueStore;
  private readonly speed: number;
  private status: ElectionStatus;
  private readonly failures = new Map<
    MockOp,
    { error: LiveError; skip: number }
  >();
  private readonly ballots = new Map<string, HeldBallot>();
  private readonly board = new Map<
    string,
    { positionId: string; txId: string }
  >();
  private nextBallot = 1;
  private tamper: MockTamper;
  private block = 41;
  private opensAt: number | null = null;
  /** This mock's election: `MOCK_ELECTION`, or another id or positions. */
  private readonly info: Omit<ElectionInfo, "status">;
  private readonly desk: "auto" | "manual";
  private readonly voterList: boolean;
  private readonly elsewhere: Set<number>;
  /** The last signature sent, for tests: numbers only, as the console keeps. */
  lastSignature: ListSignature | null = null;
  readonly practiceNote = MOCK_NOTE;

  constructor(opts: MockOptions = {}) {
    this.store = opts.store ?? memoryStore();
    this.info = {
      ...MOCK_ELECTION,
      id: opts.electionId ?? MOCK_ELECTION.id,
      positions: opts.positions ?? MOCK_ELECTION.positions,
    };
    this.speed = opts.speed ?? 1;
    this.status = opts.status ?? "open";
    if (opts.opensAfterMs !== undefined) {
      this.status = "setup";
      this.opensAt = Date.now() + opts.opensAfterMs;
    }
    this.tamper = opts.tamper ?? false;
    this.desk = opts.desk ?? "auto";
    this.voterList = opts.voterList ?? true;
    this.elsewhere = new Set(opts.checkedInElsewhere ?? []);
    for (const op of opts.failOnce ?? []) this.failNext(op);
    MOCK_BOARD_CODES.forEach((code, i) =>
      this.board.set(code, {
        positionId: this.info.positions[i % 2]!.id,
        txId: pick(HEX, 64),
      }),
    );
  }

  /**
   * Make a coming call of `op` fail, network by default. `skip` lets that many
   * checks pass first: `submit` checks once per position, so `skip: 1` fails
   * the second position after the first is recorded.
   */
  failNext(
    op: MockOp,
    kind: LiveErrorKind = "network",
    message = NETWORK,
    skip = 0,
  ) {
    this.failures.set(op, { error: new LiveError(kind, message), skip });
  }

  /** Make the next ballot dishonest (see `MockOptions.tamper`). */
  tamperNext(how: MockTamper = "candidate") {
    this.tamper = how;
  }

  setStatus(status: ElectionStatus) {
    this.status = status;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms * this.speed));
  }

  private maybeFail(op: MockOp) {
    const f = this.failures.get(op);
    if (!f) return;
    if (f.skip > 0) {
      f.skip--;
      return;
    }
    this.failures.delete(op);
    throw f.error;
  }

  /** The records' scope: one voter per phone, as the real client. */
  private async session(): Promise<{ account: string }> {
    return { account: PHONE_SCOPE };
  }

  private async record(): Promise<MockCheckin | null> {
    const r = await this.store.get<MockCheckin>(CHECKIN_KEY);
    // The cookie is bound to one election: in the next it is no check-in.
    return r && r.electionId === this.info.id ? r : null;
  }

  private async setRecord(r: MockCheckin): Promise<void> {
    await this.store.set(CHECKIN_KEY, r);
  }

  private view(r: MockCheckin): Checkin {
    const v: Checkin = {
      state: r.state,
      electionId: this.info.id,
      precinctLabel: MOCK_PRECINCT,
    };
    if (r.state !== "refused" && r.state !== "reset") {
      const { dateOfBirth: _dob, ...entry } = MOCK_VOTERS[r.seq - 1]!;
      void _dob;
      v.entry = entry;
    }
    return v;
  }

  private requireList() {
    if (!this.voterList) {
      throw new LiveError("refused", NO_VOTER_LIST, { type: "no-voter-list" });
    }
  }

  /** Check-in is open only while voting is. */
  private requireCheckinOpen() {
    this.tick();
    if (this.status !== "open") {
      throw new LiveError(
        "not-open",
        "Check-in is open only while voting is open.",
      );
    }
  }

  /** The one entry these details name, or the console's refusal. */
  private match(d: VoterDetails): ListEntry & { dateOfBirth: string } {
    const hit = MOCK_VOTERS.find(
      (v) =>
        matchForm(v.lastName) === matchForm(d.lastName) &&
        matchForm(v.firstName) === matchForm(d.firstName) &&
        v.dateOfBirth === d.dateOfBirth,
    );
    if (!hit) {
      throw new LiveError("refused", NOT_ON_LIST, {
        type: "checkin",
        code: "not-on-list",
      });
    }
    return hit;
  }

  private async entryTaken(seq: number): Promise<boolean> {
    if (this.elsewhere.has(seq)) return true;
    const r = await this.record();
    return (
      r !== null &&
      r.seq === seq &&
      r.state !== "not_checked_in" &&
      r.state !== "refused" &&
      r.state !== "reset"
    );
  }

  async checkin(): Promise<Checkin | null> {
    await this.wait(200);
    this.maybeFail("checkin");
    this.requireList();
    const r = await this.record();
    if (!r) return null;
    if (
      r.state === "at_desk" &&
      this.desk === "auto" &&
      Date.now() >= r.deskAt + 1500 * this.speed
    ) {
      r.state = "approved";
      await this.setRecord(r);
    }
    return this.view(r);
  }

  async findVoter(d: VoterDetails): Promise<FoundVoter> {
    await this.wait(400);
    this.maybeFail("checkin");
    this.requireList();
    this.requireCheckinOpen();
    const hit = this.match(d);
    if (await this.entryTaken(hit.seq)) {
      throw new LiveError("refused", ALREADY_CHECKED_IN, {
        type: "checkin",
        code: "already-checked-in",
      });
    }
    const { dateOfBirth: _dob, ...entry } = hit;
    void _dob;
    return { precinctLabel: MOCK_PRECINCT, entry };
  }

  async declare(d: VoterDetails): Promise<Checkin> {
    await this.wait(400);
    this.maybeFail("checkin");
    this.requireList();
    this.requireCheckinOpen();
    const held = await this.record();
    if (
      held &&
      (held.state === "at_desk" ||
        held.state === "approved" ||
        held.state === "signed")
    ) {
      throw new LiveError("refused", CHECKIN_IN_PROGRESS, {
        type: "checkin",
        code: "checkin-in-progress",
      });
    }
    const hit = this.match(d);
    if (await this.entryTaken(hit.seq)) {
      throw new LiveError("refused", ALREADY_CHECKED_IN, {
        type: "checkin",
        code: "already-checked-in",
      });
    }
    const r: MockCheckin = {
      electionId: this.info.id,
      seq: hit.seq,
      state: "at_desk",
      deskAt: Date.now(),
    };
    await this.setRecord(r);
    return this.view(r);
  }

  async signList(signature: ListSignature): Promise<Checkin> {
    await this.wait(400);
    this.requireList();
    this.requireCheckinOpen();
    const r = await this.record();
    if (!r || r.state !== "approved") {
      throw new LiveError("auth", CHECKIN_ENDED);
    }
    this.lastSignature = signature;
    r.state = "signed";
    await this.setRecord(r);
    return this.view(r);
  }

  /** The Electoral Board (manual desk): approve the phone at the desk. */
  async approve(): Promise<void> {
    await this.moveCheckin("at_desk", "approved");
  }

  /** The Electoral Board refuses the person at the desk. */
  async refuse(): Promise<void> {
    await this.moveCheckin("at_desk", "refused");
  }

  /** The presenter resets the entry (any state before the credential). */
  async resetCheckin(): Promise<void> {
    const r = await this.record();
    if (!r || r.state === "credential_issued") return;
    r.state = "reset";
    await this.setRecord(r);
  }

  private async moveCheckin(from: CheckinState, to: CheckinState) {
    const r = await this.record();
    if (!r || r.state !== from) return;
    r.state = to;
    await this.setRecord(r);
  }

  /**
   * Tests: this phone already checked in as list entry `seq` and signed the
   * list (or reached `state`), as if the screens had done it.
   */
  async checkedInAs(seq = 1, state: CheckinState = "signed"): Promise<void> {
    await this.setRecord({
      electionId: this.info.id,
      seq,
      state,
      deskAt: Date.now(),
    });
  }

  /** `opensAfterMs`: the officer "opens voting" once the time is up. */
  private tick() {
    if (this.opensAt !== null && Date.now() >= this.opensAt) {
      this.status = "open";
      this.opensAt = null;
    }
  }

  private requireOpen() {
    this.tick();
    if (this.status === "setup") {
      throw new LiveError("not-open", "Voting has not opened yet.");
    }
    if (this.status !== "open") {
      throw new LiveError("closed", "Voting has closed.");
    }
  }

  async software(): Promise<SoftwareInfo> {
    return { label: "mock, no cryptography", real: false };
  }

  async election(): Promise<ElectionInfo> {
    await this.wait(300);
    this.maybeFail("election");
    this.tick();
    const e: ElectionInfo = { ...this.info, status: this.status };
    if (this.voterList) e.precinctLabel = MOCK_PRECINCT;
    return e;
  }

  async hasCredential(): Promise<boolean> {
    const s = await this.session();
    // Per election, as the real client's issuer-key check makes it: a
    // credential from another run does not count.
    const c = await readStrict<{ electionId?: string }>(
      this.store,
      keys.credential(s.account),
    );
    return c?.electionId === this.info.id;
  }

  async enrol(onStep: (s: EnrolStep) => void): Promise<EnrolResult> {
    const s = await this.session();
    // As the console: issuance only to a check-in that signed the list.
    const r = await this.record();
    if (r?.state === "credential_issued") {
      throw new LiveError("refused", ALREADY_ISSUED, {
        type: "already-issued",
      });
    }
    if (r?.state !== "signed") throw new LiveError("auth", CHECKIN_ENDED);
    const total = ENROL_STEPS.length;
    for (let index = 0; index < total; index++) {
      const label = ENROL_STEPS[index]!;
      onStep({ index, total, label, state: "running" });
      await this.wait(600);
      if (index === 1) this.maybeFail("enrol");
      onStep({ index, total, label, state: "done" });
    }
    await this.store.set(keys.credential(s.account), {
      kind: "mock",
      electionId: this.info.id,
      storedAt: new Date().toISOString(),
    });
    r.state = "credential_issued";
    await this.setRecord(r);
    return { persistent: await this.store.persistent() };
  }

  async encrypt(choices: Choice[]): Promise<EncryptedBallot> {
    const s = await this.session();
    this.requireOpen();
    await this.wait(700);
    this.maybeFail("encrypt");
    // Per position, as the real client: never build a position already sent.
    const taken = await this.taken(s.account);
    for (const c of choices) {
      if (taken.has(c.positionId)) {
        throw new LiveError(
          "already-voted",
          `${this.info.positions.find((p) => p.id === c.positionId)?.title ?? c.positionId} is already sent from this phone, so it cannot be voted again.`,
        );
      }
    }
    const positions = this.info.positions.filter((p) => !taken.has(p.id));
    if (positions.length === 0) {
      throw new LiveError(
        "already-voted",
        "This voter's ballot is already recorded.",
      );
    }
    const ordered = positions.map((p) => {
      const c = choices.find((x) => x.positionId === p.id);
      if (!c || !p.candidates.some((k) => k.id === c.candidateId)) {
        throw new LiveError("refused", `No valid choice for ${p.title}.`);
      }
      return c;
    });
    const ballotId = `mock-ballot-${this.nextBallot++}`;
    const codes = ordered.map((c) => mockTrackingCode(s.account, c.positionId));
    const fingerprints = ordered.map(() => newFingerprint());
    let sealed = ordered;
    const tamper = this.tamper;
    this.tamper = false;
    if (tamper === true || tamper === "candidate") {
      const first = positions[0]!;
      const other = first.candidates.find(
        (k) => k.id !== ordered[0]!.candidateId,
      )!;
      sealed = [{ ...ordered[0]!, candidateId: other.id }, ...ordered.slice(1)];
    }
    this.ballots.set(ballotId, {
      account: s.account,
      choices: sealed,
      codes,
      fingerprints,
      challenged: false,
      tamper: tamper === "fingerprint" || tamper === "position" ? tamper : null,
    });
    return {
      ballotId,
      positions: ordered.map((c, i) => ({
        positionId: c.positionId,
        trackingCode: codes[i]!,
        fingerprint: fingerprints[i]!,
      })),
    };
  }

  private held(ballot: EncryptedBallot): HeldBallot {
    const h = this.ballots.get(ballot.ballotId);
    if (!h) throw new LiveError("refused", "This ballot is not on this phone.");
    return h;
  }

  async challenge(ballot: EncryptedBallot): Promise<ChallengeResult[]> {
    await this.wait(500);
    this.maybeFail("challenge");
    const h = this.held(ballot);
    h.challenged = true;
    const positions = this.info.positions;
    return h.choices.map((c, i) => ({
      positionId: c.positionId,
      checkedPositionId:
        h.tamper === "position" && i === 0
          ? positions.find((p) => p.id !== c.positionId)!.id
          : c.positionId,
      trackingCode: h.codes[i]!,
      candidateId: c.candidateId,
      fingerprint:
        h.tamper === "fingerprint" && i === 0
          ? newFingerprint()
          : h.fingerprints[i]!,
      matches: true,
    }));
  }

  private async storedReceipts(account: string): Promise<SubmitReceipt[]> {
    return (
      (await readStrict<SubmitReceipt[]>(
        this.store,
        keys.receipts(this.info.id, account),
      )) ?? []
    );
  }

  private async allPending(account: string): Promise<PendingSend[]> {
    return (
      (await readStrict<PendingSend[]>(
        this.store,
        keys.sending(this.info.id, account),
      )) ?? []
    );
  }

  /** As the real client: a marker with a receipt is stale and removed. */
  private async pendingSends(account: string): Promise<PendingSend[]> {
    const all = await this.allPending(account);
    const stored = await this.storedReceipts(account);
    const live = all.filter(
      (p) => !stored.some((r) => r.positionId === p.positionId),
    );
    if (live.length !== all.length) {
      await this.store.set(keys.sending(this.info.id, account), live);
    }
    return live;
  }

  private async setPending(
    account: string,
    positionId: string,
    entry: PendingSend | null,
  ) {
    const rest = (await this.allPending(account)).filter(
      (p) => p.positionId !== positionId,
    );
    await this.store.set(
      keys.sending(this.info.id, account),
      entry ? [...rest, entry] : rest,
    );
  }

  private async taken(account: string): Promise<Set<string>> {
    const stored = await this.storedReceipts(account);
    if (stored.some((r) => r.alarm)) {
      throw new LiveError(
        "already-voted",
        "A ballot this phone sent was not recorded as shown, so this phone sends nothing more.",
      );
    }
    const pending = await this.pendingSends(account);
    return new Set([...stored, ...pending].map((r) => r.positionId));
  }

  async unconfirmed(): Promise<UnconfirmedPosition[]> {
    const s = await this.session();
    return (await this.pendingSends(s.account)).map(
      ({ positionId, trackingCode, fingerprint, takenUnconfirmed }) =>
        takenUnconfirmed
          ? { positionId, trackingCode, fingerprint, takenUnconfirmed }
          : { positionId, trackingCode, fingerprint },
    );
  }

  async resendUnconfirmed(): Promise<EncryptedBallot | null> {
    const s = await this.session();
    const pending = await this.pendingSends(s.account);
    if (pending.length === 0) return null;
    const ballotId = `mock-ballot-${this.nextBallot++}`;
    this.ballots.set(ballotId, {
      account: s.account,
      // The mock's "bytes": the choice is not needed to send again.
      choices: pending.map((p) => ({
        positionId: p.positionId,
        candidateId: "",
      })),
      codes: pending.map((p) => p.trackingCode),
      fingerprints: pending.map((p) => p.fingerprint),
      challenged: false,
      tamper: null,
    });
    return {
      ballotId,
      positions: pending.map(({ positionId, trackingCode, fingerprint }) => ({
        positionId,
        trackingCode,
        fingerprint,
      })),
    };
  }

  async submit(
    ballot: EncryptedBallot,
    onPosition: (r: SubmitReceipt) => void,
  ): Promise<SubmitReceipt[]> {
    const s = await this.session();
    this.requireOpen();
    const stored = await this.storedReceipts(s.account);
    const h = this.ballots.get(ballot.ballotId);
    if (!h || h.account !== s.account) {
      throw new LiveError("refused", "This ballot is not on this phone.");
    }
    const pendingBefore = await this.pendingSends(s.account);
    // Per position, as the real client: a position recorded from another
    // ballot, or sent from another ballot without an answer, is never sent
    // again. Tracking codes are the same for every ballot of this voter, so
    // the fingerprints decide.
    if (
      stored.some((r) => r.alarm) ||
      h.choices.some((c, i) => {
        const fp = h.fingerprints[i];
        const r = stored.find((x) => x.positionId === c.positionId);
        if (r !== undefined && r.fingerprint !== fp) return true;
        return pendingBefore.some(
          (x) => x.positionId === c.positionId && x.fingerprint !== fp,
        );
      })
    ) {
      this.ballots.delete(ballot.ballotId);
      throw new LiveError(
        "already-voted",
        "This voter's ballot is already recorded.",
      );
    }
    if (h.challenged) {
      throw new LiveError(
        "refused",
        "This ballot was opened for a check, so it can no longer be counted. Encrypt again to vote.",
      );
    }
    const out: SubmitReceipt[] = [...stored];
    for (let i = 0; i < h.choices.length; i++) {
      const positionId = h.choices[i]!.positionId;
      const done = stored.find((r) => r.positionId === positionId);
      if (done) {
        onPosition(done);
        continue;
      }
      const earlier = pendingBefore.find(
        (x) =>
          x.positionId === positionId && x.fingerprint === h.fingerprints[i],
      );
      const resend = earlier !== undefined;
      const marker: PendingSend = {
        positionId,
        trackingCode: h.codes[i]!,
        fingerprint: h.fingerprints[i]!,
        // The mock has no bytes; the fingerprint stands for them.
        ballot: h.fingerprints[i]!,
      };
      if (earlier?.takenUnconfirmed) marker.takenUnconfirmed = true;
      await this.setPending(s.account, positionId, marker);
      await this.wait(2000);
      try {
        this.maybeFail("submit");
      } catch (e) {
        const kind = (e as LiveError).kind;
        if (kind === "already-voted" && resend) {
          await this.setPending(s.account, positionId, {
            ...marker,
            takenUnconfirmed: true,
          });
        } else if (!resend && kind !== "network" && kind !== "already-voted") {
          await this.setPending(s.account, positionId, null);
        }
        if (kind !== "network") this.ballots.delete(ballot.ballotId);
        throw e;
      }
      const r: SubmitReceipt = {
        positionId,
        trackingCode: h.codes[i]!,
        fingerprint: h.fingerprints[i]!,
        txId: pick(HEX, 64),
        block: ++this.block,
      };
      this.board.set(r.trackingCode, {
        positionId: r.positionId,
        txId: r.txId,
      });
      out.push(r);
      // Save as we go: a failure on position 2 must not forget position 1.
      await this.store.set(keys.receipts(this.info.id, s.account), [...out]);
      await this.setPending(s.account, positionId, null);
      onPosition(r);
    }
    this.ballots.delete(ballot.ballotId);
    return out;
  }

  /** Local only: the flag never goes to the transport. */
  async recordFailedCheck(electionId: string): Promise<void> {
    await recordFailedCheck(this.store, electionId);
  }

  async failedCheckRecorded(electionId: string): Promise<boolean> {
    return failedCheckRecorded(this.store, electionId);
  }

  async receipts(): Promise<SubmitReceipt[] | null> {
    const s = await this.session();
    const stored = await this.storedReceipts(s.account);
    await this.pendingSends(s.account);
    return stored.length > 0 ? stored : null;
  }

  async lookup(trackingCode: string): Promise<LookupResult> {
    await this.wait(400);
    this.maybeFail("lookup");
    const hit = this.board.get(trackingCode);
    if (!hit) return { trackingCode, recorded: false, counted: false };
    return {
      trackingCode,
      recorded: true,
      counted: this.status === "tallied",
      positionTitle: this.info.positions.find((p) => p.id === hit.positionId)
        ?.title,
    };
  }
}

const OPS: MockOp[] = [
  "checkin",
  "election",
  "enrol",
  "encrypt",
  "challenge",
  "submit",
  "lookup",
];
const STATUSES: ElectionStatus[] = ["setup", "open", "closed", "tallied"];

/**
 * `?mock=1&status=closed&fail=submit,lookup&speed=0.5&tamper=1&opens=8`, for
 * demos and screenshots of every state without a server (`opens=N`: voting
 * opens by itself N seconds after the page loads).
 */
export function mockOptionsFromQuery(search: string): MockOptions {
  const q = new URLSearchParams(search);
  const opts: MockOptions = {};
  const status = q.get("status");
  if (status && (STATUSES as string[]).includes(status)) {
    opts.status = status as ElectionStatus;
  }
  const fail = (q.get("fail") ?? "")
    .split(",")
    .filter((f): f is MockOp => (OPS as string[]).includes(f));
  if (fail.length) opts.failOnce = fail;
  const speed = Number(q.get("speed"));
  if (q.has("speed") && Number.isFinite(speed) && speed >= 0) {
    opts.speed = speed;
  }
  const opens = Number(q.get("opens"));
  if (q.has("opens") && Number.isFinite(opens) && opens >= 0) {
    opts.opensAfterMs = opens * 1000;
  }
  if (q.get("names") === "long") opts.positions = longNamePositions();
  const tamper = q.get("tamper");
  if (tamper === "1") opts.tamper = true;
  else if (tamper === "fingerprint" || tamper === "position") {
    opts.tamper = tamper;
  }
  return opts;
}
