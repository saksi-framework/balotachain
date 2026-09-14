import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Board, RunView, VerifyOutcome } from "./lib/bulletin";

const listRunsMock = vi.fn();
const loadBoardMock = vi.fn();
const verifyTrackingCodeMock = vi.fn();

vi.mock("./lib/bulletin", async (importActual) => {
  const actual = await importActual<typeof import("./lib/bulletin")>();
  return {
    ...actual,
    listRuns: () => listRunsMock(),
    loadBoard: (id: string) => loadBoardMock(id),
    verifyTrackingCode: (runId: string, code: string) =>
      verifyTrackingCodeMock(runId, code),
  };
});

import App from "./App";

const run: RunView = {
  run_id: "demo-2026-1",
  created_at: "2026-09-10T02:00:00Z",
  config: {
    name: "Demo Election",
    mode: "offline",
    voters: 20,
    positions: 3,
    candidates: 4,
    threshold: 3,
  },
  artifacts: ["correctness.csv"],
};

function board(over: Partial<Board> = {}): Board {
  return {
    election_id: "demo-2026-1",
    name: "Demo Election",
    mode: "offline",
    distribution: "realistic",
    on_chain: false,
    opened_at: "2026-09-10T02:00:00Z",
    sealed: false,
    verified: true,
    contests: [
      {
        id: "president",
        label: "President",
        seats: 1,
        total_votes: 20,
        contested: false,
        candidates: [
          {
            id: "cand0",
            label: "Candidate 1",
            votes: 12,
            rank: 1,
            elected: true,
            share: 60,
          },
          {
            id: "cand1",
            label: "Candidate 2",
            votes: 8,
            rank: 2,
            elected: false,
            share: 40,
          },
        ],
      },
    ],
    integrity: {
      voters: 20,
      positions: 3,
      candidates: 4,
      ballot_records: 60,
      verified: 60,
      rejected: 2,
      rejected_note:
        "tampered ballots refused, out of 2 ballot-stage negative tests",
      turnout_pct: 100,
      turnout_note: "synthetic population — turnout is 100% by construction",
    },
    crypto: {
      tally_proof_verified: true,
      trustees_submitted: 3,
      trustees_total: 5,
      threshold: 3,
      tally_sha256: "f2193c71",
      ballots_sha256: "67bbfa8d",
    },
    checks: [
      {
        name: "Every contest decodes to the seeded ground truth",
        pass: true,
        detail: "E = 0",
      },
    ],
    artifacts: ["correctness.csv", "election.csv"],
    ...over,
  };
}

beforeEach(() => {
  listRunsMock.mockReset();
  loadBoardMock.mockReset();
  verifyTrackingCodeMock.mockReset();
  listRunsMock.mockResolvedValue([run]);
  loadBoardMock.mockResolvedValue(board());
  vi.stubGlobal("history", { ...window.history, replaceState: vi.fn() });
});

describe("bulletin board", () => {
  it("picks the newest run and loads its board", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Demo Election", level: 1 });
    expect(loadBoardMock).toHaveBeenCalledWith("demo-2026-1");
  });

  it("renders the results and the seat/elected tags from the console payload", async () => {
    render(<App />);
    expect(await screen.findByText("President")).toBeInTheDocument();
    expect(screen.getByText("Candidate 1")).toBeInTheDocument();
    expect(screen.getByText("ELECTED")).toBeInTheDocument();
    expect(screen.getByText("1 seat")).toBeInTheDocument();
  });

  it("marks a multi-seat race and ranks instead of percentages", async () => {
    loadBoardMock.mockResolvedValue(
      board({
        contests: [
          {
            id: "senator",
            label: "Senator",
            seats: 3,
            total_votes: 20,
            contested: false,
            candidates: [
              {
                id: "cand0",
                label: "Candidate 1",
                votes: 9,
                rank: 1,
                elected: true,
                share: 45,
              },
              {
                id: "cand1",
                label: "Candidate 2",
                votes: 5,
                rank: 2,
                elected: true,
                share: 25,
              },
              {
                id: "cand2",
                label: "Candidate 3",
                votes: 4,
                rank: 3,
                elected: true,
                share: 20,
              },
              {
                id: "cand3",
                label: "Candidate 4",
                votes: 2,
                rank: 4,
                elected: false,
                share: 10,
              },
            ],
          },
        ],
      }),
    );
    render(<App />);
    expect(await screen.findByText("3 seats")).toBeInTheDocument();
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getAllByText("ELECTED")).toHaveLength(3);
  });

  // Under a uniform distribution a race genuinely ties. Awarding the top row
  // would invent a result, so the board has to say the cut is undecided.
  it("reports a contested cut instead of naming a winner", async () => {
    loadBoardMock.mockResolvedValue(
      board({
        contests: [
          {
            id: "president",
            label: "President",
            seats: 1,
            total_votes: 20,
            contested: true,
            candidates: [
              {
                id: "cand0",
                label: "Candidate 1",
                votes: 10,
                rank: 1,
                elected: false,
                share: 50,
              },
              {
                id: "cand1",
                label: "Candidate 2",
                votes: 10,
                rank: 1,
                elected: false,
                share: 50,
              },
            ],
          },
        ],
      }),
    );
    render(<App />);
    await screen.findByText("President");
    expect(screen.queryByText("ELECTED")).not.toBeInTheDocument();
    expect(screen.getByText(/this race awards nothing/i)).toBeInTheDocument();
  });

  it("shows the pending-tally state while the board is sealed", async () => {
    loadBoardMock.mockResolvedValue(
      board({ sealed: true, verified: false, contests: [] }),
    );
    render(<App />);
    expect(await screen.findByText("Tally pending")).toBeInTheDocument();
    expect(screen.queryByText(/Election verified/)).not.toBeInTheDocument();
  });

  it("shows an error state instead of silently falling back to demo data", async () => {
    loadBoardMock.mockRejectedValue(new Error("connection refused"));
    render(<App />);
    expect(
      await screen.findByText(/Could not reach the election console/),
    ).toBeInTheDocument();
  });

  it("says so when the console has no elections", async () => {
    listRunsMock.mockResolvedValue([]);
    render(<App />);
    expect(
      await screen.findByText(/No elections have been run/),
    ).toBeInTheDocument();
  });

  // Ground-truth runs produce no ballots and no tally, so they are not boards.
  it("skips ground-truth runs when picking a default", async () => {
    listRunsMock.mockResolvedValue([
      {
        ...run,
        run_id: "gt-1",
        config: { ...run.config, mode: "groundtruth" },
      },
      run,
    ]);
    render(<App />);
    await screen.findByRole("heading", { name: "Demo Election", level: 1 });
    expect(loadBoardMock).toHaveBeenCalledWith("demo-2026-1");
  });

  it("renders the integrity stats and the honest turnout note", async () => {
    render(<App />);
    expect(
      await screen.findByText("Tampered ballots refused"),
    ).toBeInTheDocument();
    // Both "total ballots cast" and "verified" read 60 on a fully audited run.
    expect(screen.getAllByText("60")).toHaveLength(2);
    expect(screen.getByText("20 voters × 3 positions")).toBeInTheDocument();
    expect(screen.getByText(/100% by construction/)).toBeInTheDocument();
  });

  it("renders the tally fingerprint from the run's artifact digest", async () => {
    render(<App />);
    expect(await screen.findByText("sha256:f2193c71")).toBeInTheDocument();
  });
});

describe("verify your vote", () => {
  async function typeCode(code: string) {
    render(<App />);
    const input = await screen.findByLabelText("Tracking code");
    fireEvent.change(input, { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));
  }

  it("names the position a found record belongs to", async () => {
    verifyTrackingCodeMock.mockResolvedValue({
      kind: "found",
      record: {
        found: true,
        tracking_code: "BC-CAFE-0001",
        ballot_index: 0,
        position_label: "President",
        committed_on_chain: false,
      },
    } satisfies VerifyOutcome);
    await typeCode("BC-CAFE-0001");
    await waitFor(() => {
      expect(verifyTrackingCodeMock).toHaveBeenCalledWith(
        "demo-2026-1",
        "BC-CAFE-0001",
      );
    });
    expect(await screen.findByText(/for President/)).toBeInTheDocument();
  });

  it("explains a miss", async () => {
    verifyTrackingCodeMock.mockResolvedValue({
      kind: "missing",
    } satisfies VerifyOutcome);
    await typeCode("BC-9999-9999");
    expect(
      await screen.findByText(
        /No ballot record in this election starts with that code/,
      ),
    ).toBeInTheDocument();
  });

  it("explains an ambiguous prefix rather than showing someone else's record", async () => {
    verifyTrackingCodeMock.mockResolvedValue({
      kind: "ambiguous",
    } satisfies VerifyOutcome);
    await typeCode("BC-CAFE-0001");
    expect(
      await screen.findByText(
        /More than one ballot record starts with that code/,
      ),
    ).toBeInTheDocument();
  });

  // The code is a hex nullifier prefix, so non-hex can never match — reject it
  // before spending a request on it.
  it("rejects a non-hex code without calling the console", async () => {
    await typeCode("BC-ZZZZ-0001");
    expect(await screen.findByText(/using the digits 0-9/)).toBeInTheDocument();
    expect(verifyTrackingCodeMock).not.toHaveBeenCalled();
  });
});
