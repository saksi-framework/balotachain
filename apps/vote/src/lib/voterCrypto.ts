/**
 * The voter's cryptography: the saksi WebAssembly module (`@saksi/wasm`,
 * vendored in packages/saksi-wasm), loaded once and wrapped in typed calls.
 *
 * Custody rules (saksi docs/live/wire-format.md, "What the phone keeps, and
 * what it drops"):
 * - The issuance states live only inside an `Issuance`, in private fields,
 *   and are dropped as soon as the next step has used them.
 * - The credential is the one secret that leaves this module, so the client
 *   can store it (the storage module). It is never sent anywhere.
 * - A ballot's opening lives only inside its `SealedBallot`. `cast()` drops
 *   the opening and hands out the ballot for sending. `challenge()` opens and
 *   checks the ballot here, then drops the ballot, the opening and the opened
 *   values, and returns only the check's verdict. No function returns a
 *   challenged ballot or an opening, so no caller can send, store or log one.
 * - Nothing here logs an input or an output of the wasm exports.
 */
import init, * as wasm from "@saksi/wasm";
import type {
  BallotOpening,
  BlindState,
  Credential,
  FinalizeState,
} from "@saksi/wasm";
import wasmUrl from "@saksi/wasm/saksi_wasm_bg.wasm?url";

export type { Credential } from "@saksi/wasm";

/** What `init` accepts: a URL to fetch, or the module's bytes. */
export type WasmSource = string | URL | BufferSource | WebAssembly.Module;

/** A wasm export refused its input. `message` is saksi's own text. */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

/** The browser could not load the WebAssembly module at all. */
export class CryptoLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoLoadError";
  }
}

/**
 * Timing only, for the demo's performance notes: a `performance.measure`
 * named `saksi-wasm <step>`. It records how long a step took, nothing else.
 */
function measure(step: string, start: number | undefined) {
  if (start === undefined) return;
  try {
    globalThis.performance.measure(`saksi-wasm ${step}`, { start });
  } catch {
    // no User Timing in this environment
  }
}

function timed<T>(step: string, f: () => T): T {
  const start = globalThis.performance?.now();
  try {
    return f();
  } finally {
    measure(step, start);
  }
}

/** Run one export; turn its thrown `{"error": ...}` into a CryptoError. */
function call<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    throw new CryptoError(wasm.errorOf(e));
  }
}

export interface CryptoBuild {
  name: string;
  version: string;
  wireFormat: string;
  protocolWireVersion: number;
  gitRev: string | null;
  /** One line for people: "saksi-wasm 0.1.0 · 6d2555f · saksi-live-wire-v1". */
  label: string;
}

export interface CredentialCheck {
  electionId: string;
  issuerPublicKey: string;
  commitment: string;
}

export interface CryptoElection {
  electionId: string;
  /** Positions and candidate ids from the contest ids, in ballot order. */
  positions: { id: string; candidates: string[] }[];
  trustees: number;
  threshold: number;
  issuerPublicKey: string;
  jointPublicKey: string;
  /** The value every trustee page shows for the election key. */
  jointKeyFingerprint: string;
}

/** What the Benaloh check found in a challenged ballot. No secrets. */
export interface ChallengeCheck {
  /** Every slot reproduces and exactly one holds 1. */
  valid: boolean;
  /** The position of the ballot that was checked. */
  positionId: string;
  trackingCode: string;
  /** The fingerprint of the ballot that was checked. */
  fingerprint: string;
  /** The candidate id the ballot encodes, or null when it is not valid. */
  candidate: string | null;
  slots: { contestId: string; plaintext: number; reproduces: boolean }[];
}

/**
 * One blind issuance on this phone. Its secret state never leaves the
 * object, and each step drops the state the previous one left.
 */
export class Issuance {
  #begin: BlindState | null;
  #blind: FinalizeState | null = null;
  /** Send to the issuer (`issue-presign`). */
  readonly blindedCommitment: string;

  /** @internal Use `VoterCrypto.beginIssuance`. */
  constructor(blindedCommitment: string, state: BlindState) {
    this.blindedCommitment = blindedCommitment;
    this.#begin = state;
  }

  /** Blind the issuer's `r`; returns `e_prime`, for the issuer's `issue-sign`. */
  blind(r: string, issuerPublicKey: string): string {
    const state = this.#begin;
    if (!state) throw new CryptoError("this issuance is past its blind step");
    this.#begin = null;
    const out = call(() =>
      wasm.blind_challenge({ state, r, issuer_public_key: issuerPublicKey }),
    );
    this.#blind = out.state;
    return out.e_prime;
  }

  /** Unblind the issuer's `s_iss` into the credential. Refuses a bad response. */
  finalize(sIss: string, issuerPublicKey: string): Credential {
    const state = this.#blind;
    if (!state)
      throw new CryptoError("this issuance has no blind step to finish");
    this.#blind = null;
    return call(
      () =>
        wasm.finalize_issuance({
          state,
          s_iss: sIss,
          issuer_public_key: issuerPublicKey,
        }).credential,
    );
  }

  /** Drop whatever state is left (an issuance given up half-way). */
  discard(): void {
    this.#begin = null;
    this.#blind = null;
  }
}

type BallotState = "sealed" | "cast" | "spent";

/**
 * One position's encrypted ballot, built on this phone. The ballot bytes and
 * the opening stay in private fields: `cast()` releases the ballot (and drops
 * the opening), `challenge()` checks it here and drops both.
 */
export class SealedBallot {
  readonly electionId: string;
  readonly positionId: string;
  /** The voter's slot for this position: the same for every ballot they build for it. */
  readonly trackingCode: string;
  /** Names this particular ballot; shown before the voter casts or challenges. */
  readonly fingerprint: string;
  #ballot: string | null;
  #opening: BallotOpening | null;
  #state: BallotState = "sealed";

  /** @internal Use `VoterCrypto.buildBallot`. */
  constructor(out: wasm.BuildBallotOutput) {
    this.electionId = out.election_id;
    this.positionId = out.position_id;
    this.trackingCode = out.tracking_code;
    this.fingerprint = out.ballot_fingerprint;
    this.#ballot = out.ballot;
    this.#opening = out.opening;
  }

  get state(): BallotState {
    return this.#state;
  }

  /**
   * The ballot hex to submit (`SubmitBallot`'s argument, byte for byte). The
   * opening is dropped on the first call, so a ballot handed out for casting
   * can no longer be challenged. Later calls return the same ballot, for a
   * resend after a cut-off.
   */
  cast(): string {
    if (this.#state === "spent" || this.#ballot === null) {
      throw new CryptoError(
        "this ballot was opened for a check and can never be cast",
      );
    }
    this.#opening = null;
    this.#state = "cast";
    return this.#ballot;
  }

  /**
   * The Benaloh challenge: open this ballot and check it under the election's
   * `params` and `dkg` (the on-chain ones). The ballot, its opening and the
   * opened values are dropped before this returns, whatever the outcome.
   */
  challenge(params: string, dkg: string): ChallengeCheck {
    const ballot = this.#ballot;
    const opening = this.#opening;
    if (this.#state !== "sealed" || ballot === null || opening === null) {
      throw new CryptoError(
        this.#state === "cast"
          ? "this ballot is being cast and can no longer be challenged"
          : "this ballot was already opened",
      );
    }
    this.discard();
    let opened: wasm.BenalohOpened | null = call(() =>
      wasm.benaloh_open({ ballot, opening }),
    );
    try {
      const out = call(() =>
        wasm.benaloh_check({ params, dkg, ballot, opened: opened! }),
      );
      return {
        valid: out.valid,
        positionId: out.position_id,
        trackingCode: out.tracking_code,
        fingerprint: out.ballot_fingerprint,
        candidate: out.encoded_candidate,
        slots: out.slots.map((s) => ({
          contestId: s.contest_id,
          plaintext: s.plaintext,
          reproduces: s.reproduces,
        })),
      };
    } finally {
      opened = null;
    }
  }

  /** Drop the ballot and its opening without casting it. */
  discard(): void {
    this.#ballot = null;
    this.#opening = null;
    this.#state = "spent";
  }
}

/** The loaded module. Construct with `loadVoterCrypto`. */
export class VoterCrypto {
  readonly build: CryptoBuild;

  /** @internal */
  constructor() {
    const v = wasm.version();
    this.build = {
      name: v.name,
      version: v.version,
      wireFormat: v.wire_format,
      protocolWireVersion: v.protocol_wire_version,
      gitRev: v.git_rev,
      label: [
        `${v.name} ${v.version}`,
        v.git_rev ?? "unknown build",
        v.wire_format,
      ].join(" · "),
    };
  }

  /** Start a blind issuance (`voter-begin`). */
  beginIssuance(): Issuance {
    const out = call(() => wasm.begin_issuance());
    return new Issuance(out.blinded_commitment, out.state);
  }

  /** Is this stored credential signed by this election's issuer? Throws if not. */
  checkCredential(params: string, credential: Credential): CredentialCheck {
    const out = call(() => wasm.check_credential({ params, credential }));
    return {
      electionId: out.election_id,
      issuerPublicKey: out.issuer_public_key,
      commitment: out.commitment,
    };
  }

  /** Read and check the election's parameters and DKG transcript. */
  electionInfo(params: string, dkg: string): CryptoElection {
    const out = call(() => wasm.election_info({ params, dkg }));
    return {
      electionId: out.election_id,
      positions: out.positions.map((p) => ({
        id: p.id,
        candidates: [...p.candidates],
      })),
      trustees: out.trustees,
      threshold: out.threshold,
      issuerPublicKey: out.issuer_public_key,
      jointPublicKey: out.joint_public_key,
      jointKeyFingerprint: out.joint_key_fingerprint,
    };
  }

  /** Encrypt one position's choice (0-based candidate index). */
  buildBallot(input: {
    params: string;
    dkg: string;
    credential: Credential;
    positionId: string;
    choice: number;
  }): SealedBallot {
    const out = timed("build_ballot", () =>
      call(() =>
        wasm.build_ballot({
          params: input.params,
          dkg: input.dkg,
          credential: input.credential,
          position_id: input.positionId,
          choice: input.choice,
        }),
      ),
    );
    return new SealedBallot(out);
  }

  /** `BC-XXXX-XXXX` for a nullifier (the board's `formatTrackingCode`). */
  trackingCode(nullifier: string): string {
    return call(() => wasm.tracking_code({ nullifier })).tracking_code;
  }
}

let loaded: Promise<VoterCrypto> | null = null;

/**
 * Load the WebAssembly module once. The first call fetches
 * `saksi_wasm_bg.wasm` (served under `/vote/assets/`); later calls share the
 * same promise. Tests pass the module bytes. A failed load is not cached, so
 * a retry tries again.
 */
export function loadVoterCrypto(source?: WasmSource): Promise<VoterCrypto> {
  if (!loaded) {
    loaded = (async () => {
      if (typeof WebAssembly !== "object") {
        throw new CryptoLoadError("this browser has no WebAssembly support");
      }
      const start = globalThis.performance?.now();
      try {
        await init({ module_or_path: source ?? wasmUrl });
        measure("init", start);
      } catch (e) {
        throw new CryptoLoadError(e instanceof Error ? e.message : String(e));
      }
      return new VoterCrypto();
    })();
    loaded.catch(() => {
      loaded = null;
    });
  }
  return loaded;
}
