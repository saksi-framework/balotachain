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
  PrimaryButton,
  SecondaryButton,
  TextButton,
  TextInput,
  ShieldCheckIcon,
  CheckIcon,
  CopyIcon,
  AlertIcon,
} from "@balotachain/ui";
import { Chip } from "./components/Chip";
import { Stepper } from "./components/Stepper";
import {
  ApiError,
  getMe,
  login,
  logout,
  listRuns,
  getCapabilities,
  generateElection,
  checkPopulation,
  loadElectionSummary,
  runStatus,
  resumeRun,
  startCeremony,
  loadCeremony,
  publishTally,
  verifyRun,
  loadCorrectness,
  subscribeEvents,
  boardUrl,
  trailUrl,
  trusteeUrl,
  type Capabilities,
  type Ceremony,
  type CheckReport,
  type ContestResult,
  type ElectionConfig,
  type ElectionSummary,
  type RunView,
  type Session,
} from "./lib/bulletin";
import {
  DEFAULT_FORM,
  IDLE_PROGRESS,
  MAX_TRUSTEES,
  contestLabel,
  positionLabels,
  reduceProgress,
  runState,
  stepFor,
  toElectionConfig,
  validateConfig,
  type ElectionForm,
  type Progress,
  type Step,
} from "./lib/election";

type Auth =
  | { kind: "checking" }
  /** The console has no auth routes (`/api/me` 404s): no login at all. */
  | { kind: "off" }
  | { kind: "login" }
  | { kind: "in"; session: Session }
  | { kind: "unreachable"; message: string };

/** Turns a failed call into display text; a 401 also sends the app to login. */
type Fail = (e: unknown) => string;

/** `run` is the list row an existing election was opened from. */
type Active = { runId: string; config: ElectionConfig; run?: RunView };

// The Stepper badge already carries the number; five "1 Election"-style
// labels truncate at the page width.
const STEPS = [
  { label: "Election" },
  { label: "Population" },
  { label: "Run" },
  { label: "Ceremony" },
  { label: "Results" },
];

const PAGE_MAX = 960;
const FIELD_MAX = 480;
/** How often a running phase re-reads its state of record. */
const PHASE_POLL_MS = 1500;
/** The console's own ceremony poll interval. */
const CEREMONY_POLL_MS = 4000;
/** A publish returns 202; give the dispatch a moment before re-reading. */
const AFTER_POST_MS = 700;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs `fn` now and every `ms`; `null` stops it. */
function useInterval(fn: () => void, ms: number | null) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (ms === null) return;
    latest.current();
    const timer = window.setInterval(() => latest.current(), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
}

/** Folds one phase's SSE stream into a Progress for as long as it is mounted. */
function usePhaseEvents(runId: string, phase: string) {
  const [progress, setProgress] = useState<Progress>(IDLE_PROGRESS);
  useEffect(
    () =>
      subscribeEvents(runId, (e) =>
        setProgress((p) => reduceProgress(p, e, phase)),
      ),
    [runId, phase],
  );
  return [progress, setProgress] as const;
}

function Header({ auth, onSignOut }: { auth: Auth; onSignOut: () => void }) {
  return (
    <header
      style={{
        height: 56,
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: PAGE_MAX,
          margin: "0 auto",
          width: "100%",
          padding: `0 ${tokens.space.md}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space.sm,
        }}
      >
        <div
          style={{
            fontFamily: tokens.type.fontFamily,
            fontSize: tokens.type.body,
            fontWeight: 700,
            color: tokens.color.text1,
            letterSpacing: 0.2,
          }}
        >
          BalotaChain — Admin
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: tokens.space.xs,
            color: tokens.color.text2,
            fontSize: 14,
          }}
        >
          <ShieldCheckIcon size={18} style={{ color: tokens.color.teal }} />
          {auth.kind === "in" ? (
            <>
              <span>
                {auth.session.username} · {auth.session.role}
              </span>
              <TextButton onClick={onSignOut} style={{ fontSize: 14 }}>
                Sign out
              </TextButton>
            </>
          ) : auth.kind === "off" ? (
            <span>Console authentication is off</span>
          ) : (
            <span>Research election console</span>
          )}
        </div>
      </div>
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", maxWidth: FIELD_MAX }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: tokens.color.text2,
          marginBottom: 6,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function SectionTitle({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: tokens.space.md,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: tokens.space.sm,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: tokens.type.h2,
            fontWeight: 700,
            color: tokens.color.text1,
            lineHeight: tokens.type.lineHeight,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              margin: `${tokens.space.xs}px 0 0 0`,
              color: tokens.color.text2,
              fontSize: tokens.type.body,
              lineHeight: tokens.type.lineHeight,
              maxWidth: 640,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {aside}
    </div>
  );
}

function Banner({
  variant,
  children,
}: {
  variant: "success" | "error" | "note";
  children: ReactNode;
}) {
  const palette = {
    success: {
      fg: tokens.color.success,
      bg: "rgba(46, 125, 91, 0.08)",
      border: "rgba(46, 125, 91, 0.24)",
    },
    error: {
      fg: tokens.color.error,
      bg: "rgba(192, 57, 43, 0.08)",
      border: "rgba(192, 57, 43, 0.24)",
    },
    note: {
      fg: tokens.color.text2,
      bg: tokens.color.bg,
      border: tokens.color.border,
    },
  }[variant];
  const Icon =
    variant === "success"
      ? CheckIcon
      : variant === "error"
        ? AlertIcon
        : ShieldCheckIcon;
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: tokens.space.xs,
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: tokens.radius.button,
        color: palette.fg,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.5,
        marginBottom: tokens.space.md,
      }}
    >
      <span style={{ color: palette.fg, display: "inline-flex", marginTop: 1 }}>
        <Icon size={18} />
      </span>
      <span>{children}</span>
    </div>
  );
}

function MonoText({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: tokens.type.mono,
        fontSize: 13,
        color: tokens.color.text1,
        wordBreak: "break-all",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // clipboard unavailable in some sandboxes
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "transparent",
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        padding: "4px 8px",
        cursor: "pointer",
        color: copied ? tokens.color.success : tokens.color.text2,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: tokens.type.fontFamily,
        flexShrink: 0,
      }}
      aria-label="Copy"
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{
        display: "block",
        width: "100%",
        padding: tokens.space.sm,
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        color: tokens.color.text1,
        fontSize: tokens.type.body,
        fontFamily: tokens.type.fontFamily,
        lineHeight: tokens.type.lineHeight,
        outline: "none",
        appearance: "none",
      }}
    >
      {children}
    </select>
  );
}

function PositionTile({ title, pick }: { title: string; pick: string }) {
  return (
    <div
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        padding: tokens.space.sm,
        background: tokens.color.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.space.sm,
      }}
    >
      <span
        style={{
          color: tokens.color.text1,
          fontSize: tokens.type.body,
          fontWeight: 600,
        }}
      >
        {title}
      </span>
      <Chip variant="neutral">{pick}</Chip>
    </div>
  );
}

const cell: CSSProperties = {
  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
  fontSize: 14,
  color: tokens.color.text1,
  borderTop: `1px solid ${tokens.color.border}`,
  textAlign: "left",
  verticalAlign: "middle",
};

const headCell: CSSProperties = {
  ...cell,
  color: tokens.color.text2,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  borderTop: "none",
  background: tokens.color.bg,
};

/** The mockup's voter-roll table, generalised to any columns. */
function Table({
  head,
  children,
  empty,
}: {
  head: ReactNode[];
  children: ReactNode[];
  empty: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        overflowX: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={headCell}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children.length === 0 ? (
            <tr>
              <td
                style={{
                  ...cell,
                  color: tokens.color.text2,
                  fontStyle: "italic",
                }}
                colSpan={head.length}
              >
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: tokens.space.xs }}
    >
      <span
        style={{
          width: 120,
          fontSize: 12,
          color: tokens.color.text2,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <MonoText style={{ flex: 1 }}>{value}</MonoText>
      <CopyButton value={value} />
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        padding: tokens.space.sm,
        background: tokens.color.bg,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: tokens.color.text2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: tokens.type.h3, fontWeight: 700, marginTop: 2 }}>
        {value}
      </div>
      {detail ? (
        <div style={{ fontSize: 13, color: tokens.color.text2, marginTop: 2 }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: tokens.space.xs,
      }}
    >
      {children}
    </div>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: tokens.space.sm,
        marginTop: tokens.space.md,
        flexWrap: "wrap",
      }}
    >
      {children}
    </div>
  );
}

function Log({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div
      style={{
        marginTop: tokens.space.sm,
        maxHeight: 220,
        overflowY: "auto",
        background: tokens.color.bg,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        padding: tokens.space.xs,
      }}
    >
      {lines.map((l, i) => (
        <div key={i}>
          <MonoText style={{ color: tokens.color.text2 }}>{l}</MonoText>
        </div>
      ))}
    </div>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{
        height: 10,
        background: tokens.color.neutralFill,
        borderRadius: tokens.radius.pill,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct * 100}%`,
          height: "100%",
          background: tokens.color.teal,
          borderRadius: tokens.radius.pill,
        }}
      />
    </div>
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
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Sign in"
        subtitle="Administrators create elections and run the lifecycle. Accounts come from the console's user file."
      />
      {error && <Banner variant="error">{error}</Banner>}
      <form onSubmit={submit} style={{ display: "grid", gap: tokens.space.md }}>
        <Field label="Username">
          <TextInput
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <PrimaryButton
            type="submit"
            disabled={busy || !username || !password}
          >
            {busy ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </div>
      </form>
    </Card>
  );
}

const rowButton: CSSProperties = {
  minHeight: 36,
  padding: "0 14px",
  fontSize: 14,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function Elections({
  fail,
  onOpen,
  onNew,
}: {
  fail: Fail;
  onOpen: (run: RunView) => void;
  onNew: () => void;
}) {
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  async function resume(r: RunView) {
    setError(null);
    setResuming(true);
    try {
      await resumeRun(r.run_id);
      // Accepted: the phase now holds the run, so follow it on the Run step.
      onOpen({ ...r, busy: true, resumable: false });
    } catch (e) {
      // The route's 409 names why the run cannot be resumed.
      setError(fail(e));
      setResuming(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    listRuns(ctrl.signal)
      // Ground-truth runs encrypt nothing, so they have no ceremony to run.
      .then((all) =>
        setRuns(all.filter((r) => r.config.mode !== "groundtruth")),
      )
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(fail(e));
      });
    return () => ctrl.abort();
  }, [fail]);

  return (
    <Card>
      <SectionTitle
        title="Elections"
        subtitle="Each election is a run on this console: generated, encrypted, decrypted by its trustees, and verified."
        aside={<PrimaryButton onClick={onNew}>New election</PrimaryButton>}
      />
      {error && <Banner variant="error">{error}</Banner>}
      {runs === null && !error ? (
        <p style={{ color: tokens.color.text2, margin: 0 }}>Loading…</p>
      ) : null}
      {runs ? (
        <Table
          head={["Election", "Mode", "Voters", "Created", "Status", ""]}
          empty="No elections on this console yet."
        >
          {runs.map((r) => {
            const s = runState(r);
            return (
              <tr key={r.run_id}>
                <td style={cell}>
                  <div style={{ fontWeight: 600 }}>{r.config.name}</div>
                  <MonoText style={{ fontSize: 12, color: tokens.color.text2 }}>
                    {r.run_id}
                  </MonoText>
                </td>
                <td style={cell}>
                  <Chip variant="neutral">
                    {r.config.mode === "onchain" ? "On-chain" : "Offline"}
                  </Chip>
                </td>
                <td style={cell}>{r.config.voters.toLocaleString("en-US")}</td>
                <td style={cell}>{formatDate(r.created_at)}</td>
                <td style={cell}>
                  <Chip variant={s.variant}>{s.label}</Chip>
                  {s.detail ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.color.text2,
                        marginTop: 4,
                      }}
                    >
                      {s.detail}
                    </div>
                  ) : null}
                </td>
                <td style={cell}>
                  <div style={{ display: "flex", gap: tokens.space.xs }}>
                    {r.resumable && !r.busy ? (
                      <PrimaryButton
                        onClick={() => resume(r)}
                        disabled={resuming}
                        style={rowButton}
                      >
                        Resume
                      </PrimaryButton>
                    ) : null}
                    <SecondaryButton
                      onClick={() => onOpen(r)}
                      style={rowButton}
                    >
                      Open
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      ) : null}
    </Card>
  );
}

const numberInput = (value: string, onChange: (v: string) => void, min = 0) => (
  <TextInput
    type="number"
    inputMode="numeric"
    min={min}
    step={1}
    value={value}
    onChange={(e) => onChange(e.currentTarget.value)}
  />
);

function ElectionStep({
  caps,
  fail,
  onCancel,
  onCreated,
}: {
  caps: Capabilities | null;
  fail: Fail;
  onCancel: () => void;
  onCreated: (runId: string, config: ElectionConfig) => void;
}) {
  const [form, setForm] = useState<ElectionForm>(DEFAULT_FORM);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const config = toElectionConfig(form);
  const problem = validateConfig(config);
  const set = <K extends keyof ElectionForm>(k: K, v: ElectionForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setTrustee = (i: number, name: string) =>
    set(
      "trustees",
      form.trustees.map((t, j) => (j === i ? name : t)),
    );

  const labels = positionLabels(config.positions);
  const PREVIEW = 8;

  async function create() {
    setBusy(true);
    setServerError(null);
    try {
      const runId = await generateElection(config);
      onCreated(runId, config);
    } catch (e) {
      // Validate, the ladder gate, the disk guard, a missing Fabric network:
      // the console's text is the explanation, so it is shown as sent.
      setServerError(fail(e));
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Create election"
        subtitle="The console generates a synthetic population for this election: voters, their credentials, and every encrypted ballot."
      />
      <div style={{ display: "grid", gap: tokens.space.md }}>
        <Field label="Election name">
          <TextInput
            value={form.name}
            onChange={(e) => set("name", e.currentTarget.value)}
          />
        </Field>

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: tokens.color.text2,
              marginBottom: 6,
              letterSpacing: 0.2,
            }}
          >
            Trustees ({form.trustees.length})
          </div>
          <div
            style={{
              display: "grid",
              gap: tokens.space.xs,
              maxWidth: FIELD_MAX,
            }}
          >
            {form.trustees.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: tokens.space.xs }}>
                <TextInput
                  aria-label={`Trustee ${i + 1}`}
                  value={t}
                  onChange={(e) => setTrustee(i, e.currentTarget.value)}
                />
                <SecondaryButton
                  onClick={() =>
                    set(
                      "trustees",
                      form.trustees.filter((_, j) => j !== i),
                    )
                  }
                  style={{ minHeight: 54, padding: "0 14px", fontSize: 14 }}
                >
                  Remove
                </SecondaryButton>
              </div>
            ))}
            <div>
              <SecondaryButton
                onClick={() =>
                  set("trustees", [
                    ...form.trustees,
                    `Trustee ${form.trustees.length + 1}`,
                  ])
                }
                disabled={form.trustees.length >= MAX_TRUSTEES}
                style={{ minHeight: 40, padding: "0 16px", fontSize: 14 }}
              >
                Add trustee
              </SecondaryButton>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: tokens.space.md,
          }}
        >
          <Field label={`Threshold (of ${form.trustees.length})`}>
            {numberInput(form.threshold, (v) => set("threshold", v), 1)}
          </Field>
          <Field label="Voters">
            {numberInput(form.voters, (v) => set("voters", v), 1)}
          </Field>
          <Field label="Positions">
            {numberInput(form.positions, (v) => set("positions", v), 1)}
          </Field>
          <Field label="Candidates per position">
            {numberInput(form.candidates, (v) => set("candidates", v), 1)}
          </Field>
          <Field label="Senate seats">
            {numberInput(form.senateSeats, (v) => set("senateSeats", v))}
          </Field>
          <Field label="Vote distribution">
            <Select
              value={form.distribution}
              onChange={(v) =>
                set("distribution", v as ElectionForm["distribution"])
              }
            >
              <option value="uniform">Uniform</option>
              <option value="skewed">Skewed</option>
              <option value="realistic">Realistic</option>
            </Select>
          </Field>
          <Field label="Mode">
            <Select
              value={form.mode}
              onChange={(v) => set("mode", v as ElectionForm["mode"])}
            >
              <option value="offline">Offline — no ledger</option>
              <option value="onchain" disabled={!caps?.fabric}>
                {caps?.fabric
                  ? `On-chain — commits to ${caps.peer || "Fabric"}`
                  : "On-chain — no Fabric network configured"}
              </option>
            </Select>
          </Field>
        </div>

        {labels.length > 0 ? (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: tokens.color.text2,
                marginBottom: 6,
                letterSpacing: 0.2,
              }}
            >
              Positions
            </div>
            <div style={{ display: "grid", gap: tokens.space.xs }}>
              {labels.slice(0, PREVIEW).map((l, p) => (
                <PositionTile
                  key={l}
                  title={l}
                  pick={
                    p === 2 && config.senate_seats > 1
                      ? `Pick 1 · top ${config.senate_seats} elected`
                      : "Pick 1"
                  }
                />
              ))}
            </div>
            <p
              style={{
                margin: `${tokens.space.xs}px 0 0 0`,
                fontSize: 13,
                color: tokens.color.text2,
              }}
            >
              {labels.length > PREVIEW
                ? `…and ${labels.length - PREVIEW} more. `
                : ""}
              Each voter selects one of {config.candidates} candidates per
              position. Seats decide how the Senate is read, not how it is
              encrypted.
            </p>
          </div>
        ) : null}

        {problem && (
          <p style={{ margin: 0, fontSize: 14, color: tokens.color.warnText }}>
            {problem}
          </p>
        )}
        {serverError && <Banner variant="error">{serverError}</Banner>}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: tokens.space.sm,
          }}
        >
          <SecondaryButton onClick={onCancel}>Back</SecondaryButton>
          <PrimaryButton onClick={create} disabled={busy || problem !== null}>
            {busy ? "Creating…" : "Create election"}
          </PrimaryButton>
        </div>
      </div>
    </Card>
  );
}

function PopulationStep({
  runId,
  fail,
  onNext,
}: {
  runId: string;
  fail: Fail;
  onNext: () => void;
}) {
  const [progress] = usePhaseEvents(runId, "generate");
  const [generating, setGenerating] = useState(true);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [summary, setSummary] = useState<ElectionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The phase lock is the state of record: the stream has no replay, and a
  // generation that finished before this page subscribed says nothing.
  useInterval(
    () => {
      runStatus(runId)
        .then((s) => {
          if (!s.busy) setGenerating(false);
        })
        .catch((e) => {
          setError(fail(e));
          setGenerating(false);
        });
    },
    generating ? PHASE_POLL_MS : null,
  );

  useEffect(() => {
    if (generating) return;
    Promise.all([checkPopulation(runId), loadElectionSummary(runId)])
      .then(([r, s]) => {
        setReport(r);
        setSummary(s);
      })
      .catch((e) => {
        const text = fail(e);
        setError(
          e instanceof ApiError && e.status === 404
            ? `Generation did not complete for this run — election.csv is missing.${progress.error ? ` Last error: ${progress.error}` : ""}`
            : text,
        );
      });
    // progress.error is read once, when the phase ends — not a dependency.
  }, [generating, runId, fail]);

  const proofsPerBallot = summary?.candidates ?? 0;

  return (
    <Card>
      <SectionTitle
        title="Population"
        subtitle="What the console generated for this election, and whether it passes the data-validation gate before anything is encrypted."
        aside={
          report ? (
            <Chip variant={report.pass ? "success" : "error"}>
              {report.pass ? "All checks passed" : "Validation failed"}
            </Chip>
          ) : null
        }
      />
      <Banner variant="note">
        Read-only. The voters, their credentials and their ballots are
        synthetic, created by the generator. This console does not issue real
        voter credentials.
      </Banner>
      {error && <Banner variant="error">{error}</Banner>}

      {generating ? (
        <>
          <p style={{ margin: 0, color: tokens.color.text2 }}>
            Generating the population…
          </p>
          <Log lines={progress.lines} />
        </>
      ) : null}

      {report && summary ? (
        <div style={{ display: "grid", gap: tokens.space.md }}>
          <StatGrid>
            <Stat
              label="Voters"
              value={report.voters.toLocaleString("en-US")}
              detail={`${report.rows.toLocaleString("en-US")} rows audited`}
            />
            <Stat
              label="Distribution"
              value={report.distribution}
              detail={`${report.positions} positions × ${report.candidates} candidates`}
            />
            <Stat
              label="Voter credentials"
              value={summary.voters.toLocaleString("en-US")}
              detail="one per voter, from election.csv"
            />
            <Stat
              label="Ballot records"
              value={summary.num_ballots.toLocaleString("en-US")}
              detail="one per voter per position"
            />
            <Stat
              label="Credential proofs"
              value={summary.num_ballots.toLocaleString("en-US")}
              detail="one presentation per ballot record"
            />
            <Stat
              label="Well-formedness proofs"
              value={(summary.num_ballots * proofsPerBallot).toLocaleString(
                "en-US",
              )}
              detail={`one CDS proof per candidate ciphertext (${proofsPerBallot} per record)`}
            />
            <Stat
              label="Partial decryptions"
              value={summary.num_partial_decryptions.toLocaleString("en-US")}
              detail="held for the trustees' ceremony"
            />
          </StatGrid>

          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: tokens.color.text2,
                marginBottom: 6,
                letterSpacing: 0.2,
              }}
            >
              Data-validation gate
            </div>
            <Table head={["", "Check", "Detail"]} empty="No checks reported.">
              {report.checks.map((c) => (
                <tr key={c.name}>
                  <td style={cell}>
                    <Chip variant={c.pass ? "success" : "error"}>
                      {c.pass ? "Pass" : "Fail"}
                    </Chip>
                  </td>
                  <td style={{ ...cell, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ ...cell, color: tokens.color.text2 }}>
                    {c.detail}
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            {report.ground_truth_ballots_sha256 ? (
              <Row
                label="ground truth"
                value={report.ground_truth_ballots_sha256}
              />
            ) : null}
            {summary.ballots_sha256 ? (
              <Row label="ballot set" value={summary.ballots_sha256} />
            ) : null}
            {summary.issuer_public_key ? (
              <Row label="issuer key" value={summary.issuer_public_key} />
            ) : null}
          </div>
        </div>
      ) : null}

      <Actions>
        <span style={{ fontSize: 13, color: tokens.color.text2 }}>
          {report && !report.pass
            ? "A population that fails the gate must not proceed to encryption."
            : ""}
        </span>
        <PrimaryButton onClick={onNext} disabled={!report?.pass}>
          Next: run the election
        </PrimaryButton>
      </Actions>
    </Card>
  );
}

function RunStep({
  runId,
  onChain,
  opened,
  fail,
  onBack,
  onNext,
}: {
  runId: string;
  onChain: boolean;
  /** The list row this run was opened from, if any. */
  opened?: RunView;
  fail: Fail;
  onBack: () => void;
  onNext: () => void;
}) {
  const [progress, setProgress] = usePhaseEvents(runId, "ceremony");
  const [ready, setReady] = useState<boolean | null>(null);
  // Opened while a phase holds the run: follow it instead of offering to start.
  const [started, setStarted] = useState(opened?.busy ?? false);
  const [resumable, setResumable] = useState(opened?.resumable ?? false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCeremony(runId)
      .then((c) => setReady(c.ready))
      .catch((e) => setError(fail(e)));
  }, [runId, fail]);

  // `ready` means the election is closed: CeremonyStart (and a resume) stamp
  // closed_at as their last step, before releasing the run's lock. So the lock
  // is read first; once it is free, a ceremony still not ready means the phase
  // stopped short.
  useInterval(
    () => {
      runStatus(runId)
        .then(async (s) => [await loadCeremony(runId), s] as const)
        .then(([c, s]) => {
          if (c.ready) {
            setReady(true);
            setStarted(false);
          } else if (!s.busy) {
            setStarted(false);
            setError(
              progress.error ??
                "The run stopped before the election was closed — see the console log.",
            );
          }
        })
        .catch((e) => {
          setStarted(false);
          setError(fail(e));
        });
    },
    started ? PHASE_POLL_MS : null,
  );

  async function start() {
    setError(null);
    setProgress({ ...IDLE_PROGRESS, status: "running" });
    try {
      if (resumable) {
        await resumeRun(runId);
        setResumable(false);
      } else {
        await startCeremony(runId);
      }
      setStarted(true);
    } catch (e) {
      setError(fail(e));
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Run the election"
        subtitle={
          onChain
            ? "Commits the election, its DKG transcript, every ballot and the close to the Fabric ledger, then hands the next move to the trustees."
            : "Local run — no ledger. Prepares the election bundle and the trustees' ceremony on this console."
        }
        aside={
          <Chip variant={onChain ? "success" : "neutral"}>
            {onChain ? "On-chain" : "Offline"}
          </Chip>
        }
      />
      {error && <Banner variant="error">{error}</Banner>}
      {ready ? (
        <Banner variant="success">
          The election is closed to new ballots. Trustees may now contribute.
        </Banner>
      ) : null}

      {resumable && !started ? (
        <Banner variant="note">
          {opened?.status === "close-pending"
            ? "Every ballot is recorded, but closing the election failed. Resume retries the close."
            : "The ballot window was interrupted before the election was closed. Resume records the ballots the chain is missing, then closes it."}
        </Banner>
      ) : null}

      {!ready ? (
        <PrimaryButton onClick={start} disabled={started || ready === null}>
          {started
            ? onChain
              ? "Recording on-chain…"
              : "Running…"
            : resumable
              ? "Resume"
              : "Encrypt and record"}
        </PrimaryButton>
      ) : null}

      {onChain && progress.receipts > 0 ? (
        <p style={{ margin: `${tokens.space.sm}px 0 0`, fontSize: 14 }}>
          <b>{progress.receipts.toLocaleString("en-US")}</b> ledger commits seen
          on this run's stream
        </p>
      ) : null}
      <Log lines={progress.lines} />

      <Actions>
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        <PrimaryButton onClick={onNext} disabled={!ready}>
          Next: trustee ceremony
        </PrimaryButton>
      </Actions>
    </Card>
  );
}

function CeremonyStep({
  runId,
  fail,
  onBack,
  onNext,
}: {
  runId: string;
  fail: Fail;
  onBack: () => void;
  onNext: () => void;
}) {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const refresh = useCallback(() => {
    loadCeremony(runId)
      .then(setCeremony)
      .catch((e) => setError(fail(e)));
  }, [runId, fail]);

  useInterval(refresh, ceremony?.published ? null : CEREMONY_POLL_MS);

  async function publish() {
    setError(null);
    setPublishing(true);
    try {
      await publishTally(runId);
      window.setTimeout(refresh, AFTER_POST_MS);
    } catch (e) {
      // The below-threshold 409 is already the right sentence.
      setError(fail(e));
    } finally {
      setPublishing(false);
    }
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <Card>
      <SectionTitle
        title="Trustee ceremony"
        subtitle="Send each trustee their link. Each opens it and submits their own partial decryption; the tally can be published once the threshold is met."
        aside={
          ceremony ? (
            <Chip
              variant={
                ceremony.published || ceremony.unlocked ? "success" : "neutral"
              }
            >
              {ceremony.published
                ? "Tally published"
                : ceremony.unlocked
                  ? "Threshold reached"
                  : ceremony.ready
                    ? "Awaiting shares"
                    : "Not started"}
            </Chip>
          ) : null
        }
      />
      {error && <Banner variant="error">{error}</Banner>}
      {!ceremony && !error ? (
        <p style={{ margin: 0, color: tokens.color.text2 }}>Loading…</p>
      ) : null}

      {ceremony ? (
        <div style={{ display: "grid", gap: tokens.space.md }}>
          {!ceremony.ready ? (
            <Banner variant="note">
              The ceremony has not been set up yet — run the election first.
            </Banner>
          ) : null}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: tokens.space.sm,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span>
                <b>
                  {ceremony.threshold} of {ceremony.trustees.length} trustees
                </b>{" "}
                are required to decrypt the final tally.
              </span>
              <b style={{ color: tokens.color.tealDark }}>
                {Math.min(ceremony.submitted, ceremony.threshold)} of{" "}
                {ceremony.threshold} submitted
              </b>
            </div>
            <Meter
              value={Math.min(ceremony.submitted, ceremony.threshold)}
              max={ceremony.threshold}
            />
          </div>

          <Table
            head={["Trustee", "Status", "Link"]}
            empty="This election has no trustees."
          >
            {ceremony.trustees.map((t) => {
              const link = trusteeUrl(runId, t.id);
              return (
                <tr key={t.id}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: tokens.color.text2 }}>
                      Trustee {t.id}
                    </div>
                  </td>
                  <td style={cell}>
                    <Chip
                      variant={
                        t.submitting
                          ? "neutral"
                          : t.submitted
                            ? "success"
                            : ceremony.ready
                              ? "warn"
                              : "neutral"
                      }
                    >
                      {t.submitting
                        ? "Recording…"
                        : t.submitted
                          ? "Submitted"
                          : ceremony.ready
                            ? "Pending"
                            : "Not started"}
                    </Chip>
                    {t.submit_error ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: tokens.color.error,
                          marginTop: 4,
                        }}
                      >
                        {t.submit_error}
                      </div>
                    ) : null}
                  </td>
                  <td style={cell}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: tokens.space.xs,
                      }}
                    >
                      <MonoText style={{ fontSize: 12 }}>{link}</MonoText>
                      <CopyButton value={origin + link} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>

          {ceremony.ready && !ceremony.published ? (
            <div>
              <PrimaryButton
                onClick={publish}
                disabled={
                  !ceremony.unlocked || publishing || Boolean(ceremony.busy)
                }
              >
                {publishing ? "Publishing…" : "Publish the tally"}
              </PrimaryButton>
            </div>
          ) : null}

          <p style={{ margin: 0, fontSize: 13, color: tokens.color.text2 }}>
            {ceremony.on_chain
              ? "The threshold is enforced by this console and proven by the independent verifier, which counts distinct verified trustees."
              : "Local ceremony — real cryptographic shares, no ledger. The threshold gate is enforced by this console."}{" "}
            The published tally is the election's seeded result; the ceremony
            gates when it becomes readable.
          </p>
        </div>
      ) : null}

      <Actions>
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        <PrimaryButton onClick={onNext} disabled={!ceremony?.published}>
          Next: verify results
        </PrimaryButton>
      </Actions>
    </Card>
  );
}

function ResultsStep({
  runId,
  onChain,
  opened,
  fail,
  onBack,
  onDone,
}: {
  runId: string;
  onChain: boolean;
  opened?: RunView;
  fail: Fail;
  onBack: () => void;
  onDone: () => void;
}) {
  const [progress, setProgress] = usePhaseEvents(runId, "verify");
  const [rows, setRows] = useState<ContestResult[] | null>(null);
  const [unverified, setUnverified] = useState(false);
  // Opened while Verify holds the run: poll for its outcome.
  const [verifying, setVerifying] = useState(opened?.busy ?? false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (afterVerify: boolean) => {
      loadCorrectness(runId)
        .then((r) => {
          setRows(r);
          setUnverified(false);
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 404 && !afterVerify) {
            setUnverified(true);
          } else {
            setError(fail(e));
          }
        });
    },
    [runId, fail],
  );

  useEffect(() => load(false), [load]);

  useInterval(
    () => {
      runStatus(runId)
        .then((s) => {
          if (s.busy) return;
          setVerifying(false);
          load(true);
        })
        .catch((e) => {
          setVerifying(false);
          setError(fail(e));
        });
    },
    verifying ? PHASE_POLL_MS : null,
  );

  async function verify() {
    setError(null);
    setProgress({ ...IDLE_PROGRESS, status: "running" });
    try {
      await verifyRun(runId);
      setVerifying(true);
    } catch (e) {
      setError(fail(e));
    }
  }

  const local = rows?.filter((r) => r.source !== "ledger") ?? [];
  const pass = local.length > 0 && local.every((r) => r.pass);
  const ledger = rows?.[0]?.ledger_matches_local ?? "";

  return (
    <Card>
      <SectionTitle
        title="Results"
        subtitle="The independent auditor recomputes every contest from the ballots and the trustees' shares and holds it against the ground truth."
        aside={
          rows ? (
            <Chip variant={pass ? "success" : "error"}>
              {pass ? "E = 0 · PASS" : "FAIL"}
            </Chip>
          ) : null
        }
      />
      {error && <Banner variant="error">{error}</Banner>}

      {unverified ? (
        <>
          <p
            style={{
              margin: `0 0 ${tokens.space.sm}px`,
              color: tokens.color.text2,
            }}
          >
            This election has not been verified yet.
          </p>
          <PrimaryButton onClick={verify} disabled={verifying}>
            {verifying ? "Verifying…" : "Run verification"}
          </PrimaryButton>
          <Log lines={progress.lines} />
        </>
      ) : null}

      {rows ? (
        <div style={{ display: "grid", gap: tokens.space.md }}>
          <Table
            head={["Contest", "Ground truth", "Decoded", "E", "Result"]}
            empty="correctness.csv has no contests."
          >
            {local.map((r) => (
              <tr key={r.contest}>
                <td style={cell}>{contestLabel(r.contest)}</td>
                <td style={cell}>{r.ground_truth.toLocaleString("en-US")}</td>
                <td style={cell}>{r.decoded.toLocaleString("en-US")}</td>
                <td style={cell}>{r.E}</td>
                <td style={cell}>
                  <Chip variant={r.pass ? "success" : "error"}>
                    {r.pass ? "Pass" : "Fail"}
                  </Chip>
                </td>
              </tr>
            ))}
          </Table>

          {onChain ? (
            <p style={{ margin: 0, fontSize: 14 }}>
              <b>Ledger audit:</b>{" "}
              {ledger === "true"
                ? "the chain's own record audits to the same result."
                : ledger === "false"
                  ? "the chain's own record does NOT match the local audit."
                  : "not run — the chain was unreachable when verifying."}
            </p>
          ) : null}

          {local[0]?.tally_sha256 ? (
            <Row label="tally sha256" value={local[0].tally_sha256} />
          ) : null}

          <div
            style={{ display: "flex", gap: tokens.space.md, flexWrap: "wrap" }}
          >
            <a
              href={boardUrl(runId)}
              style={{ color: tokens.color.tealDark, fontWeight: 600 }}
            >
              Open the public bulletin board
            </a>
            {onChain ? (
              <a
                href={trailUrl(runId)}
                style={{ color: tokens.color.tealDark, fontWeight: 600 }}
              >
                Open the on-chain audit trail
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <Actions>
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
        <PrimaryButton onClick={onDone}>Back to elections</PrimaryButton>
      </Actions>
    </Card>
  );
}

export default function App() {
  const [auth, setAuth] = useState<Auth>({ kind: "checking" });
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [step, setStep] = useState<Step | null>(null);

  const checkSession = useCallback(() => {
    getMe()
      .then((session) =>
        setAuth(session ? { kind: "in", session } : { kind: "off" }),
      )
      .catch((e) =>
        setAuth(
          e instanceof ApiError && e.status === 401
            ? { kind: "login" }
            : { kind: "unreachable", message: message(e) },
        ),
      );
  }, []);

  useEffect(checkSession, [checkSession]);

  const fail = useCallback<Fail>((e) => {
    if (e instanceof ApiError && e.status === 401) {
      setAuth({ kind: "login" });
    }
    return message(e);
  }, []);

  const signedIn =
    auth.kind === "off" ||
    (auth.kind === "in" && auth.session.role === "admin");

  useEffect(() => {
    if (!signedIn) return;
    getCapabilities()
      .then(setCaps)
      .catch(() => setCaps({ fabric: false }));
  }, [signedIn]);

  async function signOut() {
    try {
      await logout();
    } finally {
      setActive(null);
      setStep(null);
      setAuth({ kind: "login" });
    }
  }

  async function open(run: RunView) {
    const ceremony = await loadCeremony(run.run_id).catch(() => null);
    setActive({ runId: run.run_id, config: run.config, run });
    setStep(stepFor(run, ceremony));
  }

  const toList = () => {
    setActive(null);
    setStep(null);
  };

  let body: ReactNode;
  if (auth.kind === "checking") {
    body = (
      <Card>
        <p style={{ margin: 0, color: tokens.color.text2 }}>Loading…</p>
      </Card>
    );
  } else if (auth.kind === "unreachable") {
    body = (
      <Banner variant="error">
        Could not reach the election console — {auth.message}
      </Banner>
    );
  } else if (auth.kind === "login") {
    body = (
      <Login
        onSignedIn={() => {
          setAuth({ kind: "checking" });
          checkSession();
        }}
      />
    );
  } else if (!signedIn) {
    body = (
      <Banner variant="error">
        Signed in as {auth.kind === "in" ? auth.session.username : ""}, a
        trustee account. The admin console needs an administrator account.
      </Banner>
    );
  } else if (step === null) {
    body = (
      <Elections
        fail={fail}
        onOpen={open}
        onNew={() => {
          setActive(null);
          setStep(1);
        }}
      />
    );
  } else {
    const onChain = active?.config.mode === "onchain";
    body = (
      <>
        <Stepper steps={STEPS} current={step} />
        {step === 1 && (
          <ElectionStep
            caps={caps}
            fail={fail}
            onCancel={toList}
            onCreated={(runId, config) => {
              setActive({ runId, config });
              setStep(2);
            }}
          />
        )}
        {active && step === 2 && (
          <PopulationStep
            key={active.runId}
            runId={active.runId}
            fail={fail}
            onNext={() => setStep(3)}
          />
        )}
        {active && step === 3 && (
          <RunStep
            runId={active.runId}
            onChain={onChain}
            opened={active.run}
            fail={fail}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {active && step === 4 && (
          <CeremonyStep
            runId={active.runId}
            fail={fail}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {active && step === 5 && (
          <ResultsStep
            runId={active.runId}
            onChain={onChain}
            opened={active.run}
            fail={fail}
            onBack={() => setStep(4)}
            onDone={toList}
          />
        )}
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.color.bg,
        fontFamily: tokens.type.fontFamily,
        color: tokens.color.text1,
      }}
    >
      <Header auth={auth} onSignOut={signOut} />

      <main
        style={{
          maxWidth: PAGE_MAX,
          margin: "0 auto",
          padding: tokens.space.md,
          display: "grid",
          gap: tokens.space.md,
        }}
      >
        {body}
        {auth.kind === "in" || auth.kind === "login" ? (
          <p style={{ margin: 0, fontSize: 13, color: tokens.color.text2 }}>
            Demo-grade access control: accounts come from a file, sessions live
            in the console's memory and end when it restarts, and there is no
            TLS. Keep the console on a loopback or trusted network.
          </p>
        ) : auth.kind === "off" ? (
          <p style={{ margin: 0, fontSize: 13, color: tokens.color.text2 }}>
            This console runs without authentication: anyone who can reach it
            can administer elections.
          </p>
        ) : null}
      </main>
    </div>
  );
}
