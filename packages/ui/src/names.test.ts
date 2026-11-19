import { describe, expect, it } from "vitest";
import { idToName } from "./index.js";

describe("idToName (D19): each hyphen becomes a space, nothing else", () => {
  it.each([
    ["Maria-Santos", "Maria Santos"],
    ["Juan-P.-Dela-Cruz", "Juan P. Dela Cruz"],
    ["vice-president", "vice president"],
    ["A--B", "A  B"],
    ["-lead-and-trail-", " lead and trail "],
    ["Penaflor", "Penaflor"],
    ["snake_case_2026", "snake_case_2026"],
    ["MiXeD-cAsE.v2", "MiXeD cAsE.v2"],
    ["", ""],
  ])("%j reads %j", (id, shown) => {
    expect(idToName(id)).toBe(shown);
  });

  it("keeps the length: one character out for each character in", () => {
    const id = "Chairperson-of-the-Committee-on-Rules";
    expect(idToName(id)).toHaveLength(id.length);
  });
});
