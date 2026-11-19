import { describe, it, expect } from "vitest";
import {
  closeConsequence,
  flipNullifierByte,
  formErrors,
  hexToBytes,
  nameError,
  nameToId,
  nowRows,
  nullifierByteOffset,
  phaseOf,
  requestOf,
  stepOf,
  tabTitle,
  trackerFor,
  trusteeAddresses,
  voterAddress,
  type ElectionForm,
} from "./model";
import type { LiveElectionView } from "./types";
import { answer, view } from "../test/liveFetch";

const v = (name: string) => view(name).body as LiveElectionView;

const form = (over: Partial<ElectionForm> = {}): ElectionForm => ({
  title: "Student council",
  positions: [
    { name: "President", candidates: ["Maria Santos", "Jose Rizal"] },
  ],
  ...over,
});

describe("ids from typed names (D19)", () => {
  it("trims and turns each run of spaces into one hyphen; a typed hyphen stays", () => {
    expect(nameToId("  Maria   Santos ")).toBe("Maria-Santos");
    expect(nameToId("Juan P. Dela Cruz")).toBe("Juan-P.-Dela-Cruz");
    expect(nameToId("Anne-Marie Cruz")).toBe("Anne-Marie-Cruz");
    expect(nameToId("vice_president 2")).toBe("vice_president-2");
  });

  it("refuses a character outside the set, with the reason and an example", () => {
    expect(nameError("Peñaflor")).toBe(
      "Letters, digits, dot and space only. Type 'Penaflor'.",
    );
    expect(nameError("O'Brien")).toBe(
      "Letters, digits, dot and space only. Type 'OBrien'.",
    );
    expect(nameError("Cruz, Juan")).toMatch(
      /^Letters, digits, dot and space only\./,
    );
    expect(nameError("   ")).toBe("Type a name.");
    expect(nameError("Maria Santos")).toBeNull();
  });

  it("refuses an id over 64 bytes", () => {
    expect(nameError("a".repeat(64))).toBeNull();
    expect(nameError("a".repeat(65))).toBe(
      "At most 64 characters on chain; this one is 65.",
    );
  });

  it("refuses a position and candidate pair over 126 bytes", () => {
    const pos = "P".repeat(63);
    const ok = form({
      positions: [{ name: pos, candidates: ["C".repeat(63)] }],
    });
    expect(formErrors(ok)).toEqual({});
    const over = form({
      positions: [{ name: pos, candidates: ["C".repeat(64)] }],
    });
    expect(formErrors(over).p0c0).toBe(
      "The position and candidate together are at most 126 characters on chain; these are 127. Shorten one.",
    );
  });

  it("refuses positions, or candidates in one position, equal without case", () => {
    const f = form({
      positions: [
        { name: "President", candidates: ["Maria Santos", "maria  santos"] },
        { name: "PRESIDENT", candidates: ["Ana"] },
        { name: "Secretary", candidates: ["Maria Santos"] },
      ],
    });
    const e = formErrors(f);
    expect(e.p0c1).toBe(
      "The same id as 'Maria Santos' in this position when capitals are ignored. Use another name.",
    );
    expect(e.p1).toBe(
      "The same id as the position 'President' when capitals are ignored. Use another name.",
    );
    // The same name in another position is fine.
    expect(e.p2c0).toBeUndefined();
  });

  it("checks the title: 1 to 200 bytes after trimming", () => {
    expect(formErrors(form({ title: "  " })).title).toBe(
      "Type the election's title.",
    );
    expect(formErrors(form({ title: "x".repeat(201) })).title).toBe(
      "At most 200 bytes; this one is 201.",
    );
  });

  it("builds exactly the body the console decodes", () => {
    const body = requestOf(
      form({
        title: "  Student council ",
        positions: [
          {
            name: "Vice President",
            candidates: ["Juan P. Dela Cruz", "Bea  Tan"],
          },
        ],
      }),
    );
    expect(JSON.stringify(body)).toBe(
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
      }),
    );
  });
});

describe("state to step", () => {
  it("maps every state", () => {
    const cases: [LiveElectionView | null, string, number, string][] = [
      [null, "none", 1, "Setup"],
      [v("setup"), "unrecorded", 1, "Setup"],
      [v("ceremony-0"), "created", 2, "Key ceremony"],
      [v("ceremony-3"), "ceremony", 2, "Key ceremony"],
      [v("ceremony-5"), "ceremony", 2, "Key ceremony"],
      [v("ceremony-nocount"), "ceremony", 2, "Key ceremony"],
      [v("open-0"), "open", 3, "Voting"],
      [v("closed-0"), "closed", 4, "Decrypt"],
      [v("tallied"), "tallied", 5, "Result"],
      [v("tallied-fail"), "tallied", 5, "Result"],
      [v("verified-console"), "verified", 5, "Result"],
    ];
    for (const [view, phase, step, word] of cases) {
      expect(phaseOf(view)).toBe(phase);
      expect(stepOf(phaseOf(view))).toBe(step);
      expect(trackerFor(view).current).toBe(step);
      expect(trackerFor(view).word).toBe(word);
    }
    // Verified from the chain: every step done.
    expect(phaseOf(v("verified"))).toBe("verified");
    expect(trackerFor(v("verified")).current).toBe(6);
    expect(trackerFor(v("verified")).steps[4]?.status).toBe("verified");
    // Abandoned: no current step, said in the words.
    const ab = trackerFor(v("abandoned"));
    expect(phaseOf(v("abandoned"))).toBe("abandoned");
    expect(ab.current).toBe(0);
    expect(ab.word).toBe("Abandoned");
    expect(ab.steps.map((s) => s.status)).toEqual([
      "abandoned",
      "not run",
      "not run",
      "not run",
      "not run",
    ]);
    // A state this page does not know.
    expect(phaseOf({ ...v("open-0"), state: "paused" })).toBe("unknown");
  });

  it("titles the tab with the step", () => {
    expect(tabTitle(trackerFor(v("open-0")).word)).toBe(
      "Presenter Voting - BalotaChain",
    );
    expect(tabTitle(trackerFor(null).word)).toBe(
      "Presenter Setup - BalotaChain",
    );
  });
});

/** A view with its counts replaced (2 positions in every fixture). */
function withCounts(
  name: string,
  counts: Partial<NonNullable<LiveElectionView["counts"]>>,
): LiveElectionView {
  const base = v(name);
  return { ...base, counts: { ...base.counts!, ...counts } };
}

describe("the Close voting confirm", () => {
  it("speaks of ballot records, and of whole ballots only as a conditional", () => {
    expect(closeConsequence(v("open-one"))).toEqual([
      "3 voters on the list: 3 checked in, 3 with a credential.",
      "2 of 6 expected ballot records have not arrived.",
      "That is 1 whole ballot if every voter sent a whole ballot.",
      "This cannot be undone.",
    ]);
    expect(closeConsequence(v("open-0"))).toEqual([
      "3 voters on the list: 2 checked in, 2 with a credential.",
      "4 of 4 expected ballot records have not arrived.",
      "That is 2 whole ballots if every voter sent a whole ballot.",
      "This cannot be undone.",
    ]);
  });

  it("names no whole ballots when the missing records do not divide", () => {
    expect(closeConsequence(v("open-some"))).toEqual([
      "3 credentials issued for 3 voters.",
      "3 of 6 expected ballot records have not arrived.",
      "This cannot be undone.",
    ]);
  });

  it("says when nothing is missing", () => {
    expect(closeConsequence(v("open-all"))).toEqual([
      "3 credentials issued for 3 voters.",
      "All 6 expected ballot records have arrived.",
      "This cannot be undone.",
    ]);
  });

  it("says when no credential has been issued", () => {
    expect(
      closeConsequence(
        withCounts("open-0", { credentials_issued: 0, checked_in: 0 }),
      ),
    ).toEqual([
      "No credential has been issued, so no ballot has been cast.",
      "This cannot be undone.",
    ]);
  });

  it("says who is still at the desk or waiting for a credential, from the list's counts", () => {
    expect(
      closeConsequence(v("open-one"), {
        at_desk: 1,
        approved: 1,
        signed: 2,
      }),
    ).toEqual([
      "3 voters on the list: 3 checked in, 3 with a credential.",
      "1 voter is at the desk, waiting for the Electoral Board.",
      "1 voter is approved and has not signed yet.",
      "2 voters signed the list and have no credential yet.",
      "2 of 6 expected ballot records have not arrived.",
      "That is 1 whole ballot if every voter sent a whole ballot.",
      "This cannot be undone.",
    ]);
    expect(
      closeConsequence(
        withCounts("open-0", { credentials_issued: 0, checked_in: 0 }),
        { at_desk: 2, approved: 0, signed: 0 },
      ),
    ).toEqual([
      "No credential has been issued, so no ballot has been cast.",
      "2 voters are at the desk, waiting for the Electoral Board.",
      "This cannot be undone.",
    ]);
  });

  it("never speaks of accounts or enrolment", () => {
    for (const name of ["open-0", "open-one", "open-some", "open-all"]) {
      const text = [
        ...closeConsequence(v(name)),
        ...closeConsequence(withCounts(name, { credentials_issued: 0 })),
        ...closeConsequence(withCounts(name, { credentials_issued: 9 })),
      ].join(" ");
      expect(text).not.toMatch(/account|enrol|roll/i);
    }
  });

  it("says more records than expected, never clamping it away", () => {
    expect(
      closeConsequence(withCounts("open-all", { ballot_records: 7 })),
    ).toEqual([
      "The console counts 7 ballot records where 6 are expected. Look into this before closing.",
      "This cannot be undone.",
    ]);
    // Records with nobody enrolled is the same anomaly.
    expect(
      closeConsequence(
        withCounts("open-0", { credentials_issued: 0, ballot_records: 2 }),
      ),
    ).toEqual([
      "The console counts 2 ballot records where 0 are expected. Look into this before closing.",
      "This cannot be undone.",
    ]);
  });

  it("says more credentials than voters", () => {
    expect(
      closeConsequence(
        withCounts("open-all", { credentials_issued: 4, ballot_records: 8 }),
      ),
    ).toEqual([
      "The console counts 4 credentials issued for 3 voters. Look into this before closing.",
      "This cannot be undone.",
    ]);
  });

  it("marks a count that is not from the chain", () => {
    expect(closeConsequence(v("open-console"))).toEqual([
      "3 credentials issued for 3 voters.",
      "2 of 6 expected ballot records have not arrived (from the console's record).",
      "That is 1 whole ballot if every voter sent a whole ballot.",
      "This cannot be undone.",
    ]);
  });

  it("never invents a zero when the counts are missing", () => {
    const rest: LiveElectionView = { ...v("open-all") };
    delete rest.counts;
    expect(closeConsequence(rest)).toEqual([
      "The console sent no counts, so this page cannot say who has not voted.",
      "This cannot be undone.",
    ]);
  });
});

describe("the Now rows", () => {
  it("shows ballot records as X of Y expected, divisible or not", () => {
    expect(nowRows(v("open-one")).map((r) => [r.label, r.value])).toEqual([
      ["Voters on the list", "3"],
      ["Checked in", "3 of 3"],
      ["Credentials issued", "3"],
      ["Ballot records", "4 of 6 expected"],
      ["Trustees joined", "5 of 5"],
    ]);
    expect(
      nowRows(v("open-some")).find((r) => r.key === "records")?.value,
    ).toBe("3 of 6 expected");
    expect(nowRows(v("open-one")).some((r) => /Ballots/.test(r.label))).toBe(
      false,
    );
  });

  it("with no credential issued, says so instead of 0 of 0 expected", () => {
    const row = nowRows(
      withCounts("open-0", {
        checked_in: 0,
        credentials_issued: 0,
        ballot_records: 0,
      }),
    ).find((r) => r.key === "records");
    expect(row?.value).toBe("0");
    expect(row?.note).toBe(
      "No credential has been issued yet, so no ballot can be cast.",
    );
  });

  it("after voting, with no credential issued, never says yet", () => {
    for (const name of ["closed-0", "tallied", "verified"]) {
      const row = nowRows(
        withCounts(name, {
          checked_in: 0,
          credentials_issued: 0,
          ballot_records: 0,
        }),
      ).find((r) => r.key === "records");
      expect(row?.value).toBe("0");
      expect(row?.note).toBe(
        "No credential was issued in this election, so no ballot was cast.",
      );
    }
  });

  it("shows the plain numbers when the records are above the expected", () => {
    expect(
      nowRows(withCounts("open-all", { ballot_records: 7 })).find(
        (r) => r.key === "records",
      )?.value,
    ).toBe("7 of 6 expected");
  });

  it("shows X alone when Y cannot be computed", () => {
    const noPositions = { ...v("open-one"), positions: [] };
    expect(nowRows(noPositions).find((r) => r.key === "records")?.value).toBe(
      "4",
    );
  });

  it("says when the count is from the console", () => {
    const rows = nowRows(v("open-console"));
    expect(rows.find((r) => r.key === "records")?.note).toBe(
      "From the console's record, the chain did not answer.",
    );
  });

  it("leaves out the joined row without the field, and counts before voting", () => {
    expect(nowRows(v("ceremony-nocount")).map((r) => r.label)).toEqual([
      "Voters",
      "Credentials issued",
    ]);
    expect(nowRows(v("setup")).map((r) => r.label)).toEqual([
      "Voters",
      "Credentials issued",
      "Trustees joined",
    ]);
  });

  it("an election without a list: neutral counts, no accounts or enrolment", () => {
    const rows = nowRows(v("open-some"));
    expect(rows.map((r) => [r.label, r.value]).slice(0, 2)).toEqual([
      ["Voters", "3"],
      ["Credentials issued", "3"],
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/account|enrol/i);
  });
});

describe("links", () => {
  it("writes the voter address in full and derives trustee pages on vote. hosts", () => {
    expect(voterAddress("https://vote.vancornelio.dev:8443")).toBe(
      "https://vote.vancornelio.dev:8443/vote/",
    );
    expect(trusteeAddresses("https:", "vote.vancornelio.dev", 5)).toEqual([
      "https://t1.vancornelio.dev:9001/trustee/",
      "https://t2.vancornelio.dev:9002/trustee/",
      "https://t3.vancornelio.dev:9003/trustee/",
      "https://t4.vancornelio.dev:9004/trustee/",
      "https://t5.vancornelio.dev:9005/trustee/",
    ]);
    expect(trusteeAddresses("http:", "127.0.0.1", 5)).toEqual([]);
  });
});

describe("one changed byte", () => {
  it("flips the last byte of the nullifier value and nothing else", () => {
    const ledger = answer("ledger").body as {
      ballots: { ballot: string; nullifier: string }[];
    };
    const { ballot, nullifier } = ledger.ballots[0]!;
    const before = hexToBytes(ballot)!;
    const offset = nullifierByteOffset(before)!;
    // The 32 bytes ending at the offset are the nullifier the chain lists.
    const value = Array.from(before.slice(offset - 31, offset + 1), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    expect(value).toBe(nullifier);
    const flipped = flipNullifierByte(ballot)!;
    expect(flipped.offset).toBe(offset);
    const after = hexToBytes(flipped.hex)!;
    const diff = Array.from(after).flatMap((b, i) =>
      b !== before[i] ? [i] : [],
    );
    expect(diff).toEqual([offset]);
    expect(after[offset]).toBe(before[offset]! ^ 0x01);
  });

  it("walks lengths of 128 bytes and more (two- and three-byte varints)", () => {
    const varint = (n: number) => {
      const out: number[] = [];
      while (n > 0x7f) {
        out.push((n & 0x7f) | 0x80);
        n >>>= 7;
      }
      out.push(n);
      return out;
    };
    const field = (f: number, b: number[]) => [
      ...varint((f << 3) | 2),
      ...varint(b.length),
      ...b,
    ];
    const fill = (n: number, x: number) => Array<number>(n).fill(x);
    const value = Array.from({ length: 32 }, (_, i) => i);
    // An unknown 300-byte field before the value makes the Nullifier
    // message itself longer than 127 bytes; a 20000-byte proof makes the
    // presentation's length a three-byte varint.
    const nullifier = [
      0x08,
      0x01,
      ...field(9, fill(300, 0xee)),
      ...field(2, value),
    ];
    const presentation = [
      0x08,
      0x01,
      ...field(4, fill(20000, 0xaa)),
      ...field(5, nullifier),
    ];
    const ballot = [
      0x08,
      0x01,
      ...field(5, fill(200, 0xbb)),
      ...field(6, presentation),
      ...field(7, [0x50]),
    ];
    expect(varint(nullifier.length).length).toBe(2);
    expect(varint(presentation.length).length).toBe(3);
    const bytes = new Uint8Array(ballot);
    const offset = nullifierByteOffset(bytes)!;
    expect(bytes[offset]).toBe(31);
    expect(Array.from(bytes.slice(offset - 31, offset + 1))).toEqual(value);
  });

  it("refuses a record that does not decode that far", () => {
    expect(flipNullifierByte("0801")).toBeNull();
    expect(flipNullifierByte("zz")).toBeNull();
  });
});
