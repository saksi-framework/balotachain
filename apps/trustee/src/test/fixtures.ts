/**
 * `GET /api/trustee/status` fixtures for the live trustee screen. Used by the
 * tests and by the screenshot script (which intercepts the network in the
 * browser), never by the built page.
 *
 * Shapes follow the Go JSON tags (`trustee_http.go` `TrusteeStatus`): an
 * untouched step carries Go's zero time, as the process sends it.
 */
import type { StepStatus, TrusteeAlarm, TrusteeStatus } from "../lib/trustee";

const ZERO = "0001-01-01T00:00:00Z";
const T = (m: number, s = 0) =>
  `2026-11-20T09:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}Z`;

/** A title that exists only here, to prove no fixture reaches the build. */
export const FIXTURE_TITLE = "Kalayaan Fixture Council 2026";

const POSITIONS = [
  { id: "President", candidates: ["Maria-Santos", "Juan-P.-Dela-Cruz"] },
  { id: "Secretary", candidates: ["Ana-Reyes", "Ben-Cruz", "Carla-Lim"] },
];
const CONTEST_IDS = POSITIONS.flatMap((p) =>
  p.candidates.map((c) => `${p.id}/${c}`),
);
const TOTALS = [2, 1, 1, 2, 0];

const idle: StepStatus = { state: "idle", updated_at: ZERO };

function roster(
  checks: Record<number, ["ok" | "waiting" | "pending" | "mismatch", string?]>,
) {
  return [1, 2, 3, 4, 5].map((id) =>
    id === 2
      ? {
          trustee_id: 2,
          receive_key_fingerprint: "5E6F-11A2-90BC-7D31-0C44-AB19-6E02-F7D8",
          self: true,
          peer_check: "self" as const,
        }
      : {
          trustee_id: id,
          receive_key_fingerprint: `${id}A0${id}-77C1-3B9E-0042-D1F0-8E6A-21C7-9B5${id}`,
          self: false,
          peer_check: (checks[id]?.[0] ?? "pending") as
            | "ok"
            | "waiting"
            | "pending"
            | "mismatch",
          ...(checks[id]?.[1] ? { detail: checks[id]![1] } : {}),
        },
  );
}

/** Trustee 2 of 5, threshold 3, voting not yet begun. */
function base(): TrusteeStatus {
  return {
    trustee_id: 2,
    console: { url: "https://vote.vancornelio.dev:8443", reachable: true },
    identity: { checked: true, ok: true },
    election: {
      election_id: "live-20261120-090000-7c929547",
      title: FIXTURE_TITLE,
      state: "ceremony",
      trustees: 5,
      threshold: 3,
      positions: POSITIONS,
      contest_ids: CONTEST_IDS,
      params_checked: true,
      ballot_records: 0,
    },
    step: "",
    steps: { join: { ...idle }, decrypt: { ...idle }, sign: { ...idle } },
    alarms: [],
    fingerprints: {},
    ceremony: {
      receive_key_posted: false,
      roster_complete: false,
      roster: [],
      roster_checked: false,
      dealt: false,
      received: false,
      acknowledged: false,
      transcript_published: false,
      transcript_check: "",
    },
    decryption: {
      min_ballots: 2,
      ballot_count: 0,
      ballots_by_position: {},
      peer_checks: [],
      partial_computed: false,
      partial_recorded: false,
      partial_read_back: "",
      trustees_decrypted: 0,
      threshold: 3,
    },
    tally: {
      totals: [],
      contests: [],
      ready_to_sign: false,
      signature_posted: false,
      signature_note: "",
      published: false,
      published_totals: [],
      matches: null,
    },
    updated_at: T(30),
  };
}

type Patch = (s: TrusteeStatus) => void;
function make(...patches: Patch[]): TrusteeStatus {
  const s = base();
  for (const p of patches) p(s);
  return s;
}

const joined: Patch = (s) => {
  s.election!.state = "open";
  s.steps.join = { state: "done", updated_at: T(4, 10) };
  s.fingerprints = {
    receive_key: "5E6F-11A2-90BC-7D31-0C44-AB19-6E02-F7D8",
    roster: "3C4D-8812-AF09-55E1-7B3A-C0D2-19F4-6E8B",
    share: "1A2B-9C1E-44D0-7F3A-E2B8-0D6C-5A91-77AB",
    joint_key: "7A1B-3F9A-0C2E-88D4-B61F-2E07-94C3-C21E",
  };
  Object.assign(s.ceremony, {
    receive_key_posted: true,
    roster_complete: true,
    roster_digest: "3c4d8812af0955e17b3ac0d219f46e8b".repeat(2),
    roster: roster({ 1: ["ok"], 3: ["ok"], 4: ["ok"], 5: ["ok"] }),
    roster_checked: true,
    dealt: true,
    received: true,
    acknowledged: true,
    transcript_published: true,
    transcript_check: "ok",
  });
};

const closed: Patch = (s) => {
  s.election!.state = "closed";
  s.election!.ballot_records = 6;
};

const decrypted: Patch = (s) => {
  s.steps.decrypt = { state: "done", updated_at: T(21, 5) };
  s.fingerprints.ballots = "9C1D-0B7E-61A4-3F28-D5C9-8E12-47B0-A6F3";
  Object.assign(s.decryption, {
    ballot_count: 6,
    ballots_by_position: { President: 3, Secretary: 3 },
    ballots_digest: "9c1d0b7e61a43f28d5c98e1247b0a6f3".repeat(2),
    peer_checks: [
      { trustee_id: 1, state: "ok" },
      {
        trustee_id: 3,
        state: "waiting",
        detail: "trustee 3 has no ballot set yet",
      },
    ],
    partial_computed: true,
    partial_recorded: true,
    partial_read_back: "ok",
    trustees_decrypted: 2,
  });
};

const combined: Patch = (s) => {
  s.decryption.trustees_decrypted = 3;
  s.tally.totals = [...TOTALS];
  s.tally.contests = CONTEST_IDS.map((c, i) => ({
    contest_id: c,
    total: TOTALS[i]!,
  }));
};

const signedPatch: Patch = (s) => {
  s.steps.sign = { state: "done", updated_at: T(24, 40) };
  s.tally.signing = "signed";
  s.tally.ready_to_sign = false;
  s.tally.signature_posted = true;
};

const tallyDiffers: TrusteeAlarm = {
  code: "tally-differs",
  message: "the published tally is not this trustee's own combine",
  blocks: [],
  at: T(26, 2),
};

export const FIXTURES = {
  noElection: make((s) => {
    s.election = null;
    s.identity = { checked: false, ok: false };
    s.decryption.threshold = 0;
  }),
  ceremonyBeforeJoin: make(),
  ceremonyJoining: make((s) => {
    s.step = "join";
    s.steps.join = {
      state: "running",
      detail: "posting this trustee's receive key",
      updated_at: T(2, 5),
    };
    s.fingerprints.receive_key = "5E6F-11A2-90BC-7D31-0C44-AB19-6E02-F7D8";
  }),
  ceremonyWaiting: make((s) => {
    s.step = "join";
    s.steps.join = {
      state: "waiting",
      detail: "waiting for trustee 4's host to state its roster digest",
      updated_at: T(3, 12),
    };
    s.fingerprints = {
      receive_key: "5E6F-11A2-90BC-7D31-0C44-AB19-6E02-F7D8",
      roster: "3C4D-8812-AF09-55E1-7B3A-C0D2-19F4-6E8B",
    };
    Object.assign(s.ceremony, {
      receive_key_posted: true,
      roster_complete: true,
      roster: roster({
        1: ["ok"],
        3: ["ok"],
        4: [
          "waiting",
          "not reachable: dial tcp 127.0.0.1:9004: connection refused",
        ],
        5: ["pending"],
      }),
    });
  }),
  ceremonyDone: make(joined),
  votingOpen: make(joined, (s) => {
    s.election!.ballot_records = 4;
  }),
  decryptReady: make(joined, closed),
  decryptRunning: make(joined, closed, (s) => {
    s.step = "decrypt";
    s.steps.decrypt = {
      state: "running",
      detail: "reading the ballots from the chain",
      updated_at: T(20, 30),
    };
    s.decryption.trustees_decrypted = 1;
  }),
  // Decrypt done; the combine waits for the threshold's partials. The
  // process signs by itself once they are in (trustee-api.md).
  decryptDone: make(joined, closed, decrypted, (s) => {
    s.step = "sign";
    s.steps.sign = {
      state: "waiting",
      detail: "waiting for decryptions: 2 of 3 trustees' partials on the chain",
      updated_at: T(21, 6),
    };
    s.tally.signing = "waiting";
  }),
  // The combine is ready: the process signs and posts by itself.
  signing: make(joined, closed, decrypted, combined, (s) => {
    s.step = "sign";
    s.steps.sign = {
      state: "running",
      detail: "your own combine gives the totals shown; signing them",
      updated_at: T(23, 0),
    };
    s.tally.signing = "signing";
  }),
  // The automatic post got a 500: the step failed and waits for the
  // Sign tally press (`ready_to_sign`, the retry).
  signRetry: make(joined, closed, decrypted, combined, (s) => {
    s.steps.sign = {
      state: "failed",
      error:
        "posting the tally signature: the console answered 500: internal error",
      updated_at: T(23, 4),
    };
    s.tally.signing = "retry";
    s.tally.sign_problem = "post_failed";
    s.tally.ready_to_sign = true;
  }),
  // No answer from the console: the process posts again by itself.
  signConsoleUnreachable: make(joined, closed, decrypted, combined, (s) => {
    s.step = "sign";
    s.steps.sign = {
      state: "waiting",
      error:
        'posting the tally signature: Post "https://vote.vancornelio.dev:8443/api/live/tally-sig": dial tcp: connection refused',
      updated_at: T(23, 4),
    };
    s.tally.signing = "waiting";
    s.tally.sign_problem = "console_unreachable";
  }),
  // Decrypt was not pressed here; the threshold decrypted and the combine
  // ran, before publication. This trustee does not sign.
  notDecrypted: make(joined, closed, combined, (s) => {
    s.steps.sign = {
      state: "idle",
      detail: "this trustee did not decrypt this election, so it does not sign",
      updated_at: T(23, 1),
    };
    s.tally.signing = "not_decrypted";
  }),
  signed: make(joined, closed, decrypted, combined, signedPatch),
  publishedMatch: make(
    joined,
    closed,
    decrypted,
    combined,
    signedPatch,
    (s) => {
      s.election!.state = "tallied";
      s.tally.published = true;
      s.tally.published_totals = [...TOTALS];
      s.tally.matches = true;
    },
  ),
  publishedMismatch: make(
    joined,
    closed,
    decrypted,
    combined,
    signedPatch,
    (s) => {
      s.election!.state = "tallied";
      s.tally.published = true;
      s.tally.published_totals = [2, 1, 2, 1, 0];
      s.tally.matches = false;
      s.alarms = [tallyDiffers];
    },
  ),
  // A trustee that neither decrypted nor signed, after publication: the
  // process combined by itself and signs nothing (trustee-api.md,
  // `steps.sign`).
  publishedNotSigned: make(joined, closed, combined, (s) => {
    s.election!.state = "tallied";
    s.steps.sign = {
      state: "done",
      detail: "the tally is published; no signature is needed",
      updated_at: T(27, 3),
    };
    s.tally.signing = "not_needed";
    s.tally.ready_to_sign = false;
    s.tally.published = true;
    s.tally.published_totals = [...TOTALS];
    s.tally.matches = true;
  }),
  // Signed as the result published: the console answered 409 "is tallied",
  // the step ended done with the note and nothing was posted
  // (trustee-api.md, "What the post's answer does").
  signedAfterPublication: make(joined, closed, decrypted, combined, (s) => {
    s.election!.state = "tallied";
    s.steps.sign = { state: "done", updated_at: T(26, 30) };
    s.tally.signing = "not_needed";
    s.tally.ready_to_sign = false;
    s.tally.signature_posted = false;
    s.tally.signature_note =
      "the tally was published with other trustees' signatures before this one was posted";
    s.tally.published = true;
    s.tally.published_totals = [...TOTALS];
    s.tally.matches = true;
  }),
  oneAlarm: make(joined, closed, (s) => {
    s.steps.decrypt = {
      state: "blocked",
      error: "blocked by an alarm: ballots-peer-3",
      updated_at: T(20, 50),
    };
    s.alarms = [
      {
        code: "ballots-peer-3",
        message:
          "trustee 3 read another ballot set: its digest 41aa07c2 differs from this trustee's 9c1d0b7e",
        blocks: ["decrypt", "sign"],
        at: T(20, 49),
      },
    ];
  }),
  consoleUnreachable: make(joined, (s) => {
    s.console = {
      url: "https://vote.vancornelio.dev:8443",
      reachable: false,
      error:
        'Get "https://vote.vancornelio.dev:8443/api/live/election": dial tcp: connection refused',
    };
  }),
} satisfies Record<string, TrusteeStatus>;

export type FixtureName = keyof typeof FIXTURES;

/** A fresh copy, so a test may change it. */
export function fixture(name: FixtureName): TrusteeStatus {
  return JSON.parse(JSON.stringify(FIXTURES[name])) as TrusteeStatus;
}

/** `GET /api/me` for trustee 2. */
export const SESSION = {
  username: "trustee2",
  role: "trustee",
  trustee_id: "2",
} as const;

/** `GET /api/trustee/peer` for trustee 2. */
export const PEER = {
  trustee_id: 2,
  election_id: "live-20261120-090000-7c929547",
};
