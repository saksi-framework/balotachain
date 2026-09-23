import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import {
  ApiError,
  type Ceremony,
  type ConsoleEvent,
  type CheckReport,
  type ContestResult,
  type ElectionConfig,
  type ElectionSummary,
  type RunView,
} from "./lib/bulletin";

const getMeMock = vi.fn();
const loginMock = vi.fn();
const logoutMock = vi.fn();
const listRunsMock = vi.fn();
const capsMock = vi.fn();
const generateMock = vi.fn();
const checkMock = vi.fn();
const summaryMock = vi.fn();
const runStatusMock = vi.fn();
const startCeremonyMock = vi.fn();
const loadCeremonyMock = vi.fn();
const publishMock = vi.fn();
const verifyMock = vi.fn();
const correctnessMock = vi.fn();
const resumeMock = vi.fn();
/** Every open SSE subscription; `emit` feeds one event to all of them. */
const sse: ((e: ConsoleEvent) => void)[] = [];
const emit = (e: ConsoleEvent) => act(() => sse.forEach((h) => h(e)));

vi.mock("./lib/bulletin", async (importActual) => {
  const actual = await importActual<typeof import("./lib/bulletin")>();
  return {
    ...actual,
    getMe: () => getMeMock(),
    login: (u: string, p: string) => loginMock(u, p),
    logout: () => logoutMock(),
    listRuns: () => listRunsMock(),
    getCapabilities: () => capsMock(),
    generateElection: (c: ElectionConfig) => generateMock(c),
    checkPopulation: (id: string) => checkMock(id),
    loadElectionSummary: (id: string) => summaryMock(id),
    runStatus: (id: string) => runStatusMock(id),
    startCeremony: (id: string) => startCeremonyMock(id),
    loadCeremony: (id: string) => loadCeremonyMock(id),
    publishTally: (id: string) => publishMock(id),
    verifyRun: (id: string) => verifyMock(id),
    loadCorrectness: (id: string) => correctnessMock(id),
    resumeRun: (id: string) => resumeMock(id),
    subscribeEvents: (_id: string, handler: (e: ConsoleEvent) => void) => {
      sse.push(handler);
      return () => void sse.splice(sse.indexOf(handler), 1);
    },
  };
});

import App from "./App";

const config: ElectionConfig = {
  name: "Campus Election",
  trustees: [{ name: "COMELEC" }, { name: "PPCRV" }, { name: "NAMFREL" }],
  threshold: 2,
  positions: 3,
  candidates: 4,
  senate_seats: 2,
  voters: 100,
  distribution: "uniform",
  mode: "offline",
};

const run = (
  artifacts: string[] | null = ["election.csv"],
  over: Partial<RunView> = {},
): RunView => ({
  run_id: "campus-election-1",
  created_at: "2026-09-14T02:00:00Z",
  config,
  artifacts,
  busy: false,
  status: "open",
  resumable: false,
  was_interrupted: false,
  ...over,
});

function ceremony(over: Partial<Ceremony> = {}): Ceremony {
  return {
    threshold: 2,
    trustees: [
      {
        id: "1",
        name: "COMELEC",
        submitted: true,
        submitting: false,
        contests: 12,
      },
      {
        id: "2",
        name: "PPCRV",
        submitted: false,
        submitting: false,
        contests: 12,
      },
      {
        id: "3",
        name: "NAMFREL",
        submitted: false,
        submitting: false,
        contests: 12,
      },
    ],
    submitted: 1,
    unlocked: false,
    published: false,
    on_chain: false,
    ready: true,
    election_id: "campus-election-1",
    name: "Campus Election",
    mode: "offline",
    positions: 3,
    contests: 12,
    ballot_records: 300,
    events: [],
    ...over,
  };
}

/** Before the Run step: no bundle.json yet, so no per-trustee contest counts. */
const unbundled = (): Ceremony =>
  ceremony({
    ready: false,
    submitted: 0,
    trustees: ceremony().trustees.map((t) => ({
      ...t,
      submitted: false,
      contests: 0,
    })),
  });

const report: CheckReport = {
  pass: true,
  checks: [
    {
      name: "Every voter accounted for",
      pass: true,
      detail: "100 rows, one per configured voter",
    },
  ],
  rows: 100,
  ground_truth_ballots_sha256: "aa11",
  ground_truth_summary_sha256: "bb22",
  voters: 100,
  positions: 3,
  candidates: 4,
  distribution: "uniform",
  election_id: "campus-election-1",
};

const summary: ElectionSummary = {
  election_name: "Campus Election",
  voters: 100,
  num_ballots: 300,
  num_partial_decryptions: 36,
  candidates: 4,
  issuer_public_key: "ab12",
  ballots_sha256: "cd34",
};

beforeEach(() => {
  for (const m of [
    getMeMock,
    loginMock,
    logoutMock,
    listRunsMock,
    capsMock,
    generateMock,
    checkMock,
    summaryMock,
    runStatusMock,
    startCeremonyMock,
    loadCeremonyMock,
    publishMock,
    verifyMock,
    correctnessMock,
    resumeMock,
  ]) {
    m.mockReset();
  }
  getMeMock.mockResolvedValue({ username: "ops", role: "admin" });
  listRunsMock.mockResolvedValue([run()]);
  capsMock.mockResolvedValue({ fabric: false });
  runStatusMock.mockResolvedValue({ run_id: "campus-election-1", busy: false });
  checkMock.mockResolvedValue(report);
  summaryMock.mockResolvedValue(summary);
  loadCeremonyMock.mockResolvedValue(unbundled());
  loginMock.mockResolvedValue(undefined);
  logoutMock.mockResolvedValue(undefined);
  publishMock.mockResolvedValue(undefined);
  sse.length = 0;
});

describe("login", () => {
  it("shows the login screen without a session, then signs in", async () => {
    getMeMock
      .mockRejectedValueOnce(new ApiError(401, "login required"))
      .mockResolvedValue({ username: "ops", role: "admin" });
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "ops" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "hunter2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith("ops", "hunter2"),
    );
    expect(
      await screen.findByRole("heading", { name: "Elections" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ops · admin")).toBeInTheDocument();
  });

  it("shows the console's refusal verbatim", async () => {
    getMeMock.mockRejectedValue(new ApiError(401, "login required"));
    loginMock.mockRejectedValue(new ApiError(401, "invalid credentials"));
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Username"), {
      target: { value: "ops" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("invalid credentials")).toBeInTheDocument();
  });

  // Until the console's auth routes exist, /api/me is its catch-all 404.
  it("runs without a login when the console has no auth routes", async () => {
    getMeMock.mockResolvedValue(null);
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Elections" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Console authentication is off"),
    ).toBeInTheDocument();
  });

  it("returns to login on a 401 from any call", async () => {
    listRunsMock.mockRejectedValue(new ApiError(401, "login required"));
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
  });

  it("retries after the console could not be reached", async () => {
    getMeMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ username: "ops", role: "admin" });
    render(<App />);
    expect(
      await screen.findByText(/Could not reach the election console/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Elections" }),
    ).toBeInTheDocument();
  });

  it("shows a 403 verbatim", async () => {
    listRunsMock.mockRejectedValue(new ApiError(403, "admin role required"));
    render(<App />);
    expect(await screen.findByText("admin role required")).toBeInTheDocument();
  });

  it("refuses a trustee account plainly", async () => {
    getMeMock.mockResolvedValue({
      username: "ppcrv",
      role: "trustee",
      trustee_id: "2",
    });
    render(<App />);
    expect(
      await screen.findByText(/needs an administrator account/),
    ).toBeInTheDocument();
    expect(listRunsMock).not.toHaveBeenCalled();
  });
});

describe("elections", () => {
  it("lists runs with their status and hides ground-truth runs", async () => {
    listRunsMock.mockResolvedValue([
      run(["election.csv", "correctness.csv"], { audit_overall: "pass" }),
      {
        ...run(),
        run_id: "gt-1",
        config: { ...config, name: "Tables only", mode: "groundtruth" },
      },
    ]);
    render(<App />);
    expect(await screen.findByText("Campus Election")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByText("Tables only")).not.toBeInTheDocument();
  });

  it("creates an election from the form, sending numbers", async () => {
    generateMock.mockResolvedValue("campus-election-1");
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "New election" }),
    );

    const voters = screen.getByLabelText("Voters");
    fireEvent.change(voters, { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
    const sent = generateMock.mock.calls[0][0] as ElectionConfig;
    expect(sent.voters).toBe(250);
    expect(sent.threshold).toBe(3);
    expect(sent.trustees).toHaveLength(5);
    expect(sent.mode).toBe("offline");

    // Step 2: the read-only population, gated on the validation report.
    expect(await screen.findByText("All checks passed")).toBeInTheDocument();
    expect(checkMock).toHaveBeenCalledWith("campus-election-1");
    expect(screen.getByText("Every voter accounted for")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument(); // 300 records × 4 proofs
    expect(
      screen.getByRole("button", { name: /Next: run the election/ }),
    ).toBeEnabled();
  });

  it("shows the server's 400 under the form", async () => {
    generateMock.mockRejectedValue(
      new ApiError(
        400,
        "validation ladder has not been run for this build; run tools/ladder.sh first",
      ),
    );
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "New election" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    expect(
      await screen.findByText(/validation ladder has not been run/),
    ).toBeInTheDocument();
  });

  it("offers on-chain mode only when the console has Fabric", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "New election" }),
    );
    const option = await screen.findByRole("option", { name: /On-chain/ });
    await waitFor(() => expect(capsMock).toHaveBeenCalled());
    expect(option).toBeDisabled();
    expect(option).toHaveTextContent("no Fabric network configured");
  });

  it("blocks a failing population from proceeding", async () => {
    checkMock.mockResolvedValue({
      ...report,
      pass: false,
      checks: [{ name: "Recount matches", pass: false, detail: "off by one" }],
    });
    loadCeremonyMock.mockResolvedValue(unbundled());
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Next: run the election/ }),
    ).toBeDisabled();
  });
});

describe("run state", () => {
  const onchain: ElectionConfig = { ...config, mode: "onchain" };

  it("labels failed, interrupted, close-pending and busy runs", async () => {
    listRunsMock.mockResolvedValue([
      run(["election.csv"], {
        run_id: "f",
        status: "failed",
        reason: "connect to Fabric: dial timeout",
      }),
      run(["election.csv"], {
        run_id: "i",
        config: onchain,
        status: "interrupted",
        resumable: true,
      }),
      run(["election.csv"], {
        run_id: "c",
        config: onchain,
        status: "close-pending",
        resumable: true,
      }),
      run(["election.csv"], { run_id: "b", busy: true }),
    ]);
    render(<App />);
    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(
      screen.getByText("connect to Fabric: dial timeout"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Interrupted")).toHaveLength(2);
    expect(screen.getByText("Running")).toBeInTheDocument();
    // Resume where the route would take it, and never on a busy run.
    expect(screen.getAllByRole("button", { name: "Resume" })).toHaveLength(2);
  });

  it("resumes an interrupted run and follows it on the Run step", async () => {
    listRunsMock.mockResolvedValue([
      run(["election.csv"], {
        config: onchain,
        status: "interrupted",
        resumable: true,
      }),
    ]);
    loadCeremonyMock.mockResolvedValue(
      ceremony({ ready: false, submitted: 0 }),
    );
    runStatusMock.mockResolvedValue({
      run_id: "campus-election-1",
      busy: true,
    });
    resumeMock.mockResolvedValue(undefined);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));

    await waitFor(() =>
      expect(resumeMock).toHaveBeenCalledWith("campus-election-1"),
    );
    expect(await screen.findByText("Run the election")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recording on-chain…" }),
    ).toBeDisabled();
  });

  it("shows the resume route's refusal in the list", async () => {
    listRunsMock.mockResolvedValue([
      run(["election.csv"], {
        config: onchain,
        status: "interrupted",
        resumable: true,
      }),
    ]);
    resumeMock.mockRejectedValue(
      new ApiError(409, "a phase is already running on this run"),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
    expect(
      await screen.findByText("a phase is already running on this run"),
    ).toBeInTheDocument();
  });

  it("keeps a bundled but unclosed election on the Run step", async () => {
    listRunsMock.mockResolvedValue([
      run(["election.csv"], { config: onchain, busy: true }),
    ]);
    loadCeremonyMock.mockResolvedValue(
      ceremony({ ready: false, submitted: 0 }),
    );
    runStatusMock.mockResolvedValue({
      run_id: "campus-election-1",
      busy: true,
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByText("Run the election")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recording on-chain…" }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/The election is closed to new ballots/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Trustee ceremony")).not.toBeInTheDocument();
  });

  it("sends one start for a double click", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ ready: false, submitted: 0 }),
    );
    startCeremonyMock.mockReturnValue(new Promise(() => {}));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    const start = await screen.findByRole("button", {
      name: "Encrypt and record",
    });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    fireEvent.click(start);
    await waitFor(() => expect(startCeremonyMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
  });

  it("retries a failed first ceremony read and clears its error", async () => {
    const bundled = ceremony({ ready: false, submitted: 0 });
    loadCeremonyMock
      .mockResolvedValueOnce(bundled) // App.open
      .mockRejectedValueOnce(new ApiError(502, "console restarting"))
      .mockResolvedValue(bundled);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByText("console restarting")).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          screen.queryByText("console restarting"),
        ).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(
      screen.getByRole("button", { name: "Encrypt and record" }),
    ).toBeEnabled();
  });
});

describe("ceremony and results", () => {
  it("shows the roster, per-trustee links, and publishes at threshold", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 2, unlocked: true }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByText("Trustee ceremony")).toBeInTheDocument();
    expect(await screen.findByText("2 of 2 submitted")).toBeInTheDocument();
    expect(
      screen.getByText("/trustee/?run=campus-election-1&trustee=2"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publish the tally" }));
    await waitFor(() =>
      expect(publishMock).toHaveBeenCalledWith("campus-election-1"),
    );
  });

  it("keeps Publishing… until the phase ends, then shows its error", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 2, unlocked: true }),
    );
    let finish: (s: { run_id: string; busy: boolean }) => void = () => {};
    runStatusMock.mockImplementation(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    const publish = await screen.findByRole("button", {
      name: "Publish the tally",
    });
    fireEvent.click(publish);
    fireEvent.click(publish);
    await waitFor(() => expect(runStatusMock).toHaveBeenCalled());
    expect(publishMock).toHaveBeenCalledTimes(1);
    // Accepted (202) but not finished: still publishing.
    expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled();

    emit({ phase: "ceremony", level: "error", msg: "publish: tally mismatch" });
    await act(async () => finish({ run_id: "campus-election-1", busy: false }));
    expect(
      await screen.findByText("publish: tally mismatch"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish the tally" }),
    ).toBeEnabled();
  });

  it("reopens a run with a publish in flight as Publishing…", async () => {
    listRunsMock.mockResolvedValue([run(["election.csv"], { busy: true })]);
    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 2, unlocked: true }),
    );
    runStatusMock.mockResolvedValue({
      run_id: "campus-election-1",
      busy: true,
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    const publishing = await screen.findByRole("button", {
      name: "Publishing…",
    });
    expect(publishing).toBeDisabled();
    fireEvent.click(publishing);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("reopens a run busy with a trustee's share as that, not a publish", async () => {
    listRunsMock.mockResolvedValue([run(["election.csv"], { busy: true })]);
    const recording = ceremony({ submitted: 2, unlocked: true, busy: "2" });
    loadCeremonyMock
      .mockResolvedValueOnce(recording) // App.open
      .mockResolvedValueOnce(recording) // the step's first read
      .mockResolvedValue(ceremony({ submitted: 2, unlocked: true }));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(
      await screen.findByRole("button", { name: "Publish the tally" }),
    ).toBeDisabled();
    expect(screen.queryByText("Publishing…")).not.toBeInTheDocument();
    // The share lands (next 4 s ceremony poll): Publish opens, no failure.
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Publish the tally" }),
        ).toBeEnabled(),
      { timeout: 6000 },
    );
    expect(screen.queryByText(/publish stopped/)).not.toBeInTheDocument();
    expect(publishMock).not.toHaveBeenCalled();
  }, 10000);

  it("keeps Publish disabled below the threshold", async () => {
    loadCeremonyMock.mockResolvedValue(ceremony());
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(
      await screen.findByRole("button", { name: "Publish the tally" }),
    ).toBeDisabled();
  });

  it("shows a share being recorded and a failed submit on the roster", async () => {
    const c = ceremony({ submitted: 2, unlocked: true, busy: "2" });
    c.trustees[1] = { ...c.trustees[1], submitting: true };
    c.trustees[2] = {
      ...c.trustees[2],
      submit_error: "connect to Fabric: dial timeout",
    };
    loadCeremonyMock.mockResolvedValue(c);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByText("Recording…")).toBeInTheDocument();
    expect(
      screen.getByText("connect to Fabric: dial timeout"),
    ).toBeInTheDocument();
    // A share still being recorded keeps Publish shut even at threshold.
    expect(
      screen.getByRole("button", { name: "Publish the tally" }),
    ).toBeDisabled();
  });

  it("shows per-contest results and links to the board", async () => {
    const rows: ContestResult[] = [
      {
        contest: "president/cand0",
        ground_truth: 40,
        decoded: 40,
        E: 0,
        pass: true,
        published_tally: 40,
        tally_sha256: "t1",
        source: "local",
        ledger_matches_local: "",
      },
    ];
    listRunsMock.mockResolvedValue([
      run(["election.csv", "correctness.csv"], { audit_overall: "pass" }),
    ]);
    correctnessMock.mockResolvedValue(rows);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));

    expect(await screen.findByText("E = 0 · PASS")).toBeInTheDocument();
    expect(screen.queryByText(/Failed checks/)).not.toBeInTheDocument();
    expect(screen.getByText("President · Candidate 1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open the public bulletin board" }),
    ).toHaveAttribute("href", "/board/?run=campus-election-1");
  });

  it("offers verification when correctness.csv does not exist yet", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 2, unlocked: true, published: true }),
    );
    correctnessMock
      .mockRejectedValueOnce(new ApiError(404, "404 page not found"))
      .mockResolvedValue([]);
    verifyMock.mockResolvedValue(undefined);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Run verification" }),
    );
    await waitFor(() =>
      expect(verifyMock).toHaveBeenCalledWith("campus-election-1"),
    );
  });

  const passing: ContestResult = {
    contest: "president/cand0",
    ground_truth: 40,
    decoded: 40,
    E: 0,
    pass: true,
    published_tally: 40,
    tally_sha256: "t1",
    source: "local",
    ledger_matches_local: "",
  };

  it("takes the audit's overall verdict and lists its failed checks", async () => {
    listRunsMock.mockResolvedValue([
      run(["election.csv", "correctness.csv"], {
        audit_overall: "fail",
        audit_failed_checks: ["threshold_signers", "tally_signature"],
      }),
    ]);
    // Every contest decodes correctly; the audit still failed.
    correctnessMock.mockResolvedValue([passing]);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByText("FAIL")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Failed checks: threshold_signers, tally_signature",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("E = 0 · PASS")).not.toBeInTheDocument();
  });

  it("reads an empty correctness.csv as not verified, not FAIL", async () => {
    listRunsMock.mockResolvedValue([run(["election.csv", "correctness.csv"])]);
    correctnessMock.mockResolvedValue([]);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByText("Not verified yet")).toBeInTheDocument();
    expect(screen.queryByText("FAIL")).not.toBeInTheDocument();
  });

  it("sends one verify for a double click", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 2, unlocked: true, published: true }),
    );
    correctnessMock.mockRejectedValue(new ApiError(404, "404 page not found"));
    verifyMock.mockReturnValue(new Promise(() => {}));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    const verify = await screen.findByRole("button", {
      name: "Run verification",
    });
    fireEvent.click(verify);
    fireEvent.click(verify);
    await waitFor(() => expect(verifyMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
  });

  it("shows the verify phase's error, not the missing file's 404", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 2, unlocked: true, published: true }),
    );
    correctnessMock.mockRejectedValue(new ApiError(404, "404 page not found"));
    verifyMock.mockResolvedValue(undefined);
    let finish: (s: { run_id: string; busy: boolean }) => void = () => {};
    runStatusMock.mockImplementation(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Open" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Run verification" }),
    );
    await waitFor(() => expect(runStatusMock).toHaveBeenCalled());
    emit({
      phase: "verify",
      level: "error",
      msg: "auditor: bundle unreadable",
    });
    await act(async () => finish({ run_id: "campus-election-1", busy: false }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "auditor: bundle unreadable",
    );
    expect(screen.queryByText("404 page not found")).not.toBeInTheDocument();
  });
});
