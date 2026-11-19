/**
 * The live board's model: what the board answer (`live`) and the election
 * view say, merged into one value, and the band (design review D4, D7, D8,
 * D18) that states it.
 *
 * Rule: never invent a number. Every figure below comes from a named field of
 * the console's answers; where a count is not carried, the figure is the
 * state in words (D18) and the sentence is written without it.
 */
import type { ChipVariant } from "@balotachain/ui";
import type {
  Board,
  BoardCheck,
  BoardContest,
  LiveBoardDecryption,
  LiveCounts,
  LiveElectionView,
  LivePosition,
} from "../lib/bulletin";

/**
 * The precinct's voter list as the console states it (voter-list-api.md,
 * "Counts in the election view and on the board"): the label, the
 * fingerprint, the console's sentence and its counts. Never a name or a date.
 * A count the console did not send as a number is null and is not shown.
 */
export type VoterListFacts = {
  precinctLabel: string;
  fingerprint: string;
  fingerprintShort: string;
  /** `voter_list_note`, the board's sentence; "" when not sent. */
  note: string;
  onList: number | null;
  checkedIn: number | null;
  credentialsIssued: number | null;
};

export type LiveModel = {
  /** Null when no election is running. */
  runId: string | null;
  /** The live state, or "none" when no election is running. */
  state: string;
  title: string;
  /** This run is the console's current election (its counts can be from the chain). */
  current: boolean;
  counts: LiveCounts | null;
  trustees: number | null;
  threshold: number | null;
  /** `counts.trustees_joined`, only when the console sends it as a number. */
  trusteesJoined: number | null;
  jointKey: string;
  roster: string;
  ceremonyError: string;
  failedChecks: string[];
  verifyOverall: string;
  decryption: LiveBoardDecryption | null;
  positions: LivePosition[];
  contests: BoardContest[];
  checks: BoardCheck[];
  /** Public files, served once the tally is published. */
  files: string[];
  /** Null for an election without a voter list (made by an older console). */
  voterList: VoterListFacts | null;
  /**
   * The below-minimum chain count at `closed` has held for `STUCK_HOLD_MS`
   * on this page (set by the page from `nextStuckHold`; false otherwise).
   */
  stuckHeld?: boolean;
};

export const NO_ELECTION: LiveModel = {
  runId: null,
  state: "none",
  title: "",
  current: true,
  counts: null,
  trustees: null,
  threshold: null,
  trusteesJoined: null,
  jointKey: "",
  roster: "",
  ceremonyError: "",
  failedChecks: [],
  verifyOverall: "",
  decryption: null,
  positions: [],
  contests: [],
  checks: [],
  files: [],
  voterList: null,
};

/** The first of `values` that is a number, or null: never a made-up 0. */
export function countOf(...values: unknown[]): number | null {
  for (const v of values) if (typeof v === "number") return v;
  return null;
}

/** "president/alice" -> positions in contest order, candidates under each. */
export function positionsFromContests(ids: string[]): LivePosition[] {
  const out: LivePosition[] = [];
  for (const id of ids) {
    const cut = id.indexOf("/");
    const pos = cut < 0 ? id : id.slice(0, cut);
    const cand = cut < 0 ? "" : id.slice(cut + 1);
    let p = out.find((x) => x.id === pos);
    if (!p) {
      p = { id: pos, candidates: [] };
      out.push(p);
    }
    if (cand) p.candidates.push(cand);
  }
  return out;
}

const num = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) ? n : null;

/**
 * The list's facts, from the board's `live` object or else the election view
 * of the same run. An election shows them only when the console sends both a
 * precinct label and a fingerprint: without them it has no list, and the page
 * shows nothing about one (no placeholder numbers).
 */
export function voterListOf(
  live: Board["live"] | null,
  view: LiveElectionView | null,
  counts: LiveCounts | null,
): VoterListFacts | null {
  const label = live?.precinct_label || view?.precinct_label || "";
  const full =
    live?.voter_list_fingerprint || view?.voter_list_fingerprint || "";
  if (!label || !full) return null;
  const short =
    live?.voter_list_fingerprint_short ||
    view?.voter_list_fingerprint_short ||
    full.slice(0, 16);
  return {
    precinctLabel: label,
    fingerprint: full,
    fingerprintShort: short,
    note: live?.voter_list_note ?? "",
    onList: num(counts?.voters_on_list),
    checkedIn: num(counts?.checked_in),
    credentialsIssued: num(counts?.credentials_issued),
  };
}

function joinedOf(counts: LiveCounts | undefined | null): number | null {
  const n = counts?.trustees_joined;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Merge the board answer and the election view. The view is used only when
 * it is about the same run; the board's `live` object wins where both carry a
 * field (they are built from the same snapshot).
 */
export function buildModel(
  board: Board | null,
  view: LiveElectionView | null,
): LiveModel {
  const runId = board?.election_id ?? view?.run_id ?? null;
  if (runId === null) return NO_ELECTION;
  const v = view && view.run_id === runId ? view : null;
  const live = board?.live ?? null;
  const counts = live?.counts ?? v?.counts ?? null;
  const contestIds = live?.contest_ids ?? v?.contest_ids ?? [];
  const positions =
    v?.positions && v.positions.length > 0
      ? v.positions
      : positionsFromContests(contestIds);
  const files = board && !board.sealed ? (board.files ?? []) : [];
  return {
    runId,
    state: live?.state ?? v?.state ?? board?.status ?? "",
    title: live?.title ?? v?.title ?? board?.name ?? "",
    current: v !== null,
    counts,
    trustees: live?.decryption?.trustees ?? v?.trustees ?? null,
    threshold: live?.decryption?.threshold ?? v?.threshold ?? null,
    trusteesJoined: joinedOf(live?.counts) ?? joinedOf(v?.counts),
    jointKey: live?.joint_key_fingerprint ?? v?.joint_key_fingerprint ?? "",
    roster: live?.roster_fingerprint ?? v?.roster_fingerprint ?? "",
    ceremonyError: v?.ceremony_error ?? "",
    failedChecks: live?.failed_checks ?? [],
    verifyOverall: live?.verify_overall ?? v?.verify_overall ?? "",
    decryption: live?.decryption ?? null,
    positions,
    contests: board?.contests ?? [],
    checks: board?.checks ?? [],
    files,
    voterList: voterListOf(live, v, counts),
  };
}

/** States after voting opened, where a ballot count means something. */
const COUNTED = new Set(["open", "closed", "tallied", "verified", "abandoned"]);

/**
 * In a state where a ballot count means something, the count is not the
 * chain's: the console's own count, or no count at all. Only a count with
 * `ballot_records_source: "chain"` is evidence from the chain.
 */
export function countFromConsole(m: LiveModel): boolean {
  return COUNTED.has(m.state) && m.counts?.ballot_records_source !== "chain";
}

/** The verifier failed: named failed checks, or an overall that is not a pass. */
export function checksFailed(m: LiveModel): boolean {
  return (
    m.failedChecks.length > 0 ||
    (m.verifyOverall !== "" && m.verifyOverall !== "pass")
  );
}

/**
 * The word "verified" may appear only in state `verified`, with no failed
 * checks, and with the count from the chain. Everything else the page shows
 * goes through `sayable`.
 */
export function maySayVerified(m: LiveModel): boolean {
  return m.state === "verified" && !checksFailed(m) && !countFromConsole(m);
}

/**
 * Console text (check details) can carry the word "verified" ("not verified
 * yet"). While the count is not from the chain the page may not say it, so it
 * reads "checked" there instead.
 */
export function sayable(text: string, m: LiveModel): string {
  return countFromConsole(m) ? text.replace(/\bverified\b/gi, "checked") : text;
}

export type BandVariant =
  | "none"
  | "setup"
  | "ceremony"
  | "open"
  | "closed"
  | "tallied"
  | "verified"
  | "failed"
  | "abandoned"
  | "other";

export type Band = {
  variant: BandVariant;
  heading: string;
  /** The one figure: a number and its words. Null: the heading is the figure. */
  figure: { value: number; words: string } | null;
  lines: string[];
  chip: { variant: ChipVariant; word: string };
  /** The count is the console's, not the chain's (D8). */
  fromConsole: boolean;
  /** Show the link to the chain record in the band (abandoned). */
  recordLink: boolean;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function recordsWords(n: number, tail: string): string {
  return `${plural(n, "ballot record", "ballot records")} ${tail}`;
}

/**
 * The two numbers behind `closedTooFew`, before the hold: `closed`, a count
 * from the chain that is a finite number of 0 or more, and below the
 * console's minimum. The console's own count can lag or be 0 while the chain
 * is not read, so it never makes the claim (review of the rehearsal 5 round).
 */
export function closedBelowMinimum(
  m: LiveModel,
): { have: number; min: number } | null {
  if (m.state !== "closed") return null;
  const c = m.counts;
  if (c?.ballot_records_source !== "chain") return null;
  const have = c.ballot_records;
  const min = c.min_ballot_records;
  if (typeof have !== "number" || !Number.isFinite(have) || have < 0)
    return null;
  if (typeof min !== "number" || !Number.isFinite(min)) return null;
  return have < min ? { have, min } : null;
}

/**
 * The stuck sentence waits this long at `closed`: the console's chain count
 * can be a few seconds old, and no ballot can be added after Close.
 */
export const STUCK_HOLD_MS = 6000;

export type StuckHold = {
  id: string | null;
  since: number | null;
  stuck: boolean;
};

export const NO_HOLD: StuckHold = { id: null, since: null, stuck: false };

/**
 * One poll's step of the hold: low on every poll since `since`, for at
 * least `STUCK_HOLD_MS`. Any other poll starts it again.
 */
export function nextStuckHold(
  prev: StuckHold,
  m: LiveModel,
  now: number,
): StuckHold {
  const id = m.runId;
  if (id === null || !closedBelowMinimum(m))
    return { id, since: null, stuck: false };
  const since = prev.id === id && prev.since !== null ? prev.since : now;
  return { id, since, stuck: now - since >= STUCK_HOLD_MS };
}

/**
 * Rehearsal 5, I2: closed with fewer ballot records than the console says
 * decryption needs. One sentence from the two numbers the console sent; null
 * without the field (an older console), with enough records, or before the
 * hold has passed. The public board names no operator step.
 */
export function closedTooFew(m: LiveModel): string | null {
  const b = closedBelowMinimum(m);
  if (!b || !m.stuckHeld) return null;
  const { have, min } = b;
  return `This election was closed with ${have} ${plural(have, "ballot record", "ballot records")}, and decryption needs at least ${min}, so it cannot be decrypted. No result will be published for it.`;
}

export function bandFor(m: LiveModel): Band {
  const failed = checksFailed(m);
  const records = m.counts?.ballot_records ?? 0;
  const base = (
    variant: BandVariant,
    heading: string,
    chip: Band["chip"],
    figure: Band["figure"] = null,
    lines: string[] = [],
  ): Band => ({
    variant,
    heading,
    figure,
    lines,
    chip,
    fromConsole: false,
    recordLink: false,
  });

  let band: Band;
  switch (m.state) {
    case "none":
      return base(
        "none",
        "No election is running",
        { variant: "neutral", word: "No election" },
        null,
        ["The board fills in when the presenter creates one."],
      );
    case "setup":
      return base(
        "setup",
        "Election created",
        { variant: "neutral", word: "Created" },
        null,
        ["The chain has not recorded the election yet."],
      );
    case "ceremony": {
      const all = m.trustees;
      const lines: string[] = [];
      if (all !== null) {
        lines.push(`The election key appears when all ${all} have joined.`);
      }
      if (m.ceremonyError) {
        lines.push(
          `The chain refused the key ceremony's record: ${m.ceremonyError}`,
        );
      }
      const figure =
        m.trusteesJoined !== null && all !== null
          ? { value: m.trusteesJoined, words: `of ${all} trustees joined` }
          : null;
      return base(
        "ceremony",
        "Key ceremony",
        { variant: "active", word: "Key ceremony" },
        figure,
        lines,
      );
    }
    case "open":
      band = base(
        "open",
        "Voting is open",
        { variant: "active", word: "Voting open" },
        { value: records, words: recordsWords(records, "on chain") },
      );
      break;
    case "closed": {
      const few = closedTooFew(m);
      if (few) {
        band = base(
          "closed",
          "Voting is closed",
          { variant: "neutral", word: "Voting closed" },
          null,
          [few],
        );
        break;
      }
      // The console's own count only; none, no figure.
      const k = countOf(
        m.decryption?.trustees_decrypted,
        m.counts?.trustees_decrypted,
      );
      band = base(
        "closed",
        "Voting is closed",
        { variant: "neutral", word: "Voting closed" },
        m.threshold !== null && k !== null
          ? {
              value: k,
              words: `of ${m.threshold} trustee ${plural(m.threshold, "share", "shares")} recorded`,
            }
          : null,
      );
      break;
    }
    case "tallied":
    case "verified":
      if (failed) {
        const k = m.failedChecks.length;
        band = base(
          "failed",
          "Result NOT verified",
          { variant: "error", word: "Not verified" },
          k > 0
            ? { value: k, words: plural(k, "check failed", "checks failed") }
            : null,
          [
            "The results are published, not verified. The failed checks are listed below.",
          ],
        );
      } else if (m.state === "tallied") {
        band = base(
          "tallied",
          "Result published, checking",
          { variant: "active", word: "Checking" },
          null,
          ["The totals are published and have not been checked yet."],
        );
      } else {
        // The same figure and field as the open band: the console publishes
        // no count of the verifier's own checks, and the board's check list
        // is a summary, so the band counts the ballot records on chain.
        band = base(
          "verified",
          "Result verified",
          { variant: "success", word: "Verified" },
          { value: records, words: recordsWords(records, "on chain") },
          ["The verifier passed the record on chain."],
        );
      }
      break;
    case "abandoned":
      band = base(
        "abandoned",
        "Election abandoned",
        { variant: "warning", word: "Abandoned" },
        null,
        [
          `No result will be published for this election. ${records} ${recordsWords(records, "stay on chain.")}`,
        ],
      );
      band.recordLink = true;
      break;
    default:
      return base("other", m.state || "Unknown state", {
        variant: "neutral",
        word: m.state || "Unknown",
      });
  }

  if (!countFromConsole(m)) return band;

  // D8: the chain did not answer. The band keeps the state's heading, the
  // figure is the console's count, and the word "verified" goes.
  const why = !m.counts
    ? "The board has no ballot count from the chain for this election."
    : m.current
      ? "The chain did not answer. This count is not from the chain. Trying again every few seconds."
      : "This is not the console's current election, so this count is from the console's record, not from the chain.";
  const out: Band = {
    ...band,
    fromConsole: true,
    // No counts at all: no figure, never a made-up zero.
    figure: m.counts
      ? {
          value: records,
          words: recordsWords(records, "in the console's record"),
        }
      : null,
    lines: [why],
  };
  if (band.variant === "abandoned") {
    out.lines = ["No result will be published for this election.", why];
  } else if (band.variant === "verified") {
    out.heading = "Result published";
    out.chip = { variant: "active", word: "Published" };
  } else if (band.variant === "failed") {
    out.heading = "Result failed its checks";
    out.chip = { variant: "error", word: "Checks failed" };
    out.lines = [
      "The results are published and did not pass their checks.",
      why,
    ];
  }
  return out;
}

/** "Board <chip word> - BalotaChain" (D13). */
export function liveTitle(band: Band): string {
  return `Board ${band.chip.word} - BalotaChain`;
}

/**
 * The one sentence the results show when they show no totals: before the
 * tally is published, and (m3, rehearsal 4) after it until the result may be
 * called verified (`showTotals`).
 */
export function resultsSentence(m: LiveModel): string {
  switch (m.state) {
    case "none":
      return "No election is running, so there are no results.";
    case "setup":
    case "ceremony":
      return "Voting has not opened yet. The totals appear after voting closes and the trustees decrypt the tally.";
    case "open":
      return "Ballots stay sealed while voting is open. The totals appear after the trustees decrypt the tally.";
    case "closed":
      return (
        closedTooFew(m) ??
        "Voting has closed. The totals appear when the trustees have decrypted and the tally is published."
      );
    case "abandoned":
      return "This election was abandoned. No result will be published.";
    case "tallied":
    case "verified":
      if (checksFailed(m))
        return "The result is published, but a check failed, so the board does not show its totals.";
      if (countFromConsole(m))
        return "The result is published on the chain, but the ballot count now comes from the console's record because the chain did not answer, so the board does not show the totals until it answers again.";
      if (m.state === "tallied")
        return "The result is published on the chain and is being checked. The totals appear here once the check passes.";
      return "The tally is published, but the board could not read its totals.";
    default:
      return "There are no results to show.";
  }
}

/**
 * m3 (rehearsal 4): the totals and the winners are shown only once the result
 * may be called verified, on the same condition as the word itself. At
 * `tallied` the results say the result is published and being checked.
 */
export function showTotals(m: LiveModel): boolean {
  return maySayVerified(m) && m.contests.length > 0;
}

/** What the results heading says about the published totals. */
export function resultsMark(m: LiveModel): string {
  if (m.state !== "tallied" && m.state !== "verified") return "";
  if (checksFailed(m)) {
    return countFromConsole(m)
      ? "published, checks failed"
      : "published, not verified";
  }
  if (m.state === "tallied") return "published, checking";
  return maySayVerified(m) ? "published and verified" : "published";
}

/** Before voting opens the tracking-code check is disabled (D7). */
export function checkDisabledReason(m: LiveModel): string | undefined {
  if (m.state === "none" || m.state === "setup" || m.state === "ceremony") {
    return "Opens when voting opens.";
  }
  return undefined;
}
