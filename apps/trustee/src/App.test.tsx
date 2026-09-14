import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Ceremony, RunView } from "./lib/bulletin";

const listRunsMock = vi.fn();
const loadCeremonyMock = vi.fn();
const submitMock = vi.fn();
const publishMock = vi.fn();

vi.mock("./lib/bulletin", async (importActual) => {
  const actual = await importActual<typeof import("./lib/bulletin")>();
  return {
    ...actual,
    listRuns: () => listRunsMock(),
    loadCeremony: (id: string) => loadCeremonyMock(id),
    submitPartialDecryption: (runId: string, trusteeId: string) =>
      submitMock(runId, trusteeId),
    publishTally: (runId: string) => publishMock(runId),
    subscribeEvents: () => () => {},
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
  artifacts: [],
};

function ceremony(over: Partial<Ceremony> = {}): Ceremony {
  return {
    threshold: 3,
    trustees: [
      { id: "1", name: "COMELEC", submitted: true, contests: 12 },
      { id: "2", name: "PPCRV", submitted: false, contests: 12 },
      { id: "3", name: "NAMFREL", submitted: false, contests: 12 },
      { id: "4", name: "WMSU IT Office", submitted: false, contests: 12 },
      { id: "5", name: "Independent Observer", submitted: false, contests: 12 },
    ],
    submitted: 1,
    unlocked: false,
    published: false,
    on_chain: false,
    ready: true,
    started_at: "2026-09-10T02:05:00Z",
    closed_at: "2026-09-10T02:05:00Z",
    election_id: "demo-2026-1",
    name: "Demo Election",
    mode: "offline",
    positions: 3,
    position_ids: ["president", "vice-president", "senator"],
    contests: 12,
    ballot_records: 60,
    ballots_sha256: "67bbfa8d",
    dkg_sha256: "6f5a7f5848cfecd0",
    events: [
      { at: "2026-09-10T02:05:00Z", kind: "setup", text: "Ceremony opened" },
      {
        at: "2026-09-10T02:06:00Z",
        kind: "trustee",
        who: "COMELEC",
        text: "contributed 12 partial decryption(s)",
      },
    ],
    ...over,
  };
}

function setUrl(search: string) {
  window.history.replaceState(null, "", `/trustee/${search}`);
}

beforeEach(() => {
  listRunsMock.mockReset();
  loadCeremonyMock.mockReset();
  submitMock.mockReset();
  publishMock.mockReset();
  listRunsMock.mockResolvedValue([run]);
  loadCeremonyMock.mockResolvedValue(ceremony());
  submitMock.mockResolvedValue(undefined);
  publishMock.mockResolvedValue(undefined);
  try {
    window.localStorage.clear();
  } catch {
    /* private window */
  }
  setUrl("?run=demo-2026-1&trustee=2");
});

describe("trustee console", () => {
  it("identifies you from ?trustee and shows the roster", async () => {
    render(<App />);
    // Named as "you" in the top bar, in the roster, and on the key-share card.
    expect((await screen.findAllByText("PPCRV")).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.getByText("YOU")).toBeInTheDocument();
    expect(screen.getByText("Trustee 2 of 5")).toBeInTheDocument();
    // The other institutions are on the roster too, with their own status.
    expect(screen.getAllByText("COMELEC").length).toBeGreaterThan(0);
    expect(screen.getByText("Independent Observer")).toBeInTheDocument();
  });

  it("shows the quorum from the ceremony, not a hardcoded threshold", async () => {
    render(<App />);
    expect(await screen.findByText("Quorum 3 of 5")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 submitted")).toBeInTheDocument();
    expect(
      screen.getByText(/2 more partial decryptions needed/),
    ).toBeInTheDocument();
  });

  // The console has no trustee presence concept, so a roster row is Submitted,
  // Pending, or — before setup — Not started. There is no honest "Offline".
  it("uses Not started before the ceremony is set up", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({
        ready: false,
        submitted: 0,
        trustees: [
          { id: "1", name: "COMELEC", submitted: false, contests: 0 },
          { id: "2", name: "PPCRV", submitted: false, contests: 0 },
        ],
      }),
    );
    render(<App />);
    expect((await screen.findAllByText("Not started")).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    expect(
      screen.getByText(/This ceremony has not been set up yet/),
    ).toBeInTheDocument();
  });

  it("shows a picker when no trustee is chosen", async () => {
    setUrl("?run=demo-2026-1");
    render(<App />);
    expect(await screen.findByText("Who are you?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /NAMFREL/ }));
    await waitFor(() => {
      expect(screen.queryByText("Who are you?")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Trustee 3 of 5")).toBeInTheDocument();
  });

  it("rejects an id that is not in the roster instead of silently picking one", async () => {
    setUrl("?run=demo-2026-1&trustee=99");
    render(<App />);
    expect(
      await screen.findByText(/No trustee 99 in this election/),
    ).toBeInTheDocument();
  });

  it("submits only after the confirm step, sending run and trustee id", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Submit Partial Decryption/i }),
    );
    expect(await screen.findByText("Confirm submission")).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: /Yes, submit my share/i }),
    );
    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith("demo-2026-1", "2");
    });
    expect(
      await screen.findByText("Partial decryption submitted"),
    ).toBeInTheDocument();
  });

  it("can be cancelled", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Submit Partial Decryption/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Confirm submission")).not.toBeInTheDocument();
    });
    expect(submitMock).not.toHaveBeenCalled();
  });

  // Publishing is the last act of the ceremony; below the threshold the button
  // is not offered at all, and the console would refuse it anyway.
  it("offers Publish only once the threshold is reached", async () => {
    const below = render(<App />);
    await screen.findAllByText("PPCRV");
    expect(
      screen.queryByRole("button", { name: /Publish the tally/i }),
    ).not.toBeInTheDocument();
    below.unmount();

    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 3, unlocked: true }),
    );
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Publish the tally/i }),
    );
    await waitFor(() =>
      expect(publishMock).toHaveBeenCalledWith("demo-2026-1"),
    );
  });

  it("surfaces the console's threshold refusal verbatim", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ submitted: 2, unlocked: true }),
    );
    publishMock.mockRejectedValue(
      new Error("the tally needs 3 of 5 trustees; 2 have contributed so far"),
    );
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Publish the tally/i }),
    );
    expect(
      await screen.findByText(/the tally needs 3 of 5 trustees/),
    ).toBeInTheDocument();
  });

  it("renders the decryption context from the run, not from fixtures", async () => {
    render(<App />);
    expect(await screen.findByText("sha256:67bbfa8d")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(
      screen.getByText("President · Vice President · Senator"),
    ).toBeInTheDocument();
  });

  // Offline there are no ledger receipts, so the timeline exists only because
  // the console records ceremony timestamps.
  it("renders the audit log from the ceremony events", async () => {
    render(<App />);
    expect(
      await screen.findByText("Ceremony opened", { selector: "b" }),
    ).toBeInTheDocument();
    expect(screen.getByText("COMELEC", { selector: "b" })).toBeInTheDocument();
    expect(
      screen.getByText(/contributed 12 partial decryption/),
    ).toBeInTheDocument();
  });

  it("shows an error state instead of silently falling back to demo data", async () => {
    loadCeremonyMock.mockRejectedValue(new Error("connection refused"));
    render(<App />);
    expect(
      await screen.findByText(/Could not reach the election console/),
    ).toBeInTheDocument();
  });

  it("says the console has no trustee authentication", async () => {
    render(<App />);
    expect(
      await screen.findByText(/no trustee authentication/i),
    ).toBeInTheDocument();
  });
});
