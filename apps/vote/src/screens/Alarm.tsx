import {
  AlertIcon,
  Chip,
  idToName,
  VerifiableValue,
  tokens,
} from "@balotachain/ui";
import {
  ActionButton,
  Emblem,
  Lead,
  Notice,
  Screen,
} from "../components/Layout";
import type { LiveErrorDetail, Position } from "../lib/live";

/**
 * The console's answer to a ballot did not match what the phone showed
 * before the cast: another fingerprint or tracking code, or its read-back
 * of the ledger's bytes did not match. Nothing is retried or dropped
 * quietly; both sides are on screen, and the receipt keeps them.
 */
export function Alarm({
  positions,
  mismatch,
  onReceipt,
}: {
  positions: Position[];
  mismatch: Extract<LiveErrorDetail, { type: "record-mismatch" }>;
  onReceipt: () => void;
}) {
  const { shown, recorded } = mismatch;
  const title =
    positions.find((p) => p.id === mismatch.positionId)?.title ??
    idToName(mismatch.positionId);
  return (
    <Screen
      title="Check failed"
      footer={<ActionButton onClick={onReceipt}>See the receipt</ActionButton>}
    >
      <Emblem tone="error">
        <AlertIcon size={34} />
      </Emblem>
      <div role="alert">
        <Lead title="The election server's answer does not match">
          The election server&apos;s answer for {title} is not the ballot this
          phone showed you. Do not vote again from this phone, and do not sign
          in on another one: show this screen to an election officer. The rest
          of your ballot was not sent.
        </Lead>
      </div>
      <div
        style={{
          background: tokens.color.surface,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.card,
          boxShadow: tokens.shadow.card,
          padding: 16,
          display: "grid",
          gap: 12,
          marginBottom: tokens.space.md,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <span style={{ fontSize: "var(--ba-type-name)", fontWeight: 600 }}>
            {title}
          </span>
          <Chip variant="error" dot>
            Does not match
          </Chip>
        </div>
        <VerifiableValue
          label="Fingerprint shown before you cast"
          value={shown.fingerprint || "(none)"}
        />
        <VerifiableValue
          label="Fingerprint the server reported"
          value={recorded.recordedFingerprint || "(none)"}
        />
        <VerifiableValue
          label="Tracking code shown"
          value={shown.trackingCode || "(none)"}
        />
        <VerifiableValue
          label="Tracking code the server reported"
          value={recorded.recordedTrackingCode || "(none)"}
        />
        {recorded.txId ? (
          <VerifiableValue
            label="Transaction id"
            value={recorded.txId}
            truncate
          />
        ) : null}
      </div>
      <Notice tone={recorded.recordedBytesMatch ? "neutral" : "error"}>
        {recorded.recordedBytesMatch
          ? "The server says it read the ledger's copy back unchanged."
          : "The server could not confirm that the ledger holds the exact bytes it sent."}
      </Notice>
    </Screen>
  );
}
