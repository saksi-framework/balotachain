// @vitest-environment node
/**
 * RealLiveClient's crypto half on the real saksi WebAssembly, over the
 * committed fixture election (FixtureTransport, no console). The wasm bytes
 * are read from disk and handed to `init`, because vitest cannot fetch the
 * web-target module from a URL.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import fixture from "../test/fixture/live-election.json";
import { FINGERPRINT, LiveError, TRACKING_CODE, type Choice } from "./live";
import { FixtureTransport, localClient, withFixtureCredential } from "./local";
import { PHONE_SCOPE, RealLiveClient, storedCredential } from "./real";
import {
  keys,
  memoryStore,
  StorageReadError,
  type KeyValueStore,
} from "./storage";
import type { LiveTransport, TransportElection } from "./transport";
import {
  loadVoterCrypto,
  type SealedBallot,
  type VoterCrypto,
} from "./voterCrypto";

const WASM = fileURLToPath(
  new URL(
    "../../../../packages/saksi-wasm/saksi_wasm_bg.wasm",
    import.meta.url,
  ),
);
const crypto = () => loadVoterCrypto(readFileSync(WASM));

/** The fingerprint anyone computes from the recorded bytes (wire-format.md). */
function fingerprintOf(ballotHex: string): string {
  const d = createHash("sha256")
    .update(Buffer.from(ballotHex, "hex"))
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();
  return d.match(/.{4}/g)!.join("-");
}

/** A store that remembers every write, to show what the client keeps. */
function recordingStore(): KeyValueStore & {
  writes: { key: string; value: unknown }[];
} {
  const inner = memoryStore();
  const writes: { key: string; value: unknown }[] = [];
  return {
    ...inner,
    writes,
    async set<T>(key: string, value: T) {
      writes.push({ key, value: structuredClone(value) });
      await inner.set(key, value);
    },
  };
}

const choices: Choice[] = [
  { positionId: "president", candidateId: "bob" },
  { positionId: "vice-president", candidateId: "fay" },
];

async function signedIn(store: KeyValueStore = recordingStore()) {
  const { client, transport } = localClient(store, { crypto });
  return { client, transport, store };
}

describe("RealLiveClient on the real wasm (fixture election)", () => {
  it("reports the wasm build", async () => {
    const { client } = await signedIn();
    expect(await client.software()).toEqual({
      label: "saksi-wasm 0.1.0 · 6d2555f · saksi-live-wire-v1",
      real: true,
    });
  });

  it("reads the election from its parameters and transcript, labelled", async () => {
    const { client } = await signedIn();
    const e = await client.election();
    expect(e.id).toBe("vote-fixture");
    expect(e.status).toBe("open");
    expect(e.keyFingerprint).toBe(fixture.joint_key_fingerprint);
    expect(e.positions.map((p) => [p.id, p.title])).toEqual([
      ["president", "President"],
      ["vice-president", "Vice President"],
    ]);
    expect(e.positions[0]!.candidates.map((c) => [c.id, c.name])).toEqual([
      ["alice", "Alice"],
      ["bob", "Bob"],
      ["carol", "Carol"],
    ]);
  });

  it("D19: with no labels, shows each id with hyphens as spaces, and still encrypts and sends the raw ids", async () => {
    class Unlabelled extends FixtureTransport {
      override async election(): Promise<TransportElection> {
        const e = { ...(await super.election()) };
        delete e.labels;
        return e;
      }
    }
    const store = recordingStore();
    const transport = new Unlabelled();
    const built: string[] = [];
    const client = new RealLiveClient({
      transport,
      store: withFixtureCredential(store),
      crypto: async () => {
        const c = await crypto();
        const build = c.buildBallot.bind(c);
        vi.spyOn(c, "buildBallot").mockImplementation((input) => {
          built.push(input.positionId);
          return build(input);
        });
        return c;
      },
    });
    const e = await client.election();
    expect(e.positions.map((p) => [p.id, p.title])).toEqual([
      ["president", "president"],
      ["vice-president", "vice president"],
    ]);
    expect(e.positions[1]!.candidates.map((c) => [c.id, c.name])).toEqual([
      ["dan", "dan"],
      ["eve", "eve"],
      ["fay", "fay"],
    ]);
    const b = await client.encrypt(choices);
    // Every build of a position (the client may build more than once) gets
    // the raw id.
    expect([...new Set(built)]).toEqual(["president", "vice-president"]);
    expect(b.positions.map((p) => p.positionId)).toEqual([
      "president",
      "vice-president",
    ]);
    await client.submit(b, () => {});
    expect(transport.recorded.map((r) => r.positionId)).toEqual([
      "president",
      "vice-president",
    ]);
  });

  it("finds the stored credential usable for this election, and not for another issuer's", async () => {
    const { client } = await signedIn();
    await client.election();
    expect(await client.hasCredential()).toBe(true);

    // Another election (another issuer), still in setup: the same stored
    // credential is not usable there, so the voter would enrol again.
    class OtherIssuer extends FixtureTransport {
      async election(): Promise<TransportElection> {
        const e = await super.election();
        return {
          ...e,
          status: "setup",
          params: fixture.other_issuer.params,
          dkg: null,
          issuerPublicKey: fixture.other_issuer.issuer_public_key,
        };
      }
    }
    const store = recordingStore();
    const other = new RealLiveClient({
      transport: new OtherIssuer(),
      store: withFixtureCredential(store),
      crypto,
    });
    expect(await other.election()).toMatchObject({
      status: "setup",
      positions: [],
    });
    expect(await other.hasCredential()).toBe(false);
  });

  it("challenges, rebuilds, and casts only the fresh ballot; the board fingerprint matches", async () => {
    const store = recordingStore();
    const { client, transport } = await signedIn(store);
    await client.election();

    const first = await client.encrypt(choices);
    for (const p of first.positions) {
      expect(p.trackingCode).toMatch(TRACKING_CODE);
      expect(p.fingerprint).toMatch(FINGERPRINT);
    }

    const results = await client.challenge(first);
    expect(results).toEqual(
      first.positions.map((p, i) => ({
        positionId: p.positionId,
        checkedPositionId: p.positionId,
        trackingCode: p.trackingCode,
        candidateId: choices[i]!.candidateId,
        fingerprint: p.fingerprint,
        matches: true,
      })),
    );
    // Spent: never sent, never challenged twice.
    await expect(client.submit(first, () => {})).rejects.toMatchObject({
      kind: "refused",
    });
    await expect(client.challenge(first)).rejects.toMatchObject({
      kind: "refused",
    });

    const fresh = await client.encrypt(choices);
    expect(fresh.positions.map((p) => p.trackingCode)).toEqual(
      first.positions.map((p) => p.trackingCode),
    );
    fresh.positions.forEach((p, i) =>
      expect(p.fingerprint).not.toBe(first.positions[i]!.fingerprint),
    );

    const seen: string[] = [];
    const receipts = await client.submit(fresh, (r) => seen.push(r.positionId));
    expect(seen).toEqual(["president", "vice-president"]);
    expect(receipts.map((r) => r.fingerprint)).toEqual(
      fresh.positions.map((p) => p.fingerprint),
    );
    // What reached the transport is exactly the fresh ballots: the
    // fingerprint of each recorded byte string is the one the phone showed.
    expect(transport.recorded.map((r) => fingerprintOf(r.ballot))).toEqual(
      fresh.positions.map((p) => p.fingerprint),
    );
    const challenged = first.positions.map((p) => p.fingerprint);
    for (const r of transport.recorded) {
      expect(challenged).not.toContain(fingerprintOf(r.ballot));
    }

    // Storage holds the receipts and the "sent, no answer yet"
    // markers (the credential came with the fixture); nothing else, and no
    // opening or challenged ballot. The markers are empty once recorded.
    expect([...new Set(store.writes.map((w) => w.key))].sort()).toEqual([
      keys.receipts("vote-fixture", PHONE_SCOPE),
      keys.sending("vote-fixture", PHONE_SCOPE),
    ]);
    const markers = store.writes.filter(
      (w) => w.key === keys.sending("vote-fixture", PHONE_SCOPE),
    );
    expect(markers[markers.length - 1]!.value).toEqual([]);
    const dump = JSON.stringify(store.writes);
    expect(dump).not.toMatch(/randomness|opening|ballot_digest|s_cred/);
    for (const fp of challenged) expect(dump).not.toContain(fp);
    expect(await client.receipts()).toEqual(receipts);
  });

  it("refuses a second ballot once one is recorded", async () => {
    const { client } = await signedIn();
    await client.election();
    await client.submit(await client.encrypt(choices), () => {});
    // Refused when building: a recorded position is never built again.
    await expect(client.encrypt(choices)).rejects.toMatchObject({
      kind: "already-voted",
    });
  });

  it("drops a ballot the voter walked away from when a new one is built", async () => {
    const { client } = await signedIn();
    await client.election();
    const abandoned = await client.encrypt(choices);
    await client.encrypt(choices);
    await expect(client.challenge(abandoned)).rejects.toMatchObject({
      kind: "refused",
    });
  });

  it("refuses an issuer key that is not the one in the parameters, before enrolling", async () => {
    class WrongKey extends FixtureTransport {
      async election(): Promise<TransportElection> {
        const e = await super.election();
        return {
          ...e,
          issuerPublicKey: fixture.other_issuer.issuer_public_key,
        };
      }
    }
    const store = recordingStore();
    const client = new RealLiveClient({
      transport: new WrongKey(),
      store,
      crypto,
    });
    await expect(client.election()).rejects.toMatchObject({
      kind: "refused",
      message: expect.stringContaining("issuer key"),
    });
  });

  it("drops every opening when a send is refused part-way", async () => {
    const built: SealedBallot[] = [];
    const tracking = async (): Promise<VoterCrypto> => {
      const c = await crypto();
      const t = Object.create(c) as VoterCrypto;
      t.buildBallot = (input) => {
        const b = c.buildBallot(input);
        built.push(b);
        return b;
      };
      return t;
    };
    class RefuseSecond extends FixtureTransport {
      async submitBallot(positionId: string, ballot: string) {
        if (this.recorded.length === 1) {
          throw new LiveError("refused", "The ledger refused this ballot.");
        }
        return super.submitBallot(positionId, ballot);
      }
    }
    const store = withFixtureCredential(recordingStore());
    const transport = new RefuseSecond();
    const client = new RealLiveClient({ transport, store, crypto: tracking });
    await client.election();
    const b = await client.encrypt(choices);
    await expect(client.submit(b, () => {})).rejects.toMatchObject({
      kind: "refused",
    });
    expect(built.map((x) => x.state)).toEqual(["spent", "spent"]);
    // The ballot is gone: neither resent nor opened.
    await expect(client.challenge(b)).rejects.toMatchObject({
      message: "This ballot is not on this phone.",
    });
  });

  it("keeps a ballot for a retry after a network failure, with its openings already dropped", async () => {
    const built: SealedBallot[] = [];
    const tracking = async (): Promise<VoterCrypto> => {
      const c = await crypto();
      const t = Object.create(c) as VoterCrypto;
      t.buildBallot = (input) => {
        const b = c.buildBallot(input);
        built.push(b);
        return b;
      };
      return t;
    };
    let failOnce = true;
    class DropSecond extends FixtureTransport {
      async submitBallot(positionId: string, ballot: string) {
        if (this.recorded.length === 1 && failOnce) {
          failOnce = false;
          throw new LiveError("network", "dropped");
        }
        return super.submitBallot(positionId, ballot);
      }
    }
    const store = withFixtureCredential(recordingStore());
    const transport = new DropSecond();
    const client = new RealLiveClient({ transport, store, crypto: tracking });
    await client.election();
    const b = await client.encrypt(choices);
    await expect(client.submit(b, () => {})).rejects.toMatchObject({
      kind: "network",
    });
    // Both openings are gone (cast), though position 2 is not sent yet.
    expect(built.map((x) => x.state)).toEqual(["cast", "cast"]);
    const receipts = await client.submit(b, () => {});
    expect(receipts).toHaveLength(2);
    expect(transport.recorded).toHaveLength(2);
    expect(built.map((x) => x.state)).toEqual(["spent", "spent"]);
  });

  it("drops every position of a challenged ballot even if one check throws", async () => {
    const built: SealedBallot[] = [];
    const tracking = async (): Promise<VoterCrypto> => {
      const c = await crypto();
      const t = Object.create(c) as VoterCrypto;
      t.buildBallot = (input) => {
        const b = c.buildBallot(input);
        if (built.length === 0) {
          // An unexpected (non-crypto) failure in the first position's check.
          b.challenge = () => {
            throw new TypeError("boom");
          };
        }
        built.push(b);
        return b;
      };
      return t;
    };
    const { client } = localClient(recordingStore(), { crypto: tracking });
    await client.election();
    const b = await client.encrypt(choices);
    await expect(client.challenge(b)).rejects.toThrow("boom");
    expect(built.map((x) => x.state)).toEqual(["spent", "spent"]);
  });

  it("records a failed check on this phone as the flag and election id only, sending nothing", async () => {
    const store = recordingStore();
    const { client, transport } = await signedIn(store);
    // Every transport method, so "sends nothing" means nothing at all.
    const t = transport as unknown as Record<string, () => unknown>;
    const sent = Object.getOwnPropertyNames(Object.getPrototypeOf(transport))
      .filter((n) => n !== "constructor" && typeof t[n] === "function")
      .map((n) => vi.spyOn(t, n));
    expect(sent.length).toBeGreaterThan(3);
    const before = store.writes.length;
    expect(await client.failedCheckRecorded("vote-fixture")).toBe(false);
    await client.recordFailedCheck("vote-fixture");
    expect(store.writes.slice(before)).toEqual([
      {
        key: "check-failed:vote-fixture",
        value: { electionId: "vote-fixture", checkFailed: true },
      },
    ]);
    expect(await client.failedCheckRecorded("vote-fixture")).toBe(true);
    expect(await client.failedCheckRecorded("another-election")).toBe(false);
    for (const s of sent) expect(s).not.toHaveBeenCalled();
  });

  it("says when the browser cannot load the voting software", async () => {
    const { client } = localClient(memoryStore(), {
      crypto: () => Promise.reject(new Error("CompileError: bad module")),
    });
    await expect(client.software()).rejects.toMatchObject({
      kind: "unsupported",
      message: expect.stringContaining("CompileError: bad module"),
    });
  });
});

/**
 * Enrolment happens in `setup`, before the trustees' key exists (`dkg`
 * null). The issuer secret never exists in the browser and saksi's blind
 * Schnorr has no JS twin here, so a faithful issuer double needs the CLI:
 * the full good flow is in the SAKSI_DEMO block below. These run by default
 * and drive the real wasm with issuer replies that cannot be right.
 */
describe("D11: the already-voted rule is per position", () => {
  class RefuseSecond extends FixtureTransport {
    refuse = true;
    async submitBallot(positionId: string, ballot: string) {
      if (this.refuse && positionId === "vice-president") {
        throw new LiveError("refused", "The ledger refused this ballot.");
      }
      return super.submitBallot(positionId, ballot);
    }
  }

  async function partly() {
    const store = withFixtureCredential(recordingStore());
    const transport = new RefuseSecond();
    const client = new RealLiveClient({ transport, store, crypto });
    await client.election();
    const first = await client.encrypt(choices);
    await expect(client.submit(first, () => {})).rejects.toMatchObject({
      kind: "refused",
    });
    transport.refuse = false;
    return { store, transport, client, first };
  }

  it("Finish builds and sends only the missing position", async () => {
    const { transport, client, first } = await partly();
    expect(transport.recorded.map((r) => r.positionId)).toEqual(["president"]);
    expect(await client.unconfirmed()).toEqual([]);
    const missing = await client.encrypt([
      { positionId: "vice-president", candidateId: "dan" },
    ]);
    expect(missing.positions.map((p) => p.positionId)).toEqual([
      "vice-president",
    ]);
    const receipts = await client.submit(missing, () => {});
    // The request list: the first send, then the missing position alone.
    expect(transport.recorded.map((r) => r.positionId)).toEqual([
      "president",
      "vice-president",
    ]);
    expect(receipts.map((r) => r.positionId)).toEqual([
      "president",
      "vice-president",
    ]);
    expect(receipts[0]!.fingerprint).toBe(first.positions[0]!.fingerprint);
  });

  it("never builds a recorded position again", async () => {
    const { transport, client } = await partly();
    await expect(client.encrypt(choices)).rejects.toMatchObject({
      kind: "already-voted",
    });
    expect(transport.recorded).toHaveLength(1);
  });

  it("refuses at the client boundary a held ballot that holds a recorded position, sending nothing", async () => {
    // Two tabs on one phone (one store): tab A builds the whole ballot,
    // tab B records the president from another ballot, then tab A submits.
    const store = withFixtureCredential(recordingStore());
    const transport = new RefuseSecond();
    const tabA = new RealLiveClient({ transport, store, crypto });
    const tabB = new RealLiveClient({ transport, store, crypto });
    for (const t of [tabA, tabB]) {
      await t.election();
    }
    const stale = await tabA.encrypt(choices);
    await expect(
      tabB.submit(await tabB.encrypt(choices), () => {}),
    ).rejects.toMatchObject({ kind: "refused" });
    expect(transport.recorded.map((r) => r.positionId)).toEqual(["president"]);
    transport.refuse = false;
    await expect(tabA.submit(stale, () => {})).rejects.toMatchObject({
      kind: "already-voted",
    });
    expect(transport.recorded).toHaveLength(1);
  });

  it("keeps a send with no answer as unconfirmed across a reload, and resends the same bytes", async () => {
    const store = withFixtureCredential(recordingStore());
    let drop = true;
    const sent: { positionId: string; ballot: string; resend: boolean }[] = [];
    class DropSecond extends FixtureTransport {
      async submitBallot(
        positionId: string,
        ballot: string,
        _shown?: unknown,
        opts?: { resend?: boolean },
      ) {
        sent.push({ positionId, ballot, resend: opts?.resend === true });
        if (drop && positionId === "vice-president") {
          throw new LiveError("network", "dropped");
        }
        return super.submitBallot(positionId, ballot);
      }
    }
    const transport = new DropSecond();
    const first = new RealLiveClient({ transport, store, crypto });
    await first.election();
    const b = await first.encrypt(choices);
    await expect(first.submit(b, () => {})).rejects.toMatchObject({
      kind: "network",
    });

    // A reload: a new client over the same storage; the held ballot is gone.
    const again = new RealLiveClient({ transport, store, crypto });
    await again.election();
    expect(await again.unconfirmed()).toEqual([b.positions[1]]);
    // Not "Not sent": it cannot be built again.
    await expect(
      again.encrypt([{ positionId: "vice-president", candidateId: "dan" }]),
    ).rejects.toMatchObject({ kind: "already-voted" });
    drop = false;
    const handle = await again.resendUnconfirmed();
    expect(handle!.positions).toEqual([b.positions[1]]);
    await expect(again.challenge(handle!)).rejects.toMatchObject({
      kind: "refused",
    });
    const receipts = await again.submit(handle!, () => {});
    expect(receipts.map((r) => r.fingerprint)).toEqual(
      b.positions.map((p) => p.fingerprint),
    );
    // The same bytes, marked as a resend, and nothing else.
    expect(sent.map((x) => x.positionId)).toEqual([
      "president",
      "vice-president",
      "vice-president",
    ]);
    expect(sent[2]!.ballot).toBe(sent[1]!.ballot);
    expect(sent[2]!.resend).toBe(true);
    expect(fingerprintOf(sent[2]!.ballot)).toBe(b.positions[1]!.fingerprint);
    expect(await again.unconfirmed()).toEqual([]);
  });
});

describe("fix round 1: markers, tabs and elections", () => {
  /** A transport whose next answers for a position are scripted. */
  class Scripted extends FixtureTransport {
    script: (LiveError | null)[] = [];
    sent: { positionId: string; ballot: string; resend: boolean }[] = [];
    async submitBallot(
      positionId: string,
      ballot: string,
      _shown?: unknown,
      opts?: { resend?: boolean },
    ) {
      this.sent.push({ positionId, ballot, resend: opts?.resend === true });
      const next = this.script.shift();
      if (next) throw next;
      return super.submitBallot(positionId, ballot);
    }
  }

  async function client(store: KeyValueStore, transport: Scripted) {
    const c = new RealLiveClient({ transport, store, crypto });
    await c.election();
    return c;
  }

  for (const [label, err] of [
    [
      "409 closed",
      new LiveError("closed", "The election is not accepting ballots."),
    ],
    [
      "404",
      new LiveError(
        "not-open",
        "No election has been set up on this server yet.",
      ),
    ],
    [
      "400",
      new LiveError("refused", "The election server refused this request."),
    ],
  ] as const) {
    it(`I1: a resend refused outright (${label}) keeps the position unconfirmed`, async () => {
      const store = withFixtureCredential(recordingStore());
      const transport = new Scripted();
      // President recorded, Vice President's answer lost.
      transport.script = [null, new LiveError("network", "dropped")];
      const first = await client(store, transport);
      const b = await first.encrypt(choices);
      await expect(first.submit(b, () => {})).rejects.toMatchObject({
        kind: "network",
      });
      // A reload, then Send again, refused outright.
      const again = await client(store, transport);
      transport.script = [err];
      await expect(
        again.submit((await again.resendUnconfirmed())!, () => {}),
      ).rejects.toMatchObject({ kind: err.kind });
      expect(transport.sent[transport.sent.length - 1]!.resend).toBe(true);
      expect(await again.unconfirmed()).toEqual([b.positions[1]]);
      await expect(
        again.encrypt([{ positionId: "vice-president", candidateId: "dan" }]),
      ).rejects.toMatchObject({ kind: "already-voted" });
    });
  }

  it("I1: a first send refused outright is known not recorded, so the marker goes", async () => {
    const store = withFixtureCredential(recordingStore());
    const transport = new Scripted();
    transport.script = [null, new LiveError("refused", "refused")];
    const c = await client(store, transport);
    await expect(
      c.submit(await c.encrypt(choices), () => {}),
    ).rejects.toMatchObject({
      kind: "refused",
    });
    expect(await c.unconfirmed()).toEqual([]);
  });

  it("I2: a ballot held in another tab is refused whole when a position is unconfirmed from another ballot", async () => {
    const store = withFixtureCredential(recordingStore());
    const transport = new Scripted();
    const tabA = await client(store, transport);
    const tabB = await client(store, transport);
    const stale = await tabA.encrypt(choices);
    // Tab B sends; the answer for President is lost.
    transport.script = [new LiveError("network", "dropped")];
    const sentB = await tabB.encrypt(choices);
    await expect(tabB.submit(sentB, () => {})).rejects.toMatchObject({
      kind: "network",
    });
    const markerB = await store.get(keys.sending("vote-fixture", PHONE_SCOPE));
    const before = transport.sent.length;
    await expect(tabA.submit(stale, () => {})).rejects.toMatchObject({
      kind: "already-voted",
    });
    // Nothing sent, and B's marker is exactly as it was.
    expect(transport.sent).toHaveLength(before);
    expect(await store.get(keys.sending("vote-fixture", PHONE_SCOPE))).toEqual(
      markerB,
    );
    expect((await tabA.unconfirmed())[0]!.fingerprint).toBe(
      sentB.positions[0]!.fingerprint,
    );
  });

  it('m5: a resend answered "taken" and not confirmed by the board is remembered as such', async () => {
    const store = withFixtureCredential(recordingStore());
    const transport = new Scripted();
    transport.script = [null, new LiveError("network", "dropped")];
    const c = await client(store, transport);
    await expect(
      c.submit(await c.encrypt(choices), () => {}),
    ).rejects.toMatchObject({
      kind: "network",
    });
    expect((await c.unconfirmed())[0]!.takenUnconfirmed).toBeUndefined();
    transport.script = [new LiveError("already-voted", "nullifier spent")];
    await expect(
      c.submit((await c.resendUnconfirmed())!, () => {}),
    ).rejects.toMatchObject({ kind: "already-voted" });
    const [u] = await c.unconfirmed();
    expect(u!.takenUnconfirmed).toBe(true);
    // Only a boolean was added to the marker.
    const stored = (await store.get<Record<string, unknown>[]>(
      keys.sending("vote-fixture", PHONE_SCOPE),
    ))!;
    expect(Object.keys(stored[0]!).sort()).toEqual([
      "ballot",
      "fingerprint",
      "positionId",
      "takenUnconfirmed",
      "trackingCode",
    ]);
  });

  it("m4: a marker whose position has a receipt is removed when receipts are read", async () => {
    const store = withFixtureCredential(recordingStore());
    const transport = new Scripted();
    const c = await client(store, transport);
    const receipt = {
      positionId: "president",
      trackingCode: "BC-0000-0001",
      fingerprint: "0000-0000-0000-0000-0000-0000-0000-0001",
      txId: "aa".repeat(32),
      block: 1,
    };
    await store.set(keys.receipts("vote-fixture", PHONE_SCOPE), [receipt]);
    await store.set(keys.sending("vote-fixture", PHONE_SCOPE), [
      { ...receipt, ballot: "00" },
    ]);
    expect(await c.receipts()).toEqual([receipt]);
    expect(await store.get(keys.sending("vote-fixture", PHONE_SCOPE))).toEqual(
      [],
    );
  });

  it("m1: a credential and a receipt stored for an earlier election are not this election's", async () => {
    const store = recordingStore();
    // Signed under this election's issuer key, but stored for another
    // election id (an earlier election on the same console).
    await store.set(
      keys.credential(PHONE_SCOPE),
      storedCredential("live-earlier", fixture.credential),
    );
    await store.set(keys.receipts("live-earlier", PHONE_SCOPE), [
      {
        positionId: "president",
        trackingCode: "BC-0000-0001",
        fingerprint: "0000-0000-0000-0000-0000-0000-0000-0001",
        txId: "aa".repeat(32),
        block: 1,
      },
    ]);
    const transport = new Scripted();
    const c = await client(store, transport);
    expect(await c.hasCredential()).toBe(false);
    expect(await c.receipts()).toBeNull();
    await expect(c.encrypt(choices)).rejects.toMatchObject({
      kind: "refused",
      message: expect.stringContaining("not for this election"),
      detail: { type: "stale-credential" },
    });
    expect(transport.sent).toEqual([]);
  });

  it("I3: never builds a ballot with a credential that does not check out for this election", async () => {
    const store = recordingStore();
    await store.set(
      keys.credential(PHONE_SCOPE),
      storedCredential("vote-fixture", {
        ...fixture.credential,
        signature_s: "00".repeat(32),
      }),
    );
    const transport = new Scripted();
    const c = await client(store, transport);
    expect(await c.hasCredential()).toBe(false);
    await expect(c.encrypt(choices)).rejects.toMatchObject({
      kind: "refused",
      message: expect.stringContaining("not for this election"),
      detail: { type: "stale-credential" },
    });
    expect(transport.sent).toEqual([]);
  });

  it("I3: receipts and markers are kept per election; the old per-account records are ignored and kept", async () => {
    const store = withFixtureCredential(recordingStore());
    const old = [
      {
        positionId: "president",
        trackingCode: "BC-0000-0001",
        fingerprint: "0000-0000-0000-0000-0000-0000-0000-0001",
        txId: "aa".repeat(32),
        block: 1,
      },
    ];
    await store.set("receipts:voter1", old);
    await store.set("receipts:another-election:voter1", old);
    // An account's records from before the check-in, in this very election.
    await store.set("receipts:vote-fixture:voter1", old);
    await store.set("sending:voter1", [{ ...old[0], ballot: "00" }]);
    const transport = new Scripted();
    const c = await client(store, transport);
    expect(await c.receipts()).toBeNull();
    expect(await c.unconfirmed()).toEqual([]);
    const receipts = await c.submit(await c.encrypt(choices), () => {});
    expect(receipts).toHaveLength(2);
    expect(await store.get(keys.receipts("vote-fixture", PHONE_SCOPE))).toEqual(
      receipts,
    );
    // Never migrated, never deleted.
    expect(await store.get("receipts:voter1")).toEqual(old);
    expect(await store.get("receipts:another-election:voter1")).toEqual(old);
    expect(await store.get("receipts:vote-fixture:voter1")).toEqual(old);
    expect(await store.get("sending:voter1")).toHaveLength(1);
  });
});

describe("N2: a failed storage read stops building and sending", () => {
  /** A store whose strict reads throw for keys matching `failing`. */
  function flakyStore() {
    const inner = recordingStore();
    const ctl: { failing: RegExp | null } = { failing: null };
    const store: KeyValueStore & { writes: typeof inner.writes } = {
      ...inner,
      async getStrict<T>(key: string) {
        if (ctl.failing?.test(key)) {
          throw new StorageReadError(key, new Error("read failed"));
        }
        return inner.getStrict<T>(key);
      },
    };
    return { store: withFixtureCredential(store), writes: inner.writes, ctl };
  }

  for (const failing of [/^sending:/, /^receipts:/]) {
    it(`reads of ${failing.source.slice(1, -1)}* that fail: encrypt refuses, submit and resend send nothing, nothing is written`, async () => {
      const { store, writes, ctl } = flakyStore();
      const transport = new FixtureTransport();
      const c = new RealLiveClient({ transport, store, crypto });
      await c.election();
      const held = await c.encrypt(choices);
      ctl.failing = failing;
      const before = writes.length;
      await expect(c.encrypt(choices)).rejects.toMatchObject({
        kind: "network",
        detail: { type: "storage-read" },
      });
      await expect(c.submit(held, () => {})).rejects.toMatchObject({
        detail: { type: "storage-read" },
      });
      await expect(c.resendUnconfirmed()).rejects.toMatchObject({
        detail: { type: "storage-read" },
      });
      await expect(c.receipts()).rejects.toMatchObject({
        detail: { type: "storage-read" },
      });
      expect(transport.recorded).toEqual([]);
      expect(writes.slice(before)).toEqual([]);
      // Storage reads again: the same held ballot goes through.
      ctl.failing = null;
      expect(await c.submit(held, () => {})).toHaveLength(2);
    });
  }
});

describe("enrol before the trustees' key exists, with a bad issuer reply", () => {
  const SCALAR_ONE = "01" + "00".repeat(31);
  class SetupIssuer extends FixtureTransport {
    constructor(private readonly reply: { r: string; sIss: string }) {
      super({ status: "setup" });
    }
    async election(): Promise<TransportElection> {
      return { ...(await super.election()), dkg: null };
    }
    async issuePresign() {
      return { r: this.reply.r };
    }
    async issueSign() {
      return { sIss: this.reply.sIss };
    }
  }

  async function enrolWith(reply: { r: string; sIss: string }) {
    const store = recordingStore();
    const client = new RealLiveClient({
      transport: new SetupIssuer(reply),
      store,
      crypto,
    });
    expect(await client.election()).toMatchObject({
      status: "setup",
      positions: [],
    });
    expect(await client.hasCredential()).toBe(false);
    const steps: string[] = [];
    const outcome = await client
      .enrol((s) => steps.push(`${s.index}:${s.state}`))
      .then(
        () => "stored",
        (e: LiveError) => e,
      );
    return { outcome, steps, store, client };
  }

  it("refuses a malformed reply and stores nothing", async () => {
    const { outcome, store, client } = await enrolWith({
      r: "zz",
      sIss: SCALAR_ONE,
    });
    expect(outcome).toMatchObject({
      kind: "refused",
      message: expect.stringContaining("no credential was stored"),
    });
    expect(store.writes.filter((w) => w.key.startsWith("credential:"))).toEqual(
      [],
    );
    expect(await client.hasCredential()).toBe(false);
  });

  it("refuses a well-formed reply that is not the issuer's answer to this session", async () => {
    // A valid point and a valid scalar, but not a signature over this
    // voter's blinded commitment (as a reply meant for another session is).
    const { outcome, steps, store } = await enrolWith({
      r: fixture.issuer_public_key,
      sIss: SCALAR_ONE,
    });
    expect(outcome).toMatchObject({ kind: "refused" });
    // It got as far as unblinding, and failed there.
    expect(steps).toContain("3:running");
    expect(steps).not.toContain("3:done");
    expect(store.writes.filter((w) => w.key.startsWith("credential:"))).toEqual(
      [],
    );
  });
});

/**
 * Blind issuance end to end, with the native CLI as the issuer. Runs only
 * when SAKSI_DEMO points at a `saksi-demo` binary (saksi docs/live).
 */
const demo = process.env.SAKSI_DEMO;
describe.skipIf(!demo)("enrol against the native CLI issuer", () => {
  const work = mkdtempSync(join(tmpdir(), "vote-issuer-"));
  afterAll(() => rmSync(work, { recursive: true, force: true }));
  const live = (op: string, input: unknown) =>
    JSON.parse(
      execFileSync(demo!, ["live", op], {
        input: JSON.stringify(input),
      }).toString(),
    );

  it("gets a credential through blind issuance before the DKG, stores only it, and votes with it", async () => {
    const issuerKey = join(work, "issuer.key");
    const issuerPk = live("issuer-keygen", { key_file: issuerKey }).public_key;
    const params = live("election-params", {
      election_id: "vote-issuance-test",
      positions: [{ id: "president", candidates: ["alice", "bob"] }],
      trustees: 1,
      threshold: 1,
      issuer_public_key: issuerPk,
    }).params;
    const tKey = join(work, "t1.key");
    const tPk = live("trustee-keygen", {
      trustee_id: 1,
      key_file: tKey,
    }).receive_public_key;
    const commitments = live("dkg-deal", {
      receive_key_file: tKey,
      params,
      dealer_id: 1,
      peers: [{ trustee_id: 1, receive_public_key: tPk }],
    }).commitments;
    const dkg = live("dkg-transcript", {
      params,
      dealers: [{ dealer_id: 1, commitments }],
    }).dkg;

    const session = join(work, "session.json");
    const sent: unknown[] = [];
    const store = recordingStore();
    // Enrolment runs in setup, before the transcript is published.
    let published = false;
    const transport: LiveTransport = {
      async checkin() {
        return null;
      },
      async findVoter() {
        throw new Error("not used");
      },
      async declare() {
        throw new Error("not used");
      },
      async signList() {
        throw new Error("not used");
      },
      async election() {
        return {
          title: "t",
          status: published ? "open" : "setup",
          params,
          dkg: published ? dkg : null,
          issuerPublicKey: issuerPk,
        };
      },
      async issuePresign(blindedCommitment) {
        sent.push(blindedCommitment);
        return live("issue-presign", {
          issuer_key_file: issuerKey,
          blinded_commitment: blindedCommitment,
          session_file: session,
        });
      },
      async issueSign(ePrime) {
        sent.push(ePrime);
        const out = live("issue-sign", {
          issuer_key_file: issuerKey,
          session_file: session,
          e_prime: ePrime,
        });
        return { sIss: out.s_iss };
      },
      async submitBallot(_positionId, ballot) {
        sent.push(ballot);
        return { txId: "00", block: 1 };
      },
      async lookup(trackingCode) {
        return { trackingCode, recorded: false, counted: false };
      },
    };
    const client = new RealLiveClient({ transport, store, crypto });
    await client.election();
    expect(await client.hasCredential()).toBe(false);

    const steps: string[] = [];
    await client.enrol((s) => steps.push(`${s.index}:${s.state}`));
    expect(steps).toHaveLength(10);
    expect(await client.hasCredential()).toBe(true);

    // Only the credential was stored, once; the issuer saw only the
    // blinded commitment and the blinded challenge.
    expect(store.writes.map((w) => w.key)).toEqual([
      keys.credential(PHONE_SCOPE),
    ]);
    const stored = store.writes[0]!.value as {
      electionId: string;
      credential: { s_cred: string };
    };
    // The election id comes from the parameters, which exist before the DKG.
    expect(stored.electionId).toBe("vote-issuance-test");
    expect(Object.keys(stored.credential).sort()).toEqual([
      "s_cred",
      "signature_r",
      "signature_s",
    ]);
    for (const v of sent) {
      expect(JSON.stringify(v)).not.toContain(stored.credential.s_cred);
    }

    published = true;
    await client.election();
    const b = await client.encrypt([
      { positionId: "president", candidateId: "alice" },
    ]);
    const [r] = await client.challenge(b);
    expect(r).toMatchObject({ matches: true, candidateId: "alice" });
  });

  it("refuses the real issuer's reply for another session, and a reply under another issuer key", async () => {
    const issuerKey = join(work, "issuer2.key");
    const issuerPk = live("issuer-keygen", { key_file: issuerKey }).public_key;
    const otherPk = live("issuer-keygen", {
      key_file: join(work, "issuer3.key"),
    }).public_key;
    const params = live("election-params", {
      election_id: "vote-issuance-test-2",
      positions: [{ id: "president", candidates: ["alice", "bob"] }],
      trustees: 1,
      threshold: 1,
      issuer_public_key: issuerPk,
    }).params;

    // A second voter's session, signed for real by the issuer.
    const other = live("voter-begin", {});
    const otherSession = join(work, "other-session.json");
    const otherR = live("issue-presign", {
      issuer_key_file: issuerKey,
      blinded_commitment: other.blinded_commitment,
      session_file: otherSession,
    }).r;
    const otherBlind = live("voter-blind", {
      state: other.state,
      r: otherR,
      issuer_public_key: issuerPk,
    });
    const otherSIss = live("issue-sign", {
      issuer_key_file: issuerKey,
      session_file: otherSession,
      e_prime: otherBlind.e_prime,
    }).s_iss;

    let n = 0;
    const transport = (
      claimedKey: string,
      sign: (ePrime: string, session: string) => string,
    ): LiveTransport => {
      const session = join(work, `s${++n}.json`);
      return {
        async checkin() {
          return null;
        },
        async findVoter() {
          throw new Error("not used");
        },
        async declare() {
          throw new Error("not used");
        },
        async signList() {
          throw new Error("not used");
        },
        async election() {
          return {
            title: "t",
            status: "setup",
            params,
            dkg: null,
            issuerPublicKey: claimedKey,
          };
        },
        async issuePresign(blindedCommitment) {
          return live("issue-presign", {
            issuer_key_file: issuerKey,
            blinded_commitment: blindedCommitment,
            session_file: session,
          });
        },
        async issueSign(ePrime) {
          return { sIss: sign(ePrime, session) };
        },
        async submitBallot() {
          throw new Error("not used");
        },
        async lookup(trackingCode) {
          return { trackingCode, recorded: false, counted: false };
        },
      };
    };
    const realSign = (ePrime: string, session: string) =>
      live("issue-sign", {
        issuer_key_file: issuerKey,
        session_file: session,
        e_prime: ePrime,
      }).s_iss;

    for (const t of [
      // The other voter's genuine answer instead of this session's.
      transport(issuerPk, () => otherSIss),
      // A genuine answer, but the server names another issuer key.
      transport(otherPk, realSign),
    ]) {
      const store = recordingStore();
      const client = new RealLiveClient({ transport: t, store, crypto });
      await client.election();
      await expect(client.enrol(() => {})).rejects.toMatchObject({
        kind: "refused",
      });
      expect(store.writes).toEqual([]);
    }
  });
});
