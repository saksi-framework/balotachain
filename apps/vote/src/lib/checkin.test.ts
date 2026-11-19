import { describe, expect, it } from "vitest";
import {
  dateOfBirth,
  declaredName,
  listName,
  NOT_ON_LIST,
  rateLimited,
} from "./checkin";

const TODAY = new Date("2026-11-17T03:00:00Z");

describe("dateOfBirth: the three fields as YYYY-MM-DD", () => {
  it("pads month and day and keeps the year", () => {
    expect(dateOfBirth("3", "7", "1990", TODAY)).toBe("1990-03-07");
    expect(dateOfBirth("12", "31", "1999", TODAY)).toBe("1999-12-31");
    expect(dateOfBirth(" 02 ", "29", "2000", TODAY)).toBe("2000-02-29");
  });

  it("refuses what is not a real calendar date from 1900", () => {
    for (const [m, d, y] of [
      ["2", "29", "2001"],
      ["4", "31", "1990"],
      ["13", "1", "1990"],
      ["0", "1", "1990"],
      ["1", "0", "1990"],
      ["1", "1", "1899"],
      ["1", "1", "90"],
      ["1", "1", "19901"],
      ["", "1", "1990"],
      ["1", "1", "19a0"],
    ]) {
      expect(dateOfBirth(m!, d!, y!, TODAY), `${m}/${d}/${y}`).toBeNull();
    }
  });

  it("refuses a date after today anywhere on earth, as the console does", () => {
    expect(dateOfBirth("11", "17", "2026", TODAY)).toBe("2026-11-17");
    expect(dateOfBirth("11", "18", "2026", TODAY)).toBeNull();
  });
});

describe("names", () => {
  const entry = {
    seq: 2,
    lastName: "Peña",
    firstName: "Dos",
    middleName: "Santos-Reyes",
  };

  it("prints the entry as the list does, and states it in capitals", () => {
    expect(listName(entry)).toBe("Peña, Dos Santos-Reyes");
    expect(declaredName(entry)).toBe("DOS SANTOS-REYES PEÑA");
    const noMiddle = { ...entry, middleName: "" };
    expect(listName(noMiddle)).toBe("Peña, Dos");
    expect(declaredName(noMiddle)).toBe("DOS PEÑA");
  });
});

describe("sentences", () => {
  it("names no field when a voter is not found", () => {
    expect(NOT_ON_LIST).toBe(
      "No voter with these details is on this precinct's list. Check the spelling or see the Electoral Board.",
    );
    expect(NOT_ON_LIST).not.toMatch(/name|date|birth/i);
  });

  it("says the wait the console states, and only that", () => {
    expect(rateLimited(12)).toBe(
      "Too many check-in tries from this connection. Try again in 12 seconds.",
    );
    expect(rateLimited(1)).toMatch(/in 1 second\.$/);
    expect(rateLimited(null)).toBe(
      "Too many check-in tries from this connection. Wait a moment, then try again.",
    );
  });
});
