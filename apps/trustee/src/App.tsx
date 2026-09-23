import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  tokens,
  Card,
  CopyButton,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  AlertIcon,
  CheckIcon,
  LockIcon,
  ShieldCheckIcon,
} from "@balotachain/ui";
import { Chip, type ChipVariant } from "./components/Chip";
import { ProgressBar } from "./components/ProgressBar";
import {
  ApiError,
  getMe,
  login,
  logout,
  listRuns,
  loadCeremony,
  submitPartialDecryption,
  publishTally,
  subscribeEvents,
  boardUrl,
  type Ceremony,
  type CeremonyEvent,
  type CeremonyTrustee,
  type RunView,
  type Session,
} from "./lib/bulletin";

/**
 * `sent` = this page's submit was accepted (or refused 409 as already running)
 * and the next poll has not answered yet. Success itself is only ever read from
 * the console's `submitted`.
 */
type SubmitPhase = "idle" | "confirm" | "sent";

/** The console's own ceremony poll interval — the state of record. */
const POLL_MS = 4000;
/** Poll faster while a submit phase is running or has just been sent. */
const BUSY_POLL_MS = 1500;
/** A submit returns 202; give the dispatch a moment before the first re-poll. */
const AFTER_SUBMIT_MS = 700;

const STORAGE_KEY = "balota.trustee";

/**
 * `off` = the console has no auth routes (`/api/me` 404s): identity comes from
 * `?trustee=` as before. `in` = identity comes from the session, and the URL's
 * `?trustee=` is display only.
 */
type Auth =
  | { kind: "checking" }
  | { kind: "off" }
  | { kind: "login" }
  | { kind: "in"; session: Session };

type Load =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ceremony: Ceremony };

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

const noteText: CSSProperties = {
  fontSize: 13,
  color: tokens.color.text2,
  lineHeight: 1.5,
};

/**
 * The console has no trustee presence concept — a trustee is a name in a run's
 * config, never a connected client — so there is no honest "Offline" state.
 * Before setup runs, nobody can act; after it, a trustee has contributed or
 * has not.
 */
type RosterStatus = "Submitted" | "Pending" | "Not started";

function statusVariant(status: RosterStatus): ChipVariant {
  switch (status) {
    case "Submitted":
      return "success";
    case "Pending":
      return "warn";
    case "Not started":
      return "neutral";
  }
}

function rosterStatus(t: CeremonyTrustee, ready: boolean): RosterStatus {
  if (t.submitted) return "Submitted";
  return ready ? "Pending" : "Not started";
}

/** "Roberto Lim" -> "RL". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function formatStamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function positionLabel(id: string): string {
  const known: Record<string, string> = {
    president: "President",
    "vice-president": "Vice President",
    senator: "Senator",
  };
  return known[id] ?? id.replace(/-/g, " ");
}

function paramFromUrl(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

function setParamInUrl(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

/** Private windows throw on storage access, so every use is guarded. */
function remember(runId: string, trusteeId: string) {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}.${runId}`, trusteeId);
  } catch {
    /* not worth failing the page over */
  }
}

function recall(runId: string): string | null {
  try {
    return window.localStorage.getItem(`${STORAGE_KEY}.${runId}`);
  } catch {
    return null;
  }
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

function TopBar({
  you,
  ordinal,
  total,
  actionLabel,
  onAction,
}: {
  you: CeremonyTrustee | null;
  ordinal: number;
  total: number;
  actionLabel: string | null;
  onAction: () => void;
}) {
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
          minHeight: 64,
          flexWrap: "wrap",
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

        {you || actionLabel ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {you ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
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
                  {initialsOf(you.name)}
                </span>
                <span style={{ lineHeight: 1.25 }}>
                  <b
                    style={{ fontSize: 14, fontWeight: 600, display: "block" }}
                  >
                    {you.name}
                  </b>
                  <small style={{ fontSize: 12, color: tokens.color.text2 }}>
                    Trustee {ordinal} of {total}
                  </small>
                </span>
              </span>
            ) : null}
            {actionLabel ? (
              <SecondaryButton
                onClick={onAction}
                style={{
                  minHeight: 34,
                  padding: "0 12px",
                  fontSize: 13,
                  borderRadius: tokens.radius.button,
                  border: `1px solid ${tokens.color.border}`,
                  color: tokens.color.text2,
                }}
              >
                {actionLabel}
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function ThresholdCard({
  ceremony,
  youId,
}: {
  ceremony: Ceremony;
  youId: string | null;
}) {
  const { threshold, trustees, submitted, unlocked } = ceremony;
  const total = trustees.length;
  const remaining = Math.max(0, threshold - submitted);

  return (
    <Card>
      <CardHead
        title="Threshold Decryption"
        label={`Quorum ${threshold} of ${total}`}
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
            {threshold} of {total} trustees
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
          {Math.min(submitted, threshold)} of {threshold} submitted
        </div>
      </div>

      <ProgressBar value={Math.min(submitted, threshold)} max={threshold} />

      <div
        style={{
          fontSize: tokens.type.small,
          marginTop: 9,
          color: unlocked ? tokens.color.success : tokens.color.text2,
          fontWeight: unlocked ? 600 : 400,
        }}
      >
        {unlocked
          ? "Threshold reached — the final tally can now be decrypted."
          : `${remaining} more partial decryption${remaining === 1 ? "" : "s"} needed to reach the threshold.`}
      </div>

      <div
        style={{
          marginTop: 22,
          borderTop: `1px solid ${tokens.color.border}`,
        }}
      >
        {trustees.map((t, i) => {
          const status = rosterStatus(t, ceremony.ready);
          return (
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
                filled={t.id === youId}
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
                  {t.id === youId ? (
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
                  Holds 1 of {total} key shares
                  {t.contests > 0 ? ` · ${t.contests} partial decryptions` : ""}
                  {t.submitted_at ? ` · ${formatStamp(t.submitted_at)}` : ""}
                </div>
              </div>
              <Chip variant={statusVariant(status)} dot>
                {status}
              </Chip>
            </div>
          );
        })}
      </div>

      <p style={{ ...noteText, marginBottom: 0 }}>
        {ceremony.on_chain
          ? "The threshold is enforced by this console and proven by the independent verifier, which counts distinct verified trustees. The chaincode validates each share it accepts but does not itself count them before publishing."
          : "Local ceremony — real cryptographic shares, no ledger. The threshold gate is enforced here and proven at audit time."}
      </p>
    </Card>
  );
}

function ActionCard({
  ceremony,
  you,
  phase,
  onStart,
  onCancel,
  onConfirm,
  onPublish,
  error,
  publishing,
}: {
  ceremony: Ceremony;
  you: CeremonyTrustee;
  phase: SubmitPhase;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  onPublish: () => void;
  error: string | null;
  publishing: boolean;
}) {
  const done = you.submitted;
  const inFlight = !done && (you.submitting || phase === "sent");
  const failed = !done && !inFlight && Boolean(you.submit_error);
  // Another trustee's phase is running; the console would refuse with a 409.
  const waiting = Boolean(ceremony.busy) && ceremony.busy !== you.id;

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
          threshold is met once {ceremony.threshold} trustees submit.
        </p>

        {!ceremony.ready ? (
          <p
            style={{
              ...noteText,
              margin: 0,
              color: tokens.color.warnText,
            }}
          >
            This ceremony has not been set up yet. The election has to be
            generated and closed from the console's wizard before trustees can
            act.
          </p>
        ) : null}

        {ceremony.ready && inFlight ? (
          <p style={{ ...noteText, margin: 0, fontWeight: 600 }}>
            Recording your share…
          </p>
        ) : null}

        {ceremony.ready && failed ? (
          <div style={{ display: "grid", gap: tokens.space.sm }}>
            <p
              style={{
                ...noteText,
                margin: 0,
                color: tokens.color.warnText,
              }}
            >
              Your last submission failed: {you.submit_error}
            </p>
            <div>
              <PrimaryButton
                onClick={onStart}
                disabled={phase === "confirm" || waiting}
              >
                Try again
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {ceremony.ready && !done && !inFlight && !failed ? (
          <>
            <PrimaryButton
              onClick={onStart}
              disabled={phase === "confirm" || waiting}
            >
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

        {ceremony.ready && !done && !inFlight && waiting ? (
          <p style={{ ...noteText, margin: "10px 0 0" }}>
            Another trustee&apos;s share is being recorded; this unlocks when it
            finishes.
          </p>
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
              You are about to release {you.name}&apos;s{" "}
              {you.contests > 0 ? `${you.contests} ` : ""}partial decryption
              {you.contests === 1 ? "" : "s"} — one per contest. This cannot be
              undone, and the event is recorded to the audit log and the
              bulletin board.
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

        {done ? (
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
                {ceremony.unlocked
                  ? "Threshold reached — the final tally can now be published."
                  : "Waiting on the remaining trustees to reach the threshold."}
              </p>
            </div>
          </div>
        ) : null}

        {/* Publishing is the last act of the ceremony, so the button only
            appears once the threshold is actually met — below it the console
            refuses with a 409 anyway. */}
        {ceremony.unlocked && !ceremony.published ? (
          <div style={{ marginTop: tokens.space.sm }}>
            <PrimaryButton onClick={onPublish} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish the tally"}
            </PrimaryButton>
            <p style={{ ...noteText, margin: "10px 0 0" }}>
              This reveals the totals on the public bulletin board. The tally is
              the election's result as recorded; the ceremony gates when it
              becomes readable.
            </p>
          </div>
        ) : null}

        {ceremony.published ? (
          <p style={{ ...noteText, margin: "16px 0 0" }}>
            The tally was published{" "}
            {ceremony.published_at
              ? `on ${formatStamp(ceremony.published_at)}`
              : ""}{" "}
            —{" "}
            <a
              href={boardUrl(ceremony.election_id)}
              style={{ color: tokens.color.tealDark }}
            >
              see it on the bulletin board
            </a>
            .
          </p>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: tokens.space.sm,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "13px 16px",
              borderRadius: tokens.radius.button,
              background: tokens.color.warnLight,
              border: `1px solid ${tokens.color.warnBorder}`,
            }}
          >
            <span
              style={{
                color: tokens.color.warn,
                flexShrink: 0,
                display: "flex",
              }}
            >
              <AlertIcon size={18} strokeWidth={1.8} />
            </span>
            <span
              style={{
                fontSize: 13.5,
                color: tokens.color.warnText,
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              {error}
            </span>
          </div>
        ) : null}
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

function VerificationCard({ ceremony }: { ceremony: Ceremony }) {
  const fingerprint = ceremony.ballots_sha256
    ? `sha256:${ceremony.ballots_sha256}`
    : "";
  const positions = ceremony.position_ids?.length
    ? ceremony.position_ids.map(positionLabel).join(" · ")
    : `${ceremony.positions} positions`;

  return (
    <Card>
      <CardHead title="What is being decrypted" label="Verification context" />

      <VcLine label="Encrypted ballot set — fingerprint" first>
        {fingerprint ? (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              className="bc-mono"
              style={{
                fontSize: 13.5,
                color: tokens.color.tealDark,
                wordBreak: "break-all",
              }}
            >
              {fingerprint}
            </span>
            <CopyButton
              value={fingerprint}
              label="Copy ballot set fingerprint"
              size="sm"
            />
          </span>
        ) : (
          <span style={{ color: tokens.color.text2, fontWeight: 400 }}>
            not available yet
          </span>
        )}
      </VcLine>

      <VcLine label="Ballots aggregated">
        {ceremony.ballot_records.toLocaleString("en-US")}{" "}
        <span style={{ color: tokens.color.text2, fontWeight: 400 }}>
          ballot records
        </span>
      </VcLine>

      <VcLine label="Positions in tally">
        {ceremony.positions}{" "}
        <span style={{ color: tokens.color.text2, fontWeight: 400 }}>
          {positions}
        </span>
      </VcLine>

      <VcLine label="Contests">
        {ceremony.contests}{" "}
        <span style={{ color: tokens.color.text2, fontWeight: 400 }}>
          one per candidate per position
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
        The totals come from the homomorphic aggregate of all ballots.
        Individual ballots are never decrypted — only the combined totals are
        revealed.
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

function KeyShareCard({
  ceremony,
  you,
  ordinal,
  session,
}: {
  ceremony: Ceremony;
  you: CeremonyTrustee;
  ordinal: number;
  session: Session | null;
}) {
  const total = ceremony.trustees.length;
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
        <Avatar initials={initialsOf(you.name)} size={48} radius={13} filled />
        <div>
          <b
            style={{
              fontSize: tokens.type.body,
              fontWeight: 700,
              display: "block",
            }}
          >
            {you.name}
          </b>
          <small
            style={{ fontSize: tokens.type.small, color: tokens.color.text2 }}
          >
            Trustee {ordinal} of {total} · {ceremony.name}
          </small>
        </div>
      </div>

      <KsLine label="Key share status">
        <Chip variant={ceremony.ready ? "success" : "neutral"} dot>
          {ceremony.ready ? "Held securely" : "Not issued yet"}
        </Chip>
      </KsLine>
      <KsLine label="Shares you hold">
        <span style={{ fontWeight: 600 }}>
          {you.contests} of {ceremony.contests} contests
        </span>
      </KsLine>
      <KsLine label="DKG transcript">
        <span className="bc-mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {ceremony.dkg_sha256
            ? `sha256:${ceremony.dkg_sha256.slice(0, 16)}…`
            : "—"}
        </span>
      </KsLine>
      <KsLine label="Ceremony opened">
        <span style={{ fontWeight: 600 }}>
          {formatStamp(ceremony.started_at) || "not started"}
        </span>
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
        Key share material is never shown here and never reaches the browser.
        Only a partial decryption — which reveals nothing on its own — is
        recorded.{" "}
        {session
          ? `Signed in as ${session.username}: the console accepts this trustee's shares only from this account.`
          : "This research console has no trustee authentication: anyone who can open this page can act as any trustee."}
      </div>
    </Card>
  );
}

function AuditLog({
  events,
  live,
}: {
  events: CeremonyEvent[];
  live: string[];
}) {
  const rows: {
    key: string;
    ts: string;
    lead: string;
    detail?: string;
    kind?: string;
  }[] = events.map((e, i) => ({
    key: `e${i}`,
    ts: formatStamp(e.at) || "—",
    lead: e.who ? e.who : e.text,
    detail: e.who
      ? e.text
      : e.tx_id
        ? `block ${e.block} · ${e.tx_id.slice(0, 16)}…`
        : undefined,
    kind:
      e.kind === "published" ? "ok" : e.kind === "chain" ? undefined : "teal",
  }));

  for (const [i, msg] of live.entries()) {
    rows.push({ key: `l${i}`, ts: "live", lead: msg, kind: "teal" });
  }

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
        {rows.length === 0 ? (
          <li style={{ ...noteText, padding: "12px 0" }}>
            Nothing has happened in this ceremony yet.
          </li>
        ) : null}
        {rows.map((e, i) => {
          const last = i === rows.length - 1;
          return (
            <li
              key={e.key}
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

function IdentityPicker({
  ceremony,
  onPick,
}: {
  ceremony: Ceremony;
  onPick: (id: string) => void;
}) {
  return (
    <Card>
      <CardHead title="Who are you?" label={ceremony.name} />
      <p style={{ ...noteText, marginTop: 0 }}>
        Pick the institution you are acting for. This console has no
        authentication — the choice only decides which share is submitted.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 16,
        }}
      >
        {ceremony.trustees.map((t) => (
          <SecondaryButton
            key={t.id}
            onClick={() => onPick(t.id)}
            style={{
              justifyContent: "flex-start",
              gap: 12,
              minHeight: 56,
              padding: "0 16px",
              borderRadius: tokens.radius.button,
              border: `1.5px solid ${tokens.color.border}`,
              color: tokens.color.text1,
            }}
          >
            <Avatar
              initials={initialsOf(t.name)}
              size={34}
              radius={10}
              filled={false}
            />
            <span style={{ textAlign: "left" }}>
              <b style={{ display: "block", fontSize: 15 }}>{t.name}</b>
              <small style={{ fontSize: 12.5, color: tokens.color.text2 }}>
                Trustee {t.id}
                {t.submitted ? " · already contributed" : ""}
              </small>
            </span>
          </SecondaryButton>
        ))}
      </div>
    </Card>
  );
}

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      onSignedIn();
    } catch (err) {
      // "invalid credentials", or the lockout 429 — shown exactly as sent.
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const label: CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: tokens.color.text2,
    marginBottom: 6,
  };

  return (
    <main style={{ ...wrap, padding: "60px 28px", maxWidth: 520 }}>
      <Card>
        <CardHead title="Sign in" label="Trustee console" />
        <p style={{ ...noteText, marginTop: 0 }}>
          Sign in with the account for your institution. Your trustee identity
          comes from this account, not from the link you opened.
        </p>
        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <label>
            <span style={label}>Username</span>
            <TextInput
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.currentTarget.value)}
            />
          </label>
          <label>
            <span style={label}>Password</span>
            <TextInput
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
          {error ? (
            <span
              role="alert"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: tokens.color.error,
              }}
            >
              {error}
            </span>
          ) : null}
          <PrimaryButton
            type="submit"
            disabled={busy || !username || !password}
          >
            {busy ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </form>
        <p style={{ ...noteText, marginBottom: 0 }}>
          Demo-grade access control: accounts come from a file and sessions end
          when the console restarts.
        </p>
      </Card>
    </main>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <main style={{ ...wrap, padding: "60px 28px" }}>
      <Card>
        <p style={{ margin: 0, fontSize: 15, color: tokens.color.text2 }}>
          {children}
        </p>
      </Card>
    </main>
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
        Every action in this ceremony is recorded to the public bulletin board,
        where anyone can independently verify it.
      </div>
    </footer>
  );
}

export default function App() {
  const [auth, setAuth] = useState<Auth>({ kind: "checking" });
  const [runId, setRunId] = useState<string | null>(paramFromUrl("run"));
  const [trusteeId, setTrusteeId] = useState<string | null>(
    paramFromUrl("trustee"),
  );
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [live, setLive] = useState<string[]>([]);
  /** When this page last sent a submit; a poll started after it ends `sent`. */
  const sentAt = useRef(0);

  // Anything other than "no session" (401) reads as auth off: a console that
  // cannot answer /api/me will fail the ceremony load too, and say so there.
  const checkSession = useCallback(() => {
    getMe()
      .then((session) =>
        setAuth(session ? { kind: "in", session } : { kind: "off" }),
      )
      .catch((e) =>
        setAuth(
          e instanceof ApiError && e.status === 401
            ? { kind: "login" }
            : { kind: "off" },
        ),
      );
  }, []);

  useEffect(checkSession, [checkSession]);

  // Pick a run: the URL wins, otherwise the newest one with a ceremony.
  // Ground-truth runs encrypt nothing, so they have no ceremony at all.
  useEffect(() => {
    if (runId) return;
    const ctrl = new AbortController();
    listRuns(ctrl.signal)
      .then((all: RunView[]) => {
        const usable = all.filter((r) => r.config.mode !== "groundtruth");
        if (usable.length === 0) {
          setLoad({ kind: "empty" });
          return;
        }
        setRunId(usable[0].run_id);
        setParamInUrl("run", usable[0].run_id);
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return;
        setLoad({ kind: "error", message: e.message });
      });
    return () => ctrl.abort();
  }, [runId]);

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      if (!runId) return;
      const started = Date.now();
      loadCeremony(runId, signal)
        .then((ceremony) => {
          setLoad({ kind: "ready", ceremony });
          // The console has now seen the submit: its state takes over.
          if (started >= sentAt.current)
            setPhase((p) => (p === "sent" ? "idle" : p));
        })
        .catch((e: Error) => {
          if (signal?.aborted) return;
          setLoad({ kind: "error", message: e.message });
        });
    },
    [runId],
  );

  // The poll is the state of record; on-chain it is also what re-reads the
  // ledger, since the console reconnects per call.
  useEffect(() => {
    if (!runId) return;
    const ctrl = new AbortController();
    refresh(ctrl.signal);
    return () => ctrl.abort();
  }, [runId, refresh]);

  const fast =
    phase === "sent" || (load.kind === "ready" && Boolean(load.ceremony.busy));
  useEffect(() => {
    if (!runId) return;
    const timer = window.setInterval(
      () => refresh(),
      fast ? BUSY_POLL_MS : POLL_MS,
    );
    return () => window.clearInterval(timer);
  }, [runId, refresh, fast]);

  // SSE is a liveness cue only — the hub drops events for slow subscribers and
  // has no replay, so nothing is derived from it. With auth on, `/events`
  // requires a session: don't open it while signed out, and reconnect when
  // the signed-in identity changes (not just on mount / runId change), so a
  // sign-in on this same page picks the stream up without a reload.
  const sessionKey = auth.kind === "in" ? auth.session.username : null;
  useEffect(() => {
    if (!runId) return;
    if (auth.kind === "checking" || auth.kind === "login") return;
    return subscribeEvents(runId, (e) => {
      if (e.phase !== "ceremony") return;
      setLive((prev) => [...prev.slice(-9), e.msg]);
    });
  }, [runId, auth.kind, sessionKey]);

  // Restore the last identity used for this run — only without auth, where the
  // choice is the identity. With auth the session decides.
  useEffect(() => {
    if (auth.kind !== "off" || !runId || trusteeId) return;
    const saved = recall(runId);
    if (saved) {
      setTrusteeId(saved);
      setParamInUrl("trustee", saved);
    }
  }, [auth.kind, runId, trusteeId]);

  /** A 401 from any call means the session is gone: back to sign-in. */
  function fail(e: unknown): string {
    if (e instanceof ApiError && e.status === 401) setAuth({ kind: "login" });
    return e instanceof Error ? e.message : String(e);
  }

  function pickTrustee(id: string) {
    setTrusteeId(id);
    setParamInUrl("trustee", id);
    if (runId) remember(runId, id);
    setPhase("idle");
    setError(null);
  }

  const session = auth.kind === "in" ? auth.session : null;
  // With auth on, the acting trustee is the session's, whatever the link says.
  const actingId = session
    ? session.role === "trustee"
      ? (session.trustee_id ?? null)
      : null
    : trusteeId;

  async function confirm() {
    if (!runId || !actingId) return;
    setError(null);
    try {
      await submitPartialDecryption(runId, actingId);
    } catch (e) {
      // Only these two 409s mean a phase is already running (this trustee's
      // or another's): not a failure of this click; the next poll says which.
      // Every other 409 (election not closed, network reset, peer fault) is.
      const inFlight =
        e instanceof ApiError &&
        e.status === 409 &&
        (e.message ===
          `trustee ${actingId}'s shares are already being recorded` ||
          e.message === "a phase is already running on this run");
      if (!inFlight) {
        // A 403 (not this session's shares) is already the right sentence.
        setError(fail(e));
        setPhase("idle");
        return;
      }
    }
    sentAt.current = Date.now();
    setPhase("sent");
    // A 202 means accepted, not done — re-poll rather than assume.
    window.setTimeout(() => refresh(), AFTER_SUBMIT_MS);
  }

  async function onPublish() {
    if (!runId) return;
    setError(null);
    setPublishing(true);
    try {
      await publishTally(runId);
      window.setTimeout(() => refresh(), AFTER_SUBMIT_MS);
    } catch (e) {
      // The console's below-threshold 409 body is already the right message.
      setError(fail(e));
    } finally {
      setPublishing(false);
    }
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      setPhase("idle");
      setError(null);
      setAuth({ kind: "login" });
    }
  }

  const ceremony = load.kind === "ready" ? load.ceremony : null;
  const you = ceremony?.trustees.find((t) => t.id === actingId) ?? null;
  const ordinal = you ? ceremony!.trustees.indexOf(you) + 1 : 0;
  const unknownIdentity = Boolean(ceremony && actingId && !you);
  // A signed-in trustee opened someone else's ?trustee= link.
  const linked =
    session?.role === "trustee" && trusteeId && trusteeId !== actingId
      ? (ceremony?.trustees.find((t) => t.id === trusteeId) ?? null)
      : null;
  const showing = auth.kind === "off" || auth.kind === "in";

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
      <TopBar
        you={showing ? you : null}
        ordinal={ordinal}
        total={ceremony?.trustees.length ?? 0}
        actionLabel={
          !showing ? null : session ? "Sign out" : you ? "Not you?" : null
        }
        onAction={session ? signOut : () => setTrusteeId(null)}
      />

      {auth.kind === "login" ? (
        <Login
          onSignedIn={() => {
            setAuth({ kind: "checking" });
            checkSession();
          }}
        />
      ) : null}

      {auth.kind === "checking" || (showing && load.kind === "loading") ? (
        <Notice>Loading the ceremony…</Notice>
      ) : null}
      {showing && load.kind === "empty" ? (
        <Notice>
          No elections have been run on this console yet. Run one from the
          console&apos;s wizard, then reload this page.
        </Notice>
      ) : null}
      {showing && load.kind === "error" ? (
        <Notice>Could not reach the election console — {load.message}</Notice>
      ) : null}

      {showing && ceremony ? (
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
                {ceremony.name}
                {ceremony.closed_at
                  ? ` · closed ${formatStamp(ceremony.closed_at)}`
                  : ""}
              </div>
            </div>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Chip variant={ceremony.on_chain ? "teal" : "neutral"} dot>
                {ceremony.on_chain ? "On-chain ceremony" : "Local ceremony"}
              </Chip>
              <Chip
                variant={
                  ceremony.published
                    ? "success"
                    : ceremony.unlocked
                      ? "success"
                      : ceremony.ready
                        ? "teal"
                        : "neutral"
                }
                dot
              >
                {ceremony.published
                  ? "Tally published"
                  : ceremony.unlocked
                    ? "Threshold reached"
                    : ceremony.ready
                      ? "Awaiting shares"
                      : "Not started"}
              </Chip>
            </span>
          </div>

          {linked ? (
            <div style={{ marginBottom: 22 }}>
              <Card>
                <p
                  style={{ margin: 0, fontSize: 15, color: tokens.color.text2 }}
                >
                  This link is for trustee {linked.id} ({linked.name}). You are
                  signed in as {session?.username}
                  {you ? `, trustee ${you.id} (${you.name})` : ""}, so you can
                  submit only {you ? `${you.name}'s` : "your own"} share, not{" "}
                  {linked.name}&apos;s.
                </p>
              </Card>
            </div>
          ) : null}

          {session?.role === "admin" ? (
            <div style={{ marginBottom: 22 }}>
              <Card>
                <p
                  style={{ margin: 0, fontSize: 15, color: tokens.color.text2 }}
                >
                  Signed in as {session.username}, an administrator. Trustees
                  submit their own shares, so this page is read-only for you.
                  Publish the tally from the admin console.
                </p>
              </Card>
            </div>
          ) : null}

          {unknownIdentity ? (
            <div style={{ marginBottom: 22 }}>
              <Notice>
                No trustee {actingId} in this election. Valid ids are{" "}
                {ceremony.trustees.map((t) => t.id).join(", ")}.
              </Notice>
            </div>
          ) : null}

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
              <ThresholdCard ceremony={ceremony} youId={actingId} />
              {you ? (
                <ActionCard
                  ceremony={ceremony}
                  you={you}
                  phase={phase}
                  onStart={() => setPhase("confirm")}
                  onCancel={() => setPhase("idle")}
                  onConfirm={confirm}
                  onPublish={onPublish}
                  error={error}
                  publishing={publishing}
                />
              ) : auth.kind === "off" ? (
                <IdentityPicker ceremony={ceremony} onPick={pickTrustee} />
              ) : null}
              <VerificationCard ceremony={ceremony} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {you ? (
                <KeyShareCard
                  ceremony={ceremony}
                  you={you}
                  ordinal={ordinal}
                  session={session}
                />
              ) : null}
              <AuditLog events={ceremony.events} live={live} />
            </div>
          </div>
        </main>
      ) : null}

      <Footer />
    </div>
  );
}
