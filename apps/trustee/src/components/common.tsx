/**
 * Pieces shared by the study view (`App.tsx`) and the live trustee view
 * (`live/LiveApp.tsx`): the same drawn shapes on both.
 */
import {
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  tokens,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from "@balotachain/ui";
import { login } from "../lib/bulletin";

export const cardLabel: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: tokens.color.text2,
};

export const noteText: CSSProperties = {
  fontSize: 13,
  color: tokens.color.text2,
  lineHeight: 1.5,
};

/** "Roberto Lim" -> "RL". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function formatStamp(iso?: string): string {
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

export function Avatar({
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

export function CardHead({
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

export function KsLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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

export function Login({
  onSignedIn,
  tag = "Trustee console",
  intro = "Sign in with the account for your institution. Your trustee identity comes from this account, not from the link you opened.",
  note = "Demo-grade access control: accounts come from a file and sessions end when the console restarts.",
}: {
  onSignedIn: () => void;
  /** The card's right-hand label. */
  tag?: string;
  intro?: string;
  note?: string;
}) {
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
    <main
      className="bc-wrap"
      style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 520 }}
    >
      <Card>
        <CardHead title="Sign in" label={tag} />
        <p style={{ ...noteText, marginTop: 0 }}>{intro}</p>
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
        <p style={{ ...noteText, marginBottom: 0 }}>{note}</p>
      </Card>
    </main>
  );
}

export function Notice({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <main className="bc-wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
      <Card>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: tokens.color.text2,
            overflowWrap: "anywhere",
          }}
        >
          {children}
        </p>
        {onRetry ? (
          <div style={{ marginTop: tokens.space.sm }}>
            <SecondaryButton onClick={onRetry}>Retry</SecondaryButton>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
