import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiError, type Ceremony, type RunView } from "./lib/bulletin";

const listRunsMock = vi.fn();
const loadCeremonyMock = vi.fn();
const submitMock = vi.fn();
const publishMock = vi.fn();
const getMeMock = vi.fn();
const loginMock = vi.fn();
const logoutMock = vi.fn();
const subscribeEventsMock = vi.fn<
  (runId: string, onEvent: (e: unknown) => void) => () => void
>(() => () => {});

vi.mock("./lib/bulletin", async (importActual) => {
  const actual = await importActual<typeof import("./lib/bulletin")>();
  return {
    ...actual,
    listRuns: () => listRunsMock(),
    loadCeremony: (id: string) => loadCeremonyMock(id),
    submitPartialDecryption: (runId: string, trusteeId: string) =>
      submitMock(runId, trusteeId),
    publishTally: (runId: string) => publishMock(runId),
    subscribeEvents: (runId: string, onEvent: (e: unknown) => void) =>
      subscribeEventsMock(runId, onEvent),
    getMe: () => getMeMock(),
    login: (u: string, p: string) => loginMock(u, p),
    logout: () => logoutMock(),
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
  getMeMock.mockReset();
  loginMock.mockReset();
  logoutMock.mockReset();
  subscribeEventsMock.mockReset();
  subscribeEventsMock.mockImplementation(() => () => {});
  // Default: a console without auth routes, the behaviour PR #54 shipped.
  getMeMock.mockResolvedValue(null);
  loginMock.mockResolvedValue(undefined);
  logoutMock.mockResolvedValue(undefined);
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
    // Success comes from the console's `submitted`, never from the 202 alone.
    loadCeremonyMock.mockResolvedValue(
      ceremony({
        submitted: 2,
        trustees: ceremony().trustees.map((t) =>
          t.id === "2" ? { ...t, submitted: true } : t,
        ),
      }),
    );
    expect(
      await screen.findByText("Partial decryption submitted"),
    ).toBeInTheDocument();
  });

  const withYou = (over: Record<string, unknown>, id = "2") =>
    ceremony().trustees.map((t) => (t.id === id ? { ...t, ...over } : t));

  it("shows the in-flight panel, not the button, while your share is recording", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({ busy: "2", trustees: withYou({ submitting: true }) }),
    );
    render(<App />);
    expect(
      await screen.findByText("Recording your share…"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Submit Partial Decryption/i }),
    ).not.toBeInTheDocument();
  });

  it("does not offer the button again after confirm while the poll says not submitted", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Submit Partial Decryption/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Yes, submit my share/i }),
    );
    // The console now reports the phase as running, still not submitted.
    loadCeremonyMock.mockResolvedValue(
      ceremony({ busy: "2", trustees: withYou({ submitting: true }) }),
    );
    expect(
      await screen.findByText("Recording your share…"),
    ).toBeInTheDocument();
    const before = loadCeremonyMock.mock.calls.length;
    await waitFor(() =>
      expect(loadCeremonyMock.mock.calls.length).toBeGreaterThan(before),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText("Recording your share…")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Submit Partial Decryption/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Partial decryption submitted"),
    ).not.toBeInTheDocument();
  });

  it("shows a failed submit with Try again, which re-submits", async () => {
    loadCeremonyMock.mockResolvedValue(
      ceremony({
        trustees: withYou({ submit_error: "endorsement timed out" }),
      }),
    );
    render(<App />);
    expect(
      await screen.findByText(/endorsement timed out/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Yes, submit my share/i }),
    );
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith("demo-2026-1", "2"),
    );
  });

  it("disables the button while another trustee's share is recording", async () => {
    setUrl("?run=demo-2026-1&trustee=1");
    loadCeremonyMock.mockResolvedValue(
      ceremony({
        busy: "2",
        trustees: ceremony()
          .trustees.map((t) => (t.id === "1" ? { ...t, submitted: false } : t))
          .map((t) => (t.id === "2" ? { ...t, submitting: true } : t)),
      }),
    );
    render(<App />);
    expect(
      await screen.findByRole("button", { name: /Submit Partial Decryption/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Another trustee's share is being recorded; this unlocks when it finishes.",
      ),
    ).toBeInTheDocument();
  });

  it("treats a 409 on submit as in flight and re-polls, with no error", async () => {
    submitMock.mockRejectedValue(
      new ApiError(409, "trustee 2's shares are already being recorded"),
    );
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Submit Partial Decryption/i }),
    );
    const before = loadCeremonyMock.mock.calls.length;
    fireEvent.click(
      screen.getByRole("button", { name: /Yes, submit my share/i }),
    );
    expect(
      await screen.findByText("Recording your share…"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/already being recorded/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Submit Partial Decryption/i }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(loadCeremonyMock.mock.calls.length).toBeGreaterThan(before),
    );
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

describe("trustee console with console auth on", () => {
  const ppcrv = { username: "ppcrv", role: "trustee", trustee_id: "2" };

  it("asks for a sign-in when there is no session, then shows the ceremony", async () => {
    getMeMock
      .mockRejectedValueOnce(new ApiError(401, "login required"))
      .mockResolvedValue(ppcrv);
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Username"), {
      target: { value: "ppcrv" },
    });
    // Nobody is acting yet, so the ?trustee link offers no identity switch.
    expect(
      screen.queryByRole("button", { name: "Not you?" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("ppcrv", "pw"));
    expect(await screen.findByText("Trustee 2 of 5")).toBeInTheDocument();
  });

  it("shows the login refusal verbatim", async () => {
    getMeMock.mockRejectedValue(new ApiError(401, "login required"));
    loginMock.mockRejectedValue(new ApiError(401, "invalid credentials"));
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Username"), {
      target: { value: "ppcrv" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("invalid credentials")).toBeInTheDocument();
  });

  // Identity comes from the session: no picker, and no ?trustee needed.
  it("binds the trustee to the session, not the URL", async () => {
    getMeMock.mockResolvedValue(ppcrv);
    setUrl("?run=demo-2026-1");
    render(<App />);
    expect(await screen.findByText("Trustee 2 of 5")).toBeInTheDocument();
    expect(screen.queryByText("Who are you?")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no trustee authentication/i),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Submit Partial Decryption/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Yes, submit my share/i }),
    );
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith("demo-2026-1", "2"),
    );
  });

  it("says so plainly when a trustee opens another trustee's link", async () => {
    getMeMock.mockResolvedValue(ppcrv);
    setUrl("?run=demo-2026-1&trustee=3");
    render(<App />);
    expect(
      await screen.findByText(/This link is for trustee 3 \(NAMFREL\)/),
    ).toBeInTheDocument();
    // Still acting as PPCRV: the submit on offer is their own, never NAMFREL's.
    expect(screen.getByText("Trustee 2 of 5")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Submit Partial Decryption/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Yes, submit my share/i }),
    );
    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith("demo-2026-1", "2"),
    );
    expect(submitMock).not.toHaveBeenCalledWith("demo-2026-1", "3");
  });

  it("returns to sign-in when a call answers 401", async () => {
    getMeMock.mockResolvedValue(ppcrv);
    submitMock.mockRejectedValue(new ApiError(401, "login required"));
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Submit Partial Decryption/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Yes, submit my share/i }),
    );
    expect(await screen.findByLabelText("Username")).toBeInTheDocument();
  });

  it("shows a 403 refusal verbatim", async () => {
    getMeMock.mockResolvedValue(ppcrv);
    submitMock.mockRejectedValue(
      new ApiError(403, "trustees may submit only their own shares"),
    );
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Submit Partial Decryption/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Yes, submit my share/i }),
    );
    expect(
      await screen.findByText("trustees may submit only their own shares"),
    ).toBeInTheDocument();
  });

  it("is read-only for an administrator", async () => {
    getMeMock.mockResolvedValue({ username: "ops", role: "admin" });
    render(<App />);
    expect(
      await screen.findByText(
        /an administrator\. Trustees submit their own shares/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Submit Partial Decryption/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Who are you?")).not.toBeInTheDocument();
  });

  it("opens the events stream after sign-in, without a reload", async () => {
    getMeMock
      .mockRejectedValueOnce(new ApiError(401, "login required"))
      .mockResolvedValue(ppcrv);
    render(<App />);
    await screen.findByLabelText("Username");
    // Signed out: /events must not be opened (it would 401).
    expect(subscribeEventsMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "ppcrv" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(subscribeEventsMock).toHaveBeenCalledWith(
        "demo-2026-1",
        expect.any(Function),
      ),
    );
  });

  it("signs out back to the sign-in screen", async () => {
    getMeMock.mockResolvedValue(ppcrv);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
    expect(await screen.findByLabelText("Username")).toBeInTheDocument();
  });
});
