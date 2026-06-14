import { describe, it, expect } from "vitest";
import {
  canonicalResultsJson,
  resultsFingerprint,
  type RaceResult,
} from "./tally";

/**
 * Cross-language fingerprint fixture.
 * The Rust counterpart in `apps/auditor/src-tauri/src/balota.rs` and
 * `crates/bulletin-store::results_fingerprint` produce the exact same string
 * for the same logical input. Any change here must be mirrored there.
 */
const CROSS_LANG_FIXTURE: Record<string, RaceResult> = {
  // Insertion order intentionally reversed to prove sorting works.
  vp: {
    candidates: [
      { id: "b", name: "Bob", party: "Liberal", votes: 5, elected: false },
    ],
  },
  president: {
    candidates: [
      { id: "a", name: "Alice", party: "Lakas", votes: 10, elected: true },
    ],
  },
};

const CROSS_LANG_CANONICAL_JSON =
  '{"president":{"candidates":[{"id":"a","name":"Alice","party":"Lakas","votes":10,"elected":true}]},"vp":{"candidates":[{"id":"b","name":"Bob","party":"Liberal","votes":5,"elected":false}]}}';

const CROSS_LANG_FINGERPRINT =
  "sha256:06da800e0783cc671ea02ba669728085a430a1a22c1956363293bfd746510682";

describe("canonicalResultsJson", () => {
  it("sorts top-level race keys alphabetically", () => {
    const json = canonicalResultsJson(CROSS_LANG_FIXTURE);
    expect(json).toBe(CROSS_LANG_CANONICAL_JSON);
  });

  it("emits candidate fields in Rust struct declaration order", () => {
    const json = canonicalResultsJson({
      x: {
        candidates: [
          { id: "z", name: "Z", party: "P", votes: 1, elected: false },
        ],
      },
    });
    // Fields must appear in: id, name, party, votes, elected
    expect(json).toBe(
      '{"x":{"candidates":[{"id":"z","name":"Z","party":"P","votes":1,"elected":false}]}}',
    );
  });

  it("emits no whitespace", () => {
    const json = canonicalResultsJson(CROSS_LANG_FIXTURE);
    expect(json).not.toMatch(/\s/);
  });
});

describe("resultsFingerprint", () => {
  it("matches the Rust fingerprint byte-for-byte for the cross-language fixture", async () => {
    const fp = await resultsFingerprint(CROSS_LANG_FIXTURE);
    expect(fp).toBe(CROSS_LANG_FINGERPRINT);
  });

  it("returns the same fingerprint regardless of input key order", async () => {
    const fpA = await resultsFingerprint({
      vp: CROSS_LANG_FIXTURE.vp,
      president: CROSS_LANG_FIXTURE.president,
    });
    const fpB = await resultsFingerprint({
      president: CROSS_LANG_FIXTURE.president,
      vp: CROSS_LANG_FIXTURE.vp,
    });
    expect(fpA).toBe(fpB);
  });

  it("returns a different fingerprint when votes change", async () => {
    const fpA = await resultsFingerprint(CROSS_LANG_FIXTURE);
    const fpB = await resultsFingerprint({
      ...CROSS_LANG_FIXTURE,
      president: {
        candidates: [
          { id: "a", name: "Alice", party: "Lakas", votes: 11, elected: true },
        ],
      },
    });
    expect(fpA).not.toBe(fpB);
  });

  it("is prefixed with sha256:", async () => {
    const fp = await resultsFingerprint(CROSS_LANG_FIXTURE);
    expect(fp.startsWith("sha256:")).toBe(true);
  });
});
