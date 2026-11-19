import { idToName, LockIcon, VerifiableValue, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Emblem,
  Lead,
  Notice,
  Screen,
  SecondaryAction,
  type Direction,
} from "../components/Layout";
import { useConfirmStep } from "../components/useConfirmStep";
import type { EncryptedBallot, Position } from "../lib/live";
import { EARLIER_FAILED } from "./Challenge";

export { CONFIRM_DELAY_MS } from "../components/useConfirmStep";

export function Encrypted({
  positions,
  ballot,
  afterChallenge = null,
  checkFailedHere = false,
  lastCheckFailed = false,
  challenging,
  error,
  direction,
  onSubmit,
  onChallenge,
  onBack,
}: {
  positions: Position[];
  ballot: EncryptedBallot;
  /**
   * This ballot replaces one just opened by a challenge, and how that check
   * ended. After a failed check, submitting needs a second, explicit tap.
   */
  afterChallenge?: "passed" | "failed" | null;
  /**
   * A check failed on this phone for this election, at any time (stored).
   * Then every encrypted ballot carries the warning and the two-step submit.
   */
  checkFailedHere?: boolean;
  /** The most recent check in this page session failed. */
  lastCheckFailed?: boolean;
  challenging: boolean;
  error: string | null;
  direction: Direction;
  onSubmit: () => void;
  onChallenge: () => void;
  onBack: () => void;
}) {
  const failed = checkFailedHere || afterChallenge === "failed";
  // The confirm block sits under the warning, which may be scrolled out of
  // view; `useConfirmStep` brings it into view and focuses it. The block
  // does not change size later (the button is rendered from the start, only
  // disabled), so it does not jump after the scroll.
  const {
    confirming,
    ready: confirmReady,
    region: confirmRegion,
    ask,
  } = useConfirmStep();
  return (
    <Screen
      title="Encrypted ballot"
      back={challenging ? undefined : onBack}
      direction={direction}
      footer={
        <>
          {!failed ? (
            <ActionButton onClick={onSubmit} disabled={challenging}>
              Submit
            </ActionButton>
          ) : (
            // Stays in place after the first tap: a second tap on it does
            // nothing. The confirm button appears elsewhere (under the warning).
            <SecondaryAction
              onClick={ask}
              disabled={challenging}
              aria-expanded={confirming}
              aria-controls="confirm-submit"
            >
              Submit anyway…
            </SecondaryAction>
          )}
          <SecondaryAction
            onClick={onChallenge}
            busy={challenging}
            busyLabel="Opening…"
          >
            Challenge this ballot
          </SecondaryAction>
        </>
      }
    >
      <Emblem>
        <LockIcon size={34} />
      </Emblem>
      <Lead title="Your ballot is encrypted">
        It is sealed on this phone. Nothing has been sent yet.
      </Lead>
      {afterChallenge === "passed" ? (
        <div style={{ marginBottom: tokens.space.md }}>
          <Notice tone="success" icon={<LockIcon size={22} />}>
            This is a fresh ballot. Its fingerprints are new; the tracking codes
            stay the same.{failed ? ` ${EARLIER_FAILED}` : ""}
          </Notice>
        </div>
      ) : null}
      {failed ? (
        <div
          className="ba-stack"
          style={{ gap: tokens.space.sm, marginBottom: tokens.space.md }}
        >
          {/* Error tone: DESIGN.md keeps error for refused and failed. */}
          <Notice tone="error">
            <strong>
              {lastCheckFailed
                ? "The last check on this phone failed."
                : "A check on this phone failed."}
            </strong>{" "}
            Do not rely on this phone: tell the election staff before you
            submit. This new ballot was made by the same phone.
          </Notice>
          <div id="confirm-submit">
            {confirming ? (
              // Appears whole (sentence and button at once) so nothing under
              // it moves afterwards. Focused on appearing; its name is the
              // sentence, so a screen reader hears it.
              <div
                ref={confirmRegion}
                role="group"
                tabIndex={-1}
                aria-labelledby="confirm-submit-text"
                className="ba-stack"
                style={{ gap: tokens.space.sm, outline: "none" }}
              >
                <p
                  id="confirm-submit-text"
                  style={{
                    margin: 0,
                    color: tokens.color.text1,
                    fontSize: "var(--ba-type-note)",
                  }}
                >
                  If you still want to submit it, tap “Yes, submit from this
                  phone”.
                </p>
                <ActionButton
                  onClick={() => {
                    if (confirmReady) onSubmit();
                  }}
                  disabled={challenging || !confirmReady}
                >
                  Yes, submit from this phone
                </ActionButton>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ul
        className="ba-list"
        aria-label="Your encrypted ballot"
        style={{
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.card,
          boxShadow: tokens.shadow.card,
          marginBottom: tokens.space.md,
        }}
      >
        {ballot.positions.map((bp) => (
          <li
            key={bp.positionId}
            style={{ padding: 16, display: "grid", gap: 12 }}
          >
            <span style={{ fontSize: "var(--ba-type-name)", fontWeight: 600 }}>
              {positions.find((p) => p.id === bp.positionId)?.title ??
                idToName(bp.positionId)}
            </span>
            <VerifiableValue
              label="Ballot fingerprint"
              value={bp.fingerprint}
            />
            <VerifiableValue label="Tracking code" value={bp.trackingCode} />
          </li>
        ))}
      </ul>

      <div className="ba-stack" style={{ gap: tokens.space.sm }}>
        <p
          style={{
            margin: 0,
            color: tokens.color.text2,
            fontSize: "var(--ba-type-note)",
          }}
        >
          The <strong>ballot fingerprint</strong> names this exact encrypted
          ballot. If you submit it, the public board shows the same fingerprint
          next to your tracking code. The <strong>tracking code</strong> marks
          your place for each position and stays the same if you encrypt again.
        </p>
        <p
          style={{
            margin: 0,
            color: tokens.color.text2,
            fontSize: "var(--ba-type-note)",
          }}
        >
          Want proof the phone encrypted what you chose?{" "}
          <strong>Challenge this ballot</strong>: the phone opens it and shows
          what is inside, and the check must show this fingerprint. An opened
          ballot is thrown away, and you vote with a fresh one.
        </p>
        <Notice tone="warning">
          Once you submit, your ballot is final and cannot be changed.
        </Notice>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </Screen>
  );
}
