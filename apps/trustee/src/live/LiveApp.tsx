/**
 * The live trustee screen (design review D5, D9, D19): one trustee process,
 * one action at a time. Served by `saksi-campaign trustee` at `/trustee/`;
 * every call goes to that same process (`../lib/trustee`).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  tokens,
  Card,
  Chip,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  Stepper,
  TopBar,
  VerifiableValue,
  AlertIcon,
  LockIcon,
  idToName,
  pollSignal,
} from "@balotachain/ui";
import {
  Avatar,
  Login,
  Notice,
  formatStamp,
  noteText,
} from "../components/common";
import { ApiError, getMe, logout, type Session } from "../lib/bulletin";
import {
  decrypt,
  getStatus,
  join,
  sign,
  type StepName,
  type TrusteeStatus,
} from "../lib/trustee";
import {
  STEP_BUSY,
  STEP_BUTTON,
  STEP_LABEL,
  actionFor,
  blocksText,
  checkedText,
  SIGN_PUBLISHED_NOT_NEEDED,
  stepWhat,
  currentPhase,
  mergeLog,
  rosterRows,
  signNotNeeded,
  stepOf,
  tabTitle,
  totalsByPosition,
  trackerSteps,
  type LogEntry,
} from "./model";
import "./live.css";

/** The finished card's line for a trustee that never signed (M4). */
const SIGN_NOT_NEEDED =
  "The tally was published with other trustees' signatures before this trustee signed. The console takes no more signatures for this election, so no signature from this trustee is needed.";

/**
 * Rehearsal 7, minor 3: a trustee that never decrypted was never going to
 * sign; the sentence says so from the status's own state.
 */
const SIGN_NOT_DECRYPTED_DONE =
  "This trustee did not decrypt this election, so no signature from it is needed.";

function notNeededText(s: TrusteeStatus): string {
  return s.tally?.signing === "not_decrypted" ||
    stepOf(s, "decrypt").state !== "done"
    ? SIGN_NOT_DECRYPTED_DONE
    : SIGN_NOT_NEEDED;
}

/**
 * The finished card's line after this trustee signed (M3): the console
 * publishes by itself once the threshold number of signatures is held. The
 * number is the election's threshold as the status carries it.
 */
function signedText(s: TrusteeStatus): string {
  // Rehearsal 7, minor 2: once the console's state says so, say that.
  if (s.election?.state === "verified")
    return "This trustee's signature is recorded. The console reports the result verified.";
  if (s.election?.state === "tallied")
    return "This trustee's signature is recorded. The console reports the tally published.";
  const t = s.decryption?.threshold || s.election?.threshold || 0;
  return t > 0
    ? `This trustee's signature is recorded. The console publishes the result by itself when ${t} signatures are held.`
    : "This trustee's signature is recorded. The console publishes the result by itself when enough signatures are held.";
}

/** D9: refresh every 2 to 3 seconds while the tab is visible. */
export const POLL_MS = 2500;
/** D9: after this long in progress, one line asks to keep the page open. */
export const STILL_MS = 10_000;

type Auth =
  | { kind: "checking" }
  | { kind: "login" }
  | { kind: "in"; session: Session | null }
  | { kind: "denied"; message: string };

const h2: CSSProperties = {
  fontSize: tokens.font.h3,
  fontWeight: 600,
  lineHeight: 1.3,
  margin: 0,
};

const label: CSSProperties = {
  ...tokens.typeRole.label,
  color: tokens.color.text2,
};

const small: CSSProperties = {
  fontSize: tokens.font.small,
  color: tokens.color.text2,
  lineHeight: 1.5,
};

function Head({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: `${tokens.space.xs}px ${tokens.space.sm}px`,
        marginBottom: tokens.space.sm,
      }}
    >
      <h2 style={h2}>{title}</h2>
      {right ? <span style={label}>{right}</span> : null}
    </div>
  );
}

/** A failure or an alarm, in words, in the error style. */
function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 16px",
        borderRadius: tokens.radius.button,
        background: tokens.color.errorLight,
        color: tokens.color.error,
        fontSize: tokens.font.body,
        fontWeight: 600,
        lineHeight: 1.45,
        overflowWrap: "anywhere",
      }}
    >
      <span style={{ flexShrink: 0, display: "flex", marginTop: 2 }}>
        <AlertIcon size={18} strokeWidth={1.8} />
      </span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

/** A neutral notice inside the page (not a full-page one). */
function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      style={{
        padding: "12px 16px",
        borderRadius: tokens.radius.button,
        background: tokens.color.neutralFill,
        border: `1px solid ${tokens.color.border}`,
        color: tokens.color.text1,
        fontSize: tokens.font.body,
        lineHeight: 1.5,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </div>
  );
}

function Alarms({ status }: { status: TrusteeStatus }) {
  const alarms = status.alarms ?? [];
  if (alarms.length === 0) return null;
  return (
    <section aria-label="Alarms" style={{ display: "grid", gap: 8 }}>
      {alarms.map((a) => (
        <ErrorBox key={`${a.code}|${a.at}`}>
          <span style={{ display: "block" }}>Alarm: {a.message}</span>
          <span style={{ display: "block", fontWeight: 400 }}>
            {blocksText(a.blocks)} Raised {formatStamp(a.at)}.
          </span>
        </ErrorBox>
      ))}
    </section>
  );
}

function TotalsList({
  status,
  showPublished,
}: {
  status: TrusteeStatus;
  showPublished: boolean;
}) {
  const groups = totalsByPosition(status);
  if (!groups) return null;
  return (
    <div style={{ display: "grid", gap: tokens.space.sm }}>
      {groups.map((g) => (
        <div key={g.position}>
          <h3
            style={{
              fontSize: tokens.font.body,
              fontWeight: 600,
              margin: "0 0 4px",
              overflowWrap: "anywhere",
            }}
          >
            {g.position}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {g.rows.map((r) => (
              <li
                key={r.contest_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: tokens.space.sm,
                  padding: "8px 0",
                  borderTop: `1px solid ${tokens.color.border}`,
                  fontSize: tokens.font.body,
                }}
              >
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {r.candidate}
                </span>
                <span
                  className="bc-mono"
                  style={{ fontWeight: 600, whiteSpace: "nowrap" }}
                >
                  {r.total}
                  {showPublished && r.published !== null
                    ? ` (published ${r.published})`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The current step's card: what it does, one button, what unlocks it. */
function ActionCard({
  status,
  pressing,
  pressError,
  onPress,
}: {
  status: TrusteeStatus;
  pressing: StepName | null;
  pressError: { step: StepName; message: string; refusal?: boolean } | null;
  onPress: (step: StepName) => void;
}) {
  const phase = currentPhase(status);
  const step: StepName | null =
    phase === "none" || phase === "finished" ? null : phase;
  const action = step ? actionFor(status, step) : null;
  const inProgress = Boolean(
    step && action && (pressing === step || action.running),
  );
  // "Keep this page open" is for work a press started; the automatic
  // signature carries on whether or not this page is open.
  const pressWork = Boolean(
    step &&
    action &&
    (pressing === step || (action.running && step !== "sign")),
  );

  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(false);
    if (!pressWork) return;
    const t = window.setTimeout(() => setStill(true), STILL_MS);
    return () => window.clearTimeout(t);
  }, [pressWork, step]);

  const myError = pressError && pressError.step === step ? pressError : null;

  const frame: CSSProperties = {
    border: `1.5px solid ${tokens.color.teal}`,
  };

  let body: ReactNode;
  if (phase === "none") {
    body = (
      <>
        <h2 style={h2}>No election yet</h2>
        <p style={{ ...noteText, fontSize: tokens.font.body, margin: 0 }}>
          Waits for the presenter to create an election. This page moves on by
          itself.
        </p>
      </>
    );
  } else if (phase === "finished") {
    const t = status.tally;
    body = (
      <>
        <h2 style={h2}>
          {t.published || signNotNeeded(status)
            ? "Tally published"
            : "Tally signed"}
        </h2>
        <p style={{ ...noteText, fontSize: tokens.font.body, margin: 0 }}>
          {t.published
            ? "The tally on the chain is compared with this trustee's own count."
            : signNotNeeded(status)
              ? `${SIGN_PUBLISHED_NOT_NEEDED} This page shows the comparison once this trustee reads it from the chain.`
              : signedText(status)}
        </p>
        {checkedText(status) ? (
          <p style={{ ...noteText, fontSize: tokens.font.body, margin: 0 }}>
            {checkedText(status)}
          </p>
        ) : null}
        {signNotNeeded(status) ? (
          <p style={{ ...noteText, fontSize: tokens.font.body, margin: 0 }}>
            {notNeededText(status)}
          </p>
        ) : null}
        {t.signature_note ? (
          <p style={{ ...small, margin: 0 }}>{t.signature_note}</p>
        ) : null}
        <Published status={status} />
        <TotalsList status={status} showPublished={t.matches === false} />
      </>
    );
  } else if (step && action) {
    const label = inProgress
      ? STEP_BUSY[step]
      : action.retry || (myError && !myError.refusal)
        ? "Try again"
        : STEP_BUTTON[step];
    const enabled = !inProgress && action.canPress;
    // No button while Join or Decrypt waits on others after the press, and
    // none on the sign step unless the process offers the retry (or the
    // retry's press is out): the status line below says what happens next.
    const offerButton =
      (!action.noButton || (step === "sign" && pressing === "sign")) &&
      !(step !== "sign" && action.state === "waiting");
    body = (
      <>
        <h2 style={h2}>{STEP_LABEL[step]}</h2>
        <p
          style={{
            ...noteText,
            fontSize: tokens.font.body,
            margin: 0,
            maxWidth: "65ch",
          }}
        >
          {stepWhat(status, step)}
        </p>
        <StepFacts status={status} step={step} />
        {action.error ? <ErrorBox>{action.error}</ErrorBox> : null}
        {myError ? (
          myError.refusal ? (
            // m1: a 409 is the process's refusal, in its own sentence; the
            // step did not fail, so it is not drawn as an error to retry.
            <InlineNotice>{myError.message}</InlineNotice>
          ) : (
            <ErrorBox>{myError.message}</ErrorBox>
          )
        ) : null}
        {offerButton ? (
          <div>
            <PrimaryButton
              onClick={() => onPress(step)}
              disabled={!enabled}
              aria-busy={inProgress || undefined}
              style={{
                whiteSpace: "normal",
                lineHeight: 1.2,
                textAlign: "center",
              }}
            >
              {label}
            </PrimaryButton>
          </div>
        ) : null}
        {pressWork && still ? (
          <p
            style={{
              ...noteText,
              fontSize: tokens.font.body,
              margin: 0,
              fontWeight: 600,
            }}
          >
            Still recording. Keep this page open.
          </p>
        ) : null}
        {action.unlock ? (
          <p
            role={offerButton ? undefined : "status"}
            style={{
              ...noteText,
              fontSize: tokens.font.body,
              margin: 0,
              ...(offerButton ? {} : { color: tokens.color.text1 }),
            }}
          >
            {action.unlock}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <section aria-label="Current step">
      <Card flush style={frame}>
        <div
          style={{
            padding: tokens.space.md,
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.sm,
          }}
        >
          {body}
        </div>
      </Card>
    </section>
  );
}

function Published({ status }: { status: TrusteeStatus }) {
  const t = status.tally;
  if (!t.published) return null;
  if (t.matches === true)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Chip variant="success" dot>
          Matches
        </Chip>
        <span style={{ fontSize: tokens.font.body }}>
          The published tally equals this trustee&apos;s own count.
        </span>
      </div>
    );
  if (t.matches === false)
    return (
      <ErrorBox>
        The published tally does not equal this trustee&apos;s own count.
      </ErrorBox>
    );
  return (
    <p style={{ ...small, margin: 0 }}>
      The tally is published. This trustee has no count of its own to compare it
      with yet.
    </p>
  );
}

/** What the current step has to show from the status (trustee-api.md). */
function StepFacts({
  status,
  step,
}: {
  status: TrusteeStatus;
  step: StepName;
}) {
  if (step === "join") {
    const err = status.ceremony?.ceremony_error;
    return err ? <ErrorBox>{err}</ErrorBox> : null;
  }
  if (step === "decrypt") {
    const d = status.decryption;
    const byPos = Object.entries(d?.ballots_by_position ?? {});
    return (
      <div style={{ display: "grid", gap: 6, fontSize: tokens.font.body }}>
        {/* Always mounted, so a screen reader hears the first count too. */}
        <span aria-live="polite" data-testid="ballot-count">
          {d && d.ballot_count > 0
            ? `${d.ballot_count} ballot records read from the chain${
                byPos.length > 0
                  ? ` (${byPos.map(([p, n]) => `${idToName(p)} ${n}`).join(", ")})`
                  : ""
              }.`
            : status.election
              ? `${status.election.ballot_records} ballot records on the chain, by the console's count.`
              : ""}
        </span>
        {d?.partial_recorded ? (
          <span>
            This trustee&apos;s partial is recorded
            {d.partial_read_back === "ok"
              ? " and read back from the chain."
              : "."}
          </span>
        ) : null}
        {d?.partial_read_back === "mismatch" ? (
          <ErrorBox>
            The partial read back from the chain is not the one this trustee
            computed.
          </ErrorBox>
        ) : null}
      </div>
    );
  }
  // sign: the trustee sees what they sign.
  const t = status.tally;
  return (
    <div style={{ display: "grid", gap: tokens.space.xs }}>
      <TotalsList status={status} showPublished={false} />
      {t.signature_note ? (
        <p style={{ ...small, margin: 0 }}>{t.signature_note}</p>
      ) : null}
      <Published status={status} />
    </div>
  );
}

function RosterCard({ status }: { status: TrusteeStatus }) {
  const rows = rosterRows(status);
  // Only the status's own count: none, no line (never a made-up 0).
  const decrypted = status.decryption?.trustees_decrypted;
  const k = typeof decrypted === "number" ? decrypted : null;
  const t = status.decryption?.threshold || status.election?.threshold || 0;
  return (
    <Card>
      <Head
        title="Trustees"
        right={t ? `Threshold ${t} of ${rows.length}` : undefined}
      />
      {rows.length === 0 ? (
        <p style={{ ...noteText, fontSize: tokens.font.body, margin: 0 }}>
          The trustees are listed when an election exists.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((r, i) => (
            <li
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderTop:
                  i === 0 ? "none" : `1px solid ${tokens.color.border}`,
              }}
            >
              <Avatar
                initials={`T${r.id}`}
                size={40}
                radius={11}
                filled={r.you}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: tokens.font.body,
                  }}
                >
                  Trustee {r.id}
                  {r.you ? " (you)" : ""}
                </span>
                {r.detail ? (
                  <span
                    style={{
                      ...small,
                      display: "block",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {r.detail}
                  </span>
                ) : null}
              </span>
              <Chip variant={r.variant} dot>
                {r.word}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {t && k !== null ? (
        <p
          style={{
            margin: `${tokens.space.sm}px 0 0`,
            paddingTop: tokens.space.sm,
            borderTop: `1px solid ${tokens.color.border}`,
            fontSize: tokens.font.body,
          }}
        >
          <span style={{ ...label, display: "block" }}>Decrypted</span>
          <b aria-live="polite" style={{ fontWeight: 700 }}>
            {k} of {t} needed
          </b>
        </p>
      ) : null}
    </Card>
  );
}

function KeyShareCard({ status }: { status: TrusteeStatus }) {
  const f = status.fingerprints ?? {};
  const check = status.ceremony?.transcript_check ?? "";
  const any = f.share || f.joint_key || f.roster || f.ballots;
  const row: CSSProperties = {
    padding: "12px 0",
    borderTop: `1px solid ${tokens.color.border}`,
    display: "grid",
    gap: 8,
  };
  return (
    <Card>
      <Head title="Your key share" />
      {any ? (
        <p style={{ ...small, margin: `0 0 ${tokens.space.xs}px` }}>
          Read these aloud against the other trustee pages and the board.
        </p>
      ) : null}
      {!any ? (
        <p style={{ ...noteText, fontSize: tokens.font.body, margin: 0 }}>
          The share fingerprint and the election key appear here when the key
          ceremony finishes.
        </p>
      ) : null}
      {f.share ? (
        <div style={row}>
          <VerifiableValue label="Share fingerprint" value={f.share} />
        </div>
      ) : null}
      {f.joint_key ? (
        <div style={row}>
          <VerifiableValue label="Election key" value={f.joint_key} />
          {check === "ok" ? (
            <span>
              <Chip variant="success" dot>
                matches chain
              </Chip>
            </span>
          ) : check === "mismatch" ? (
            <ErrorBox>
              The election key on the chain does not match this trustee&apos;s.
              Decrypt and the tally signature are blocked for this election.
            </ErrorBox>
          ) : (
            <span style={small}>Not checked against the chain yet.</span>
          )}
        </div>
      ) : null}
      {f.roster ? (
        <div style={row}>
          <VerifiableValue label="Roster fingerprint" value={f.roster} />
        </div>
      ) : null}
      {f.ballots ? (
        <div style={row}>
          <VerifiableValue label="Ballot set fingerprint" value={f.ballots} />
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: 9,
          alignItems: "flex-start",
          marginTop: tokens.space.sm,
          padding: "12px 14px",
          background: tokens.color.bg,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.button,
          ...small,
        }}
      >
        <span style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}>
          <LockIcon size={17} strokeWidth={1.6} />
        </span>
        The key share itself stays in this trustee process and never reaches the
        browser. Only fingerprints are shown.
      </div>
    </Card>
  );
}

function CeremonyLog({ entries }: { entries: LogEntry[] }) {
  return (
    <Card
      flush
      style={{ display: "flex", flexDirection: "column", maxHeight: 460 }}
    >
      <div style={{ padding: "24px 24px 8px" }}>
        <Head title="Ceremony log" right="Newest first" />
      </div>
      <ol
        aria-label="Ceremony log, newest first"
        style={{
          listStyle: "none",
          margin: 0,
          overflowY: "auto",
          padding: "0 24px 20px",
        }}
      >
        {entries.length === 0 ? (
          <li
            style={{
              ...noteText,
              fontSize: tokens.font.body,
              padding: "8px 0",
            }}
          >
            Each step&apos;s progress is listed here as this trustee process
            reports it.
          </li>
        ) : null}
        {entries.map((e, i) => (
          <li
            key={e.key}
            style={{
              display: "flex",
              gap: 13,
              padding: "12px 0",
              borderTop: i === 0 ? "none" : `1px solid ${tokens.color.border}`,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 11,
                height: 11,
                borderRadius: tokens.radius.pill,
                marginTop: 6,
                flexShrink: 0,
                background:
                  e.kind === "alarm" ? tokens.color.error : tokens.color.teal,
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="bc-mono" style={{ display: "block", ...small }}>
                {formatStamp(e.at)}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: tokens.font.body,
                  lineHeight: 1.4,
                  overflowWrap: "anywhere",
                  color:
                    e.kind === "alarm"
                      ? tokens.color.error
                      : tokens.color.text1,
                }}
              >
                <b style={{ fontWeight: 600, display: "block" }}>{e.lead}</b>
                {e.detail ? e.detail : null}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function LiveApp({ trusteeId }: { trusteeId: number }) {
  const [auth, setAuth] = useState<Auth>({ kind: "checking" });
  const [status, setStatus] = useState<TrusteeStatus | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pressing, setPressing] = useState<StepName | null>(null);
  const [pressError, setPressError] = useState<{
    step: StepName;
    message: string;
    /** A 409: the process refused the press, in its own sentence. */
    refusal?: boolean;
    /** The election the press was made in: another election drops it. */
    election: string | null;
  } | null>(null);
  /**
   * The log and the election it belongs to, kept together: the updater
   * below reads both from React's own previous state. (A ref written after
   * `setLog` was already the new election when React ran the queued updater,
   * so the old election's entries were kept: I3, rehearsal 2.)
   */
  const [log, setLog] = useState<{
    election: string | null;
    entries: LogEntry[];
  }>({ election: null, entries: [] });
  const inFlight = useRef(false);
  /** A press is out; polls wait for its answer (R1). */
  const pressPending = useRef(false);
  /**
   * Bumped when a press starts: a poll sent before it answers with the old
   * state and must not put that back over the press's answer (M2).
   */
  const epoch = useRef(0);
  /**
   * The signed-in poll's controller: aborted when the poll stops for good
   * (sign-out, unmount), so a request in flight then is dropped (M8).
   */
  const pollCtrl = useRef<AbortController | null>(null);

  const checkSession = useCallback(() => {
    getMe()
      .then((session) => setAuth({ kind: "in", session }))
      .catch((e) =>
        setAuth(
          e instanceof ApiError && e.status === 401
            ? { kind: "login" }
            : {
                kind: "denied",
                message: e instanceof Error ? e.message : String(e),
              },
        ),
      );
  }, []);
  useEffect(checkSession, [checkSession]);

  const take = useCallback((s: TrusteeStatus) => {
    setStatus(s);
    setLog((prev) => ({
      election: s.election?.election_id ?? null,
      entries: mergeLog(prev.entries, prev.election, s),
    }));
  }, []);

  const fail = useCallback((e: unknown): string => {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof ApiError && e.status === 401) setAuth({ kind: "login" });
    else if (e instanceof ApiError && e.status === 403)
      setAuth({ kind: "denied", message });
    return message;
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current || pressPending.current) return;
    inFlight.current = true;
    const sentAt = epoch.current;
    const parent = pollCtrl.current?.signal;
    // A hung read is given up after POLL_TIMEOUT_MS, shown as a failed
    // poll, and the next tick asks again.
    const limit = pollSignal(parent);
    try {
      const s = await getStatus(limit.signal);
      if (parent?.aborted) return;
      if (sentAt === epoch.current) take(s);
      setFetchError(null);
    } catch (e) {
      // Unmounted or signed out: nothing to say.
      if (parent?.aborted) return;
      const message = fail(e);
      if (!(e instanceof ApiError && (e.status === 401 || e.status === 403)))
        setFetchError(message);
    } finally {
      limit.done();
      inFlight.current = false;
    }
  }, [take, fail]);

  const signedIn = auth.kind === "in";

  // D9: poll while the tab is visible; stop when hidden; resume on return.
  useEffect(() => {
    if (!signedIn) return;
    const ctrl = new AbortController();
    pollCtrl.current = ctrl;
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (document.visibilityState === "hidden") return;
      timer = window.setInterval(() => void refresh(), POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else {
        void refresh();
        start();
      }
    };
    if (document.visibilityState !== "hidden") void refresh();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      ctrl.abort();
    };
  }, [signedIn, refresh]);

  // A press error is over once the process reports the step working or done.
  useEffect(() => {
    if (!pressError || !status) return;
    const state = stepOf(status, pressError.step).state;
    if (
      state === "running" ||
      state === "done" ||
      (status.election?.election_id ?? null) !== pressError.election
    )
      setPressError(null);
  }, [status, pressError]);

  useEffect(() => {
    document.title = tabTitle(trusteeId, signedIn ? status : null);
  }, [trusteeId, signedIn, status]);

  async function checkNow() {
    setChecking(true);
    try {
      // Wait out a poll already in flight, then read again.
      while (inFlight.current) await new Promise((r) => setTimeout(r, 50));
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  async function press(step: StepName) {
    if (!status) return;
    setPressError(null);
    setPressing(step);
    pressPending.current = true;
    epoch.current += 1;
    try {
      // No timeout: the process answers 202 at once, but the console can
      // hold a call for minutes during a block wait.
      const next =
        step === "join"
          ? await join()
          : step === "decrypt"
            ? await decrypt()
            : await sign(status.tally?.totals ?? []);
      take(next);
    } catch (e) {
      setPressError({
        step,
        message: fail(e),
        refusal: e instanceof ApiError && e.status === 409,
        election: status.election?.election_id ?? null,
      });
    } finally {
      // Any poll sent while the press was out is older than its answer.
      epoch.current += 1;
      pressPending.current = false;
      setPressing(null);
    }
  }

  async function signOut() {
    // The poll's request in flight is for the session that ends now.
    pollCtrl.current?.abort();
    try {
      await logout();
    } finally {
      setStatus(null);
      setAuth({ kind: "login" });
    }
  }

  const total = status?.election?.trustees;
  const tracker = status ? trackerSteps(status) : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.color.bg,
        color: tokens.color.text1,
        fontFamily: tokens.type.fontFamily,
        fontSize: tokens.font.body,
        lineHeight: tokens.type.lineHeight,
      }}
    >
      <TopBar
        appName=""
        electionName={
          status
            ? status.election
              ? status.election.title || status.election.election_id
              : "No election yet"
            : undefined
        }
        role={
          <>
            {signedIn || auth.kind === "denied" ? (
              <SecondaryButton
                onClick={signOut}
                style={{
                  minHeight: 44,
                  padding: "0 14px",
                  fontSize: tokens.font.small,
                  borderRadius: tokens.radius.button,
                  border: `1px solid ${tokens.color.border}`,
                  color: tokens.color.text2,
                }}
              >
                Sign out
              </SecondaryButton>
            ) : null}
          </>
        }
      />

      {auth.kind === "checking" ? (
        <main className="bc-wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
          <Card>
            <Skeleton label="Loading…" />
          </Card>
        </main>
      ) : null}

      {auth.kind === "login" ? (
        <Login
          onSignedIn={() => {
            setAuth({ kind: "checking" });
            checkSession();
          }}
          tag={`Trustee ${trusteeId}`}
          intro={`This page belongs to trustee ${trusteeId}'s own process. It accepts only trustee ${trusteeId}'s account.`}
          note="Sessions end when this trustee process restarts; its steps carry on."
        />
      ) : null}

      {auth.kind === "denied" ? <Notice>{auth.message}</Notice> : null}

      {signedIn && !status && !fetchError ? (
        <main className="bc-wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
          <Card>
            <Skeleton label="Loading this trustee's status…" />
          </Card>
        </main>
      ) : null}

      {signedIn && !status && fetchError ? (
        <Notice onRetry={() => void checkNow()}>
          This page cannot reach the trustee process: {fetchError}
        </Notice>
      ) : null}

      {signedIn && status && tracker ? (
        <main className="bc-wrap lt-main">
          {/* D5: identity first, once, at heading size. */}
          <h2
            style={{
              fontSize: tokens.font.h2,
              fontWeight: 700,
              lineHeight: 1.25,
              margin: 0,
            }}
          >
            Trustee {trusteeId}
            {total ? ` of ${total}` : ""}
          </h2>
          {fetchError ? (
            <InlineNotice>
              This page cannot reach the trustee process: {fetchError}. It tries
              again every few seconds; what is shown is the last answer.
            </InlineNotice>
          ) : null}
          {status.console && !status.console.reachable ? (
            <InlineNotice>
              This trustee process cannot reach the console.
              {status.console.error ? ` ${status.console.error}.` : ""} It tries
              again by itself.
            </InlineNotice>
          ) : null}

          <div className="lt-trackrow">
            <Stepper
              steps={tracker.steps}
              current={tracker.current}
              statusWords
              label="Trustee steps"
            />
            <div className="lt-checkrow">
              <span style={small}>
                {/* Only the process's own time; none, no claim. */}
                {formatStamp(status.updated_at)
                  ? `Updated ${formatStamp(status.updated_at)}. `
                  : ""}
                Refreshes by itself.
              </span>
              <SecondaryButton
                onClick={() => void checkNow()}
                // Polls wait for a press's answer, so a check would be silent.
                disabled={checking || pressing !== null}
                aria-busy={checking || undefined}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  fontSize: tokens.font.small,
                  borderRadius: tokens.radius.button,
                  border: `1px solid ${tokens.color.border}`,
                }}
              >
                {checking ? "Checking…" : "Check now"}
              </SecondaryButton>
            </div>
          </div>

          <Alarms status={status} />

          <div className="lt-grid">
            <ActionCard
              status={status}
              pressing={pressing}
              pressError={pressError}
              onPress={(s) => void press(s)}
            />
            <RosterCard status={status} />
          </div>
          <KeyShareCard status={status} />
          <CeremonyLog entries={log.entries} />
        </main>
      ) : null}
    </div>
  );
}
