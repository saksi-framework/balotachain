/**
 * The admin wizard's pure model: the election form and its mapping to the
 * console's ElectionConfig, the instant-feedback mirror of Validate(), the SSE
 * progress reducer, and labels. No I/O — App.tsx owns the calls.
 */
import type {
  Ceremony,
  ConsoleEvent,
  Distribution,
  ElectionConfig,
  RunView,
} from "./bulletin";
import type { ChipVariant } from "../components/Chip";

/** Number fields stay strings while typed, so a field can be cleared. */
export type ElectionForm = {
  name: string;
  trustees: string[];
  threshold: string;
  positions: string;
  candidates: string;
  senateSeats: string;
  voters: string;
  distribution: Distribution;
  /** Ground-truth mode has no ceremony, so the admin wizard does not offer it. */
  mode: "offline" | "onchain";
};

export const DEFAULT_FORM: ElectionForm = {
  name: "Campus Election",
  // The console wizard's own default roster (web/wizard.html).
  trustees: [
    "COMELEC",
    "Civil Society Watch",
    "University IT",
    "Academe Observer",
    "Bar Association",
  ],
  threshold: "3",
  positions: "3",
  candidates: "4",
  senateSeats: "2",
  voters: "100",
  distribution: "uniform",
  mode: "offline",
};

/** config.go MaxTrustees. */
export const MAX_TRUSTEES = 15;
/** config.go OfflineVoterCeiling. */
const OFFLINE_VOTER_CEILING = 10000;

function int(s: string): number {
  const n = Number.parseInt(s.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

export function toElectionConfig(f: ElectionForm): ElectionConfig {
  return {
    name: f.name.trim(),
    trustees: f.trustees.map((name) => ({ name: name.trim() })),
    threshold: int(f.threshold),
    positions: int(f.positions),
    candidates: int(f.candidates),
    senate_seats: int(f.senateSeats),
    voters: int(f.voters),
    distribution: f.distribution,
    mode: f.mode,
  };
}

/**
 * The first violation, worded exactly as `ElectionConfig.Validate` words it, or
 * null. Instant feedback only: the server's 400 is the gate, and it also runs
 * checks this cannot (the validation ladder, the disk guard, a missing Fabric
 * network).
 */
export function validateConfig(c: ElectionConfig): string | null {
  if (c.name.trim() === "") return "election name must not be empty";
  const n = c.trustees.length;
  if (n < 1 || n > MAX_TRUSTEES) {
    return `trustees must be between 1 and ${MAX_TRUSTEES} (got ${n})`;
  }
  if (c.threshold < 1 || c.threshold > n) {
    return `threshold must be 1..=${n} (got ${c.threshold})`;
  }
  const blank = c.trustees.findIndex((t) => t.name.trim() === "");
  if (blank >= 0) return `trustee ${blank + 1} has an empty name`;
  if (c.positions < 1 || c.candidates < 1 || c.voters < 1) {
    return "positions, candidates, voters must each be >= 1";
  }
  if (c.senate_seats < 0 || c.senate_seats >= c.candidates) {
    return `senate seats must be 0..${c.candidates - 1} (got ${c.senate_seats})`;
  }
  if (c.mode === "offline" && c.voters > OFFLINE_VOTER_CEILING) {
    return `offline mode is capped at ${OFFLINE_VOTER_CEILING} voters (got ${c.voters}); use ground-truth mode for larger tiers until the streaming generator lands`;
  }
  return null;
}

export type Progress = {
  status: "idle" | "running" | "done" | "error";
  lines: string[];
  /** Ledger commits seen on the stream: lifecycle steps plus ballots. */
  receipts: number;
  error: string | null;
};

export const IDLE_PROGRESS: Progress = {
  status: "idle",
  lines: [],
  receipts: 0,
  error: null,
};

const MAX_LINES = 50;
/** `lifecycle` step: "%s %s committed: block %d tx %s" (executor.go). */
const STEP_COMMITTED = / committed: block \d+/;
/** `submitBallots`: "%d ballots committed in %s" (executor.go). */
const BALLOTS_COMMITTED = /^(\d+) ballots committed/;

/**
 * Folds one console `Event` into a phase's progress. Terminal states stick: a
 * line that arrives after `done` or `error` is kept but does not reopen it.
 * The stream has no replay, so this is display only — polls decide outcomes.
 */
export function reduceProgress(
  p: Progress,
  e: ConsoleEvent,
  phase: string,
): Progress {
  if (e.phase !== phase) return p;
  const ballots = BALLOTS_COMMITTED.exec(e.msg);
  const receipts =
    p.receipts +
    (ballots ? Number(ballots[1]) : STEP_COMMITTED.test(e.msg) ? 1 : 0);
  const lines = [...p.lines, e.msg].slice(-MAX_LINES);
  if (e.level === "error") {
    return { status: "error", lines, receipts, error: e.msg };
  }
  if (e.level === "done") {
    return {
      ...p,
      status: p.status === "error" ? "error" : "done",
      lines,
      receipts,
    };
  }
  return { ...p, lines, receipts };
}

/** `ph_position_id` (saksi-auditor fixtures.rs) rendered by `posLabel` (board.go). */
export function positionLabels(count: number): string[] {
  const known = ["President", "Vice President", "Senator"];
  return Array.from({ length: Math.max(0, count) }, (_, p) =>
    p < known.length ? known[p] : `Position ${p}`,
  );
}

const POSITION_LABEL: Record<string, string> = {
  president: "President",
  "vice-president": "Vice President",
  senator: "Senator",
};

/** Contest id "<position>/cand<N>" → "President · Candidate N+1" (board.go). */
export function contestLabel(contest: string): string {
  const [pos = "", cand = ""] = contest.split("/");
  const posNum = /^position-(\d+)$/.exec(pos);
  const candNum = /^cand(\d+)$/.exec(cand);
  const p =
    POSITION_LABEL[pos] ??
    (posNum ? `Position ${posNum[1]}` : pos.replace(/-/g, " "));
  const c = candNum ? `Candidate ${Number(candNum[1]) + 1}` : cand;
  return c ? `${p} · ${c}` : p;
}

export type Step = 1 | 2 | 3 | 4 | 5;

/**
 * Where to reopen an existing run: the furthest step it has reached, which is
 * also the step of a phase running on it now. `ready` means the election is
 * closed, so a bundled but unclosed election (still recording, interrupted, or
 * failed mid-run) stays on the Run step rather than opening the ceremony.
 */
export function stepFor(run: RunView, ceremony: Ceremony | null): Step {
  if (run.artifacts?.includes("correctness.csv")) return 5;
  if (ceremony?.published) return 5;
  if (ceremony?.ready) return 4;
  if (run.status === "interrupted" || run.status === "close-pending") return 3;
  // Trustee contest counts are read from bundle.json, which the Run phase
  // writes first; the view exposes no other sign of it.
  if (ceremony?.trustees?.some((t) => t.contests > 0)) return 3;
  return 2;
}

/** The runs list's status chip, the wizard's runStatus in admin words. */
export function runState(run: RunView): {
  label: string;
  variant: ChipVariant;
  detail?: string;
} {
  if (run.busy) {
    return {
      label: run.paused_stage ? `Paused at ${run.paused_stage}` : "Running",
      variant: "neutral",
    };
  }
  if (run.status === "failed") {
    return {
      label: "Failed",
      variant: "error",
      ...(run.reason ? { detail: run.reason } : {}),
    };
  }
  if (run.status === "interrupted" || run.status === "close-pending") {
    return { label: "Interrupted", variant: "warn" };
  }
  const has = (a: string) => run.artifacts?.includes(a) ?? false;
  if (has("correctness.csv")) return { label: "Verified", variant: "success" };
  if (has("election.csv")) return { label: "Generated", variant: "neutral" };
  return { label: "Not generated", variant: "warn" };
}
