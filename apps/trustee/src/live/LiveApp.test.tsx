import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "../App";
import {
  FIXTURE_TITLE,
  PEER,
  SESSION,
  fixture,
  type FixtureName,
} from "../test/fixtures";
import type { TrusteeStatus } from "../lib/trustee";
import {
  SIGN_CONSOLE_UNREACHABLE,
  SIGN_RETRY,
  SIGN_SIGNING,
  TOTALS_UNLISTED,
  mergeLog,
} from "./model";

type Call = { url: string; method: string; body: unknown };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function text(body: string, status: number, type = "text/plain"): Response {
  return new Response(body, { status, headers: { "Content-Type": type } });
}

/**
 * A stand-in trustee process. `status` is read on every poll, so a test can
 * move the process on by reassigning it.
 */
function server(opts: {
  status?: TrusteeStatus | (() => TrusteeStatus);
  me?: () => Response;
  peer?: () => Response;
  press?: (path: string, body: unknown) => Response | Promise<Response>;
  login?: () => Response;
}) {
  const calls: Call[] = [];
  const state = { status: opts.status };
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/trustee/peer")
        return opts.peer ? opts.peer() : json(PEER);
      if (url === "/api/me") return opts.me ? opts.me() : json(SESSION);
      if (url === "/api/login")
        return opts.login ? opts.login() : new Response(null, { status: 204 });
      if (url === "/api/logout") return new Response(null, { status: 204 });
      if (url === "/api/trustee/status") {
        const s = state.status;
        if (!s) return json({ error: "no status" }, 500);
        return json(typeof s === "function" ? s() : s);
      }
      if (method === "POST" && url.startsWith("/api/trustee/")) {
        if (opts.press) return opts.press(url, body);
        return json(
          typeof state.status === "function" ? state.status() : state.status,
          202,
        );
      }
      return text("404 page not found", 404);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { calls, state, fetchMock };
}

function setVisibility(v: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: v,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function showing(name: FixtureName) {
  const srv = server({ status: fixture(name) });
  render(<App />);
  await screen.findByRole("list", { name: "Trustee steps" });
  return srv;
}

/** This trustee's own row in the Trustees panel. */
function ownRow() {
  const roster = screen.getByRole("heading", { name: "Trustees" })
    .parentElement!.parentElement!;
  return within(roster)
    .getAllByRole("listitem")
    .find((li) => li.textContent?.includes("(you)"))!;
}

function statusPolls(calls: Call[]) {
  return calls.filter((c) => c.url === "/api/trustee/status").length;
}

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  window.history.replaceState(null, "", "/trustee/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.title = "";
});

describe("live or study (asked of the server)", () => {
  it("shows the live view when /api/trustee/peer answers with an id", async () => {
    await showing("ceremonyBeforeJoin");
    expect(screen.getByText("Trustee 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(FIXTURE_TITLE)).toBeInTheDocument();
  });

  it.each([
    ["the console's 404 catch-all", () => text("404 page not found", 404)],
    [
      "the console's admin-only 401",
      () => json({ error: "sign in required" }, 401),
    ],
    ["an HTML page", () => text("<!doctype html><p>app</p>", 200, "text/html")],
    ["JSON without an id", () => json({ trustee_id: "2" })],
  ])("keeps the study view for %s", async (_, peer) => {
    const srv = server({ peer, me: () => text("404 page not found", 404) });
    render(<App />);
    // The study view asks the console for its runs; a live view never does.
    await waitFor(() =>
      expect(srv.calls.some((c) => c.url === "/runs")).toBe(true),
    );
    expect(srv.calls.some((c) => c.url === "/api/trustee/status")).toBe(false);
  });
});

describe("sign-in", () => {
  it("asks for this trustee's account when /api/me is 401", async () => {
    server({
      status: fixture("ceremonyBeforeJoin"),
      me: () => json({ error: "sign in required" }, 401),
    });
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/accepts only trustee 2's account/),
    ).toBeInTheDocument();
    expect(document.title).toBe("T2 Sign in - BalotaChain");
  });

  it("shows the process's own words when it refuses", async () => {
    server({
      status: fixture("ceremonyBeforeJoin"),
      me: () => json({ error: "sign in required" }, 401),
      login: () => text("invalid credentials", 401),
    });
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Username"), {
      target: { value: "trustee3" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "invalid credentials",
    );
  });

  it("shows a 403 on the status in the process's words", async () => {
    const srv = server({ status: fixture("ceremonyBeforeJoin") });
    srv.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/trustee/peer") return json(PEER);
      if (url === "/api/me") return json({ ...SESSION, trustee_id: "3" });
      return json({ error: "only trustee 2 may act on this process" }, 403);
    });
    render(<App />);
    expect(
      await screen.findByText("only trustee 2 may act on this process"),
    ).toBeInTheDocument();
  });
});

describe("the steps", () => {
  it("draws the tracker with a word for each step", async () => {
    await showing("decryptReady");
    const words = within(screen.getByRole("list", { name: "Trustee steps" }))
      .getAllByText(/^(done|current|locked)$/)
      .map((w) => w.textContent);
    expect(words).toEqual(["done", "current", "locked"]);
  });

  it.each<[FixtureName, string, string]>([
    ["ceremonyBeforeJoin", "Join the key ceremony", ""],
    ["decryptReady", "Decrypt", ""],
    ["signRetry", "Sign tally", ""],
  ])("%s offers %s", async (name, button) => {
    await showing(name);
    expect(screen.getByRole("button", { name: button })).toBeEnabled();
  });

  it.each<[FixtureName, (s: TrusteeStatus) => void, string, string]>([
    [
      "ceremonyBeforeJoin",
      (s) => (s.election!.state = "setup"),
      "Join the key ceremony",
      "Opens when the election is recorded on the chain.",
    ],
    [
      "ceremonyBeforeJoin",
      (s) => (s.election!.state = "open"),
      "Join the key ceremony",
      "The key ceremony is over. It ended before this trustee joined.",
    ],
    [
      "votingOpen",
      () => {},
      "Decrypt",
      "Opens when the presenter closes voting.",
    ],
  ])(
    "%s: names what unlocks a locked button",
    async (name, patch, button, unlock) => {
      const s = fixture(name);
      patch(s);
      server({ status: s });
      render(<App />);
      expect(
        await screen.findByRole("button", { name: button }),
      ).toBeDisabled();
      expect(
        within(screen.getByRole("region", { name: "Current step" })).getByText(
          unlock,
        ),
      ).toBeInTheDocument();
    },
  );

  it.each<[FixtureName, string, string, unknown]>([
    ["ceremonyBeforeJoin", "Join the key ceremony", "/api/trustee/join", {}],
    ["decryptReady", "Decrypt", "/api/trustee/decrypt", {}],
    [
      "signRetry",
      "Sign tally",
      "/api/trustee/sign",
      { totals: [2, 1, 1, 2, 0] },
    ],
  ])("%s: %s posts to its route", async (name, button, path, body) => {
    const srv = await showing(name);
    fireEvent.click(screen.getByRole("button", { name: button }));
    await waitFor(() =>
      expect(srv.calls.find((c) => c.method === "POST")).toEqual({
        url: path,
        method: "POST",
        body,
      }),
    );
  });

  it("a 409 refusal of a press is the process's sentence, not Failed with Try again (rehearsal 4, m1)", async () => {
    const msg =
      "0 ballot records are on the chain; decryption needs at least 4. No more ballot records can be added once the election is closed.";
    server({
      status: fixture("decryptReady"),
      press: () => json({ error: msg }, 409),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Decrypt" }));
    const card = await screen.findByRole("region", { name: "Current step" });
    expect(await within(card).findByText(msg)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(within(card).queryByRole("alert")).toBeNull();
    expect(ownRow().textContent).not.toMatch(/Failed/);
  });

  it("closed with fewer ballot records than decryption needs: no Decrypt, the two numbers in one sentence (m1)", async () => {
    const s = fixture("decryptReady");
    s.election!.ballot_records = 1;
    s.decryption.min_ballot_records = 4;
    server({ status: s });
    render(<App />);
    const card = await screen.findByRole("region", { name: "Current step" });
    expect(
      await within(card).findByText(
        "1 ballot record is on the chain, by the console's count; decryption needs at least 4. This election cannot be decrypted, because no ballot can be added once voting is closed. The presenter has to reset the console before the next election.",
      ),
    ).toBeInTheDocument();
    expect(within(card).queryByRole("button")).toBeNull();
  });

  it("an older process without min_ballot_records: Decrypt as before", async () => {
    const s = fixture("decryptReady");
    s.election!.ballot_records = 0;
    delete s.decryption.min_ballot_records;
    server({ status: s });
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Decrypt" }),
    ).toBeEnabled();
  });

  it("enough ballot records: Decrypt is offered", async () => {
    const s = fixture("decryptReady");
    s.decryption.min_ballot_records = s.election!.ballot_records;
    server({ status: s });
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Decrypt" }),
    ).toBeEnabled();
  });

  it.each([
    [502, "reading the election status from the chain: deadline exceeded"],
  ])("shows a %s in the process's words, then Try again", async (code, msg) => {
    const srv = server({
      status: fixture("decryptReady"),
      press: () => json({ error: msg }, code),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Decrypt" }));
    expect(await screen.findByText(msg)).toBeInTheDocument();
    const again = screen.getByRole("button", { name: "Try again" });
    expect(again).toBeEnabled();
    fireEvent.click(again);
    await waitFor(() =>
      expect(srv.calls.filter((c) => c.method === "POST")).toHaveLength(2),
    );
  });

  it("offers Try again for a failed step, and none for a blocked one", async () => {
    const failed = fixture("decryptReady");
    failed.steps.decrypt = {
      state: "failed",
      error: "reading ballots from the chain: connection reset",
      updated_at: "2026-11-20T09:20:00Z",
    };
    server({ status: failed });
    const { unmount } = render(<App />);
    const card = await screen.findByRole("region", { name: "Current step" });
    expect(
      within(card).getByText(
        "reading ballots from the chain: connection reset",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    unmount();

    server({ status: fixture("oneAlarm") });
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Decrypt" }),
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(
      screen.getByText(
        "An alarm above blocks this step. It stays blocked for this election.",
      ),
    ).toBeInTheDocument();
  });

  it("moves to the next step on a poll, without a tap", async () => {
    const srv = server({ status: fixture("votingOpen") });
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Decrypt" }),
    ).toBeDisabled();
    srv.state.status = fixture("decryptReady");
    await waitFor(
      () =>
        expect(screen.getByRole("button", { name: "Decrypt" })).toBeEnabled(),
      { timeout: 4000 },
    );
  });
});

describe("the roster", () => {
  it("marks this trustee and counts against the threshold", async () => {
    await showing("decryptDone");
    const roster = screen.getByRole("heading", { name: "Trustees" })
      .parentElement!.parentElement!;
    expect(within(roster).getByText("Trustee 2 (you)")).toBeInTheDocument();
    expect(within(roster).getByText("2 of 3 needed")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("shows per-trustee status only where the status carries it", async () => {
    await showing("decryptDone");
    const roster = screen.getByRole("heading", { name: "Trustees" })
      .parentElement!.parentElement!;
    const items = within(roster).getAllByRole("listitem");
    const chip = (i: number) => items[i]!.textContent;
    expect(chip(0)).toContain("Same ballots"); // peer_checks: ok
    expect(chip(1)).toContain("Waiting"); // own sign step: waiting on others
    expect(chip(2)).toContain("No ballot set yet"); // peer_checks: waiting
    expect(chip(3)).toContain("No report"); // nothing in the status
    expect(chip(4)).toContain("No report");
    // The status never says which others recorded a partial.
    expect(within(roster).queryByText("Recorded")).toBeNull();
  });

  it("follows the peers' ballot sets on every poll (I1)", async () => {
    const srv = server({ status: fixture("decryptDone") });
    render(<App />);
    await screen.findByRole("list", { name: "Trustee steps" });
    const items = () =>
      within(
        screen.getByRole("heading", { name: "Trustees" }).parentElement!
          .parentElement!,
      ).getAllByRole("listitem");
    expect(items()[2]!.textContent).toContain("No ballot set yet");
    const later = fixture("decryptDone");
    later.decryption.peer_checks = [
      { trustee_id: 1, state: "ok" },
      { trustee_id: 3, state: "ok" },
      {
        trustee_id: 4,
        state: "unreachable",
        detail: "not reachable: dial tcp 127.0.0.1:9004: connection refused",
      },
      {
        trustee_id: 5,
        state: "waiting",
        detail: "it has no ballot set for this election yet",
      },
    ];
    srv.state.status = later;
    await waitFor(
      () => expect(items()[2]!.textContent).toContain("Same ballots"),
      { timeout: 4000 },
    );
    expect(items()[3]!.textContent).toContain("No report");
    expect(items()[3]!.textContent).toContain("connection refused");
    expect(items()[4]!.textContent).toContain("No ballot set yet");
  });

  it("never prints Not reachable beside a peer that answered (saksi minor 4)", async () => {
    const s = fixture("decryptDone");
    s.decryption.peer_checks = [
      { trustee_id: 1, state: "unreachable", detail: "answered 503" },
    ];
    server({ status: s });
    render(<App />);
    await screen.findByRole("list", { name: "Trustee steps" });
    const row = within(
      screen.getByRole("heading", { name: "Trustees" }).parentElement!
        .parentElement!,
    ).getAllByRole("listitem")[0]!;
    expect(row).toHaveTextContent("No report");
    expect(row).toHaveTextContent("answered 503");
    expect(row).not.toHaveTextContent("No ballot set yet");
    expect(row).not.toHaveTextContent(/not reachable/i);
  });

  it("reports a peer's ballot set when this trustee has none to compare (I1)", async () => {
    const s = fixture("publishedNotSigned");
    s.decryption.peer_checks = [
      {
        trustee_id: 1,
        state: "reported",
        detail:
          "trustee 1 read ballot set 9C1D-0B7E-61A4-3F28-D5C9-8E12-47B0-A6F3; this trustee has not read one to compare",
      },
    ];
    server({ status: s });
    render(<App />);
    await screen.findByRole("list", { name: "Trustee steps" });
    const items = within(
      screen.getByRole("heading", { name: "Trustees" }).parentElement!
        .parentElement!,
    ).getAllByRole("listitem");
    expect(items[0]!.textContent).toContain("Ballot set read");
    expect(items[0]!.textContent).toContain("9C1D-0B7E");
    expect(items[0]!.textContent).not.toContain("Same ballots");
  });

  it("shows the roster checks with each peer's host during the ceremony", async () => {
    await showing("ceremonyWaiting");
    expect(screen.getAllByText("Roster checked")).toHaveLength(2);
    expect(
      screen.getByText(
        "not reachable: dial tcp 127.0.0.1:9004: connection refused",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not checked yet")).toBeInTheDocument();
  });
});

describe("the totals", () => {
  it("lists what is signed, by name, before the signature is posted", async () => {
    await showing("signing");
    // No label sits above the position headings (DESIGN.md).
    expect(screen.queryByText("Totals to sign")).toBeNull();
    expect(screen.getByText("Juan P. Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Carla Lim")).toBeInTheDocument();
    expect(screen.queryByText("Juan-P.-Dela-Cruz")).toBeNull();
  });

  it("offers no Sign tally unless the process says ready_to_sign (the retry)", async () => {
    const s = fixture("signRetry");
    s.tally.ready_to_sign = false;
    server({ status: s });
    render(<App />);
    const card = await screen.findByRole("region", { name: "Current step" });
    expect(within(card).queryByRole("button")).toBeNull();
    // The failure keeps its own words.
    expect(within(card).getByRole("alert")).toHaveTextContent(
      "the console answered 500: internal error",
    );
  });

  it("says the published tally matches", async () => {
    await showing("publishedMatch");
    expect(
      screen.getByText("The published tally equals this trustee's own count."),
    ).toBeInTheDocument();
    expect(document.title).toBe("T2 Published - BalotaChain");
  });

  it("says the published tally does not match, with both numbers", async () => {
    await showing("publishedMismatch");
    expect(
      screen.getByText(
        "The published tally does not equal this trustee's own count.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("1 (published 2)")).toBeInTheDocument();
  });
});

describe("the key share", () => {
  it("says matches chain only when the transcript check is ok", async () => {
    await showing("ceremonyDone");
    expect(screen.getByText("matches chain")).toBeInTheDocument();
    expect(
      screen.getByText("1A2B-9C1E-44D0-7F3A-E2B8-0D6C-5A91-77AB"),
    ).toBeInTheDocument();
  });

  it("does not say matches chain before the check", async () => {
    const s = fixture("ceremonyDone");
    s.ceremony.transcript_check = "";
    server({ status: s });
    render(<App />);
    expect(
      await screen.findByText("Not checked against the chain yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("matches chain")).toBeNull();
  });

  it("states a mismatch in words", async () => {
    const s = fixture("ceremonyDone");
    s.ceremony.transcript_check = "mismatch";
    server({ status: s });
    render(<App />);
    expect(
      await screen.findByText(
        /The election key on the chain does not match this trustee's/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("matches chain")).toBeNull();
  });
});

describe("alarms and the log", () => {
  it("shows every alarm with what it blocks", async () => {
    await showing("oneAlarm");
    const alarms = screen.getByRole("region", { name: "Alarms" });
    expect(alarms).toHaveTextContent(
      "Alarm: trustee 3 read another ballot set",
    );
    expect(alarms).toHaveTextContent("Blocks Decrypt and Tally signature.");
  });

  it("builds the log only from timed facts, newest first", async () => {
    await showing("oneAlarm");
    const log = screen.getByRole("list", {
      name: "Ceremony log, newest first",
    });
    const rows = within(log)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain(
      "Decrypt: blockedblocked by an alarm: ballots-peer-3",
    );
    expect(rows[1]).toContain("Alarmtrustee 3 read another ballot set");
    expect(rows[2]).toContain("Key ceremony: done");
    // Sign was never touched (Go's zero time): not in the log.
    expect(log).not.toHaveTextContent("Tally signature");
  });

  it("keeps earlier states of the same election and drops another's", () => {
    const a = fixture("ceremonyJoining");
    const b = fixture("ceremonyWaiting");
    const first = mergeLog([], null, a);
    const second = mergeLog(first, a.election!.election_id, b);
    expect(second.map((e) => e.lead)).toEqual([
      "Key ceremony: waiting",
      "Key ceremony: running",
    ]);
    const other = fixture("ceremonyWaiting");
    other.election!.election_id = "live-other";
    expect(mergeLog(second, a.election!.election_id, other)).toHaveLength(1);
  });
});

describe("waiting and writes (D9)", () => {
  it("polls while visible and stops while hidden", async () => {
    vi.useFakeTimers();
    const srv = server({ status: fixture("votingOpen") });
    render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const start = statusPolls(srv.calls);
    expect(start).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7500);
    });
    expect(statusPolls(srv.calls)).toBe(start + 3);

    act(() => setVisibility("hidden"));
    const hidden = statusPolls(srv.calls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(statusPolls(srv.calls)).toBe(hidden);

    act(() => setVisibility("visible"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(statusPolls(srv.calls)).toBe(hidden + 1);
  });

  it("names the work while it is in progress, then asks to keep the page open", async () => {
    vi.useFakeTimers();
    let release: (r: Response) => void = () => {};
    server({
      status: fixture("decryptReady"),
      press: () => new Promise<Response>((r) => (release = r)),
    });
    render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    fireEvent.click(screen.getByRole("button", { name: "Decrypt" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(
      screen.getByRole("button", { name: "Recording on chain…" }),
    ).toBeDisabled();
    expect(
      screen.queryByText("Still recording. Keep this page open."),
    ).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(
      screen.getByText("Still recording. Keep this page open."),
    ).toBeInTheDocument();
    // Not timed out: still in progress after a minute.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(
      screen.getByRole("button", { name: "Recording on chain…" }),
    ).toBeDisabled();
    release(json(fixture("decryptRunning"), 202));
  });

  it("follows the step's running state, not only the request", async () => {
    await showing("decryptRunning");
    expect(
      screen.getByRole("button", { name: "Recording on chain…" }),
    ).toBeDisabled();
    expect(
      within(screen.getByRole("region", { name: "Current step" })).getByText(
        "reading the ballots from the chain",
      ),
    ).toBeInTheDocument();
  });

  it("has a Check now control with a busy state", async () => {
    let release: (r: Response) => void = () => {};
    let n = 0;
    const srv = server({ status: fixture("votingOpen") });
    srv.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/trustee/peer") return json(PEER);
      if (url === "/api/me") return json(SESSION);
      n += 1;
      if (n === 1) return json(fixture("votingOpen"));
      return new Promise<Response>((r) => (release = r));
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Check now" }));
    expect(
      await screen.findByRole("button", { name: "Checking…" }),
    ).toBeDisabled();
    release(json(fixture("decryptReady")));
    expect(
      await screen.findByRole("button", { name: "Check now" }),
    ).toBeEnabled();
  });

  it("says when the process cannot reach the console", async () => {
    await showing("consoleUnreachable");
    expect(
      screen.getByText(/This trustee process cannot reach the console\./),
    ).toHaveTextContent("dial tcp: connection refused");
  });

  it.each<[FixtureName, string]>([
    ["noElection", "T2 No election - BalotaChain"],
    ["ceremonyWaiting", "T2 Ceremony - BalotaChain"],
    ["decryptReady", "T2 Decrypt - BalotaChain"],
    ["signing", "T2 Signature - BalotaChain"],
    ["signRetry", "T2 Signature - BalotaChain"],
    ["signed", "T2 Signed - BalotaChain"],
  ])("titles the tab for %s", async (name, title) => {
    await showing(name);
    expect(document.title).toBe(title);
  });
});

describe("fix round 1", () => {
  it("shows identity once, as a heading above the tracker", async () => {
    await showing("decryptReady");
    const heading = screen.getByRole("heading", { name: "Trustee 2 of 5" });
    expect(screen.getAllByText("Trustee 2 of 5")).toHaveLength(1);
    const tracker = screen.getByRole("list", { name: "Trustee steps" });
    expect(
      heading.compareDocumentPosition(tracker) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("drops a poll that was already out when the press started (M2)", async () => {
    let releasePoll: (r: Response) => void = () => {};
    let polls = 0;
    const srv = server({ status: fixture("decryptReady") });
    srv.fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/trustee/peer") return json(PEER);
        if (url === "/api/me") return json(SESSION);
        if (init?.method === "POST")
          return json(fixture("decryptRunning"), 202);
        polls += 1;
        if (polls === 1) return json(fixture("decryptReady"));
        return new Promise<Response>((r) => (releasePoll = r));
      },
    );
    render(<App />);
    const button = await screen.findByRole("button", { name: "Decrypt" });
    // Poll 2 goes out (Check now) and stays out.
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() => expect(polls).toBe(2));
    fireEvent.click(button);
    await screen.findByRole("button", { name: "Recording on chain…" });
    act(() => releasePoll(json(fixture("decryptReady"))));
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.getByRole("button", { name: "Recording on chain…" }),
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Decrypt" })).toBeNull();
  });

  it("shows no button while Join waits on others, only a status line (M3)", async () => {
    await showing("ceremonyWaiting");
    const card = screen.getByRole("region", { name: "Current step" });
    expect(within(card).queryByRole("button")).toBeNull();
    expect(within(card).getByRole("status")).toHaveTextContent(
      "waiting for trustee 4's host to state its roster digest",
    );
  });

  it("says Sign is not needed after publication for a trustee that never signed (M4)", async () => {
    await showing("publishedNotSigned");
    expect(document.title).toBe("T2 Published - BalotaChain");
    const words = within(screen.getByRole("list", { name: "Trustee steps" }))
      .getAllByText(/^(done|current|locked|not needed)$/)
      .map((w) => w.textContent);
    expect(words).toEqual(["done", "not needed", "not needed"]);
    const card = screen.getByRole("region", { name: "Current step" });
    // Rehearsal 7, minor 3: this trustee never decrypted.
    expect(card).toHaveTextContent(
      "This trustee did not decrypt this election, so no signature from it is needed.",
    );
    expect(card).not.toHaveTextContent("before this trustee signed");
    expect(within(card).queryByRole("button")).toBeNull();
    // m2 (rehearsal 2): the own row says what the tracker says.
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Not needed");
    expect(screen.queryByText("Not signed")).toBeNull();
  });

  it.each<[string, (s: TrusteeStatus) => void]>([
    ["totals shorter than the contest ids", (s) => s.tally.totals!.pop()],
    [
      "contests naming another number",
      (s) => {
        s.tally.contests![0]!.total = 9;
      },
    ],
    ["no contest ids", (s) => (s.election!.contest_ids = [])],
  ])(
    "keeps Sign off when the totals cannot be listed: %s",
    async (_, patch) => {
      const s = fixture("signRetry");
      patch(s);
      server({ status: s });
      render(<App />);
      expect(
        await screen.findByRole("button", { name: "Sign tally" }),
      ).toBeDisabled();
      expect(screen.getByText(TOTALS_UNLISTED)).toBeInTheDocument();
      expect(screen.queryByText("Maria Santos")).toBeNull();
    },
  );

  it("lists the totals from what Sign sends", async () => {
    const s = fixture("signRetry");
    s.tally.contests = [];
    const srv = server({ status: s });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign tally" }));
    expect(
      screen.getByText("Juan P. Dela Cruz").parentElement,
    ).toHaveTextContent("1");
    await waitFor(() =>
      expect(srv.calls.find((c) => c.method === "POST")?.body).toEqual({
        totals: [2, 1, 1, 2, 0],
      }),
    );
  });

  it("keeps the ballot-count live region mounted (M10)", async () => {
    await showing("votingOpen");
    const region = screen.getByTestId("ballot-count");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("replaces a log entry whose detail changed at the same time (M9)", () => {
    const a = fixture("ceremonyWaiting");
    const b = fixture("ceremonyWaiting");
    b.steps.join = { ...b.steps.join!, detail: "waiting for trustee 5" };
    const first = mergeLog([], null, a);
    const second = mergeLog(first, a.election!.election_id, b);
    expect(second).toHaveLength(1);
    expect(second[0]!.detail).toBe("waiting for trustee 5");
  });
});

describe("fix round 2", () => {
  it("does not tick Sign or say Signed when the signature was never posted (N2)", async () => {
    await showing("signedAfterPublication");
    const words = within(screen.getByRole("list", { name: "Trustee steps" }))
      .getAllByText(/^(done|current|locked|not needed)$/)
      .map((w) => w.textContent);
    expect(words).toEqual(["done", "done", "not needed"]);
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Not needed");
    expect(screen.queryByText("Not signed")).toBeNull();
    expect(screen.queryByText("Signed")).toBeNull();
    const card = screen.getByRole("region", { name: "Current step" });
    expect(card).toHaveTextContent(
      "the tally was published with other trustees' signatures before this one was posted",
    );
    expect(card).toHaveTextContent(
      "so no signature from this trustee is needed",
    );
    expect(document.title).toBe("T2 Published - BalotaChain");
  });

  it("says not needed before this trustee reads the publication too (N2)", async () => {
    const s = fixture("signedAfterPublication");
    s.tally.published = false;
    s.tally.published_totals = [];
    s.tally.matches = null;
    server({ status: s });
    render(<App />);
    const card = await screen.findByRole("region", { name: "Current step" });
    expect(card).toHaveTextContent("Tally published");
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Not needed");
    expect(document.title).toBe("T2 Published - BalotaChain");
  });

  it("ticks Sign and says Signed for a posted signature", async () => {
    await showing("publishedMatch");
    const words = within(screen.getByRole("list", { name: "Trustee steps" }))
      .getAllByText(/^(done|current|locked|not needed)$/)
      .map((w) => w.textContent);
    expect(words).toEqual(["done", "done", "done"]);
    expect(screen.getByText("Signed")).toBeInTheDocument();
    expect(screen.queryByText("Not signed")).toBeNull();
  });

  it("sends no poll while a press is out, so none lands after its answer (R1)", async () => {
    vi.useFakeTimers();
    let release: (r: Response) => void = () => {};
    const srv = server({
      status: fixture("decryptReady"),
      press: () => new Promise<Response>((r) => (release = r)),
    });
    render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    fireEvent.click(screen.getByRole("button", { name: "Decrypt" }));
    const before = statusPolls(srv.calls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7500);
    });
    expect(statusPolls(srv.calls)).toBe(before);
    await act(async () => {
      release(json(fixture("decryptRunning"), 202));
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(
      screen.getByRole("button", { name: "Recording on chain…" }),
    ).toBeDisabled();
    // Polling resumes after the press, with the process's own state.
    srv.state.status = fixture("decryptRunning");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(statusPolls(srv.calls)).toBe(before + 1);
    expect(
      screen.getByRole("button", { name: "Recording on chain…" }),
    ).toBeDisabled();
  });
});

describe("a second election on the same process (rehearsal 2)", () => {
  const logRows = () =>
    within(screen.getByRole("list", { name: "Ceremony log, newest first" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");

  it("starts a new log for the new election (I3)", async () => {
    const old = fixture("publishedMatch");
    const srv = server({ status: old });
    render(<App />);
    await waitFor(() =>
      expect(logRows().some((r) => r.includes("Tally signature: done"))).toBe(
        true,
      ),
    );
    // The console moves on: the process now serves another election, with
    // no step touched yet.
    const next = fixture("ceremonyBeforeJoin");
    next.election!.election_id = "live-20261121-090000-second";
    srv.state.status = next;
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Join the key ceremony" }),
        ).toBeEnabled(),
      { timeout: 4000 },
    );
    expect(logRows()).toEqual([
      "Each step's progress is listed here as this trustee process reports it.",
    ]);
    // It joins: only the new election's entries, on every later poll too.
    const joining = fixture("ceremonyJoining");
    joining.election!.election_id = next.election!.election_id;
    srv.state.status = joining;
    await waitFor(
      () => expect(logRows()[0]).toContain("Key ceremony: running"),
      { timeout: 4000 },
    );
    await new Promise((r) => setTimeout(r, 2600));
    const rows = logRows();
    expect(rows).toHaveLength(1);
    expect(rows.join("|")).not.toMatch(/Tally signature|Decrypt/);
  }, 15000);

  it("drops a press error made in the previous election", async () => {
    const srv = server({
      status: fixture("decryptReady"),
      press: () => json({ error: "the chain says the election is open" }, 409),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Decrypt" }));
    await screen.findByText("the chain says the election is open");
    const next = fixture("ceremonyBeforeJoin");
    next.election!.election_id = "live-20261121-090000-second";
    srv.state.status = next;
    await screen.findByRole(
      "button",
      { name: "Join the key ceremony" },
      {
        timeout: 4000,
      },
    );
    expect(
      screen.queryByText("the chain says the election is open"),
    ).toBeNull();
  });
});

describe("after signing (M3)", () => {
  it("says the console publishes by itself at the threshold", async () => {
    await showing("signed");
    expect(
      screen.getByText(
        "This trustee's signature is recorded. The console publishes the result by itself when 3 signatures are held.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/presenter to publish/)).toBeNull();
  });
});

describe("final fix wave: trustee", () => {
  it("1: no decryption count in the status: no 'Decrypted 0 of 3 needed'", async () => {
    const s = fixture("decryptReady");
    delete (s as { decryption?: unknown }).decryption;
    server({ status: s });
    render(<App />);
    await screen.findByRole("list", { name: "Trustee steps" });
    expect(screen.queryByText(/of \d+ needed/)).toBeNull();
    expect(screen.queryByText("Decrypted")).toBeNull();
  });

  it("2: no time from the process: no 'Updated just now'", async () => {
    const s = fixture("votingOpen");
    (s as { updated_at?: string }).updated_at = "";
    server({ status: s });
    render(<App />);
    await screen.findByRole("list", { name: "Trustee steps" });
    expect(screen.queryByText(/just now/)).toBeNull();
    expect(screen.getByText("Refreshes by itself.")).toBeInTheDocument();
  });

  it("Check now is off while a press is out", async () => {
    let release: (r: Response) => void = () => {};
    server({
      status: fixture("decryptReady"),
      press: () => new Promise<Response>((r) => (release = r)),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Decrypt" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check now" })).toBeDisabled(),
    );
    await act(async () => release(json(fixture("decryptRunning"), 202)));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled(),
    );
  });

  it("6: a status read that hangs is given up after 10 s and said; the next tick reads again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let hang = false;
    const srv = server({ status: fixture("votingOpen") });
    const ok = srv.fetchMock.getMockImplementation()!;
    srv.fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (hang && String(input) === "/api/trustee/status") {
          return new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal!.reason),
            ),
          );
        }
        return ok(input, init);
      },
    );
    render(<App />);
    await screen.findByRole("list", { name: "Trustee steps" });
    hang = true;
    await act(() => vi.advanceTimersByTimeAsync(2500 + 10_000));
    expect(
      screen.getByText(
        /This page cannot reach the trustee process: no answer within 10 s\./,
      ),
    ).toBeInTheDocument();
    hang = false;
    await act(() => vi.advanceTimersByTimeAsync(10_000 + 2500));
    await waitFor(() =>
      expect(
        screen.queryByText(/This page cannot reach the trustee process/),
      ).toBeNull(),
    );
  });

  it("M8: the poll's request is aborted on unmount", async () => {
    let signal: AbortSignal | undefined;
    const srv = server({ status: fixture("votingOpen") });
    const ok = srv.fetchMock.getMockImplementation()!;
    let first = true;
    srv.fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/trustee/status" && !first) {
          signal = init?.signal ?? undefined;
          return new Promise<Response>(() => {});
        }
        if (String(input) === "/api/trustee/status") first = false;
        return ok(input, init);
      },
    );
    const page = render(<App />);
    await screen.findByRole("list", { name: "Trustee steps" });
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal!.aborted).toBe(false);
    page.unmount();
    expect(signal!.aborted).toBe(true);
  });
});

describe("one press per trustee: the signature follows Decrypt by itself", () => {
  const card = () => screen.getByRole("region", { name: "Current step" });
  const trackerWords = () =>
    within(screen.getByRole("list", { name: "Trustee steps" }))
      .getAllByText(/^(done|current|locked|not needed)$/)
      .map((w) => w.textContent);

  it("after Decrypt, waiting for partials: no button, the process's words, and that it signs by itself", async () => {
    await showing("decryptDone");
    expect(within(card()).queryByRole("button")).toBeNull();
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "waiting for decryptions: 2 of 3 trustees' partials on the chain",
    );
    expect(card()).toHaveTextContent(
      "No press is needed. Once enough trustees have decrypted, this trustee process combines their partials from the chain into its own count, then signs that count and posts the signature by itself, unless an alarm blocks it.",
    );
    expect(trackerWords()).toEqual(["done", "done", "current"]);
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Waiting");
  });

  it("after Decrypt with no words from the process: names the count it waits for", async () => {
    const s = fixture("decryptDone");
    s.steps.sign = { state: "idle" };
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(within(c).queryByRole("button")).toBeNull();
    expect(c).toHaveTextContent(
      "Waiting for 3 trustees to decrypt (the process last counted 2). This trustee then signs by itself, once its own count is ready.",
    );
  });

  it("signing: no button, the totals, and no claim of a signature", async () => {
    await showing("signing");
    expect(within(card()).queryByRole("button")).toBeNull();
    expect(within(card()).getByText(SIGN_SIGNING)).toBeInTheDocument();
    expect(screen.getByText("Juan P. Dela Cruz")).toBeInTheDocument();
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Signing…");
    expect(screen.queryByText("Signed")).toBeNull();
    expect(screen.queryByText(/signature is recorded/)).toBeNull();
    expect(screen.queryByText("Tally signed")).toBeNull();
  });

  it("signing for longer than 10 s does not ask to keep the page open", async () => {
    vi.useFakeTimers();
    server({ status: fixture("signing") });
    render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(screen.getByText(SIGN_SIGNING)).toBeInTheDocument();
    expect(
      screen.queryByText("Still recording. Keep this page open."),
    ).toBeNull();
  });

  it("the log names the automatic signature", async () => {
    await showing("signing");
    const log = screen.getByRole("list", {
      name: "Ceremony log, newest first",
    });
    expect(log).toHaveTextContent(
      "Tally signature: signing by itselfyour own combine gives the totals shown; signing them",
    );
  });

  it("retry: Sign tally with the process's reason, and the press posts the totals", async () => {
    const srv = await showing("signRetry");
    const c = card();
    expect(within(c).getByRole("alert")).toHaveTextContent(
      "posting the tally signature: the console answered 500: internal error",
    );
    expect(within(c).getByText(SIGN_RETRY)).toBeInTheDocument();
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Not signed");
    expect(screen.queryByText("Signed")).toBeNull();
    fireEvent.click(within(c).getByRole("button", { name: "Sign tally" }));
    await waitFor(() =>
      expect(srv.calls.find((x) => x.method === "POST")).toEqual({
        url: "/api/trustee/sign",
        method: "POST",
        body: { totals: [2, 1, 1, 2, 0] },
      }),
    );
  });

  it("a refused retry press is the process's sentence, not an error to retry", async () => {
    const msg =
      "nothing to retry: this trustee signs by itself after its Decrypt, and its sign step is running";
    server({
      status: fixture("signRetry"),
      press: () => json({ error: msg }, 409),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign tally" }));
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(await within(c).findByText(msg)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("console not answering: no button, the process posts again by itself", async () => {
    await showing("signConsoleUnreachable");
    expect(within(card()).queryByRole("button")).toBeNull();
    expect(
      within(card()).getByText(SIGN_CONSOLE_UNREACHABLE),
    ).toBeInTheDocument();
    expect(screen.queryByText("Signed")).toBeNull();
  });

  it("an alarm on the totals: blocked in its own words, never progress", async () => {
    const s = fixture("signing");
    s.steps.sign = {
      state: "blocked",
      error: "blocked by an alarm: tally-totals",
      updated_at: "2026-11-20T09:23:10Z",
    };
    s.tally.signing = "blocked";
    s.alarms = [
      {
        code: "tally-totals",
        message:
          "the console's totals differ from this trustee's own combine: it refused the signature",
        blocks: ["sign"],
        at: "2026-11-20T09:23:09Z",
      },
    ];
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(within(c).queryByRole("button")).toBeNull();
    expect(c).toHaveTextContent(
      "An alarm above blocks this step. It stays blocked for this election.",
    );
    expect(within(c).getByRole("alert")).toHaveTextContent(
      "blocked by an alarm: tally-totals",
    );
    expect(c).not.toHaveTextContent(SIGN_SIGNING);
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Blocked");
  });

  it("refused: the process's words, no button", async () => {
    const s = fixture("signing");
    s.steps.sign = {
      state: "refused",
      error: "the ballot set changed since the combine: nothing is signed",
      updated_at: "2026-11-20T09:23:10Z",
    };
    s.tally.signing = "refused";
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(within(c).queryByRole("button")).toBeNull();
    expect(within(c).getByRole("alert")).toHaveTextContent(
      "the ballot set changed since the combine: nothing is signed",
    );
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Refused");
  });

  it("a trustee that did not decrypt, before publication: Decrypt stays the step, no Sign", async () => {
    await showing("notDecrypted");
    expect(screen.getByRole("button", { name: "Decrypt" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Sign tally" })).toBeNull();
    expect(trackerWords()).toEqual(["done", "current", "locked"]);
    expect(screen.queryByText("Signed")).toBeNull();
  });

  it("published and verified: says the console checked it", async () => {
    const s = fixture("publishedMatch");
    s.election!.state = "verified";
    server({ status: s });
    render(<App />);
    expect(
      await screen.findByText(
        "The console checked the published result on the chain: verified.",
      ),
    ).toBeInTheDocument();
  });

  it("published, not verified yet: says so, without a claim", async () => {
    await showing("publishedMatch");
    expect(
      screen.getByText(
        "The console has not reported the result as verified. This page does not see the console's check; the presenter's page shows it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/: verified\./)).toBeNull();
  });
});

describe("fix round 1 (task 15 review)", () => {
  const NO_PRESS = "No press is needed.";
  const card = () => screen.getByRole("region", { name: "Current step" });

  it("Important 1: the retry card never says No press is needed", async () => {
    await showing("signRetry");
    expect(
      within(card()).getByRole("button", { name: "Sign tally" }),
    ).toBeEnabled();
    expect(card()).not.toHaveTextContent(NO_PRESS);
    expect(card()).toHaveTextContent(
      "The process signs this trustee's own count by itself after Decrypt.",
    );
  });

  it.each<[string, (s: TrusteeStatus) => void]>([
    [
      "blocked",
      (s) => {
        s.steps.sign = {
          state: "blocked",
          error: "blocked by an alarm: tally-totals",
        };
        s.tally.signing = "blocked";
      },
    ],
    [
      "refused",
      (s) => {
        s.steps.sign = { state: "refused", error: "the ballot set changed" };
        s.tally.signing = "refused";
      },
    ],
    [
      "failed with no retry offered",
      (s) => {
        s.steps.sign = { state: "failed", error: "sign-tally failed" };
        s.tally.signing = "retry";
        s.tally.ready_to_sign = false;
      },
    ],
  ])(
    "Important 1: %s: the neutral lead, never No press is needed",
    async (_, patch) => {
      const s = fixture("signing");
      patch(s);
      server({ status: s });
      render(<App />);
      const c = await screen.findByRole("region", { name: "Current step" });
      expect(c).not.toHaveTextContent(NO_PRESS);
    },
  );

  it("Important 1: waiting and signing keep No press is needed", async () => {
    await showing("signing");
    expect(card()).toHaveTextContent(NO_PRESS);
  });

  it("minor 1: the console says tallied while this trustee is still signing: not needed, no signing sentence", async () => {
    const s = fixture("signing");
    s.election!.state = "tallied";
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(c).toHaveTextContent(
      "The console reports the tally published. This trustee's signature is not needed.",
    );
    expect(c).toHaveTextContent("Tally published");
    expect(c).not.toHaveTextContent(SIGN_SIGNING);
    expect(ownRow()).toHaveTextContent("Trustee 2 (you)Not needed");
    expect(screen.queryByText("Signed")).toBeNull();
  });

  it("minor 1: Decrypt is not offered once the console says tallied", async () => {
    const s = fixture("notDecrypted");
    s.election!.state = "tallied";
    server({ status: s });
    render(<App />);
    await screen.findByRole("region", { name: "Current step" });
    expect(screen.queryByRole("button", { name: "Decrypt" })).toBeNull();
  });
});

describe("the process retries a failed signature by itself (saksi fix round)", () => {
  const detail =
    "the signature was not posted (the console answered 500: internal error); trying again by itself: attempt 1 of 3 failed";

  it("attempt 1 of 3: says it tries again by itself, with its words, and no button", async () => {
    const s = fixture("signing");
    s.steps.sign = {
      state: "waiting",
      detail,
      updated_at: "2026-11-20T09:23:10Z",
    };
    s.tally.signing = "waiting";
    s.tally.sign_problem = "post_failed";
    s.tally.sign_attempts = 1;
    s.tally.sign_attempts_max = 3;
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(c).toHaveTextContent(
      `The signature could not be posted (attempt 1 of 3). The process tries again by itself. The process reports: ${detail}`,
    );
    expect(within(c).queryByRole("button")).toBeNull();
    expect(within(c).queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Signed")).toBeNull();
  });

  it("console not answering on attempt 2: the attempt numbers, no button", async () => {
    const s = fixture("signConsoleUnreachable");
    s.tally.sign_attempts = 2;
    s.tally.sign_attempts_max = 3;
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(c).toHaveTextContent(
      "The signature could not be posted (attempt 2 of 3). The process tries again by itself.",
    );
    expect(within(c).queryByRole("button")).toBeNull();
  });

  it("after the third attempt: failed, the process's reason and Sign tally", async () => {
    const s = fixture("signRetry");
    s.steps.sign = {
      state: "failed",
      error:
        "the signature was not posted after 3 attempts (the console answered 500: internal error); press Sign tally to try again",
      updated_at: "2026-11-20T09:23:20Z",
    };
    s.tally.sign_attempts = 3;
    s.tally.sign_attempts_max = 3;
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(within(c).getByRole("alert")).toHaveTextContent(
      "the signature was not posted after 3 attempts",
    );
    expect(within(c).getByRole("button", { name: "Sign tally" })).toBeEnabled();
    expect(c).not.toHaveTextContent("tries again by itself");
  });
});

describe("rehearsal 7 minors", () => {
  it("1: at the threshold by the process's count, it says combining and signing, never 'Waiting for 3 (3 so far)'", async () => {
    const s = fixture("decryptDone");
    s.steps.sign = { state: "idle" };
    s.decryption.trustees_decrypted = 3;
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(c).toHaveTextContent(
      "Enough trustees have decrypted (the process last counted 3 of 3). This trustee process is combining their partials and signing by itself.",
    );
    expect(c).not.toHaveTextContent("Waiting for 3");
  });

  it("1: below the threshold, the count is the process's last one", async () => {
    const s = fixture("decryptDone");
    s.steps.sign = { state: "idle" };
    s.decryption.trustees_decrypted = 0;
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(c).toHaveTextContent(
      "Waiting for 3 trustees to decrypt (the process last counted 0).",
    );
    expect(c).not.toHaveTextContent("so far");
  });

  it("2: signed, and the console reports verified: says so, not 'publishes ... when 3 signatures are held'", async () => {
    const s = fixture("signed");
    s.election!.state = "verified";
    server({ status: s });
    render(<App />);
    const c = await screen.findByRole("region", { name: "Current step" });
    expect(c).toHaveTextContent(
      "This trustee's signature is recorded. The console reports the result verified.",
    );
    expect(c).not.toHaveTextContent("when 3 signatures are held");
  });

  it("3: a trustee that decrypted late keeps the published-first sentence", async () => {
    await showing("signedAfterPublication");
    const c = screen.getByRole("region", { name: "Current step" });
    expect(c).toHaveTextContent(
      "The tally was published with other trustees' signatures before this trustee signed.",
    );
    expect(c).not.toHaveTextContent("did not decrypt");
  });
});
