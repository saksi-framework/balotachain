import {
  AlertIcon,
  CheckIcon,
  Chip,
  idToName,
  SecondaryButton,
  TextButton,
  VerifiableValue,
  tokens,
} from "@balotachain/ui";
import {
  ActionButton,
  Emblem,
  FULL_WIDTH,
  Label,
  Notice,
  Screen,
} from "../components/Layout";
import type {
  ElectionStatus,
  Position,
  SubmitReceipt,
  UnconfirmedPosition,
} from "../lib/live";

/**
 * Where one position of this phone's ballot stands, from this phone's own
 * records (D11). The three cases:
 * - "recorded": a stored receipt. The client stores one only after the
 *   console's answer passed `checkRecorded` (same position, election,
 *   tracking code and fingerprint, bytes read back, a tx id and a block), or
 *   after a resend the ledger turned away was found on the board as this
 *   exact ballot (`ownRecord`: fingerprint, tx id and block). A receipt with
 *   an alarm is "recorded" too, as something; the screen raises the alarm
 *   and does not count it as on the ledger.
 * - "unconfirmed": a stored "sent, no answer" marker (`sending:<election>:checkin`),
 *   written just before the ballot request and removed once the answer is
 *   known. The ballot may be on the ledger. Only a resend of the same bytes
 *   may settle it; it is never offered to Finish.
 * - "not-sent": neither. Its request never went out, or the console
 *   refused it outright (refused or closed), so the ledger does not have it.
 */
export type Standing = "recorded" | "unconfirmed" | "not-sent";

export function standing(
  positionId: string,
  receipts: SubmitReceipt[],
  unconfirmed: UnconfirmedPosition[],
): Standing {
  if (receipts.some((r) => r.positionId === positionId)) return "recorded";
  if (unconfirmed.some((u) => u.positionId === positionId)) {
    return "unconfirmed";
  }
  return "not-sent";
}

/** D11, when voting has closed on a partly recorded ballot. */
export const CLOSED_MISSING =
  "Voting has closed. The missing positions cannot be sent.";

/** With CLOSED_MISSING when a position is unconfirmed (fix round 1, I1). */
export const CLOSED_UNCONFIRMED =
  "A position marked Not confirmed may be on the ledger; check its tracking code on the public board.";

/** m5: a resend was answered "taken" and the board did not show the ballot. */
export const TAKEN_UNCONFIRMED =
  "The ledger says this position is taken, but the board does not show this phone's ballot. Show this screen to an election officer.";

export const BOARD_HREF = "/board/";

/** The public board for this election (`/board/?run=<id>`), or the index. */
export function boardHref(runId: string | undefined): string {
  return runId ? `${BOARD_HREF}?run=${encodeURIComponent(runId)}` : BOARD_HREF;
}

export function Submitted({
  positions,
  receipts,
  unconfirmed = [],
  status = null,
  direction,
  boardHref: board = BOARD_HREF,
  onVerify,
  onFinish,
  onSendAgain,
}: {
  positions: Position[];
  receipts: SubmitReceipt[];
  /** Sent without a known outcome (see `standing`). */
  unconfirmed?: UnconfirmedPosition[];
  /** The election's state now; Finish is offered only while it is open. */
  status?: ElectionStatus | null;
  /** D11: open the ballot for the positions not sent. */
  onFinish?: () => void;
  /** D11: send the unconfirmed positions again, the same bytes. */
  onSendAgain?: () => void;
  direction?: "fwd" | "back";
  /** This election on the public board. */
  boardHref?: string;
  onVerify: () => void;
}) {
  // A send cut off part-way and then reloaded: say so rather than claim the
  // whole ballot is in.
  // Every position of the election, in order; without the election's list
  // (it has none loaded), the receipts as they are.
  const rows: { id: string; title: string }[] =
    positions.length > 0
      ? positions.map((p) => ({ id: p.id, title: p.title }))
      : receipts.map((r) => ({
          id: r.positionId,
          title: idToName(r.positionId),
        }));
  // A receipt with an alarm is not on the ledger as this phone's ballot:
  // only the receipts whose answer matched count (I1).
  const recordedCount = rows.filter((p) =>
    receipts.some((r) => r.positionId === p.id && !r.alarm),
  ).length;
  const partial = recordedCount < rows.length;
  const alarmed = receipts.some((r) => r.alarm);
  const waiting = rows.filter(
    (p) => standing(p.id, receipts, unconfirmed) === "unconfirmed",
  );
  const takenRows = waiting.filter((p) =>
    unconfirmed.some((u) => u.positionId === p.id && u.takenUnconfirmed),
  );
  const silentRows = waiting.filter((p) => !takenRows.includes(p));
  /** Every unconfirmed row has had its resend answered "taken" (N1). */
  const allTaken = waiting.length > 0 && takenRows.length === waiting.length;
  const notSent = rows.filter(
    (p) => standing(p.id, receipts, unconfirmed) === "not-sent",
  );
  const open = status === "open";
  const closed = status === "closed" || status === "tallied";
  // Never after an alarm: that screen sends nothing further.
  const canAct = partial && !alarmed && open;
  return (
    <Screen
      title="Receipt"
      direction={direction}
      // The footers that act on a partly recorded ballot hold up to three
      // actions; tighter gaps keep more of the receipt in view.
      footerDense={canAct}
      footer={
        canAct && allTaken && onSendAgain ? (
          // N1: every unconfirmed row was already sent again and answered
          // "taken", so a resend cannot settle it: Finish leads when a
          // position is known not sent; Send again is never primary.
          <>
            {notSent.length > 0 && onFinish ? (
              <ActionButton onClick={onFinish}>Finish my ballot</ActionButton>
            ) : null}
            <SecondaryButton onClick={onSendAgain} style={FULL_WIDTH}>
              Send again
            </SecondaryButton>
            <TextButton onClick={onVerify} style={{ minHeight: 44 }}>
              Verify what is recorded
            </TextButton>
          </>
        ) : canAct && waiting.length > 0 && onSendAgain ? (
          <>
            <ActionButton onClick={onSendAgain}>Send again</ActionButton>
            {/* I5: positions known not sent can still be finished. */}
            {notSent.length > 0 && onFinish ? (
              <SecondaryButton onClick={onFinish} style={FULL_WIDTH}>
                Finish my ballot
              </SecondaryButton>
            ) : null}
            <TextButton onClick={onVerify} style={{ minHeight: 44 }}>
              Verify what is recorded
            </TextButton>
          </>
        ) : canAct && onFinish ? (
          <>
            <ActionButton onClick={onFinish}>Finish my ballot</ActionButton>
            <TextButton onClick={onVerify} style={{ minHeight: 44 }}>
              Verify what is recorded
            </TextButton>
          </>
        ) : (
          <>
            <ActionButton onClick={onVerify}>Verify my ballot</ActionButton>
            <a className="ba-link ba-footer-link" href={board}>
              Open the public board
            </a>
          </>
        )
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          marginBottom: tokens.space.md,
        }}
      >
        {alarmed ? (
          <Emblem tone="error">
            <AlertIcon size={34} />
          </Emblem>
        ) : partial ? (
          // Not every position is recorded: the warning mark the waiting
          // screens use, not the "ballot recorded" tick.
          <Emblem tone="warning">
            <AlertIcon size={34} />
          </Emblem>
        ) : (
          <div
            aria-hidden
            className="ba-pop"
            style={{
              width: 84,
              height: 84,
              borderRadius: tokens.radius.pill,
              background: tokens.color.successLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <span
              style={{
                width: 58,
                height: 58,
                borderRadius: tokens.radius.pill,
                background: tokens.color.success,
                color: tokens.color.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckIcon size={32} strokeWidth={2.6} />
            </span>
          </div>
        )}
        <h2 className="ba-title ba-heading" tabIndex={-1}>
          {alarmed
            ? "The election server's answer does not match"
            : partial
              ? "Ballot partly recorded"
              : "Ballot recorded"}
        </h2>
        <p className="ba-lead" style={{ maxWidth: 320 }}>
          <span aria-live="polite">
            {partial
              ? `${recordedCount} of ${rows.length} positions are on the ledger.`
              : "Every position is on the ledger."}
          </span>{" "}
          Keep the tracking codes to check your ballot on the public board; it
          shows the same ballot fingerprint next to each. They never reveal your
          choice.
        </p>
      </div>
      {alarmed ? (
        <div style={{ marginBottom: tokens.space.md }}>
          <Notice tone="error">
            <strong>Do not vote again from this phone.</strong> For a position
            marked below, the election server&apos;s answer did not match the
            ballot this phone showed you. Show this screen to an election
            officer.
          </Notice>
        </div>
      ) : null}
      {partial && !alarmed ? (
        <div className="ba-stack" style={{ marginBottom: tokens.space.md }}>
          <Notice tone="warning">
            {/* An unconfirmed position may be on the ledger: never say only
                the Recorded ones are. */}
            {waiting.length > 0
              ? "Sending stopped before every position was recorded. Positions marked Recorded are on the ledger."
              : "Sending stopped before every position was recorded. Only the positions marked Recorded are on the ledger."}
          </Notice>
          {silentRows.length > 0 ? (
            <Notice tone="neutral">
              This phone sent {silentRows.map((p) => p.title).join(", ")} but
              never heard back.
              {open
                ? " Send again sends the same ballot; the ledger never records a position twice."
                : ""}
            </Notice>
          ) : null}
          {takenRows.map((p) => (
            <Notice key={p.id} tone="neutral">
              <strong>{p.title}.</strong> {TAKEN_UNCONFIRMED}
            </Notice>
          ))}
          {closed ? (
            <Notice tone="neutral">
              {CLOSED_MISSING}
              {waiting.length > 0 ? ` ${CLOSED_UNCONFIRMED}` : ""}
            </Notice>
          ) : null}
        </div>
      ) : null}

      <ul
        className="ba-list"
        aria-label="Receipts"
        style={{
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.card,
          boxShadow: tokens.shadow.card,
        }}
      >
        {rows.map((p) => {
          const r = receipts.find((x) => x.positionId === p.id);
          if (!r) {
            const u = unconfirmed.find((x) => x.positionId === p.id);
            return (
              <li key={p.id} style={{ padding: 16, display: "grid", gap: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{ fontSize: "var(--ba-type-name)", fontWeight: 600 }}
                  >
                    {p.title}
                  </span>
                  {u ? (
                    <Chip variant="warning" dot>
                      Not confirmed
                    </Chip>
                  ) : (
                    <Chip variant="neutral" dot>
                      Not sent
                    </Chip>
                  )}
                </div>
                {u ? (
                  <VerifiableValue
                    label="Tracking code"
                    value={u.trackingCode}
                  />
                ) : null}
              </li>
            );
          }
          return (
            <li
              key={r.positionId}
              style={{ padding: 16, display: "grid", gap: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <span
                  style={{ fontSize: "var(--ba-type-name)", fontWeight: 600 }}
                >
                  {p.title}
                </span>
                {/* Block and transaction id only when the console gave a
                    transaction id; an alarm's answer may carry neither. */}
                {r.txId !== "" ? (
                  <span style={{ display: "inline-flex", gap: 6 }}>
                    <Label>Block</Label>
                    <span
                      className="bc-mono"
                      style={{ fontSize: tokens.font.mono }}
                    >
                      #{r.block}
                    </span>
                  </span>
                ) : null}
              </div>
              {r.alarm || partial ? (
                // Its own width, not the grid row's.
                <span style={{ justifySelf: "start" }}>
                  {r.alarm ? (
                    <Chip variant="error" dot>
                      Does not match
                    </Chip>
                  ) : (
                    <Chip variant="success" dot>
                      Recorded
                    </Chip>
                  )}
                </span>
              ) : null}
              <VerifiableValue
                label="Tracking code"
                value={r.trackingCode}
                checkHref={board}
              />
              {r.fingerprint ? (
                <VerifiableValue
                  label={
                    r.alarm
                      ? "Ballot fingerprint shown before cast"
                      : "Ballot fingerprint"
                  }
                  value={r.fingerprint}
                />
              ) : null}
              {r.alarm ? (
                <>
                  <VerifiableValue
                    label="Fingerprint the server reported"
                    value={r.alarm.recordedFingerprint || "(none)"}
                  />
                  <VerifiableValue
                    label="Tracking code the server reported"
                    value={r.alarm.recordedTrackingCode || "(none)"}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--ba-type-detail)",
                      color: tokens.color.error,
                    }}
                  >
                    {r.alarm.recordedBytesMatch
                      ? "The server read the ledger's copy back unchanged."
                      : "The server could not confirm that the ledger's copy is the bytes it sent."}
                  </p>
                </>
              ) : null}
              {r.txId !== "" ? (
                <VerifiableValue
                  label="Transaction id"
                  value={r.txId}
                  truncate
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
