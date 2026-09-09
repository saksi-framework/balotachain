import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  tokens,
  Card,
  CopyButton,
  PrimaryButton,
  SecondaryButton,
  AlertIcon,
  CheckIcon,
  LockIcon,
  ShieldCheckIcon,
} from "@balotachain/ui";
import { Chip, type ChipVariant } from "./components/Chip";
import { ProgressBar } from "./components/ProgressBar";
import {
  AGGREGATE_FINGERPRINT,
  BALLOT_COUNT,
  ELECTION_NAME,
  INITIAL_LOG,
  KEY_SHARE_CEREMONY,
  KEY_SHARE_FINGERPRINT,
  POLLS_CLOSED_AT,
  POSITION_NAMES,
  THRESHOLD_REQUIRED,
  TRUSTEES,
  TRUSTEE_TOTAL,
  YOU_NAME,
  YOU_ORDINAL,
  YOU_ROLE,
  initialsOf,
  type LogEntry,
  type Trustee,
  type TrusteeStatus,
} from "./mocks/trustee";
import {
  loadBulletin,
  submitAllPartialDecryptions,
  type Bulletin,
} from "./lib/bulletin";

// Demo wiring: the "YOU" trustee in the UI is id "t03" on the bulletin side,
// and the demo secret share is a fixed scalar. Both are intentionally
// hard-coded for the staging demo and easy to swap later.
const YOU_TRUSTEE_ID = "t03";
const DEMO_SECRET_SHARE = 17;

type SubmitPhase = "idle" | "confirm" | "submitted";

const wrap: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  padding: "0 28px",
  width: "100%",
};

const cardLabel: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: tokens.color.text2,
};

function statusVariant(status: TrusteeStatus): ChipVariant {
  switch (status) {
    case "Submitted":
      return "success";
    case "Pending":
      return "warn";
    case "Offline":
      return "neutral";
  }
}

function nowLogStamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function Avatar({
  initials,
  size,
  radius,
  filled,
}: {
  initials: string;
  size: number;
  radius: number;
  filled: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size >= 46 ? 16 : size >= 40 ? 14 : 13,
        fontWeight: 700,
        background: filled ? tokens.color.teal : tokens.color.neutralFill,
        color: filled ? tokens.color.surface : tokens.color.text2,
      }}
    >
      {initials}
    </span>
  );
}

function CardHead({
  title,
  label,
  style,
}: {
  title: string;
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 18,
        ...style,
      }}
    >
      <h2
        style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: 0.2 }}
      >
        {title}
      </h2>
      {label ? <span style={cardLabel}>{label}</span> : null}
    </div>
  );
}

function TopBar() {
  return (
    <header
      style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          ...wrap,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space.sm,
          height: 64,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: tokens.color.teal,
              color: tokens.color.surface,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldCheckIcon size={20} strokeWidth={1.7} />
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.1 }}>
            BalotaChain{" "}
            <span style={{ color: tokens.color.text2, fontWeight: 500 }}>
              — Trustee Console
            </span>
          </span>
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13.5,
              fontWeight: 600,
              color: tokens.color.success,
            }}
          >
            <span
              className="bc-pulse"
              aria-hidden
              style={{
                width: 9,
                height: 9,
                borderRadius: tokens.radius.pill,
                background: "currentColor",
                position: "relative",
              }}
            />
            Secure session
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingLeft: 18,
              borderLeft: `1px solid ${tokens.color.border}`,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: tokens.color.tealLight,
                color: tokens.color.tealDark,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {initialsOf(YOU_NAME)}
            </span>
            <span style={{ lineHeight: 1.25 }}>
              <b style={{ fontSize: 14, fontWeight: 600, display: "block" }}>
                {YOU_NAME}
              </b>
              <small style={{ fontSize: 12, color: tokens.color.text2 }}>
                Trustee {YOU_ORDINAL} of {TRUSTEE_TOTAL}
              </small>
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

function ThresholdCard({
  trustees,
  submitted,
}: {
  trustees: Trustee[];
  submitted: number;
}) {
  const met = submitted >= THRESHOLD_REQUIRED;
  const remaining = Math.max(0, THRESHOLD_REQUIRED - submitted);
  return (
    <Card>
      <CardHead
        title="Threshold Decryption"
        label={`Quorum ${THRESHOLD_REQUIRED} of ${TRUSTEE_TOTAL}`}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space.sm,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 15 }}>
          <b style={{ fontWeight: 700 }}>
            {THRESHOLD_REQUIRED} of {TRUSTEE_TOTAL} trustees
          </b>{" "}
          are required to decrypt the final tally.
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: tokens.color.tealDark,
            whiteSpace: "nowrap",
          }}
        >
          {Math.min(submitted, THRESHOLD_REQUIRED)} of {THRESHOLD_REQUIRED}{" "}
          submitted
        </div>
      </div>

      <ProgressBar
        value={Math.min(submitted, THRESHOLD_REQUIRED)}
        max={THRESHOLD_REQUIRED}
      />

      <div
        style={{
          fontSize: tokens.type.small,
          marginTop: 9,
          color: met ? tokens.color.success : tokens.color.text2,
          fontWeight: met ? 600 : 400,
        }}
      >
        {met
          ? "Threshold reached — the final tally can now be decrypted."
          : `${remaining} more partial decryption${remaining === 1 ? "" : "s"} needed to reach the threshold.`}
      </div>

      <div
        style={{
          marginTop: 22,
          borderTop: `1px solid ${tokens.color.border}`,
        }}
      >
        {trustees.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              padding: "14px 0",
              borderBottom:
                i === trustees.length - 1
                  ? "none"
                  : `1px solid ${tokens.color.border}`,
            }}
          >
            <Avatar
              initials={initialsOf(t.name)}
              size={40}
              radius={11}
              filled={t.isYou === true}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {t.name}
                {t.isYou ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      color: tokens.color.tealDark,
                      background: tokens.color.tealLight,
                      borderRadius: tokens.radius.pill,
                      padding: "1px 8px",
                    }}
                  >
                    YOU
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: tokens.type.small,
                  color: tokens.color.text2,
                  marginTop: 1,
                }}
              >
                {t.role}
              </div>
            </div>
            <Chip variant={statusVariant(t.status)} dot>
              {t.status}
            </Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActionCard({
  phase,
  onStart,
  onCancel,
  onConfirm,
  submitError,
  thresholdMet,
}: {
  phase: SubmitPhase;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitError: string | null;
  thresholdMet: boolean;
}) {
  return (
    <Card
      flush
      style={{
        border: `1.5px solid ${tokens.color.teal}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: tokens.color.teal,
        }}
      />
      <div style={{ padding: "24px 24px 24px 26px" }}>
        <div
          style={{
            fontSize: tokens.type.eyebrow,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: tokens.color.tealDark,
            marginBottom: 12,
          }}
        >
          What you must do
        </div>
        <h2
          style={{
            fontSize: tokens.type.h3,
            fontWeight: 700,
            margin: "0 0 7px",
          }}
        >
          Submit your partial decryption
        </h2>
        <p
          style={{
            fontSize: 14.5,
            color: tokens.color.text2,
            lineHeight: 1.5,
            margin: "0 0 20px",
            maxWidth: 560,
          }}
        >
          Your key share is combined with the others to decrypt{" "}
          <b>only the final totals</b> — never any individual ballot. The
          threshold is met once {THRESHOLD_REQUIRED} trustees submit.
        </p>

        {phase !== "submitted" ? (
          <>
            <PrimaryButton onClick={onStart} disabled={phase === "confirm"}>
              <LockIcon size={20} strokeWidth={1.7} />
              Submit Partial Decryption
            </PrimaryButton>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: tokens.type.small,
                color: tokens.color.warnText,
                marginTop: tokens.space.sm,
              }}
            >
              <span
                style={{ color: tokens.color.warn, display: "inline-flex" }}
              >
                <AlertIcon size={16} strokeWidth={1.7} />
              </span>
              This action is irreversible and is permanently recorded to the
              public bulletin board.
            </div>
          </>
        ) : null}

        {phase === "confirm" ? (
          <div
            style={{
              marginTop: tokens.space.sm,
              background: tokens.color.warnLight,
              border: `1px solid ${tokens.color.warnBorder}`,
              borderRadius: tokens.radius.button,
              padding: "18px 20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: tokens.type.body,
                fontWeight: 700,
                color: tokens.color.warnText,
              }}
            >
              Confirm submission
            </h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 14,
                color: tokens.color.warnText,
                lineHeight: 1.5,
              }}
            >
              You are about to release Trustee {YOU_ORDINAL}&apos;s partial
              decryption using your key share. This cannot be undone, and the
              event will be signed and published to the audit log and bulletin
              board.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <PrimaryButton
                onClick={onConfirm}
                style={{ minHeight: 48, padding: "0 24px", fontSize: 15 }}
              >
                Yes, submit my share
              </PrimaryButton>
              <SecondaryButton
                onClick={onCancel}
                style={{
                  minHeight: 48,
                  padding: "0 22px",
                  fontSize: 15,
                  borderRadius: tokens.radius.button,
                  border: `1.5px solid ${tokens.color.border}`,
                  color: tokens.color.text1,
                }}
              >
                Cancel
              </SecondaryButton>
            </div>
          </div>
        ) : null}

        {phase === "submitted" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: tokens.color.successLight,
              border: `1px solid ${tokens.color.successBorder}`,
              borderRadius: tokens.radius.button,
              padding: "18px 20px",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: tokens.radius.pill,
                background: tokens.color.success,
                color: tokens.color.surface,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckIcon size={24} strokeWidth={2.6} />
            </span>
            <div>
              <h3
                style={{
                  margin: "0 0 2px",
                  fontSize: tokens.type.body,
                  fontWeight: 700,
                  color: tokens.color.successText,
                }}
              >
                Partial decryption submitted
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  color: tokens.color.successBody,
                }}
              >
                Your share has been recorded.{" "}
                {thresholdMet
                  ? "Threshold reached — the final tally can now be decrypted."
                  : "Waiting on the remaining trustees to reach the threshold."}
              </p>
              {submitError ? (
                <p
                  className="bc-mono"
                  style={{
                    margin: "6px 0 0",
                    fontSize: 12,
                    color: tokens.color.text2,
                  }}
                >
                  offline mode: {submitError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function VerificationCard({ ballotCount }: { ballotCount: number }) {
  return (
    <Card>
      <CardHead title="What is being decrypted" label="Verification context" />

      <VcLine label="Encrypted aggregate tally — fingerprint" first>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="bc-mono"
            style={{
              fontSize: 13.5,
              color: tokens.color.tealDark,
              wordBreak: "break-all",
            }}
          >
            {AGGREGATE_FINGERPRINT}
          </span>
          <CopyButton
            value={AGGREGATE_FINGERPRINT}
            label="Copy aggregate fingerprint"
            size="sm"
          />
        </span>
      </VcLine>

      <VcLine label="Ballots aggregated">
        {ballotCount.toLocaleString("en-US")}{" "}
        <span style={{ color: tokens.color.text2, fontWeight: 400 }}>
          verified ballots
        </span>
      </VcLine>

      <VcLine label="Positions in tally">
        3{" "}
        <span style={{ color: tokens.color.text2, fontWeight: 400 }}>
          {POSITION_NAMES}
        </span>
      </VcLine>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginTop: tokens.space.sm,
          padding: "14px 16px",
          background: tokens.color.tealLight,
          borderRadius: tokens.radius.button,
          fontSize: 13.5,
          color: tokens.color.tealDark,
          lineHeight: 1.5,
        }}
      >
        <span style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}>
          <ShieldCheckIcon size={18} strokeWidth={1.6} />
        </span>
        This tally is the homomorphic aggregate of all ballots. Individual
        ballots are never decrypted — only the combined totals are revealed.
      </div>
    </Card>
  );
}

function VcLine({
  label,
  children,
  first = false,
}: {
  label: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: first ? "4px 0 15px" : "15px 0",
        borderTop: first ? "none" : `1px solid ${tokens.color.border}`,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 13.5, color: tokens.color.text2 }}>{label}</span>
      <span style={{ fontSize: 14.5, fontWeight: 600, textAlign: "right" }}>
        {children}
      </span>
    </div>
  );
}

function KeyShareCard() {
  return (
    <Card>
      <CardHead title="Your identity & key share" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 13,
          marginBottom: 18,
        }}
      >
        <Avatar initials={initialsOf(YOU_NAME)} size={48} radius={13} filled />
        <div>
          <b
            style={{
              fontSize: tokens.type.body,
              fontWeight: 700,
              display: "block",
            }}
          >
            {YOU_NAME}
          </b>
          <small
            style={{ fontSize: tokens.type.small, color: tokens.color.text2 }}
          >
            Trustee {YOU_ORDINAL} of {TRUSTEE_TOTAL} · {YOU_ROLE}
          </small>
        </div>
      </div>

      <KsLine label="Key share status">
        <Chip variant="success" dot>
          Held securely
        </Chip>
      </KsLine>
      <KsLine label="Share fingerprint">
        <span className="bc-mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {KEY_SHARE_FINGERPRINT}
        </span>
      </KsLine>
      <KsLine label="From ceremony">
        <span style={{ fontWeight: 600 }}>{KEY_SHARE_CEREMONY}</span>
      </KsLine>

      <div
        style={{
          display: "flex",
          gap: 9,
          alignItems: "flex-start",
          marginTop: tokens.space.sm,
          padding: "13px 14px",
          background: tokens.color.bg,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.button,
          fontSize: tokens.type.small,
          color: tokens.color.text2,
          lineHeight: 1.5,
        }}
      >
        <span style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}>
          <LockIcon size={17} strokeWidth={1.6} />
        </span>
        Your private key share never leaves this device. Only a partial
        decryption — which reveals nothing on its own — is transmitted.
      </div>
    </Card>
  );
}

function KsLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "13px 0",
        borderTop: `1px solid ${tokens.color.border}`,
        fontSize: 14,
      }}
    >
      <span style={{ color: tokens.color.text2 }}>{label}</span>
      {children}
    </div>
  );
}

function AuditLog({ entries }: { entries: LogEntry[] }) {
  return (
    <Card
      flush
      style={{ display: "flex", flexDirection: "column", maxHeight: 460 }}
    >
      <div style={{ padding: "24px 24px 14px" }}>
        <CardHead
          title="Ceremony audit log"
          label="Read-only"
          style={{ marginBottom: 0 }}
        />
      </div>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          overflowY: "auto",
          padding: "4px 24px 20px",
        }}
      >
        {entries.map((e, i) => {
          const last = i === entries.length - 1;
          return (
            <li
              key={`${e.ts}-${i}`}
              className={e.isNew ? "bc-log-in" : undefined}
              style={{
                display: "flex",
                gap: 13,
                padding: "12px 0",
                borderTop:
                  i === 0 ? "none" : `1px solid ${tokens.color.border}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: tokens.radius.pill,
                    marginTop: 4,
                    flexShrink: 0,
                    background:
                      e.kind === "teal"
                        ? tokens.color.teal
                        : e.kind === "ok"
                          ? tokens.color.success
                          : tokens.color.border,
                  }}
                />
                {last ? null : (
                  <span
                    style={{
                      width: 2,
                      flex: 1,
                      background: tokens.color.border,
                      marginTop: 4,
                      minHeight: 8,
                    }}
                  />
                )}
              </span>
              <span style={{ paddingBottom: 2 }}>
                <span
                  className="bc-mono"
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: tokens.color.text2,
                    letterSpacing: 0.2,
                  }}
                >
                  {e.ts}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 14,
                    color: tokens.color.text1,
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}
                >
                  <b style={{ fontWeight: 600 }}>{e.lead}</b>
                  {e.detail ? ` — ${e.detail}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Footer() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${tokens.color.border}`,
        marginTop: 14,
        padding: "24px 0 40px",
      }}
    >
      <div
        style={{
          ...wrap,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 13.5,
          color: tokens.color.text2,
        }}
      >
        <ShieldCheckIcon size={16} strokeWidth={1.5} />
        Every action in this ceremony is signed and recorded to the public
        bulletin board, where anyone can independently verify it.
      </div>
    </footer>
  );
}

// Translate a Bulletin into the Trustee[] roster used by the UI. If the live
// bulletin has an election with trustees, prefer it; otherwise fall back to
// the mock so the demo still renders before admin/voter steps have run.
function deriveRoster(
  bulletin: Bulletin | null,
  fallback: Trustee[],
): Trustee[] {
  if (
    !bulletin ||
    !bulletin.election ||
    bulletin.election.trustees.length === 0
  ) {
    return fallback;
  }
  const submittedIds = new Set(
    bulletin.partial_decryptions.map((p) => p.trustee_id),
  );
  return bulletin.election.trustees.map((entry, idx) => {
    const numericId =
      Number.parseInt(entry.id.replace(/[^0-9]/g, ""), 10) || idx + 1;
    return {
      id: numericId,
      name: entry.name,
      role: fallback[idx]?.role ?? "Election trustee",
      status: submittedIds.has(entry.id) ? "Submitted" : "Pending",
      isYou: entry.id === YOU_TRUSTEE_ID,
    };
  });
}

export default function App() {
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [trustees, setTrustees] = useState<Trustee[]>(TRUSTEES);
  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBulletin()
      .then((b) => {
        if (cancelled) return;
        setBulletin(b);
        setTrustees(deriveRoster(b, TRUSTEES));
      })
      .catch(() => {
        // Not inside Tauri (e.g. vite dev or vitest) — keep mock display.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submittedCount = useMemo(
    () => trustees.filter((t) => t.status === "Submitted").length,
    [trustees],
  );

  function markSelfSubmitted(next: Trustee[]): Trustee[] {
    return next.map((t) =>
      t.isYou ? { ...t, status: "Submitted" as TrusteeStatus } : t,
    );
  }

  async function confirm() {
    setSubmitError(null);
    let detail = "submitted partial decryption";
    try {
      const updated = await submitAllPartialDecryptions(
        YOU_TRUSTEE_ID,
        DEMO_SECRET_SHARE,
      );
      const mine = updated.partial_decryptions.filter(
        (p) => p.trustee_id === YOU_TRUSTEE_ID,
      ).length;
      detail = `submitted ${mine} partial decryption${mine === 1 ? "" : "s"}`;
      setBulletin(updated);
      setTrustees((prev) => markSelfSubmitted(deriveRoster(updated, prev)));
    } catch (err) {
      // No Tauri runtime in tests or dev preview — degrade gracefully so the
      // visible flow still completes for the demo.
      setSubmitError(err instanceof Error ? err.message : String(err));
      detail = "submitted partial decryption (offline)";
      setTrustees(markSelfSubmitted);
    }
    setLog((prev) => [
      ...prev,
      {
        ts: nowLogStamp(),
        lead: `Trustee ${YOU_ORDINAL} (You — ${YOU_NAME})`,
        detail,
        kind: "teal",
        isNew: true,
      },
    ]);
    setPhase("submitted");
  }

  const thresholdMet = submittedCount >= THRESHOLD_REQUIRED;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.color.bg,
        color: tokens.color.text1,
        fontFamily: tokens.type.fontFamily,
        fontSize: tokens.type.body,
        lineHeight: tokens.type.lineHeight,
      }}
    >
      <TopBar />

      <main style={wrap}>
        <div
          style={{
            padding: "30px 0 22px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: tokens.type.eyebrow,
                fontWeight: 600,
                letterSpacing: 0.8,
                color: tokens.color.text2,
                textTransform: "uppercase",
              }}
            >
              Active Ceremony
            </div>
            <h1
              style={{
                fontSize: 27,
                fontWeight: 700,
                margin: "9px 0 0",
                letterSpacing: 0.1,
              }}
            >
              Decryption Ceremony
            </h1>
            <div
              style={{
                color: tokens.color.text2,
                fontSize: 14.5,
                marginTop: 6,
              }}
            >
              {bulletin?.election?.name ?? ELECTION_NAME} · {POLLS_CLOSED_AT}
            </div>
          </div>
          <Chip variant={thresholdMet ? "success" : "teal"} dot>
            {thresholdMet ? "Threshold reached" : "Ready — awaiting your share"}
          </Chip>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 22,
            alignItems: "start",
            paddingBottom: 18,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <ThresholdCard trustees={trustees} submitted={submittedCount} />
            <ActionCard
              phase={phase}
              onStart={() => setPhase("confirm")}
              onCancel={() => setPhase("idle")}
              onConfirm={confirm}
              submitError={submitError}
              thresholdMet={thresholdMet}
            />
            <VerificationCard
              ballotCount={bulletin?.ballots.length ?? BALLOT_COUNT}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <KeyShareCard />
            <AuditLog entries={log} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
