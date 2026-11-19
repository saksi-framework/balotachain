/**
 * An in-memory stand-in for the live console's HTTP routes, for tests of
 * `HttpTransport` and of the app over it. Every shape is taken from saksi
 * `docs/live/http-api.md` at `25cbafd` and, for the voter list and the
 * precinct check-in, `docs/live/voter-list-api.md` (section named at each
 * route). It models the phone's `saksi_checkin` cookie: a request made with
 * `credentials: "omit"` never carries it.
 */
import { createHash } from "node:crypto";
import fixture from "./fixture/live-election.json";

export type Json = Record<string, unknown>;

export interface FakeCall {
  url: string;
  method: string;
  credentials: RequestCredentials | undefined;
  headers: Record<string, string>;
  body: unknown;
  /** The check-in cookie the request carried, or null (none, or `omit`). */
  session: string | null;
}

export type FakeCheckinState =
  | "not_checked_in"
  | "at_desk"
  | "approved"
  | "signed"
  | "credential_issued";

/** Fictional voters for the tests; no row is a real person. */
export const FAKE_LIST = [
  {
    seq: 1,
    last_name: "Halimbawa",
    first_name: "Uno",
    middle_name: "Pagsubok",
    date_of_birth: "1990-01-01",
  },
  {
    seq: 2,
    last_name: "Peña",
    first_name: "Dos",
    middle_name: "Santos-Reyes",
    date_of_birth: "1991-02-02",
  },
  {
    seq: 3,
    last_name: "Sampol",
    first_name: "Tres",
    middle_name: "",
    date_of_birth: "1992-03-03",
  },
] as const;

export const PRECINCT_LABEL = "Precinct 0001A (demonstration)";

export interface FakeConsoleOptions {
  state?: string;
  params?: string;
  dkg?: string | null;
  issuerPublicKey?: string;
  electionId?: string;
  runId?: string;
  jointKeyFingerprint?: string;
  /** False: an election made with no voter list (409 `no-voter-list`). */
  voterList?: boolean;
  /** No election set up yet: the live routes answer 404 with no code. */
  noElection?: boolean;
  /** This phone already holds a check-in for list entry `seq`. */
  checkin?: { seq: number; state: FakeCheckinState };
  /** Answer presign/sign; default: 409 `already-issued` (no issuer here). */
  presign?: (body: Json) => Response | Json;
  sign?: (body: Json) => Response | Json;
  /** Overrides the ballot answer for one POST (n counts from 0). */
  ballot?: (hex: string, n: number) => Response | Json | undefined;
  /** Overrides a find or declare answer (n counts the calls from 0). */
  checkinAnswer?: (
    route: "find" | "declare",
    n: number,
  ) => Response | undefined;
}

export function json(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** The wire format's fingerprint of hex bytes (wire-format.md, Fingerprints). */
export function fingerprintOf(hex: string): string {
  const d = createHash("sha256")
    .update(Buffer.from(hex, "hex"))
    .digest("hex")
    .slice(0, 32)
    .toUpperCase();
  return d.match(/.{4}/g)!.join("-");
}

/** voter-list-api.md, Normalising: the match form. */
function matchForm(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[-‐-―.]/g, " ")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const err = (status: number, code: string | null, error: string) =>
  json(status, code === null ? { error } : { error, code });

export function fakeConsole(o: FakeConsoleOptions = {}) {
  const calls: FakeCall[] = [];
  const recorded: {
    ballot: string;
    positionId: string;
    trackingCode: string;
    fingerprint: string;
    txId: string;
    block: number;
  }[] = [];
  let block = 390;
  let tokens = 0;
  const view = {
    state: o.state ?? "open",
    params: o.params ?? fixture.params,
    dkg: o.dkg === undefined ? fixture.dkg : o.dkg,
    issuerPublicKey: o.issuerPublicKey ?? fixture.issuer_public_key,
    electionId: o.electionId ?? fixture.election_id,
    runId: o.runId ?? "live-20261114-075259-1ced8307",
    jointKeyFingerprint: o.jointKeyFingerprint ?? fixture.joint_key_fingerprint,
    voterList: o.voterList ?? true,
    none: o.noElection ?? false,
  };
  /** Each list entry's state, per election (`private/checkin.json`). */
  const entries = new Map<number, FakeCheckinState>();
  /** Live tokens: the entry and the election each is bound to. */
  const live = new Map<string, { seq: number; electionId: string }>();
  /** Ended tokens and how they ended (refused at the desk, or reset). */
  const ended = new Map<string, "refused" | "reset">();
  /** The cookie this phone's browser holds. */
  const jar: { cookie: string | null } = { cookie: null };
  /** The signatures sent, as the console stores them. */
  const signatures = new Map<number, unknown>();

  function bind(seq: number, state: FakeCheckinState): string {
    const token = `tok-${++tokens}`;
    entries.set(seq, state);
    live.set(token, { seq, electionId: view.electionId });
    jar.cookie = token;
    return token;
  }
  if (o.checkin) bind(o.checkin.seq, o.checkin.state);

  /** The entry the cookie names in this election, or null. */
  function held(token: string | null) {
    const t = token ? live.get(token) : undefined;
    return t && t.electionId === view.electionId ? t : null;
  }

  function entryOf(seq: number) {
    const r = FAKE_LIST[seq - 1]!;
    return {
      seq: r.seq,
      last_name: r.last_name,
      first_name: r.first_name,
      middle_name: r.middle_name,
    };
  }

  function pollView(token: string): Json {
    const base: Json = {
      election_id: view.electionId,
      election_state: view.state,
      precinct: "0001A",
      precinct_label: PRECINCT_LABEL,
    };
    const end = ended.get(token);
    if (end) return { ...base, state: end };
    const t = held(token)!;
    return { ...base, state: entries.get(t.seq), entry: entryOf(t.seq) };
  }

  /** End the check-in of entry `seq`: its token answers `how` from now on. */
  function end(seq: number, how: "refused" | "reset") {
    for (const [token, t] of live) {
      if (t.seq === seq && t.electionId === view.electionId) {
        live.delete(token);
        ended.set(token, how);
      }
    }
    entries.set(seq, "not_checked_in");
    signatures.delete(seq);
  }

  /** The Electoral Board at the presenter page (the desk routes). */
  const desk = {
    approve(seq = 1) {
      if (entries.get(seq) === "at_desk") entries.set(seq, "approved");
    },
    refuse(seq = 1) {
      if (entries.get(seq) === "at_desk") end(seq, "refused");
    },
    reset(seq = 1) {
      const s = entries.get(seq);
      if (s && s !== "not_checked_in" && s !== "credential_issued") {
        end(seq, "reset");
      }
    },
    /** Another phone checked in as this entry. */
    checkInElsewhere(seq: number, state: FakeCheckinState = "signed") {
      entries.set(seq, state);
    },
    state(seq = 1) {
      return entries.get(seq) ?? "not_checked_in";
    },
    signature(seq = 1) {
      return signatures.get(seq);
    },
  };

  /** A new election: a new id; every check-in and token is the old one's. */
  function newElection(electionId: string, state = "open") {
    view.none = false;
    view.electionId = electionId;
    view.runId = electionId;
    view.state = state;
    entries.clear();
    signatures.clear();
  }

  const answer = (r: Response | Json) =>
    r instanceof Response ? r : json(200, r);
  const count = (url: string) => calls.filter((c) => c.url === url).length - 1;

  /** find and declare share their checks (voter-list-api.md, find). */
  function lookup(body: Json, declare: boolean): Response | number {
    const want = ["date_of_birth", "first_name", "last_name"];
    if (declare) want.push("declaration");
    if (Object.keys(body).sort().join(",") !== want.sort().join(",")) {
      return err(400, null, "invalid JSON body");
    }
    if (
      typeof body.last_name !== "string" ||
      typeof body.first_name !== "string" ||
      typeof body.date_of_birth !== "string"
    ) {
      return err(400, null, "invalid JSON body");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date_of_birth)) {
      return err(400, "bad-date", "date_of_birth is not a YYYY-MM-DD date");
    }
    const hit = FAKE_LIST.find(
      (r) =>
        matchForm(r.last_name) === matchForm(body.last_name as string) &&
        matchForm(r.first_name) === matchForm(body.first_name as string) &&
        r.date_of_birth === body.date_of_birth,
    );
    if (!hit) {
      return err(
        404,
        "not-on-list",
        "No voter with these details is on this precinct's list. Check the spelling or see the Electoral Board.",
      );
    }
    if ((entries.get(hit.seq) ?? "not_checked_in") !== "not_checked_in") {
      return err(
        409,
        "already-checked-in",
        "This voter has already checked in. See the Electoral Board.",
      );
    }
    return hit.seq;
  }

  /** The election checks every check-in route shares. */
  function noElection(): Response | null {
    if (!view.voterList) {
      return err(409, "no-voter-list", "this election has no voter list");
    }
    return null;
  }

  async function fetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
  ): Promise<Response> {
    const url = String(input);
    const method = init.method ?? "GET";
    const headers = { ...(init.headers as Record<string, string>) };
    const body =
      typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    // Same origin: the cookie goes unless the request says `omit`, and only
    // to `/api/live/` (its Path).
    const session =
      init.credentials === "omit" || !url.startsWith("/api/live/")
        ? null
        : jar.cookie;
    calls.push({
      url,
      method,
      credentials: init.credentials,
      headers,
      body,
      session,
    });

    if (
      view.none &&
      url.startsWith("/api/live/") &&
      url !== "/api/live/ballot"
    ) {
      return err(404, null, "no live election has been set up");
    }
    // GET /api/live/election (http-api.md, Public; voter-list-api.md, Counts).
    if (url === "/api/live/election") {
      const v: Json = {
        run_id: view.runId,
        election_id: view.electionId,
        title: "Student council 2026",
        state: view.state,
        positions: fixture.positions,
        trustees: 3,
        threshold: 2,
        params: view.params,
        contest_ids: [],
        issuer_public_key: view.issuerPublicKey,
        counts: { voters_on_roll: 3, ballot_records: recorded.length },
      };
      if (view.voterList) {
        v.precinct = "0001A";
        v.precinct_label = PRECINCT_LABEL;
      }
      if (view.dkg) {
        v.dkg = view.dkg;
        v.joint_key_fingerprint = view.jointKeyFingerprint;
      }
      return json(200, v);
    }
    // GET /api/live/checkin (voter-list-api.md).
    if (url === "/api/live/checkin") {
      const no = noElection();
      if (no) return no;
      if (session && ended.has(session)) return json(200, pollView(session));
      if (!held(session)) {
        return err(404, "no-checkin", "this phone has no check-in");
      }
      return json(200, pollView(session!));
    }
    // POST /api/live/checkin/find and declare (voter-list-api.md).
    if (
      url === "/api/live/checkin/find" ||
      url === "/api/live/checkin/declare"
    ) {
      const route = url.endsWith("find") ? "find" : "declare";
      const over = o.checkinAnswer?.(route, count(url));
      if (over) return over;
      if (route === "declare" && body?.declaration !== true) {
        return err(400, "declaration-required", "the declaration is required");
      }
      const no = noElection();
      if (no) return no;
      if (view.state !== "open") {
        return err(
          409,
          "not-open",
          "check-in is open while the election is open",
        );
      }
      if (route === "declare") {
        const mine = held(session);
        const s = mine ? entries.get(mine.seq) : undefined;
        if (s === "at_desk" || s === "approved" || s === "signed") {
          return err(
            409,
            "checkin-in-progress",
            "this phone has a check-in in progress",
          );
        }
      }
      const seq = lookup(body ?? {}, route === "declare");
      if (seq instanceof Response) return seq;
      if (route === "find") {
        return json(200, {
          precinct: "0001A",
          precinct_label: PRECINCT_LABEL,
          entry: entryOf(seq),
        });
      }
      const token = bind(seq, "at_desk");
      return json(200, pollView(token));
    }
    // POST /api/live/checkin/sign (voter-list-api.md).
    if (url === "/api/live/checkin/sign") {
      const no = noElection();
      if (no) return no;
      const keys = Object.keys(body ?? {});
      const strokes = body?.strokes;
      const cannot = body?.cannot_sign;
      if (
        keys.length !== 1 ||
        (keys[0] !== "strokes" && keys[0] !== "cannot_sign")
      ) {
        return err(400, null, "invalid JSON body");
      }
      if (cannot !== undefined && cannot !== true) {
        return err(400, "bad-signature", "cannot_sign must be true");
      }
      if (strokes !== undefined) {
        const ok =
          Array.isArray(strokes) &&
          strokes.length >= 1 &&
          strokes.length <= 64 &&
          strokes.every(
            (s: unknown) =>
              Array.isArray(s) &&
              s.length >= 1 &&
              s.length <= 1000 &&
              s.every(
                (p: unknown) =>
                  Array.isArray(p) &&
                  p.length === 2 &&
                  Number.isInteger(p[0]) &&
                  Number.isInteger(p[1]) &&
                  p[0] >= 0 &&
                  p[0] <= 1000 &&
                  p[1] >= 0 &&
                  p[1] <= 400,
              ),
          ) &&
          strokes.reduce((n: number, s: unknown[]) => n + s.length, 0) <= 4000;
        if (!ok) return err(400, "bad-signature", "the signature is not valid");
      }
      const mine = held(session);
      if (!mine) return err(403, "no-checkin", "this phone has no check-in");
      if (entries.get(mine.seq) !== "approved") {
        return err(409, "wrong-state", "the check-in is not approved");
      }
      if (view.state !== "open") {
        return err(409, "not-open", "the election is not open");
      }
      signatures.set(mine.seq, body);
      entries.set(mine.seq, "signed");
      return json(200, pollView(session!));
    }
    // POST /api/live/issue/presign and sign (http-api.md; voter-list-api.md).
    if (url === "/api/live/issue/presign" || url === "/api/live/issue/sign") {
      const no = noElection();
      if (no) return no;
      const mine = held(session);
      if (!mine) {
        return err(403, "no-checkin", "a credential needs a check-in");
      }
      if (view.state !== "open") {
        return err(
          409,
          null,
          `credentials are issued while the election is open; it is ${view.state}`,
        );
      }
      const s = entries.get(mine.seq);
      if (s === "credential_issued") {
        return err(
          409,
          "already-issued",
          "this voter has been issued its credential for this election already; a lost credential cannot be issued again",
        );
      }
      if (s !== "signed") {
        return err(409, "not-signed", "the voter has not signed the list");
      }
      const f = url.endsWith("presign") ? o.presign : o.sign;
      if (f) {
        const out = answer(f(body));
        if (url.endsWith("/sign") && out.ok) {
          entries.set(mine.seq, "credential_issued");
        }
        return out;
      }
      return err(
        409,
        "already-issued",
        "this voter has been issued its credential for this election already; a lost credential cannot be issued again",
      );
    }
    // POST /api/live/ballot (http-api.md, Public; anonymous).
    if (url === "/api/live/ballot") {
      const n = count(url);
      const over = o.ballot?.(body.ballot, n);
      if (over) return answer(over);
      if (view.state !== "open") {
        return json(409, {
          error: `ballots are accepted while the election is open; it is ${view.state}`,
        });
      }
      const next = expect[recorded.length];
      if (!next) return json(500, { error: "internal error" });
      if (recorded.some((r) => r.trackingCode === next.trackingCode)) {
        return json(422, {
          error: "SubmitBallot was refused by the chain",
          refused: true,
          gate: "nullifier",
          reason:
            'chaincode response 500, gate=nullifier: nullifier already spent in election "vote-fixture" (double vote)',
        });
      }
      const r = {
        ballot: body.ballot as string,
        positionId: next.positionId,
        trackingCode: next.trackingCode,
        fingerprint: fingerprintOf(body.ballot),
        txId: (recorded.length + 1).toString(16).padStart(64, "0"),
        block: ++block,
      };
      recorded.push(r);
      return json(200, {
        election_id: view.electionId,
        position_id: r.positionId,
        nullifier: "00".repeat(32),
        tracking_code: r.trackingCode,
        ballot_fingerprint: r.fingerprint,
        tx_id: r.txId,
        block_number: r.block,
        recorded_bytes_match: true,
      });
    }
    // GET /api/verify-code/<run>/<code> (http-api.md, The bulletin board).
    const vc = url.match(/^\/api\/verify-code\/([^/]+)\/([^/]+)$/);
    if (vc) {
      const code = decodeURIComponent(vc[2]!);
      const r = recorded.find((x) => x.trackingCode === code);
      if (!r) return json(200, { found: false, committed_on_chain: false });
      return json(200, {
        found: true,
        tracking_code: r.trackingCode,
        ballot_index: recorded.indexOf(r),
        position_id: r.positionId,
        position_label: r.positionId,
        ballot_fingerprint: r.fingerprint,
        tx_id: r.txId,
        block_number: r.block,
        committed_on_chain: true,
      });
    }
    return new Response("404 page not found", { status: 404 });
  }

  /**
   * The tracking code and position the console reports for each ballot,
   * in send order. The console reads them from the record (it decodes a
   * copy); this fake has no decoder, so the test supplies them.
   */
  const expect: { positionId: string; trackingCode: string }[] = [];

  return { fetch, calls, recorded, view, expect, desk, jar, newElection };
}
