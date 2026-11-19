import type { ReactNode } from "react";
import { Chip, CheckIcon, AlertIcon, idToName, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Emblem,
  Label,
  Lead,
  Notice,
  Screen,
  SecondaryAction,
} from "../components/Layout";
import { useConfirmStep } from "../components/useConfirmStep";
import { checkPassed, verdict, type Verdict } from "../lib/benaloh";
import type { ChallengeResult, EncryptedBallot, Position } from "../lib/live";

export { verdict };

const CHIP: Record<Exclude<Verdict, "ok">, string> = {
  "not-rebuilt": "Does not rebuild",
  "wrong-position": "Wrong position",
  "wrong-ballot": "Different ballot",
  "not-your-choice": "Not your choice",
};

const STOP =
  " Do not vote on this phone. Show this screen to an election officer.";

/** The failure the lead names when several are present, worst first. */
const FAILURES: [Exclude<Verdict, "ok">, string][] = [
  [
    "not-rebuilt",
    "At least one position did not rebuild from its revealed randomness.",
  ],
  [
    "wrong-position",
    "The phone opened a ballot for a different position from the one you were voting in.",
  ],
  [
    "wrong-ballot",
    "The ballot the phone opened is not the one it showed you: its fingerprint is different.",
  ],
  [
    "not-your-choice",
    "This phone encrypted a different candidate from the one you chose.",
  ],
];

function Mono({ children, bad }: { children: ReactNode; bad?: boolean }) {
  return (
    <code
      className="bc-mono"
      style={{
        display: "block",
        fontSize: tokens.font.small,
        overflowWrap: "anywhere",
        color: bad ? tokens.color.error : tokens.color.text1,
        fontWeight: bad ? 600 : undefined,
      }}
    >
      {children}
    </code>
  );
}

/** Shown with any passed check once a check has failed on this phone. */
export const EARLIER_FAILED =
  "An earlier check on this phone failed, and a later pass does not undo that.";

export function Challenge({
  positions,
  results,
  shown,
  choices,
  fresh,
  checkFailedHere = false,
  busy,
  error,
  onContinue,
}: {
  positions: Position[];
  results: ChallengeResult[];
  /** The ballot as the phone showed it before the challenge. */
  shown: EncryptedBallot;
  /** The voter's own picks, positionId -> candidateId. */
  choices: Record<string, string>;
  /** A fresh ballot is already built and waiting. */
  fresh: boolean;
  /** A check failed on this phone for this election (now or earlier). */
  checkFailedHere?: boolean;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const shownFp = (positionId: string) =>
    shown.positions.find((p) => p.positionId === positionId)?.fingerprint;
  const verdicts = results.map((r) =>
    verdict(r, choices[r.positionId], shownFp(r.positionId)),
  );
  const passed = checkPassed(results, shown, choices);
  // D12: after a failed check, "Encrypt again anyway" asks twice, as
  // "Submit anyway…" does on the encrypted ballot.
  const { confirming, ready, region, ask } = useConfirmStep();
  const failure =
    FAILURES.find(([v]) => verdicts.includes(v))?.[1] ??
    "Not every position on this ballot was checked.";
  const positionTitle = (id: string) =>
    id ? (positions.find((p) => p.id === id)?.title ?? idToName(id)) : "none";
  const name = (positionId: string, candidateId: string | null | undefined) =>
    candidateId
      ? (positions
          .find((p) => p.id === positionId)
          ?.candidates.find((k) => k.id === candidateId)?.name ??
        idToName(candidateId))
      : "nothing";

  return (
    <Screen
      title="Ballot check"
      footer={
        passed ? (
          <ActionButton
            onClick={onContinue}
            busy={busy}
            busyLabel="Encrypting…"
          >
            {fresh ? "Continue with the fresh ballot" : "Encrypt again"}
          </ActionButton>
        ) : (
          // Stays in place after the first tap: a second tap only brings the
          // confirm block back into view.
          <SecondaryAction
            onClick={ask}
            disabled={busy}
            aria-describedby="again-anyway"
            aria-expanded={confirming}
            aria-controls="confirm-again"
          >
            Encrypt again anyway
          </SecondaryAction>
        )
      }
    >
      <Emblem tone={passed ? "success" : "error"}>
        {passed ? (
          <CheckIcon size={36} strokeWidth={2.4} />
        ) : (
          <AlertIcon size={36} />
        )}
      </Emblem>
      <div role={passed ? undefined : "alert"}>
        <Lead title={passed ? "The check passed" : "The check failed"}>
          {passed
            ? "The phone opened the ballot it showed you. For every position, the revealed randomness rebuilds that exact ballot, and it holds the candidate you chose."
            : failure + STOP}
        </Lead>
      </div>
      {passed && checkFailedHere ? (
        <div style={{ marginBottom: tokens.space.md }}>
          <Notice tone="error">{EARLIER_FAILED}</Notice>
        </div>
      ) : null}

      <ul
        className="ba-list"
        aria-label="Check per position"
        style={{
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.card,
          boxShadow: tokens.shadow.card,
          marginBottom: tokens.space.md,
        }}
      >
        {results.map((r, i) => {
          const v = verdicts[i]!;
          const title = positionTitle(r.positionId);
          const chosen = choices[r.positionId];
          const before = shownFp(r.positionId);
          return (
            <li key={r.positionId} style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <Label>{title}</Label>
                {v === "ok" ? (
                  <Chip variant="success">Matches</Chip>
                ) : (
                  <Chip variant="error">{CHIP[v]}</Chip>
                )}
              </div>
              <div
                className="ba-compare"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr 1fr",
                  columnGap: 12,
                  rowGap: 4,
                  fontSize: "var(--ba-type-note)",
                  color: tokens.color.text2,
                }}
              >
                <span />
                <span style={{ fontSize: "var(--ba-type-small)" }}>
                  Opened ballot
                </span>
                <span style={{ fontSize: "var(--ba-type-small)" }}>You</span>
                <span>Position</span>
                <strong
                  style={{
                    color:
                      v === "wrong-position"
                        ? tokens.color.error
                        : tokens.color.text1,
                  }}
                >
                  {positionTitle(r.checkedPositionId)}
                </strong>
                <strong style={{ color: tokens.color.text1 }}>{title}</strong>
                <span>Choice</span>
                <strong
                  style={{
                    color:
                      v === "not-your-choice"
                        ? tokens.color.error
                        : tokens.color.text1,
                  }}
                >
                  {name(r.checkedPositionId || r.positionId, r.candidateId)}
                </strong>
                <strong style={{ color: tokens.color.text1 }}>
                  {name(r.positionId, chosen)}
                </strong>
              </div>
              <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                <div>
                  <span
                    style={{
                      fontSize: "var(--ba-type-small)",
                      color: tokens.color.text2,
                    }}
                  >
                    Fingerprint of the opened ballot
                  </span>
                  <Mono bad={v === "wrong-ballot"}>
                    {r.fingerprint || "none"}
                  </Mono>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "var(--ba-type-small)",
                      color: tokens.color.text2,
                    }}
                  >
                    Fingerprint shown before you chose
                  </span>
                  <Mono>{before ?? "none"}</Mono>
                </div>
                <div
                  style={{
                    fontSize: "var(--ba-type-small)",
                    color: tokens.color.textSubtle,
                  }}
                >
                  Tracking code{" "}
                  <span className="bc-mono">{r.trackingCode}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="ba-stack" style={{ gap: tokens.space.sm }}>
        <Notice tone="neutral">
          This ballot was opened, so this phone has thrown it away and never
          sends it.
          {passed
            ? fresh
              ? " A fresh ballot is ready. It has new fingerprints and the same tracking codes, because a tracking code marks your place for a position, not one ballot."
              : " Encrypt again to get a fresh ballot: new fingerprints, same tracking codes."
            : ""}
        </Notice>
        {!passed ? (
          <p
            id="again-anyway"
            style={{
              margin: 0,
              color: tokens.color.text2,
              fontSize: "var(--ba-type-note)",
            }}
          >
            “Encrypt again anyway” makes a new ballot on this same phone. It
            does not make the phone trustworthy.
          </p>
        ) : null}
        {!passed ? (
          <div id="confirm-again">
            {confirming ? (
              <div
                ref={region}
                role="group"
                tabIndex={-1}
                aria-labelledby="confirm-again-text"
                className="ba-stack"
                style={{ gap: tokens.space.sm, outline: "none" }}
              >
                <p
                  id="confirm-again-text"
                  style={{
                    margin: 0,
                    color: tokens.color.text1,
                    fontSize: "var(--ba-type-note)",
                  }}
                >
                  If you still want a new ballot from this phone, tap “Yes,
                  encrypt again”.
                </p>
                <ActionButton
                  onClick={() => {
                    if (ready) onContinue();
                  }}
                  disabled={!ready}
                  busy={busy}
                  busyLabel="Encrypting…"
                >
                  Yes, encrypt again
                </ActionButton>
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </Screen>
  );
}
