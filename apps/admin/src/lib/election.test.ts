import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORM,
  IDLE_PROGRESS,
  contestLabel,
  positionLabels,
  reduceProgress,
  runState,
  stepFor,
  toElectionConfig,
  validateConfig,
  type ElectionForm,
  type Progress,
} from "./election";
import type { Ceremony, RunView } from "./bulletin";

const form = (over: Partial<ElectionForm> = {}): ElectionForm => ({
  ...DEFAULT_FORM,
  ...over,
});

describe("form → ElectionConfig", () => {
  it("maps every field, with numbers as numbers", () => {
    const c = toElectionConfig(
      form({
        name: "  Campus Election  ",
        trustees: ["COMELEC", "PPCRV", "NAMFREL"],
        threshold: "2",
        positions: "3",
        candidates: "4",
        senateSeats: "2",
        voters: "100",
        distribution: "skewed",
        mode: "onchain",
      }),
    );
    expect(c).toEqual({
      name: "Campus Election",
      trustees: [{ name: "COMELEC" }, { name: "PPCRV" }, { name: "NAMFREL" }],
      threshold: 2,
      positions: 3,
      candidates: 4,
      senate_seats: 2,
      voters: 100,
      distribution: "skewed",
      mode: "onchain",
    });
    for (const k of [
      "threshold",
      "positions",
      "candidates",
      "senate_seats",
      "voters",
    ] as const) {
      expect(typeof c[k]).toBe("number");
    }
  });

  it("turns a cleared number field into 0 so Validate names it", () => {
    const c = toElectionConfig(form({ voters: "" }));
    expect(c.voters).toBe(0);
    expect(validateConfig(c)).toBe(
      "positions, candidates, voters must each be >= 1",
    );
  });
});

// The server's Validate() is the gate; these mirror its texts so the instant
// feedback and the authoritative 400 never disagree about wording.
describe("validateConfig mirrors config.go Validate", () => {
  const v = (over: Partial<ElectionForm>) =>
    validateConfig(toElectionConfig(form(over)));

  it("accepts the defaults", () => {
    expect(v({})).toBeNull();
  });

  it.each([
    [{ name: " " }, "election name must not be empty"],
    [{ trustees: [] }, "trustees must be between 1 and 15 (got 0)"],
    [
      { trustees: Array.from({ length: 16 }, (_, i) => `T${i}`) },
      "trustees must be between 1 and 15 (got 16)",
    ],
    [{ threshold: "9" }, "threshold must be 1..=5 (got 9)"],
    [
      { trustees: ["A", " ", "C"], threshold: "2" },
      "trustee 2 has an empty name",
    ],
    [{ candidates: "0" }, "positions, candidates, voters must each be >= 1"],
    [
      { candidates: "3", senateSeats: "3" },
      "senate seats must be 0..2 (got 3)",
    ],
    [
      { voters: "10001" },
      "offline mode is capped at 10000 voters (got 10001); use ground-truth mode for larger tiers until the streaming generator lands",
    ],
  ])("%o → %s", (over, message) => {
    expect(v(over)).toBe(message);
  });

  it("does not cap on-chain voters (the ladder and disk gates are server-side)", () => {
    expect(v({ voters: "50000", mode: "onchain" })).toBeNull();
  });
});

describe("SSE progress reducer", () => {
  const ev = (
    phase: string,
    level: "info" | "error" | "done",
    msg: string,
  ) => ({
    phase,
    level,
    msg,
  });
  const run = (events: ReturnType<typeof ev>[]): Progress =>
    events.reduce((p, e) => reduceProgress(p, e, "ceremony"), {
      ...IDLE_PROGRESS,
      status: "running",
    } as Progress);

  it("ignores other phases", () => {
    const p = { ...IDLE_PROGRESS, status: "running" } as Progress;
    expect(reduceProgress(p, ev("generate", "done", "x"), "ceremony")).toBe(p);
  });

  it("collects lines and counts on-chain receipts", () => {
    const p = run([
      ev("ceremony", "info", "preparing the election bundle…"),
      ev("ceremony", "info", "CreateElection  committed: block 5 tx ab"),
      ev("ceremony", "info", "PublishDKGTranscript  committed: block 6 tx cd"),
      ev("ceremony", "info", "submitting 300 ballots (8 in flight)…"),
      ev("ceremony", "info", "300 ballots committed in 4.2s"),
      ev("ceremony", "info", "CloseElection  committed: block 9 tx ef"),
    ]);
    expect(p.status).toBe("running");
    expect(p.receipts).toBe(303);
    expect(p.lines).toHaveLength(6);
    expect(p.lines[0]).toBe("preparing the election bundle…");
  });

  it("finishes on done and fails on error, keeping the message", () => {
    expect(
      run([
        ev("ceremony", "done", "election closed — trustees may now contribute"),
      ]).status,
    ).toBe("done");
    const failed = run([
      ev("ceremony", "error", "connect to Fabric: dial timeout"),
      ev("ceremony", "info", "late line"),
    ]);
    expect(failed.status).toBe("error");
    expect(failed.error).toBe("connect to Fabric: dial timeout");
  });

  it("keeps only the most recent lines", () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      ev("ceremony", "info", `line ${i}`),
    );
    const p = run(many);
    expect(p.lines.length).toBeLessThanOrEqual(50);
    expect(p.lines[p.lines.length - 1]).toBe("line 79");
  });
});

describe("labels", () => {
  it("names positions the way the generator and board do", () => {
    expect(positionLabels(5)).toEqual([
      "President",
      "Vice President",
      "Senator",
      "Position 3",
      "Position 4",
    ]);
    expect(contestLabel("senator/cand0")).toBe("Senator · Candidate 1");
    expect(contestLabel("position-3/cand11")).toBe("Position 3 · Candidate 12");
  });
});

describe("stepFor an existing run", () => {
  const rv = (
    artifacts: string[] | null,
    over: Partial<RunView> = {},
  ): RunView => ({
    run_id: "r",
    created_at: "",
    config: toElectionConfig(DEFAULT_FORM),
    artifacts,
    busy: false,
    status: "open",
    resumable: false,
    was_interrupted: false,
    ...over,
  });
  const cer = (over: Partial<Ceremony>) => over as Ceremony;
  const trustee = (contests: number) => ({
    id: "1",
    name: "COMELEC",
    submitted: false,
    submitting: false,
    contests,
  });
  /** The per-trustee contest counts come from bundle.json. */
  const bundled = { ready: false, published: false, trustees: [trustee(12)] };
  const noBundle = { ready: false, published: false, trustees: [trustee(0)] };

  it("lands on the furthest step the run has reached", () => {
    expect(stepFor(rv(["correctness.csv"]), null)).toBe(5);
    expect(stepFor(rv([]), cer({ ready: true, published: true }))).toBe(5);
    expect(stepFor(rv([]), cer({ ready: true, published: false }))).toBe(4);
    expect(stepFor(rv(null), cer(noBundle))).toBe(2);
    expect(stepFor(rv(null), null)).toBe(2);
  });

  it("keeps a bundled but not yet closed election on the Run step", () => {
    expect(stepFor(rv(["election.csv"]), cer(bundled))).toBe(3);
  });

  it("reopens a busy run at the step of its running phase", () => {
    const busy = rv(["election.csv"], { busy: true });
    expect(stepFor(busy, cer(bundled))).toBe(3);
    expect(stepFor(busy, cer({ ...bundled, ready: true }))).toBe(4);
    expect(
      stepFor(busy, cer({ ...bundled, ready: true, published: true })),
    ).toBe(5);
  });

  it("reopens an interrupted or close-pending run on the Run step", () => {
    for (const status of ["interrupted", "close-pending"] as const) {
      const r = rv(["election.csv"], { status, resumable: true });
      expect(stepFor(r, cer(bundled))).toBe(3);
      expect(stepFor(r, null)).toBe(3);
    }
  });

  it("reopens a failed run where it stopped", () => {
    const failed = rv(["election.csv"], { status: "failed", reason: "boom" });
    expect(stepFor(failed, cer(bundled))).toBe(3);
    expect(stepFor(failed, cer(noBundle))).toBe(2);
  });

  it("labels each run state for the list", () => {
    expect(runState(rv(["election.csv"], { busy: true }))).toEqual({
      label: "Running",
      variant: "neutral",
    });
    expect(
      runState(rv(["election.csv"], { busy: true, paused_stage: "ballots" })),
    ).toEqual({ label: "Paused at ballots", variant: "neutral" });
    expect(
      runState(rv(["election.csv"], { status: "failed", reason: "boom" })),
    ).toEqual({ label: "Failed", variant: "error", detail: "boom" });
    for (const status of ["interrupted", "close-pending"] as const) {
      expect(runState(rv(["election.csv"], { status }))).toEqual({
        label: "Interrupted",
        variant: "warn",
      });
    }
    expect(runState(rv(["election.csv", "correctness.csv"]))).toEqual({
      label: "Verified",
      variant: "success",
    });
    expect(runState(rv(["election.csv"]))).toEqual({
      label: "Generated",
      variant: "neutral",
    });
    expect(runState(rv(null))).toEqual({
      label: "Not generated",
      variant: "warn",
    });
  });
});
