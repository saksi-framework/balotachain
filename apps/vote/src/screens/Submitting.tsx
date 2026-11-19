import { Chip, idToName, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Lead,
  Notice,
  Screen,
  SlowNote,
} from "../components/Layout";
import type { EncryptedBallot, Position, SubmitReceipt } from "../lib/live";
import { SLOW_MS, useSlow } from "../lib/usePoll";

/**
 * One ledger transaction per position, about 2 s each on the real network,
 * so each position shows its own state instead of one spinner.
 */
export function Submitting({
  positions,
  ballot,
  receipts,
  error,
  refusal = null,
  onRetry,
  onBack,
  slowMs = SLOW_MS,
}: {
  slowMs?: number;
  positions: Position[];
  ballot: EncryptedBallot;
  receipts: SubmitReceipt[];
  error: string | null;
  /** The chaincode's gate and reason, verbatim, when the ledger refused. */
  refusal?: { gate: string; reason: string } | null;
  onRetry: () => void;
  /** Set when the send was refused outright: retrying cannot help. */
  onBack?: () => void;
}) {
  const recorded = new Map(receipts.map((r) => [r.positionId, r]));
  const current = ballot.positions.find((p) => !recorded.has(p.positionId));
  const inFlight = !error;
  const slow = useSlow(inFlight, slowMs);
  const done = ballot.positions.filter((p) => recorded.has(p.positionId));

  return (
    <Screen
      title="Sending"
      footer={
        inFlight ? (
          // D9: the work is named on the (disabled) button while it runs.
          <>
            <ActionButton busy busyLabel="Recording on chain…">
              Recording on chain…
            </ActionButton>
            <SlowNote show={slow} />
          </>
        ) : onBack ? (
          <ActionButton onClick={onBack}>Back to review</ActionButton>
        ) : (
          <ActionButton onClick={onRetry}>Try again</ActionButton>
        )
      }
    >
      <Lead title="Sending your ballot">
        Each position is its own transaction on the ledger. Each takes about 2
        seconds, longer when the ledger is busy. Keep this page open until every
        position says Recorded.
      </Lead>
      <ol
        className="ba-list"
        aria-label="Positions sent"
        style={{
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.card,
          boxShadow: tokens.shadow.card,
          marginBottom: tokens.space.md,
        }}
      >
        {ballot.positions.map((bp) => {
          const r = recorded.get(bp.positionId);
          const title =
            positions.find((p) => p.id === bp.positionId)?.title ??
            idToName(bp.positionId);
          const sending = !r && !error && current === bp;
          return (
            <li
              key={bp.positionId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600 }}>
                  {title}
                </span>
                <span
                  className="bc-mono"
                  style={{
                    fontSize: tokens.font.small,
                    color: tokens.color.text2,
                  }}
                >
                  {r ? `Block #${r.block}` : bp.trackingCode}
                </span>
              </span>
              {r ? (
                <Chip variant="success" dot>
                  Recorded
                </Chip>
              ) : sending ? (
                <Chip variant="active" dot>
                  Recording…
                </Chip>
              ) : error && current === bp ? (
                <Chip variant="warning" dot>
                  Interrupted
                </Chip>
              ) : (
                <Chip variant="neutral" dot>
                  Waiting
                </Chip>
              )}
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="bc-sr-only">
        {done.length} of {ballot.positions.length} positions recorded
      </p>
      {error && refusal ? (
        <Notice tone="error">
          <strong>The ledger refused this ballot.</strong>
          <span style={{ display: "block", marginTop: 8 }}>
            Gate:{" "}
            <code className="bc-mono" style={{ overflowWrap: "anywhere" }}>
              {refusal.gate || "(none named)"}
            </code>
          </span>
          <span style={{ display: "block", marginTop: 4 }}>
            Reason:{" "}
            <code className="bc-mono" style={{ overflowWrap: "anywhere" }}>
              {refusal.reason || "(none given)"}
            </code>
          </span>
        </Notice>
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : null}
    </Screen>
  );
}
