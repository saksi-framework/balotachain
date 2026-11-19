/**
 * The presenter's voter list (voter-list-api.md): the Setup step with the
 * console's preview, and the election-day list with the desk. Every name in
 * the fixtures is fictional.
 */
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
import { PREVIEW_BODY_MAX } from "./voterList";
import { DESK_POLL_MS, OUTCOME_MS } from "./ElectionDayList";

const ELECTION = "GET /api/live/election";
const PREVIEW = "POST /api/live/voter-list/preview";
const LIST = "GET /api/live/voter-list";
const CREATE = "POST /api/live/elections";
const FP = "cc0ad92dc0fce5cd088bde29bd4f6c03f3d66122e4fe06d4f44425851273dd75";

/** A fictional list file: the dates are made up. */
const CSV = [
  "# Fictional voters for the tests. No row is a real person.",
  "last_name,first_name,middle_name,date_of_birth",
  "Sampol,Tres,,1992-03-03",
  "Halimbawa,Uno,Pagsubok,1990-01-01",
  "Peña,Dos,Santos-Reyes,1991-02-02",
  "",
].join("\n");

/** Setup answers: the view moves to the made election once it is created. */
function setupRoutes(
  create: Route = view("ceremony-0"),
): Record<string, Route> {
  let created = false;
  return {
    [ELECTION]: () => view(created ? "ceremony-0" : "none"),
    [CREATE]: () => {
      const a = typeof create === "function" ? create() : create;
      if (a !== "hang" && !(a instanceof Error) && a.status < 300)
        created = true;
      return a;
    },
  };
}

function open(routes: Record<string, Route>) {
  const server = stubFetch({ "GET /api/me": answer("me-admin"), ...routes });
  render(<Root />);
  return server;
}

const heading = (re: RegExp) =>
  screen.findByRole("heading", {
    level: 2,
    name: (n) => n.startsWith("Presenter") && re.test(n),
  });

function choose(text: string | Blob, name = "list.csv") {
  fireEvent.change(screen.getByLabelText("Voter list file"), {
    target: { files: [new File([text], name, { type: "text/csv" })] },
  });
}

function bodyOf(init?: RequestInit): unknown {
  return init?.body ? JSON.parse(String(init.body)) : undefined;
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillForm() {
  type("Title", "Fixture council");
  type("Position 1", "President");
  type("Candidate 1", "Maria Santos");
  type("Candidate 2", "Bea Tan");
}

/** A list answer with some entries moved to another status, or another state. */
function listWith(
  name: string,
  change: Record<number, string> = {},
  state?: string,
  desk?: number[],
) {
  const a = answer(name);
  const b = a.body as {
    election_state: string;
    entries: { seq: number; status: string }[];
    desk: { seq: number; status: string }[];
  };
  for (const e of b.entries) if (change[e.seq]) e.status = change[e.seq]!;
  if (desk) b.desk = b.desk.filter((e) => desk.includes(e.seq));
  if (state) b.election_state = state;
  return a;
}

const step = () => screen.getByRole("region", { name: "Voter list" });
const panel = () => screen.getByRole("region", { name: "Election-day list" });
const desk = () => screen.getByRole("region", { name: "At the desk" });
const theList = () => screen.getByRole("region", { name: "The list" });

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Setup: the Voter list step", () => {
  it("comes after the positions and the trustee sentence, which stays with the names", async () => {
    open({ [ELECTION]: view("none") });
    await heading(/Setup/);
    const text = screen.getByRole("region", {
      name: "Current step",
    }).textContent!;
    expect(text.indexOf("Add a position")).toBeLessThan(
      text.indexOf("5 trustees, 3 needed"),
    );
    expect(text.indexOf("5 trustees, 3 needed")).toBeLessThan(
      text.indexOf("Voter list"),
    );
  });

  it("no file chosen: says so, offers no confirm, and Create election sends nothing", async () => {
    const s = open({ [ELECTION]: view("none") });
    await heading(/Setup/);
    expect(within(step()).getByText("No file chosen.")).toBeInTheDocument();
    expect(
      within(step()).queryByRole("button", {
        name: "Confirm the list",
      }),
    ).toBeNull();
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    // One sentence, in the step, announced; not a second one by the button.
    const said = "Confirm the voter list before the election can be created.";
    expect(await within(step()).findByText(said)).toHaveAttribute(
      "role",
      "alert",
    );
    expect(document.body.textContent).not.toMatch(/not confirmed yet/);
    // No field is refused, so the file button takes the focus.
    await waitFor(() =>
      expect(
        within(step()).getByRole("button", { name: "Choose the CSV file" }),
      ).toHaveFocus(),
    );
    expect(s.to("POST", "/api/live/elections")).toHaveLength(0);
    expect(s.to("POST", "/api/live/voter-list/preview")).toHaveLength(0);
  });

  it("a valid file: the console's preview, the fingerprint, then the exact setup body", async () => {
    const s = open({
      ...setupRoutes(),
      [PREVIEW]: answer("voter-list-preview-valid"),
    });
    await heading(/Setup/);
    choose(CSV);
    expect(
      await within(step()).findByText("Precinct 0001A (demonstration)"),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/voter-list/preview")).toHaveLength(1);
    expect(
      bodyOf(s.to("POST", "/api/live/voter-list/preview")[0]!.init),
    ).toEqual({ csv: CSV });
    expect(within(step()).getByText("File: list.csv")).toBeInTheDocument();
    expect(within(step()).getByTestId("list-count")).toHaveTextContent(
      "3 voters on the list (a precinct holds at most 200).",
    );
    const table = within(step()).getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("1HalimbawaUnoPagsubokValid");
    expect(rows[3]).toHaveTextContent("3SampolTresValid");
    // The date itself is never on the page.
    expect(document.body.textContent).not.toMatch(/1992|1990-01-01/);
    expect(within(step()).getByText("cc0ad92dc0fce5cd")).toBeInTheDocument();
    expect(within(step()).queryByText(FP)).toBeNull();
    fireEvent.click(
      within(step()).getByRole("button", { name: "Show the full fingerprint" }),
    );
    expect(within(step()).getByText(FP)).toBeInTheDocument();

    fireEvent.click(
      within(step()).getByRole("button", { name: "Confirm the list" }),
    );
    expect(within(step()).getByRole("status")).toHaveTextContent(
      "Confirmed: 3 voters, fingerprint cc0ad92dc0fce5cd. The console locks this list when the election is created; after that no row can be added or changed.",
    );
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    expect(await screen.findByText("Election created")).toBeInTheDocument();
    const posts = s.to("POST", "/api/live/elections");
    expect(posts).toHaveLength(1);
    expect(bodyOf(posts[0]!.init)).toEqual({
      title: "Fixture council",
      positions: [{ id: "President", candidates: ["Maria-Santos", "Bea-Tan"] }],
      trustees: 5,
      threshold: 3,
      voter_list: CSV,
      voter_list_fingerprint: FP,
    });
    // The step is gone with the form, and the list with it.
    expect(screen.queryByRole("region", { name: "Voter list" })).toBeNull();
  });

  it("a file with errors: each error on its line, Not valid, and no confirm", async () => {
    open({
      [ELECTION]: view("none"),
      [PREVIEW]: answer("voter-list-preview-errors"),
    });
    await heading(/Setup/);
    choose(CSV);
    expect(
      await within(step()).findByText(
        "The list has 3 errors, so it cannot be confirmed. Change the file and choose it again.",
      ),
    ).toBeInTheDocument();
    const errors = within(step()).getByRole("list", {
      name: "Errors in the list",
    });
    expect(
      within(errors)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      "Line 3 (No. 1 in the table): The date of birth is not a real date from 1900-01-01 on.",
      "Line 4 (No. 2 in the table): The same voter as line 3.",
      "Line 5: The row does not have 4 fields.",
    ]);
    expect(within(step()).getByText("Not valid")).toBeInTheDocument();
    // The rows the console's lines name are marked in the table, by line.
    const rows = within(
      within(step()).getByRole("table", { name: "Preview of the voter list" }),
    ).getAllByRole("row");
    expect(rows[1]!.querySelector("td")).toHaveTextContent(
      "1, error on line 3",
    );
    expect(rows[2]!.querySelector("td")).toHaveTextContent(
      "2, error on line 4",
    );
    // The table grows with the page: no inner scroll box around it.
    expect(
      within(step()).queryByRole("region", {
        name: "Preview of the voter list",
      }),
    ).toBeNull();
    expect(
      within(step()).getByText(
        "The numbers below are provisional until the list has no errors.",
      ),
    ).toBeInTheDocument();
    expect(
      within(step()).getByRole("button", { name: "Confirm the list" }),
    ).toBeDisabled();
    expect(
      within(step()).getByText(
        "The list can be confirmed once the console finds no error in it.",
      ),
    ).toBeInTheDocument();
    expect(within(step()).queryByText(/List fingerprint/)).toBeNull();
  });

  it("a file too large for the preview is not sent; the console's 413 is said in its words", async () => {
    const s = open({
      [ELECTION]: view("none"),
      [PREVIEW]: answer("voter-list-preview-413"),
    });
    await heading(/Setup/);
    choose("x".repeat(PREVIEW_BODY_MAX + 10), "big.csv");
    expect(
      await within(step()).findByText(
        "This file is 193 KiB. The console takes a voter list of at most 64 KiB, so the file was not sent.",
      ),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/voter-list/preview")).toHaveLength(0);
    choose("y".repeat(100 * 1024), "quoted.csv");
    expect(
      await within(step()).findByText(
        "The console refused the file: request body too large.",
      ),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/voter-list/preview")).toHaveLength(1);
  });

  it("console unreachable during the preview: says so, and Try again sends the same text", async () => {
    let n = 0;
    const s = open({
      [ELECTION]: view("none"),
      [PREVIEW]: () =>
        ++n === 1
          ? new TypeError("Failed to fetch")
          : answer("voter-list-preview-valid"),
    });
    await heading(/Setup/);
    choose(CSV);
    expect(
      await within(step()).findByText(
        "The console did not answer, so the file was not read: Failed to fetch.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(step()).getByRole("button", { name: "Try again" }));
    expect(
      await within(step()).findByRole("button", {
        name: "Confirm the list",
      }),
    ).toBeEnabled();
    const posts = s.to("POST", "/api/live/voter-list/preview");
    expect(posts).toHaveLength(2);
    expect(posts[1]!.init?.body).toBe(posts[0]!.init?.body);
  });

  it("a file that is not UTF-8 is not sent, and says how to save it", async () => {
    const s = open({
      [ELECTION]: view("none"),
      [PREVIEW]: answer("voter-list-preview-valid"),
    });
    await heading(/Setup/);
    // "Peña" as a Windows-1252 export writes it: 0xF1 is not UTF-8.
    choose(new Blob([new Uint8Array([0x50, 0x65, 0xf1, 0x61, 0x0a])]));
    expect(
      await within(step()).findByText(
        "The file is not UTF-8. Save it as CSV UTF-8 and choose it again.",
      ),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/voter-list/preview")).toHaveLength(0);
  });

  it("a list refused at creation: the console's sentence in the step, and the list must be confirmed again", async () => {
    const s = open({
      [ELECTION]: view("none"),
      [PREVIEW]: answer("voter-list-preview-valid"),
      [CREATE]: answer("create-list-changed"),
    });
    await heading(/Setup/);
    choose(CSV);
    fireEvent.click(
      await within(step()).findByRole("button", {
        name: "Confirm the list",
      }),
    );
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    expect(
      await within(step()).findByText(
        "the voter list's fingerprint is not the one confirmed; preview the list again",
      ),
    ).toBeInTheDocument();
    expect(within(step()).queryByText(/^Confirmed:/)).toBeNull();
    // Shown once, in the step, not again under the button.
    expect(
      screen.getAllByText(/fingerprint is not the one confirmed/),
    ).toHaveLength(1);
    fireEvent.click(
      within(step()).getByRole("button", { name: "Read the list again" }),
    );
    await waitFor(() =>
      expect(s.to("POST", "/api/live/voter-list/preview")).toHaveLength(2),
    );
    expect(
      screen.queryByText(/fingerprint is not the one confirmed/),
    ).toBeNull();
    // Confirm again, and the form keeps what was typed.
    fireEvent.click(
      await within(step()).findByRole("button", {
        name: "Confirm the list",
      }),
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Fixture council");
  });

  it("never writes the file, a name or the fingerprint to storage or the console log", async () => {
    const spies = [
      vi.spyOn(Storage.prototype, "setItem"),
      vi.spyOn(console, "log"),
      vi.spyOn(console, "info"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "debug"),
    ];
    open({
      ...setupRoutes(),
      [PREVIEW]: answer("voter-list-preview-valid"),
    });
    await heading(/Setup/);
    choose(CSV);
    fireEvent.click(
      await within(step()).findByRole("button", {
        name: "Confirm the list",
      }),
    );
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create election" }));
    await screen.findByText("Election created");
    for (const spy of spies) {
      const said = JSON.stringify(spy.mock.calls);
      expect(said).not.toMatch(/1992-03-03|Sampol|Halimbawa|cc0ad92d/);
    }
  });
});

describe("the Election-day list", () => {
  it("is not shown before voting opens", async () => {
    const s = open({ [ELECTION]: view("ceremony-3") });
    await heading(/Key ceremony/);
    expect(
      screen.queryByRole("region", { name: "Election-day list" }),
    ).toBeNull();
    expect(s.to("GET", "/api/live/voter-list")).toHaveLength(0);
  });

  it("two requests at the desk: desk order, each with its own buttons; counts, statuses and signatures from the console", async () => {
    open({
      [ELECTION]: view("open-one"),
      [LIST]: answer("voter-list-desk-two"),
    });
    await heading(/Voting/);
    const items = within(
      await screen.findByRole("region", { name: "At the desk" }),
    ).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("p")?.textContent)).toEqual([
      "Tularan, Kwatro Pagsubok",
      "Sampol, Tres",
    ]);
    expect(items[0]).toHaveTextContent("No. 4");
    for (const name of ["Tularan, Kwatro Pagsubok", "Sampol, Tres"]) {
      expect(
        within(desk()).getByRole("button", { name: `Approve ${name}` }),
      ).toBeEnabled();
      expect(
        within(desk()).getByRole("button", { name: `Refuse ${name}` }),
      ).toBeEnabled();
    }
    expect(within(panel()).getByTestId("checked-in")).toHaveTextContent(
      "Checked in (signed the list): 2 of 5",
    );
    // m4: the console's own approved count, beside it.
    expect(within(panel()).getByTestId("approved")).toHaveTextContent(
      "Approved, not signed: 0",
    );
    expect(within(panel()).getByTestId("issued")).toHaveTextContent(
      "Credentials issued: 1",
    );
    expect(
      within(panel()).getByText("Precinct 0001A (demonstration)"),
    ).toBeInTheDocument();
    const rows = within(theList()).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Credential issued");
    expect(rows[0]).toHaveTextContent("No reset: a credential was issued.");
    expect(rows[1]).toHaveTextContent("Signed");
    expect(rows[1]).toHaveTextContent("Cannot sign (recorded)");
    expect(rows[4]).toHaveTextContent("Not checked in");
    // The drawing is built by the page from numbers.
    const sig = within(rows[0]!).getByRole("img", {
      name: "Signature of Halimbawa, Uno Pagsubok",
    });
    const lines = sig.querySelectorAll("polyline");
    expect(lines).toHaveLength(2);
    expect(lines[0]!.getAttribute("points")).toBe("120,210 124,215 131,222");
    // m3: a stroke that reads on a projector, whatever the box's scale.
    expect(lines[0]!.getAttribute("stroke-width")).toBe("2.5");
    expect(lines[0]!.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    // Reset only where the console allows it.
    const resets = within(theList()).getAllByRole("button", {
      name: /^Reset the check-in of/,
    });
    expect(resets.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Reset the check-in of Peña, Dos Santos-Reyes",
      "Reset the check-in of Sampol, Tres",
      "Reset the check-in of Tularan, Kwatro Pagsubok",
    ]);
  });

  it("Approve and Refuse are the same height, at least 44px; Refuse keeps the outline look", async () => {
    open({
      [ELECTION]: view("open-one"),
      [LIST]: answer("voter-list-desk-two"),
    });
    const approve = await within(
      await screen.findByRole("region", { name: "At the desk" }),
    ).findByRole("button", { name: "Approve Sampol, Tres" });
    const refuse = within(desk()).getByRole("button", {
      name: "Refuse Sampol, Tres",
    });
    expect(refuse.style.minHeight).toBe(approve.style.minHeight);
    expect(parseInt(refuse.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    // Secondary: no fill of its own, a border, as before.
    expect(refuse.style.background).toBe("transparent");
    expect(refuse.style.border).not.toBe("");
  });

  it("the empty desk says so", async () => {
    open({
      [ELECTION]: view("open-one"),
      [LIST]: answer("voter-list-desk-empty"),
    });
    expect(
      await screen.findByText(
        "Nobody is at the desk. A voter appears here when their phone sends the check-in.",
      ),
    ).toBeInTheDocument();
    expect(within(desk()).queryByRole("button")).toBeNull();
  });

  it("Approve sends the seq and shows the console's answer", async () => {
    let approved = false;
    const s = open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        answer(approved ? "voter-list-desk-one" : "voter-list-desk-two"),
      "POST /api/live/desk/approve": () => {
        approved = true;
        return answer("desk-approved");
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Approve Tularan, Kwatro Pagsubok",
      }),
    );
    expect(
      await within(panel()).findByText("Approved Tularan, Kwatro Pagsubok."),
    ).toBeInTheDocument();
    expect(bodyOf(s.to("POST", "/api/live/desk/approve")[0]!.init)).toEqual({
      seq: 4,
    });
    await waitFor(() =>
      expect(
        within(desk()).queryByRole("button", {
          name: "Approve Tularan, Kwatro Pagsubok",
        }),
      ).toBeNull(),
    );
    // This page's own press is not reported again as a departure.
    expect(within(panel()).queryByText(/is no longer at the desk/)).toBeNull();
  });

  it("Refuse says the phone's check-in ended", async () => {
    let refused = false;
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        refused
          ? listWith(
              "voter-list-desk-two",
              { 4: "not_checked_in" },
              undefined,
              [3],
            )
          : answer("voter-list-desk-two"),
      "POST /api/live/desk/refuse": () => {
        refused = true;
        return answer("desk-refused");
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Refuse Tularan, Kwatro Pagsubok",
      }),
    );
    expect(
      await within(panel()).findByText(
        "Refused Tularan, Kwatro Pagsubok. The phone's check-in has ended; the voter can check in again.",
      ),
    ).toBeInTheDocument();
  });

  it("a request that left the desk between polls: dropped, with its new status from the console", async () => {
    let n = 0;
    const s = open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        answer(++n === 1 ? "voter-list-desk-two" : "voter-list-desk-one"),
    });
    await screen.findByRole("button", {
      name: "Approve Tularan, Kwatro Pagsubok",
    });
    const said =
      "Tularan, Kwatro Pagsubok (No. 4) is no longer at the desk. The console now lists: Approved, waiting for the signature.";
    const left = await within(panel()).findByRole(
      "list",
      { name: "Left the desk" },
      { timeout: 4000 },
    );
    expect(left).toHaveTextContent(said);
    // Said once on screen, and announced.
    expect(panel().querySelector('[aria-live="polite"]')).toHaveTextContent(
      said,
    );
    expect(
      within(desk()).queryByRole("button", {
        name: "Approve Tularan, Kwatro Pagsubok",
      }),
    ).toBeNull();
    expect(
      within(desk()).getByRole("button", { name: "Approve Sampol, Tres" }),
    ).toBeInTheDocument();
    expect(s.to("POST", "/api/live/desk/approve")).toHaveLength(0);
  });

  it("announces a new request at the desk politely", async () => {
    let n = 0;
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        answer(++n === 1 ? "voter-list-desk-one" : "voter-list-desk-two"),
    });
    await screen.findByRole("button", { name: "Approve Sampol, Tres" });
    const live = panel().querySelector('[aria-live="polite"]')!;
    await waitFor(
      () =>
        expect(live).toHaveTextContent(
          "At the desk: Tularan, Kwatro Pagsubok, No. 4.",
        ),
      { timeout: 4000 },
    );
  });

  it("Approve answered with a conflict: the console's words, and the list's status after", async () => {
    let pressed = false;
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        answer(pressed ? "voter-list-desk-one" : "voter-list-desk-two"),
      "POST /api/live/desk/approve": () => {
        pressed = true;
        return answer("desk-wrong-state");
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Approve Tularan, Kwatro Pagsubok",
      }),
    );
    expect(
      await within(panel()).findByText(
        "Tularan, Kwatro Pagsubok was not approved. The console answered: list entry 4 is not at the desk. The list below shows the console's current status.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(theList()).getAllByRole("listitem")[3]).toHaveTextContent(
        "Approved, waiting for the signature",
      ),
    );
    expect(within(panel()).queryByText(/is no longer at the desk/)).toBeNull();
  });

  it("Approve with no answer does not claim an outcome", async () => {
    open({
      [ELECTION]: view("open-one"),
      [LIST]: answer("voter-list-desk-two"),
      "POST /api/live/desk/approve": () => new TypeError("Failed to fetch"),
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Approve Sampol, Tres" }),
    );
    expect(
      await within(panel()).findByText(
        "The console did not answer, so it is not known whether Sampol, Tres was approved: Failed to fetch. The list below shows the console's next answer.",
      ),
    ).toBeInTheDocument();
  });

  it("Reset asks inline first, then sends the seq", async () => {
    let reset = false;
    const s = open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        reset
          ? listWith("voter-list-desk-two", { 2: "not_checked_in" })
          : answer("voter-list-desk-two"),
      "POST /api/live/desk/reset": () => {
        reset = true;
        return answer("desk-reset");
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Reset the check-in of Peña, Dos Santos-Reyes",
      }),
    );
    const confirm = within(theList()).getByRole("group", {
      name: "Reset the check-in of Peña, Dos Santos-Reyes?",
    });
    expect(
      within(confirm).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(s.to("POST", "/api/live/desk/reset")).toHaveLength(0);
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Reset the check-in" }),
    );
    expect(
      await within(panel()).findByText(
        "The check-in of Peña, Dos Santos-Reyes was reset. The phone's check-in has ended; the voter can check in again.",
      ),
    ).toBeInTheDocument();
    expect(bodyOf(s.to("POST", "/api/live/desk/reset")[0]!.init)).toEqual({
      seq: 2,
    });
  });

  it("Cancel closes the reset confirm and sends nothing", async () => {
    const s = open({
      [ELECTION]: view("open-one"),
      [LIST]: answer("voter-list-desk-two"),
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Reset the check-in of Sampol, Tres",
      }),
    );
    fireEvent.click(within(theList()).getByRole("button", { name: "Cancel" }));
    expect(within(theList()).queryByRole("group")).toBeNull();
    expect(s.to("POST", "/api/live/desk/reset")).toHaveLength(0);
  });

  it("after voting closes: Refuse stays, Approve is not offered and says why", async () => {
    const closed = answer("voter-list-desk-two");
    (closed.body as { election_state: string }).election_state = "closed";
    open({ [ELECTION]: view("closed-0"), [LIST]: closed });
    await heading(/Decrypt/);
    expect(
      await within(
        await screen.findByRole("region", { name: "At the desk" }),
      ).findByRole("button", { name: "Refuse Sampol, Tres" }),
    ).toBeInTheDocument();
    expect(
      within(desk()).queryByRole("button", { name: /^Approve/ }),
    ).toBeNull();
    expect(
      within(desk()).getAllByText(
        "Approval is open only while voting is open; the election is closed.",
      ),
    ).toHaveLength(2);
  });

  it("an election without a list: one sentence, nothing to press, no more polls", async () => {
    const s = open({
      [ELECTION]: view("open-one"),
      [LIST]: answer("no-voter-list"),
    });
    expect(
      await screen.findByText(
        "This election was set up without a voter list, so it has no check-in desk and no election-day list.",
      ),
    ).toBeInTheDocument();
    expect(within(panel()).queryByRole("button")).toBeNull();
    await new Promise((r) => setTimeout(r, 1700));
    expect(s.to("GET", "/api/live/voter-list")).toHaveLength(1);
  });

  it("console unreachable during the desk poll: the last answer stays, with a notice", async () => {
    let n = 0;
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        ++n === 1
          ? answer("voter-list-desk-two")
          : new TypeError("Failed to fetch"),
    });
    await screen.findByRole("button", { name: "Approve Sampol, Tres" });
    expect(
      await within(panel()).findByText(
        "This page cannot reach the console: Failed to fetch. It tries again every few seconds; what is shown is the last answer.",
        undefined,
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(
      within(desk()).getByRole("button", { name: "Approve Sampol, Tres" }),
    ).toBeInTheDocument();
  });

  it("console unreachable before any answer: says the list could not be read", async () => {
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () => new TypeError("Failed to fetch"),
    });
    expect(
      await screen.findByText(
        /The election-day list could not be read: Failed to fetch\./,
      ),
    ).toBeInTheDocument();
  });

  it("left-the-desk notes go when a later poll shows the desk unchanged", async () => {
    let n = 0;
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        answer(++n === 1 ? "voter-list-desk-two" : "voter-list-desk-one"),
    });
    expect(
      await within(
        await screen.findByRole("region", { name: "Election-day list" }),
      ).findByRole("list", { name: "Left the desk" }, { timeout: 4000 }),
    ).toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          within(panel()).queryByRole("list", { name: "Left the desk" }),
        ).toBeNull(),
      { timeout: 4000 },
    );
  });

  it("left-the-desk notes go with the next press", async () => {
    let n = 0;
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        answer(++n === 1 ? "voter-list-desk-two" : "voter-list-desk-one"),
      "POST /api/live/desk/refuse": "hang",
    });
    await within(
      await screen.findByRole("region", { name: "Election-day list" }),
    ).findByRole("list", { name: "Left the desk" }, { timeout: 4000 });
    fireEvent.click(
      within(desk()).getByRole("button", { name: "Refuse Sampol, Tres" }),
    );
    expect(
      within(panel()).queryByRole("list", { name: "Left the desk" }),
    ).toBeNull();
  });

  it("the same voter back at the desk is announced again", async () => {
    let n = 0;
    const seq = [
      "voter-list-desk-one",
      "voter-list-desk-two",
      "voter-list-desk-one",
      "voter-list-desk-two",
    ];
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () => answer(seq[Math.min(n++, seq.length - 1)]!),
    });
    await screen.findByRole("button", { name: "Approve Sampol, Tres" });
    const live = panel().querySelector('[aria-live="polite"]')!;
    const said = "At the desk: Tularan, Kwatro Pagsubok, No. 4.";
    await waitFor(() => expect(live).toHaveTextContent(said), {
      timeout: 4000,
    });
    const first = live.firstElementChild;
    await waitFor(() => expect(live).not.toHaveTextContent(said), {
      timeout: 4000,
    });
    await waitFor(() => expect(live).toHaveTextContent(said), {
      timeout: 4000,
    });
    // The same words in a new node, so a screen reader hears them again.
    expect(live.firstElementChild).not.toBe(first);
  }, 15_000);

  it("a poll answer sent before a press does not clear the unreachable notice", async () => {
    let n = 0;
    let releaseStale: (() => void) | null = null;
    const s = stubFetch({
      "GET /api/me": answer("me-admin"),
      [ELECTION]: view("open-one"),
      "POST /api/live/desk/approve": answer("desk-approved"),
      [LIST]: () => {
        n += 1;
        if (n === 1) return answer("voter-list-desk-two");
        if (n === 2) return new TypeError("Failed to fetch");
        return "hang";
      },
    });
    const stubbed = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const p = stubbed(input, init);
        // The third list read is answered late, after the press.
        if (
          String(input).endsWith("/api/live/voter-list") &&
          n === 3 &&
          !releaseStale
        ) {
          return new Promise<Response>((r) => {
            releaseStale = () =>
              r(
                new Response(
                  JSON.stringify(answer("voter-list-desk-two").body),
                  {
                    status: 200,
                  },
                ),
              );
          });
        }
        return p;
      }),
    );
    render(<Root />);
    const notice =
      "This page cannot reach the console: Failed to fetch. It tries again every few seconds; what is shown is the last answer.";
    expect(
      await screen.findByText(notice, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(releaseStale).not.toBeNull(), { timeout: 4000 });
    fireEvent.click(
      within(desk()).getByRole("button", { name: "Approve Sampol, Tres" }),
    );
    await waitFor(() =>
      expect(s.to("POST", "/api/live/desk/approve")).toHaveLength(1),
    );
    releaseStale!();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  it("the Close voting confirm says who is still at the desk, from the list's counts", async () => {
    open({
      [ELECTION]: view("open-one"),
      [LIST]: answer("voter-list-desk-two"),
    });
    await screen.findByRole("button", { name: "Approve Sampol, Tres" });
    fireEvent.click(screen.getByRole("button", { name: "Close voting" }));
    const card = screen.getByRole("region", { name: "Current step" });
    expect(
      within(card).getByText(
        "2 voters are at the desk, waiting for the Electoral Board.",
      ),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        "1 voter signed the list and has no credential yet.",
      ),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        "3 voters on the list: 3 checked in, 3 with a credential.",
      ),
    ).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/account|enrol/i);
  });
  describe("a desk-action notice never contradicts the list (I1)", () => {
    const approved = "Approved Tularan, Kwatro Pagsubok.";
    const live = () => panel().querySelector('[aria-live="polite"]')!;

    it("stays while the entry keeps the status the press produced, and goes when a poll shows another", async () => {
      let pressed = false;
      let polls = 0;
      open({
        [ELECTION]: view("open-one"),
        [LIST]: () => {
          if (!pressed) return answer("voter-list-desk-two");
          polls += 1;
          // Two polls as the press left it, then the voter signs and votes.
          return polls <= 2
            ? answer("voter-list-desk-one")
            : listWith("voter-list-desk-one", { 4: "credential_issued" });
        },
        "POST /api/live/desk/approve": () => {
          pressed = true;
          return answer("desk-approved");
        },
      });
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Approve Tularan, Kwatro Pagsubok",
        }),
      );
      expect(await within(panel()).findByText(approved)).toBeInTheDocument();
      await waitFor(() => expect(polls).toBeGreaterThanOrEqual(2), {
        timeout: 4000,
      });
      expect(within(panel()).getByText(approved)).toBeInTheDocument();
      await waitFor(
        () => expect(within(panel()).queryByText(approved)).toBeNull(),
        { timeout: 4000 },
      );
      expect(within(theList()).getAllByRole("listitem")[3]).toHaveTextContent(
        "Credential issued",
      );
      expect(panel().textContent).not.toMatch(/waiting for the signature\./);
    }, 12_000);

    it("a refusal notice goes when the election leaves open, though the entry did not move", async () => {
      let refused = false;
      let closed = false;
      open({
        [ELECTION]: view("open-one"),
        [LIST]: () =>
          refused
            ? listWith(
                "voter-list-desk-two",
                { 4: "not_checked_in" },
                closed ? "closed" : undefined,
                [3],
              )
            : answer("voter-list-desk-two"),
        "POST /api/live/desk/refuse": () => {
          refused = true;
          return answer("desk-refused");
        },
      });
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Refuse Tularan, Kwatro Pagsubok",
        }),
      );
      const said = /^Refused Tularan, Kwatro Pagsubok\./;
      expect(await within(panel()).findByText(said)).toBeInTheDocument();
      closed = true;
      await waitFor(
        () => expect(within(panel()).queryByText(said)).toBeNull(),
        { timeout: 4000 },
      );
    }, 10_000);

    it("a notice whose answer gave no status stands on the next poll's status and goes when it changes", async () => {
      let pressed = false;
      let polls = 0;
      open({
        [ELECTION]: view("open-one"),
        [LIST]: () => {
          if (!pressed) return answer("voter-list-desk-two");
          polls += 1;
          return polls <= 2
            ? answer("voter-list-desk-two")
            : listWith(
                "voter-list-desk-two",
                { 3: "approved" },
                undefined,
                [4],
              );
        },
        "POST /api/live/desk/approve": () => {
          pressed = true;
          return new TypeError("Failed to fetch");
        },
      });
      fireEvent.click(
        await screen.findByRole("button", { name: "Approve Sampol, Tres" }),
      );
      const said = /it is not known whether Sampol, Tres was approved/;
      expect(await within(panel()).findByText(said)).toBeInTheDocument();
      await waitFor(() => expect(polls).toBeGreaterThanOrEqual(2), {
        timeout: 4000,
      });
      expect(within(panel()).getByText(said)).toBeInTheDocument();
      await waitFor(
        () => expect(within(panel()).queryByText(said)).toBeNull(),
        { timeout: 4000 },
      );
    }, 12_000);

    it('the announcement drops "At the desk: X" once this page\'s own press took X off the desk', async () => {
      let n = 0;
      let pressed = false;
      open({
        [ELECTION]: view("open-one"),
        [LIST]: () =>
          pressed
            ? answer("voter-list-desk-one")
            : answer(++n === 1 ? "voter-list-desk-one" : "voter-list-desk-two"),
        "POST /api/live/desk/approve": () => {
          pressed = true;
          return answer("desk-approved");
        },
      });
      await screen.findByRole("button", { name: "Approve Sampol, Tres" });
      const arrival = "At the desk: Tularan, Kwatro Pagsubok, No. 4.";
      await waitFor(() => expect(live()).toHaveTextContent(arrival), {
        timeout: 4000,
      });
      fireEvent.click(
        within(desk()).getByRole("button", {
          name: "Approve Tularan, Kwatro Pagsubok",
        }),
      );
      await within(panel()).findByText(approved);
      await waitFor(() => expect(live()).not.toHaveTextContent(arrival));
      // Nor does a later poll bring it back.
      await new Promise((r) => setTimeout(r, 1700));
      expect(live()).not.toHaveTextContent(arrival);
    }, 12_000);

    it("the announcement is emptied by the next desk action", async () => {
      let n = 0;
      open({
        [ELECTION]: view("open-one"),
        [LIST]: () =>
          answer(++n === 1 ? "voter-list-desk-one" : "voter-list-desk-two"),
        "POST /api/live/desk/refuse": "hang",
      });
      await screen.findByRole("button", { name: "Approve Sampol, Tres" });
      const arrival = "At the desk: Tularan, Kwatro Pagsubok, No. 4.";
      await waitFor(() => expect(live()).toHaveTextContent(arrival), {
        timeout: 4000,
      });
      fireEvent.click(
        within(desk()).getByRole("button", { name: "Refuse Sampol, Tres" }),
      );
      expect(live().textContent).toBe("");
    }, 10_000);

    it("the announcement is emptied when the election leaves open", async () => {
      let n = 0;
      open({
        [ELECTION]: view("open-one"),
        [LIST]: () => {
          n += 1;
          if (n === 1) return answer("voter-list-desk-one");
          if (n === 2) return answer("voter-list-desk-two");
          return listWith("voter-list-desk-two", {}, "closed");
        },
      });
      await screen.findByRole("button", { name: "Approve Sampol, Tres" });
      const arrival = "At the desk: Tularan, Kwatro Pagsubok, No. 4.";
      await waitFor(() => expect(live()).toHaveTextContent(arrival), {
        timeout: 4000,
      });
      await waitFor(() => expect(live().textContent).toBe(""), {
        timeout: 4000,
      });
      // Tularan is still at the desk; only the election moved on.
      expect(
        within(desk()).getByRole("button", {
          name: "Refuse Tularan, Kwatro Pagsubok",
        }),
      ).toBeInTheDocument();
    }, 12_000);

    it("the notice and the announcement go with the panel", async () => {
      let gone = false;
      let refused = false;
      open({
        [ELECTION]: () => (gone ? view("ceremony-0") : view("open-one")),
        [LIST]: () =>
          refused
            ? listWith(
                "voter-list-desk-two",
                { 4: "not_checked_in" },
                undefined,
                [3],
              )
            : answer("voter-list-desk-two"),
        "POST /api/live/desk/refuse": () => {
          refused = true;
          return answer("desk-refused");
        },
      });
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Refuse Tularan, Kwatro Pagsubok",
        }),
      );
      await within(panel()).findByText(/^Refused Tularan/);
      gone = true;
      fireEvent.click(screen.getByRole("button", { name: "Check now" }));
      await waitFor(() =>
        expect(
          screen.queryByRole("region", { name: "Election-day list" }),
        ).toBeNull(),
      );
      expect(screen.queryByText(/Refused Tularan/)).toBeNull();
      expect(document.body.textContent).not.toMatch(/At the desk: /);
      // Mounted again on the same election, whose list still shows the
      // status the refusal produced: nothing of the old panel comes back.
      gone = false;
      fireEvent.click(screen.getByRole("button", { name: "Check now" }));
      expect(
        await within(
          await screen.findByRole("region", { name: "Election-day list" }),
        ).findByText("Precinct 0001A (demonstration)"),
      ).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 1700));
      expect(within(panel()).getAllByRole("listitem").length).toBeGreaterThan(
        0,
      );
      expect(within(panel()).queryByText(/Refused Tularan/)).toBeNull();
      expect(panel().querySelector('[aria-live="polite"]')!.textContent).toBe(
        "",
      );
    }, 10_000);
  });
});

describe("final fix wave: the election-day list", () => {
  it("m5: a refusal notice leaves after 20 s; a failed press's does not", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let refused = false;
    open({
      [ELECTION]: view("open-one"),
      [LIST]: () =>
        refused
          ? listWith(
              "voter-list-desk-two",
              { 4: "not_checked_in" },
              undefined,
              [3],
            )
          : answer("voter-list-desk-two"),
      "POST /api/live/desk/refuse": () => {
        refused = true;
        return answer("desk-refused");
      },
    });
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Refuse Tularan, Kwatro Pagsubok",
      }),
    );
    await within(panel()).findByText(/^Refused Tularan, Kwatro Pagsubok\./);
    await act(() => vi.advanceTimersByTimeAsync(OUTCOME_MS - 1000));
    expect(within(panel()).getByText(/^Refused Tularan/)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(within(panel()).queryByText(/^Refused Tularan/)).toBeNull();
  });

  it("6: a list read that hangs is given up after 10 s and said; the next tick reads again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let hang = false;
    const s = open({
      [ELECTION]: view("open-one"),
      [LIST]: () => (hang ? "hang" : answer("voter-list-desk-two")),
    });
    await screen.findByRole("button", {
      name: "Refuse Tularan, Kwatro Pagsubok",
    });
    hang = true;
    await act(() => vi.advanceTimersByTimeAsync(DESK_POLL_MS));
    const sent = s.to("GET", "/api/live/voter-list").length;
    await act(() => vi.advanceTimersByTimeAsync(DESK_POLL_MS * 2));
    // One read in flight: no new ones while it hangs.
    expect(s.to("GET", "/api/live/voter-list")).toHaveLength(sent);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(
      within(panel()).getByText(
        /This page cannot reach the console: no answer within 10 s\./,
      ),
    ).toBeInTheDocument();
    hang = false;
    // A read sent while it still hung is given up in its turn; then one
    // answers.
    await act(() => vi.advanceTimersByTimeAsync(10_000 + DESK_POLL_MS));
    await waitFor(() =>
      expect(
        within(panel()).queryByText(/This page cannot reach the console/),
      ).toBeNull(),
    );
  });
});
