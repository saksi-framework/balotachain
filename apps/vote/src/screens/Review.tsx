import { Chip, idToName, LockIcon, TextButton, tokens } from "@balotachain/ui";
import {
  ActionButton,
  Label,
  Lead,
  Notice,
  Screen,
  type Direction,
} from "../components/Layout";
import type { Position, SubmitReceipt } from "../lib/live";

export function Review({
  positions,
  recorded = [],
  positionTitle = idToName,
  choices,
  busy,
  error,
  direction,
  onEdit,
  onBack,
  onEncrypt,
}: {
  /** The positions on this ballot (D11: only the missing ones). */
  positions: Position[];
  /** Positions already recorded: shown, never editable or sent again. */
  recorded?: SubmitReceipt[];
  positionTitle?: (positionId: string) => string;
  choices: Record<string, string>;
  busy: boolean;
  error: string | null;
  direction: Direction;
  onEdit: (index: number) => void;
  onBack: () => void;
  onEncrypt: () => void;
}) {
  return (
    <Screen
      title="Review"
      back={busy ? undefined : onBack}
      direction={direction}
      footer={
        <ActionButton onClick={onEncrypt} busy={busy} busyLabel="Encrypting…">
          {error ? (
            // D9: a failed step reads the error, then "Try again".
            "Try again"
          ) : (
            <>
              <LockIcon size={20} />
              Encrypt my ballot
            </>
          )}
        </ActionButton>
      }
    >
      <Lead title="Review your ballot">
        Your phone encrypts these choices next. Nothing is sent until you
        submit.
      </Lead>
      <div className="ba-stack" style={{ gap: tokens.space.sm }}>
        {recorded.map((r) => (
          <section key={r.positionId}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                minHeight: 44,
                marginBottom: 6,
              }}
            >
              <Label>{positionTitle(r.positionId)}</Label>
            </div>
            <div
              style={{
                background: tokens.color.neutralFill,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: tokens.radius.card,
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                className="bc-mono"
                style={{
                  fontSize: tokens.font.mono,
                  color: tokens.color.text2,
                }}
              >
                {r.trackingCode}
              </span>
              <Chip variant="success" dot>
                Recorded
              </Chip>
            </div>
          </section>
        ))}
        {positions.map((p, i) => {
          const c = p.candidates.find((k) => k.id === choices[p.id]);
          return (
            <section key={p.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Label>{p.title}</Label>
                <TextButton
                  onClick={() => onEdit(i)}
                  disabled={busy}
                  aria-label={`Edit ${p.title}`}
                  style={{ minHeight: 44, minWidth: 44, padding: "4px 0" }}
                >
                  Edit
                </TextButton>
              </div>
              <div
                style={{
                  background: tokens.color.surface,
                  border: `1px solid ${tokens.color.border}`,
                  borderRadius: tokens.radius.card,
                  boxShadow: tokens.shadow.subtle,
                  padding: "14px 16px",
                }}
              >
                {c ? (
                  <>
                    <div
                      style={{
                        fontSize: "var(--ba-type-name)",
                        fontWeight: 600,
                      }}
                    >
                      {c.name}
                    </div>
                    {c.detail ? (
                      <div
                        style={{
                          fontSize: "var(--ba-type-detail)",
                          color: tokens.color.text2,
                          marginTop: 2,
                        }}
                      >
                        {c.detail}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <span style={{ color: tokens.color.text2 }}>
                    No choice yet
                  </span>
                )}
              </div>
            </section>
          );
        })}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </Screen>
  );
}
