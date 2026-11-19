/**
 * The presenter page's rules, kept apart from React so each is tested on its
 * own: the state-to-step mapping (D6), the Setup form's ids (D19), the Close
 * voting confirm's numbers, the "Now" rows, the links and the demonstration
 * byte flip (D14).
 */
import { idToName, type StepperStep } from "@balotachain/ui";
import type { LiveCounts, LiveElectionView, LivePosition } from "./types";

// --- the demo's trustee numbers ------------------------------------------------

/**
 * The demo runs five trustee processes with a threshold of three. The console
 * does not tell an admin how many trustee accounts or tokens it holds, so the
 * form sends these two numbers; they are defined here and nowhere else.
 */
export const DEMO_TRUSTEES = 5;
export const DEMO_THRESHOLD = 3;

// --- steps -----------------------------------------------------------------------

export const STEP_NAMES = [
  "Setup",
  "Key ceremony",
  "Voting",
  "Decrypt",
  "Result",
] as const;
export type StepName = (typeof STEP_NAMES)[number];

/** What the action card shows; one per state the view can be in. */
export type Phase =
  /** No election: the Setup form. */
  | "none"
  /** `setup`: made, but `CreateElection` is not recorded yet. */
  | "unrecorded"
  /** `ceremony` before the first trustee joins (`trustees_joined` is 0). */
  | "created"
  /** `ceremony` with a trustee in, or with no joined count. */
  | "ceremony"
  | "open"
  | "closed"
  | "tallied"
  | "verified"
  | "abandoned"
  /** A state this page does not know. */
  | "unknown";

/** A number from the console, or undefined when it is missing. */
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function joinedOf(view: LiveElectionView): number | undefined {
  return num(view.counts?.trustees_joined);
}

export function phaseOf(view: LiveElectionView | null): Phase {
  if (!view) return "none";
  switch (view.state) {
    case "setup":
      return "unrecorded";
    case "ceremony":
      return joinedOf(view) === 0 ? "created" : "ceremony";
    case "open":
    case "closed":
    case "tallied":
    case "verified":
    case "abandoned":
      return view.state;
    default:
      return "unknown";
  }
}

/** The 1-based step for a phase; 0 for none (abandoned, unknown). */
export function stepOf(phase: Phase): number {
  switch (phase) {
    case "none":
    case "unrecorded":
      return 1;
    // M1: `ceremony` is the Key ceremony step from the moment the chain
    // records the election, before any trustee joins.
    case "created":
    case "ceremony":
      return 2;
    case "open":
      return 3;
    case "closed":
      return 4;
    case "tallied":
    case "verified":
      return 5;
    default:
      return 0;
  }
}

/** The word "verified" is said only in `verified` with the count from the chain. */
export function maySayVerified(view: LiveElectionView | null): boolean {
  return (
    view?.state === "verified" && view.counts?.ballot_records_source === "chain"
  );
}

/**
 * Where the check of a published result stands (http-api.md, "What a page
 * shows after publication"). The console verifies by itself as soon as the
 * tally is published; a press is only the retry.
 * - `running`: `tallied` with `auto_verify.state` `running`. No button.
 * - `failed`: `tallied` with `verify_overall` `fail`. Verify again.
 * - `missing`: `tallied` with no verdict (`auto_verify` `error`, or null).
 *   Verify again.
 * - `verified`: the state is `verified`.
 * - `none`: any other state.
 */
export type CheckStage = "none" | "running" | "failed" | "missing" | "verified";

export function checkStage(view: LiveElectionView | null): CheckStage {
  if (view?.state === "verified") return "verified";
  if (view?.state !== "tallied") return "none";
  if (view.auto_verify?.state === "running") return "running";
  if (view.verify_overall === "fail") return "failed";
  return "missing";
}

/** Consecutive polls of one election at `tallied` with no run and no verdict. */
export type MissingSeen = { id: string | null; polls: number };

export const NO_MISSING: MissingSeen = { id: null, polls: 0 };

/** One poll's step of the count behind holding Verify again (review minor 5). */
export function nextMissingSeen(
  prev: MissingSeen,
  view: LiveElectionView | null,
): MissingSeen {
  const id = view?.election_id ?? null;
  if (id === null || checkStage(view) !== "missing") return { id, polls: 0 };
  return { id, polls: prev.id === id ? prev.polls + 1 : 1 };
}

/** The tracker: steps, current, and the title's step word. */
export function trackerFor(
  view: LiveElectionView | null,
  /** The stuck hold has passed (`nextStuckHold`); see `belowMinimum`. */
  stuck = false,
): {
  steps: StepperStep[];
  current: number;
  word: string;
} {
  const phase = phaseOf(view);
  if (phase === "abandoned") {
    return {
      steps: STEP_NAMES.map((label, i) => ({
        label,
        state: "pending",
        status: i === 0 ? "abandoned" : "not run",
      })),
      current: 0,
      word: "Abandoned",
    };
  }
  if (phase === "unknown") {
    return {
      steps: STEP_NAMES.map((label) => ({ label })),
      current: 0,
      word: view?.state ?? "",
    };
  }
  const steps: StepperStep[] = STEP_NAMES.map((label) => ({ label }));
  if (phase === "verified" && maySayVerified(view)) {
    steps[4] = { label: "Result", status: "verified" };
    return { steps, current: STEP_NAMES.length + 1, word: "Result" };
  }
  const current = stepOf(phase);
  // The Result step names the automatic check while it runs, and a check
  // that failed; never "verified" here (only above, from the chain).
  const stage = checkStage(view);
  if (stage === "running")
    steps[4] = { label: steps[4]!.label, status: "checking" };
  else if (stage === "failed")
    steps[4] = { label: steps[4]!.label, status: "check failed" };
  // I2 (rehearsal 5): a closed election below the minimum never finishes
  // Decrypt, so no step is drawn current: Decrypt reads "cannot run" and
  // Result "not run", both drawn pending (the stepper's own override).
  if (phase === "closed" && stuck && belowMinimum(view)) {
    steps[3] = {
      label: steps[3]!.label,
      state: "pending",
      status: "cannot run",
    };
    steps[4] = { label: steps[4]!.label, state: "pending", status: "not run" };
    return { steps, current, word: "Cannot decrypt" };
  }
  return { steps, current, word: STEP_NAMES[current - 1] ?? "" };
}

/**
 * Rehearsal 5, I1 and I2: the ballot-record count the console sent is below
 * its own `min_ballot_records`, so a closed election cannot be decrypted.
 * Only the two numbers the console sent; null when either is missing (an
 * older console, or before `open`) or the count is enough.
 */
export function belowMinimum(
  view: LiveElectionView | null,
): { have: number; min: number } | null {
  const c = view?.counts;
  const have = c?.ballot_records;
  const min = c?.min_ballot_records;
  // Review of the rehearsal 5 round: only a count from the chain, and only a
  // real count (finite, 0 or more). The console's own count can lag or be 0
  // while the chain is not read, so it never makes the claim.
  if (c?.ballot_records_source !== "chain") return null;
  if (typeof have !== "number" || !Number.isFinite(have) || have < 0)
    return null;
  if (typeof min !== "number" || !Number.isFinite(min)) return null;
  return have < min ? { have, min } : null;
}

/**
 * The stuck wording at `closed` waits this long: the console's chain count
 * can be a few seconds old, so a count read just before the last ballot
 * landed must not end the demo on screen. No ballot can be added after
 * Close, so a low count that lasts this long is the chain's.
 */
export const STUCK_HOLD_MS = 6000;

export type StuckHold = {
  id: string | null;
  /** When this run of consecutive low chain counts at `closed` began. */
  since: number | null;
  stuck: boolean;
};

export const NO_HOLD: StuckHold = { id: null, since: null, stuck: false };

/**
 * One poll's step of the hold: the election is `closed` with a chain count
 * below the minimum on every poll since `since`, for at least
 * `STUCK_HOLD_MS`. Any other poll (enough records, another source, another
 * state or election) starts it again.
 */
export function nextStuckHold(
  prev: StuckHold,
  view: LiveElectionView | null,
  now: number,
): StuckHold {
  const id = view?.election_id ?? null;
  if (id === null || view?.state !== "closed" || !belowMinimum(view))
    return { id, since: null, stuck: false };
  const since = prev.id === id && prev.since !== null ? prev.since : now;
  return { id, since, stuck: now - since >= STUCK_HOLD_MS };
}

const recordsOf = (n: number) =>
  n === 1 ? "1 ballot record" : `${n} ballot records`;

/** The Close confirm's first line when closing now would leave it stuck. */
export function closeBelowMinimum(b: { have: number; min: number }): string {
  return `The chain holds ${recordsOf(b.have)}; decryption needs at least ${b.min}. An election closed now cannot be decrypted or abandoned: the only way on is to reset the console with tools/live-reset.sh.`;
}

/** The Decrypt card's sentence for a closed election below the minimum. */
export function closedBelowMinimum(b: { have: number; min: number }): string {
  return `This election was closed with ${recordsOf(b.have)} on the chain; decryption needs at least ${b.min}. It cannot be decrypted, and once voting has opened it cannot be abandoned. Reset the console to start the next election:`;
}

/** D13: "Presenter <step> - BalotaChain". */
export function tabTitle(word: string): string {
  return word ? `Presenter ${word} - BalotaChain` : "Presenter - BalotaChain";
}

// --- positions and totals --------------------------------------------------------

/** How many positions the election has (one ballot record each). */
export function positionCount(view: LiveElectionView | null): number {
  return view?.positions?.length ?? 0;
}

export type TotalsRow = {
  position: string;
  candidates: { id: string; votes: number | undefined }[];
};

/**
 * The published totals by position and candidate. `totals[i]` is for
 * `contest_ids[i]`, which is `<position>/<candidate>`; a position id holds no
 * `/`, so the first one splits it.
 */
export function totalsByPosition(view: LiveElectionView): TotalsRow[] {
  const ids = view.contest_ids ?? [];
  const totals = view.totals ?? [];
  const rows: TotalsRow[] = [];
  ids.forEach((contest, i) => {
    const cut = contest.indexOf("/");
    const position = cut < 0 ? contest : contest.slice(0, cut);
    const candidate = cut < 0 ? "" : contest.slice(cut + 1);
    let row = rows.find((r) => r.position === position);
    if (!row) {
      row = { position, candidates: [] };
      rows.push(row);
    }
    row.candidates.push({ id: candidate, votes: num(totals[i]) });
  });
  return rows;
}

// --- the Setup form (D19) ----------------------------------------------------------

export const MAX_ID_BYTES = 64;
/** Position id plus candidate id: the wire format's 127 less the "/". */
export const MAX_PAIR_BYTES = 126;
export const MAX_TITLE_BYTES = 200;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Trim, then each run of spaces becomes one hyphen. A typed hyphen stays. */
export function nameToId(name: string): string {
  return name.trim().replace(/ +/g, "-");
}

const ALLOWED = /^[A-Za-z0-9._ -]*$/;

/** The name with accents dropped and anything else outside the set removed. */
function plainExample(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .trim();
}

/** The refusal for one typed name on its own, or null when it is fine. */
export function nameError(name: string): string | null {
  if (name.trim() === "") return "Type a name.";
  if (!ALLOWED.test(name)) {
    const example = plainExample(name) || "Penaflor";
    return `Letters, digits, dot and space only. Type '${example}'.`;
  }
  const n = bytes(nameToId(name));
  if (n > MAX_ID_BYTES)
    return `At most ${MAX_ID_BYTES} characters on chain; this one is ${n}.`;
  return null;
}

export function titleError(title: string): string | null {
  const n = bytes(title.trim());
  if (n === 0) return "Type the election's title.";
  if (n > MAX_TITLE_BYTES)
    return `At most ${MAX_TITLE_BYTES} bytes; this one is ${n}.`;
  return null;
}

export type FormPosition = { name: string; candidates: string[] };
export type ElectionForm = { title: string; positions: FormPosition[] };

export const EMPTY_FORM: ElectionForm = {
  title: "",
  positions: [{ name: "", candidates: ["", ""] }],
};

/** Every refusal in the form, keyed by field: "title", "p0", "p0c1". */
export type FormErrors = Record<string, string>;

/** The first earlier name in `names` whose id equals this one's without case. */
function duplicateOf(names: string[], i: number): string | null {
  const id = nameToId(names[i] ?? "").toLowerCase();
  if (!id) return null;
  for (let j = 0; j < i; j++) {
    if (nameToId(names[j] ?? "").toLowerCase() === id) return names[j] ?? "";
  }
  return null;
}

export function formErrors(form: ElectionForm): FormErrors {
  const errors: FormErrors = {};
  const title = titleError(form.title);
  if (title) errors.title = title;
  const positionNames = form.positions.map((p) => p.name);
  form.positions.forEach((p, i) => {
    const own = nameError(p.name);
    const dup = own ? null : duplicateOf(positionNames, i);
    if (own) errors[`p${i}`] = own;
    else if (dup !== null)
      errors[`p${i}`] =
        `The same id as the position '${dup.trim()}' when capitals are ignored. Use another name.`;
    const posId = nameToId(p.name);
    p.candidates.forEach((c, j) => {
      const key = `p${i}c${j}`;
      const ownC = nameError(c);
      if (ownC) {
        errors[key] = ownC;
        return;
      }
      const dupC = duplicateOf(p.candidates, j);
      if (dupC !== null) {
        errors[key] =
          `The same id as '${dupC.trim()}' in this position when capitals are ignored. Use another name.`;
        return;
      }
      const pair = bytes(posId) + bytes(nameToId(c));
      if (posId && pair > MAX_PAIR_BYTES)
        errors[key] =
          `The position and candidate together are at most ${MAX_PAIR_BYTES} characters on chain; these are ${pair}. Shorten one.`;
    });
  });
  return errors;
}

/** The exact body the console decodes (it refuses unknown fields). */
export function requestOf(form: ElectionForm) {
  return {
    title: form.title.trim(),
    positions: form.positions.map(
      (p): LivePosition => ({
        id: nameToId(p.name),
        candidates: p.candidates.map(nameToId),
      }),
    ),
    trustees: DEMO_TRUSTEES,
    threshold: DEMO_THRESHOLD,
  };
}

/** The body for retrying setup: valid, though the console does not use it. */
export function retryRequestOf(view: LiveElectionView) {
  return {
    title: view.title,
    positions: view.positions ?? [],
    trustees: view.trustees,
    threshold: view.threshold,
  };
}

// --- the Close voting confirm ------------------------------------------------------

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The voter list's own counts (`GET /api/live/voter-list`), when the page holds them. */
export type DeskCounts = {
  at_desk?: number;
  approved?: number;
  signed?: number;
};

/** "1 voter is" / "2 voters are". */
const voters = (n: number, verbOne: string, verbMany: string) =>
  `${n} ${plural(n, "voter", "voters")} ${plural(n, verbOne, verbMany)}`;

/**
 * The check-in sentences before Close voting, from the voter list's counts:
 * who is at the desk, approved and not signed, or signed with no credential.
 * Each number is the console's own; none is computed here.
 */
function deskLines(desk: DeskCounts | undefined): string[] {
  const out: string[] = [];
  const atDesk = num(desk?.at_desk);
  const approved = num(desk?.approved);
  const signed = num(desk?.signed);
  if (atDesk)
    out.push(
      `${voters(atDesk, "is", "are")} at the desk, waiting for the Electoral Board.`,
    );
  if (approved)
    out.push(
      `${voters(approved, "is", "are")} approved and ${plural(approved, "has", "have")} not signed yet.`,
    );
  if (signed)
    out.push(
      `${signed} ${plural(signed, "voter", "voters")} signed the list and ${plural(signed, "has", "have")} no credential yet.`,
    );
  return out;
}

/**
 * The Close voting confirm's sentences, in numbers from the view (and the
 * voter list's counts when the page holds them). It stands before a step
 * that cannot be undone, so every sentence must be true in every case: it
 * speaks of the voters on the list and the credentials the console counts,
 * never of accounts, and states the console's numbers side by side rather
 * than subtracting them; it speaks of ballot records, and names whole
 * ballots only as a conditional, because the relay is anonymous and a member
 * may have sent only some positions (D11). Impossible numbers are said,
 * never clamped away.
 */
export function closeConsequence(
  view: LiveElectionView,
  desk?: DeskCounts,
): string[] {
  const c = view.counts;
  const positions = positionCount(view);
  const end = "This cannot be undone.";
  const onList = num(c?.voters_on_list);
  const listed = onList ?? num(c?.voters_on_roll);
  const checkedIn = num(c?.checked_in);
  const issued = num(c?.credentials_issued);
  const records = num(c?.ballot_records);
  if (
    !c ||
    listed === undefined ||
    issued === undefined ||
    records === undefined
  ) {
    return [
      "The console sent no counts, so this page cannot say who has not voted.",
      end,
    ];
  }
  const src =
    c.ballot_records_source === "chain" ? "" : " (from the console's record)";
  const expected = issued * positions;
  const out: string[] = [];
  if (issued > listed) {
    out.push(
      `The console counts ${issued} ${plural(issued, "credential", "credentials")} issued for ${listed} ${plural(listed, "voter", "voters")}. Look into this before closing.`,
    );
  }
  if (records > expected) {
    out.push(
      `The console counts ${records} ballot records${src} where ${expected} are expected. Look into this before closing.`,
    );
  }
  if (out.length > 0) return [...out, end];

  if (issued === 0) {
    return [
      "No credential has been issued, so no ballot has been cast.",
      ...deskLines(desk),
      end,
    ];
  }
  if (onList !== undefined) {
    const checked = checkedIn === undefined ? "" : `${checkedIn} checked in, `;
    out.push(
      `${onList} ${plural(onList, "voter", "voters")} on the list: ${checked}${issued} with a credential.`,
    );
  } else {
    out.push(
      `${issued} ${plural(issued, "credential", "credentials")} issued for ${listed} ${plural(listed, "voter", "voters")}.`,
    );
  }
  out.push(...deskLines(desk));
  const missing = expected - records;
  if (missing === 0) {
    out.push(`All ${expected} expected ballot records have arrived${src}.`);
  } else {
    out.push(
      `${missing} of ${expected} expected ballot records have not arrived${src}.`,
    );
    if (positions > 0 && missing % positions === 0) {
      const k = missing / positions;
      out.push(
        `That is ${k} whole ${plural(k, "ballot", "ballots")} if every voter sent a whole ballot.`,
      );
    }
  }
  out.push(end);
  return out;
}

// --- the "Now" panel ---------------------------------------------------------------

export type NowRow = {
  key: string;
  label: string;
  value: string;
  note?: string;
};

/** States in which a ballot count means something. */
const COUNTED = new Set(["open", "closed", "tallied", "verified"]);

/**
 * The rows, each from one count the console sent. With a voter list:
 * "Voters on the list", "Checked in: X of N", "Credentials issued". An
 * election from an older console without the list counts says "Voters"
 * (`voters_on_roll`) and "Credentials issued".
 */
export function nowRows(view: LiveElectionView): NowRow[] {
  const c: LiveCounts | undefined = view.counts;
  const rows: NowRow[] = [];
  if (!c) return rows;
  const onList = num(c.voters_on_list);
  const onRoll = num(c.voters_on_roll);
  const checkedIn = num(c.checked_in);
  const issued = num(c.credentials_issued);
  if (onList !== undefined)
    rows.push({ key: "list", label: "Voters on the list", value: `${onList}` });
  else if (onRoll !== undefined)
    rows.push({ key: "voters", label: "Voters", value: `${onRoll}` });
  if (checkedIn !== undefined)
    rows.push({
      key: "checked",
      label: "Checked in",
      value:
        onList !== undefined ? `${checkedIn} of ${onList}` : `${checkedIn}`,
    });
  if (issued !== undefined)
    rows.push({
      key: "issued",
      label: "Credentials issued",
      value: `${issued}`,
    });
  const records = num(c.ballot_records);
  const positions = positionCount(view);
  if (COUNTED.has(view.state) && records !== undefined) {
    // "X of Y expected": the console counts records, one per position per
    // issued credential; the relay is anonymous, so no whole-ballot figure
    // (design review D6 as changed by the user on 2026-11-15). Never clamped.
    const expected =
      issued !== undefined && positions > 0 ? issued * positions : undefined;
    // No credential: "0 of 0 expected" says nothing; say why there are none,
    // in words true for the state ("yet" only while voting is open).
    const none = issued === 0 && records === 0;
    const notes = [
      none
        ? view.state === "open"
          ? "No credential has been issued yet, so no ballot can be cast."
          : "No credential was issued in this election, so no ballot was cast."
        : undefined,
      c.ballot_records_source === "chain"
        ? undefined
        : "From the console's record, the chain did not answer.",
    ].filter((n): n is string => !!n);
    rows.push({
      key: "records",
      label: "Ballot records",
      value:
        expected === undefined || none
          ? `${records}`
          : `${records} of ${expected} expected`,
      note: notes.length > 0 ? notes.join(" ") : undefined,
    });
  }
  const joined = num(c.trustees_joined);
  if (joined !== undefined)
    rows.push({
      key: "joined",
      label: "Trustees joined",
      value: `${joined} of ${view.trustees}`,
    });
  return rows;
}

// --- links ---------------------------------------------------------------------------

/** The voter page's full address from the page's own origin, port included. */
export function voterAddress(origin: string): string {
  return `${origin.replace(/\/$/, "")}/vote/`;
}

/**
 * The demo's trustee page addresses. The console does not tell an admin where
 * the trustee processes are, so they follow the demo's convention: host
 * `vote.<domain>` becomes `t<N>.<domain>`, port `9000 + N`, path `/trustee/`.
 * Empty when the page's host does not start with `vote.`.
 */
export function trusteeAddresses(
  protocol: string,
  hostname: string,
  count: number,
): string[] {
  if (!hostname.startsWith("vote.")) return [];
  const domain = hostname.slice("vote.".length);
  return Array.from(
    { length: count },
    (_, i) => `${protocol}//t${i + 1}.${domain}:${9000 + i + 1}/trustee/`,
  );
}

// --- demonstration: one changed byte ------------------------------------------------

function readVarint(b: Uint8Array, at: number): [number, number] | null {
  let value = 0;
  let shift = 0;
  let i = at;
  while (i < b.length) {
    const byte = b[i++]!;
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return [value, i];
    shift += 7;
    if (shift > 49) return null;
  }
  return null;
}

/** The [start, end) of field `want`'s length-delimited bytes in `b[from, to)`. */
function findField(
  b: Uint8Array,
  from: number,
  to: number,
  want: number,
): [number, number] | null {
  let i = from;
  while (i < to) {
    const tag = readVarint(b, i);
    if (!tag) return null;
    const [key, next] = tag;
    i = next;
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      const v = readVarint(b, i);
      if (!v) return null;
      i = v[1];
    } else if (wire === 1) {
      i += 8;
    } else if (wire === 5) {
      i += 4;
    } else if (wire === 2) {
      const len = readVarint(b, i);
      if (!len) return null;
      const start = len[1];
      const end = start + len[0];
      if (end > to) return null;
      if (field === want) return [start, end];
      i = end;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * The byte offset of the last byte of the ballot's nullifier value
 * (`Ballot.credential_presentation` = 6, `CredentialPresentation.nullifier`
 * = 5, `Nullifier.value` = 2; saksi wire.proto), or null if the record does
 * not decode that far.
 *
 * Why there: the chaincode checks the nullifier before the CDS proofs, so a
 * recorded ballot with a changed proof byte is refused as a double vote. A
 * changed nullifier byte passes the issuer and credential gates (the
 * signature covers the commitment, not the nullifier) and the nullifier gate
 * (the new value is unspent), and reaches the CDS check, whose Fiat-Shamir
 * context is bound to the nullifier: gate `cds`. The console's decoder still
 * reads the record, so it is relayed, not turned away.
 */
export function nullifierByteOffset(ballot: Uint8Array): number | null {
  const pres = findField(ballot, 0, ballot.length, 6);
  if (!pres) return null;
  const nul = findField(ballot, pres[0], pres[1], 5);
  if (!nul) return null;
  const value = findField(ballot, nul[0], nul[1], 2);
  if (!value || value[1] <= value[0]) return null;
  return value[1] - 1;
}

export function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** The ballot hex with its nullifier's last byte flipped (xor 0x01). */
export function flipNullifierByte(
  ballotHex: string,
): { hex: string; offset: number } | null {
  const b = hexToBytes(ballotHex);
  if (!b) return null;
  const offset = nullifierByteOffset(b);
  if (offset === null) return null;
  b[offset] = b[offset]! ^ 0x01;
  return { hex: bytesToHex(b), offset };
}

export { idToName };
