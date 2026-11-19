import type { ListEntry } from "./live";

/**
 * The precinct check-in's sentences and rules, in one place for the
 * screens, the HTTP transport and the mock (saksi docs/live/voter-list-api.md;
 * the sentences are the plan's, docs/plans/2026-11-15-voter-list-checkin-plan.md,
 * "What each screen shows").
 */

/** 404 `not-on-list`: the same sentence whichever field was wrong. */
export const NOT_ON_LIST =
  "No voter with these details is on this precinct's list. Check the spelling or see the Electoral Board.";

/** 409 `already-checked-in`. */
export const ALREADY_CHECKED_IN =
  "This voter has already checked in. See the Electoral Board.";

/** The date fields do not make a real date (or the console said `bad-date`). */
export const BAD_DATE =
  "Enter the date of birth as month, day and year, for example 3, 27 and 1990.";

/** 400 `bad-request`: a name over the console's length. */
export const NAME_TOO_LONG =
  "A name is longer than any name on the list. Check what you typed.";

/** 409 `checkin-in-progress`: this phone already holds a check-in. */
export const CHECKIN_IN_PROGRESS =
  "This phone already has a check-in in progress. Reload this page to continue it.";

/** The Electoral Board refused at the desk (poll answer `refused`). */
export const REFUSED_AT_DESK =
  "The Electoral Board did not confirm your identity.";

/** The presenter reset the check-in (poll answer `reset`). */
export const CHECKIN_RESET =
  "The Electoral Board cleared this check-in. Check in again.";

/** 409 `no-voter-list`. */
export const NO_VOTER_LIST =
  "This election has no voter list, so no phone can check in. See the Electoral Board.";

/** 403 `no-checkin` on a phone route: the check-in ended or was lost. */
export const CHECKIN_ENDED =
  "This phone's check-in has ended. Check in again, or see the Electoral Board.";

/** 400 `bad-signature`. */
export const BAD_SIGNATURE =
  "The election server did not accept this signature. Clear it and sign again.";

/** 429 on find or declare, with the wait the console states when it states one. */
export function rateLimited(seconds: number | null): string {
  return seconds === null
    ? "Too many check-in tries from this connection. Wait a moment, then try again."
    : `Too many check-in tries from this connection. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
}

/** "Sampol, Tres Santos": the entry as the list prints it. */
export function listName(e: ListEntry): string {
  const given = e.middleName ? `${e.firstName} ${e.middleName}` : e.firstName;
  return `${e.lastName}, ${given}`;
}

/** "TRES SANTOS SAMPOL": the name the declaration states, in capitals. */
export function declaredName(e: ListEntry): string {
  return [e.firstName, e.middleName, e.lastName]
    .filter((p) => p !== "")
    .join(" ")
    .toUpperCase();
}

/**
 * The three date fields as `YYYY-MM-DD`, or null when they do not make a
 * real calendar date from 1900 on, not after today. The console checks again
 * (`bad-date`, and the list's own rule); this only catches a slip before
 * spending one of the phone's tries.
 */
export function dateOfBirth(
  month: string,
  day: string,
  year: string,
  today: Date = new Date(),
): string | null {
  const m = month.trim();
  const d = day.trim();
  const y = year.trim();
  if (!/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d) || !/^\d{4}$/.test(y)) {
    return null;
  }
  const mm = Number(m);
  const dd = Number(d);
  const yy = Number(y);
  if (yy < 1900 || mm < 1 || mm > 12 || dd < 1) return null;
  const days = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (dd > days) return null;
  const iso = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  // Not after today anywhere on earth (the console's own rule: now + 14 h).
  const latest = new Date(today.getTime() + 14 * 3600_000)
    .toISOString()
    .slice(0, 10);
  return iso > latest ? null : iso;
}

/** The signature box the console takes (voter-list-api.md, "The signature"). */
export const SIGNATURE_BOX = { width: 1000, height: 400 } as const;
export const SIGNATURE_CAPS = {
  strokes: 64,
  pointsPerStroke: 1000,
  points: 4000,
} as const;

/** The drawing went past the caps: the page will not send it. */
export const SIGNATURE_TOO_LONG =
  "This signature is too long to send: clear it and sign again with fewer strokes.";

/** Points closer than this (in box units) to the last one add nothing. */
export const SIGNATURE_MIN_STEP = 3;
