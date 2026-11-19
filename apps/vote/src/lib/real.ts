import { idToName } from "@balotachain/ui";
import {
  ENROL_STEPS,
  isLiveError,
  LiveError,
  readStrict,
  type ChallengeResult,
  type Checkin,
  type Choice,
  type ElectionInfo,
  type ElectionStatus,
  type EncryptedBallot,
  type EncryptedPosition,
  type UnconfirmedPosition,
  type EnrolResult,
  type EnrolStep,
  type FoundVoter,
  type ListSignature,
  type LiveClient,
  type LookupResult,
  type Position,
  type SoftwareInfo,
  type SubmitReceipt,
  type VoterDetails,
} from "./live";
import {
  failedCheckRecorded,
  indexedDbStore,
  keys,
  recordFailedCheck,
  type KeyValueStore,
  type PendingSend,
} from "./storage";
import { HttpTransport } from "./http";
import type { LiveTransport, TransportElection } from "./transport";
import {
  CryptoError,
  loadVoterCrypto,
  type CryptoElection,
  type Credential,
  type SealedBallot,
  type VoterCrypto,
} from "./voterCrypto";

/**
 * The live client. Its crypto half is the saksi WebAssembly module
 * (`voterCrypto.ts`), its transport half a `LiveTransport` to the console
 * (`HttpTransport` by default: the console's HTTP API).
 *
 * What it keeps (saksi docs/live/wire-format.md, "What the phone keeps"):
 * - storage: the credential (`credential:checkin`) and the receipts and
 *   "sent, no answer" markers, per election. Nothing else: no name, no date
 *   of birth, no check-in (the console's cookie holds that).
 * - memory only: the issuance (inside `voterCrypto`, dropped after each
 *   step) and each encrypted ballot until it is cast or challenged. A
 *   challenged ballot is checked and dropped inside `voterCrypto`; it is never
 *   handed to the transport, stored, or logged.
 */

/** How the credential is stored. Only `credential` is secret. */
export interface StoredCredential {
  kind: "saksi-live-credential-v1";
  electionId: string;
  credential: Credential;
}

export function storedCredential(
  electionId: string,
  credential: Credential,
): StoredCredential {
  return { kind: "saksi-live-credential-v1", electionId, credential };
}

interface Material {
  /**
   * The election these keys belong to: from the parameters once the
   * transcript is in, else the console's own `election_id`. Receipts and
   * "sent, no answer" markers are stored under it.
   */
  electionId: string;
  title: string;
  status: ElectionStatus;
  params: string;
  dkg: string | null;
  issuerPublicKey: string;
  runId: string | undefined;
  precinctLabel: string | undefined;
  /** Null until the DKG transcript is published. */
  info: CryptoElection | null;
  labels: TransportElection["labels"];
}

/** Whose records a read or write touches: this phone in one election. */
interface Scope {
  /** Always `PHONE_SCOPE`: the precinct check-in has no accounts. */
  account: string;
  electionId: string;
}

interface HeldBallot {
  /** Always `PHONE_SCOPE` (see `Scope`). */
  account: string;
  /** The election it was built for; its receipts and markers go there. */
  electionId: string;
  params: string;
  dkg: string;
  /** Empty for a resend handle, which holds only the cast bytes. */
  sealed: SealedBallot[];
  /** The public values of each position, in send order. */
  positions: EncryptedPosition[];
  /** The cast bytes, once sending started (the openings are dropped then). */
  hexes: string[] | null;
  /** Set once sending started: the ballot can no longer be challenged. */
  casting: boolean;
}

export interface RealClientOptions {
  transport?: LiveTransport;
  store?: KeyValueStore;
  /** Loads the WebAssembly; tests pass one that reads the bytes from disk. */
  crypto?: () => Promise<VoterCrypto>;
}

function asLiveError(e: unknown): LiveError {
  if (isLiveError(e)) return e;
  return new LiveError("network", e instanceof Error ? e.message : String(e));
}

/** The one scope a phone's records are kept under (see `session`). */
export const PHONE_SCOPE = "checkin";

function newBallotId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return `ballot-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export class RealLiveClient implements LiveClient {
  private readonly transport: LiveTransport;
  private readonly store: KeyValueStore;
  private readonly loadCrypto: () => Promise<VoterCrypto>;
  private material: Material | null = null;
  private readonly ballots = new Map<string, HeldBallot>();

  constructor(opts: RealClientOptions = {}) {
    this.transport = opts.transport ?? new HttpTransport();
    this.store = opts.store ?? indexedDbStore("balotachain-vote");
    this.loadCrypto = opts.crypto ?? (() => loadVoterCrypto());
  }

  private async crypto(): Promise<VoterCrypto> {
    try {
      return await this.loadCrypto();
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      throw new LiveError(
        "unsupported",
        `This browser could not load the voting software (WebAssembly): ${why}. Use an up-to-date Chrome or Safari, then retry.`,
      );
    }
  }

  /** Every transport call: its errors are LiveErrors already, or network ones. */
  private async net<T>(f: () => Promise<T>): Promise<T> {
    try {
      return await f();
    } catch (e) {
      throw asLiveError(e);
    }
  }

  /**
   * Whose records a call reads and writes. With the precinct check-in there
   * is no account: a phone holds one voter's records per election (the
   * check-in screens never open on a phone that holds this election's
   * credential or receipts), so every record is under `PHONE_SCOPE`.
   */
  private async session(): Promise<string> {
    return PHONE_SCOPE;
  }

  private async loadMaterial(): Promise<Material> {
    const e = await this.net(() => this.transport.election());
    const c = await this.crypto();
    let info: CryptoElection | null = null;
    if (e.dkg !== null) {
      try {
        info = c.electionInfo(e.params, e.dkg);
      } catch (err) {
        if (!(err instanceof CryptoError)) throw err;
        throw new LiveError(
          "refused",
          `The election's published keys do not check out on this phone: ${err.message}.`,
        );
      }
      // The issuer key for enrolment must be the one bound in the
      // parameters; say so now rather than at the end of an enrolment.
      if (e.issuerPublicKey !== info.issuerPublicKey) {
        throw new LiveError(
          "refused",
          "The election server gave an issuer key that is not the one in the election's parameters.",
        );
      }
      if (e.electionId !== undefined && e.electionId !== info.electionId) {
        throw new LiveError(
          "refused",
          "The election server names another election than the one in the election's parameters.",
        );
      }
      if (
        e.jointKeyFingerprint !== undefined &&
        e.jointKeyFingerprint !== info.jointKeyFingerprint
      ) {
        throw new LiveError(
          "refused",
          "The election server shows another election key fingerprint than the one in the published key ceremony.",
        );
      }
    }
    this.material = {
      electionId: info?.electionId ?? e.electionId ?? "",
      title: e.title,
      status: e.status,
      params: e.params,
      dkg: e.dkg,
      issuerPublicKey: e.issuerPublicKey,
      runId: e.runId,
      precinctLabel: e.precinctLabel,
      info,
      labels: e.labels,
    };
    return this.material;
  }

  private positionsOf(m: Material): Position[] {
    if (!m.info) return [];
    const labels = m.labels ?? {};
    return m.info.positions.map((p) => ({
      id: p.id,
      // D19: no label from the console means the id, hyphens as spaces.
      // Display only; the id stays what is encrypted and sent.
      title: labels.positions?.[p.id] ?? idToName(p.id),
      candidates: p.candidates.map((c) => {
        const l = labels.candidates?.[`${p.id}/${c}`];
        return l?.detail !== undefined
          ? { id: c, name: l.name, detail: l.detail }
          : { id: c, name: l?.name ?? idToName(c) };
      }),
    }));
  }

  private async credential(account: string): Promise<Credential | null> {
    // Strict (N2): a failed read must not look like "no credential".
    const s = await readStrict<StoredCredential>(
      this.store,
      keys.credential(account),
    );
    return s && s.kind === "saksi-live-credential-v1" ? s.credential : null;
  }

  /**
   * The stored credential when it is this election's: issued under its
   * issuer key and stored for its election id (m1, rehearsal 2). A
   * credential of an earlier election on the same console is never taken
   * for the current one's, even if an issuer key were ever reused.
   */
  private async usableCredential(
    account: string,
    m: Material,
    c: VoterCrypto,
  ): Promise<Credential | null> {
    const s = await readStrict<StoredCredential>(
      this.store,
      keys.credential(account),
    );
    if (!s || s.kind !== "saksi-live-credential-v1") return null;
    try {
      const check = c.checkCredential(m.params, s.credential);
      return s.electionId === check.electionId ? s.credential : null;
    } catch (e) {
      if (e instanceof CryptoError) return null;
      throw e;
    }
  }

  async software(): Promise<SoftwareInfo> {
    const c = await this.crypto();
    return { label: c.build.label, real: true };
  }

  async checkin(): Promise<Checkin | null> {
    return this.net(() => this.transport.checkin());
  }

  async findVoter(details: VoterDetails): Promise<FoundVoter> {
    return this.net(() => this.transport.findVoter(details));
  }

  async declare(details: VoterDetails): Promise<Checkin> {
    return this.net(() => this.transport.declare(details));
  }

  async signList(signature: ListSignature): Promise<Checkin> {
    return this.net(() => this.transport.signList(signature));
  }

  async election(): Promise<ElectionInfo> {
    const m = await this.loadMaterial();
    const out: ElectionInfo = {
      id: m.info?.electionId ?? "",
      title: m.title,
      status: m.status,
      positions: this.positionsOf(m),
    };
    if (m.info) out.keyFingerprint = m.info.jointKeyFingerprint;
    if (m.runId) out.runId = m.runId;
    if (m.precinctLabel) out.precinctLabel = m.precinctLabel;
    return out;
  }

  async hasCredential(): Promise<boolean> {
    const account = await this.session();
    if (!(await this.credential(account))) return false;
    const m = this.material ?? (await this.loadMaterial());
    // Not this election's: enrol again for this election.
    return (
      (await this.usableCredential(account, m, await this.crypto())) !== null
    );
  }

  async enrol(onStep: (s: EnrolStep) => void): Promise<EnrolResult> {
    const account = await this.session();
    const m = this.material ?? (await this.loadMaterial());
    const c = await this.crypto();
    // One issuance at a time on this phone (presign and sign as a pair).
    const run = () => this.issue(account, m, c, onStep);
    return this.transport.exclusiveIssuance
      ? this.transport.exclusiveIssuance(run)
      : run();
  }

  private async issue(
    account: string,
    m: Material,
    c: VoterCrypto,
    onStep: (s: EnrolStep) => void,
  ): Promise<EnrolResult> {
    // Another tab may have finished an issuance while this one waited.
    if (await this.usableCredential(account, m, c)) {
      return { persistent: await this.store.persistent() };
    }
    const total = ENROL_STEPS.length;
    const step = async <T>(index: number, run: () => Promise<T> | T) => {
      const label = ENROL_STEPS[index]!;
      onStep({ index, total, label, state: "running" });
      const out = await run();
      onStep({ index, total, label, state: "done" });
      return out;
    };
    const issuance = c.beginIssuance();
    try {
      const { r } = await step(0, () =>
        this.net(() => this.transport.issuePresign(issuance.blindedCommitment)),
      );
      const ePrime = await step(1, () => issuance.blind(r, m.issuerPublicKey));
      const { sIss } = await step(2, () =>
        this.net(() => this.transport.issueSign(ePrime)),
      );
      const { credential, electionId } = await step(3, () => {
        const cred = issuance.finalize(sIss, m.issuerPublicKey);
        // The election id comes from the parameters, which exist before
        // the trustees' key does.
        const check = c.checkCredential(m.params, cred);
        return { credential: cred, electionId: check.electionId };
      });
      await step(4, () =>
        this.store.set(
          keys.credential(account),
          storedCredential(electionId, credential),
        ),
      );
    } catch (e) {
      if (e instanceof CryptoError) {
        throw new LiveError(
          "refused",
          `The election authority's signature did not check out on this phone, so no credential was stored: ${e.message}.`,
        );
      }
      throw e;
    } finally {
      issuance.discard();
    }
    return { persistent: await this.store.persistent() };
  }

  async encrypt(choices: Choice[]): Promise<EncryptedBallot> {
    const account = await this.session();
    const m = await this.loadMaterial();
    if (m.status === "setup" || !m.info || m.dkg === null) {
      throw new LiveError("not-open", "Voting has not opened yet.");
    }
    if (m.status !== "open")
      throw new LiveError("closed", "Voting has closed.");
    if (!(await this.credential(account))) {
      throw new LiveError(
        "refused",
        "There is no voting credential on this phone. Reload this page to get one.",
      );
    }
    // A credential from another election (another issuer key or election
    // id) is never used to build a ballot: the console would refuse it,
    // after the bytes went out.
    const credential = await this.usableCredential(
      account,
      m,
      await this.crypto(),
    );
    if (!credential) {
      throw new LiveError(
        "refused",
        "The voting credential on this phone is not for this election, so this phone cannot build a ballot with it.",
        { type: "stale-credential" },
      );
    }
    const titles = this.positionsOf(m);
    // D11, per position: build only what is neither recorded nor sent
    // without an answer; never build a position that is.
    const taken = await this.taken({ account, electionId: m.electionId });
    const titleOf = (id: string) =>
      titles.find((t) => t.id === id)?.title ?? idToName(id);
    for (const pick of choices) {
      if (taken.has(pick.positionId)) {
        throw new LiveError(
          "already-voted",
          `${titleOf(pick.positionId)} is already sent from this phone, so it cannot be voted again.`,
        );
      }
    }
    const open = m.info.positions.filter((p) => !taken.has(p.id));
    if (open.length === 0) {
      throw new LiveError(
        "already-voted",
        "This voter's ballot is already recorded.",
      );
    }
    const c = await this.crypto();
    const sealed: SealedBallot[] = [];
    try {
      for (const p of open) {
        const pick = choices.find((x) => x.positionId === p.id);
        const choice = pick ? p.candidates.indexOf(pick.candidateId) : -1;
        if (choice < 0) {
          throw new LiveError(
            "refused",
            `No valid choice for ${titleOf(p.id)}.`,
          );
        }
        sealed.push(
          c.buildBallot({
            params: m.params,
            dkg: m.dkg,
            credential,
            positionId: p.id,
            choice,
          }),
        );
      }
    } catch (e) {
      sealed.forEach((b) => b.discard());
      if (e instanceof CryptoError) {
        throw new LiveError(
          "refused",
          `This phone could not encrypt the ballot: ${e.message}.`,
        );
      }
      throw e;
    }
    // A new ballot supersedes any earlier one the voter walked away from
    // (Back to review): drop its opening now rather than when the page closes.
    for (const [id, old] of this.ballots) {
      if (!old.casting) {
        old.sealed.forEach((b) => b.discard());
        this.ballots.delete(id);
      }
    }
    const ballotId = newBallotId();
    const positions = sealed.map((b) => ({
      positionId: b.positionId,
      trackingCode: b.trackingCode,
      fingerprint: b.fingerprint,
    }));
    this.ballots.set(ballotId, {
      account,
      electionId: m.electionId,
      params: m.params,
      dkg: m.dkg,
      sealed,
      positions,
      hexes: null,
      casting: false,
    });
    return { ballotId, positions };
  }

  /** This phone in the election this client last read. */
  private async scope(): Promise<Scope> {
    const account = await this.session();
    const m = this.material ?? (await this.loadMaterial());
    return { account, electionId: m.electionId };
  }

  /**
   * The positions this phone may not build again in this election:
   * recorded (a receipt) or unconfirmed (a marker). See `standing` in
   * Submitted.tsx for the rule.
   */
  private async taken(scope: Scope): Promise<Set<string>> {
    const stored = await this.storedReceipts(scope);
    if (stored.some((r) => r.alarm)) {
      throw new LiveError(
        "already-voted",
        "A ballot this phone sent was not recorded as shown, so this phone sends nothing more.",
      );
    }
    const pending = await this.pendingSends(scope);
    return new Set([...stored, ...pending].map((r) => r.positionId));
  }

  private async storedReceipts(scope: Scope): Promise<SubmitReceipt[]> {
    return (
      // Strict (N2): a failed read must not look like "nothing recorded".
      (await readStrict<SubmitReceipt[]>(
        this.store,
        keys.receipts(scope.electionId, scope.account),
      )) ?? []
    );
  }

  private async allPending(scope: Scope): Promise<PendingSend[]> {
    return (
      // Strict (N2): a failed read must not look like "nothing sent", and
      // `setPending` writes only after this read succeeded.
      (await readStrict<PendingSend[]>(
        this.store,
        keys.sending(scope.electionId, scope.account),
      )) ?? []
    );
  }

  /**
   * Sent without a known outcome, and not since recorded. A marker whose
   * position has a receipt is stale (the receipt was written, then the
   * page stopped before the marker went): it is removed here (m4).
   */
  private async pendingSends(scope: Scope): Promise<PendingSend[]> {
    const all = await this.allPending(scope);
    const stored = await this.storedReceipts(scope);
    const live = all.filter(
      (p) => !stored.some((r) => r.positionId === p.positionId),
    );
    if (live.length !== all.length) {
      await this.store.set(keys.sending(scope.electionId, scope.account), live);
    }
    return live;
  }

  private async setPending(
    scope: Scope,
    positionId: string,
    entry: PendingSend | null,
  ): Promise<void> {
    const rest = (await this.allPending(scope)).filter(
      (p) => p.positionId !== positionId,
    );
    await this.store.set(
      keys.sending(scope.electionId, scope.account),
      entry ? [...rest, entry] : rest,
    );
  }

  async unconfirmed(): Promise<UnconfirmedPosition[]> {
    return (await this.pendingSends(await this.scope())).map(
      ({ positionId, trackingCode, fingerprint, takenUnconfirmed }) =>
        takenUnconfirmed
          ? { positionId, trackingCode, fingerprint, takenUnconfirmed }
          : { positionId, trackingCode, fingerprint },
    );
  }

  async resendUnconfirmed(): Promise<EncryptedBallot | null> {
    const scope = await this.scope();
    const pending = await this.pendingSends(scope);
    if (pending.length === 0) return null;
    const ballotId = newBallotId();
    const positions = pending.map(
      ({ positionId, trackingCode, fingerprint }) => ({
        positionId,
        trackingCode,
        fingerprint,
      }),
    );
    // Only the cast bytes: there is nothing left to open or challenge.
    this.ballots.set(ballotId, {
      account: scope.account,
      electionId: scope.electionId,
      params: "",
      dkg: "",
      sealed: [],
      positions,
      hexes: pending.map((p) => p.ballot),
      casting: true,
    });
    return { ballotId, positions };
  }

  async challenge(ballot: EncryptedBallot): Promise<ChallengeResult[]> {
    const h = this.ballots.get(ballot.ballotId);
    if (!h) {
      throw new LiveError("refused", "This ballot is not on this phone.");
    }
    if (h.casting) {
      throw new LiveError(
        "refused",
        "This ballot is being sent, so it can no longer be challenged.",
      );
    }
    // Whatever the check finds, this ballot is spent.
    this.ballots.delete(ballot.ballotId);
    try {
      return this.checkAll(h);
    } finally {
      // Every position is dropped, even if one check threw.
      h.sealed.forEach((b) => b.discard());
    }
  }

  private checkAll(h: HeldBallot): ChallengeResult[] {
    return h.sealed.map((b): ChallengeResult => {
      try {
        const check = b.challenge(h.params, h.dkg);
        return {
          positionId: b.positionId,
          checkedPositionId: check.positionId,
          trackingCode: check.trackingCode,
          candidateId: check.candidate,
          fingerprint: check.fingerprint,
          matches: check.valid,
        };
      } catch (e) {
        if (!(e instanceof CryptoError)) throw e;
        // The check refused to open it at all: report a ballot that does
        // not rebuild, never what the voter asked for.
        b.discard();
        return {
          positionId: b.positionId,
          checkedPositionId: "",
          trackingCode: b.trackingCode,
          candidateId: null,
          fingerprint: "",
          matches: false,
        };
      }
    });
  }

  async submit(
    ballot: EncryptedBallot,
    onPosition: (r: SubmitReceipt) => void,
  ): Promise<SubmitReceipt[]> {
    const account = await this.session();
    const h = this.ballots.get(ballot.ballotId);
    if (!h || h.account !== account) {
      throw new LiveError(
        "refused",
        "This ballot is not on this phone. Encrypt again to vote.",
      );
    }
    // Reads and writes go to the election this ballot was built for.
    const scope: Scope = { account, electionId: h.electionId };
    const stored = await this.storedReceipts(scope);
    // Nothing more after an alarm, from any ballot.
    if (stored.some((r) => r.alarm)) {
      if (!h.casting) this.dropBallot(ballot.ballotId, h);
      throw new LiveError(
        "already-voted",
        "This voter's ballot is already recorded.",
      );
    }
    // Also prunes markers that have a receipt (m4).
    const pendingBefore = await this.pendingSends(scope);
    // The already-voted rule, per position: a position recorded from
    // another ballot, or sent from another ballot without an answer (a
    // marker with another fingerprint: another tab, I2), is never sent
    // again. Checked for the whole ballot before anything goes out.
    const recordedFrom = (p: EncryptedPosition) =>
      stored.find((r) => r.positionId === p.positionId);
    if (
      h.positions.some((p) => {
        const r = recordedFrom(p);
        if (r !== undefined && r.fingerprint !== p.fingerprint) return true;
        return pendingBefore.some(
          (x) =>
            x.positionId === p.positionId && x.fingerprint !== p.fingerprint,
        );
      })
    ) {
      this.dropBallot(ballot.ballotId, h);
      throw new LiveError(
        "already-voted",
        "This voter's ballot is already recorded.",
      );
    }
    h.casting = true;
    // The ballot is committed to being cast: drop every position's opening
    // now, not one by one as each is sent.
    if (!h.hexes) h.hexes = h.sealed.map((b) => b.cast());
    const hexes = h.hexes;
    const drop = () => this.dropBallot(ballot.ballotId, h);
    const out: SubmitReceipt[] = [...stored];
    for (let i = 0; i < h.positions.length; i++) {
      const p = h.positions[i]!;
      const hex = hexes[i]!;
      // Recorded from this very ballot (a resumed send): not sent again.
      const done = recordedFrom(p);
      if (done) {
        onPosition(done);
        await this.setPending(scope, p.positionId, null);
        continue;
      }
      const earlier = pendingBefore.find(
        (x) => x.positionId === p.positionId && x.ballot === hex,
      );
      // These exact bytes went out before without a known outcome.
      const resend = earlier !== undefined;
      // Before the request: if the answer never comes, a reload still knows
      // this position went out (D11, "unconfirmed").
      const marker: PendingSend = {
        positionId: p.positionId,
        trackingCode: p.trackingCode,
        fingerprint: p.fingerprint,
        ballot: hex,
      };
      if (earlier?.takenUnconfirmed) marker.takenUnconfirmed = true;
      await this.setPending(scope, p.positionId, marker);
      let sent: { txId: string; block: number };
      try {
        sent = await this.net(() =>
          this.transport.submitBallot(
            p.positionId,
            hex,
            { trackingCode: p.trackingCode, fingerprint: p.fingerprint },
            { resend },
          ),
        );
      } catch (e) {
        // The console's answer did not match what the phone showed: keep it
        // as an alarm on this position's receipt, and send nothing more.
        if (isLiveError(e) && e.detail?.type === "record-mismatch") {
          const { recorded } = e.detail;
          out.push({
            positionId: p.positionId,
            trackingCode: p.trackingCode,
            fingerprint: p.fingerprint,
            txId: recorded.txId,
            block: recorded.block,
            alarm: {
              recordedTrackingCode: recorded.recordedTrackingCode,
              recordedFingerprint: recorded.recordedFingerprint,
              recordedBytesMatch: recorded.recordedBytesMatch,
            },
          });
          try {
            await this.store.set(keys.receipts(scope.electionId, account), [
              ...out,
            ]);
            await this.setPending(scope, p.positionId, null);
          } finally {
            drop();
          }
          throw e;
        }
        const kind = isLiveError(e) ? e.kind : "network";
        if (kind === "already-voted" && resend) {
          // m5: the resend was answered "taken" and the board did not show
          // this ballot. Still unconfirmed; the screen says so plainly.
          await this.setPending(scope, p.positionId, {
            ...marker,
            takenUnconfirmed: true,
          });
        } else if (!resend && kind !== "network" && kind !== "already-voted") {
          // Refused outright on the first send of these bytes: known not
          // recorded, so the marker goes. After a resend (I1) a refusal says
          // nothing about the earlier send, which may be on the ledger: the
          // marker stays.
          await this.setPending(scope, p.positionId, null);
        }
        // A network failure may be retried with the same ballot; anything
        // else (refused, closed, already voted) ends it.
        if (kind !== "network") drop();
        throw e;
      }
      const { txId, block } = sent;
      const r: SubmitReceipt = {
        positionId: p.positionId,
        trackingCode: p.trackingCode,
        fingerprint: p.fingerprint,
        txId,
        block,
      };
      out.push(r);
      // Save as we go: a failure on position 2 must not forget position 1.
      await this.store.set(keys.receipts(scope.electionId, account), [...out]);
      await this.setPending(scope, p.positionId, null);
      onPosition(r);
    }
    drop();
    return out;
  }

  private dropBallot(id: string, h: HeldBallot) {
    this.ballots.delete(id);
    h.sealed.forEach((b) => b.discard());
  }

  /** Local only: the flag never goes to the transport. */
  async recordFailedCheck(electionId: string): Promise<void> {
    await recordFailedCheck(this.store, electionId);
  }

  async failedCheckRecorded(electionId: string): Promise<boolean> {
    return failedCheckRecorded(this.store, electionId);
  }

  /** This phone's receipts in the election this client last read. */
  async receipts(): Promise<SubmitReceipt[] | null> {
    const scope = await this.scope();
    const stored = await this.storedReceipts(scope);
    // Prunes markers that have a receipt (m4).
    await this.pendingSends(scope);
    return stored.length > 0 ? stored : null;
  }

  async lookup(trackingCode: string): Promise<LookupResult> {
    return this.net(() => this.transport.lookup(trackingCode));
  }
}
