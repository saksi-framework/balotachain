import type { ChallengeResult, EncryptedBallot } from "./live";

/**
 * Why one position passed or failed the Benaloh check. The screens decide
 * this, not the client: they compare what the check found in the opened
 * ballot with what the voter chose and was shown.
 */
export type Verdict =
  /** Rebuilds, and position, candidate and fingerprint all match. */
  | "ok"
  /** The revealed randomness does not rebuild the ballot (or it would not open). */
  | "not-rebuilt"
  /** The opened ballot is for a different position. */
  | "wrong-position"
  /** The opened ballot is not the one shown: its fingerprint differs. */
  | "wrong-ballot"
  /** The opened ballot holds a different candidate from the voter's. */
  | "not-your-choice";

/**
 * One position's verdict. `chosen` is the voter's candidate for the
 * position, `shownFingerprint` the fingerprint the phone showed for it
 * before the voter chose to challenge.
 */
export function verdict(
  r: ChallengeResult,
  chosen: string | undefined,
  shownFingerprint: string | undefined,
): Verdict {
  if (!r.matches) return "not-rebuilt";
  if (r.checkedPositionId !== r.positionId) return "wrong-position";
  if (shownFingerprint === undefined || r.fingerprint !== shownFingerprint) {
    return "wrong-ballot";
  }
  if (r.candidateId === null || r.candidateId !== chosen) {
    return "not-your-choice";
  }
  return "ok";
}

/** Every position shown was checked once, and every one passed. */
export function checkPassed(
  results: ChallengeResult[],
  shown: EncryptedBallot,
  choices: Record<string, string>,
): boolean {
  if (results.length !== shown.positions.length) return false;
  return shown.positions.every((sp) => {
    const mine = results.filter((r) => r.positionId === sp.positionId);
    return (
      mine.length === 1 &&
      verdict(mine[0]!, choices[sp.positionId], sp.fingerprint) === "ok"
    );
  });
}
