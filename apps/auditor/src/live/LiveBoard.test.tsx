import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App, { PROBE_BACKOFF_MS, PROBE_LIMIT_MS, PROBE_TRIES } from "../App";
import { POLL_TIMEOUT_MS } from "@balotachain/ui";
import { LIVE_POLL_MS } from "./LiveBoard";
import { STUCK_HOLD_MS } from "./model";
import none from "../test/fixtures/live/none.json";
import liveOff from "../test/fixtures/live/live-off.json";
import setup from "../test/fixtures/live/setup.json";
import ceremony from "../test/fixtures/live/ceremony.json";
import ceremonyJoined from "../test/fixtures/live/ceremony-joined.json";
import open from "../test/fixtures/live/open.json";
import openConsole from "../test/fixtures/live/open-console.json";
import closed from "../test/fixtures/live/closed.json";
import tallied from "../test/fixtures/live/tallied.json";
import verified from "../test/fixtures/live/verified.json";
import verifiedConsole from "../test/fixtures/live/verified-console.json";
import failed from "../test/fixtures/live/failed.json";
import abandoned from "../test/fixtures/live/abandoned.json";
import longNames from "../test/fixtures/live/long-names.json";
import openList from "../test/fixtures/live/open-list.json";

/**
 * The fixtures are the console's answers, built from the Go JSON tags; the
 * same files feed the screenshots. They are served through `fetch`, so the
 * real client (`getLiveElection`, `loadBoard`) is exercised too.
 */
type Answer = { status: number; body: unknown };
type Fixture = { election: Answer; board: Answer | null };

const RUN = "live-20261115-091500-f1x7c0de";

let fixture: Fixture;
let boards: Record<string, Answer>;
let runs: unknown[];
let fetchMock: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState;

function serve(f: unknown) {
  fixture = f as Fixture;
  boards = {};
  if (fixture.board) boards[RUN] = fixture.board;
}

function respond({ status, body }: Answer): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function path(input: RequestInfo | URL): string {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return new URL(url, "http://board.test").pathname;
}

function calls(p: string): number {
  return fetchMock.mock.calls.filter(([input]) => path(input) === p).length;
}

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  runs = [];
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  window.history.replaceState(null, "", "/board/");
  document.title = "";
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const p = path(input);
    if (p === "/api/live/election") return respond(fixture.election);
    if (p === "/runs") return respond({ status: 200, body: runs });
    const m = /^\/api\/board\/([^/]+)$/.exec(p);
    if (m && boards[decodeURIComponent(m[1])]) {
      return respond(boards[decodeURIComponent(m[1])]);
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The band is the section labelled by its heading. */
async function findBand(name: string | RegExp) {
  const heading = await screen.findByRole("heading", { name, level: 2 });
  const section = heading.closest("section");
  if (!section) throw new Error("band heading outside a section");
  return section;
}

describe("live board: the band", () => {
  it("says no election is running, and the check waits for voting", async () => {
    serve(none);
    render(<App />);
    const b = await findBand("No election is running");
    expect(
      within(b).getByText("The board fills in when the presenter creates one."),
    ).toBeInTheDocument();
    expect(within(b).getByText("No election")).toBeInTheDocument();
    expect(screen.getByText("Opens when voting opens.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    expect(screen.getByLabelText("Tracking code")).toBeDisabled();
    await waitFor(() =>
      expect(document.title).toBe("Board No election - BalotaChain"),
    );
  });

  it("setup: election created, waiting for the trustees", async () => {
    serve(setup);
    render(<App />);
    const b = await findBand("Election created");
    expect(
      within(b).getByText("The chain has not recorded the election yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
  });

  it("ceremony from an older console without counts.trustees_joined: only the key sentence", async () => {
    serve(ceremony);
    render(<App />);
    const b = await findBand("Key ceremony");
    expect(
      within(b).getByText("The election key appears when all 5 have joined."),
    ).toBeInTheDocument();
    expect(within(b).queryByText(/trustees joined/)).not.toBeInTheDocument();
  });

  it("ceremony with counts.trustees_joined: k of 5 trustees joined", async () => {
    serve(ceremonyJoined);
    render(<App />);
    const b = await findBand("Key ceremony");
    await within(b).findByText("of 5 trustees joined");
    expect(within(b).getByText("3")).toBeInTheDocument();
    expect(
      within(b).getByText("The election key appears when all 5 have joined."),
    ).toBeInTheDocument();
  });

  it("open: N ballot records on chain, the election key and the tab title", async () => {
    serve(open);
    render(<App />);
    const b = await findBand("Voting is open");
    expect(within(b).getByText("4")).toBeInTheDocument();
    expect(within(b).getByText("ballot records on chain")).toBeInTheDocument();
    expect(
      within(b).getByText("7A1B-3C9F-0D2E-41A8-9B6C-E8F9"),
    ).toBeInTheDocument();
    expect(within(b).getByText("Voting open")).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Board Voting open - BalotaChain"),
    );
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  });

  it("closed: k of 3 trustee shares recorded, from the decryption object", async () => {
    serve(closed);
    render(<App />);
    const b = await findBand("Voting is closed");
    expect(within(b).getByText("2")).toBeInTheDocument();
    expect(
      within(b).getByText("of 3 trustee shares recorded"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("2 of 3 trustee shares recorded"),
    ).toBeInTheDocument();
  });

  it("tallied: result published, checking", async () => {
    serve(tallied);
    render(<App />);
    const b = await findBand("Result published, checking");
    expect(within(b).getByText("Checking")).toBeInTheDocument();
    expect(await screen.findByText("published, checking")).toBeInTheDocument();
  });

  it("verified: N ballot records on chain, and the verifier passed", async () => {
    serve(verified);
    render(<App />);
    const b = await findBand("Result verified");
    expect(within(b).getByText("6")).toBeInTheDocument();
    expect(within(b).getByText("ballot records on chain")).toBeInTheDocument();
    expect(
      within(b).getByText("The verifier passed the record on chain."),
    ).toBeInTheDocument();
    // No count of the board's summary rows in the band (review finding 1).
    expect(within(b).queryByText(/checks? passed/)).not.toBeInTheDocument();
    expect(b.textContent).not.toMatch(/independent/i);
    expect(within(b).getByText("Verified")).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Board Verified - BalotaChain"),
    );
  });

  it("failed checks take the band and are listed first, in words", async () => {
    serve(failed);
    render(<App />);
    const b = await findBand("Result NOT verified");
    expect(within(b).getByText("Not verified")).toBeInTheDocument();
    // The failed checks' names come with the board answer.
    expect(await within(b).findByText("checks failed")).toBeInTheDocument();
    expect(within(b).getByText("2")).toBeInTheDocument();
    const list = screen.getByRole("region", { name: "Failed checks" });
    expect(
      within(list).getByText("tally_decryption_proofs"),
    ).toBeInTheDocument();
    // First under the band: it comes before the results in reading order.
    const results = screen.getByRole("region", { name: "Results" });
    expect(
      list.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("published, not verified")).toBeInTheDocument();
  });

  it("abandoned: no result, the records stay, with a link to the record", async () => {
    serve(abandoned);
    render(<App />);
    const b = await findBand("Election abandoned");
    expect(
      within(b).getByText(
        "No result will be published for this election. 0 ballot records stay on chain.",
      ),
    ).toBeInTheDocument();
    expect(
      within(b).getByRole("link", { name: "Open the record on chain" }),
    ).toHaveAttribute("href", `/trail/${RUN}`);
    // verify-code answers for any run, so the check stays usable.
    expect(screen.getByRole("button", { name: "Check" })).toBeEnabled();
  });

  it("the chain did not answer: the console's count, said plainly", async () => {
    serve(openConsole);
    render(<App />);
    const b = await findBand("Voting is open");
    expect(
      within(b).getByText("ballot records in the console's record"),
    ).toBeInTheDocument();
    expect(
      within(b).getByText(
        "The chain did not answer. This count is not from the chain. Trying again every few seconds.",
      ),
    ).toBeInTheDocument();
    expect(
      within(b).queryByText("ballot records on chain"),
    ).not.toBeInTheDocument();
  });

  it("never says verified while the count is the console's", async () => {
    serve(verifiedConsole);
    render(<App />);
    await findBand("Result published");
    await screen.findByText("ballot records in the console's record");
    expect(document.body.textContent).not.toMatch(/\bverified\b/i);
    await waitFor(() => expect(document.title).not.toMatch(/verified/i));
  });
});

describe("live board: the word verified needs the chain", () => {
  it("a verified board with no counts never says verified", async () => {
    const f = structuredClone(verified) as unknown as Fixture;
    delete (f.board!.body as { live: { counts?: unknown } }).live.counts;
    serve(f);
    fixture.election = none.election;
    window.history.replaceState(null, "", `/board/?run=${RUN}`);
    render(<App />);
    const b = await findBand("Result published");
    expect(within(b).getByText("Published")).toBeInTheDocument();
    expect(
      within(b).getByText(
        "The board has no ballot count from the chain for this election.",
      ),
    ).toBeInTheDocument();
    expect(within(b).queryByText(/ballot records?/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bverified\b/i);
    await waitFor(() =>
      expect(document.title).toBe("Board Published - BalotaChain"),
    );
  });

  it("?run= keeps the last good election view when one view request fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(openConsole);
    window.history.replaceState(null, "", `/board/?run=${RUN}`);
    render(<App />);
    const b = await findBand("Voting is open");
    const line =
      "The chain did not answer. This count is not from the chain. Trying again every few seconds.";
    await within(b).findByText(line);
    const ok = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (path(input) === "/api/live/election") {
        throw new TypeError("Failed to fetch");
      }
      return ok(input);
    });
    const before = calls(`/api/board/${RUN}`);
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    await waitFor(() =>
      expect(calls(`/api/board/${RUN}`)).toBeGreaterThan(before),
    );
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(within(b).getByText(line)).toBeInTheDocument();
    expect(
      within(b).queryByText(/not the console's current election/),
    ).not.toBeInTheDocument();
  });
});

describe("live board: which board", () => {
  // Silence is never an answer: four tries, then a notice with a button.
  const SILENT_MS =
    PROBE_TRIES * PROBE_LIMIT_MS + PROBE_BACKOFF_MS.reduce((a, b) => a + b, 0);

  it("a console that never answers: four tries, then a notice, never the study board", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(none);
    const ok = fetchMock.getMockImplementation()!;
    let aborted = 0;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (path(input) === "/api/live/election") {
          init?.signal?.addEventListener("abort", () => (aborted += 1));
          return new Promise<Response>(() => {});
        }
        return ok(input);
      },
    );
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(SILENT_MS - 100));
    expect(screen.queryByText(/could not reach/)).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(
      await screen.findByText(
        "The board could not reach the election console. It asked 4 times and got no answer it could use.",
      ),
    ).toHaveAttribute("role", "status");
    expect(calls("/api/live/election")).toBe(PROBE_TRIES);
    expect(aborted).toBe(PROBE_TRIES);
    expect(calls("/runs")).toBe(0);
  });

  it("?run= on a board that never answers: the notice, not the study board", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(none);
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    window.history.replaceState(null, "", "/board/?run=study-slow");
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(SILENT_MS + 100));
    expect(
      await screen.findByText(/could not reach the election console/),
    ).toBeInTheDocument();
    expect(calls("/api/board/study-slow")).toBe(PROBE_TRIES);
    expect(calls("/runs")).toBe(0);
  });

  it("a 503 and a network error, then a 200: the live board", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    const ok = fetchMock.getMockImplementation()!;
    let n = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (path(input) === "/api/live/election") {
        n += 1;
        if (n === 1) return new Response("busy", { status: 503 });
        if (n === 2) throw new TypeError("Failed to fetch");
      }
      return ok(input);
    });
    render(<App />);
    await act(() =>
      vi.advanceTimersByTimeAsync(
        PROBE_BACKOFF_MS[0] + PROBE_BACKOFF_MS[1] + 100,
      ),
    );
    await findBand("Voting is open");
    expect(calls("/runs")).toBe(0);
  });

  it("Try again on the notice probes again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    const ok = fetchMock.getMockImplementation()!;
    let silent = true;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (silent && path(input) === "/api/live/election") {
        return new Response("down", { status: 502 });
      }
      return ok(input);
    });
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(SILENT_MS));
    const again = await screen.findByRole("button", { name: "Try again" });
    expect(calls("/api/live/election")).toBe(PROBE_TRIES);
    silent = false;
    fireEvent.click(again);
    await findBand("Voting is open");
  });

  it("a 401 or 403 is an answer: the study board", async () => {
    serve({
      election: { status: 403, body: { error: "forbidden" } },
      board: null,
    });
    render(<App />);
    expect(
      await screen.findByText(/No elections have been run/),
    ).toBeInTheDocument();
    expect(calls("/api/live/election")).toBe(1);
  });

  it("?run= answered 404: the study board", async () => {
    serve(none);
    window.history.replaceState(null, "", "/board/?run=gone");
    render(<App />);
    await waitFor(() => expect(calls("/runs")).toBe(1));
    expect(calls("/api/board/gone")).toBeGreaterThanOrEqual(1);
  });

  it("?run= with a live answer shows the live view of that run", async () => {
    serve(closed);
    window.history.replaceState(null, "", `/board/?run=${RUN}`);
    render(<App />);
    await findBand("Voting is closed");
    expect(calls(`/api/board/${RUN}`)).toBeGreaterThan(0);
  });

  it("?run= with a study answer shows the study board unchanged", async () => {
    serve(none);
    boards["study-1"] = {
      status: 200,
      body: {
        ...(verified.board!.body as object),
        election_id: "study-1",
        name: "Study Run",
        mode: "onchain",
        live: undefined,
      },
    };
    window.history.replaceState(null, "", "/board/?run=study-1");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Study Run", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Final Results")).toBeInTheDocument();
  });

  it("no ?run= and a live election: follows it without writing ?run=", async () => {
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    expect(window.location.search).toBe("");
  });

  it("no ?run= and live mode with nothing set up: the no-election band", async () => {
    serve(none);
    render(<App />);
    await findBand("No election is running");
    expect(calls("/runs")).toBe(0);
  });

  it("no ?run= and live mode off: the study board, as before", async () => {
    serve(liveOff);
    runs = [];
    render(<App />);
    expect(
      await screen.findByText(/No elections have been run/),
    ).toBeInTheDocument();
    expect(calls("/runs")).toBe(1);
  });
});

describe("live board: refresh", () => {
  it("asks again while the tab is visible and moves to the next state by itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    const before = calls("/api/live/election");
    serve(closed);
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    expect(calls("/api/live/election")).toBeGreaterThan(before);
    await findBand("Voting is closed");
  });

  it("stops while the tab is hidden and resumes on return", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    await act(() => vi.advanceTimersByTimeAsync(10));
    act(() => setVisibility("hidden"));
    const hidden = calls("/api/live/election");
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 4));
    expect(calls("/api/live/election")).toBe(hidden);
    act(() => setVisibility("visible"));
    await waitFor(() =>
      expect(calls("/api/live/election")).toBeGreaterThan(hidden),
    );
  });

  it("follows a new run_id", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(abandoned);
    render(<App />);
    await findBand("Election abandoned");
    const next = structuredClone(setup) as unknown as Fixture;
    const NEXT = "live-20261115-101500-f1x7c0d2";
    (next.election.body as { run_id: string; election_id: string }).run_id =
      NEXT;
    (next.election.body as { election_id: string }).election_id = NEXT;
    (next.board!.body as { election_id: string }).election_id = NEXT;
    fixture = next;
    boards[NEXT] = next.board!;
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    await findBand("Election created");
    expect(calls(`/api/board/${NEXT}`)).toBeGreaterThan(0);
  });

  it("keeps the last content and says so when a poll fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    expect(
      await screen.findByText(/The board could not be reached/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Voting is open" }),
    ).toBeInTheDocument();
  });

  it("announces a changed count, not an unchanged one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    const status = screen.getByRole("status");
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    expect(status).toHaveTextContent("");
    const more = structuredClone(open) as unknown as Fixture;
    (
      more.board!.body as { live: { counts: { ballot_records: number } } }
    ).live.counts.ballot_records = 5;
    serve(more);
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    await waitFor(() =>
      expect(status).toHaveTextContent(
        "Voting is open. 5 ballot records on chain.",
      ),
    );
  });

  it("Check now asks at once and shows that it is busy", async () => {
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled(),
    );
    const before = calls("/api/live/election");
    let release: () => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(respond(fixture.election));
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(
      await screen.findByRole("button", { name: "Checking…" }),
    ).toBeDisabled();
    release();
    await screen.findByRole("button", { name: "Check now" });
    expect(calls("/api/live/election")).toBeGreaterThan(before);
  });
});

describe("live board: names and results", () => {
  it("shows ids through idToName, wrapping, never cut", async () => {
    serve(longNames);
    render(<App />);
    await findBand("Result verified");
    expect(await screen.findByText("Juan P. Dela Cruz")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Representative for the College of Computing Studies and Sciences",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Juan-P\.-Dela-Cruz/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Names shown are the ids recorded on chain."),
    ).toBeInTheDocument();
  });

  it("before the tally, results are one sentence and the positions by name", async () => {
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    const results = screen.getByRole("region", { name: "Results" });
    expect(
      within(results).getByText(/Ballots stay sealed while voting is open/),
    ).toBeInTheDocument();
    expect(within(results).getByText("Vice President")).toBeInTheDocument();
    expect(within(results).queryAllByRole("progressbar")).toHaveLength(0);
  });

  /** m3 (rehearsal 4): no totals and no winner before the result is verified. */
  for (const [name, f] of [
    ["tallied", tallied],
    ["tallied with failed checks", failed],
    ["verified with the console's count", verifiedConsole],
  ] as const) {
    it(`${name}: published and checked words only, no totals and no winner`, async () => {
      serve(f);
      render(<App />);
      const results = await screen.findByRole("region", { name: "Results" });
      // The board answer has arrived: the band is past its first read.
      await waitFor(() =>
        expect(screen.getAllByText(/published/).length).toBeGreaterThan(0),
      );
      await new Promise((r) => setTimeout(r, 50));
      expect(within(results).queryByText("ELECTED")).not.toBeInTheDocument();
      expect(within(results).queryAllByRole("progressbar")).toHaveLength(0);
      expect(within(results).queryByText(/votes? counted/)).toBeNull();
      expect(within(results).queryByText(/elected/)).toBeNull();
      expect(results.textContent).not.toMatch(/\d/);
      expect(within(results).getByText("President")).toBeInTheDocument();
    });
  }

  /** Rehearsal 5, I2: the closed fixture with the console's minimum. */
  function closedWith(records: number, min?: number, src = "chain") {
    const f = JSON.parse(JSON.stringify(closed)) as {
      election: { body: { counts: Record<string, unknown> } };
      board: { body: { live: { counts: Record<string, unknown> } } } | null;
    };
    for (const c of [f.election.body.counts, f.board?.body.live.counts]) {
      if (!c) continue;
      c.ballot_records = records;
      c.ballot_records_source = src;
      if (min !== undefined) c.min_ballot_records = min;
    }
    return f;
  }
  const STUCK =
    "This election was closed with 2 ballot records, and decryption needs at least 4, so it cannot be decrypted. No result will be published for it.";

  it("closed below the minimum: the band and the results say it cannot be decrypted, and promise no totals (rehearsal 5, I2)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(closedWith(2, 4));
    render(<App />);
    const b = await findBand("Voting is closed");
    await act(() => vi.advanceTimersByTimeAsync(STUCK_HOLD_MS + LIVE_POLL_MS));
    await waitFor(() => expect(within(b).getByText(STUCK)).toBeInTheDocument());
    const results = screen.getByRole("region", { name: "Results" });
    expect(within(results).getByText(STUCK)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/totals appear/);
    expect(document.body.textContent).not.toMatch(/reset/i);
    expect(within(b).queryByText(/trustee shares? recorded/)).toBeNull();
  });

  it("the hold: the old sentence at first, the stuck one after 6 s of low chain counts, the old one again on a sufficient count (review of rehearsal 5)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(closedWith(2, 4));
    render(<App />);
    await findBand("Voting is closed");
    const results = screen.getByRole("region", { name: "Results" });
    expect(
      await within(results).findByText(/The totals appear when the trustees/),
    ).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 2));
    expect(within(results).queryByText(STUCK)).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(STUCK_HOLD_MS));
    expect(await within(results).findByText(STUCK)).toBeInTheDocument();
    serve(closedWith(4, 4));
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    expect(
      await within(results).findByText(/The totals appear when the trustees/),
    ).toBeInTheDocument();
    expect(screen.queryByText(STUCK)).toBeNull();
  });

  it("a count from the console, or a count below 0, never makes the claim", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    for (const f of [closedWith(2, 4, "console"), closedWith(-1, 4)]) {
      serve(f);
      const { unmount } = render(<App />);
      await findBand("Voting is closed");
      await act(() =>
        vi.advanceTimersByTimeAsync(STUCK_HOLD_MS + LIVE_POLL_MS * 2),
      );
      const results = screen.getByRole("region", { name: "Results" });
      expect(
        within(results).getByText(/The totals appear when the trustees/),
      ).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/cannot be decrypted/);
      unmount();
    }
  });

  it("closed with enough records, or without the field: as before", async () => {
    for (const f of [closedWith(4, 4), closedWith(2)]) {
      serve(f);
      const { unmount } = render(<App />);
      await findBand("Voting is closed");
      const results = screen.getByRole("region", { name: "Results" });
      expect(
        await within(results).findByText(/The totals appear when the trustees/),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("tallied: the results say the result is published on the chain and being checked", async () => {
    serve(tallied);
    render(<App />);
    await findBand("Result published, checking");
    const results = screen.getByRole("region", { name: "Results" });
    expect(
      within(results).getByText(
        "The result is published on the chain and is being checked. The totals appear here once the check passes.",
      ),
    ).toBeInTheDocument();
    expect(
      within(results).getByText("published, checking"),
    ).toBeInTheDocument();
  });

  it("after the tally, the ranked results from the board answer", async () => {
    serve(verified);
    render(<App />);
    await findBand("Result verified");
    const results = screen.getByRole("region", { name: "Results" });
    expect(
      await within(results).findByText("Maria Santos"),
    ).toBeInTheDocument();
    expect(within(results).getAllByText("ELECTED")).toHaveLength(2);
  });
});

describe("live board: the voter list", () => {
  const FULL =
    "cc0ad92dc0fce5cd088bde29bd4f6c03f3d66122e4fe06d4f44425851273dd75";

  async function findList() {
    const heading = await screen.findByRole("heading", {
      name: "Voter list",
      level: 2,
    });
    const section = heading.closest("section");
    if (!section) throw new Error("voter list heading outside a section");
    return section;
  }

  it("sits under the results, in their column, before the trustees (m10)", async () => {
    serve(openList);
    render(<App />);
    const list = await findList();
    const results = screen.getByRole("region", { name: "Results" });
    const trustees = screen.getByRole("region", { name: "Trustees" });
    // Results and the voter list share the left column; trustees do not.
    expect(list.parentElement).toBe(results.parentElement);
    expect(trustees.parentElement).not.toBe(results.parentElement);
    // Reading order (and the phone's stacking): results, list, trustees.
    expect(
      results.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      list.compareDocumentPosition(trustees) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the precinct, the console's counts, the short fingerprint and the note", async () => {
    serve(openList);
    render(<App />);
    const s = await findList();
    // The sentence comes with the board answer, which can follow the view.
    expect(
      await within(s).findByText(
        "The list is kept by the election console. It is not written to the ledger.",
      ),
    ).toBeInTheDocument();
    expect(
      within(s).getByText("Precinct 0001A (demonstration)"),
    ).toBeInTheDocument();
    expect(within(s).getByText("Voters on the list: 17")).toBeInTheDocument();
    expect(within(s).getByText("Checked in: 3")).toBeInTheDocument();
    expect(within(s).getByText("Credentials issued: 2")).toBeInTheDocument();
    expect(within(s).getByText("cc0ad92dc0fce5cd")).toBeInTheDocument();
    expect(within(s).queryByText(FULL)).not.toBeInTheDocument();
  });

  it("shows the full fingerprint on demand, with a copy control, and back", async () => {
    serve(openList);
    render(<App />);
    const s = await findList();
    fireEvent.click(
      within(s).getByRole("button", { name: "Show the full fingerprint" }),
    );
    expect(within(s).getByText(FULL)).toBeInTheDocument();
    expect(
      within(s).getByText("List fingerprint (SHA-256)"),
    ).toBeInTheDocument();
    expect(
      within(s).getByRole("button", { name: /copy/i }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(s).getByRole("button", { name: "Show the short form" }),
    );
    expect(within(s).queryByText(FULL)).not.toBeInTheDocument();
    expect(within(s).getByText("cc0ad92dc0fce5cd")).toBeInTheDocument();
  });

  it("an election without a list shows no list section and no list numbers", async () => {
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    expect(
      screen.queryByRole("heading", { name: "Voter list" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Voters on the list/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Checked in/)).not.toBeInTheDocument();
    expect(screen.queryByText(/demonstration/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/not written to the ledger/),
    ).not.toBeInTheDocument();
  });

  it("a count the console does not send is left out, never shown as zero", async () => {
    const f = JSON.parse(JSON.stringify(openList));
    delete f.election.body.counts.checked_in;
    delete f.board.body.live.counts.checked_in;
    serve(f);
    render(<App />);
    const s = await findList();
    expect(within(s).getByText("Voters on the list: 17")).toBeInTheDocument();
    expect(within(s).queryByText(/Checked in/)).not.toBeInTheDocument();
  });

  it("without a fingerprint from the console, nothing about a list is shown", async () => {
    const f = JSON.parse(JSON.stringify(openList));
    delete f.election.body.voter_list_fingerprint;
    delete f.board.body.live.voter_list_fingerprint;
    serve(f);
    render(<App />);
    await findBand("Voting is open");
    expect(screen.queryByText(/Voters on the list/)).not.toBeInTheDocument();
  });

  it("the note is the console's sentence: no board note, no sentence", async () => {
    const f = JSON.parse(JSON.stringify(openList));
    delete f.board.body.live.voter_list_note;
    serve(f);
    render(<App />);
    const s = await findList();
    await waitFor(() => expect(calls(`/api/board/${RUN}`)).toBeGreaterThan(0));
    await act(async () => {});
    expect(within(s).getByText("Voters on the list: 17")).toBeInTheDocument();
    expect(within(s).queryByText(/ledger/)).not.toBeInTheDocument();
  });

  it("no em dash in the section's text", async () => {
    serve(openList);
    render(<App />);
    const s = await findList();
    expect(s.textContent).not.toMatch(/\u2014/);
  });
});

describe("final fix wave: board", () => {
  /** The fixture without any decryption or signature count. */
  function withoutCounts(f: unknown): unknown {
    const copy = structuredClone(f) as Record<string, unknown>;
    const strip = (v: unknown): void => {
      if (Array.isArray(v)) return v.forEach(strip);
      if (typeof v !== "object" || v === null) return;
      const o = v as Record<string, unknown>;
      delete o.trustees_decrypted;
      delete o.tally_signatures;
      Object.values(o).forEach(strip);
    };
    strip(copy);
    return copy;
  }

  it("1: no share or signature count from the console: no made-up 0", async () => {
    serve(withoutCounts(closed));
    render(<App />);
    const b = await findBand("Voting is closed");
    expect(
      within(b).queryByText(/trustee shares recorded/),
    ).not.toBeInTheDocument();
    await screen.findByText("Trustee 1");
    expect(screen.queryByText(/trustee shares? recorded/)).toBeNull();
    expect(screen.queryByText(/tally signatures? recorded/)).toBeNull();
  });

  it("6 and 7: a poll that hangs is given up after 10 s and said, as a status", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    render(<App />);
    await findBand("Voting is open");
    let aborted = 0;
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted += 1;
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));
    expect(screen.queryByText(/The board could not be reached/)).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(aborted).toBeGreaterThan(0);
    expect(screen.getByText(/The board could not be reached/)).toHaveAttribute(
      "role",
      "status",
    );
    // The next tick asks again.
    serve(open);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const p = path(input);
      if (p === "/api/live/election") return respond(fixture.election);
      return respond(boards[RUN]!);
    });
    // A tick may have started a read on the hanging mock just before the
    // swap; it holds the in-flight slot until its own limit, so the clock
    // goes past that limit and one more tick, whatever the run's timing.
    await act(() =>
      vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + LIVE_POLL_MS),
    );
    await waitFor(() =>
      expect(screen.queryByText(/The board could not be reached/)).toBeNull(),
    );
  });

  it("m6: the short fingerprint's button has no side padding", async () => {
    serve(openList);
    render(<App />);
    const b = await screen.findByRole("button", {
      name: "Show the full fingerprint",
    });
    expect(b.style.paddingInline).toBe("0");
  });

  it("a cut-off 200 from the console is asked again, never read as the study board", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(open);
    const ok = fetchMock.getMockImplementation()!;
    let n = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (path(input) === "/api/live/election" && ++n === 1) {
        return new Response('{"run_id":"live-', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return ok(input);
    });
    render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(PROBE_BACKOFF_MS[0]! + 10));
    await findBand("Voting is open");
    expect(n).toBeGreaterThan(1);
    expect(calls("/runs")).toBe(0);
  });

  it("the probe's backoff timer goes with the page", async () => {
    vi.useFakeTimers();
    serve(open);
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    const page = render(<App />);
    await act(() => vi.advanceTimersByTimeAsync(10));
    page.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
