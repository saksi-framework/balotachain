import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import Root from "../Root";
import { stubFetch, view, answer, type Route } from "../test/liveFetch";
import { POLL_MS, PUBLISH_GRACE_MS } from "./Presenter";
import { STUCK_HOLD_MS } from "./model";
import { PROBE_LIMIT_MS } from "./probe";

const ELECTION = "GET /api/live/election";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Renders the page with the console answering `routes` (admin signed in). */
function open(routes: Record<string, Route>) {
  const server = stubFetch({
    "GET /api/me": answer("me-admin"),
    ...routes,
  });
  render(<Root />);
  return server;
}

/** The page's own heading: "Presenter: step 3 of 5, Voting". */
const heading = (re: RegExp) =>
  screen.findByRole("heading", {
    level: 2,
    name: (n) => n.startsWith("Presenter") && re.test(n),
  });

const card = () => screen.getByRole("region", { name: "Current step" });
const now = () => screen.getByRole("region", { name: "Now" });

function bodyOf(init?: RequestInit): unknown {
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

beforeEach(() => {
  setVisibility("visible");
  document.title = "";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live or study", () => {
  it("a 200 is the presenter page", async () => {
    open({ [ELECTION]: view("open-one") });
    expect(await heading(/step 3 of 5, Voting/)).toBeInTheDocument();
    expect(screen.queryByText(/Admin Console/)).toBeNull();
  });

  it("404 no election set up is the presenter page at Setup", async () => {
    open({ [ELECTION]: view("none") });
    expect(await heading(/step 1 of 5, Setup/)).toBeInTheDocument();
    expect(
      within(card()).getByRole("button", { name: "Create election" }),
    ).toBeInTheDocument();
  });

  it("404 live mode is off is the study wizard", async () => {
    const s = open({
      [ELECTION]: view("live-off"),
      "GET /api/me": answer("me-none"),
    });
    expect(await screen.findByText(/Admin Console/)).toBeInTheDocument();
    expect(screen.queryByText(/Presenter/)).toBeNull();
    expect(s.to("GET", "/api/live/election")).toHaveLength(1);
  });

  it("a non-JSON page and a 403 are answers: the study wizard", async () => {
    open({
      [ELECTION]: {
        status: 200,
        body: "<html>",
        headers: { "Content-Type": "text/html" },
      },
      "GET /api/me": answer("me-none"),
    });
    expect(await screen.findByText(/Admin Console/)).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    open({
      [ELECTION]: { status: 403, body: { error: "nope" } },
      "GET /api/me": answer("me-none"),
    });
    expect(await screen.findAllByText(/Admin Console/)).not.toHaveLength(0);
  });

  it("silence ends at a notice after four tries, never at the study wizard", async () => {
    vi.useFakeTimers();
    const s = open({ [ELECTION]: "hang" });
    for (let i = 0; i < 8; i++)
      await act(() => vi.advanceTimersByTimeAsync(PROBE_LIMIT_MS));
    expect(
      screen.getByText(
        "This page could not reach the election console. It asked 4 times and got no answer it could use.",
      ),
    ).toHaveAttribute("role", "status");
    expect(s.to("GET", "/api/live/election")).toHaveLength(4);
    expect(screen.queryByText(/Admin Console/)).toBeNull();
    for (const c of s.to("GET", "/api/live/election"))
      expect(c.init?.signal?.aborted).toBe(true);
  });

  it("a failure then a 200 ends at the live view", async () => {
    vi.useFakeTimers();
    let n = 0;
    open({
      [ELECTION]: () =>
        ++n === 1
          ? { status: 503, body: "busy" }
          : n === 2
            ? new TypeError("network")
            : view("open-one"),
    });
    for (let i = 0; i < 4; i++)
      await act(() => vi.advanceTimersByTimeAsync(1000));
    vi.useRealTimers();
    expect(await heading(/Voting/)).toBeInTheDocument();
  });

  it("Try again probes again", async () => {
    vi.useFakeTimers();
    let live = false;
    const s = open({ [ELECTION]: () => (live ? view("open-one") : "hang") });
    for (let i = 0; i < 8; i++)
      await act(() => vi.advanceTimersByTimeAsync(PROBE_LIMIT_MS));
    live = true;
    vi.useRealTimers();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await heading(/Voting/)).toBeInTheDocument();
    expect(s.to("GET", "/api/live/election").length).toBeGreaterThanOrEqual(5);
  });
});

describe("sign-in", () => {
  it("signed out shows the sign-in card and sends no admin request", async () => {
    const s = open({
      [ELECTION]: view("open-one"),
      "GET /api/me": answer("me-none"),
    });
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Presenter Sign in - BalotaChain"),
    );
    expect(s.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("a voter account is told the page needs an administrator", async () => {
    open({ [ELECTION]: view("open-one"), "GET /api/me": answer("me-voter") });
    expect(
      await screen.findByText(
        /a voter account. The presenter page needs an administrator account./,
      ),
    ).toBeInTheDocument();
  });

  it("a 403 from a write shows the console's words", async () => {
    open({
      [ELECTION]: view("tallied"),
      "POST /api/live/verify": answer("admin-required"),
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Verify again" }),
    );
    expect(await screen.findByText("admin role required")).toBeInTheDocument();
  });

  it("a 401 on a write goes to sign-in", async () => {
    const s = open({
      [ELECTION]: view("tallied"),
      "POST /api/live/verify": answer("me-none"),
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Verify again" }),
    );
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/verify")).toHaveLength(1);
  });
});

describe("each step's card", () => {
  it("setup, not yet on chain: the retry sends a valid body", async () => {
    const s = open({
      [ELECTION]: view("setup"),
      "POST /api/live/elections": view("ceremony-0"),
    });
    await heading(/step 1 of 5, Setup/);
    expect(
      within(card()).getByText("Election made, not yet on chain"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(card()).getByRole("button", { name: "Record on chain" }),
    );
    await waitFor(() =>
      expect(s.to("POST", "/api/live/elections")).toHaveLength(1),
    );
    expect(
      Object.keys(
        bodyOf(s.to("POST", "/api/live/elections")[0]!.init) as object,
      ),
    ).toEqual(["title", "positions", "trustees", "threshold"]);
  });

  it("election created: names through idToName, waiting for trustees, no button", async () => {
    open({ [ELECTION]: view("ceremony-0") });
    // M1: the state is ceremony, so Key ceremony is current at 0 joined.
    await heading(/step 2 of 5, Key ceremony/);
    expect(within(card()).getByText("Election created")).toBeInTheDocument();
    expect(
      within(card()).getByText(/Maria Santos, Juan P. Dela Cruz, Ana Reyes/),
    ).toBeInTheDocument();
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "0 of 5 trustees joined.",
    );
    expect(within(card()).queryByRole("button")).toBeNull();
  });

  it("key ceremony at 3 and 5 joined, and without a count", async () => {
    open({ [ELECTION]: view("ceremony-3") });
    await heading(/step 2 of 5, Key ceremony/);
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "3 of 5 trustees joined.",
    );
    expect(within(card()).queryByRole("button")).toBeNull();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    open({ [ELECTION]: view("ceremony-nocount") });
    await heading(/Key ceremony/);
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "The trustees are joining the key ceremony.",
    );
    expect(within(card()).getByRole("status").textContent).not.toMatch(/\d of/);
  });

  it("voting: the sentence and Close voting", async () => {
    open({ [ELECTION]: view("open-0") });
    await heading(/Voting/);
    expect(
      within(card()).getByText(
        "Voting is open. Close when every voter has voted.",
      ),
    ).toBeInTheDocument();
    expect(
      within(card()).getByRole("button", { name: "Close voting" }),
    ).toBeInTheDocument();
  });

  it("decrypt: shares, then signatures; Publish result only at the threshold", async () => {
    for (const [name, shares, sigs, button] of [
      ["closed-0", "0 of 3 trustee shares recorded", null, false],
      ["closed-2", "2 of 3 trustee shares recorded", null, false],
      [
        "closed-3",
        "3 of 3 trustee shares recorded",
        "0 of 3 signatures",
        false,
      ],
      [
        "closed-sig2",
        "3 of 3 trustee shares recorded",
        "2 of 3 signatures",
        false,
      ],
      [
        "closed-sig3",
        "3 of 3 trustee shares recorded",
        "3 of 3 signatures",
        false,
      ],
    ] as const) {
      open({ [ELECTION]: view(name) });
      await heading(/step 4 of 5, Decrypt/);
      expect(within(card()).getByTestId("shares")).toHaveTextContent(shares);
      if (sigs)
        expect(within(card()).getByTestId("signatures")).toHaveTextContent(
          sigs,
        );
      else expect(within(card()).queryByTestId("signatures")).toBeNull();
      expect(
        !!within(card()).queryByRole("button", { name: "Publish result" }),
      ).toBe(button);
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    }
  });

  it("at the threshold it says the console is publishing; Publish result only after the grace period", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let published = false;
    const s = open({
      [ELECTION]: () => (published ? view("tallied") : view("closed-sig3")),
      "POST /api/live/tally/publish": () => {
        published = true;
        return answer("accepted-publish");
      },
    });
    await heading(/Decrypt/);
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "3 of 3 signatures held. The console is publishing the result on chain.",
    );
    await act(() => vi.advanceTimersByTimeAsync(PUBLISH_GRACE_MS - 1000));
    expect(
      within(card()).queryByRole("button", { name: "Publish result" }),
    ).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(
      within(card()).getByText(
        /the console's own publication has not gone through/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(card()).getByRole("button", { name: "Publish result" }),
    );
    expect(await heading(/step 5 of 5, Result/)).toBeInTheDocument();
    expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(1);
  });

  it("a manual publish that meets the console's own publication is not an error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The view still lags at closed when the console's 409 comes back.
    const s = open({
      [ELECTION]: view("closed-sig3"),
      "POST /api/live/tally/publish": {
        status: 409,
        body: { error: "the live election is tallied; this needs it closed" },
      },
    });
    await heading(/Decrypt/);
    await act(() => vi.advanceTimersByTimeAsync(PUBLISH_GRACE_MS + 500));
    fireEvent.click(
      within(card()).getByRole("button", { name: "Publish result" }),
    );
    await waitFor(() =>
      expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(1),
    );
    await waitFor(() =>
      expect(
        within(card()).getByRole("button", { name: "Publish result" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText(/this needs it closed/)).toBeNull();
    expect(within(card()).queryByRole("alert")).toBeNull();
  });

  it("result with no verdict: totals through idToName, then the Verify again retry with a pass", async () => {
    let verified = false;
    open({
      [ELECTION]: () => (verified ? view("verified") : view("tallied")),
      "POST /api/live/verify": () => {
        verified = true;
        return answer("verify-pass");
      },
    });
    await heading(/Result/);
    expect(within(card()).getByText("Juan P. Dela Cruz")).toBeInTheDocument();
    expect(within(card()).getByText("Not verified yet")).toBeInTheDocument();
    expect(within(card()).queryByText("Result verified")).toBeNull();
    fireEvent.click(
      await within(card()).findByRole("button", { name: "Verify again" }),
    );
    expect(
      await within(card()).findByText("Result verified"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Presenter Result - BalotaChain"),
    );
  });

  it("result: the Verify again retry with a fail lists every failed check and offers it again", async () => {
    open({
      [ELECTION]: view("tallied"),
      "POST /api/live/verify": answer("verify-fail"),
    });
    await heading(/Result/);
    fireEvent.click(
      await within(card()).findByRole("button", { name: "Verify again" }),
    );
    expect(
      await within(card()).findByText("Result NOT verified"),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText("tally.homomorphic_sum"),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText(/signature of trustee 2 does not verify/),
    ).toBeInTheDocument();
    expect(
      await within(card()).findByRole("button", { name: "Verify again" }),
    ).toBeEnabled();
    expect(within(card()).queryByText("Result verified")).toBeNull();
  });

  it("never says verified while the count is from the console", async () => {
    open({ [ELECTION]: view("verified-console") });
    await heading(/Result/);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bverified\b/i);
    expect(document.title).not.toMatch(/verified/i);
  });

  it("abandoned: says so, offers the Setup form", async () => {
    open({ [ELECTION]: view("abandoned") });
    expect(await heading(/election abandoned/)).toBeInTheDocument();
    expect(
      within(card()).getByText(
        /No result will be published for this election./,
      ),
    ).toBeInTheDocument();
    expect(
      within(card()).getByRole("button", { name: "Create election" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("not run")).toHaveLength(4);
    await waitFor(() =>
      expect(document.title).toBe("Presenter Abandoned - BalotaChain"),
    );
  });
});

describe("the Setup form", () => {
  function type(label: string, value: string, nth = 0) {
    fireEvent.change(screen.getAllByLabelText(label)[nth]!, {
      target: { value },
    });
  }

  const CSV =
    "last_name,first_name,middle_name,date_of_birth\nSampol,Tres,,1992-03-03\n";
  const PREVIEW = "POST /api/live/voter-list/preview";

  /** Chooses a fictional list, waits for the preview, confirms it. */
  async function lockList() {
    fireEvent.change(screen.getByLabelText("Voter list file"), {
      target: { files: [new File([CSV], "list.csv", { type: "text/csv" })] },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm the list" }),
    );
    await screen.findByText(/^Confirmed:/);
  }

  it("shows the id on chain and the shown name under the field", async () => {
    open({ [ELECTION]: view("none") });
    await heading(/Setup/);
    type("Candidate 1", "  Maria   Santos ");
    expect(screen.getByText("Maria-Santos")).toBeInTheDocument();
    expect(screen.getByText(/Shown as: Maria Santos/)).toBeInTheDocument();
  });

  it("refuses at the field: a character outside the set, and duplicates without case", async () => {
    open({ [ELECTION]: view("none") });
    await heading(/Setup/);
    type("Candidate 1", "Peñaflor");
    expect(
      screen.getByText("Letters, digits, dot and space only. Type 'Penaflor'."),
    ).toBeInTheDocument();
    type("Candidate 1", "Ana Cruz");
    type("Candidate 2", "ana  cruz");
    expect(
      screen.getByText(
        /The same id as 'Ana Cruz' in this position when capitals are ignored/,
      ),
    ).toBeInTheDocument();
  });

  it("sends nothing while a field is refused", async () => {
    const s = open({ [ELECTION]: view("none") });
    await heading(/Setup/);
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    // The first refused field takes the focus, and the count is announced.
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveFocus());
    // Two facts, one sentence each: the fields by the button, the list in its step.
    expect(screen.getAllByRole("alert").map((n) => n.textContent)).toEqual([
      "Confirm the voter list before the election can be created.",
      expect.stringMatching(
        /^\d+ fields need a change before the election can be created\.$/,
      ),
    ]);
    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription(
      "Type the election's title.",
    );
    expect(await screen.findByText(/fields need a change/)).toBeInTheDocument();
    expect(s.to("POST", "/api/live/elections")).toHaveLength(0);
  });

  it("sends the exact body, and keeps what was typed when the console refuses", async () => {
    const s = open({
      [ELECTION]: view("none"),
      [PREVIEW]: answer("voter-list-preview-valid"),
      "POST /api/live/elections": answer("create-409"),
    });
    await heading(/Setup/);
    await lockList();
    type("Title", "Student council");
    type("Position 1", "Vice President");
    type("Candidate 1", "Juan P. Dela Cruz");
    type("Candidate 2", "Bea Tan");
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    expect(
      await screen.findByText(/one live election at a time/),
    ).toBeInTheDocument();
    const posts = s.to("POST", "/api/live/elections");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.init?.body).toBe(
      JSON.stringify({
        title: "Student council",
        positions: [
          {
            id: "Vice-President",
            candidates: ["Juan-P.-Dela-Cruz", "Bea-Tan"],
          },
        ],
        trustees: 5,
        threshold: 3,
        voter_list: CSV,
        voter_list_fingerprint:
          "cc0ad92dc0fce5cd088bde29bd4f6c03f3d66122e4fe06d4f44425851273dd75",
      }),
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Student council");
    expect(screen.getByLabelText("Candidate 1")).toHaveValue(
      "Juan P. Dela Cruz",
    );
  });

  it("adds and removes rows", async () => {
    open({ [ELECTION]: view("none") });
    await heading(/Setup/);
    fireEvent.click(screen.getByRole("button", { name: "Add a position" }));
    expect(screen.getByLabelText("Position 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove position 2" }));
    expect(screen.queryByLabelText("Position 2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add a candidate" }));
    expect(screen.getByLabelText("Candidate 3")).toBeInTheDocument();
  });

  it("names the work while recording, and the still line after ten seconds", async () => {
    let release: (() => void) | null = null;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubFetch({
      "GET /api/me": answer("me-admin"),
      [ELECTION]: view("none"),
      [PREVIEW]: answer("voter-list-preview-valid"),
    });
    const created = view("ceremony-0");
    let done = false;
    const original = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith("/api/live/elections")
          ? new Promise<Response>((r) => {
              release = () => {
                done = true;
                r(new Response(JSON.stringify(created.body), { status: 201 }));
              };
            })
          : done && String(input).endsWith("/api/live/election")
            ? Promise.resolve(
                new Response(JSON.stringify(created.body), { status: 200 }),
              )
            : original(input, init),
      ),
    );
    render(<Root />);
    await heading(/Setup/);
    await lockList();
    type("Title", "T");
    type("Position 1", "P");
    type("Candidate 1", "A");
    type("Candidate 2", "B");
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    expect(
      await screen.findByRole("button", { name: "Recording on chain…" }),
    ).toBeDisabled();
    expect(
      screen.queryByText("Still recording. Keep this page open."),
    ).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(
      screen.getByText("Still recording. Keep this page open."),
    ).toBeInTheDocument();
    await act(async () => release?.());
    expect(await screen.findByText("Election created")).toBeInTheDocument();
  });
});

describe("Close voting", () => {
  async function openConfirm(name: string) {
    const s = open({
      [ELECTION]: view(name),
      "POST /api/live/close": view("closed-0"),
    });
    await heading(/Voting/);
    // Let the first poll finish, so the confirm's read is its own.
    await waitFor(() =>
      expect(s.to("GET", "/api/live/election").length).toBeGreaterThanOrEqual(
        2,
      ),
    );
    await new Promise((r) => setTimeout(r, 0));
    readsBefore = s.to("GET", "/api/live/election").length;
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    return s;
  }
  let readsBefore = 0;

  it("speaks of ballot records, with whole ballots only as a conditional", async () => {
    await openConfirm("open-one");
    expect(
      within(card()).getByText(
        "2 of 6 expected ballot records have not arrived.",
      ),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText(
        "That is 1 whole ballot if every voter sent a whole ballot.",
      ),
    ).toBeInTheDocument();
    expect(
      within(card()).getByText("This cannot be undone."),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    await openConfirm("open-some");
    expect(
      within(card()).getByText(
        "3 of 6 expected ballot records have not arrived.",
      ),
    ).toBeInTheDocument();
    expect(within(card()).queryByText(/whole ballot/)).toBeNull();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    await openConfirm("open-all");
    expect(
      within(card()).getByText("All 6 expected ballot records have arrived."),
    ).toBeInTheDocument();
  });

  it("the confirm is described by its consequence and has no box of its own", async () => {
    await openConfirm("open-one");
    const group = within(card()).getByRole("group", { name: "Close voting?" });
    const described = document.getElementById(
      group.getAttribute("aria-describedby")!,
    );
    expect(described).toHaveTextContent("This cannot be undone.");
    expect(group.style.border).toBe("");
    expect(group.style.background).toBe("");
    expect(
      within(group).getByRole("heading", { level: 4, name: "Close voting?" }),
    ).toBeInTheDocument();
  });

  it("sets the confirm apart with a 1px rule in the border colour (M4)", async () => {
    await openConfirm("open-one");
    const group = within(card()).getByRole("group", { name: "Close voting?" });
    expect(group.style.borderTop).toBe("1px solid #E0E4E3");
    expect(group.style.paddingTop).toBe("16px");
    expect(group.style.backgroundColor).toBe("");
    expect(group.style.borderLeft).toBe("");
    // The card's own gap (sm) is the space above the rule.
    expect(group.parentElement!.style.gap).toBe("16px");
  });

  it("Escape closes the confirm, sends nothing and hands the focus back", async () => {
    const s = await openConfirm("open-one");
    fireEvent.keyDown(within(card()).getByRole("button", { name: "Cancel" }), {
      key: "Escape",
    });
    expect(within(card()).queryByRole("group")).toBeNull();
    await waitFor(() =>
      expect(
        within(card()).getByRole("button", { name: "Close voting" }),
      ).toHaveFocus(),
    );
    expect(s.to("POST", "/api/live/close")).toHaveLength(0);
  });

  it("a failed close reads Try again, in the console's words", async () => {
    const s = await openConfirm("open-one");
    s.routes["POST /api/live/close"] = {
      status: 502,
      body: { error: "the chain did not answer: context deadline exceeded" },
    };
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting now" }),
    );
    expect(
      await within(card()).findByText(
        /the chain did not answer: context deadline exceeded/,
      ),
    ).toBeInTheDocument();
    expect(
      within(card()).getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("a double press sends one request", async () => {
    const s = await openConfirm("open-one");
    s.routes["POST /api/live/close"] = () => "hang";
    const confirm = within(card()).getByRole("button", {
      name: "Close voting now",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(
        within(card()).getByRole("button", { name: "Closing on chain…" }),
      ).toBeDisabled(),
    );
    fireEvent.click(
      within(card()).getByRole("button", { name: "Closing on chain…" }),
    );
    expect(s.to("POST", "/api/live/close")).toHaveLength(1);
  });

  it("reads the view afresh when the confirm opens; Cancel has the focus and sends nothing", async () => {
    const s = await openConfirm("open-one");
    await waitFor(() =>
      expect(s.to("GET", "/api/live/election").length).toBeGreaterThan(
        readsBefore,
      ),
    );
    const cancel = within(card()).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(s.to("POST", "/api/live/close")).toHaveLength(0);
    await waitFor(() =>
      expect(
        within(card()).getByRole("button", { name: "Close voting" }),
      ).toHaveFocus(),
    );
  });

  it("Confirm sends one request and the page moves to Decrypt", async () => {
    const s = await openConfirm("open-one");
    let closed = false;
    s.routes[ELECTION] = () => (closed ? view("closed-0") : view("open-one"));
    s.routes["POST /api/live/close"] = () => {
      closed = true;
      return view("closed-0");
    };
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting now" }),
    );
    expect(await heading(/Decrypt/)).toBeInTheDocument();
    expect(s.to("POST", "/api/live/close")).toHaveLength(1);
    // The confirm is gone; the focus moves to the new step's heading.
    await waitFor(() =>
      expect(
        within(card()).getByRole("heading", { level: 3, name: "Decrypt" }),
      ).toHaveFocus(),
    );
  });

  it("a poll sent before the press never puts the old state back", async () => {
    let releasePoll: (() => void) | null = null;
    const s = open({ [ELECTION]: view("open-one") });
    await heading(/Voting/);
    // The next poll hangs with the old state until the close has answered.
    s.routes[ELECTION] = () => "hang";
    const stale = view("open-one");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const path = String(input);
        if (path.endsWith("/api/live/election") && !releasePoll)
          return new Promise<Response>((r) => {
            releasePoll = () =>
              r(new Response(JSON.stringify(stale.body), { status: 200 }));
          });
        if (path.endsWith("/api/live/close"))
          return Promise.resolve(
            new Response(JSON.stringify(view("closed-0").body), {
              status: 200,
            }),
          );
        // Later reads never answer, so only the stale poll could move the page.
        return new Promise<Response>(() => {});
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting now" }),
    );
    await waitFor(() => expect(releasePoll).not.toBeNull());
    await heading(/Decrypt/);
    await act(async () => releasePoll?.());
    // Let the stale answer's promise chain run out.
    for (let i = 0; i < 5; i++) await act(async () => {});
    expect(
      screen.getByRole("heading", { level: 2, name: /^Presenter/ }),
    ).toHaveTextContent(/Decrypt/);
  });
});

describe("the Now panel", () => {
  it("shows each row from the view", async () => {
    open({ [ELECTION]: view("open-one") });
    await heading(/Voting/);
    const p = now();
    expect(
      within(p).getByText("Voters on the list").nextSibling,
    ).toHaveTextContent("3");
    expect(within(p).getByText("Checked in").nextSibling).toHaveTextContent(
      "3 of 3",
    );
    expect(
      within(p).getByText("Credentials issued").nextSibling,
    ).toHaveTextContent("3");
    expect(p.textContent).not.toMatch(/Enrolled|account/);
    expect(within(p).getByText("Ballot records").nextSibling).toHaveTextContent(
      "4 of 6 expected",
    );
    expect(within(p).queryByText("Ballots received")).toBeNull();
    expect(
      within(p).getByText("Trustees joined").nextSibling,
    ).toHaveTextContent("5 of 5");
    expect(
      within(p).getByText("7A1B-3C9F-0D2E-41A8-9B6C-E8F9"),
    ).toBeInTheDocument();
    expect(
      within(p).getByRole("button", { name: /copy/i }),
    ).toBeInTheDocument();
  });

  it("shows the records row when they do not make whole ballots too", async () => {
    open({ [ELECTION]: view("open-some") });
    await heading(/Voting/);
    expect(
      within(now()).getByText("Ballot records").nextSibling,
    ).toHaveTextContent("3 of 6 expected");
  });

  it("is left out before an election exists", async () => {
    open({ [ELECTION]: view("none") });
    await heading(/Setup/);
    expect(screen.queryByRole("region", { name: "Now" })).toBeNull();
  });

  it("says when the chain did not answer", async () => {
    open({ [ELECTION]: view("open-console") });
    await heading(/Voting/);
    expect(
      within(now()).getByText(
        /From the console's record, the chain did not answer./,
      ),
    ).toBeInTheDocument();
  });
});

describe("links", () => {
  it("writes the voter page address from the page's own origin", async () => {
    open({ [ELECTION]: view("open-one") });
    await heading(/Voting/);
    expect(screen.getByTestId("voter-address")).toHaveTextContent(
      `${window.location.origin}/vote/`,
    );
    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute(
      "href",
      "/board/",
    );
    // It may wrap only after a slash or a dot, never inside the port.
    const address = screen.getByTestId("voter-address");
    expect(address.querySelectorAll("wbr").length).toBeGreaterThan(3);
    const pieces = Array.from(address.children, (c) => c.textContent ?? "");
    expect(pieces.join("")).toBe(`${window.location.origin}/vote/`);
    // The host and port stay in one piece.
    expect(pieces).toContain(`${window.location.host}/`);
  });
});

describe("demonstrations", () => {
  async function openDemos(name: string, routes: Record<string, Route>) {
    const s = open({
      [ELECTION]: view(name),
      "GET /api/live/ledger": answer("ledger"),
      ...routes,
    });
    await heading(/step/);
    fireEvent.click(
      screen.getByText("Demonstrations: requests the chain should refuse"),
    );
    return s;
  }
  const row = (name: RegExp) => screen.getByRole("region", { name });

  it("replay: refused by the chain, gate and reason word for word, count unchanged", async () => {
    const s = await openDemos("open-one", {
      "POST /api/live/ballot": answer("refused-nullifier"),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    );
    const r = row(/Send a recorded ballot again/);
    expect(
      await within(r).findByText("Refused by the chain"),
    ).toBeInTheDocument();
    expect(within(r).getByText("nullifier")).toBeInTheDocument();
    expect(
      within(r).getByText(
        (answer("refused-nullifier").body as { reason: string }).reason,
      ),
    ).toBeInTheDocument();
    expect(
      within(r).getByText("Ballot records on chain: 4 (unchanged)"),
    ).toBeInTheDocument();
    const sent = s.to("POST", "/api/live/ballot")[0]!;
    expect(sent.init?.credentials).toBe("omit");
    const ledger = answer("ledger").body as { ballots: { ballot: string }[] };
    expect(sent.init?.body).toBe(
      JSON.stringify({ ballot: ledger.ballots[0]!.ballot }),
    );
  });

  it("one byte changed: sends the flipped record, refused at the gate the console names", async () => {
    const s = await openDemos("open-one", {
      "POST /api/live/ballot": answer("refused-cds"),
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Send a ballot with one byte changed",
      }),
    );
    const r = row(/one byte changed/);
    expect(await within(r).findByText("cds")).toBeInTheDocument();
    const ledger = answer("ledger").body as { ballots: { ballot: string }[] };
    const sent = JSON.parse(
      String(s.to("POST", "/api/live/ballot")[0]!.init?.body),
    ) as { ballot: string };
    expect(sent.ballot).not.toBe(ledger.ballots[0]!.ballot);
    expect(sent.ballot.length).toBe(ledger.ballots[0]!.ballot.length);
    expect(s.to("POST", "/api/live/ballot")[0]!.init?.credentials).toBe("omit");
  });

  it("turned away by the console: said, with its words", async () => {
    await openDemos("open-one", {
      "POST /api/live/ballot": answer("turned-away"),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    );
    expect(
      await screen.findByText(
        /The console turned this away before it reached the chain: the ballot is for election/,
      ),
    ).toBeInTheDocument();
  });

  it("accepted: the error style and stop the demo; a changed count is said", async () => {
    let n = 0;
    await openDemos("open-one", {
      [ELECTION]: () => (++n > 3 ? view("open-all") : view("open-one")),
      "POST /api/live/ballot": answer("accepted-ballot"),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    );
    const r = row(/Send a recorded ballot again/);
    expect(
      await within(r).findByText("The chain accepted this. Stop the demo."),
    ).toBeInTheDocument();
    expect(within(r).getByText(/\(changed from 4\)/)).toBeInTheDocument();
  });

  it("busy: a 429 is not a refusal", async () => {
    await openDemos("open-one", { "POST /api/live/ballot": answer("busy") });
    fireEvent.click(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    );
    expect(
      await screen.findByText("The console is busy, try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Refused by the chain")).toBeNull();
  });

  it("the ballot rows are off before any ballot is recorded", async () => {
    await openDemos("open-0", {});
    expect(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Send a ballot with one byte changed",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /^Publish with/ }),
    ).toBeDisabled();
  });

  it("publish row: carries the live numbers and is refused at threshold", async () => {
    const s = await openDemos("closed-sig2", {
      "POST /api/live/tally/publish": answer("refused-threshold"),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish with 2 of 3 signatures" }),
    );
    expect(await screen.findByText("threshold")).toBeInTheDocument();
    expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(1);
  });

  it("publish row sends nothing when the fresh read shows the threshold met", async () => {
    let met = false;
    const s = await openDemos("closed-sig2", {
      [ELECTION]: () => (met ? view("closed-sig3") : view("closed-sig2")),
      "POST /api/live/tally/publish": answer("accepted-publish"),
    });
    const button = screen.getByRole("button", {
      name: "Publish with 2 of 3 signatures",
    });
    // The third signature lands between the last poll and the press.
    met = true;
    fireEvent.click(button);
    expect(
      await screen.findByText(
        /Not sent: the console now holds 3 of 3 signatures/,
      ),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(0);
  });

  it("publish row is on from the close, before any trustee decrypts, and off once the threshold is held", async () => {
    for (const name of ["closed-0", "closed-2", "closed-3"]) {
      await openDemos(name, {});
      expect(
        screen.getByRole("button", { name: "Publish with 0 of 3 signatures" }),
      ).toBeEnabled();
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    }
    for (const name of ["closed-sig3", "open-one"]) {
      await openDemos(name, {});
      expect(
        screen.getByRole("button", { name: /^Publish with/ }),
      ).toBeDisabled();
      expect(
        screen.getByText(
          "Opens in the Decrypt step, from the close until 3 signatures are held. Press it before 3 trustees decrypt: their processes then sign within seconds and the console publishes.",
        ),
      ).toBeInTheDocument();
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    }
  });

  it("a console answer that is not a chain refusal is said in its words", async () => {
    await openDemos("closed-sig2", {
      "POST /api/live/tally/publish": {
        status: 409,
        body: { error: "the partials on the chain do not combine yet: x" },
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish with 2 of 3 signatures" }),
    );
    expect(
      await screen.findByText(
        /Not a refusal by the chain. The console answered 409: the partials on the chain do not combine yet: x/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Refused by the chain")).toBeNull();
  });

  it("a 401 on a demonstration goes to sign-in", async () => {
    await openDemos("closed-sig2", {
      "POST /api/live/tally/publish": answer("me-none"),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish with 2 of 3 signatures" }),
    );
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
  });

  it("a failed ledger read sends nothing and says so", async () => {
    const s = await openDemos("open-one", {
      "GET /api/live/ledger": {
        status: 502,
        body: { error: "the chain did not answer: timeout" },
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    );
    expect(
      await screen.findByText(
        /Not sent: the page could not read the ballot records from the chain \(the chain did not answer: timeout\)\. Nothing was sent\./,
      ),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/ballot")).toHaveLength(0);
  });

  it("publish row accepted: stop the demo", async () => {
    await openDemos("closed-sig2", {
      "POST /api/live/tally/publish": answer("accepted-publish"),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish with 2 of 3 signatures" }),
    );
    expect(
      await screen.findByText("The chain accepted this. Stop the demo."),
    ).toBeInTheDocument();
  });
});

describe("a new election on the same page (rehearsal 4, I1)", () => {
  const NEXT = "live-20261116-100000-n3xt0001";
  /** A fixture view moved to the next election's id. */
  function next(name: string) {
    const a = view(name);
    const b = a.body as { election_id: string; run_id: string };
    b.election_id = NEXT;
    b.run_id = NEXT;
    return a;
  }
  async function checkNow() {
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled(),
    );
  }
  const row = (name: RegExp) => screen.getByRole("region", { name });

  it("demonstration answers of election A are gone when election B appears", async () => {
    let current: () => ReturnType<typeof view> = () => view("open-one");
    open({
      [ELECTION]: () => current(),
      "GET /api/live/ledger": answer("ledger"),
      "POST /api/live/ballot": answer("refused-nullifier"),
      "POST /api/live/tally/publish": answer("refused-threshold"),
    });
    await heading(/Voting/);
    fireEvent.click(
      screen.getByText("Demonstrations: requests the chain should refuse"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    );
    const replay = row(/Send a recorded ballot again/);
    expect(
      await within(replay).findByText("Refused by the chain"),
    ).toBeInTheDocument();
    expect(
      within(replay).getByText("Ballot records on chain: 4 (unchanged)"),
    ).toBeInTheDocument();

    // Election B, open with no ballot yet, without a reload.
    current = () => next("open-0");
    await checkNow();
    await waitFor(() =>
      expect(screen.queryByText("Refused by the chain")).toBeNull(),
    );
    expect(screen.queryByText(/Ballot records on chain:/)).toBeNull();
    expect(screen.queryByText(/\(unchanged\)/)).toBeNull();
    const fresh = row(/Send a recorded ballot again/);
    expect(
      within(fresh).getByText(
        "Opens while voting is open and at least one ballot is recorded.",
      ),
    ).toBeInTheDocument();
  });

  it("a failed check of election A is not shown on election B's result", async () => {
    let current: () => ReturnType<typeof view> = () => view("tallied");
    open({
      [ELECTION]: () => current(),
      "POST /api/live/verify": answer("verify-fail"),
    });
    await heading(/Result/);
    fireEvent.click(
      await within(card()).findByRole("button", { name: "Verify again" }),
    );
    expect(
      await within(card()).findByText("Result NOT verified"),
    ).toBeInTheDocument();

    current = () => next("tallied");
    await checkNow();
    await waitFor(() =>
      expect(within(card()).queryByText("Result NOT verified")).toBeNull(),
    );
    expect(within(card()).getByText(/Not verified yet/)).toBeInTheDocument();
  });

  it("a poll of the same election keeps the Verify answer; a new id clears it", async () => {
    let current: () => ReturnType<typeof view> = () => view("tallied");
    open({
      [ELECTION]: () => current(),
      "POST /api/live/verify": answer("verify-fail"),
    });
    await heading(/Result/);
    fireEvent.click(
      await within(card()).findByRole("button", { name: "Verify again" }),
    );
    await within(card()).findByText("Result NOT verified");
    await checkNow();
    await checkNow();
    expect(within(card()).getByText("Result NOT verified")).toBeInTheDocument();
    expect(
      within(card()).getByText("tally.homomorphic_sum"),
    ).toBeInTheDocument();
    current = () => next("tallied");
    await checkNow();
    await waitFor(() =>
      expect(within(card()).queryByText("Result NOT verified")).toBeNull(),
    );
  });

  it("a poll of the same election keeps an open confirm and a write error; a new id clears both", async () => {
    let current: () => ReturnType<typeof view> = () => view("open-one");
    open({
      [ELECTION]: () => current(),
      "POST /api/live/close": {
        status: 502,
        body: { error: "the chain did not answer: context deadline exceeded" },
      },
    });
    await heading(/Voting/);
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting now" }),
    );
    await within(card()).findByText(/context deadline exceeded/);
    await checkNow();
    await checkNow();
    expect(
      within(card()).getByText(/context deadline exceeded/),
    ).toBeInTheDocument();
    expect(
      within(card()).getByRole("group", { name: "Close voting?" }),
    ).toBeInTheDocument();
    current = () => next("open-one");
    await checkNow();
    await waitFor(() =>
      expect(
        within(card()).queryByText(/context deadline exceeded/),
      ).toBeNull(),
    );
    expect(within(card()).queryByRole("group")).toBeNull();
  });

  it("the desk counts of election A are not in election B's Close confirm", async () => {
    let current: () => ReturnType<typeof view> = () => view("open-one");
    let list: Route = answer("voter-list-desk-two");
    open({
      [ELECTION]: () => current(),
      "GET /api/live/voter-list": () =>
        typeof list === "function" ? list() : list,
    });
    await heading(/Voting/);
    // Election A's list has requests at the desk: the confirm says so.
    expect(
      (await screen.findAllByRole("button", { name: /^Approve / })).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    expect(
      await within(card()).findByText(
        /at the desk, waiting for the Electoral Board/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(card()).getByRole("button", { name: "Cancel" }));

    // Election B: its list never answers, so only A's counts could show.
    list = "hang";
    current = () => next("open-one");
    await checkNow();
    await waitFor(() =>
      expect(
        screen.queryAllByRole("button", { name: /^Approve / }),
      ).toHaveLength(0),
    );
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    await within(card()).findByRole("group", { name: "Close voting?" });
    expect(
      within(card()).queryByText(
        /at the desk, waiting for the Electoral Board/,
      ),
    ).toBeNull();
  });

  it("the first view of a new election is not announced as a change", async () => {
    let current: () => ReturnType<typeof view> = () => view("open-one");
    open({ [ELECTION]: () => current() });
    await heading(/Voting/);
    await checkNow();
    const live = () =>
      document.querySelector<HTMLElement>('.bc-sr-only[role="status"]')!;
    const before = live().textContent;
    current = () => next("open-0");
    await checkNow();
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Now" })).toHaveTextContent(
        /0/,
      ),
    );
    // Not a change of A's counts: only the new election's state is said.
    await waitFor(() => expect(live().textContent).toBe("State: open."));
    expect(before).not.toBe("State: open.");
  });

  it("the state line follows a new election from its first view (rehearsal 5, m1)", async () => {
    let current: () => ReturnType<typeof view> = () => view("verified");
    open({ [ELECTION]: () => current() });
    await heading(/Result|verified/);
    const live = () =>
      document.querySelector<HTMLElement>('.bc-sr-only[role="status"]')!;
    current = () => next("ceremony-0");
    await checkNow();
    await waitFor(() => expect(live().textContent).toBe("State: ceremony."));
    expect(live().textContent).not.toMatch(/verified/);
  });

  it("a failed write of election A is not shown in election B", async () => {
    let current: () => ReturnType<typeof view> = () => view("open-one");
    open({
      [ELECTION]: () => current(),
      "POST /api/live/close": {
        status: 502,
        body: { error: "the chain did not answer: context deadline exceeded" },
      },
    });
    await heading(/Voting/);
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting now" }),
    );
    expect(
      await within(card()).findByText(/context deadline exceeded/),
    ).toBeInTheDocument();

    current = () => next("open-0");
    await checkNow();
    await waitFor(() =>
      expect(
        within(card()).queryByText(/context deadline exceeded/),
      ).toBeNull(),
    );
    expect(
      within(card()).getByRole("button", { name: "Close voting" }),
    ).toBeInTheDocument();
  });
});

describe("too few ballot records to decrypt (rehearsal 5, I1 and I2)", () => {
  /** A view whose counts carry the console's minimum. */
  function withMin(name: string, records: number, min?: number) {
    const a = view(name);
    const c = (a.body as { counts: Record<string, unknown> }).counts;
    c.ballot_records = records;
    if (min !== undefined) c.min_ballot_records = min;
    return a;
  }

  it("the Close confirm says first that a closed election could not be decrypted, and reads Close anyway", async () => {
    open({ [ELECTION]: withMin("open-one", 2, 4) });
    await heading(/Voting/);
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    const group = within(card()).getByRole("group", { name: "Close voting?" });
    const first = within(group).getAllByText(/./, { selector: "p, li" })[0]!;
    expect(first).toHaveTextContent(
      "The chain holds 2 ballot records; decryption needs at least 4. An election closed now cannot be decrypted or abandoned: the only way on is to reset the console with tools/live-reset.sh.",
    );
    expect(
      within(group).getByRole("button", { name: "Close anyway" }),
    ).toBeEnabled();
    expect(
      within(group).queryByRole("button", { name: "Close voting now" }),
    ).toBeNull();
  });

  it("the Close confirm is as before with enough records, or without the field", async () => {
    for (const v of [withMin("open-one", 4, 4), withMin("open-one", 0)]) {
      open({ [ELECTION]: v });
      await heading(/Voting/);
      fireEvent.click(
        within(card()).getByRole("button", { name: "Close voting" }),
      );
      expect(
        within(card()).getByRole("button", { name: "Close voting now" }),
      ).toBeInTheDocument();
      expect(within(card()).queryByText(/decryption needs/)).toBeNull();
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    }
  });

  it("closed below the minimum: the card says it cannot be decrypted and how to reset; no step is current", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open({ [ELECTION]: withMin("closed-0", 2, 4) });
    await heading(/Decrypt/);
    await act(() => vi.advanceTimersByTimeAsync(STUCK_HOLD_MS + POLL_MS));
    await heading(/cannot be decrypted/);
    expect(
      within(card()).getByText(
        /This election was closed with 2 ballot records on the chain; decryption needs at least 4\. It cannot be decrypted, and once voting has opened it cannot be abandoned\. Reset the console to start the next election:/,
      ),
    ).toBeInTheDocument();
    expect(within(card()).getByText("tools/live-reset.sh")).toBeInTheDocument();
    expect(within(card()).queryByText(/Waiting for trustees/)).toBeNull();
    const steps = screen.getByRole("list", { name: "Presenter steps" });
    expect(steps).not.toHaveTextContent(/current/);
    expect(steps).toHaveTextContent(/cannot run/);
  });

  /** A view with its count's source and value set. */
  function withSource(name: string, records: number, min: number, src: string) {
    const a = withMin(name, records, min);
    (
      a.body as { counts: Record<string, unknown> }
    ).counts.ballot_records_source = src;
    return a;
  }

  it("the hold: old wording at first, stuck after 6 s of low chain counts, old again on a sufficient count (review of rehearsal 5)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let current = withMin("closed-0", 2, 4);
    open({ [ELECTION]: () => current });
    await heading(/Decrypt/);
    expect(
      within(card()).getByText(/Waiting for trustees to decrypt/),
    ).toBeInTheDocument();
    // Still within the hold: the old wording.
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 2));
    expect(within(card()).queryByText(/cannot be decrypted/)).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(STUCK_HOLD_MS));
    await heading(/cannot be decrypted/);
    expect(
      screen.getByRole("list", { name: "Presenter steps" }),
    ).toHaveTextContent(/cannot run/);
    // A count at the minimum on any poll cancels it.
    current = withMin("closed-0", 4, 4);
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    await heading(/Decrypt/);
    expect(
      within(card()).getByText(/Waiting for trustees to decrypt/),
    ).toBeInTheDocument();
  });

  it("a count from the console, or a count below 0, never makes the claim: no warning, no stuck wording", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    for (const v of [
      withSource("closed-0", 2, 4, "console"),
      withSource("closed-0", -1, 4, "chain"),
    ]) {
      open({ [ELECTION]: v });
      await heading(/Decrypt/);
      await act(() => vi.advanceTimersByTimeAsync(STUCK_HOLD_MS + POLL_MS * 2));
      expect(within(card()).queryByText(/cannot be decrypted/)).toBeNull();
      expect(
        within(card()).getByText(/Waiting for trustees to decrypt/),
      ).toBeInTheDocument();
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    }
    for (const v of [
      withSource("open-one", 2, 4, "console"),
      withSource("open-one", -1, 4, "chain"),
    ]) {
      open({ [ELECTION]: v });
      await heading(/Voting/);
      fireEvent.click(
        within(card()).getByRole("button", { name: "Close voting" }),
      );
      expect(
        within(card()).getByRole("button", { name: "Close voting now" }),
      ).toBeInTheDocument();
      expect(within(card()).queryByText(/decryption needs/)).toBeNull();
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    }
  });

  it("closed with enough records, or without the field: waiting for trustees as before", async () => {
    for (const v of [withMin("closed-0", 4, 4), withMin("closed-0", 0)]) {
      open({ [ELECTION]: v });
      await heading(/Decrypt/);
      expect(
        within(card()).getByText(/Waiting for trustees to decrypt/),
      ).toBeInTheDocument();
      vi.unstubAllGlobals();
      document.body.innerHTML = "";
    }
  });
});

describe("abandon", () => {
  it("is offered only in setup and ceremony, behind its confirm", async () => {
    const s = open({
      [ELECTION]: view("ceremony-3"),
      "POST /api/live/abandon": view("abandoned"),
    });
    await heading(/Key ceremony/);
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon this election" }),
    );
    expect(
      screen.getByText(
        /No ballot can be cast in it and no result will be published./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(s.to("POST", "/api/live/abandon")).toHaveLength(0);
    s.routes[ELECTION] = view("abandoned");
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon this election" }),
    );
    expect(await heading(/election abandoned/)).toBeInTheDocument();
    expect(s.to("POST", "/api/live/abandon")).toHaveLength(1);
  });

  it("from setup, claims no chain record", async () => {
    open({ [ELECTION]: view("setup") });
    await heading(/Setup/);
    fireEvent.click(
      screen.getByRole("button", { name: "Abandon this election" }),
    );
    expect(
      screen.getByText(/The chain has not recorded it./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/The chain keeps its record/)).toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: "Abandon this election?" }),
    ).toBeInTheDocument();
    // M4: the same rule as the close confirm.
    expect(
      screen.getByRole("group", { name: "Abandon this election?" }).style
        .borderTop,
    ).toBe("1px solid #E0E4E3");
  });

  it("an election abandoned before the chain recorded it says so", async () => {
    const abandoned = view("abandoned");
    (abandoned.body as { lifecycle: object }).lifecycle = {};
    open({ [ELECTION]: abandoned });
    await heading(/election abandoned/);
    expect(
      within(card()).getByText(
        /It was abandoned before the chain recorded it./,
      ),
    ).toBeInTheDocument();
    expect(within(card()).queryByText(/The chain keeps its record/)).toBeNull();
  });

  it("is not offered once voting is open, and says why", async () => {
    open({ [ELECTION]: view("open-one") });
    await heading(/Voting/);
    expect(
      screen.queryByRole("button", { name: "Abandon this election" }),
    ).toBeNull();
    expect(
      screen.getByText(/can be abandoned only before voting opens/),
    ).toBeInTheDocument();
  });
});

describe("waiting (D9)", () => {
  it("polls while visible, stops while hidden, and moves on without a tap", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let state = "ceremony-3";
    const s = open({ [ELECTION]: () => view(state) });
    await heading(/Key ceremony/);
    const reads = () => s.to("GET", "/api/live/election").length;
    const before = reads();
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 2));
    expect(reads()).toBeGreaterThan(before);
    act(() => setVisibility("hidden"));
    const hidden = reads();
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 4));
    expect(reads()).toBe(hidden);
    state = "open-0";
    act(() => setVisibility("visible"));
    expect(await heading(/Voting/)).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Presenter Voting - BalotaChain"),
    );
  });

  it("announces a changed count once, politely", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let records = 3;
    open({
      [ELECTION]: () => {
        const a = view("open-one");
        (
          a.body as { counts: { ballot_records: number } }
        ).counts.ballot_records = records;
        return a;
      },
    });
    await heading(/Voting/);
    const region = document.querySelector(
      '[aria-live="polite"][role="status"]',
    )!;
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(region.textContent).toBe("");
    records = 4;
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    await waitFor(() => expect(region.textContent).toBe("Ballot records: 4."));
  });

  it("announces check-ins and credentials from the console's counts, never enrolment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let state = "open-0";
    open({ [ELECTION]: () => view(state) });
    await heading(/Voting/);
    const region = document.querySelector(
      '[aria-live="polite"][role="status"]',
    )!;
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    state = "open-one";
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    await waitFor(() =>
      expect(region.textContent).toBe(
        "Checked in: 3 of 3. Credentials issued: 3. Ballot records: 4.",
      ),
    );
  });
});

describe("final fix wave: presenter", () => {
  it("a cut-off 200 from the console is asked again, never read as the study wizard", async () => {
    vi.useFakeTimers();
    let n = 0;
    open({
      [ELECTION]: () =>
        ++n === 1
          ? { status: 200, body: '{"run_id":"live-' }
          : view("open-one"),
    });
    for (let i = 0; i < 4; i++)
      await act(() => vi.advanceTimersByTimeAsync(1000));
    vi.useRealTimers();
    expect(await heading(/Voting/)).toBeInTheDocument();
    expect(screen.queryByText(/Admin Console/)).toBeNull();
  });

  it("6: a poll that hangs is given up after 10 s and said; the next tick reads again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let hang = false;
    const s = open({
      [ELECTION]: () => (hang ? "hang" : view("open-one")),
    });
    await heading(/Voting/);
    hang = true;
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    const sent = s.to("GET", "/api/live/election").length;
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 2));
    expect(s.to("GET", "/api/live/election")).toHaveLength(sent);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(
      screen.getByText(
        /This page cannot reach the console: no answer within 10 s\./,
      ),
    ).toBeInTheDocument();
    hang = false;
    // A read sent while it still hung is given up in its turn; then one
    // answers.
    await act(() => vi.advanceTimersByTimeAsync(10_000 + POLL_MS));
    await waitFor(() =>
      expect(
        screen.queryByText(/This page cannot reach the console/),
      ).toBeNull(),
    );
  });

  async function openDemos(name: string, routes: Record<string, Route>) {
    const s = open({
      [ELECTION]: view(name),
      "GET /api/live/ledger": answer("ledger"),
      ...routes,
    });
    await heading(/step/);
    fireEvent.click(
      screen.getByText("Demonstrations: requests the chain should refuse"),
    );
    return s;
  }

  it("publish row: 'could publish the real result' only while the election is closed", async () => {
    let tallied = false;
    const s = await openDemos("closed-sig2", {
      [ELECTION]: () => (tallied ? view("tallied") : view("closed-sig2")),
    });
    const button = screen.getByRole("button", {
      name: "Publish with 2 of 3 signatures",
    });
    tallied = true;
    fireEvent.click(button);
    expect(
      await screen.findByText(
        "Not sent: the election is tallied with 3 signatures, so the chain's threshold check would not be what answers.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/could publish the real result/)).toBeNull();
    expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(0);
  });

  it("a 403 from the console's host guard is the console's answer, not a sign-in", async () => {
    await openDemos("closed-sig2", {
      "POST /api/live/tally/publish": {
        status: 403,
        body: "forbidden host",
        headers: { "Content-Type": "text/plain" },
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish with 2 of 3 signatures" }),
    );
    expect(
      await screen.findByText(
        "Not a refusal by the chain. The console answered 403: forbidden host",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sign in again/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("a 403 'admin role required' on a demonstration is still the page's session", async () => {
    await openDemos("closed-sig2", {
      "POST /api/live/tally/publish": {
        status: 403,
        body: { error: "admin role required" },
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish with 2 of 3 signatures" }),
    );
    // The page's own handling of the console's admin check (sign-in denied).
    expect(await screen.findByText("admin role required")).toBeInTheDocument();
    expect(screen.queryByText(/Not a refusal by the chain/)).toBeNull();
  });

  it("a demonstration's fresh read sent before Close and answered after it does not bring 'open' back", async () => {
    let closed = false;
    const s = await openDemos("open-one", {
      [ELECTION]: () => (closed ? view("closed-0") : view("open-one")),
      // The send never answers, so no later read of the demonstration
      // corrects what its first read did.
      "POST /api/live/ballot": "hang",
      "POST /api/live/close": () => {
        closed = true;
        return view("closed-0");
      },
    });
    // Hold the demonstration's first read (sent while voting is open).
    const inner = globalThis.fetch;
    let release: () => void = () => {};
    let holdNext = true;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = (init?.method ?? "GET").toUpperCase();
        if (
          holdNext &&
          method === "GET" &&
          url.endsWith("/api/live/election")
        ) {
          holdNext = false;
          const p = inner(input, init);
          return new Promise<Response>((r) => {
            release = () => r(p);
          });
        }
        return inner(input, init);
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Send a recorded ballot again" }),
    );
    await waitFor(() => expect(holdNext).toBe(false));
    fireEvent.click(
      within(card()).getByRole("button", { name: "Close voting" }),
    );
    const confirm = await within(card()).findByRole("button", {
      name: "Close voting now",
    });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    expect(await heading(/Decrypt/)).toBeInTheDocument();
    expect(s.to("POST", "/api/live/close")).toHaveLength(1);
    await act(async () => release());
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: (n) => n.startsWith("Presenter") && /Decrypt/.test(n),
      }),
    ).toBeInTheDocument();
  });
});

describe("signing and verification without a press (one press per trustee)", () => {
  async function openDemos(name: string, routes: Record<string, Route>) {
    const s = open({
      [ELECTION]: view(name),
      "GET /api/live/ledger": answer("ledger"),
      ...routes,
    });
    await heading(/step/);
    fireEvent.click(
      screen.getByText("Demonstrations: requests the chain should refuse"),
    );
    return s;
  }
  const row = (name: RegExp) => screen.getByRole("region", { name });
  const stepWords = () =>
    Array.from(
      screen
        .getByRole("list", { name: "Presenter steps" })
        .querySelectorAll("[data-status-word]"),
    ).map((w) => w.textContent);

  it("decrypt: says the trustee processes sign by themselves; nobody presses Sign", async () => {
    open({ [ELECTION]: view("closed-0") });
    await heading(/Decrypt/);
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "Waiting for trustees to decrypt on their own pages. Once 3 shares are recorded, each of those trustee processes signs the totals by itself, and the console publishes the result when 3 signatures are held. Nobody presses Sign.",
    );
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    open({ [ELECTION]: view("closed-sig2") });
    await heading(/Decrypt/);
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "Waiting for the trustee processes to sign the totals by themselves. The console publishes the result when 3 signatures are held.",
    );
    expect(within(card()).queryByRole("button")).toBeNull();
  });

  it("tallied while the console verifies: says so, no Verify button", async () => {
    open({ [ELECTION]: view("tallied-verifying") });
    await heading(/Result/);
    expect(within(card()).getByRole("status")).toHaveTextContent(
      "Verifying the result on the chain…",
    );
    expect(within(card()).queryByRole("button", { name: /Verify/ })).toBeNull();
    expect(within(card()).queryByText("Result verified")).toBeNull();
    expect(stepWords()[4]).toBe("checking");
  });

  it("moves to verified by itself, with no press", async () => {
    let n = 0;
    const s = open({
      [ELECTION]: () =>
        ++n > 2 ? view("verified") : view("tallied-verifying"),
    });
    await heading(/Result/);
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(
      await within(card()).findByText("Result verified"),
    ).toBeInTheDocument();
    expect(within(card()).queryByRole("button", { name: /Verify/ })).toBeNull();
    expect(s.to("POST", "/api/live/verify")).toHaveLength(0);
  });

  it("verified: no Verify button", async () => {
    open({ [ELECTION]: view("verified") });
    await heading(/Result|verified/);
    expect(within(card()).getByText("Result verified")).toBeInTheDocument();
    expect(within(card()).queryByRole("button", { name: /Verify/ })).toBeNull();
  });

  it("an automatic check that failed: Result NOT verified, Verify again", async () => {
    open({ [ELECTION]: view("tallied-fail") });
    await heading(/Result/);
    expect(within(card()).getByText("Result NOT verified")).toBeInTheDocument();
    expect(
      await within(card()).findByRole("button", { name: "Verify again" }),
    ).toBeEnabled();
    expect(stepWords()[4]).toBe("check failed");
  });

  it("an automatic check with no verdict: the console's reason, Verify again", async () => {
    open({ [ELECTION]: view("tallied-error") });
    await heading(/Result/);
    expect(within(card()).getByText("Not verified yet")).toBeInTheDocument();
    expect(
      within(card()).getByText(
        "The automatic check gave no verdict: verify-live: reading the ballots from the chain: context deadline exceeded",
      ),
    ).toBeInTheDocument();
    expect(
      await within(card()).findByRole("button", { name: "Verify again" }),
    ).toBeEnabled();
  });

  it("publish row from the close: says what it sends, then the chain's threshold refusal", async () => {
    const s = await openDemos("closed-0", {
      "POST /api/live/tally/publish": {
        status: 422,
        body: {
          error: "PublishTally was refused by the chain",
          refused: true,
          gate: "threshold",
          reason:
            'tally for election "live-20261115-100000-f1x7ad31" carries no trustee signatures',
        },
      },
    });
    const r = row(/Publish with 0 of 3 signatures/);
    expect(
      within(r).getByText(
        "Sends a tally that no trustee signed, with zero for every contest: no totals exist before the trustees decrypt. The chain's threshold check should refuse it: nobody, the console included, can publish a result without the trustees.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(r).getByRole("button", { name: "Publish with 0 of 3 signatures" }),
    );
    expect(await within(r).findByText("threshold")).toBeInTheDocument();
    expect(
      within(r).getByText(/carries no trustee signatures/),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(1);
  });

  it("publish row with signatures held says it sends them", async () => {
    await openDemos("closed-sig2", {});
    expect(
      within(row(/Publish with 2 of 3 signatures/)).getByText(
        /^Sends the totals with the 2 trustee signatures the console holds, fewer than the 3 needed\./,
      ),
    ).toBeInTheDocument();
  });

  it("publish row says before sending that the count changed, and sends nothing", async () => {
    let moved = false;
    const s = await openDemos("closed-0", {
      [ELECTION]: () => (moved ? view("closed-sig2") : view("closed-0")),
      "POST /api/live/tally/publish": answer("refused-threshold"),
    });
    const button = screen.getByRole("button", {
      name: "Publish with 0 of 3 signatures",
    });
    moved = true;
    fireEvent.click(button);
    expect(
      await screen.findByText(
        "Not sent: the console now holds 2 of 3 signatures, not the 0 the button named. The button now names what it sends; press it again to send it.",
      ),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(0);
  });

  it("a chain that accepted the unsigned tally: stop the demo, in the error style", async () => {
    await openDemos("closed-0", {
      "POST /api/live/tally/publish": {
        status: 500,
        body: {
          error:
            "the chain accepted a tally that no trustee signed: stop the demo; it is not recorded as the result",
          code: "accepted-unsigned",
        },
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish with 0 of 3 signatures" }),
    );
    const r = row(/Publish with 0 of 3 signatures/);
    expect(
      await within(r).findByText(
        /The chain accepted a tally that no trustee signed. Stop the demo./,
      ),
    ).toBeInTheDocument();
    expect(within(r).queryByText(/Not a refusal by the chain/)).toBeNull();
  });
});

describe("fix round 1 (task 15 review)", () => {
  const row = (name: RegExp) => screen.getByRole("region", { name });

  it("minor 5: Verify again waits for a second poll of tallied with no run and no verdict", async () => {
    let n = 0;
    // The probe and the first poll see the console's run; then it has
    // ended with no verdict.
    open({
      [ELECTION]: () =>
        ++n <= 2 ? view("tallied-verifying") : view("tallied"),
    });
    await heading(/Result/);
    await waitFor(() => expect(n).toBeGreaterThanOrEqual(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled(),
    );
    // The first view with no run: not yet offered.
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() =>
      expect(within(card()).getByText("Not verified yet")).toBeInTheDocument(),
    );
    expect(
      within(card()).queryByRole("button", { name: "Verify again" }),
    ).toBeNull();
    // The second consecutive one: offered.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(
      await within(card()).findByRole("button", { name: "Verify again" }),
    ).toBeEnabled();
  });

  it("minor 4: sends nothing when what it would send changed since the row was read", async () => {
    let moved = false;
    const s = open({
      [ELECTION]: () => (moved ? view("closed-3") : view("closed-0")),
      "GET /api/live/ledger": answer("ledger"),
      "POST /api/live/tally/publish": answer("refused-threshold"),
    });
    await heading(/step/);
    fireEvent.click(
      screen.getByText("Demonstrations: requests the chain should refuse"),
    );
    const button = screen.getByRole("button", {
      name: "Publish with 0 of 3 signatures",
    });
    moved = true;
    fireEvent.click(button);
    expect(
      await within(row(/Publish with 0 of 3 signatures/)).findByText(
        "Not sent: what this would send changed since the row was read. The row now says what it sends; press it again to send it.",
      ),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/tally/publish")).toHaveLength(0);
  });
});
