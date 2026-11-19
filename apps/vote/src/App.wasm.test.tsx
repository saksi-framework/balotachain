/**
 * The screens over the real client and the real saksi WebAssembly, on the
 * committed fixture election (FixtureTransport stands in for the console).
 * The wasm bytes are read from disk and passed to `init`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import App from "./App";
import fixture from "./test/fixture/live-election.json";
import { FINGERPRINT, TRACKING_CODE } from "./lib/live";
import { FixtureTransport, localClient } from "./lib/local";
import { RealLiveClient } from "./lib/real";
import { indexedDbStore } from "./lib/storage";
import { loadVoterCrypto } from "./lib/voterCrypto";

// happy-dom gives import.meta.url an http scheme; vitest runs in apps/vote.
const WASM = resolve(
  process.cwd(),
  "../../packages/saksi-wasm/saksi_wasm_bg.wasm",
);

function values(re: RegExp): string[] {
  return Array.from(document.querySelectorAll("code"))
    .map((c) => c.textContent ?? "")
    .filter((t) => re.test(t));
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("vote app on the real wasm (fixture election)", () => {
  it("encrypts, shows fingerprints, passes a challenge with a fresh ballot, and submits it", async () => {
    const { client, transport } = localClient(
      indexedDbStore("vote-wasm-test", new IDBFactory()),
      { crypto: () => loadVoterCrypto(readFileSync(WASM)) },
    );
    render(<App client={client} mock />);

    // The local election's voter starts checked in, and the fixture
    // credential is already on the phone: straight to the ballot.
    await screen.findByRole("heading", { name: "President" });
    expect(
      screen.getByText(
        "Voting software: saksi-wasm 0.1.0 · 6d2555f · saksi-live-wire-v1",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(fixture.joint_key_fingerprint, { exact: false }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Bob/ }));
    click("Next");
    await screen.findByRole("heading", { name: "Vice President" });
    fireEvent.click(screen.getByRole("radio", { name: /Fay/ }));
    click("Review");
    await screen.findByRole("heading", { name: "Review your ballot" });

    click("Encrypt my ballot");
    await screen.findByRole("heading", { name: "Your ballot is encrypted" });
    const codes = values(TRACKING_CODE);
    const shown = values(FINGERPRINT);
    expect(codes).toHaveLength(2);
    expect(shown).toHaveLength(2);

    click("Challenge this ballot");
    await screen.findByRole("heading", { name: "The check passed" });
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]!).getAllByText("Bob")).toHaveLength(2);
    expect(within(rows[1]!).getAllByText("Fay")).toHaveLength(2);
    expect(within(rows[0]!).getAllByText(shown[0]!)).toHaveLength(2);
    expect(within(rows[1]!).getAllByText(shown[1]!)).toHaveLength(2);

    click("Continue with the fresh ballot");
    await screen.findByRole("heading", { name: "Your ballot is encrypted" });
    expect(values(TRACKING_CODE)).toEqual(codes);
    const fresh = values(FINGERPRINT);
    expect(fresh).toHaveLength(2);
    expect(fresh[0]).not.toBe(shown[0]);
    expect(fresh[1]).not.toBe(shown[1]);

    click("Submit");
    await screen.findByRole(
      "heading",
      { name: "Ballot recorded" },
      { timeout: 5000 },
    );
    expect(values(TRACKING_CODE)).toEqual(codes);
    expect(values(FINGERPRINT)).toEqual(fresh);
    expect(transport.recorded).toHaveLength(2);
  });

  it("shows an error and stores no credential when the issuer's reply is bad", async () => {
    // The phone asks only once voting is open (D10); the client-level test
    // of issuance before the key ceremony is in real.test.ts.
    class BadIssuer extends FixtureTransport {
      // Checked in and signed: the phone asks for its credential.
      async checkin() {
        return { ...(await super.checkin())!, state: "signed" as const };
      }
      async issuePresign() {
        return { r: fixture.issuer_public_key };
      }
      async issueSign() {
        return { sIss: "01" + "00".repeat(31) };
      }
    }
    const store = indexedDbStore("vote-wasm-enrol", new IDBFactory());
    const client = new RealLiveClient({
      transport: new BadIssuer({ status: "open" }),
      store,
      crypto: () => loadVoterCrypto(readFileSync(WASM)),
    });
    render(<App client={client} mock="local" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The election authority's signature did not check out on this phone, so no credential was stored",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(await store.get("credential:checkin")).toBeUndefined();
  });
});
