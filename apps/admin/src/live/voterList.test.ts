import { describe, it, expect } from "vitest";
import {
  arrivedAtDesk,
  entryName,
  errorLine,
  fileRefusal,
  leftDesk,
  mayReset,
  signaturePolylines,
  statusChip,
  statusWord,
  LIST_FILE_MAX,
  PREVIEW_BODY_MAX,
} from "./voterList";
import type { ListEntry, VoterListView } from "./types";
import { answer } from "../test/liveFetch";

const list = (name: string) => answer(name).body as VoterListView;

const entry = (over: Partial<ListEntry> = {}): ListEntry => ({
  seq: 7,
  last_name: "Sampol",
  first_name: "Tres",
  middle_name: "",
  status: "at_desk",
  ...over,
});

describe("names and statuses", () => {
  it("names an entry last name first, with the middle name when there is one", () => {
    expect(entryName(entry())).toBe("Sampol, Tres");
    expect(
      entryName(
        entry({
          last_name: "Halimbawa",
          first_name: "Uno",
          middle_name: "Pagsubok",
        }),
      ),
    ).toBe("Halimbawa, Uno Pagsubok");
  });

  it("says each state the console sends in words, and an unknown one as sent", () => {
    expect(statusWord("not_checked_in")).toBe("Not checked in");
    expect(statusWord("at_desk")).toBe("At the desk");
    expect(statusWord("approved")).toBe("Approved, waiting for the signature");
    expect(statusWord("signed")).toBe("Signed");
    expect(statusWord("credential_issued")).toBe("Credential issued");
    expect(statusWord("lost")).toBe("lost");
  });

  it("gives every state a chip with its word", () => {
    expect(statusChip("not_checked_in")).toBe("neutral");
    expect(statusChip("at_desk")).toBe("warning");
    expect(statusChip("approved")).toBe("active");
    expect(statusChip("signed")).toBe("active");
    expect(statusChip("credential_issued")).toBe("success");
    expect(statusChip("lost")).toBe("neutral");
  });

  it("offers a reset only where the console allows one", () => {
    expect(mayReset("at_desk")).toBe(true);
    expect(mayReset("approved")).toBe(true);
    expect(mayReset("signed")).toBe(true);
    expect(mayReset("not_checked_in")).toBe(false);
    expect(mayReset("credential_issued")).toBe(false);
    expect(mayReset("lost")).toBe(false);
  });
});

describe("the list file", () => {
  it("says the line of each error, line 0 being the whole file", () => {
    expect(
      errorLine({ line: 4, code: "invalid-date", message: "Not a date." }),
    ).toBe("Line 4: Not a date.");
    expect(
      errorLine({ line: 0, code: "empty", message: "The file has no rows." }),
    ).toBe("Whole file: The file has no rows.");
  });

  it("does not send a file larger than the preview's body cap", () => {
    expect(LIST_FILE_MAX).toBe(64 * 1024);
    expect(PREVIEW_BODY_MAX).toBe(192 * 1024);
    expect(fileRefusal(0)).toBe(
      "The file is empty. Choose the precinct's CSV file.",
    );
    expect(fileRefusal(1)).toBeNull();
    // Over 64 KiB but under the cap: the console's own answer says why.
    expect(fileRefusal(100 * 1024)).toBeNull();
    expect(fileRefusal(PREVIEW_BODY_MAX + 1)).toBe(
      "This file is 193 KiB. The console takes a voter list of at most 64 KiB, so the file was not sent.",
    );
  });
});

describe("signatures are drawn from numbers only", () => {
  it("turns each stroke into polyline points", () => {
    expect(
      signaturePolylines({
        strokes: [
          [
            [120, 210],
            [124, 215],
          ],
          [[400, 180]],
        ],
      }),
    ).toEqual(["120,210 124,215", "400,180 400,180"]);
  });

  it("drops every point that is not two integers inside the 1000 by 400 box", () => {
    expect(
      signaturePolylines({
        strokes: [
          [
            [1, 2],
            [1.5, 2],
            ["<svg>", 3],
            [1001, 0],
            [0, 401],
            [-1, 0],
            [3, 4, 5],
            [1000, 400],
          ],
          "<path d='M0 0'/>",
          [],
          [[NaN, 1]],
        ],
      }),
    ).toEqual(["1,2 1000,400"]);
  });

  it("is null for anything that is not a strokes list", () => {
    expect(signaturePolylines({ cannot_sign: true })).toBeNull();
    expect(signaturePolylines({ strokes: "<svg/>" })).toBeNull();
    expect(signaturePolylines(undefined)).toBeNull();
  });
});

describe("the desk between two polls", () => {
  it("names who left the desk, with their status from the newer answer", () => {
    const before = list("voter-list-desk-two");
    const after = list("voter-list-desk-one");
    const left = leftDesk(before.desk ?? [], after);
    expect(left.map((e) => [e.seq, e.status])).toEqual([[4, "approved"]]);
    expect(arrivedAtDesk(before.desk ?? [], after)).toEqual([]);
    expect(arrivedAtDesk(after.desk ?? [], before).map((e) => e.seq)).toEqual([
      4,
    ]);
  });

  it("an entry that left and is not in the newer list is still named", () => {
    const after = list("voter-list-desk-one");
    after.entries = [];
    const left = leftDesk([entry({ seq: 9 })], after);
    expect(left).toEqual([entry({ seq: 9, status: "" })]);
  });
});
