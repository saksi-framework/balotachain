import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FINGERPRINT,
  normaliseTrackingCode,
  TRACKING_CODE,
  type Choice,
} from "./live";
import {
  ENROL_STEPS,
  longNamePositions,
  MOCK_BOARD_CODES,
  MockLiveClient,
  mockOptionsFromQuery,
  mockTrackingCode,
} from "./mock";
import {
  ALREADY_CHECKED_IN,
  CHECKIN_IN_PROGRESS,
  NOT_ON_LIST,
} from "./checkin";
import { PHONE_SCOPE, RealLiveClient } from "./real";
import { selectClient } from "./client";
import { keys, memoryStore } from "./storage";

const choices: Choice[] = [
  { positionId: "president", candidateId: "p-b" },
  { positionId: "vice-president", candidateId: "v-c" },
];

/** A phone that checked in as the list's first voter and signed the list. */
async function signedIn(opts = {}) {
  const store = memoryStore();
  const c = new MockLiveClient({ speed: 0, store, ...opts });
  await c.checkedInAs(1);
  return { c, store };
}

const UNO = {
  lastName: "Halimbawa",
  firstName: "Uno",
  dateOfBirth: "1990-01-01",
};

describe("MockLiveClient", () => {
  it("refuses details that are not on the list with one sentence that names no field, and holds no check-in", async () => {
    const c = new MockLiveClient({ speed: 0 });
    for (const wrong of [
      { ...UNO, dateOfBirth: "1990-01-02" },
      { ...UNO, lastName: "Halimbawang" },
      { ...UNO, firstName: "Dos" },
    ]) {
      await expect(c.findVoter(wrong)).rejects.toMatchObject({
        kind: "refused",
        message: NOT_ON_LIST,
        detail: { type: "checkin", code: "not-on-list" },
      });
    }
    expect(await c.checkin()).toBeNull();
  });

  it("serves 2 positions with 3 candidates each", async () => {
    const { c } = await signedIn();
    const e = await c.election();
    expect(e.status).toBe("open");
    expect(e.positions).toHaveLength(2);
    for (const p of e.positions) expect(p.candidates).toHaveLength(3);
  });

  it("enrols once, reporting every step, and stores the credential", async () => {
    const { c, store } = await signedIn();
    expect(await c.hasCredential()).toBe(false);
    const seen: string[] = [];
    const result = await c.enrol((s) => seen.push(`${s.index}:${s.state}`));
    // A memory store is honest about not surviving a reload.
    expect(result).toEqual({ persistent: false });
    expect(seen).toHaveLength(ENROL_STEPS.length * 2);
    expect(seen[seen.length - 1]).toBe(`${ENROL_STEPS.length - 1}:done`);
    expect(await c.hasCredential()).toBe(true);
    expect(await store.get(keys.credential(PHONE_SCOPE))).toBeTruthy();
    // The check-in moved on: the one credential for this entry is issued.
    expect((await c.checkin())?.state).toBe("credential_issued");
  });

  it("encrypts with BC tracking codes and submits one receipt per position", async () => {
    const { c } = await signedIn();
    const b = await c.encrypt(choices);
    expect(b.positions.map((p) => p.positionId)).toEqual([
      "president",
      "vice-president",
    ]);
    for (const p of b.positions) {
      expect(p.trackingCode).toMatch(TRACKING_CODE);
      expect(p.fingerprint).toMatch(FINGERPRINT);
    }
    const progress: number[] = [];
    const receipts = await c.submit(b, (r) => progress.push(r.block));
    expect(receipts).toHaveLength(2);
    expect(progress).toEqual(receipts.map((r) => r.block));
    expect(receipts[1]!.block).toBeGreaterThan(receipts[0]!.block);
    expect(receipts[0]!.txId).toMatch(/^[0-9a-f]{64}$/);
    expect(receipts.map((r) => r.fingerprint)).toEqual(
      b.positions.map((p) => p.fingerprint),
    );
    expect(await c.receipts()).toEqual(receipts);
    const found = await c.lookup(receipts[0]!.trackingCode);
    expect(found).toMatchObject({ recorded: true, positionTitle: "President" });
  });

  it("refuses to submit a challenged ballot, and the opened check matches", async () => {
    const { c } = await signedIn();
    const b = await c.encrypt(choices);
    const results = await c.challenge(b);
    expect(results.map((r) => [r.candidateId, r.matches])).toEqual([
      ["p-b", true],
      ["v-c", true],
    ]);
    expect(results.map((r) => r.fingerprint)).toEqual(
      b.positions.map((p) => p.fingerprint),
    );
    expect(results.map((r) => r.checkedPositionId)).toEqual([
      "president",
      "vice-president",
    ]);
    await expect(c.submit(b, () => {})).rejects.toMatchObject({
      kind: "refused",
    });
  });

  it("produces hex tracking codes, like the nullifier prefix", async () => {
    for (let i = 0; i < 20; i++) {
      for (const pos of ["president", "vice-president"]) {
        expect(mockTrackingCode(`voter${i}`, pos)).toMatch(
          /^BC-[0-9A-F]{4}-[0-9A-F]{4}$/,
        );
      }
    }
    for (const code of MOCK_BOARD_CODES) expect(code).toMatch(TRACKING_CODE);
  });

  it("keeps a voter's tracking codes across ballots, with a new fingerprint each time", async () => {
    const { c } = await signedIn();
    const a = await c.encrypt(choices);
    const b = await c.encrypt(choices);
    expect(b.positions.map((p) => p.trackingCode)).toEqual(
      a.positions.map((p) => p.trackingCode),
    );
    expect(a.positions[0]!.trackingCode).not.toBe(a.positions[1]!.trackingCode);
    for (let i = 0; i < 2; i++) {
      expect(b.positions[i]!.fingerprint).not.toBe(a.positions[i]!.fingerprint);
    }
  });

  it("when tampering, misreports the checked fingerprint or position", async () => {
    const fp = await signedIn({ tamper: "fingerprint" });
    const b = await fp.c.encrypt(choices);
    const r = await fp.c.challenge(b);
    expect(r[0]!.fingerprint).not.toBe(b.positions[0]!.fingerprint);
    expect(r[0]!.fingerprint).toMatch(FINGERPRINT);
    expect(r[1]!.fingerprint).toBe(b.positions[1]!.fingerprint);

    const pos = await signedIn({ tamper: "position" });
    const r2 = await pos.c.challenge(await pos.c.encrypt(choices));
    expect(r2[0]!.checkedPositionId).toBe("vice-president");
    expect(r2[0]!.positionId).toBe("president");
  });

  it("when tampering, opens a different candidate that still rebuilds", async () => {
    const { c } = await signedIn({ tamper: true });
    const results = await c.challenge(await c.encrypt(choices));
    expect(results[0]).toMatchObject({ matches: true });
    expect(results[0]!.candidateId).not.toBe("p-b");
    expect(results[1]).toMatchObject({ candidateId: "v-c", matches: true });
    // Only the next encryption is tampered.
    const again = await c.challenge(await c.encrypt(choices));
    expect(again[0]!.candidateId).toBe("p-b");
  });

  it("refuses a second ballot from the same voter", async () => {
    const { c } = await signedIn();
    await c.submit(await c.encrypt(choices), () => {});
    await expect(c.encrypt(choices)).rejects.toMatchObject({
      kind: "already-voted",
    });
  });

  it("opens by itself after opensAfterMs (?opens=N)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const c = new MockLiveClient({ speed: 0, opensAfterMs: 5000 });
      expect((await c.election()).status).toBe("setup");
      vi.setSystemTime(Date.now() + 5000);
      expect((await c.election()).status).toBe("open");
      expect(mockOptionsFromQuery("?opens=8").opensAfterMs).toBe(8000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses to encrypt when the election is closed", async () => {
    const { c } = await signedIn({ status: "closed" });
    await expect(c.encrypt(choices)).rejects.toMatchObject({ kind: "closed" });
  });

  it("fails once on request, then recovers", async () => {
    const { c } = await signedIn({ failOnce: ["election"] });
    await expect(c.election()).rejects.toMatchObject({ kind: "network" });
    await expect(c.election()).resolves.toMatchObject({ id: "live-mock" });
  });

  it("looks up seeded and unknown codes; counted only after the tally", async () => {
    const c = new MockLiveClient({ speed: 0, status: "tallied" });
    expect(await c.lookup(MOCK_BOARD_CODES[0])).toMatchObject({
      recorded: true,
      counted: true,
    });
    expect(await c.lookup("BC-0000-0000")).toMatchObject({
      recorded: false,
      counted: false,
    });
  });
});

describe("MockLiveClient check-in (voter-list-api.md)", () => {
  function phone(opts = {}) {
    return new MockLiveClient({
      speed: 0,
      store: memoryStore(),
      desk: "manual",
      ...opts,
    });
  }

  it("finds a name in the list's match form: no accents, any case, hyphen or not", async () => {
    const c = phone();
    const found = await c.findVoter({
      lastName: "  pena ",
      firstName: "DOS",
      dateOfBirth: "1991-02-02",
    });
    expect(found).toEqual({
      precinctLabel: "Precinct 0001A (demonstration)",
      entry: {
        seq: 2,
        lastName: "Peña",
        firstName: "Dos",
        middleName: "Santos-Reyes",
      },
    });
    // Finding changes nothing.
    expect(await c.checkin()).toBeNull();
  });

  it("walks the states: declare, the desk, the signature, then the credential", async () => {
    const c = phone();
    expect(await c.declare(UNO)).toMatchObject({
      state: "at_desk",
      entry: { seq: 1 },
    });
    expect((await c.checkin())?.state).toBe("at_desk");
    // Not approved yet: the list cannot be signed.
    await expect(c.signList({ cannotSign: true })).rejects.toMatchObject({
      kind: "auth",
    });
    await c.approve();
    expect((await c.checkin())?.state).toBe("approved");
    expect(await c.signList({ strokes: [[[1, 2]]] })).toMatchObject({
      state: "signed",
    });
    expect(c.lastSignature).toEqual({ strokes: [[[1, 2]]] });
    await c.enrol(() => {});
    expect((await c.checkin())?.state).toBe("credential_issued");
    // Never a second credential for the entry.
    await expect(c.enrol(() => {})).rejects.toMatchObject({
      detail: { type: "already-issued" },
    });
  });

  it("refuses a second declaration while one is in progress, and a name already checked in", async () => {
    const c = phone({ checkedInElsewhere: [3] });
    await c.declare(UNO);
    await expect(c.declare(UNO)).rejects.toMatchObject({
      message: CHECKIN_IN_PROGRESS,
    });
    await expect(
      c.findVoter({
        lastName: "Sampol",
        firstName: "Tres",
        dateOfBirth: "1992-03-03",
      }),
    ).rejects.toMatchObject({ message: ALREADY_CHECKED_IN });
  });

  it("ends the check-in on a refusal or a reset, and lets the phone check in again", async () => {
    const c = phone();
    await c.declare(UNO);
    await c.refuse();
    expect(await c.checkin()).toMatchObject({ state: "refused" });
    expect((await c.checkin())?.entry).toBeUndefined();
    await c.declare(UNO);
    await c.approve();
    await c.resetCheckin();
    expect(await c.checkin()).toMatchObject({ state: "reset" });
    expect((await c.declare(UNO)).state).toBe("at_desk");
  });

  it("approves by itself with the automatic desk", async () => {
    const c = new MockLiveClient({ speed: 0, store: memoryStore() });
    await c.declare(UNO);
    expect((await c.checkin())?.state).toBe("approved");
  });

  it("binds the check-in to its election", async () => {
    const store = memoryStore();
    await new MockLiveClient({ speed: 0, store, desk: "manual" }).declare(UNO);
    const next = new MockLiveClient({ speed: 0, store, electionId: "next" });
    expect(await next.checkin()).toBeNull();
  });

  it("checks in only while voting is open, and not at all without a list", async () => {
    await expect(
      phone({ status: "setup" }).findVoter(UNO),
    ).rejects.toMatchObject({ kind: "not-open" });
    await expect(phone({ voterList: false }).checkin()).rejects.toMatchObject({
      detail: { type: "no-voter-list" },
    });
    expect((await phone({ voterList: false }).election()).precinctLabel).toBe(
      undefined,
    );
  });

  it("stores no date of birth and no name on the phone", async () => {
    const store = memoryStore();
    const writes: unknown[] = [];
    const spy: typeof store = {
      ...store,
      async set<T>(key: string, value: T) {
        writes.push([key, value]);
        await store.set(key, value);
      },
    };
    const c = new MockLiveClient({ speed: 0, store: spy, desk: "manual" });
    await c.findVoter(UNO);
    await c.declare(UNO);
    const text = JSON.stringify(writes);
    expect(text).not.toContain("1990-01-01");
    expect(text).not.toContain("Halimbawa");
  });
});

describe("client selection and helpers", () => {
  it("parses mock options from the query string", () => {
    expect(
      mockOptionsFromQuery("?mock=1&status=closed&fail=submit,bogus&speed=0"),
    ).toEqual({ status: "closed", failOnce: ["submit"], speed: 0 });
    expect(mockOptionsFromQuery("?mock=1&tamper=1")).toEqual({ tamper: true });
    expect(mockOptionsFromQuery("?mock=1&tamper=fingerprint")).toEqual({
      tamper: "fingerprint",
    });
    expect(mockOptionsFromQuery("?status=weird")).toEqual({});
  });

  it("?names=long serves the longest ids D19 allows, shown hyphens as spaces", () => {
    const { positions } = mockOptionsFromQuery("?mock=1&names=long");
    const LONG_NAME_POSITIONS = longNamePositions();
    expect(positions).toEqual(LONG_NAME_POSITIONS);
    const ids = LONG_NAME_POSITIONS.map((p) => p.id);
    expect(ids.map((id) => id.length)).toEqual([64, 64]);
    // One with hyphens, one a single unbroken word.
    expect(ids[0]).toContain("-");
    expect(ids[1]).not.toContain("-");
    expect(LONG_NAME_POSITIONS[0]!.title).toBe(
      "Chairperson of the Student Council Committee on Rules and Ethics",
    );
    expect(LONG_NAME_POSITIONS[0]!.candidates[0]).toEqual({
      id: "Juan-P.-Dela-Cruz",
      name: "Juan P. Dela Cruz",
    });
    expect(LONG_NAME_POSITIONS[1]!.candidates[2]!.id).toHaveLength(64);
  });

  describe("which client a build picks", () => {
    afterEach(() => vi.unstubAllEnvs());
    /** A production build with no flags: what tools/build-web.sh ships. */
    function shippedBuild() {
      vi.stubEnv("DEV", false);
      vi.stubEnv("VITE_LIVE_MOCK", "");
      vi.stubEnv("VITE_LIVE_MOCK_SWITCH", "");
      vi.stubEnv("VITE_LIVE_LOCAL", "");
    }

    it("ignores ?mock=1 and tamper=1 in the shipped build", () => {
      shippedBuild();
      const s = selectClient("?mock=1&tamper=1");
      expect(s.client).toBeInstanceOf(RealLiveClient);
      expect(s.mock).toBe(false);
    });

    it("honours ?mock=1 with VITE_LIVE_MOCK_SWITCH=1, and only with it", () => {
      shippedBuild();
      vi.stubEnv("VITE_LIVE_MOCK_SWITCH", "1");
      const s = selectClient("?mock=1&tamper=1");
      expect(s.client).toBeInstanceOf(MockLiveClient);
      expect(s.mock).toBe(true);
      expect(s.client.practice).toBe(true);
      expect(selectClient("").client).toBeInstanceOf(RealLiveClient);
      expect(selectClient("?mock=0").client).toBeInstanceOf(RealLiveClient);
    });

    it("honours ?mock=1 on the dev server", () => {
      shippedBuild();
      vi.stubEnv("DEV", true);
      expect(selectClient("?mock=1").client).toBeInstanceOf(MockLiveClient);
      expect(selectClient("").client).toBeInstanceOf(RealLiveClient);
    });

    it("always runs the mock in a VITE_LIVE_MOCK=1 build", () => {
      shippedBuild();
      vi.stubEnv("VITE_LIVE_MOCK", "1");
      expect(selectClient("").client).toBeInstanceOf(MockLiveClient);
      expect(selectClient("").mock).toBe(true);
    });
  });

  it("the real client asks the console over HTTP by default", async () => {
    // http-api.md, GET /api/live/election: "404 before any setup".
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: "no live election has been set up" }),
          { status: 404 },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    try {
      await expect(new RealLiveClient().election()).rejects.toMatchObject({
        kind: "not-open",
      });
      expect(fetch).toHaveBeenCalledWith(
        "/api/live/election",
        expect.objectContaining({ method: "GET", credentials: "omit" }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("normalises typed tracking codes", () => {
    expect(normaliseTrackingCode(" bc 7f3a 92e1 ")).toBe("BC-7F3A-92E1");
    expect(normaliseTrackingCode("7F3A92E1")).toBe("BC-7F3A-92E1");
    expect(normaliseTrackingCode("BC12-3456")).toBe("BC-BC12-3456");
    expect(normaliseTrackingCode("abc")).toBe("ABC");
  });
});
