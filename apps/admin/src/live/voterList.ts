/**
 * The voter list's rules for the presenter page (docs/live/voter-list-api.md),
 * kept apart from React so each is tested on its own: names, the words for
 * each check-in state, which entries may be reset, the file size gate, the
 * signature's points, and who left or reached the desk between two polls.
 */
import type { ChipVariant } from "@balotachain/ui";
import type {
  ListEntry,
  Signature,
  VoterListError,
  VoterListView,
} from "./types";

/** The list file's own cap (the console answers `too-large` above it). */
export const LIST_FILE_MAX = 64 * 1024;
/** The preview route's body cap (413 above it). */
export const PREVIEW_BODY_MAX = 192 * 1024;

/** The signature box the phone scales its drawing to. */
export const SIGNATURE_W = 1000;
export const SIGNATURE_H = 400;

/** "Sampol, Tres" or "Halimbawa, Uno Pagsubok", as the list writes a name. */
export function entryName(e: {
  last_name: string;
  first_name: string;
  middle_name?: string;
}): string {
  const middle = e.middle_name ? ` ${e.middle_name}` : "";
  return `${e.last_name}, ${e.first_name}${middle}`;
}

const WORDS: Record<string, string> = {
  not_checked_in: "Not checked in",
  at_desk: "At the desk",
  approved: "Approved, waiting for the signature",
  signed: "Signed",
  credential_issued: "Credential issued",
};

/** The state in words; one this page does not know, as the console sent it. */
export function statusWord(status: string): string {
  return WORDS[status] ?? status;
}

export function statusChip(status: string): ChipVariant {
  switch (status) {
    case "at_desk":
      return "warning";
    case "approved":
    case "signed":
      return "active";
    case "credential_issued":
      return "success";
    default:
      return "neutral";
  }
}

/** `reset` works from `at_desk` to `signed`; never once a credential is issued. */
export function mayReset(status: string): boolean {
  return status === "at_desk" || status === "approved" || status === "signed";
}

/**
 * One error in words, with the console's CSV line. `seq` is the number of
 * the preview row on that same line, when the console sent one, so the
 * sentence names the row the table marks.
 */
export function errorLine(e: VoterListError, seq?: number): string {
  if (e.line <= 0) return `Whole file: ${e.message}`;
  return seq === undefined
    ? `Line ${e.line}: ${e.message}`
    : `Line ${e.line} (No. ${seq} in the table): ${e.message}`;
}

/**
 * The preview rows' numbers by CSV line. A row and an error belong together
 * only when the console gave both the same `line`; nothing is matched by
 * position.
 */
export function seqByLine(
  rows: { seq: number; line: number }[] | null | undefined,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of rows ?? []) if (r.line > 0) out.set(r.line, r.seq);
  return out;
}

const kib = (n: number) => Math.ceil(n / 1024);

/**
 * Why a chosen file is not sent to the preview, or null to send it. A file
 * over 64 KiB but under the body cap is sent: the console's `too-large`
 * error then says why, in its own words.
 */
export function fileRefusal(size: number): string | null {
  if (size === 0) return "The file is empty. Choose the precinct's CSV file.";
  if (size > PREVIEW_BODY_MAX)
    return `This file is ${kib(size)} KiB. The console takes a voter list of at most ${kib(LIST_FILE_MAX)} KiB, so the file was not sent.`;
  return null;
}

const isCoord = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

/**
 * The strokes as SVG polyline `points`, built from numbers only. A point that
 * is not two integers inside the box is dropped, and so is a stroke left with
 * no point; a one-point stroke is drawn as a dot. Null when the signature
 * holds no strokes list (for example "I cannot sign").
 */
export function signaturePolylines(
  sig: Signature | undefined,
): string[] | null {
  const strokes = sig?.strokes;
  if (!Array.isArray(strokes)) return null;
  const out: string[] = [];
  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) continue;
    const pts: string[] = [];
    for (const p of stroke) {
      if (
        Array.isArray(p) &&
        p.length === 2 &&
        isCoord(p[0], SIGNATURE_W) &&
        isCoord(p[1], SIGNATURE_H)
      )
        pts.push(`${p[0]},${p[1]}`);
    }
    if (pts.length === 1) pts.push(pts[0]!);
    if (pts.length > 0) out.push(pts.join(" "));
  }
  return out;
}

/**
 * The entries that were at the desk in the older answer and are not in the
 * newer one, each with its status from the newer list ("" when the newer
 * list does not hold it).
 */
export function leftDesk(
  before: ListEntry[],
  after: VoterListView,
): ListEntry[] {
  const still = new Set((after.desk ?? []).map((e) => e.seq));
  return before
    .filter((e) => !still.has(e.seq))
    .map((e) => {
      const now = (after.entries ?? []).find((x) => x.seq === e.seq);
      return now ?? { ...e, status: "" };
    });
}

/** The newer answer's desk entries that were not at the desk before. */
export function arrivedAtDesk(
  before: ListEntry[],
  after: VoterListView,
): ListEntry[] {
  const was = new Set(before.map((e) => e.seq));
  return (after.desk ?? []).filter((e) => !was.has(e.seq));
}
