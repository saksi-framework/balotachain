/**
 * The screens over the real client, the real saksi WebAssembly and the HTTP
 * transport, against a stubbed console (`test/fakeConsole.ts`, shapes from
 * saksi docs/live/http-api.md at 25cbafd, docs/live/voter-list-api.md). The
 * election is the committed fixture; the console stand-in has no issuer, so
 * once the voter has signed the list the credential is the fixture's (see
 * `credentialOnceSigned`), except in the enrolment tests.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanup,
  waitFor,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import App from "./App";
import fixture from "./test/fixture/live-election.json";
import {
  fakeConsole,
  fingerprintOf,
  json,
  PRECINCT_LABEL,
} from "./test/fakeConsole";
import {
  CHECKIN_RESET,
  NOT_ON_LIST,
  REFUSED_AT_DESK,
  rateLimited,
} from "./lib/checkin";
import { ALREADY_ISSUED, HttpTransport } from "./lib/http";
import { FINGERPRINT, TRACKING_CODE } from "./lib/live";
import { withFixtureCredential } from "./lib/local";
import { RealLiveClient } from "./lib/real";
import { indexedDbStore, type KeyValueStore } from "./lib/storage";
import { loadVoterCrypto } from "./lib/voterCrypto";

const WASM = resolve(
  process.cwd(),
  "../../packages/saksi-wasm/saksi_wasm_bg.wasm",
);
const RUN = "live-20261114-075259-1ced8307";

function values(re: RegExp): string[] {
  return Array.from(document.querySelectorAll("code"))
    .map((c) => c.textContent ?? "")
    .filter((t) => re.test(t));
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

let n = 0;
function setup(
  opts: Parameters<typeof fakeConsole>[0] = {},
  { credential = true } = {},
) {
  const c = fakeConsole(opts);
  const raw = indexedDbStore(`vote-http-${n++}`, new IDBFactory());
  return { c, store: raw, ...mount(c, raw, credential) };
}

/**
 * The stand-in has no issuer: the fixture's credential stands in for the
 * one the phone would get, from the moment this phone's voter has signed the
 * list (the console's `signed` for the entry its cookie holds), never before.
 */
function credentialOnceSigned(
  raw: KeyValueStore,
  c: ReturnType<typeof fakeConsole>,
): KeyValueStore {
  const fixtureStore = withFixtureCredential(raw);
  // This phone's own check-in only: another phone signing for an entry
  // (`desk.checkInElsewhere`) puts no credential on this one.
  const signed = () =>
    ["signed", "credential_issued"].includes(c.desk.mine() ?? "");
  return {
    ...raw,
    get: (key) => (signed() ? fixtureStore.get(key) : raw.get(key)),
    getStrict: (key) =>
      signed() ? fixtureStore.getStrict(key) : raw.getStrict(key),
  };
}

/** The app over this console and this phone's storage (a page load). */
function mount(
  c: ReturnType<typeof fakeConsole>,
  raw: ReturnType<typeof indexedDbStore>,
  credential = true,
) {
  const store = credential ? credentialOnceSigned(raw, c) : raw;
  const client = new RealLiveClient({
    transport: new HttpTransport({
      fetch: c.fetch,
      locks: null,
      sleep: async () => {},
    }),
    store,
    crypto: () => loadVoterCrypto(readFileSync(WASM)),
  });
  return render(
    <App
      client={client}
      timing={{ pollMs: 20, enrolDoneMs: 30, checkinPollMs: 20 }}
    />,
  );
}

/** Uno Halimbawa, the stand-in list's first voter (fictional). */
async function typeDetails({
  last = "Halimbawa",
  first = "Uno",
  month = "1",
  day = "1",
  year = "1990",
} = {}) {
  fireEvent.change(await screen.findByLabelText("Last name"), {
    target: { value: last },
  });
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: first },
  });
  fireEvent.change(screen.getByLabelText("Month"), {
    target: { value: month },
  });
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: day } });
  fireEvent.change(screen.getByLabelText("Year"), { target: { value: year } });
  click("Find my name");
}

/** Found the name: declare and wait at the Electoral Board's desk. */
async function declareAtDesk() {
  await screen.findByRole("heading", { name: "Your name is on the list" });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "I make this declaration." }),
  );
  click("Send to the Electoral Board");
  await screen.findByRole("heading", {
    name: "Waiting for the Electoral Board",
  });
}

/**
 * The whole check-in over HTTP, where "sign in" was: the details, the
 * declaration, the Board's approval at the presenter page, "I cannot sign".
 */
async function checkIn(c: ReturnType<typeof fakeConsole>) {
  await typeDetails();
  await declareAtDesk();
  c.desk.approve();
  await screen.findByRole(
    "heading",
    { name: "Sign the election-day list" },
    { timeout: 3000 },
  );
  click("I cannot sign");
  // m7: the one question before it is sent.
  const yes = screen.getByRole("button", {
    name: "Yes, record that I cannot sign",
  });
  await waitFor(() => expect(yes).toBeEnabled(), { timeout: 2000 });
  click("Yes, record that I cannot sign");
}

async function chooseAndEncrypt() {
  // The console sends no labels: each id is shown with hyphens as spaces
  // (D19), while the requests carry the ids as they are.
  await screen.findByRole("heading", { name: "president" });
  fireEvent.click(screen.getByRole("radio", { name: /bob/ }));
  click("Next");
  await screen.findByRole("heading", { name: "vice president" });
  fireEvent.click(screen.getByRole("radio", { name: /fay/ }));
  click("Review");
  await screen.findByRole("heading", { name: "Review your ballot" });
  click("Encrypt my ballot");
  await screen.findByRole("heading", { name: "Your ballot is encrypted" });
}

/** Tell the console stand-in which codes the ballots will carry. */
function expectCodes(c: ReturnType<typeof fakeConsole>) {
  const codes = values(TRACKING_CODE);
  c.expect.push(
    { positionId: "president", trackingCode: codes[0]! },
    { positionId: "vice-president", trackingCode: codes[1]! },
  );
  return codes;
}

describe("vote app over the HTTP transport (real wasm, stubbed console)", () => {
  it("checks in, builds, challenges, submits the fresh ballot, and checks it on this election's board", async () => {
    const { c } = setup();
    await checkIn(c);
    // The election key fingerprint from the transcript, as the console shows it.
    await screen.findByRole("heading", { name: "president" });
    expect(
      screen.getByText(fixture.joint_key_fingerprint, { exact: false }),
    ).toBeInTheDocument();
    await chooseAndEncrypt();
    const shown = values(FINGERPRINT);

    click("Challenge this ballot");
    await screen.findByRole("heading", { name: "The check passed" });
    click("Continue with the fresh ballot");
    await screen.findByRole("heading", { name: "Your ballot is encrypted" });
    const codes = expectCodes(c);
    const fresh = values(FINGERPRINT);
    expect(fresh).not.toEqual(shown);

    click("Submit");
    await screen.findByRole(
      "heading",
      { name: "Ballot recorded" },
      { timeout: 5000 },
    );
    // Only the fresh ballot went out, byte for byte, with no cookie.
    expect(c.recorded.map((r) => r.fingerprint)).toEqual(fresh);
    const posts = c.calls.filter((x) => x.url === "/api/live/ballot");
    expect(posts).toHaveLength(2);
    for (const p of posts) {
      expect(p.credentials).toBe("omit");
      expect(p.session).toBeNull();
      expect(Object.keys(p.body as object)).toEqual(["ballot"]);
    }
    // No request ever carried a challenged ballot.
    for (const call of c.calls) {
      const body = JSON.stringify(call.body ?? "");
      expect(
        shown.some(
          (fp) =>
            call.url === "/api/live/ballot" &&
            fingerprintOf((call.body as { ballot: string }).ballot) === fp,
        ),
      ).toBe(false);
      expect(body).not.toContain("s_cred");
    }

    expect(values(TRACKING_CODE)).toEqual(codes);
    const board = `/board/?run=${RUN}`;
    expect(
      screen.getByRole("link", { name: "Open the public board" }),
    ).toHaveAttribute("href", board);

    click("Verify my ballot");
    await screen.findByRole("heading", { name: "Check a tracking code" });
    expect(
      screen.getByRole("link", { name: "Open the public board" }),
    ).toHaveAttribute("href", board);
    click(codes[0]!);
    click("Check");
    expect(
      await screen.findByText("Recorded on the board"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Fingerprint ${fresh[0]} · matches your receipt`),
    ).toBeInTheDocument();
    expect(
      c.calls.some(
        (x) =>
          x.url === `/api/verify-code/${RUN}/${codes[0]}` &&
          x.credentials === "omit",
      ),
    ).toBe(true);
  });

  it("raises the alarm when the console reports another fingerprint, and keeps it on the receipt", async () => {
    const { c } = setup({
      ballot: (hex, i) =>
        i === 0
          ? json(200, {
              election_id: "vote-fixture",
              position_id: "president",
              tracking_code: c.expect[0]!.trackingCode,
              ballot_fingerprint: fingerprintOf("ff" + hex),
              tx_id: "ee".repeat(32),
              block_number: 401,
              recorded_bytes_match: true,
            })
          : undefined,
    });
    await checkIn(c);
    await chooseAndEncrypt();
    expectCodes(c);
    const shown = values(FINGERPRINT);
    click("Submit");
    const alert = await screen.findByRole(
      "heading",
      { name: "The election server's answer does not match" },
      { timeout: 5000 },
    );
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(shown[0]!)).toBeInTheDocument();
    // Nothing more was sent, nothing resent.
    expect(c.calls.filter((x) => x.url === "/api/live/ballot")).toHaveLength(1);
    click("See the receipt");
    const receipt = await screen.findByRole("list", { name: "Receipts" });
    expect(within(receipt).getByText("Does not match")).toBeInTheDocument();
    expect(within(receipt).getByText(shown[0]!)).toBeInTheDocument();
  });

  it("shows the chaincode's gate and reason as the console sent them", async () => {
    const reason =
      'submit SubmitBallot: rpc error: chaincode response 500, gate=cds: proof does not verify in election "vote-fixture"';
    const { c } = setup({
      ballot: () =>
        json(422, {
          error: "SubmitBallot was refused by the chain",
          refused: true,
          gate: "cds",
          reason,
        }),
    });
    await checkIn(c);
    await chooseAndEncrypt();
    expectCodes(c);
    click("Submit");
    const notice = await screen.findByRole("alert", {}, { timeout: 5000 });
    expect(notice).toHaveTextContent("The ledger refused this ballot.");
    expect(within(notice).getByText("cds")).toBeInTheDocument();
    expect(within(notice).getByText(reason)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to review" }),
    ).toBeInTheDocument();
  });

  it("says the voter already has its credential, with no retry, on a presign 409", async () => {
    const { c, store } = setup({}, { credential: false });
    await checkIn(c);
    // Voting is open: the issuance starts by itself (D10).
    expect(await screen.findByRole("alert")).toHaveTextContent(ALREADY_ISSUED);
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Get my voting credential" }),
    ).not.toBeInTheDocument();
    expect(c.calls.filter((x) => x.url === "/api/live/issue/sign")).toEqual([]);
    expect(await store.get("credential:checkin")).toBeUndefined();
  });

  it("before voting opens, asks for nothing; when the console opens, asks once by itself", async () => {
    const { c } = setup(
      { state: "ceremony", dkg: null },
      { credential: false },
    );
    expect(
      await screen.findByRole("heading", { name: "Voting has not opened yet" }),
    ).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    const issuance = () =>
      c.calls.filter((x) => x.url.startsWith("/api/live/issue/"));
    expect(issuance()).toEqual([]);
    expect(c.calls.filter((x) => x.method === "POST")).toEqual([]);
    // The polls are the public election read, without the cookie.
    const reads = c.calls.filter((x) => x.url === "/api/live/election");
    expect(reads.length).toBeGreaterThan(2);
    for (const r of reads) expect(r.credentials).toBe("omit");

    c.view.state = "open";
    c.view.dkg = fixture.dkg;
    // At open, the check-in; once signed, the credential is asked for.
    await checkIn(c);
    // The stand-in has no issuer: presign answers "already issued".
    expect(
      await screen.findByRole("alert", {}, { timeout: 5000 }),
    ).toHaveTextContent(ALREADY_ISSUED);
    await new Promise((r) => setTimeout(r, 100));
    expect(issuance().map((x) => x.url)).toEqual(["/api/live/issue/presign"]);
  });

  it("m1: a phone on the closed screen follows the console to its next election", async () => {
    const { c } = setup({ state: "closed" });
    expect(
      await screen.findByRole("heading", { name: "Voting has closed" }),
    ).toBeInTheDocument();
    // The presenter sets up the next election: a new id, in the ceremony.
    c.view.electionId = "live-20261121-090000-next";
    c.view.runId = "live-20261121-090000-next";
    c.view.state = "ceremony";
    c.view.dkg = null;
    expect(
      await screen.findByRole(
        "heading",
        { name: "Voting has not opened yet" },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(fixture.joint_key_fingerprint, { exact: false }),
    ).not.toBeInTheDocument();
  });

  describe("D11 over HTTP", () => {
    function row(title: string) {
      const list = screen.getByRole("list", { name: "Receipts" });
      return within(list)
        .getAllByRole("listitem")
        .find((li) => within(li).queryByText(title))!;
    }
    const posts = (c: ReturnType<typeof fakeConsole>) =>
      c.calls.filter((x) => x.url === "/api/live/ballot");

    it("finishes a partly recorded ballot: the only new request is the missing position", async () => {
      const { c, store } = setup({
        ballot: (_hex, i) =>
          i === 1
            ? json(422, {
                error: "SubmitBallot was refused by the chain",
                refused: true,
                gate: "cds",
                reason: "proof does not verify",
              })
            : undefined,
      });
      await checkIn(c);
      await chooseAndEncrypt();
      const codes = expectCodes(c);
      click("Submit");
      await screen.findByRole("alert", {}, { timeout: 5000 });
      click("Back to review");
      await screen.findByRole("heading", { name: "Review your ballot" });
      // Back on review, the recorded position is shown and locked.
      expect(screen.getByText(codes[0]!)).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Edit president" }),
      ).toBeNull();

      // A reload lands on the receipt, which says where each position stands.
      cleanup();
      mount(c, store);
      await screen.findByRole("heading", { name: "Ballot partly recorded" });
      expect(within(row("president")).getByText("Recorded")).toBeTruthy();
      expect(within(row("vice president")).getByText("Not sent")).toBeTruthy();
      expect(posts(c)).toHaveLength(2);

      click("Finish my ballot");
      await screen.findByRole("heading", { name: "vice president" });
      fireEvent.click(screen.getByRole("radio", { name: /dan/ }));
      click("Review");
      await screen.findByRole("heading", { name: "Review your ballot" });
      click("Encrypt my ballot");
      await screen.findByRole("heading", { name: "Your ballot is encrypted" });
      const fresh = values(FINGERPRINT);
      expect(fresh).toHaveLength(1);
      click("Submit");
      await screen.findByRole(
        "heading",
        { name: "Ballot recorded" },
        { timeout: 5000 },
      );
      const all = posts(c);
      expect(all).toHaveLength(3);
      expect(fingerprintOf((all[2]!.body as { ballot: string }).ballot)).toBe(
        fresh[0],
      );
      expect(all[2]!.credentials).toBe("omit");
      expect(Object.keys(all[2]!.body as object)).toEqual(["ballot"]);
      expect(c.recorded.map((r) => r.positionId)).toEqual([
        "president",
        "vice-president",
      ]);
      expect(values(TRACKING_CODE)).toEqual(codes);
    });

    for (const confirmed of [true, false]) {
      it(`a "position taken" answer to a resend after a reload is Recorded only when the board shows this ballot (${confirmed ? "it does" : "it does not"})`, async () => {
        // The answer below needs the console it belongs to.
        const holder: { c?: ReturnType<typeof fakeConsole> } = {};
        const setupOut = setup({
          ballot: (hex, i) => {
            const c = holder.c!;
            if (i === 1) {
              // The chain committed, the answer was lost (a 500).
              c.recorded.push({
                ballot: hex,
                positionId: "vice-president",
                trackingCode: c.expect[1]!.trackingCode,
                fingerprint: fingerprintOf(confirmed ? hex : "ff" + hex),
                txId: "cd".repeat(32),
                block: 555,
              });
              return json(500, { error: "internal error" });
            }
            if (i === 2) {
              return json(422, {
                error: "SubmitBallot was refused by the chain",
                refused: true,
                gate: "nullifier",
                reason: "nullifier already spent (double vote)",
              });
            }
            return undefined;
          },
        });
        holder.c = setupOut.c;
        const c = setupOut.c;
        await checkIn(c);
        await chooseAndEncrypt();
        expectCodes(c);
        const shown = values(FINGERPRINT);
        click("Submit");
        await screen.findByRole(
          "button",
          { name: "Try again" },
          { timeout: 5000 },
        );

        // Reload: the transport's memory of the lost answer is gone.
        cleanup();
        mount(c, setupOut.store);
        await screen.findByRole("heading", { name: "Ballot partly recorded" });
        expect(
          within(row("vice president")).getByText("Not confirmed"),
        ).toBeTruthy();
        expect(
          screen.queryByRole("button", { name: "Finish my ballot" }),
        ).toBeNull();
        click("Send again");
        await waitFor(() => expect(posts(c)).toHaveLength(3));
        if (confirmed) {
          await screen.findByRole(
            "heading",
            { name: "Ballot recorded" },
            { timeout: 5000 },
          );
          expect(values(FINGERPRINT)).toEqual(shown);
        } else {
          await screen.findByRole(
            "heading",
            { name: "Ballot partly recorded" },
            { timeout: 5000 },
          );
          const vp = row("vice president");
          expect(within(vp).getByText("Not confirmed")).toBeTruthy();
          expect(within(vp).queryByText("Recorded")).toBeNull();
        }
        // The resend was the same bytes; nothing new was built.
        const all = posts(c);
        expect(all).toHaveLength(3);
        expect((all[2]!.body as { ballot: string }).ballot).toBe(
          (all[1]!.body as { ballot: string }).ballot,
        );
      });
    }
  });

  it("offers no account sign-in: a phone with no check-in gets the check-in form, and nothing asks for an account", async () => {
    const { c } = setup();
    expect(
      await screen.findByRole("heading", {
        name: `Check in at ${PRECINCT_LABEL}`,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Account name")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign (in|out)/)).not.toBeInTheDocument();
    expect(
      c.calls.some((x) => x.url === "/api/login" || x.url === "/api/me"),
    ).toBe(false);
  });
});

describe("the precinct check-in over HTTP (voter-list-api.md)", () => {
  const posts = (c: ReturnType<typeof fakeConsole>, url: string) =>
    c.calls.filter((x) => x.url === url);

  it("finds the name, shows the declaration with the name in capitals, and declares only once ticked", async () => {
    const { c } = setup();
    await typeDetails({
      last: "pena",
      first: "dos",
      month: "2",
      day: "2",
      year: "1991",
    });
    await screen.findByRole("heading", { name: "Your name is on the list" });
    // The name and sequence number as the console returns them.
    expect(screen.getByText("Peña, Dos Santos-Reyes")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // The plan's declaration, word for word.
    expect(
      screen.getByText(
        "I declare that I am DOS SANTOS-REYES PEÑA, the voter named on this precinct's list, and that I have not yet voted in this election.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "In a public election, voting in another person's name or voting more than once is an election offense under the Omnibus Election Code, Sec. 261(z). The penalty is one to six years of imprisonment without probation, disqualification from public office and loss of the right to vote (Sec. 264).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This is a demonstration election modelled on that rule.",
      ),
    ).toBeInTheDocument();
    const send = screen.getByRole("button", {
      name: "Send to the Electoral Board",
    });
    expect(send).toBeDisabled();
    expect(posts(c, "/api/live/checkin/declare")).toEqual([]);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "I make this declaration." }),
    );
    expect(send).toBeEnabled();
    click("Send to the Electoral Board");
    const waiting = await screen.findByRole("heading", {
      name: "Waiting for the Electoral Board",
    });
    // Announced politely.
    expect(waiting.closest('[role="status"]')).not.toBeNull();
    expect(posts(c, "/api/live/checkin/find")[0]!.body).toEqual({
      last_name: "pena",
      first_name: "dos",
      date_of_birth: "1991-02-02",
    });
    expect(posts(c, "/api/live/checkin/declare")[0]!.body).toEqual({
      last_name: "pena",
      first_name: "dos",
      date_of_birth: "1991-02-02",
      declaration: true,
    });
    expect(c.desk.state(2)).toBe("at_desk");
  });

  it("goes back from the found name with what was typed, to correct it", async () => {
    setup();
    await typeDetails();
    await screen.findByRole("heading", { name: "Your name is on the list" });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByLabelText("Last name");
    expect(screen.getByLabelText("Last name")).toHaveValue("Halimbawa");
    expect(screen.getByLabelText("Month")).toHaveValue("1");
    expect(screen.getByLabelText("Year")).toHaveValue("1990");
  });

  it("refuses with the plan's sentences: not on the list (no field named), already checked in", async () => {
    const { c } = setup();
    await typeDetails({ year: "1999" });
    expect(await screen.findByRole("alert")).toHaveTextContent(NOT_ON_LIST);
    c.desk.checkInElsewhere(1);
    await typeDetails();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This voter has already checked in. See the Electoral Board.",
      ),
    );
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
  });

  it("catches a date that is not a real date on the phone, tied to the date fields, and sends nothing", async () => {
    const { c } = setup();
    await typeDetails({ month: "2", day: "30" });
    const error = await screen.findByText(
      "Enter the date of birth as month, day and year, for example 3, 27 and 1990.",
    );
    for (const label of ["Month", "Day", "Year"]) {
      const input = screen.getByLabelText(label);
      expect(input.getAttribute("aria-describedby")).toContain(error.id);
      expect(input).toHaveAttribute("aria-invalid", "true");
    }
    expect(posts(c, "/api/live/checkin/find")).toEqual([]);
  });

  it("says the console's wait when it rate-limits the check-in", async () => {
    setup({
      checkinAnswer: () =>
        json(
          429,
          { error: "too many tries", code: "rate-limited" },
          { "Retry-After": "8" },
        ),
    });
    await typeDetails();
    expect(await screen.findByRole("alert")).toHaveTextContent(rateLimited(8));
  });

  it("refused at the desk: says so, then the check-in again with nothing kept", async () => {
    const { c } = setup();
    await typeDetails();
    await declareAtDesk();
    c.desk.refuse();
    expect(
      await screen.findByRole("heading", { name: REFUSED_AT_DESK }),
    ).toBeInTheDocument();
    click("Check in again");
    await screen.findByLabelText("Last name");
    expect(screen.getByLabelText("Last name")).toHaveValue("");
    // The poll keeps answering `refused` for the old cookie; the form stays.
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    // The real voter, or the same one, can check in again from here.
    await typeDetails();
    await declareAtDesk();
    expect(c.desk.state(1)).toBe("at_desk");
  });

  it("reset by the presenter while signing: back to the check-in, with the Board's sentence", async () => {
    const { c } = setup();
    await typeDetails();
    await declareAtDesk();
    c.desk.approve();
    await screen.findByRole("heading", { name: "Sign the election-day list" });
    c.desk.reset();
    expect(await screen.findByText(CHECKIN_RESET)).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toHaveValue("");
  });

  it("signs the list with a drawing: integer strokes in the 1000 x 400 box, then the credential and the ballot", async () => {
    const { c } = setup();
    await typeDetails();
    await declareAtDesk();
    c.desk.approve();
    const box = await screen.findByRole(
      "img",
      { name: /Signature box/ },
      { timeout: 3000 },
    );
    box.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 500, height: 200 }) as DOMRect;
    const at = (x: number, y: number) => ({
      clientX: x,
      clientY: y,
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
    });
    fireEvent.pointerDown(box, at(50, 100));
    fireEvent.pointerMove(box, at(150, 50));
    fireEvent.pointerMove(box, at(250, 150));
    fireEvent.pointerUp(box, at(250, 150));
    click("Sign the list");
    await screen.findByRole(
      "heading",
      { name: "president" },
      { timeout: 5000 },
    );
    expect(c.desk.signature(1)).toEqual({
      strokes: [
        [
          [100, 200],
          [300, 100],
          [500, 300],
        ],
      ],
    });
    // The drawing went once, as numbers, and is no longer on the page.
    expect(posts(c, "/api/live/checkin/sign")).toHaveLength(1);
    expect(screen.queryByRole("img", { name: /Signature box/ })).toBeNull();
  });

  describe("a reload lands on the screen the check-in calls for", () => {
    for (const [state, heading] of [
      ["at_desk", "Waiting for the Electoral Board"],
      ["approved", "Sign the election-day list"],
    ] as const) {
      it(`${state}: ${heading}`, async () => {
        setup({ checkin: { seq: 3, state } });
        expect(
          await screen.findByRole("heading", { name: heading }),
        ).toBeInTheDocument();
        expect(screen.getByText("Sampol, Tres")).toBeInTheDocument();
      });
    }

    it("signed: the credential step", async () => {
      setup({ checkin: { seq: 1, state: "signed" } }, { credential: false });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        ALREADY_ISSUED,
      );
      expect(
        screen.getByRole("heading", { name: "Get your voting credential" }),
      ).toBeInTheDocument();
    });

    it("credential issued and on this phone: the ballot; after voting: the receipt", async () => {
      const { c, store } = setup({ checkin: { seq: 1, state: "signed" } });
      await chooseAndEncrypt();
      expectCodes(c);
      click("Submit");
      await screen.findByRole(
        "heading",
        { name: "Ballot recorded" },
        { timeout: 5000 },
      );
      cleanup();
      mount(c, store);
      expect(
        await screen.findByRole("heading", { name: "Ballot recorded" }),
      ).toBeInTheDocument();
    });

    it("refused: the Board's sentence", async () => {
      const { c, store } = setup({ checkin: { seq: 1, state: "at_desk" } });
      await screen.findByRole("heading", {
        name: "Waiting for the Electoral Board",
      });
      c.desk.refuse();
      cleanup();
      mount(c, store);
      expect(
        await screen.findByRole("heading", { name: REFUSED_AT_DESK }),
      ).toBeInTheDocument();
    });

    it("an election with no voter list: its own screen, no form", async () => {
      setup({ voterList: false });
      expect(
        await screen.findByRole("heading", {
          name: "Check-in is not possible",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "This election has no voter list, so no phone can check in. See the Electoral Board.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Last name")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Check now" })).toBeEnabled();
    });

    it("no election yet: the waiting screen", async () => {
      setup({ noElection: true });
      expect(
        await screen.findByRole("heading", {
          name: "Voting has not opened yet",
        }),
      ).toBeInTheDocument();
    });
  });

  it("never writes the date of birth or the name to this phone's storage", async () => {
    const c = fakeConsole({});
    const raw = indexedDbStore(`vote-http-${n++}`, new IDBFactory());
    const writes: string[] = [];
    const store: ReturnType<typeof indexedDbStore> = {
      ...raw,
      async set(key, value) {
        writes.push(key + JSON.stringify(value));
        return raw.set(key, value);
      },
    };
    mount(c, store);
    await checkIn(c);
    await chooseAndEncrypt();
    expectCodes(c);
    click("Submit");
    await screen.findByRole(
      "heading",
      { name: "Ballot recorded" },
      { timeout: 5000 },
    );
    expect(writes.length).toBeGreaterThan(0);
    const all = [
      ...writes,
      JSON.stringify({ ...localStorage }),
      JSON.stringify({ ...sessionStorage }),
    ].join("\n");
    for (const personal of ["1990-01-01", "Halimbawa", "Uno"]) {
      expect(all).not.toContain(personal);
    }
  });
});
