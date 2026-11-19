// @vitest-environment node
/**
 * The real saksi WebAssembly, no mock. vitest's environment cannot fetch the
 * web-target module from a URL, so the tests read its bytes from disk and
 * hand them to `init` (the same module the browser fetches).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import * as raw from "@saksi/wasm";
import fixture from "../test/fixture/live-election.json";
import { CryptoError, loadVoterCrypto, type VoterCrypto } from "./voterCrypto";

const WASM = fileURLToPath(
  new URL(
    "../../../../packages/saksi-wasm/saksi_wasm_bg.wasm",
    import.meta.url,
  ),
);
const FINGERPRINT = /^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/;
const TRACKING = /^BC-[0-9A-F]{4}-[0-9A-F]{4}$/;

let crypto: VoterCrypto;
const { params, dkg, credential } = fixture;

beforeAll(async () => {
  crypto = await loadVoterCrypto(readFileSync(WASM));
});

describe("voterCrypto on the real wasm", () => {
  it("loads once and reports the vendored build", async () => {
    expect(await loadVoterCrypto()).toBe(crypto);
    expect(crypto.build).toMatchObject({
      name: "saksi-wasm",
      version: "0.1.0",
      wireFormat: "saksi-live-wire-v1",
      protocolWireVersion: 1,
      gitRev: "6d2555f",
    });
    expect(crypto.build.label).toBe(
      "saksi-wasm 0.1.0 · 6d2555f · saksi-live-wire-v1",
    );
  });

  it("reads the fixture election", () => {
    const info = crypto.electionInfo(params, dkg);
    expect(info.electionId).toBe("vote-fixture");
    expect(info.positions).toEqual(fixture.positions);
    expect(info.issuerPublicKey).toBe(fixture.issuer_public_key);
    expect(info.jointKeyFingerprint).toBe(fixture.joint_key_fingerprint);
    expect(info.jointKeyFingerprint).toMatch(FINGERPRINT);
  });

  it("accepts the fixture credential for its election", () => {
    expect(crypto.checkCredential(params, credential)).toEqual({
      electionId: "vote-fixture",
      issuerPublicKey: fixture.issuer_public_key,
      commitment: fixture.commitment,
    });
  });

  it("refuses the credential against another issuer's key", () => {
    expect(() =>
      crypto.checkCredential(fixture.other_issuer.params, credential),
    ).toThrow(
      new CryptoError("the credential is not signed by this election's issuer"),
    );
  });

  it("builds a ballot with a tracking code and a fingerprint", () => {
    const b = crypto.buildBallot({
      params,
      dkg,
      credential,
      positionId: "president",
      choice: 1,
    });
    expect(b.electionId).toBe("vote-fixture");
    expect(b.positionId).toBe("president");
    expect(b.trackingCode).toMatch(TRACKING);
    expect(b.fingerprint).toMatch(FINGERPRINT);
    expect(b.fingerprint).toHaveLength(39);
    expect(b.state).toBe("sealed");
    // Nothing secret or submittable is reachable from outside the object.
    expect(Object.keys(b).sort()).toEqual(
      ["electionId", "fingerprint", "positionId", "trackingCode"].sort(),
    );
    expect(JSON.stringify(b)).not.toMatch(/randomness|opening|ballot_digest/);
  });

  it("gives two builds the same tracking code and different fingerprints", () => {
    const build = () =>
      crypto.buildBallot({
        params,
        dkg,
        credential,
        positionId: "vice-president",
        choice: 0,
      });
    const a = build();
    const b = build();
    expect(a.trackingCode).toBe(b.trackingCode);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("challenges an honest ballot: the check reports its position, candidate and fingerprint", () => {
    const b = crypto.buildBallot({
      params,
      dkg,
      credential,
      positionId: "president",
      choice: 2,
    });
    const shown = b.fingerprint;
    const check = b.challenge(params, dkg);
    expect(check).toMatchObject({
      valid: true,
      positionId: "president",
      trackingCode: b.trackingCode,
      fingerprint: shown,
      candidate: "carol",
    });
    expect(
      check.slots.map((s) => [s.contestId, s.plaintext, s.reproduces]),
    ).toEqual([
      ["president/alice", 0, true],
      ["president/bob", 0, true],
      ["president/carol", 1, true],
    ]);
    // The verdict carries no randomness and no ballot.
    expect(JSON.stringify(check)).not.toMatch(/randomness|[0-9a-f]{64}/);
  });

  it("drops a challenged ballot: it can never be cast or opened again", () => {
    const b = crypto.buildBallot({
      params,
      dkg,
      credential,
      positionId: "president",
      choice: 0,
    });
    b.challenge(params, dkg);
    expect(b.state).toBe("spent");
    expect(() => b.cast()).toThrow(/can never be cast/);
    expect(() => b.challenge(params, dkg)).toThrow(/already opened/);
  });

  it("casts a ballot once its opening is dropped, and then refuses to open it", () => {
    const b = crypto.buildBallot({
      params,
      dkg,
      credential,
      positionId: "president",
      choice: 0,
    });
    const hex = b.cast();
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(b.cast()).toBe(hex);
    expect(() => b.challenge(params, dkg)).toThrow(/being cast/);
  });

  it("refuses a choice outside the position's candidates", () => {
    expect(() =>
      crypto.buildBallot({
        params,
        dkg,
        credential,
        positionId: "president",
        choice: 3,
      }),
    ).toThrow(CryptoError);
  });

  it("formats a tracking code from a nullifier", () => {
    expect(crypto.trackingCode("7f3a92c1" + "00".repeat(28))).toBe(
      "BC-7F3A-92C1",
    );
  });
});

describe("the Benaloh check catches a tampered opening (raw exports)", () => {
  function built() {
    return raw.build_ballot({
      params,
      dkg,
      credential,
      position_id: "president",
      choice: 1,
    });
  }

  it("passes untampered", () => {
    const b = built();
    const opened = raw.benaloh_open({ ballot: b.ballot, opening: b.opening });
    const check = raw.benaloh_check({ params, dkg, ballot: b.ballot, opened });
    expect(check.valid).toBe(true);
    expect(check.encoded_candidate).toBe("bob");
    expect(check.ballot_fingerprint).toBe(b.ballot_fingerprint);
  });

  it("fails when a slot's revealed randomness is changed", () => {
    const b = built();
    const opened = raw.benaloh_open({ ballot: b.ballot, opening: b.opening });
    // Swap two slots' randomness: both are canonical scalars, neither reproduces.
    const [r0, r1] = [opened.slots[0]!.randomness, opened.slots[1]!.randomness];
    opened.slots[0]!.randomness = r1;
    opened.slots[1]!.randomness = r0;
    const check = raw.benaloh_check({ params, dkg, ballot: b.ballot, opened });
    expect(check.valid).toBe(false);
    expect(check.encoded_candidate).toBeNull();
    expect(check.slots[0]!.reproduces).toBe(false);
    expect(check.slots[1]!.reproduces).toBe(false);
  });

  it("fails when the opened plaintext claims another candidate", () => {
    const b = built();
    const opened = raw.benaloh_open({ ballot: b.ballot, opening: b.opening });
    opened.slots[1]!.plaintext = 0;
    opened.slots[0]!.plaintext = 1;
    const check = raw.benaloh_check({ params, dkg, ballot: b.ballot, opened });
    expect(check.valid).toBe(false);
  });

  it("refuses an opening made for another ballot", () => {
    const a = built();
    const b = built();
    expect(() =>
      raw.benaloh_open({ ballot: a.ballot, opening: b.opening }),
    ).toThrow(/this opening is not for this ballot/);
  });
});
