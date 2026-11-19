import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App, { type Timing } from "./App";
import { RealLiveClient } from "./lib/real";
import { EARLIER_FAILED } from "./screens/Challenge";
import {
  FINGERPRINT,
  LiveError,
  STORAGE_READ_MESSAGE,
  STORAGE_READ_TITLE,
  TRACKING_CODE,
  type Choice,
  type LiveClient,
  type Position,
} from "./lib/live";
import {
  longNamePositions,
  MOCK_BOARD_CODES,
  MockLiveClient,
  type MockOptions,
} from "./lib/mock";
import { IDBFactory } from "fake-indexeddb";
import { indexedDbStore, memoryStore, type KeyValueStore } from "./lib/storage";
import { CHECKIN_RESET, NOT_ON_LIST } from "./lib/checkin";

/** Short waits, so the screens that move by themselves move quickly. */
const FAST: Timing = { pollMs: 20, enrolDoneMs: 30, checkinPollMs: 20 };

/** A phone whose browser lets the page store data. */
function phoneStore(): KeyValueStore {
  return indexedDbStore("vote-test", new IDBFactory());
}

function mock(opts: MockOptions = {}) {
  return new MockLiveClient({ speed: 0, store: phoneStore(), ...opts });
}

/** The second step of the submit after a failed check, once it is enabled. */
async function tapConfirm() {
  const yes = screen.getByRole("button", {
    name: "Yes, submit from this phone",
  });
  await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
  fireEvent.click(yes);
}

/** m7: "I cannot sign" asks once, inline, before it is sent. */
async function cannotSign() {
  click("I cannot sign");
  const yes = screen.getByRole("button", {
    name: "Yes, record that I cannot sign",
  });
  await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
  fireEvent.click(yes);
}

/** D12: "Encrypt again anyway" asks twice, like "Submit anyway…". */
async function encryptAgainAnyway() {
  click("Encrypt again anyway");
  const yes = screen.getByRole("button", { name: "Yes, encrypt again" });
  await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
  fireEvent.click(yes);
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

/** Uno Halimbawa, the practice list's first voter (fictional). */
const UNO = {
  last: "Halimbawa",
  first: "Uno",
  month: "1",
  day: "1",
  year: "1990",
};

/** Type the details on the check-in form and ask for the name. */
async function typeDetails(d: Partial<typeof UNO> = {}) {
  const v = { ...UNO, ...d };
  fireEvent.change(await screen.findByLabelText("Last name"), {
    target: { value: v.last },
  });
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: v.first },
  });
  fireEvent.change(screen.getByLabelText("Month"), {
    target: { value: v.month },
  });
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: v.day } });
  fireEvent.change(screen.getByLabelText("Year"), {
    target: { value: v.year },
  });
  click("Find my name");
}

/** Found: tick the declaration and send it to the Electoral Board. */
async function declare() {
  await screen.findByRole("heading", { name: "Your name is on the list" });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "I make this declaration." }),
  );
  click("Send to the Electoral Board");
}

/**
 * The whole check-in on the practice election, whose Electoral Board
 * approves by itself: details, declaration, then the signature screen's
 * text alternative ("I cannot sign"), which every build of the page has.
 * What came before it ("sign in") was an account and a password.
 */
async function checkIn() {
  await typeDetails();
  await declare();
  await screen.findByRole("heading", { name: "Sign the election-day list" });
  await cannotSign();
}

/** D10: with voting open, the credential comes by itself, then the ballot. */
async function enrol() {
  expect(
    await screen.findByText("Credential stored on this phone"),
  ).toBeInTheDocument();
}

async function pickAndReview() {
  expect(
    await screen.findByRole("heading", { name: "President" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("radiogroup", { name: "President: choose one" }),
  ).toBeInTheDocument();
  // Focus moved to the new screen, not left on a gone button. The ballot
  // usually opens by itself after the credential is stored, and then its
  // heading has focus (m7); after a tap, the screen's content has it.
  const main = screen.getByRole("main", { name: "President" });
  expect([
    main,
    screen.getByRole("heading", { name: "President: choose one" }),
  ]).toContain(document.activeElement);
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: /Candidate B/ }));
  click("Next");
  expect(
    await screen.findByRole("heading", { name: "Vice President" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: /Candidate F/ }));
  click("Review");
  expect(
    await screen.findByRole("heading", { name: "Review your ballot" }),
  ).toBeInTheDocument();
}

async function encrypt(): Promise<string[]> {
  click("Encrypt my ballot");
  expect(
    await screen.findByRole("heading", { name: "Your ballot is encrypted" }),
  ).toBeInTheDocument();
  return codesOnScreen();
}

function codesOnScreen(): string[] {
  return Array.from(document.querySelectorAll("code"))
    .map((c) => c.textContent ?? "")
    .filter((t) => TRACKING_CODE.test(t));
}

function fingerprintsOnScreen(): string[] {
  return Array.from(document.querySelectorAll("code"))
    .map((c) => c.textContent ?? "")
    .filter((t) => FINGERPRINT.test(t));
}

describe("vote app on the mock client", () => {
  it("runs the whole flow: check in, enrol, ballot, review, encrypt, submit, verify", async () => {
    render(<App client={mock()} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();

    // Edit link returns to that position and back to review.
    click("Edit President");
    expect(
      await screen.findByRole("heading", { name: "President" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Candidate A/ }));
    click("Back to review");
    await screen.findByRole("heading", { name: "Review your ballot" });
    expect(screen.getByText("Candidate A")).toBeInTheDocument();
    expect(screen.getByText("Candidate F")).toBeInTheDocument();

    const codes = await encrypt();
    expect(codes).toHaveLength(2);
    click("Submit");

    expect(
      await screen.findByRole("heading", { name: "Ballot recorded" }),
    ).toBeInTheDocument();
    expect(codesOnScreen()).toEqual(codes);
    expect(screen.getAllByText(/^#\d+$/)).toHaveLength(2);

    click("Verify my ballot");
    await screen.findByRole("heading", { name: "Check a tracking code" });
    click(codes[0]!);
    click("Check");
    expect(
      await screen.findByText("Recorded on the board"),
    ).toBeInTheDocument();
  });

  it("says details not on the list in one sentence that names no field, and stays on the check-in", async () => {
    const client = mock();
    const declareSpy = vi.spyOn(client, "declare");
    render(<App client={client} timing={FAST} />);
    await typeDetails({ year: "1991" });
    expect(await screen.findByRole("alert")).toHaveTextContent(NOT_ON_LIST);
    // Tied to every field, since it says none of them.
    const id = screen.getByText(NOT_ON_LIST).closest("[id]")!.id;
    for (const label of ["Last name", "First name", "Month", "Day", "Year"]) {
      expect(
        screen.getByLabelText(label).getAttribute("aria-describedby"),
      ).toContain(id);
    }
    // What was typed stays, for a correction.
    expect(screen.getByLabelText("Last name")).toHaveValue("Halimbawa");
    expect(declareSpy).not.toHaveBeenCalled();
  });

  it("challenges a ballot, discards it, re-encrypts, then submits the fresh one", async () => {
    render(<App client={mock()} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    const first = await encrypt();
    // The fingerprints are on screen before the voter chooses.
    const shown = fingerprintsOnScreen();
    expect(shown).toHaveLength(2);

    click("Challenge this ballot");
    expect(
      await screen.findByRole("heading", { name: "The check passed" }),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    // Opened ballot and the voter's choice, side by side.
    expect(within(rows[0]!).getAllByText("Candidate B")).toHaveLength(2);
    expect(within(rows[0]!).getByText("Matches")).toBeInTheDocument();
    // The checked fingerprint next to the one shown before.
    expect(
      within(rows[0]!).getAllByText(shown[0]!, { selector: "code" }),
    ).toHaveLength(2);
    expect(screen.getByText(/thrown it away and never/)).toHaveTextContent(
      "new fingerprints and the same tracking codes",
    );

    click("Continue with the fresh ballot");
    await screen.findByRole("heading", { name: "Your ballot is encrypted" });
    expect(screen.getByText(/This is a fresh ballot/)).toBeInTheDocument();
    // Same tracking codes, new fingerprints.
    expect(codesOnScreen()).toEqual(first);
    const fresh = fingerprintsOnScreen();
    expect(fresh).toHaveLength(2);
    expect(fresh[0]).not.toBe(shown[0]);
    expect(fresh[1]).not.toBe(shown[1]);

    click("Submit");
    await screen.findByRole("heading", { name: "Ballot recorded" });
    expect(codesOnScreen()).toEqual(first);
    // The receipt keeps the fingerprint of the ballot actually sent.
    expect(fingerprintsOnScreen()).toEqual(fresh);
  });

  it("fails the check, with its own message, when the opened ballot is not the one shown", async () => {
    render(<App client={mock({ tamper: "fingerprint" })} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    await encrypt();
    click("Challenge this ballot");
    expect(
      await screen.findByRole("heading", { name: "The check failed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The ballot the phone opened is not the one it showed you: its fingerprint is different.",
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Different ballot")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Matches")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Encrypt again anyway" }),
    ).toBeInTheDocument();
  });

  it("fails the check, with its own message, when the opened ballot is for another position", async () => {
    render(<App client={mock({ tamper: "position" })} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    await encrypt();
    click("Challenge this ballot");
    expect(
      await screen.findByRole("heading", { name: "The check failed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The phone opened a ballot for a different position from the one you were voting in.",
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Wrong position")).toBeInTheDocument();
  });

  it("shows which voting software runs on the phone", async () => {
    render(<App client={mock()} timing={FAST} />);
    await checkIn();
    // The line is on every screen, which change by themselves here.
    await screen.findByText("Voting software: mock, no cryptography");
  });

  it("goes straight to the receipts when this phone's voter already voted", async () => {
    const store: KeyValueStore = phoneStore();
    const first = mock({ store });
    await first.checkedInAs(2);
    await first.enrol(() => {});
    const choices: Choice[] = [
      { positionId: "president", candidateId: "p-a" },
      { positionId: "vice-president", candidateId: "v-a" },
    ];
    const receipts = await first.submit(await first.encrypt(choices), () => {});

    // A reload: a fresh client over the same phone storage.
    render(<App client={mock({ store })} timing={FAST} />);
    expect(
      await screen.findByRole("heading", { name: "Ballot recorded" }),
    ).toBeInTheDocument();
    expect(codesOnScreen()).toEqual(receipts.map((r) => r.trackingCode));
    expect(screen.queryByLabelText("Last name")).not.toBeInTheDocument();
  });

  describe("D11: a partly recorded ballot", () => {
    /** voter3 on a phone whose send stopped after the first position. */
    async function partlySent(kind: "network" | "refused") {
      const store: KeyValueStore = phoneStore();
      const first = mock({ store });
      await first.checkedInAs(3);
      await first.enrol(() => {});
      first.failNext("submit", kind, "dropped", 1);
      const ballot = await first.encrypt([
        { positionId: "president", candidateId: "p-c" },
        { positionId: "vice-president", candidateId: "v-b" },
      ]);
      await expect(first.submit(ballot, () => {})).rejects.toThrow("dropped");
      return { store, ballot };
    }

    function row(title: string) {
      const list = screen.getByRole("list", { name: "Receipts" });
      return within(list)
        .getAllByRole("listitem")
        .find((li) => within(li).queryByText(title))!;
    }

    it("lists every position: Recorded with code and block, or Not sent; Finish sends only the missing one", async () => {
      const { store, ballot } = await partlySent("refused");
      const client = mock({ store });
      const submit = vi.spyOn(client, "submit");
      const encrypt = vi.spyOn(client, "encrypt");
      render(<App client={client} timing={FAST} />);
      expect(
        await screen.findByRole("heading", { name: "Ballot partly recorded" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/1 of 2 positions/)).toHaveAttribute(
        "aria-live",
        "polite",
      );
      const pres = row("President");
      expect(within(pres).getByText("Recorded")).toBeInTheDocument();
      expect(within(pres).getByText(/^#\d+$/)).toBeInTheDocument();
      expect(
        within(pres).getByText(ballot.positions[0]!.trackingCode),
      ).toBeInTheDocument();
      expect(
        within(row("Vice President")).getByText("Not sent"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Verify what is recorded" }),
      ).toBeInTheDocument();

      click("Finish my ballot");
      // Only the missing position is on the ballot.
      expect(
        await screen.findByRole("heading", { name: "Vice President" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Position 1 of 1")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: /Candidate D/ }));
      click("Review");
      await screen.findByRole("heading", { name: "Review your ballot" });
      // The recorded position is shown, locked: no Edit for it.
      expect(
        screen.getByText(ballot.positions[0]!.trackingCode),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit President" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Edit Vice President" }),
      ).toBeInTheDocument();
      click("Encrypt my ballot");
      await screen.findByRole("heading", { name: "Your ballot is encrypted" });
      expect(encrypt).toHaveBeenLastCalledWith([
        { positionId: "vice-president", candidateId: "v-a" },
      ]);
      click("Submit");
      expect(
        await screen.findByRole("heading", { name: "Ballot recorded" }),
      ).toBeInTheDocument();
      // The request list: one ballot, for the missing position only.
      expect(submit).toHaveBeenCalledTimes(1);
      const sent = submit.mock.calls[0]![0];
      expect(sent.positions.map((p) => p.positionId)).toEqual([
        "vice-president",
      ]);
      // Both positions on the receipt now, the first one unchanged.
      expect(codesOnScreen()).toEqual(
        ballot.positions.map((p) => p.trackingCode),
      );
    });

    it("when voting has closed: no button, and says the missing positions cannot be sent", async () => {
      const { store } = await partlySent("refused");
      render(<App client={mock({ store, status: "closed" })} timing={FAST} />);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      expect(
        screen.getByText(
          "Voting has closed. The missing positions cannot be sent.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Finish my ballot" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Send again" }),
      ).not.toBeInTheDocument();
    });

    it("a position sent without an answer is Not confirmed, never Not sent: it is sent again, the same ballot, before any Finish", async () => {
      const { store, ballot } = await partlySent("network");
      const client = mock({ store });
      const submit = vi.spyOn(client, "submit");
      render(<App client={client} timing={FAST} />);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      const vp = row("Vice President");
      expect(within(vp).getByText("Not confirmed")).toBeInTheDocument();
      expect(
        within(vp).getByText(ballot.positions[1]!.trackingCode),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Finish my ballot" }),
      ).not.toBeInTheDocument();
      click("Send again");
      expect(
        await screen.findByRole("heading", { name: "Ballot recorded" }),
      ).toBeInTheDocument();
      // The same ballot (its fingerprint), for that position only.
      expect(submit.mock.calls[0]![0].positions).toEqual([ballot.positions[1]]);
      expect(fingerprintsOnScreen()).toEqual(
        ballot.positions.map((p) => p.fingerprint),
      );
    });

    it("a reload in the middle of Finish lands on the partial screen again, and Finish still works", async () => {
      const { store } = await partlySent("refused");
      const first = render(<App client={mock({ store })} timing={FAST} />);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      click("Finish my ballot");
      await screen.findByRole("heading", { name: "Vice President" });
      fireEvent.click(screen.getByRole("radio", { name: /Candidate D/ }));
      click("Review");
      await screen.findByRole("heading", { name: "Review your ballot" });
      first.unmount();

      // Reload mid-send of the Finish ballot: the answer never came.
      const second = mock({ store });
      second.failNext("submit", "network", "dropped");
      const view = render(<App client={second} timing={FAST} />);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      click("Finish my ballot");
      await screen.findByRole("heading", { name: "Vice President" });
      fireEvent.click(screen.getByRole("radio", { name: /Candidate E/ }));
      click("Review");
      await screen.findByRole("heading", { name: "Review your ballot" });
      click("Encrypt my ballot");
      await screen.findByRole("heading", { name: "Your ballot is encrypted" });
      click("Submit");
      expect(await screen.findByRole("alert")).toHaveTextContent("dropped");
      view.unmount();

      render(<App client={mock({ store })} timing={FAST} />);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      expect(
        within(row("Vice President")).getByText("Not confirmed"),
      ).toBeInTheDocument();
      click("Send again");
      expect(
        await screen.findByRole("heading", { name: "Ballot recorded" }),
      ).toBeInTheDocument();
    });

    it("is not offered after a record-mismatch alarm", async () => {
      const store = phoneStore();
      const first = mock({ store });
      await first.checkedInAs(3);
      await store.set("receipts:live-mock:checkin", [
        {
          positionId: "president",
          trackingCode: "BC-0000-0001",
          fingerprint: "0000-0000-0000-0000-0000-0000-0000-0001",
          txId: "aa".repeat(32),
          block: 7,
          alarm: {
            recordedTrackingCode: "BC-0000-0001",
            recordedFingerprint: "FFFF-0000-0000-0000-0000-0000-0000-0001",
            recordedBytesMatch: true,
          },
        },
      ]);
      const client = mock({ store });
      render(<App client={client} timing={FAST} />);
      expect(
        await screen.findByRole("heading", {
          name: "The election server's answer does not match",
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Finish my ballot" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Send again" }),
      ).not.toBeInTheDocument();
      // And the client builds nothing more, whatever the screens ask.
      await expect(
        client.encrypt([{ positionId: "vice-president", candidateId: "v-a" }]),
      ).rejects.toMatchObject({ kind: "already-voted" });
    });
  });

  describe("fix round 1", () => {
    function row(title: string) {
      const list = screen.getByRole("list", { name: "Receipts" });
      return within(list)
        .getAllByRole("listitem")
        .find((li) => within(li).queryByText(title))!;
    }

    async function voteBoth() {
      await pickAndReview();
      await encrypt();
      click("Submit");
      await screen.findByRole("heading", { name: "Ballot recorded" });
    }

    it("I3: a second election on the same phone waits, checks in and enrols, and shows only its own receipts; the first election's come back with its id", async () => {
      const store = phoneStore();
      const runA = render(
        <App client={mock({ store, electionId: "run-a" })} timing={FAST} />,
      );
      await checkIn();
      await enrol();
      await voteBoth();
      const codesA = codesOnScreen();
      const fpA = fingerprintsOnScreen();
      runA.unmount();

      // Run 2: a new election with the same position ids, not open yet.
      const b = mock({ store, electionId: "run-b", status: "setup" });
      const enrolB = vi.spyOn(b, "enrol");
      const runB = render(<App client={b} timing={FAST} />);
      expect(
        await screen.findByRole("heading", {
          name: "Voting has not opened yet",
        }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Ballot recorded")).not.toBeInTheDocument();
      b.setStatus("open");
      // The run-a check-in is no check-in in run-b: the voter checks in.
      await checkIn();
      expect(
        await screen.findByText("Credential stored on this phone"),
      ).toBeInTheDocument();
      expect(enrolB).toHaveBeenCalledTimes(1);
      // The full ballot: both positions.
      await voteBoth();
      expect(screen.getAllByText(/^#\d+$/)).toHaveLength(2);
      const fpB = fingerprintsOnScreen();
      expect(fpB).toHaveLength(2);
      expect(fpB.some((f) => fpA.includes(f))).toBe(false);
      runB.unmount();

      // Run 1's id served again: run 1's receipts.
      render(
        <App client={mock({ store, electionId: "run-a" })} timing={FAST} />,
      );
      await screen.findByRole("heading", { name: "Ballot recorded" });
      expect(codesOnScreen()).toEqual(codesA);
      expect(fingerprintsOnScreen()).toEqual(fpA);
    });

    it("I5, m5 and N1: after a resend answered taken, Finish leads, Send again is second, and Finish sends only the position known not sent", async () => {
      const positions = [
        ...["p1", "p2", "p3"].map((id, i) => ({
          id,
          title: `Position ${i + 1}`,
          candidates: [
            { id: `${id}-a`, name: `Name ${i + 1}A` },
            { id: `${id}-b`, name: `Name ${i + 1}B` },
          ],
        })),
      ];
      const store = phoneStore();
      const first = mock({ store, positions });
      await first.checkedInAs(1);
      await first.enrol(() => {});
      // P1 recorded, P2's answer lost, P3 never sent.
      first.failNext("submit", "network", "dropped", 1);
      const ballot = await first.encrypt([
        { positionId: "p1", candidateId: "p1-a" },
        { positionId: "p2", candidateId: "p2-a" },
        { positionId: "p3", candidateId: "p3-a" },
      ]);
      await expect(first.submit(ballot, () => {})).rejects.toThrow("dropped");

      // A reload; Send again is answered "taken", not confirmed.
      const client = mock({ store, positions });
      client.failNext("submit", "already-voted", "nullifier already spent");
      render(<App client={client} timing={FAST} />);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      expect(screen.getByText(/never heard back/)).toHaveTextContent(
        "This phone sent Position 2 but never heard back.",
      );
      click("Send again");
      await waitFor(() =>
        expect(
          screen.getByText(/The ledger says this position is taken/),
        ).toBeInTheDocument(),
      );
      expect(
        screen.getByText(/The ledger says this position is taken/),
      ).toHaveTextContent(
        "Position 2. The ledger says this position is taken, but the board does not show this phone's ballot. Show this screen to an election officer.",
      );
      expect(screen.queryByText(/never heard back/)).not.toBeInTheDocument();
      expect(within(row("Position 2")).getByText("Not confirmed")).toBeTruthy();
      expect(within(row("Position 3")).getByText("Not sent")).toBeTruthy();
      // N1: the only unconfirmed row was already answered "taken", so
      // Finish is primary and Send again second.
      const buttons = within(
        document.querySelector(".ba-footer") as HTMLElement,
      ).getAllByRole("button");
      expect(buttons.map((b) => b.textContent)).toEqual([
        "Finish my ballot",
        "Send again",
        "Verify what is recorded",
      ]);

      const submit = vi.spyOn(client, "submit");
      click("Finish my ballot");
      await screen.findByRole("heading", { name: "Position 3" });
      expect(screen.getByText("Position 1 of 1")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: /Name 3B/ }));
      click("Review");
      await screen.findByRole("heading", { name: "Review your ballot" });
      click("Encrypt my ballot");
      await screen.findByRole("heading", { name: "Your ballot is encrypted" });
      click("Submit");
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(
        submit.mock.calls[0]![0].positions.map((p) => p.positionId),
      ).toEqual(["p3"]);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      expect(within(row("Position 3")).getByText("Recorded")).toBeTruthy();
      expect(within(row("Position 2")).getByText("Not confirmed")).toBeTruthy();
    });

    it("I1: when voting has closed, a Not confirmed position is said to maybe be on the ledger", async () => {
      const store = phoneStore();
      const first = mock({ store });
      await first.checkedInAs(1);
      await first.enrol(() => {});
      first.failNext("submit", "network", "dropped", 1);
      await expect(
        first.submit(
          await first.encrypt([
            { positionId: "president", candidateId: "p-a" },
            { positionId: "vice-president", candidateId: "v-a" },
          ]),
          () => {},
        ),
      ).rejects.toThrow("dropped");
      render(<App client={mock({ store, status: "closed" })} timing={FAST} />);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      expect(
        screen.getByText(/Voting has closed\. The missing positions/),
      ).toHaveTextContent(
        "Voting has closed. The missing positions cannot be sent. A position marked Not confirmed may be on the ledger; check its tracking code on the public board.",
      );
      expect(
        screen.queryByText(/Only the positions marked Recorded/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Send again" }),
      ).not.toBeInTheDocument();
    });

    it("m3: a presign 'already issued' while this phone holds a credential moves on to the ballot", async () => {
      const store = phoneStore();
      const client = mock({ store });
      vi.spyOn(client, "enrol").mockImplementation(async () => {
        // Another tab of this phone got the credential meanwhile.
        await store.set("credential:checkin", {
          kind: "mock",
          electionId: "live-mock",
        });
        throw new LiveError("refused", "already issued", {
          type: "already-issued",
        });
      });
      render(<App client={client} timing={FAST} />);
      await checkIn();
      expect(
        await screen.findByRole("heading", { name: "President" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Ask an election officer/),
      ).not.toBeInTheDocument();
    });
  });

  for (const failing of [/^sending:/, /^receipts:/]) {
    it(`N2: a failed read of ${failing.source.slice(1, -1)}* shows the error screen, not the ballot; Retry after recovery lands on the right screen`, async () => {
      const inner = phoneStore();
      const ctl: { failing: RegExp | null } = { failing: null };
      const store: KeyValueStore = {
        ...inner,
        async getStrict<T>(key: string) {
          if (ctl.failing?.test(key)) throw new Error("read failed");
          return inner.getStrict<T>(key);
        },
      };
      // voter1 recorded President; Vice President was never sent.
      const first = mock({ store });
      await first.checkedInAs(1);
      await first.enrol(() => {});
      first.failNext("submit", "refused", "refused", 1);
      await expect(
        first.submit(
          await first.encrypt([
            { positionId: "president", candidateId: "p-a" },
            { positionId: "vice-president", candidateId: "v-a" },
          ]),
          () => {},
        ),
      ).rejects.toThrow("refused");

      ctl.failing = failing;
      const client = mock({ store });
      const encrypt = vi.spyOn(client, "encrypt");
      const submit = vi.spyOn(client, "submit");
      render(<App client={client} timing={FAST} />);
      expect(
        await screen.findByRole("heading", {
          name: "This phone could not read its records",
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This phone could not read its own records, so nothing was built or sent.",
      );
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(encrypt).not.toHaveBeenCalled();
      expect(submit).not.toHaveBeenCalled();

      ctl.failing = null;
      click("Retry");
      expect(
        await screen.findByRole("heading", { name: "Ballot partly recorded" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Finish my ballot" }),
      ).toBeTruthy();
    });
  }

  it("shows the closed state and still lets the voter check a code", async () => {
    render(<App client={mock({ status: "closed" })} timing={FAST} />);
    // No check-in is needed to see that voting has closed.
    expect(
      await screen.findByRole("heading", { name: "Voting has closed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /public board/ })).toHaveAttribute(
      "href",
      "/board/",
    );
    click("Check a tracking code");
    await screen.findByRole("heading", { name: "Check a tracking code" });
  });

  describe("D10: check-in and enrolment by themselves when voting opens", () => {
    // `ceremony` is tested over the HTTP transport (App.http.test.tsx): the
    // console's `ceremony` reaches the screens as `setup`.
    it("before voting opens: waits with no check-in and no Enrol button; at open the check-in opens by itself, and after the signature the credential and the ballot", async () => {
      const client = mock({ status: "setup" });
      const enrolSpy = vi.spyOn(client, "enrol");
      const findSpy = vi.spyOn(client, "findVoter");
      render(<App client={client} timing={FAST} />);
      expect(
        await screen.findByRole("heading", {
          name: "Voting has not opened yet",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Keep this page open. The check-in opens by itself when the election officer opens voting.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /voting credential/ }),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Last name")).not.toBeInTheDocument();
      // Several refreshes while still closed: nothing is asked for.
      await new Promise((r) => setTimeout(r, 120));
      expect(enrolSpy).not.toHaveBeenCalled();
      expect(findSpy).not.toHaveBeenCalled();
      client.setStatus("open");
      await checkIn();
      expect(
        await screen.findByText("Credential stored on this phone"),
      ).toBeInTheDocument();
      expect(
        await screen.findByRole("heading", { name: "President" }),
      ).toBeInTheDocument();
      expect(enrolSpy).toHaveBeenCalledTimes(1);
    });

    it("after the signature: enrols straight away and opens the ballot", async () => {
      const client = mock();
      const enrolSpy = vi.spyOn(client, "enrol");
      render(<App client={client} timing={FAST} />);
      await checkIn();
      expect(
        await screen.findByRole("heading", { name: "Getting your credential" }),
      ).toBeInTheDocument();
      expect(
        await screen.findByRole("heading", { name: "President" }),
      ).toBeInTheDocument();
      expect(enrolSpy).toHaveBeenCalledTimes(1);
    });

    it("a refresh tick while issuance runs does not start a second one", async () => {
      const client = mock({ status: "setup" });
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const real = client.enrol.bind(client);
      const enrolSpy = vi
        .spyOn(client, "enrol")
        .mockImplementation(async (onStep) => {
          await gate;
          return real(onStep);
        });
      render(<App client={client} timing={FAST} />);
      await screen.findByRole("heading", { name: "Voting has not opened yet" });
      client.setStatus("open");
      await checkIn();
      await screen.findByRole("heading", { name: "Getting your credential" });
      // Many poll intervals pass while the issuance is held open.
      await new Promise((r) => setTimeout(r, 200));
      expect(enrolSpy).toHaveBeenCalledTimes(1);
      release();
      await screen.findByRole("heading", { name: "President" });
      expect(enrolSpy).toHaveBeenCalledTimes(1);
    });

    it("under StrictMode's double effects, starts one issuance", async () => {
      const client = mock();
      const enrolSpy = vi.spyOn(client, "enrol");
      render(
        <StrictMode>
          <App client={client} timing={FAST} />
        </StrictMode>,
      );
      await checkIn();
      await screen.findByRole("heading", { name: "President" });
      expect(enrolSpy).toHaveBeenCalledTimes(1);
    });

    it("after a failed automatic issuance, only the voter's tap tries again", async () => {
      const client = mock({ status: "setup" });
      client.failNext(
        "enrol",
        "network",
        "Could not reach the election server.",
      );
      const enrolSpy = vi.spyOn(client, "enrol");
      render(<App client={client} timing={FAST} />);
      await screen.findByRole("heading", { name: "Voting has not opened yet" });
      client.setStatus("open");
      await checkIn();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not reach the election server.",
      );
      // D12: only the step that failed says Failed; later ones never started.
      const steps = within(
        screen.getByRole("list", { name: "Credential steps" }),
      ).getAllByRole("listitem");
      expect(within(steps[0]!).getByText("Done")).toBeInTheDocument();
      expect(within(steps[1]!).getByText("Failed")).toBeInTheDocument();
      for (const later of steps.slice(2)) {
        expect(within(later).getByText("Not started")).toBeInTheDocument();
      }
      expect(screen.getAllByText("Failed")).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 150));
      expect(enrolSpy).toHaveBeenCalledTimes(1);
      click("Try again");
      await screen.findByRole("heading", { name: "President" });
      expect(enrolSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("D12: an election with no positions shows the error screen, not a crash", async () => {
    const client = mock();
    const real = client.election.bind(client);
    vi.spyOn(client, "election").mockImplementation(async () => ({
      ...(await real()),
      positions: [],
    }));
    render(<App client={client} timing={FAST} />);
    await checkIn();
    expect(
      await screen.findByRole("heading", {
        name: "This election has no positions to vote on",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tell an election officer.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a network error with a retry that recovers", async () => {
    render(<App client={mock({ failOnce: ["election"] })} timing={FAST} />);
    expect(
      await screen.findByRole("heading", {
        name: "Can't reach the election server",
      }),
    ).toBeInTheDocument();
    click("Retry");
    await checkIn();
    expect(
      await screen.findByText("Credential stored on this phone"),
    ).toBeInTheDocument();
  });

  it("recovers from a network failure halfway through sending", async () => {
    const client = mock();
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    const codes = await encrypt();
    client.failNext(
      "submit",
      "network",
      "Could not reach the election server.",
      1,
    );
    click("Submit");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the election server",
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Recorded")).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/^Block #\d+$/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Interrupted")).toBeInTheDocument();
    click("Try again");
    // The retry keeps the position already recorded on screen.
    const during = screen.getAllByRole("listitem");
    expect(within(during[0]!).getByText("Recorded")).toBeInTheDocument();
    await screen.findByRole("heading", { name: "Ballot recorded" });
    expect(codesOnScreen()).toEqual(codes);
  });

  it("fails the check when the opened ballot holds a different candidate", async () => {
    const client = mock({ tamper: true });
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    await encrypt();
    click("Challenge this ballot");
    expect(
      await screen.findByRole("heading", { name: "The check failed" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("The check passed")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This phone encrypted a different candidate from the one you chose",
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getByText("Not your choice")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Candidate B")).toBeInTheDocument();
    expect(within(rows[0]!).queryByText("Matches")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText("Matches")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Encrypt again anyway" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/makes a new ballot on this same phone/),
    ).toBeInTheDocument();
  });

  it("D12: after a failed check, 'Encrypt again anyway' asks twice, and a quick double tap does not get through", async () => {
    const client = mock({ tamper: true });
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    await encrypt();
    click("Challenge this ballot");
    await screen.findByRole("heading", { name: "The check failed" });
    const encryptSpy = vi.spyOn(client, "encrypt");
    const anyway = screen.getByRole("button", { name: "Encrypt again anyway" });
    fireEvent.click(anyway);
    fireEvent.click(anyway);
    const region = screen.getByRole("group", {
      name: "If you still want a new ballot from this phone, tap “Yes, encrypt again”.",
    });
    expect(document.activeElement).toBe(region);
    const yes = within(region).getByRole("button", {
      name: "Yes, encrypt again",
    });
    expect(yes).toBeDisabled();
    fireEvent.click(yes);
    await new Promise((r) => setTimeout(r, 50));
    expect(encryptSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
    fireEvent.click(yes);
    await screen.findByRole("heading", { name: "Your ballot is encrypted" });
    expect(encryptSpy).toHaveBeenCalledTimes(1);
  });

  it("after a failed check, warns on the next ballot and asks twice before submitting", async () => {
    render(<App client={mock({ tamper: true })} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    await encrypt();
    click("Challenge this ballot");
    await screen.findByRole("heading", { name: "The check failed" });
    await encryptAgainAnyway();
    await screen.findByRole("heading", { name: "Your ballot is encrypted" });

    // A warning in error tone, not the green "fresh ballot" notice.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The last check on this phone failed. Do not rely on this phone: tell the election staff before you submit.",
    );
    expect(
      screen.queryByText(/This is a fresh ballot/),
    ).not.toBeInTheDocument();
    // No one-tap Submit: a first tap only asks for confirmation.
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
    click("Submit anyway…");
    expect(
      screen.getByRole("group", { name: /If you still want to submit it/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ballot recorded")).not.toBeInTheDocument();
    await tapConfirm();
    expect(
      await screen.findByRole("heading", { name: "Ballot recorded" }),
    ).toBeInTheDocument();
  });

  describe("a failed check is a fact about this phone for this election", () => {
    /** Fail a check, then "Encrypt again anyway", landing on the warning. */
    async function failACheck() {
      click("Challenge this ballot");
      await screen.findByRole("heading", { name: "The check failed" });
      await encryptAgainAnyway();
      await screen.findByRole("heading", { name: "Your ballot is encrypted" });
    }

    function expectWarned() {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /check on this phone failed\. Do not rely on this phone/,
      );
      expect(
        screen.queryByRole("button", { name: "Submit" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Submit anyway…" }),
      ).toBeInTheDocument();
    }

    it("survives going Back to Review and encrypting again", async () => {
      render(<App client={mock({ tamper: true })} timing={FAST} />);
      await checkIn();
      await enrol();
      await pickAndReview();
      await encrypt();
      await failACheck();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("heading", { name: "Review your ballot" });
      await encrypt();
      expectWarned();
      expect(
        screen.queryByText(/This is a fresh ballot/),
      ).not.toBeInTheDocument();
    });

    it("is not cleared by a later check that passes", async () => {
      render(<App client={mock({ tamper: true })} timing={FAST} />);
      await checkIn();
      await enrol();
      await pickAndReview();
      await encrypt();
      await failACheck();
      // The mock tampers with one ballot only: this check passes.
      click("Challenge this ballot");
      await screen.findByRole("heading", { name: "The check passed" });
      expect(screen.getByRole("alert")).toHaveTextContent(EARLIER_FAILED);
      click("Continue with the fresh ballot");
      await screen.findByRole("heading", { name: "Your ballot is encrypted" });
      expectWarned();
      // The pass is shown next to the standing warning, never instead of it.
      expect(screen.getByText(/This is a fresh ballot/)).toHaveTextContent(
        EARLIER_FAILED,
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "A check on this phone failed.",
      );
    });

    it("survives a reload (the app mounted again over the same storage)", async () => {
      const store = phoneStore();
      const first = render(
        <App client={mock({ store, tamper: true })} timing={FAST} />,
      );
      await checkIn();
      await enrol();
      await pickAndReview();
      await encrypt();
      await failACheck();
      first.unmount();

      render(<App client={mock({ store })} timing={FAST} />);
      await pickAndReview();
      await encrypt();
      expectWarned();
    });

    it("survives the phone reading its check-in and election again (what signing out and in used to do)", async () => {
      const client = mock({ tamper: true });
      render(<App client={client} timing={FAST} />);
      await checkIn();
      await enrol();
      await pickAndReview();
      await encrypt();
      await failACheck();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("heading", { name: "Review your ballot" });
      // An answer that sends the phone back through the console's
      // check-in: the screens are worked out again from scratch.
      client.failNext("encrypt", "auth", "This phone's check-in has ended.");
      click("Encrypt my ballot");
      // Back on the ballot, the choices on this page kept.
      await screen.findByRole("heading", { name: "President" });
      click("Next");
      await screen.findByRole("heading", { name: "Vice President" });
      click("Review");
      await screen.findByRole("heading", { name: "Review your ballot" });
      await encrypt();
      expectWarned();
    });

    it("stores nothing but the flag and the election id", async () => {
      const inner = phoneStore();
      const writes: [string, unknown][] = [];
      const store: KeyValueStore = {
        ...inner,
        async set<T>(key: string, value: T) {
          writes.push([key, value]);
          await inner.set(key, value);
        },
      };
      render(<App client={mock({ store, tamper: true })} timing={FAST} />);
      await checkIn();
      await enrol();
      await pickAndReview();
      await encrypt();
      const before = writes.length;
      await failACheck();
      expect(writes.slice(before)).toEqual([
        [
          "check-failed:live-mock",
          { electionId: "live-mock", checkFailed: true },
        ],
      ]);
      const [, value] = writes[before]!;
      expect(Object.keys(value as object).sort()).toEqual([
        "checkFailed",
        "electionId",
      ]);
    });

    it("keeps the flag in memory when storage fails", async () => {
      const inner = memoryStore();
      const store: KeyValueStore = {
        ...inner,
        async get<T>(key: string) {
          if (key.startsWith("check-failed:")) throw new Error("no storage");
          return inner.get<T>(key);
        },
        async set<T>(key: string, value: T) {
          if (key.startsWith("check-failed:")) throw new Error("no storage");
          await inner.set(key, value);
        },
      };
      render(<App client={mock({ store, tamper: true })} timing={FAST} />);
      await checkIn();
      await screen.findByText("Credential kept only until you close this page");
      click("Continue");
      await pickAndReview();
      await encrypt();
      await failACheck();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await screen.findByRole("heading", { name: "Review your ballot" });
      await encrypt();
      expectWarned();
    });

    it("brings the confirmation into view and focuses it, without motion when reduced", async () => {
      const proto = HTMLElement.prototype as {
        scrollIntoView?: (o?: ScrollIntoViewOptions) => void;
      };
      const original = proto.scrollIntoView;
      const originalMatch = globalThis.matchMedia;
      const scrolled: { el: Element; opts?: ScrollIntoViewOptions }[] = [];
      proto.scrollIntoView = function (this: Element, opts) {
        scrolled.push({ el: this, opts });
      };
      try {
        for (const reduce of [false, true]) {
          globalThis.matchMedia = ((q: string) => ({
            matches: reduce && q.includes("prefers-reduced-motion"),
          })) as unknown as typeof globalThis.matchMedia;
          scrolled.length = 0;
          const view = render(
            <App client={mock({ tamper: true })} timing={FAST} />,
          );
          await checkIn();
          await enrol();
          await pickAndReview();
          await encrypt();
          await failACheck();
          // Only the scrolls of this screen's confirmation count.
          scrolled.length = 0;
          // The warning box does not grow when the confirmation appears.
          const warning = screen.getByRole("alert").textContent;
          click("Submit anyway…");
          const region = screen.getByRole("group", {
            name: "If you still want to submit it, tap “Yes, submit from this phone”.",
          });
          expect(screen.getByRole("alert").textContent).toBe(warning);
          // Focus is on the region (the button is still disabled).
          expect(document.activeElement).toBe(region);
          expect(
            within(region).getByRole("button", {
              name: "Yes, submit from this phone",
            }),
          ).toBeDisabled();
          expect(scrolled).toEqual([
            {
              el: region,
              opts: { block: "center", behavior: reduce ? "auto" : "smooth" },
            },
          ]);
          // A second tap brings the same block back into view and focus.
          click("Submit anyway…");
          expect(scrolled).toHaveLength(2);
          expect(scrolled[1]!.el).toBe(region);
          expect(document.activeElement).toBe(region);
          view.unmount();
        }
      } finally {
        proto.scrollIntoView = original;
        globalThis.matchMedia = originalMatch;
      }
    });

    it("a quick double tap does not get through the confirmation", async () => {
      const client = mock({ tamper: true });
      const submit = vi.spyOn(client, "submit");
      render(<App client={client} timing={FAST} />);
      await checkIn();
      await enrol();
      await pickAndReview();
      await encrypt();
      await failACheck();
      const anyway = screen.getByRole("button", { name: "Submit anyway…" });
      fireEvent.click(anyway);
      // The second tap lands where the first did: still "Submit anyway…".
      fireEvent.click(anyway);
      expect(screen.getByRole("button", { name: "Submit anyway…" })).toBe(
        anyway,
      );
      // A tap on the new confirm button right away does nothing either.
      const yes = screen.getByRole("button", {
        name: "Yes, submit from this phone",
      });
      expect(yes).toBeDisabled();
      fireEvent.click(yes);
      await new Promise((r) => setTimeout(r, 50));
      expect(submit).not.toHaveBeenCalled();
      expect(screen.queryByText("Ballot recorded")).not.toBeInTheDocument();
      // After the short pause it works.
      await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
      fireEvent.click(yes);
      expect(
        await screen.findByRole("heading", { name: "Ballot recorded" }),
      ).toBeInTheDocument();
      expect(submit).toHaveBeenCalledTimes(1);
    });
  });

  it("does not claim the credential is stored when the browser cannot store it", async () => {
    render(<App client={mock({ store: memoryStore() })} timing={FAST} />);
    await checkIn();
    expect(
      await screen.findByText("Credential kept only until you close this page"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Credential stored on this phone"),
    ).not.toBeInTheDocument();
  });

  it("offers Back to review, not a hopeless retry, when the send is refused", async () => {
    const client = mock();
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    await encrypt();
    client.failNext("submit", "refused", "The ledger refused this ballot.");
    click("Submit");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The ledger refused this ballot.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    click("Back to review");
    expect(
      await screen.findByRole("heading", { name: "Review your ballot" }),
    ).toBeInTheDocument();
  });

  it("looks up a code that is on the board and one that is not", async () => {
    render(<App client={mock({ status: "closed" })} timing={FAST} />);
    await screen.findByRole("heading", { name: "Voting has closed" });
    click("Check a tracking code");
    const input = await screen.findByLabelText("Tracking code");

    fireEvent.change(input, { target: { value: MOCK_BOARD_CODES[0] } });
    click("Check");
    expect(
      await screen.findByText("Recorded on the board"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not counted yet/)).toBeInTheDocument();

    // A malformed code is caught before asking the board.
    fireEvent.change(input, { target: { value: "BC-12" } });
    click("Check");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A tracking code looks like BC-XXXX-XXXX",
    );
    expect(screen.queryByText("Not on the board")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "bc-0000-0000" } });
    click("Check");
    expect(await screen.findByText("Not on the board")).toBeInTheDocument();
    expect(screen.getByText(/BC-0000-0000/)).toBeInTheDocument();
  });
});

describe("m7: a screen that comes by itself focuses its heading", () => {
  /** The level-2 heading inside the screen's content. */
  function screenHeading() {
    return screen.getByRole("main").querySelector("h2.ba-heading");
  }

  it("the waiting screens give way by themselves: the check-in at open, the signature at the Board's approval, then the ballot after the credential is stored", async () => {
    const client = mock({ status: "setup", desk: "manual" });
    render(<App client={client} timing={{ ...FAST, checkinPollMs: 20 }} />);
    expect(
      await screen.findByRole("heading", { name: "Voting has not opened yet" }),
    ).toBeInTheDocument();
    client.setStatus("open");
    // The check-in came by itself from the waiting screen's poll.
    const form = await screen.findByRole("heading", {
      level: 2,
      name: /^Check in at/,
    });
    expect(document.activeElement).toBe(form);
    await typeDetails();
    await declare();
    await screen.findByRole("heading", {
      name: "Waiting for the Electoral Board",
    });
    await client.approve();
    // The signature screen came by itself from the Board's approval.
    const sign = await screen.findByRole("heading", {
      level: 2,
      name: "Sign the election-day list",
    });
    expect(document.activeElement).toBe(sign);
    expect(sign).toHaveAttribute("tabindex", "-1");
    await cannotSign();
    // Enrol came by itself after the signature.
    const enrolHeading = await screen.findByRole("heading", {
      level: 2,
      name: /credential/,
    });
    expect(document.activeElement).toBe(enrolHeading);
    await enrol();
    // The ballot opened by itself after the stored credential.
    const ballot = await screen.findByRole("heading", {
      name: "President: choose one",
    });
    expect(document.activeElement).toBe(ballot);
    expect(document.activeElement).toBe(screenHeading());
    expect(ballot).toHaveAttribute("tabindex", "-1");
  });

  it("a screen opened by a tap still focuses its content, not its heading", async () => {
    render(<App client={mock()} timing={FAST} />);
    await checkIn();
    await enrol();
    await screen.findByRole("heading", { name: "President: choose one" });
    fireEvent.click(screen.getByRole("radio", { name: /Candidate B/ }));
    click("Next");
    await screen.findByRole("heading", { name: "Vice President: choose one" });
    expect(document.activeElement).toBe(
      screen.getByRole("main", { name: "Vice President" }),
    );
  });
});

describe("D19 and D20: ids shown as names", () => {
  it("shows ids with hyphens as spaces, and encrypts and sends the raw ids", async () => {
    const LONG_NAME_POSITIONS = longNamePositions();
    const client = mock({ positions: LONG_NAME_POSITIONS });
    const encrypt = vi.spyOn(client, "encrypt");
    const submit = vi.spyOn(client, "submit");
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    const [p1, p2] = LONG_NAME_POSITIONS as [Position, Position];
    const long = p2.candidates[2]!;
    // The top bar's title is the whole name, never cut.
    expect(
      await screen.findByRole("heading", { level: 1, name: p1.title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Juan P. Dela Cruz" }));
    click("Next");
    expect(
      await screen.findByRole("heading", { level: 1, name: p2.title }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: long.name }));
    click("Review");
    expect(
      await screen.findByRole("heading", { name: "Review your ballot" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Juan P. Dela Cruz")).toBeInTheDocument();
    click("Encrypt my ballot");
    expect(
      await screen.findByRole("heading", { name: "Your ballot is encrypted" }),
    ).toBeInTheDocument();
    expect(encrypt.mock.calls[0]![0]).toEqual([
      { positionId: p1.id, candidateId: "Juan-P.-Dela-Cruz" },
      { positionId: p2.id, candidateId: long.id },
    ]);
    click("Submit");
    expect(
      await screen.findByRole("heading", { name: "Ballot recorded" }),
    ).toBeInTheDocument();
    expect(submit.mock.calls[0]![0].positions.map((p) => p.positionId)).toEqual(
      [p1.id, p2.id],
    );
  });
});

describe("states", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("the real client asks the console for this phone's check-in first, with the cookie, and never for an account", async () => {
    // voter-list-api.md, GET /api/live/checkin. (The form it leads to is
    // shown over the real wasm in App.http.test.tsx.)
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "no live election has been set up",
          }),
          { status: 404 },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<App client={new RealLiveClient()} timing={FAST} />);
    expect(
      await screen.findByRole("heading", { name: "Voting has not opened yet" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/live/checkin",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    const urls = fetch.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls.some((u) => u === "/api/me" || u === "/api/login")).toBe(false);
    expect(screen.queryByText(/Sign (in|out)/)).not.toBeInTheDocument();
  });
});

describe("the practice banner and the mock switch", () => {
  beforeEach(() => {
    // The real client's console answers: no election set up yet.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
  });

  function banner() {
    return screen.queryByRole("note", { name: "Practice election" });
  }

  it("shows the practice banner on every screen of the mock", async () => {
    const seen: string[] = [];
    const check = (where: string) => {
      expect(banner(), where).toHaveTextContent(
        "Practice election. Nothing you do here is sent or recorded.",
      );
      seen.push(where);
    };
    const client = mock({ tamper: true, desk: "manual" });
    render(<App client={client} timing={{ ...FAST, checkinPollMs: 20 }} />);
    await screen.findByLabelText("Last name");
    check("checkin");
    await typeDetails();
    await screen.findByRole("heading", { name: "Your name is on the list" });
    check("found");
    await declare();
    await screen.findByRole("heading", {
      name: "Waiting for the Electoral Board",
    });
    check("waiting");
    await client.approve();
    await screen.findByRole("heading", { name: "Sign the election-day list" });
    check("sign");
    await cannotSign();
    await enrol();
    check("enrol");
    await screen.findByRole("heading", { name: "President" });
    check("ballot");
    await pickAndReview();
    check("review");
    await encrypt();
    check("encrypted");
    click("Challenge this ballot");
    await screen.findByRole("heading", { name: "The check failed" });
    check("challenge");
    await encryptAgainAnyway();
    await screen.findByRole("heading", { name: "Your ballot is encrypted" });
    click("Submit anyway…");
    await tapConfirm();
    await screen.findByRole("heading", { name: "Ballot recorded" });
    check("submitted");
    click("Verify my ballot");
    await screen.findByRole("heading", { name: "Check a tracking code" });
    check("verify");
    expect(seen).toHaveLength(11);
  });

  it("with the switch off, ?mock=1&tamper=1 gives the real client and no practice election", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_LIVE_MOCK", "");
    vi.stubEnv("VITE_LIVE_MOCK_SWITCH", "");
    window.history.replaceState(null, "", "/vote/?mock=1&tamper=1");
    render(<App />);
    // The real client, with no election: the waiting screen, no mock note.
    await waitFor(() =>
      expect(screen.queryByText("Starting…")).not.toBeInTheDocument(),
    );
    expect(banner()).not.toBeInTheDocument();
    expect(screen.queryByText(/Practice list/)).not.toBeInTheDocument();
  });

  it("with VITE_LIVE_MOCK_SWITCH=1, ?mock=1 runs the practice election with its banner", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_LIVE_MOCK", "");
    vi.stubEnv("VITE_LIVE_MOCK_SWITCH", "1");
    window.history.replaceState(null, "", "/vote/?mock=1&speed=0");
    render(<App />);
    await screen.findByLabelText("Last name");
    expect(banner()).toBeInTheDocument();
    expect(screen.getByText(/Practice list/)).toBeInTheDocument();
  });

  it("shows no banner on the real client", async () => {
    render(<App client={new RealLiveClient()} timing={FAST} />);
    await waitFor(() =>
      expect(screen.queryByText("Starting…")).not.toBeInTheDocument(),
    );
    expect(banner()).not.toBeInTheDocument();
  });
});

/**
 * m1 (rehearsal 2): one open page, one checked-in phone, and the console
 * moving on to a new election under it. `console.now` is the election the
 * console serves; each is a mock client over the same phone storage, keyed
 * by its own election id, as the real client keys receipts and credentials.
 */
describe("a new election while the phone stays on its page (m1)", () => {
  function consoleOf(first: MockLiveClient) {
    const state = { now: first };
    const client = new Proxy({} as LiveClient, {
      get(_, key) {
        const v = (state.now as unknown as Record<PropertyKey, unknown>)[key];
        return typeof v === "function" ? v.bind(state.now) : v;
      },
    });
    return { state, client };
  }

  async function voteBoth() {
    await pickAndReview();
    await encrypt();
    click("Submit");
    await screen.findByRole("heading", { name: "Ballot recorded" });
  }

  it("leaves the old election's closed screen for the new one's waiting screen, then votes at open without a reload", async () => {
    const store = phoneStore();
    const { state, client } = consoleOf(
      mock({ store, electionId: "run-old", status: "closed" }),
    );
    render(<App client={client} timing={FAST} />);
    expect(
      await screen.findByRole("heading", { name: "Voting has closed" }),
    ).toBeInTheDocument();

    const next = mock({ store, electionId: "run-new", status: "setup" });
    state.now = next;
    expect(
      await screen.findByRole("heading", { name: "Voting has not opened yet" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Voting has closed")).not.toBeInTheDocument();

    next.setStatus("open");
    await checkIn();
    await enrol();
    await voteBoth();
    expect(screen.getAllByText(/^#\d+$/)).toHaveLength(2);
  });

  it("does not show the old election's receipt or credential as the new one's", async () => {
    const store = phoneStore();
    const old = mock({ store, electionId: "run-old" });
    const { state, client } = consoleOf(old);
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await voteBoth();
    const oldCodes = codesOnScreen();

    // The console moves on to a new election that is already open: the
    // old check-in is none in it, so the phone opens the check-in form,
    // then gets a new credential and opens a fresh ballot.
    const next = mock({ store, electionId: "run-new" });
    const enrolNext = vi.spyOn(next, "enrol");
    state.now = next;
    expect(
      await screen.findByRole("heading", { name: /^Check in at/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toHaveValue("");
    await checkIn();
    expect(
      await screen.findByText("Credential stored on this phone"),
    ).toBeInTheDocument();
    expect(enrolNext).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("heading", { name: "President" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ballot recorded")).not.toBeInTheDocument();
    for (const code of oldCodes) {
      expect(screen.queryByText(code)).not.toBeInTheDocument();
    }
    // The new ballot reuses the old ids: nothing of the old choice is
    // ticked, and Next stays off until the voter picks.
    const president = screen.getByRole("radiogroup", {
      name: "President: choose one",
    });
    for (const r of within(president).getAllByRole("radio")) {
      expect(r).not.toBeChecked();
    }
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("takes the error screen when the new election's records cannot be read, never the old receipt under it", async () => {
    const store = phoneStore();
    const { state, client } = consoleOf(mock({ store, electionId: "run-old" }));
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await voteBoth();

    // The new election is read, then this phone's storage fails.
    const next = mock({ store, electionId: "run-new" });
    vi.spyOn(next, "receipts").mockRejectedValue(
      new LiveError("network", STORAGE_READ_MESSAGE, { type: "storage-read" }),
    );
    state.now = next;
    expect(
      await screen.findByRole("heading", { name: STORAGE_READ_TITLE }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ballot recorded")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("stays on the receipt of the current election, and reopens on it", async () => {
    const store = phoneStore();
    const { client } = consoleOf(mock({ store, electionId: "run-now" }));
    const view = render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await voteBoth();
    const codes = codesOnScreen();
    // Several follow polls later, still the receipt.
    await new Promise((r) => setTimeout(r, 150));
    expect(
      screen.getByRole("heading", { name: "Ballot recorded" }),
    ).toBeInTheDocument();
    view.unmount();

    render(
      <App client={mock({ store, electionId: "run-now" })} timing={FAST} />,
    );
    await screen.findByRole("heading", { name: "Ballot recorded" });
    expect(codesOnScreen()).toEqual(codes);
  });

  /** Rehearsal 4, m2: the Verify screen is an end of one election too. */
  it("a phone on Verify moves to the new election by itself, like the receipt", async () => {
    const store = phoneStore();
    const { state, client } = consoleOf(mock({ store, electionId: "run-old" }));
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await voteBoth();
    const oldCodes = codesOnScreen();
    click("Verify my ballot");
    await screen.findByRole("heading", { name: "Check a tracking code" });

    state.now = mock({ store, electionId: "run-new" });
    expect(
      await screen.findByRole("heading", { name: /^Check in at/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Check a tracking code")).not.toBeInTheDocument();
    for (const code of oldCodes) {
      expect(screen.queryByText(code)).not.toBeInTheDocument();
    }
  });

  it("Back from Verify never shows the old election's receipt once a new election exists", async () => {
    const store = phoneStore();
    const { state, client } = consoleOf(mock({ store, electionId: "run-old" }));
    // The follow poll is slow here, so only Back can find the new election.
    render(<App client={client} timing={{ ...FAST, pollMs: 600_000 }} />);
    await checkIn();
    await enrol();
    await voteBoth();
    click("Verify my ballot");
    await screen.findByRole("heading", { name: "Check a tracking code" });

    state.now = mock({ store, electionId: "run-new" });
    let receiptSeen = false;
    const watch = new MutationObserver(() => {
      if (screen.queryByText("Ballot recorded")) receiptSeen = true;
    });
    watch.observe(document.body, { childList: true, subtree: true });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { name: /^Check in at/ }),
    ).toBeInTheDocument();
    watch.disconnect();
    expect(receiptSeen).toBe(false);
  });

  it("stays on Verify while the same election only changes status, and Back is its receipt", async () => {
    const store = phoneStore();
    const now = mock({ store, electionId: "run-now" });
    const { client } = consoleOf(now);
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await voteBoth();
    const codes = codesOnScreen();
    click("Verify my ballot");
    await screen.findByRole("heading", { name: "Check a tracking code" });

    now.setStatus("closed");
    await new Promise((r) => setTimeout(r, 150));
    expect(
      screen.getByRole("heading", { name: "Check a tracking code" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Ballot recorded" });
    expect(codesOnScreen()).toEqual(codes);
  });

  for (const where of ["found", "waiting", "sign"] as const) {
    it(`a new election while on the check-in's ${where} screen: the new election's check-in, with nothing kept`, async () => {
      const store = phoneStore();
      const old = mock({ store, electionId: "run-old", desk: "manual" });
      const { state, client } = consoleOf(old);
      render(<App client={client} timing={FAST} />);
      await typeDetails();
      if (where !== "found") await declare();
      if (where === "sign") {
        await screen.findByRole("heading", {
          name: "Waiting for the Electoral Board",
        });
        await old.approve();
      }
      await screen.findByRole("heading", {
        name: {
          found: "Your name is on the list",
          waiting: "Waiting for the Electoral Board",
          sign: "Sign the election-day list",
        }[where],
      });
      const next = mock({ store, electionId: "run-new", desk: "manual" });
      const declareNext = vi.spyOn(next, "declare");
      state.now = next;
      await screen.findByLabelText("Last name", {}, { timeout: 3000 });
      for (const label of ["Last name", "First name", "Month", "Day", "Year"]) {
        expect(screen.getByLabelText(label)).toHaveValue("");
      }
      expect(
        screen.queryByText("Halimbawa, Uno Pagsubok"),
      ).not.toBeInTheDocument();
      // Nothing was declared for the new election on the phone's behalf.
      await new Promise((r) => setTimeout(r, 60));
      expect(declareNext).not.toHaveBeenCalled();
      expect(await next.checkin()).toBeNull();
    });
  }
});

/**
 * Task 13b fix round 1: the "I cannot sign" question belongs to one
 * election and one list entry. A reset by the presenter or a new election
 * while it is open closes it; it never reappears on a later signature step.
 */
describe('the open "I cannot sign" question does not carry over', () => {
  const QUESTION =
    "The Electoral Board will record on the list that you could not sign. You then get your ballot.";
  const question = () => screen.queryByRole("group", { name: QUESTION });

  it("a presenter reset while it is open closes it, and the next signature step starts without it", async () => {
    const client = mock({ desk: "manual" });
    await client.checkedInAs(1, "approved");
    render(<App client={client} timing={FAST} />);
    await screen.findByRole("heading", { name: "Sign the election-day list" });
    click("I cannot sign");
    expect(question()).toBeInTheDocument();
    await client.resetCheckin();
    expect(
      await screen.findByText(CHECKIN_RESET, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(question()).not.toBeInTheDocument();
    // Checked in again and approved: a fresh signature step.
    await typeDetails();
    await declare();
    await screen.findByRole("heading", {
      name: "Waiting for the Electoral Board",
    });
    await client.approve();
    await screen.findByRole("heading", { name: "Sign the election-day list" });
    expect(question()).not.toBeInTheDocument();
  });

  it("a new election while it is open closes it, even when the phone is at the signature step there too", async () => {
    const store = phoneStore();
    const old = mock({ store, electionId: "run-old", desk: "manual" });
    await old.checkedInAs(1, "approved");
    const state = { now: old };
    const client = new Proxy({} as LiveClient, {
      get(_, key) {
        const v = (state.now as unknown as Record<PropertyKey, unknown>)[key];
        return typeof v === "function" ? v.bind(state.now) : v;
      },
    });
    render(<App client={client} timing={FAST} />);
    await screen.findByRole("heading", { name: "Sign the election-day list" });
    click("I cannot sign");
    expect(question()).toBeInTheDocument();
    const next = mock({ store, electionId: "run-new", desk: "manual" });
    await next.checkedInAs(1, "approved");
    const sign = vi.spyOn(next, "signList");
    state.now = next;
    await waitFor(() => expect(question()).not.toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(
      screen.getByRole("heading", { name: "Sign the election-day list" }),
    ).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
  });
});

describe("the check-in sends each step once (fix round 1)", () => {
  /** Two presses inside one act: the second lands before `busy` renders. */
  function pressTwice(name: string) {
    const b = screen.getByRole("button", { name });
    act(() => {
      fireEvent.click(b);
      fireEvent.click(b);
    });
  }

  it("a double press on Find my name, Send to the Electoral Board and Sign the list sends each once", async () => {
    const client = mock({ desk: "manual" });
    const find = vi.spyOn(client, "findVoter");
    const declareSpy = vi.spyOn(client, "declare");
    const sign = vi.spyOn(client, "signList");
    render(<App client={client} timing={FAST} />);
    fireEvent.change(await screen.findByLabelText("Last name"), {
      target: { value: UNO.last },
    });
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: UNO.first },
    });
    fireEvent.change(screen.getByLabelText("Month"), {
      target: { value: UNO.month },
    });
    fireEvent.change(screen.getByLabelText("Day"), {
      target: { value: UNO.day },
    });
    fireEvent.change(screen.getByLabelText("Year"), {
      target: { value: UNO.year },
    });
    pressTwice("Find my name");
    await screen.findByRole("heading", { name: "Your name is on the list" });
    expect(find).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "I make this declaration." }),
    );
    pressTwice("Send to the Electoral Board");
    await screen.findByRole("heading", {
      name: "Waiting for the Electoral Board",
    });
    expect(declareSpy).toHaveBeenCalledTimes(1);
    await client.approve();
    await screen.findByRole("heading", { name: "Sign the election-day list" });
    // A double press on "I cannot sign" only asks; nothing is sent.
    pressTwice("I cannot sign");
    expect(sign).toHaveBeenCalledTimes(0);
    const yes = screen.getByRole("button", {
      name: "Yes, record that I cannot sign",
    });
    await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
    act(() => {
      fireEvent.click(yes);
      fireEvent.click(yes);
    });
    await screen.findByRole("heading", { name: "President", level: 1 });
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it("keeps the signature screen busy until the next screen is up", async () => {
    const client = mock({ desk: "manual" });
    await client.checkedInAs(1, "approved");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = client.election.bind(client);
    render(<App client={client} timing={FAST} />);
    await screen.findByRole("heading", { name: "Sign the election-day list" });
    // The step after the signature reads the election: hold that read.
    vi.spyOn(client, "election").mockImplementation(async () => {
      await gate;
      return real();
    });
    await cannotSign();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled(),
    );
    expect(
      screen.getByRole("button", { name: "Sign the list" }),
    ).toBeDisabled();
    release();
    await screen.findByRole("heading", { name: "President", level: 1 });
  });

  it("'I cannot sign' is a real button the keyboard reaches", async () => {
    const client = mock({ desk: "manual" });
    await client.checkedInAs(1, "approved");
    render(<App client={client} timing={FAST} />);
    const b = await screen.findByRole("button", { name: "I cannot sign" });
    expect(b.tagName).toBe("BUTTON");
    expect(b).toBeEnabled();
    expect(b).not.toHaveAttribute("tabindex", "-1");
    b.focus();
    expect(document.activeElement).toBe(b);
    // The drawing box is not in the tab order: it is not the only way.
    expect(
      screen.getByRole("img", { name: /Signature box/ }),
    ).not.toHaveAttribute("tabindex");
  });
});

describe("final fix wave: vote", () => {
  /** voter3's send stopped after the first position. */
  async function partlySent(store: KeyValueStore, kind: "network" | "refused") {
    const first = mock({ store });
    await first.checkedInAs(3);
    await first.enrol(() => {});
    first.failNext("submit", kind, "dropped", 1);
    const ballot = await first.encrypt([
      { positionId: "president", candidateId: "p-c" },
      { positionId: "vice-president", candidateId: "v-b" },
    ]);
    await expect(first.submit(ballot, () => {})).rejects.toThrow("dropped");
  }

  it("M1: a double tap on Send again sends once", async () => {
    const store = phoneStore();
    await partlySent(store, "network");
    const client = mock({ store });
    const submit = vi.spyOn(client, "submit");
    render(<App client={client} timing={FAST} />);
    await screen.findByRole("heading", { name: "Ballot partly recorded" });
    const again = screen.getByRole("button", { name: "Send again" });
    fireEvent.click(again);
    fireEvent.click(again);
    await screen.findByRole("heading", { name: "Ballot recorded" });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("M2: the receipt follows the console's status: closed voting ends Finish", async () => {
    const store = phoneStore();
    await partlySent(store, "refused");
    const client = mock({ store });
    render(<App client={client} timing={FAST} />);
    await screen.findByRole("heading", { name: "Ballot partly recorded" });
    expect(
      screen.getByRole("button", { name: "Finish my ballot" }),
    ).toBeInTheDocument();
    client.setStatus("closed");
    expect(
      await screen.findByText(
        "Voting has closed. The missing positions cannot be sent.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Finish my ballot" }),
    ).not.toBeInTheDocument();
  });

  it("M3: an automatic issuance answered auth does not start another by itself", async () => {
    const client = mock();
    const enrolSpy = vi
      .spyOn(client, "enrol")
      .mockRejectedValue(new LiveError("auth", "check-in ended"));
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await screen.findByRole("button", { name: "Get my voting credential" });
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(enrolSpy).toHaveBeenCalledTimes(1);
  });

  it("M4: a credential for another election takes the phone back to the console's screen, not a dead end on Review", async () => {
    const client = mock();
    render(<App client={client} timing={FAST} />);
    await checkIn();
    await enrol();
    await pickAndReview();
    vi.spyOn(client, "encrypt").mockRejectedValueOnce(
      new LiveError("refused", "not for this election", {
        type: "stale-credential",
      }),
    );
    const checkin = vi.spyOn(client, "checkin");
    click("Encrypt my ballot");
    await waitFor(() => expect(checkin).toHaveBeenCalled());
    expect(
      await screen.findByRole("heading", { name: "President" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("not for this election")).toBeNull();
  });

  it("M5: a find answer that lands after a poll moved the page does not overwrite it", async () => {
    const client = mock();
    let answer: (
      v: Awaited<ReturnType<typeof client.findVoter>>,
    ) => void = () => {};
    const real = client.findVoter.bind(client);
    vi.spyOn(client, "findVoter").mockImplementation(async (d) => {
      const found = await real(d);
      return new Promise((r) => {
        answer = () => r(found);
      });
    });
    render(<App client={client} timing={FAST} />);
    await typeDetails();
    await waitFor(() => expect(client.findVoter).toHaveBeenCalled());
    client.setStatus("closed");
    await screen.findByRole("heading", { name: "Voting has closed" });
    await act(async () => answer(undefined as never));
    expect(
      screen.getByRole("heading", { name: "Voting has closed" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Your name is on the list" }),
    ).not.toBeInTheDocument();
  });
});

describe("the typed date of birth (Task 11)", () => {
  /** Find the name: the typed details are held until the declaration. */
  async function found() {
    await typeDetails();
    await screen.findByRole("heading", { name: "Your name is on the list" });
  }
  async function formYear(): Promise<string> {
    return ((await screen.findByLabelText("Year")) as HTMLInputElement).value;
  }

  it("is dropped when voting closes", async () => {
    const client = mock();
    render(<App client={client} timing={FAST} />);
    await found();
    client.setStatus("closed");
    await screen.findByRole("heading", { name: "Voting has closed" });
    client.setStatus("open");
    expect(await formYear()).toBe("");
  });

  it("is dropped when voting is not open", async () => {
    const client = mock();
    render(<App client={client} timing={FAST} />);
    await found();
    client.setStatus("setup");
    await screen.findByRole("heading", { name: "Voting has not opened yet" });
    client.setStatus("open");
    expect(await formYear()).toBe("");
  });

  it("is dropped when the console has no voter list", async () => {
    const store = phoneStore();
    const withList = mock({ store });
    const state = { now: withList };
    const client = new Proxy({} as LiveClient, {
      get(_, key) {
        const v = (state.now as unknown as Record<PropertyKey, unknown>)[key];
        return typeof v === "function" ? v.bind(state.now) : v;
      },
    });
    render(<App client={client} timing={FAST} />);
    await found();
    state.now = mock({ store, voterList: false });
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Your name is on the list" }),
      ).not.toBeInTheDocument(),
    );
    state.now = withList;
    expect(await formYear()).toBe("");
  });

  it("is dropped when the Electoral Board's refusal arrives", async () => {
    const client = mock();
    render(<App client={client} timing={FAST} />);
    await found();
    await client.checkedInAs(1, "refused");
    await screen.findByRole("button", { name: "Check in again" });
    click("Check in again");
    expect(await formYear()).toBe("");
  });

  it("is kept after Check in again, until the new declaration", async () => {
    const client = mock();
    await client.checkedInAs(1, "refused");
    const declare = vi.spyOn(client, "declare");
    render(<App client={client} timing={FAST} />);
    await screen.findByRole("button", { name: "Check in again" });
    click("Check in again");
    await found();
    // The cookie still answers "refused": the found name stays up.
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(
      screen.getByRole("heading", { name: "Your name is on the list" }),
    ).toBeInTheDocument();
    await declare_();
    await waitFor(() => expect(declare).toHaveBeenCalledTimes(1));
    expect(declare.mock.calls[0]![0]).toEqual({
      lastName: "Halimbawa",
      firstName: "Uno",
      dateOfBirth: "1990-01-01",
    });
  });

  async function declare_() {
    fireEvent.click(
      screen.getByRole("checkbox", { name: "I make this declaration." }),
    );
    click("Send to the Electoral Board");
  }
});
