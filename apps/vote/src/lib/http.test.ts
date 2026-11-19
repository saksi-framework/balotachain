// @vitest-environment node
/**
 * HttpTransport over a stubbed `fetch`. Request and response shapes are
 * from saksi `docs/live/http-api.md` at `25cbafd`; each test names the
 * section it took them from.
 */
import { describe, expect, it, vi } from "vitest";
import fixture from "../test/fixture/live-election.json";
import { fakeConsole, fingerprintOf, json } from "../test/fakeConsole";
import {
  ALREADY_ISSUED,
  AMBIGUOUS_CODE,
  ERROR_TABLE,
  errorRow,
  HttpTransport,
  ISSUANCE_BUSY,
  ISSUANCE_RELOAD,
  issuanceHeldHere,
  PATHS,
  STATE_MAP,
  withIssuanceLock,
  type Failure,
  type Route,
} from "./http";
import {
  ALREADY_CHECKED_IN,
  BAD_DATE,
  BAD_SIGNATURE,
  CHECKIN_ENDED,
  CHECKIN_IN_PROGRESS,
  NAME_TOO_LONG,
  NO_VOTER_LIST,
  NOT_ON_LIST,
  rateLimited,
} from "./checkin";
import { LiveError } from "./live";

/** A phone that checked in as the list's first voter and signed the list. */
const SIGNED = { checkin: { seq: 1, state: "signed" as const } };

const UNO = {
  lastName: "Halimbawa",
  firstName: "Uno",
  dateOfBirth: "1990-01-01",
};

const BALLOT = "0a0b0c0d";
const SHOWN = {
  trackingCode: "BC-7F3A-92C1",
  fingerprint: fingerprintOf(BALLOT),
};

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

/** A fetch that answers each call with the next handler, and records it. */
function scripted(...handlers: Handler[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const h = handlers.shift();
    if (!h) throw new Error(`unexpected request ${url}`);
    return h(url, init ?? {});
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

function transport(f: typeof globalThis.fetch, extra = {}) {
  return new HttpTransport({
    fetch: f,
    locks: null,
    sleep: async () => {},
    ...extra,
  });
}

/** A recorded ballot's answer (http-api.md, POST /api/live/ballot). */
function recordedAnswer(over: Record<string, unknown> = {}) {
  return json(200, {
    election_id: "vote-fixture",
    position_id: "president",
    nullifier: "7f3a92c1" + "00".repeat(28),
    tracking_code: SHOWN.trackingCode,
    ballot_fingerprint: SHOWN.fingerprint,
    tx_id: "ab".repeat(32),
    block_number: 395,
    recorded_bytes_match: true,
    ...over,
  });
}

/** GET /api/live/election (http-api.md, Public), in a given state. */
function electionAnswer(state = "open") {
  return json(200, {
    run_id: "live-20261114-075259-1ced8307",
    election_id: "vote-fixture",
    title: "Student council 2026",
    state,
    positions: fixture.positions,
    trustees: 3,
    threshold: 2,
    params: fixture.params,
    issuer_public_key: fixture.issuer_public_key,
    dkg: fixture.dkg,
    joint_key_fingerprint: fixture.joint_key_fingerprint,
  });
}

async function failure(p: Promise<unknown>): Promise<LiveError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof LiveError) return e;
    throw e;
  }
  throw new Error("expected a LiveError");
}

/** Start an issuance and run `fn` inside its lock. */
function issuing<T>(t: HttpTransport, fn: () => Promise<T>) {
  return t.exclusiveIssuance(fn);
}

describe("routes", () => {
  it("finds a name, declares with the cookie the console sets, and polls the check-in", async () => {
    // voter-list-api.md: find, declare, GET /api/live/checkin.
    const c = fakeConsole({});
    const t = transport(c.fetch);
    expect(await t.checkin()).toBeNull();
    expect(await t.findVoter({ ...UNO, lastName: "  halimbawa " })).toEqual({
      precinctLabel: "Precinct 0001A (demonstration)",
      entry: {
        seq: 1,
        lastName: "Halimbawa",
        firstName: "Uno",
        middleName: "Pagsubok",
      },
    });
    const find = c.calls.find((x) => x.url === PATHS.find)!;
    // Exactly the three fields (a strict body), the names trimmed.
    expect(find).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      body: {
        last_name: "halimbawa",
        first_name: "Uno",
        date_of_birth: "1990-01-01",
      },
    });
    expect(Object.keys(find.body as object).sort()).toEqual([
      "date_of_birth",
      "first_name",
      "last_name",
    ]);
    expect(await t.declare(UNO)).toEqual({
      state: "at_desk",
      electionId: "vote-fixture",
      precinctLabel: "Precinct 0001A (demonstration)",
      entry: {
        seq: 1,
        lastName: "Halimbawa",
        firstName: "Uno",
        middleName: "Pagsubok",
      },
    });
    const declare = c.calls.find((x) => x.url === PATHS.declare)!;
    expect(declare.body).toEqual({
      last_name: "Halimbawa",
      first_name: "Uno",
      date_of_birth: "1990-01-01",
      declaration: true,
    });
    // From here the cookie goes with every /api/live/ call made same-origin.
    expect((await t.checkin())?.state).toBe("at_desk");
    expect(c.calls[c.calls.length - 1]).toMatchObject({
      url: PATHS.checkin,
      method: "GET",
      credentials: "same-origin",
      session: "tok-1",
    });
    c.desk.approve();
    expect((await t.checkin())?.state).toBe("approved");
    expect(await t.signList({ cannotSign: true })).toMatchObject({
      state: "signed",
    });
    expect(c.desk.signature()).toEqual({ cannot_sign: true });
    c.desk.reset();
    expect(await t.checkin()).toEqual({
      state: "reset",
      electionId: "vote-fixture",
      precinctLabel: "Precinct 0001A (demonstration)",
    });
  });

  it("sends the signature as integer strokes and nothing else", async () => {
    const c = fakeConsole({ checkin: { seq: 2, state: "approved" } });
    const strokes: [number, number][][] = [
      [
        [120, 210],
        [124, 215],
      ],
      [[400, 180]],
    ];
    await transport(c.fetch).signList({ strokes });
    const sent = c.calls.find((x) => x.url === PATHS["checkin-sign"])!;
    expect(sent).toMatchObject({
      credentials: "same-origin",
      session: "tok-1",
    });
    expect(sent.body).toEqual({ strokes });
  });

  it("says each refusal of find and declare in its one sentence", async () => {
    const t = transport(fakeConsole({}).fetch);
    for (const wrong of [
      { ...UNO, dateOfBirth: "1990-01-02" },
      { ...UNO, firstName: "Una" },
    ]) {
      expect(await failure(t.findVoter(wrong))).toMatchObject({
        kind: "refused",
        message: NOT_ON_LIST,
        detail: { type: "checkin", code: "not-on-list" },
      });
    }
    const taken = fakeConsole({});
    taken.desk.checkInElsewhere(1);
    expect(await failure(transport(taken.fetch).declare(UNO))).toMatchObject({
      message: ALREADY_CHECKED_IN,
    });
    expect(
      await failure(t.findVoter({ ...UNO, dateOfBirth: "1990-1-1" })),
    ).toMatchObject({
      message: BAD_DATE,
      detail: { type: "checkin", code: "bad-date" },
    });
    const busy = fakeConsole({ checkin: { seq: 2, state: "approved" } });
    expect(await failure(transport(busy.fetch).declare(UNO))).toMatchObject({
      message: CHECKIN_IN_PROGRESS,
    });
  });

  it("reads 'no check-in', 'no election' and 'no voter list' apart", async () => {
    expect(await transport(fakeConsole({}).fetch).checkin()).toBeNull();
    expect(
      await failure(
        transport(fakeConsole({ noElection: true }).fetch).checkin(),
      ),
    ).toMatchObject({ kind: "not-open", detail: undefined });
    expect(
      await failure(
        transport(fakeConsole({ voterList: false }).fetch).checkin(),
      ),
    ).toMatchObject({
      message: NO_VOTER_LIST,
      detail: { type: "no-voter-list" },
    });
  });

  it("a cookie from the last election is no check-in in the next", async () => {
    const c = fakeConsole(SIGNED);
    const t = transport(c.fetch);
    expect((await t.checkin())?.state).toBe("signed");
    c.newElection("live-next");
    expect(await t.checkin()).toBeNull();
  });
  it("reads the election without the cookie and maps it for the client", async () => {
    // http-api.md, GET /api/live/election.
    const c = fakeConsole(SIGNED);
    const t = transport(c.fetch);
    expect(await t.election()).toEqual({
      title: "Student council 2026",
      status: "open",
      params: fixture.params,
      dkg: fixture.dkg,
      issuerPublicKey: fixture.issuer_public_key,
      electionId: "vote-fixture",
      runId: "live-20261114-075259-1ced8307",
      jointKeyFingerprint: fixture.joint_key_fingerprint,
      precinctLabel: "Precinct 0001A (demonstration)",
    });
    expect(c.calls[c.calls.length - 1]).toMatchObject({
      url: PATHS.election,
      method: "GET",
      credentials: "omit",
      session: null,
    });
  });

  it("maps every console state, and treats an election with no transcript as not open", async () => {
    // http-api.md, States.
    expect(STATE_MAP).toEqual({
      setup: "setup",
      ceremony: "setup",
      open: "open",
      closed: "closed",
      tallied: "tallied",
      verified: "tallied",
      abandoned: "setup",
    });
    for (const [state, status] of Object.entries(STATE_MAP)) {
      const c = fakeConsole({ state });
      expect((await transport(c.fetch).election()).status).toBe(status);
    }
    // "before the key ceremony finishes `dkg` is null" (absent in the view).
    const c = fakeConsole({ state: "ceremony", dkg: null });
    expect(await transport(c.fetch).election()).toMatchObject({
      status: "setup",
      dkg: null,
    });
    const bad = fakeConsole({ state: "paused" });
    expect(await failure(transport(bad.fetch).election())).toMatchObject({
      kind: "refused",
    });
  });

  it("presigns and signs once each, with the cookie, sending only blinded_commitment and e_prime", async () => {
    // http-api.md, POST /api/live/issue/presign and sign.
    const c = fakeConsole({
      ...SIGNED,
      presign: () => ({
        r: "r1",
        issuer_public_key: fixture.issuer_public_key,
      }),
      sign: () => ({
        s_iss: "s1",
        issuer_public_key: fixture.issuer_public_key,
      }),
    });
    const t = transport(c.fetch);
    await t.election();
    const out = await issuing(t, async () => {
      const { r } = await t.issuePresign("bc");
      const { sIss } = await t.issueSign("ep");
      return { r, sIss };
    });
    expect(out).toEqual({ r: "r1", sIss: "s1" });
    const issue = c.calls.filter((x) => x.url.includes("/issue/"));
    expect(issue).toMatchObject([
      {
        url: PATHS.presign,
        method: "POST",
        credentials: "same-origin",
        session: "tok-1",
        body: { blinded_commitment: "bc" },
      },
      {
        url: PATHS.sign,
        method: "POST",
        credentials: "same-origin",
        session: "tok-1",
        body: { e_prime: "ep" },
      },
    ]);
  });

  it("never calls sign twice, not even after a network error on the first", async () => {
    // http-api.md, sign: "Never retry `sign`".
    let signs = 0;
    const c = fakeConsole({
      ...SIGNED,
      presign: () => ({
        r: "r1",
        issuer_public_key: fixture.issuer_public_key,
      }),
      sign: () => {
        signs++;
        return new Response("upstream gone", { status: 502 });
      },
    });
    const t = transport(c.fetch);
    await t.election();
    await issuing(t, async () => {
      await t.issuePresign("bc");
      expect((await failure(t.issueSign("ep"))).kind).toBe("network");
      // A second sign in the same issuance is refused here, unsent.
      expect((await failure(t.issueSign("ep"))).kind).toBe("refused");
    });
    expect(signs).toBe(1);
    // A sign outside any issuance is refused unsent too.
    expect((await failure(t.issueSign("ep"))).kind).toBe("refused");
    expect(signs).toBe(1);
    // And so is presign outside the lock.
    expect((await failure(t.issuePresign("bc"))).kind).toBe("refused");
  });

  it("presign 409 while open: the voter already has its credential, no retry offered", async () => {
    // voter-list-api.md, issuance: 409 `already-issued`.
    const c = fakeConsole(SIGNED);
    const t = transport(c.fetch);
    const e = await issuing(t, () => failure(t.issuePresign("bc")));
    expect(e).toMatchObject({
      kind: "refused",
      message: ALREADY_ISSUED,
      detail: { type: "already-issued" },
    });
    expect(c.calls.filter((x) => x.url === PATHS.sign)).toHaveLength(0);
  });

  it("presign 409 before the election opens is not-open, after it closes closed", async () => {
    // http-api.md, Rules: "Issuance is open only in state `open`".
    for (const [state, kind] of [
      ["ceremony", "not-open"],
      ["closed", "closed"],
    ] as const) {
      const c = fakeConsole({ ...SIGNED, state });
      const t = transport(c.fetch);
      const e = await issuing(t, () => failure(t.issuePresign("bc")));
      expect(e.kind).toBe(kind);
    }
  });

  it("stops before sign when presign names another issuer key", async () => {
    // http-api.md, presign answer: {"r", "issuer_public_key"}.
    const c = fakeConsole({
      ...SIGNED,
      presign: () => ({ r: "r1", issuer_public_key: "ff".repeat(32) }),
      sign: () => ({ s_iss: "s1", issuer_public_key: "ff".repeat(32) }),
    });
    const t = transport(c.fetch);
    await t.election();
    await issuing(t, async () => {
      expect((await failure(t.issuePresign("bc"))).kind).toBe("refused");
      expect((await failure(t.issueSign("ep"))).kind).toBe("refused");
    });
    expect(c.calls.filter((x) => x.url === PATHS.sign)).toHaveLength(0);
  });

  it("posts the ballot with no cookie, no account and nothing but the hex", async () => {
    // http-api.md, POST /api/live/ballot: "Same origin, no cookie".
    const { fetch, calls } = scripted(() => recordedAnswer());
    const t = transport(fetch);
    expect(await t.submitBallot("president", BALLOT, SHOWN)).toEqual({
      txId: "ab".repeat(32),
      block: 395,
    });
    const { url, init } = calls[0]!;
    expect(url).toBe(PATHS.ballot);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    // Exactly the one field, the hex byte for byte.
    expect(init.body).toBe(JSON.stringify({ ballot: BALLOT }));
    expect(init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("a ballot carries no cookie even while the phone holds a check-in", async () => {
    const c = fakeConsole(SIGNED);
    c.expect.push({
      positionId: "president",
      trackingCode: SHOWN.trackingCode,
    });
    const t = transport(c.fetch);
    await t.election();
    await t.submitBallot("president", BALLOT, SHOWN);
    const post = c.calls.find((x) => x.url === PATHS.ballot)!;
    expect(post.session).toBeNull();
    expect(post.body).toEqual({ ballot: BALLOT });
    expect(post.credentials).toBe("omit");
    expect(JSON.stringify(post)).not.toContain("tok-1");
  });

  it("raises the alarm on another fingerprint, another tracking code, or recorded_bytes_match false", async () => {
    // http-api.md, POST /api/live/ballot: "The phone compares
    // `ballot_fingerprint` with the one it showed before cast".
    for (const over of [
      { ballot_fingerprint: fingerprintOf("ff") },
      { tracking_code: "BC-0000-0000" },
      { recorded_bytes_match: false },
      { recorded_bytes_match: undefined },
      { position_id: "vice-president" },
    ]) {
      const { fetch, calls } = scripted(() => recordedAnswer(over));
      const e = await failure(
        transport(fetch).submitBallot("president", BALLOT, SHOWN),
      );
      expect(e.kind).toBe("refused");
      expect(e.detail).toMatchObject({
        type: "record-mismatch",
        positionId: "president",
        shown: SHOWN,
        recorded: { txId: "ab".repeat(32), block: 395 },
      });
      // Nothing resent.
      expect(calls).toHaveLength(1);
    }
    const { fetch } = scripted(() =>
      recordedAnswer({ recorded_bytes_match: false }),
    );
    const e = await failure(
      transport(fetch).submitBallot("president", BALLOT, SHOWN),
    );
    expect(e.detail).toMatchObject({
      recorded: {
        recordedFingerprint: SHOWN.fingerprint,
        recordedTrackingCode: SHOWN.trackingCode,
        recordedBytesMatch: false,
      },
    });
  });

  it("waits for Retry-After on a 429 and resends, then gives up as network", async () => {
    // http-api.md, Anonymity: "429 with `Retry-After`".
    const busy = () =>
      json(429, { error: "too many ballots" }, { "Retry-After": "1" });
    const sleep = vi.fn(async () => {});
    const ok = scripted(busy, () => recordedAnswer());
    await transport(ok.fetch, { sleep }).submitBallot(
      "president",
      BALLOT,
      SHOWN,
    );
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(ok.calls).toHaveLength(2);

    const never = scripted(busy, busy, busy, busy);
    const e = await failure(
      transport(never.fetch).submitBallot("president", BALLOT, SHOWN),
    );
    expect(e).toMatchObject({
      kind: "network",
      detail: { type: "rate-limited", retryAfterSeconds: 1 },
    });
    expect(never.calls).toHaveLength(4);
  });

  it("after a lost answer, a nullifier refusal for the same ballot is recovered from the board only when it is this ballot", async () => {
    // http-api.md: 422 gate `nullifier`; GET /api/verify-code adds
    // `ballot_fingerprint` on a live run.
    const refused = () =>
      json(422, {
        error: "SubmitBallot was refused by the chain",
        refused: true,
        gate: "nullifier",
        reason: "nullifier already spent",
      });
    const board = (fp: string) => () =>
      json(200, {
        found: true,
        tracking_code: SHOWN.trackingCode,
        position_id: "president",
        ballot_fingerprint: fp,
        tx_id: "cd".repeat(32),
        block_number: 400,
        committed_on_chain: true,
      });
    const ours = scripted(
      () => new Response("bad gateway", { status: 502 }),
      refused,
      () => electionAnswer(),
      board(SHOWN.fingerprint),
    );
    const t = transport(ours.fetch);
    await failure(t.submitBallot("president", BALLOT, SHOWN));
    expect(await t.submitBallot("president", BALLOT, SHOWN)).toEqual({
      txId: "cd".repeat(32),
      block: 400,
    });
    expect(ours.calls[3]!.url).toBe(
      "/api/verify-code/live-20261114-075259-1ced8307/BC-7F3A-92C1",
    );
    expect(ours.calls[3]!.init.credentials).toBe("omit");

    const theirs = scripted(
      () => new Response("bad gateway", { status: 502 }),
      refused,
      () => electionAnswer(),
      board(fingerprintOf("ff")),
    );
    const t2 = transport(theirs.fetch);
    await failure(t2.submitBallot("president", BALLOT, SHOWN));
    expect(
      (await failure(t2.submitBallot("president", BALLOT, SHOWN))).kind,
    ).toBe("already-voted");
  });

  it("a 2xx ballot answer cut off in the body is network; the flagged resend is Recorded only through the board (I4 ruling)", async () => {
    const cutOff = () => {
      const r = new Response("{}", { status: 200 });
      Object.defineProperty(r, "text", {
        value: () => Promise.reject(new TypeError("body stream cut off")),
      });
      return r;
    };
    const refused = () =>
      json(422, {
        error: "SubmitBallot was refused by the chain",
        refused: true,
        gate: "nullifier",
        reason: "nullifier already spent",
      });
    const board = (fp: string) => () =>
      json(200, {
        found: true,
        tracking_code: SHOWN.trackingCode,
        position_id: "president",
        ballot_fingerprint: fp,
        tx_id: "cd".repeat(32),
        block_number: 400,
        committed_on_chain: true,
      });
    // The first send: the answer is cut off, so the outcome is unknown.
    const first = scripted(cutOff);
    const e = await failure(
      transport(first.fetch).submitBallot("president", BALLOT, SHOWN),
    );
    expect(e.kind).toBe("network");
    expect(e.detail).toBeUndefined();

    // After a reload (a new transport), the same bytes, flagged as a resend.
    const ours = scripted(
      refused,
      () => electionAnswer(),
      board(SHOWN.fingerprint),
    );
    expect(
      await transport(ours.fetch).submitBallot("president", BALLOT, SHOWN, {
        resend: true,
      }),
    ).toEqual({ txId: "cd".repeat(32), block: 400 });
    // Not this ballot on the board: never Recorded.
    const theirs = scripted(
      refused,
      () => electionAnswer(),
      board(fingerprintOf("ff")),
    );
    expect(
      (
        await failure(
          transport(theirs.fetch).submitBallot("president", BALLOT, SHOWN, {
            resend: true,
          }),
        )
      ).kind,
    ).toBe("already-voted");
    // Unflagged, the same refusal is not looked up on the board at all.
    const unflagged = scripted(refused);
    expect(
      (
        await failure(
          transport(unflagged.fetch).submitBallot("president", BALLOT, SHOWN),
        )
      ).kind,
    ).toBe("already-voted");
    expect(unflagged.calls).toHaveLength(1);
  });

  it("looks a tracking code up through the board's verify-code route", async () => {
    // http-api.md, The bulletin board on a live run: verify-code.
    const c = fakeConsole();
    c.expect.push({
      positionId: "president",
      trackingCode: SHOWN.trackingCode,
    });
    const t = transport(c.fetch);
    await t.election();
    await t.submitBallot("president", BALLOT, SHOWN);
    c.view.state = "verified";
    expect(await t.lookup(SHOWN.trackingCode)).toEqual({
      trackingCode: SHOWN.trackingCode,
      recorded: true,
      counted: true,
      positionTitle: "president",
      fingerprint: SHOWN.fingerprint,
    });
    expect(await t.lookup("BC-0000-0000")).toEqual({
      trackingCode: "BC-0000-0000",
      recorded: false,
      counted: false,
    });
    const vc = c.calls.filter((x) => x.url.startsWith("/api/verify-code/"));
    expect(vc.every((x) => x.credentials === "omit")).toBe(true);
  });

  it("times out every request as a network failure", async () => {
    const hang: Handler = (_u, init) =>
      new Promise((_r, reject) =>
        init.signal!.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        ),
      );
    const { fetch } = scripted(hang);
    const e = await failure(
      transport(fetch, { timeouts: { ballot: 20 } }).submitBallot(
        "president",
        BALLOT,
        SHOWN,
      ),
    );
    expect(e.kind).toBe("network");
    expect(e.message).toContain("did not answer");
  });
});

describe("fix round 1", () => {
  const conflict = (error: string) => () => json(409, { error });

  it("a presign 409 that names a state wins over a re-read that says open", async () => {
    // live_issue.go checkIssuable: "credentials are issued while the
    // election is open; it is %s".
    for (const [state, kind] of [
      ["closed", "closed"],
      ["ceremony", "not-open"],
      ["tallied", "closed"],
    ] as const) {
      const { fetch } = scripted(
        conflict(
          `credentials are issued while the election is open; it is ${state}`,
        ),
        () => electionAnswer("open"),
      );
      const t = transport(fetch);
      const e = await issuing(t, () => failure(t.issuePresign("bc")));
      expect(e.kind).toBe(kind);
    }
  });

  it("a 409 saying the account was issued is ALREADY_ISSUED, on presign and on sign, whatever the re-read says", async () => {
    const issued = conflict(
      "this account has been issued its credential for this election already; a lost credential cannot be issued again",
    );
    const p = scripted(issued, () => electionAnswer("ceremony"));
    const tp = transport(p.fetch);
    expect(
      await issuing(tp, () => failure(tp.issuePresign("bc"))),
    ).toMatchObject({
      kind: "refused",
      message: ALREADY_ISSUED,
      detail: { type: "already-issued" },
    });
    const s = scripted(
      () => json(200, { r: "r", issuer_public_key: fixture.issuer_public_key }),
      issued,
      () => electionAnswer("open"),
    );
    const ts = transport(s.fetch);
    const e = await issuing(ts, async () => {
      await ts.issuePresign("bc");
      return failure(ts.issueSign("ep"));
    });
    expect(e).toMatchObject({ kind: "refused", message: ALREADY_ISSUED });
  });

  it("ALREADY_ISSUED sends the voter to the Electoral Board without promising a spare (I2)", () => {
    // The phone cannot tell a voter who voted from one who lost a phone
    // before voting, and there is no replacement after issuance (decision 5).
    expect(ALREADY_ISSUED).toBe(
      "This voter's credential was already issued for this election, to this phone or to one that lost it. A credential is issued only once per voter, so this phone cannot get one. See the Electoral Board.",
    );
    expect(ALREADY_ISSUED).not.toMatch(/spare/);
  });

  it("the generic sign 409 message does not promise a spare account", async () => {
    const { fetch } = scripted(
      () => json(200, { r: "r", issuer_public_key: fixture.issuer_public_key }),
      conflict("credential already issued"),
      () => electionAnswer("open"),
    );
    const t = transport(fetch);
    const e = await issuing(t, async () => {
      await t.issuePresign("bc");
      return failure(t.issueSign("ep"));
    });
    expect(e).toMatchObject({ kind: "refused" });
    expect(e.message).not.toMatch(/spare/);
  });

  it("a sign 409 for a missing or expired session says reload, not a spare account", async () => {
    // live_issue.go sign: "no issuance session is open for this account;
    // start again with presign" and "the issuance session expired; …".
    for (const text of [
      "no issuance session is open for this account; start again with presign",
      "the issuance session expired; start again with presign",
    ]) {
      const { fetch } = scripted(
        () =>
          json(200, { r: "r", issuer_public_key: fixture.issuer_public_key }),
        conflict(text),
        () => electionAnswer("open"),
      );
      const t = transport(fetch);
      const e = await issuing(t, async () => {
        await t.issuePresign("bc");
        return failure(t.issueSign("ep"));
      });
      expect(e).toMatchObject({ kind: "refused", message: ISSUANCE_RELOAD });
      expect(e.message).not.toContain("spare");
    }
  });

  it("a 409 with an unknown text falls back to the state re-read", async () => {
    const { fetch } = scripted(conflict("something else"), () =>
      electionAnswer("ceremony"),
    );
    const t = transport(fetch);
    expect((await issuing(t, () => failure(t.issuePresign("bc")))).kind).toBe(
      "not-open",
    );
  });

  it("presign and sign 403 `no-checkin` (no check-in, or the Board ended it) route as auth: the check-in is read again", async () => {
    // voter-list-api.md, issuance: "a signed-in account of any role changes
    // nothing". The stand-in phone has no check-in cookie.
    const c = fakeConsole({});
    const t = transport(c.fetch);
    expect(await issuing(t, () => failure(t.issuePresign("bc")))).toMatchObject(
      { kind: "auth", message: CHECKIN_ENDED },
    );
    // The presenter reset the entry while the phone signed: the same.
    const r = fakeConsole({ checkin: { seq: 1, state: "approved" } });
    r.desk.reset();
    expect(
      await failure(transport(r.fetch).signList({ cannotSign: true })),
    ).toMatchObject({ kind: "auth", message: CHECKIN_ENDED });
  });

  it("adds 'Try again in N s' only when Retry-After was sent", async () => {
    // live_issue.go presign: errTooMany, sent with no Retry-After.
    const none = scripted(() =>
      json(429, {
        error:
          "too many credential issuances are open at once; try again in a few minutes",
      }),
    );
    const t = transport(none.fetch);
    const e = await issuing(t, () => failure(t.issuePresign("bc")));
    expect(e).toMatchObject({
      kind: "network",
      message:
        "too many credential issuances are open at once; try again in a few minutes",
    });
    const some = scripted(() =>
      json(
        429,
        { error: "too many issuances", code: "rate-limited" },
        {
          "Retry-After": "12",
        },
      ),
    );
    const ts = transport(some.fetch);
    expect(
      (await issuing(ts, () => failure(ts.issuePresign("bc")))).message,
    ).toBe("too many issuances Try again in 12 s.");
    // Check-in (voter-list-api.md, Rate limit): the page's own sentence,
    // with the console's wait when it states one.
    for (const [headers, seconds] of [
      [{ "Retry-After": "12" }, 12],
      [undefined, null],
    ] as const) {
      const c = fakeConsole({
        checkinAnswer: () =>
          json(429, { error: "slow down", code: "rate-limited" }, headers),
      });
      expect(await failure(transport(c.fetch).findVoter(UNO))).toMatchObject({
        kind: "refused",
        message: rateLimited(seconds),
      });
    }
  });

  it("an unreadable or empty 2xx ballot answer is an alarm, not a refusal", async () => {
    for (const res of [
      () => new Response("<html>ok</html>", { status: 200 }),
      () => new Response(null, { status: 204 }),
      () => new Response("", { status: 201 }),
    ]) {
      const { fetch, calls } = scripted(res);
      const e = await failure(
        transport(fetch).submitBallot("president", BALLOT, SHOWN),
      );
      expect(e.detail).toMatchObject({
        type: "record-mismatch",
        shown: SHOWN,
        recorded: { recordedFingerprint: "", recordedBytesMatch: false },
      });
      expect(calls).toHaveLength(1);
    }
  });

  it("an unknown 4xx is refused, an unknown 5xx stays network", async () => {
    for (const [status, kind] of [
      [405, "refused"],
      [418, "refused"],
      [507, "network"],
    ] as const) {
      const { fetch } = scripted(() => json(status, { error: "x" }));
      expect(
        (
          await failure(
            transport(fetch).submitBallot("president", BALLOT, SHOWN),
          )
        ).kind,
      ).toBe(kind);
    }
  });
});

describe("the issuance lock", () => {
  it("refuses a second issuance on this page while one runs", async () => {
    let release!: () => void;
    const first = withIssuanceLock(
      null,
      () => new Promise<void>((r) => (release = r)),
    );
    expect(await failure(withIssuanceLock(null, async () => {}))).toMatchObject(
      {
        kind: "refused",
        message: ISSUANCE_BUSY,
      },
    );
    release();
    await first;
    await withIssuanceLock(null, async () => {});
  });

  it("keeps the Web Lock and the page flag held while presign and sign are sent", async () => {
    // A fake Web Lock that is held until the callback's promise settles,
    // as the Web Locks API holds it.
    let held = false;
    const locks = {
      request: async (
        _name: string,
        _opts: LockOptions,
        cb: (l: Lock | null) => unknown,
      ) => {
        held = true;
        try {
          return await cb({
            name: "balotachain-vote-issuance",
            mode: "exclusive",
          });
        } finally {
          held = false;
        }
      },
    } as unknown as LockManager;
    const c = fakeConsole({
      ...SIGNED,
      presign: () => ({ r: "r", issuer_public_key: fixture.issuer_public_key }),
      sign: () => ({
        s_iss: "s",
        issuer_public_key: fixture.issuer_public_key,
      }),
    });
    const seen: { url: string; held: boolean; flag: boolean }[] = [];
    const fetch: typeof globalThis.fetch = (input, init) => {
      const url = String(input);
      if (url.includes("/issue/")) {
        seen.push({ url, held, flag: issuanceHeldHere() });
      }
      return c.fetch(input, init);
    };
    const t = new HttpTransport({ fetch, locks });
    await t.exclusiveIssuance(async () => {
      await new Promise((r) => setTimeout(r, 0));
      await t.issuePresign("bc");
      await new Promise((r) => setTimeout(r, 0));
      await t.issueSign("ep");
    });
    expect(seen).toEqual([
      { url: PATHS.presign, held: true, flag: true },
      { url: PATHS.sign, held: true, flag: true },
    ]);
    expect(held).toBe(false);
    expect(issuanceHeldHere()).toBe(false);
  });

  it("holds the Web Lock across the pair, and refuses when another tab holds it", async () => {
    const request = vi.fn(
      async (
        _name: string,
        _opts: LockOptions,
        cb: (l: Lock | null) => unknown,
      ) => cb({ name: "balotachain-vote-issuance", mode: "exclusive" }),
    );
    const t: HttpTransport = new HttpTransport({
      fetch: fakeConsole({
        ...SIGNED,
        presign: () => ({
          r: "r",
          issuer_public_key: fixture.issuer_public_key,
        }),
        sign: () => ({
          s_iss: "s",
          issuer_public_key: fixture.issuer_public_key,
        }),
      }).fetch,
      locks: { request } as unknown as LockManager,
    });
    await t.exclusiveIssuance(async () => {
      await t.issuePresign("bc");
      await t.issueSign("ep");
    });
    expect(request).toHaveBeenCalledWith(
      "balotachain-vote-issuance",
      { ifAvailable: true },
      expect.any(Function),
    );

    const otherTab = {
      request: async (
        _n: string,
        _o: LockOptions,
        cb: (l: Lock | null) => unknown,
      ) => cb(null),
    } as unknown as LockManager;
    const run = vi.fn(async () => {});
    expect(await failure(withIssuanceLock(otherTab, run))).toMatchObject({
      message: ISSUANCE_BUSY,
    });
    expect(run).not.toHaveBeenCalled();
  });
});

/**
 * One case per row of ERROR_TABLE: the failure, the route and what it must
 * become. Shapes: http-api.md, Conventions (status table, the 422 body,
 * `guard`'s plain-text 403s) and each route's own errors.
 */
interface Case {
  name: string;
  route: Route;
  failure: Failure;
  kind: string;
  detail?: unknown;
  message?: string | RegExp;
}

const http = (
  status: number,
  body: Record<string, unknown> | string,
  retryAfter: number | null = null,
): Failure => ({
  status,
  body: typeof body === "string" ? {} : body,
  text:
    typeof body === "string"
      ? body
      : typeof body.error === "string"
        ? body.error
        : "",
  retryAfter,
});

const chain = (gate: string) =>
  http(422, {
    error: "SubmitBallot was refused by the chain",
    refused: true,
    gate,
    reason: `chaincode response 500, gate=${gate}: why`,
  });

const CASES: Case[] = [
  {
    name: "fetch failed",
    route: "ballot",
    failure: { status: "transport", message: "Failed to fetch" },
    kind: "network",
  },
  {
    name: "timed out",
    route: "election",
    failure: { status: "timeout", ms: 15000 },
    kind: "network",
    message: /15 s/,
  },
  {
    name: "500",
    route: "sign",
    failure: http(500, { error: "internal error" }),
    kind: "network",
    message: "internal error",
  },
  {
    name: "502",
    route: "ballot",
    failure: http(502, { error: "the chain did not answer" }),
    kind: "network",
  },
  {
    name: "409 no-voter-list",
    route: "checkin",
    failure: http(409, { error: "no list", code: "no-voter-list" }),
    kind: "refused",
    detail: { type: "no-voter-list" },
    message: NO_VOTER_LIST,
  },
  {
    name: "presign 403 no-checkin",
    route: "presign",
    failure: http(403, { error: "no check-in", code: "no-checkin" }),
    kind: "auth",
    message: CHECKIN_ENDED,
  },
  {
    name: "checkin sign 409 wrong-state",
    route: "checkin-sign",
    failure: http(409, { error: "not approved", code: "wrong-state" }),
    kind: "auth",
    detail: { type: "checkin", code: "wrong-state" },
  },
  {
    name: "sign 409 already-issued",
    route: "sign",
    failure: http(409, { error: "issued", code: "already-issued" }),
    kind: "refused",
    detail: { type: "already-issued" },
    message: ALREADY_ISSUED,
  },
  {
    name: "find 409 not-open",
    route: "find",
    failure: http(409, { error: "not open", code: "not-open" }),
    kind: "not-open",
  },
  {
    name: "declare 429",
    route: "declare",
    failure: http(429, { error: "slow", code: "rate-limited" }, 30),
    kind: "refused",
    detail: { type: "rate-limited", retryAfterSeconds: 30 },
    message: rateLimited(30),
  },
  {
    name: "find 404 not-on-list",
    route: "find",
    failure: http(404, { error: "x", code: "not-on-list" }),
    kind: "refused",
    detail: { type: "checkin", code: "not-on-list" },
    message: NOT_ON_LIST,
  },
  {
    name: "declare 409 already-checked-in",
    route: "declare",
    failure: http(409, { error: "x", code: "already-checked-in" }),
    kind: "refused",
    detail: { type: "checkin", code: "already-checked-in" },
    message: ALREADY_CHECKED_IN,
  },
  {
    name: "find 400 bad-date",
    route: "find",
    failure: http(400, { error: "x", code: "bad-date" }),
    kind: "refused",
    detail: { type: "checkin", code: "bad-date" },
    message: BAD_DATE,
  },
  {
    name: "find 400 bad-request",
    route: "find",
    failure: http(400, { error: "x", code: "bad-request" }),
    kind: "refused",
    detail: { type: "checkin", code: "bad-request" },
    message: NAME_TOO_LONG,
  },
  {
    name: "declare 400 declaration-required",
    route: "declare",
    failure: http(400, { error: "x", code: "declaration-required" }),
    kind: "refused",
    detail: { type: "checkin", code: "declaration-required" },
  },
  {
    name: "declare 409 checkin-in-progress",
    route: "declare",
    failure: http(409, { error: "x", code: "checkin-in-progress" }),
    kind: "refused",
    detail: { type: "checkin", code: "checkin-in-progress" },
    message: CHECKIN_IN_PROGRESS,
  },
  {
    name: "checkin sign 400 bad-signature",
    route: "checkin-sign",
    failure: http(400, { error: "x", code: "bad-signature" }),
    kind: "refused",
    detail: { type: "checkin", code: "bad-signature" },
    message: BAD_SIGNATURE,
  },
  {
    name: "401 anywhere",
    route: "presign",
    failure: http(401, { error: "login required" }),
    kind: "auth",
    message: CHECKIN_ENDED,
  },
  {
    name: "presign 403 with no code (an account, a guard)",
    route: "presign",
    failure: http(403, {
      error: "only a voter account may obtain a credential",
    }),
    kind: "refused",
  },
  {
    name: "guard 403 (plain text)",
    route: "ballot",
    failure: http(403, "cross-origin request rejected"),
    kind: "refused",
    message: "cross-origin request rejected",
  },
  {
    name: "404",
    route: "election",
    failure: http(404, { error: "no live election has been set up" }),
    kind: "not-open",
  },
  {
    name: "ballot 409",
    route: "ballot",
    failure: http(409, { error: "the election is closed" }),
    kind: "closed",
  },
  {
    name: "presign 409",
    route: "presign",
    failure: http(409, { error: "issued already" }),
    kind: "refused",
    detail: { type: "already-issued" },
    message: ALREADY_ISSUED,
  },
  {
    name: "sign 409",
    route: "sign",
    failure: http(409, {
      error: "no issuance session is open for this account",
    }),
    kind: "refused",
    message: /no issuance session is open for this account/,
  },
  {
    name: "verify-code 409: the phone's own sentence, not the console's",
    route: "verify-code",
    failure: http(409, {
      error:
        "this tracking code matches more than one ballot record \u2014 ask for the full nullifier",
    }),
    kind: "refused",
    message: AMBIGUOUS_CODE,
  },
  {
    name: "409 elsewhere",
    route: "election",
    failure: http(409, { error: "the console's own words" }),
    kind: "refused",
    message: "the console's own words",
  },
  {
    name: "ballot 400 wrong-election",
    route: "ballot",
    failure: http(400, {
      error: "a ballot for another election",
      code: "wrong-election",
    }),
    kind: "refused",
    detail: { type: "stale-election" },
  },
  {
    name: "400",
    route: "ballot",
    failure: http(400, { error: "ballot must be hex" }),
    kind: "refused",
    message: "ballot must be hex",
  },
  {
    name: "422 nullifier",
    route: "ballot",
    failure: chain("nullifier"),
    kind: "already-voted",
    detail: {
      type: "chain-refusal",
      gate: "nullifier",
      reason: "chaincode response 500, gate=nullifier: why",
    },
  },
  {
    name: "422 election-closed",
    route: "ballot",
    failure: chain("election-closed"),
    kind: "closed",
    detail: {
      type: "chain-refusal",
      gate: "election-closed",
      reason: "chaincode response 500, gate=election-closed: why",
    },
  },
  {
    name: "422 other gate, verbatim",
    route: "ballot",
    failure: chain("cds"),
    kind: "refused",
    detail: {
      type: "chain-refusal",
      gate: "cds",
      reason: "chaincode response 500, gate=cds: why",
    },
    message:
      "SubmitBallot was refused by the chain (gate cds): chaincode response 500, gate=cds: why",
  },
  {
    name: "429",
    route: "presign",
    failure: http(
      429,
      { error: "too many credential issuances are open at once" },
      1,
    ),
    kind: "network",
    detail: { type: "rate-limited", retryAfterSeconds: 1 },
  },
  {
    name: "any other 5xx",
    route: "ballot",
    failure: http(507, { error: "insufficient storage" }),
    kind: "network",
  },
  {
    name: "any other 4xx",
    route: "ballot",
    failure: http(405, "POST required"),
    kind: "refused",
  },
];

describe("the error table", () => {
  for (const c of CASES) {
    it(`${c.name} -> ${c.kind}`, () => {
      const row = errorRow(c.route, c.failure);
      expect(row.kind).toBe(c.kind);
      const e = new LiveError(
        row.kind,
        row.message(c.failure),
        row.detail?.(c.failure),
      );
      if (c.detail) expect(e.detail).toEqual(c.detail);
      else expect(e.detail).toBeUndefined();
      if (typeof c.message === "string") expect(e.message).toBe(c.message);
      else if (c.message) expect(e.message).toMatch(c.message);
    });
  }

  it("has a case for every row, and every row is reachable", () => {
    const hit = new Set(CASES.map((c) => errorRow(c.route, c.failure)));
    // 413 shares its row with 400; 503 and 504 with 502.
    expect(errorRow("ballot", http(413, "too large")).kind).toBe("refused");
    expect(errorRow("ballot", http(504, "")).kind).toBe("network");
    for (const row of ERROR_TABLE) expect(hit.has(row)).toBe(true);
  });

  it("maps real responses through the same table", async () => {
    // A 422 straight from the stubbed fetch keeps the console's gate and reason.
    const { fetch } = scripted(() =>
      json(422, {
        error: "SubmitBallot was refused by the chain",
        refused: true,
        gate: "cds",
        reason: "rpc error: gate=cds: proof does not verify",
      }),
    );
    const e = await failure(
      transport(fetch).submitBallot("president", BALLOT, SHOWN),
    );
    expect(e).toMatchObject({
      kind: "refused",
      detail: {
        type: "chain-refusal",
        gate: "cds",
        reason: "rpc error: gate=cds: proof does not verify",
      },
    });
    // guard's plain-text 403.
    const g = scripted(() => new Response("forbidden host\n", { status: 403 }));
    expect(await failure(transport(g.fetch).election())).toMatchObject({
      kind: "refused",
      message: "forbidden host",
    });
  });
});
