/**
 * The presenter page for a live election (design review D6, D9, D13, D14,
 * D19): one step at a time, the permanent steps behind a confirm, and the
 * page moves on by itself as the console's view changes.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  tokens,
  Card,
  Chip,
  CopyButton,
  SecondaryButton,
  Skeleton,
  Stepper,
  TextButton,
  TopBar,
  VerifiableValue,
  idToName,
  pollSignal,
} from "@balotachain/ui";
import { ApiError, getMe, logout, type Session } from "../lib/bulletin";
import {
  LiveError,
  abandonElection,
  closeVoting,
  createElection,
  publishTally,
  readElection,
  verifyResult,
} from "./api";
import {
  belowMinimum,
  checkStage,
  nextStuckHold,
  nextMissingSeen,
  NO_HOLD,
  NO_MISSING,
  type MissingSeen,
  type StuckHold,
  closeBelowMinimum,
  closedBelowMinimum,
  closeConsequence,
  joinedOf,
  maySayVerified,
  nowRows,
  phaseOf,
  retryRequestOf,
  tabTitle,
  totalsByPosition,
  trackerFor,
  trusteeAddresses,
  voterAddress,
  DEMO_TRUSTEES,
  type DeskCounts,
  type Phase,
} from "./model";
import { SetupForm } from "./SetupForm";
import { ElectionDayList, DESK_STATES } from "./ElectionDayList";
import { Demonstrations } from "./Demonstrations";
import {
  body,
  ErrorBox,
  h2,
  InlineConfirm,
  InlineNotice,
  muted,
  secondarySmall,
  small,
  WriteButton,
} from "./parts";
import type { LiveElectionView, VerifyAnswer } from "./types";
import "./live.css";

/** The page's own heading; the top bar's mark is the page's h1. */
const pageHeading = {
  fontSize: tokens.font.h2,
  fontWeight: 700,
  lineHeight: 1.25,
  margin: 0,
} as const;

/** D9: refresh every 2 to 3 seconds while the tab is visible. */
export const POLL_MS = 2500;

/**
 * At `closed` with the threshold of signatures held, the console is already
 * publishing (`postTallySig` publishes at the threshold, with a block wait).
 * Publish result is offered only once that has lasted this long, which means
 * the console's own publication did not go through.
 */
export const PUBLISH_GRACE_MS = 10_000;

/** The console's 409 when a publish arrives after its own publication. */
const ALREADY_TALLIED = /^the live election is (tallied|verified)\b/;

type Auth =
  | { kind: "checking" }
  | { kind: "login" }
  | { kind: "in"; session: Session | null }
  | { kind: "denied"; message: string }
  | { kind: "unreachable"; message: string };

type WriteKind =
  | "create"
  | "retry"
  | "close"
  | "publish"
  | "verify"
  | "abandon";

type WriteFailure = { kind: WriteKind; message: string; code?: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// --- the action card ----------------------------------------------------------------

/** Positions and candidates, as the election was created. */
function ElectionSummary({ view }: { view: LiveElectionView }) {
  const positions = view.positions ?? [];
  if (positions.length === 0) return null;
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "grid",
        gap: tokens.space.xs,
      }}
    >
      {positions.map((p) => (
        <li key={p.id} style={body}>
          <span style={{ fontWeight: 600 }}>{idToName(p.id)}</span>
          {": "}
          {p.candidates.map(idToName).join(", ")}
        </li>
      ))}
    </ul>
  );
}

function Totals({ view }: { view: LiveElectionView }) {
  const rows = totalsByPosition(view);
  if (!view.totals || rows.length === 0)
    return <p style={muted}>The console has not sent the totals.</p>;
  return (
    <div style={{ display: "grid", gap: tokens.space.sm }}>
      {rows.map((r) => (
        <div key={r.position}>
          <h4 style={{ ...body, fontWeight: 600, marginBottom: 4 }}>
            {idToName(r.position)}
          </h4>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {r.candidates.map((c) => (
              <li
                key={c.id}
                style={{
                  ...body,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: tokens.space.sm,
                  padding: "4px 0",
                  borderBottom: `1px solid ${tokens.color.border}`,
                }}
              >
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {idToName(c.id)}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                  }}
                >
                  {c.votes ?? "not known"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A line saying what the step waits on; announced as status. */
function Waiting({ children }: { children: ReactNode }) {
  return (
    <p role="status" style={{ ...body, color: tokens.color.text1 }}>
      {children}
    </p>
  );
}

function CheckOutcome({
  view,
  answer,
}: {
  view: LiveElectionView;
  answer: VerifyAnswer | null;
}) {
  const fromChain = view.counts?.ballot_records_source === "chain";
  if (maySayVerified(view)) {
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
          Verified
        </Chip>
        <span style={{ ...body, fontWeight: 600 }}>Result verified</span>
        <span style={body}>The check passed over the record on chain.</span>
      </div>
    );
  }
  if (view.state === "verified") {
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <p style={{ ...body, fontWeight: 600 }}>Result published</p>
        <p style={muted}>
          {view.counts
            ? "The check passed, but the ballot count now comes from the console's record because the chain did not answer, so this page does not call the result checked on chain."
            : "The check passed, but the console sent no ballot count, so this page does not call the result checked on chain."}
        </p>
      </div>
    );
  }
  const failed =
    answer && answer.overall !== "pass" ? (answer.failed_checks ?? []) : null;
  const stage = checkStage(view);
  if (stage === "running" && !failed) {
    // The console checks by itself as soon as the tally is published.
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <Waiting>
          <span style={{ fontWeight: 600 }}>
            Verifying the result on the chain…
          </span>
        </Waiting>
        <p style={muted}>
          The console reads the election back from the chain and checks every
          ballot, share and signature by itself as soon as the tally is
          published. No press is needed.
        </p>
      </div>
    );
  }
  if (failed || view.verify_overall === "fail") {
    return (
      <ErrorBox>
        <span style={{ display: "block" }}>Result NOT verified</span>
        {failed && failed.length > 0 ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontWeight: 400 }}>
            {failed.map((f, i) => (
              <li key={`${f.check}-${i}`}>
                <span className="bc-mono">{f.check}</span>
                {f.detail ? `: ${f.detail}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ display: "block", fontWeight: 400 }}>
            The last check failed. Verify again runs it once more and lists each
            failed check.
          </span>
        )}
      </ErrorBox>
    );
  }
  const why = view.auto_verify?.error;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <p style={{ ...body, fontWeight: 600 }}>Not verified yet</p>
      {why ? (
        <p style={body}>The automatic check gave no verdict: {why}</p>
      ) : null}
      <p style={muted}>
        The result is published. Verify again reads the election back from the
        chain and checks every ballot, share and signature.
        {fromChain
          ? ""
          : view.counts
            ? " The ballot count is from the console's record: the chain did not answer."
            : " The console sent no ballot count."}
      </p>
    </div>
  );
}

function ActionCard({
  view,
  phase,
  writing,
  writeError,
  verifyAnswer,
  confirmClose,
  setConfirmClose,
  onWrite,
  formOpen,
  setFormOpen,
  publishStuck,
  focusKey,
  onAuthFail,
  deskCounts,
  stuck,
  missingSeen,
}: {
  view: LiveElectionView | null;
  phase: Phase;
  writing: WriteKind | null;
  writeError: WriteFailure | null;
  verifyAnswer: VerifyAnswer | null;
  confirmClose: boolean;
  setConfirmClose: (open: boolean) => void;
  onWrite: (kind: WriteKind, body?: unknown) => void;
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  /** The signatures have been held for `PUBLISH_GRACE_MS` and still `closed`. */
  publishStuck: boolean;
  /** Bumped when a write moved the page on: the new step's heading takes the focus. */
  focusKey: number;
  onAuthFail: (e: unknown) => void;
  /** The voter list's counts, from the Election-day list's last answer. */
  deskCounts: DeskCounts | null;
  /** The below-minimum hold at `closed` has passed (rehearsal 5). */
  stuck: boolean;
  /**
   * `tallied` with no run and no verdict was seen on two consecutive polls
   * (review minor 5): only then is Verify again offered for it, so the poll
   * just after publication, before the console's run shows, offers none.
   */
  missingSeen: boolean;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusKey > 0) headingRef.current?.focus();
  }, [focusKey]);
  const errorFor = (kind: WriteKind) =>
    writeError?.kind === kind ? (
      <ErrorBox>{writeError.message} Try again.</ErrorBox>
    ) : null;
  const form = (
    <SetupForm
      busy={writing === "create"}
      error={writeError?.kind === "create" ? writeError.message : null}
      errorCode={writeError?.kind === "create" ? writeError.code : undefined}
      onAuthFail={onAuthFail}
      onSubmit={(b) => onWrite("create", b)}
    />
  );

  let heading: string;
  let content: ReactNode;
  const c = view?.counts;
  const below = belowMinimum(view);
  /** The stuck wording at `closed`, only once the hold has passed. */
  const stuckBelow = stuck ? below : null;
  switch (phase) {
    case "none":
      heading = "Set up the election";
      content = form;
      break;
    case "unrecorded":
      heading = "Election made, not yet on chain";
      content = (
        <>
          <p style={body}>
            The console made the election&apos;s keys, but the chain has not
            recorded it yet, so the trustees cannot join. The console also tries
            again each time it starts.
          </p>
          {view ? <ElectionSummary view={view} /> : null}
          {errorFor("retry")}
          <WriteButton
            label={
              writeError?.kind === "retry" ? "Try again" : "Record on chain"
            }
            busyLabel="Recording on chain…"
            busy={writing === "retry"}
            onClick={() => view && onWrite("retry", retryRequestOf(view))}
          />
        </>
      );
      break;
    case "created":
      heading = "Election created";
      content = (
        <>
          {view ? <ElectionSummary view={view} /> : null}
          <Waiting>
            Waiting for the trustees to join the key ceremony. 0 of{" "}
            {view?.trustees ?? DEMO_TRUSTEES} trustees joined.
          </Waiting>
        </>
      );
      break;
    case "ceremony": {
      heading = "Key ceremony";
      const joined = view ? joinedOf(view) : undefined;
      const total = view?.trustees ?? DEMO_TRUSTEES;
      content = (
        <>
          <Waiting>
            {joined === undefined
              ? "The trustees are joining the key ceremony."
              : `${joined} of ${total} trustees joined.`}{" "}
            {joined !== undefined && joined >= total
              ? "Waiting for them to exchange their shares; voting opens by itself when the election key is published."
              : "Each trustee joins on their own page. Voting opens by itself when the election key is published."}
          </Waiting>
          {view?.ceremony_error ? (
            <ErrorBox>
              {view.ceremony_error} This election cannot finish: abandon it
              below and set up the next one.
            </ErrorBox>
          ) : null}
        </>
      );
      break;
    }
    case "open":
      heading = "Voting";
      content = (
        <>
          <p style={body}>Voting is open. Close when every voter has voted.</p>
          {errorFor("close")}
          {confirmClose && view ? (
            <InlineConfirm
              title="Close voting?"
              headingLevel={4}
              lines={
                // I1 (rehearsal 5): closing below the console's minimum
                // leaves an election that can never finish; said first.
                below
                  ? [
                      closeBelowMinimum(below),
                      ...closeConsequence(view, deskCounts ?? undefined),
                    ]
                  : closeConsequence(view, deskCounts ?? undefined)
              }
              confirmLabel={
                writeError?.kind === "close"
                  ? "Try again"
                  : below
                    ? "Close anyway"
                    : "Close voting now"
              }
              busyLabel="Closing on chain…"
              busy={writing === "close"}
              onCancel={() => {
                setConfirmClose(false);
                window.setTimeout(() => closeButton.current?.focus(), 0);
              }}
              onConfirm={() => onWrite("close")}
            />
          ) : (
            <WriteButton
              buttonRef={closeButton}
              label={
                writeError?.kind === "close" ? "Try again" : "Close voting"
              }
              busyLabel="Closing on chain…"
              busy={writing === "close"}
              onClick={() => setConfirmClose(true)}
            />
          )}
        </>
      );
      break;
    case "closed": {
      if (stuckBelow) {
        // I2 (rehearsal 5): no trustee can decrypt this election; the page
        // says so instead of waiting for them.
        heading = "Cannot be decrypted";
        content = (
          <p style={body}>
            {closedBelowMinimum(stuckBelow)}{" "}
            <code className="bc-mono">tools/live-reset.sh</code>
          </p>
        );
        break;
      }
      heading = "Decrypt";
      const t = view?.threshold ?? 0;
      const shares = c?.trustees_decrypted;
      const sigs = c?.tally_signatures;
      const sharesIn = typeof shares === "number" && shares >= t;
      const sigsIn = typeof sigs === "number" && sigs >= t;
      content = (
        <>
          <p style={{ ...body, fontWeight: 600 }} data-testid="shares">
            {typeof shares === "number"
              ? `${shares} of ${t} trustee shares recorded`
              : "The console sent no count of trustee shares."}
          </p>
          {sharesIn ? (
            <p style={{ ...body, fontWeight: 600 }} data-testid="signatures">
              {typeof sigs === "number"
                ? `${sigs} of ${t} signatures`
                : "The console sent no count of signatures."}
            </p>
          ) : null}
          {!sharesIn ? (
            <Waiting>
              Waiting for trustees to decrypt on their own pages. Once {t}{" "}
              shares are recorded, each of those trustee processes signs the
              totals by itself, and the console publishes the result when {t}{" "}
              signatures are held. Nobody presses Sign.
            </Waiting>
          ) : !sigsIn ? (
            <Waiting>
              Waiting for the trustee processes to sign the totals by
              themselves. The console publishes the result when {t} signatures
              are held.
            </Waiting>
          ) : !publishStuck && writeError?.kind !== "publish" ? (
            <Waiting>
              {sigs} of {t} signatures held. The console is publishing the
              result on chain.
            </Waiting>
          ) : (
            <>
              <p style={body}>
                {sigs} of {t} signatures are held, but the console&apos;s own
                publication has not gone through yet, so the result can be
                published here.
              </p>
              {errorFor("publish")}
              <WriteButton
                label={
                  writeError?.kind === "publish"
                    ? "Try again"
                    : "Publish result"
                }
                busyLabel="Publishing on chain…"
                busy={writing === "publish"}
                onClick={() => onWrite("publish")}
              />
            </>
          )}
        </>
      );
      break;
    }
    case "tallied":
    case "verified": {
      heading = "Result";
      // The console verifies by itself; Verify again is offered only when
      // it reports a failed or missing verification at `tallied` (or while
      // that retry's press is out).
      const stage = checkStage(view);
      const offerRetry =
        writing === "verify" ||
        (phase === "tallied" &&
          (stage === "failed" ||
            (stage === "missing" && missingSeen) ||
            (stage === "running" &&
              verifyAnswer !== null &&
              verifyAnswer.overall !== "pass")));
      content = (
        <>
          {view ? <Totals view={view} /> : null}
          {view ? <CheckOutcome view={view} answer={verifyAnswer} /> : null}
          {errorFor("verify")}
          {offerRetry ? (
            <WriteButton
              label={
                writeError?.kind === "verify" ? "Try again" : "Verify again"
              }
              busyLabel="Checking the record on chain…"
              stillText="Still checking. Keep this page open."
              busy={writing === "verify"}
              onClick={() => onWrite("verify")}
            />
          ) : null}
          {phase === "verified" ? (
            formOpen ? (
              <div className="lp-row">
                <h4 style={{ ...body, fontWeight: 600 }}>Next election</h4>
                {form}
              </div>
            ) : (
              <div>
                <TextButton
                  onClick={() => setFormOpen(true)}
                  style={{ minHeight: 44 }}
                >
                  Set up the next election
                </TextButton>
              </div>
            )
          ) : null}
        </>
      );
      break;
    }
    case "abandoned":
      heading = "Election abandoned";
      content = (
        <>
          <p style={body}>
            No result will be published for this election.{" "}
            {view?.lifecycle?.CreateElection
              ? "The chain keeps its record of it, which no ballot can use."
              : "It was abandoned before the chain recorded it."}
          </p>
          <div className="lp-row">
            <h4 style={{ ...body, fontWeight: 600 }}>Next election</h4>
            {form}
          </div>
        </>
      );
      break;
    default:
      heading = "State not known";
      content = (
        <p style={body}>
          The console reports the state &quot;{view?.state}&quot;, which this
          page does not know.
        </p>
      );
  }

  return (
    <section aria-label="Current step">
      <Card>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.sm,
          }}
        >
          <h3 ref={headingRef} tabIndex={-1} style={h2}>
            {heading}
          </h3>
          {content}
        </div>
      </Card>
    </section>
  );
}

/**
 * An address that may wrap only after a slash or a dot, never inside the
 * port or a word, so it can still be read aloud when it wraps.
 */
function breakable(address: string): ReactNode[] {
  return address.split(/(?<=[/.])/).map((part, i) => (
    <span key={i}>
      {part}
      <wbr />
    </span>
  ));
}

// --- the "Now" panel, links and abandon ---------------------------------------------

function NowPanel({ view }: { view: LiveElectionView }) {
  const rows = nowRows(view);
  return (
    <section aria-label="Now">
      <Card>
        <h3 style={{ ...h2, marginBottom: tokens.space.sm }}>Now</h3>
        {!view.counts ? (
          <p style={muted}>The console sent no counts.</p>
        ) : (
          <dl className="lp-now" style={body}>
            {rows.map((r) => (
              <div key={r.key} style={{ display: "contents" }}>
                <dt>{r.label}</dt>
                <dd>
                  <span style={{ fontWeight: 600 }}>{r.value}</span>
                  {r.note ? (
                    <span style={{ ...small, display: "block" }}>{r.note}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {view.joint_key_fingerprint ? (
          <div style={{ marginTop: tokens.space.sm }}>
            <VerifiableValue
              value={view.joint_key_fingerprint}
              label="Election key"
            />
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function Links({ view }: { view: LiveElectionView | null }) {
  const voter = voterAddress(window.location.origin);
  const trustees = trusteeAddresses(
    window.location.protocol,
    window.location.hostname,
    view?.trustees || DEMO_TRUSTEES,
  );
  return (
    <section aria-label="Links">
      <Card>
        <h3 style={{ ...h2, marginBottom: tokens.space.xs }}>Links</h3>
        <div style={{ display: "grid", gap: tokens.space.xs }}>
          <div className="lp-links">
            <a
              className="lp-link"
              href="/board/"
              target="_blank"
              rel="noreferrer"
            >
              Board
            </a>
            {trustees.map((url, i) => (
              <a
                key={url}
                className="lp-link"
                href={url}
                target="_blank"
                rel="noreferrer"
                title={url}
              >
                Trustee {i + 1}
              </a>
            ))}
          </div>
          {trustees.length === 0 ? (
            <p style={small}>
              Trustee pages are on each trustee&apos;s own host; this page shows
              their addresses only when it is served from a vote. host.
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: tokens.space.xs,
            }}
          >
            <span style={body}>Voter page:</span>
            <span
              className="bc-mono"
              data-testid="voter-address"
              style={{ fontSize: tokens.font.body, overflowWrap: "normal" }}
            >
              {breakable(voter)}
            </span>
            <CopyButton
              value={voter}
              label="Copy the voter page address"
              size="sm"
            />
          </div>
        </div>
      </Card>
    </section>
  );
}

function Abandon({
  view,
  writing,
  writeError,
  onWrite,
}: {
  view: LiveElectionView;
  writing: WriteKind | null;
  writeError: WriteFailure | null;
  onWrite: (kind: WriteKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  if (view.state === "abandoned") return null;
  const allowed = view.state === "setup" || view.state === "ceremony";
  if (!allowed) {
    return (
      <p style={small}>
        An election can be abandoned only before voting opens; this one is past
        that.
      </p>
    );
  }
  return (
    <section
      aria-label="Abandon"
      style={{ display: "grid", gap: tokens.space.sm }}
    >
      {writeError?.kind === "abandon" ? (
        <ErrorBox>{writeError.message} Try again.</ErrorBox>
      ) : null}
      {open ? (
        <InlineConfirm
          title="Abandon this election?"
          headingLevel={3}
          lines={[
            view.state === "setup"
              ? "The election's keys are given up. No ballot can be cast in it and no result will be published. The chain has not recorded it."
              : "The election's keys and the trustees' work in the key ceremony are given up. No ballot can be cast in it and no result will be published. The chain keeps its record of the election.",
            "This cannot be undone.",
          ]}
          confirmLabel={
            writeError?.kind === "abandon"
              ? "Try again"
              : "Abandon this election"
          }
          busyLabel="Abandoning…"
          busy={writing === "abandon"}
          onCancel={() => {
            setOpen(false);
            window.setTimeout(() => opener.current?.focus(), 0);
          }}
          onConfirm={() => onWrite("abandon")}
        />
      ) : (
        <div>
          <TextButton
            ref={opener}
            onClick={() => setOpen(true)}
            style={{
              minHeight: 44,
              fontSize: tokens.font.small,
              color: tokens.color.text2,
            }}
          >
            Abandon this election
          </TextButton>
        </div>
      )}
    </section>
  );
}

// --- the page ----------------------------------------------------------------------

/** The counts a change of which is announced, as words. */
function countWords(v: LiveElectionView | null): Record<string, string> {
  if (!v) return {};
  const c = v.counts;
  const out: Record<string, string> = { state: `State: ${v.state}.` };
  if (!c) return out;
  const onList = c.voters_on_list;
  if (typeof c.checked_in === "number")
    out.checked =
      typeof onList === "number"
        ? `Checked in: ${c.checked_in} of ${onList}.`
        : `Checked in: ${c.checked_in}.`;
  out.issued = `Credentials issued: ${c.credentials_issued}.`;
  out.records = `Ballot records: ${c.ballot_records}.`;
  if (typeof c.trustees_joined === "number")
    out.joined = `Trustees joined: ${c.trustees_joined} of ${v.trustees}.`;
  out.shares = `Trustee shares: ${c.trustees_decrypted} of ${v.threshold}.`;
  out.sigs = `Signatures: ${c.tally_signatures} of ${v.threshold}.`;
  return out;
}

export function Presenter({
  initialView,
  Login,
}: {
  initialView: LiveElectionView | null;
  /** The app's own sign-in card. */
  Login: (props: { onSignedIn: () => void }) => ReactNode;
}) {
  const [auth, setAuth] = useState<Auth>({ kind: "checking" });
  const [view, setView] = useState<LiveElectionView | null>(initialView);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [writing, setWriting] = useState<WriteKind | null>(null);
  const [writeError, setWriteError] = useState<WriteFailure | null>(null);
  const [verifyAnswer, setVerifyAnswer] = useState<VerifyAnswer | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [publishStuck, setPublishStuck] = useState(false);
  const [deskCounts, setDeskCounts] = useState<DeskCounts | null>(null);
  /** Bumped after a write moved the page on, to move the focus with it. */
  const [focusKey, setFocusKey] = useState(0);
  /** The stuck hold at `closed` (review of rehearsal 5), per election id. */
  const [missing, setMissing] = useState<MissingSeen>(() =>
    nextMissingSeen(NO_MISSING, initialView),
  );
  const [hold, setHold] = useState<StuckHold>(() =>
    nextStuckHold(NO_HOLD, initialView, Date.now()),
  );

  // Rehearsal 4, I1: everything this page learned about one election belongs
  // to that election. When the console's election id changes (a next
  // election, a reset, no election at all), the answers kept for the old one
  // are dropped in the same render, before anything of theirs is drawn under
  // the new id. The children that keep their own state (Demonstrations,
  // Abandon, the Election-day list) are keyed by the id below.
  const electionId = view?.election_id ?? null;
  const [shownFor, setShownFor] = useState<string | null>(electionId);
  if (shownFor !== electionId) {
    setShownFor(electionId);
    setVerifyAnswer(null);
    setConfirmClose(false);
    setFormOpen(false);
    setDeskCounts(null);
    // A write still out keeps its own error slot: its answer is about the
    // election it moved the page to (Create), so only a settled one goes.
    if (writing === null) setWriteError(null);
  }

  const inFlight = useRef<Promise<void> | null>(null);
  /** A write is out; polls wait for its answer. */
  const writePending = useRef<symbol | null>(null);
  /** Bumped at each write: a poll sent before it must not undo its answer. */
  const epoch = useRef(0);
  const lastWords = useRef<Record<string, string> | null>(null);
  /** The election `lastWords` was taken from. */
  const lastWordsFor = useRef<string | null>(initialView?.election_id ?? null);

  const checkSession = useCallback(() => {
    getMe()
      .then((session) =>
        setAuth(
          session === null || session.role === "admin"
            ? { kind: "in", session }
            : {
                kind: "denied",
                message: `Signed in as ${session.username}, a ${session.role} account. The presenter page needs an administrator account.`,
              },
        ),
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

  /** A failed admin call: a 401 goes to sign-in, a 403 says why. */
  const fail = useCallback((e: unknown): string => {
    const status = (e as { status?: number })?.status;
    if (status === 401) setAuth({ kind: "login" });
    else if (status === 403 && message(e) === "admin role required")
      setAuth({ kind: "denied", message: message(e) });
    return message(e);
  }, []);

  /** Takes a view, announcing the counts that changed (once per change). */
  const take = useCallback((v: LiveElectionView | null) => {
    setView(v);
    setHold((h) => nextStuckHold(h, v, Date.now()));
    setMissing((m) => nextMissingSeen(m, v));
    setUpdatedAt(new Date());
    const words = countWords(v);
    const prev = lastWords.current;
    lastWords.current = words;
    // Review minor 3: the first view of another election (or of none) is a
    // new start, not a change of the old one's counts. Rehearsal 5, m1: it
    // still replaces what the region holds, with the new election's state
    // line only. Left alone, the region kept the old election's last line
    // ("State: verified.") until a later poll changed the state again.
    const id = v?.election_id ?? null;
    const sameElection = lastWordsFor.current === id;
    lastWordsFor.current = id;
    if (prev && !sameElection) {
      setAnnouncement(words.state ?? "");
      return;
    }
    if (!prev) return;
    const changed = Object.keys(words)
      .filter((k) => words[k] !== prev[k])
      .map((k) => words[k]);
    if (changed.length > 0) setAnnouncement(changed.join(" "));
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    if (writePending.current) return Promise.resolve();
    const sentAt = epoch.current;
    const p = (async () => {
      // A hung read is given up after POLL_TIMEOUT_MS, shown as a failed
      // poll, and the next tick asks again.
      const limit = pollSignal();
      try {
        const v = await readElection(limit.signal);
        if (sentAt === epoch.current) take(v);
        setFetchError(null);
      } catch (e) {
        setFetchError(message(e));
      } finally {
        limit.done();
      }
    })();
    inFlight.current = p;
    void p.finally(() => {
      // Clear only our own marker (StrictMode runs effects twice).
      if (inFlight.current === p) inFlight.current = null;
    });
    return p;
  }, [take]);

  /**
   * The Demonstrations' fresh reads take the poll's rule: a read sent before
   * a write began or ended, or landing while one is pending, is dropped.
   */
  const epochNow = useCallback(() => epoch.current, []);
  const takeFresh = useCallback(
    (v: LiveElectionView, sentAt: number) => {
      if (sentAt === epoch.current && !writePending.current) take(v);
    },
    [take],
  );

  const signedIn = auth.kind === "in";

  // The first view is the probe's; later ones come from the poll.
  useEffect(() => {
    if (lastWords.current === null) lastWords.current = countWords(initialView);
  }, [initialView]);

  // D9: poll while visible, stop when hidden, ask at once on return.
  useEffect(() => {
    if (!signedIn) return;
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
    };
  }, [signedIn, refresh]);

  const phase = phaseOf(view);
  const stuckNow =
    hold.stuck &&
    hold.id === (view?.election_id ?? null) &&
    !!belowMinimum(view);
  const tracker = trackerFor(view, stuckNow);

  useEffect(() => {
    document.title =
      auth.kind === "login" ? tabTitle("Sign in") : tabTitle(tracker.word);
  }, [auth.kind, tracker.word]);

  // I1: the signatures are held and the console should be publishing; only
  // when that has lasted PUBLISH_GRACE_MS is Publish result offered.
  const sigs = view?.counts?.tally_signatures;
  const sigsHeld =
    view?.state === "closed" &&
    typeof sigs === "number" &&
    sigs >= view.threshold;
  const runId = view?.run_id;
  useEffect(() => {
    setPublishStuck(false);
    if (!sigsHeld) return;
    const timer = window.setTimeout(
      () => setPublishStuck(true),
      PUBLISH_GRACE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [sigsHeld, runId]);

  // The confirm closes itself when voting is no longer open.
  useEffect(() => {
    if (phase !== "open") setConfirmClose(false);
  }, [phase]);

  function openConfirm(open: boolean) {
    setConfirmClose(open);
    // Fresh numbers when the confirm opens; the poll keeps them fresh.
    if (open) void refresh();
  }

  async function write(kind: WriteKind, reqBody?: unknown) {
    if (writePending.current) return;
    const mine = Symbol(kind);
    writePending.current = mine;
    epoch.current += 1;
    setWriting(kind);
    setWriteError(null);
    let ok = false;
    try {
      // No timeout: a chain call can wait for a block.
      if (kind === "create" || kind === "retry") {
        take(
          await createElection(reqBody as Parameters<typeof createElection>[0]),
        );
        setFormOpen(false);
      } else if (kind === "close") {
        take(await closeVoting());
        setConfirmClose(false);
        setFocusKey((n) => n + 1);
      } else if (kind === "abandon") {
        take(await abandonElection());
        setFocusKey((n) => n + 1);
      } else if (kind === "publish") {
        await publishTally();
      } else {
        setVerifyAnswer(await verifyResult());
      }
      ok = true;
    } catch (e) {
      // The console published by itself while this press was waiting: that
      // is the outcome asked for, not an error.
      if (
        kind === "publish" &&
        e instanceof LiveError &&
        e.status === 409 &&
        ALREADY_TALLIED.test(e.message)
      ) {
        ok = true;
      } else {
        setWriteError({
          kind,
          message: fail(e),
          code: e instanceof LiveError ? e.code : undefined,
        });
      }
    } finally {
      epoch.current += 1;
      if (writePending.current === mine) writePending.current = null;
    }
    // Wait out a poll sent before the write, then read the new state.
    if (inFlight.current) await inFlight.current;
    if (ok && (kind === "publish" || kind === "verify")) {
      // These answers carry no view: the button stays busy until the read
      // shows where the election is, so it never comes back for a moment
      // in the state before.
      await refresh();
      setWriting(null);
    } else {
      setWriting(null);
      await refresh();
    }
  }

  async function checkNow() {
    setChecking(true);
    try {
      if (inFlight.current) await inFlight.current;
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      setAuth({ kind: "login" });
    }
  }

  const heading =
    phase === "abandoned"
      ? "Presenter: election abandoned"
      : phase === "closed" && stuckNow
        ? "Presenter: election cannot be decrypted"
        : tracker.current > 0 && tracker.current <= 5
          ? `Presenter: step ${tracker.current} of 5, ${tracker.word}`
          : tracker.current > 5
            ? "Presenter: result verified"
            : "Presenter";

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
        electionName={view ? view.title || view.election_id : "No election yet"}
        role={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.space.xs,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 600 }}>Presenter</span>
            {auth.kind === "in" && auth.session ? (
              <span
                style={{
                  color: tokens.color.text2,
                  fontSize: tokens.font.small,
                }}
              >
                {auth.session.username}
              </span>
            ) : null}
            {auth.kind === "in" || auth.kind === "denied" ? (
              <SecondaryButton
                onClick={() => void signOut()}
                style={{
                  ...secondarySmall,
                  padding: "0 14px",
                  color: tokens.color.text2,
                }}
              >
                Sign out
              </SecondaryButton>
            ) : null}
          </span>
        }
      />
      {/* Mounted before anything changes, so the first change is heard. */}
      <div aria-live="polite" role="status" className="bc-sr-only">
        {announcement}
      </div>

      {auth.kind === "checking" ? (
        <main className="bc-wrap lp-main">
          <Card>
            <Skeleton label="Connecting to the election console…" />
          </Card>
        </main>
      ) : null}

      {auth.kind === "login" ? (
        <main className="bc-wrap lp-main">
          <h2 style={pageHeading}>Presenter</h2>
          <Login
            onSignedIn={() => {
              setAuth({ kind: "checking" });
              checkSession();
            }}
          />
        </main>
      ) : null}

      {auth.kind === "denied" || auth.kind === "unreachable" ? (
        <main className="bc-wrap lp-main">
          <ErrorBox>{auth.message}</ErrorBox>
          {auth.kind === "unreachable" ? (
            <div>
              <SecondaryButton
                onClick={() => {
                  setAuth({ kind: "checking" });
                  checkSession();
                }}
                style={secondarySmall}
              >
                Try again
              </SecondaryButton>
            </div>
          ) : null}
        </main>
      ) : null}

      {signedIn ? (
        <main className="bc-wrap lp-main">
          {/* Identity and the current step, once, at heading size. */}
          <h2 style={pageHeading}>{heading}</h2>
          {fetchError ? (
            <InlineNotice>
              This page cannot reach the console: {fetchError}. It tries again
              every few seconds; what is shown is the last answer.
            </InlineNotice>
          ) : null}
          <div className="lp-trackrow">
            <Stepper
              steps={tracker.steps}
              current={tracker.current}
              statusWords
              label="Presenter steps"
            />
            <div className="lp-checkrow">
              <span style={small}>
                {updatedAt
                  ? `Updated ${updatedAt.toLocaleTimeString()}. Refreshes by itself.`
                  : "Refreshes by itself."}
              </span>
              <SecondaryButton
                onClick={() => void checkNow()}
                disabled={checking}
                aria-busy={checking || undefined}
                style={secondarySmall}
              >
                {checking ? "Checking…" : "Check now"}
              </SecondaryButton>
            </div>
          </div>

          <div className={view ? "lp-grid" : "lp-grid lp-grid-single"}>
            <ActionCard
              view={view}
              phase={phase}
              writing={writing}
              writeError={writeError}
              verifyAnswer={verifyAnswer}
              confirmClose={confirmClose}
              setConfirmClose={openConfirm}
              onWrite={(k, b) => void write(k, b)}
              formOpen={formOpen}
              setFormOpen={setFormOpen}
              publishStuck={publishStuck}
              focusKey={focusKey}
              onAuthFail={fail}
              deskCounts={deskCounts}
              stuck={stuckNow}
              missingSeen={
                missing.polls >= 2 && missing.id === (view?.election_id ?? null)
              }
            />
            {/* Before an election exists the panel would be empty. */}
            {view ? <NowPanel view={view} /> : null}
          </div>
          {view && DESK_STATES.has(view.state) ? (
            <ElectionDayList
              key={view.election_id}
              onAuthFail={fail}
              onCounts={setDeskCounts}
            />
          ) : null}
          <Links view={view} />
          {view && phase !== "abandoned" ? (
            <Demonstrations
              key={`demos-${view.election_id}`}
              view={view}
              epoch={epochNow}
              onFresh={takeFresh}
              onAuthFail={fail}
            />
          ) : null}
          {view ? (
            <Abandon
              key={`abandon-${view.election_id}`}
              view={view}
              writing={writing}
              writeError={writeError}
              onWrite={(k) => void write(k)}
            />
          ) : null}
        </main>
      ) : null}
    </div>
  );
}
