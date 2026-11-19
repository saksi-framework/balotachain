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
  SecondaryButton,
  Skeleton,
  TopBar,
  CheckIcon,
  AlertIcon,
  UsersIcon,
  DownloadIcon,
  CodeIcon,
} from "@balotachain/ui";
import { StatCard } from "./components/StatCard";
import {
  CheckList,
  Fingerprint,
  FooterLink,
  RaceCard,
  VerifyVoteCard,
  cols,
  formatNumber,
  formatStamp,
  noteText,
} from "./components/boardParts";
import { LiveBoard } from "./live/LiveBoard";
import {
  getLiveElection,
  HttpError,
  saysNothing,
  listRuns,
  loadBoard,
  fileUrl,
  verifierUrl,
  type Board,
  type LiveElectionView,
  type RunView,
} from "./lib/bulletin";

/** Ballots are one per voter per position, so a run's ballot count is that product. */
const POLL_MS = 4000;

type Load =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; board: Board };

const sectionHeading: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: tokens.color.text2,
  margin: 0,
};

function runIdFromUrl(): string | null {
  const q = new URLSearchParams(window.location.search);
  return q.get("run") ?? q.get("election");
}

function setRunInUrl(runId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("run", runId);
  window.history.replaceState(null, "", url);
}

/**
 * Ground-truth runs produce plaintext tables and no ciphertexts, so they have
 * no ceremony, no tally and nothing for a bulletin board to show.
 */
function isTalliable(run: RunView): boolean {
  return run.config.mode !== "groundtruth";
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 38 }}>
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
        <h2 style={sectionHeading}>{title}</h2>
        {note ? (
          <span style={{ fontSize: 13.5, color: tokens.color.text2 }}>
            {note}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** The TopBar's right-hand slot: the election picker and the board's status. */
function RunPicker({
  runs,
  runId,
  onPick,
}: {
  runs: RunView[];
  runId: string | null;
  onPick: (id: string) => void;
}) {
  if (runs.length < 2) return null;
  return (
    <select
      aria-label="Election"
      value={runId ?? ""}
      onChange={(e) => onPick(e.currentTarget.value)}
      style={{
        fontFamily: "inherit",
        fontSize: 13.5,
        padding: "7px 10px",
        borderRadius: tokens.radius.button,
        border: `1px solid ${tokens.color.border}`,
        background: tokens.color.surface,
        color: tokens.color.text1,
        maxWidth: "min(340px, 100%)",
      }}
    >
      {runs.map((r) => (
        <option key={r.run_id} value={r.run_id}>
          {r.config.name} — {formatStamp(r.created_at)}
        </option>
      ))}
    </select>
  );
}

function VerifiedBanner({
  trusteesSigned,
  trusteesTotal,
}: {
  trusteesSigned: number;
  trusteesTotal: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        background: tokens.color.successLight,
        border: `1px solid ${tokens.color.successBorder}`,
        borderRadius: tokens.radius.card,
        padding: "22px 26px",
        marginBottom: 30,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 52,
          height: 52,
          borderRadius: tokens.radius.pill,
          background: tokens.color.success,
          color: tokens.color.surface,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 0 0 6px rgba(46,125,91,0.13)",
        }}
      >
        <CheckIcon size={28} strokeWidth={2.6} />
      </span>
      <div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 19,
            fontWeight: 700,
            color: tokens.color.successText,
          }}
        >
          Election verified — all ballots accounted for
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: tokens.color.successBody,
            lineHeight: 1.5,
          }}
        >
          An independent verifier re-derived every total from the published
          record and matched it exactly. Decryption required {trusteesSigned} of{" "}
          {trusteesTotal} trustees. No ballots were added, removed, or altered.
        </p>
      </div>
    </div>
  );
}

/** Published, but the independent audit has not been run (or did not pass). */
function UnauditedBanner({ verified }: { verified: boolean }) {
  if (verified) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: tokens.color.warnLight,
        border: `1px solid ${tokens.color.warnBorder}`,
        borderRadius: tokens.radius.card,
        padding: "18px 22px",
        marginBottom: 30,
      }}
    >
      <span
        aria-hidden
        style={{ color: tokens.color.warnText, flexShrink: 0, display: "flex" }}
      >
        <AlertIcon size={24} strokeWidth={1.8} />
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          color: tokens.color.warnText,
          lineHeight: 1.5,
        }}
      >
        These totals have been published but not independently verified yet. The
        checks below say exactly which ones have and have not run.
      </p>
    </div>
  );
}

function CryptoItem({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 13,
        alignItems: "flex-start",
        padding: tokens.space.sm,
        background: tokens.color.bg,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: tokens.color.tealLight,
          color: tokens.color.teal,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 600 }}>
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: tokens.color.text2,
            lineHeight: 1.45,
          }}
        >
          {children}
        </p>
      </div>
    </div>
  );
}

function CryptoVerification({ board }: { board: Board }) {
  const { crypto } = board;
  const tallyFingerprint = crypto.tally_sha256
    ? `sha256:${crypto.tally_sha256}`
    : "";
  const ballotsFingerprint = crypto.ballots_sha256
    ? `sha256:${crypto.ballots_sha256}`
    : "";

  return (
    <Card style={{ padding: 26 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols(320),
          gap: 14,
        }}
      >
        <CryptoItem
          icon={
            crypto.tally_proof_verified ? (
              <CheckIcon size={20} strokeWidth={2} />
            ) : (
              <AlertIcon size={20} strokeWidth={1.8} />
            )
          }
          title={
            <>
              Tally proof:{" "}
              <span
                style={{
                  color: crypto.tally_proof_verified
                    ? tokens.color.successText
                    : tokens.color.warnText,
                  fontWeight: 600,
                }}
              >
                {crypto.tally_proof_verified
                  ? "verified ✓"
                  : "not yet verified"}
              </span>
            </>
          }
        >
          The totals were recovered from the homomorphic aggregate by threshold
          decryption — no individual ballot was ever decrypted.
        </CryptoItem>
        <CryptoItem
          icon={<UsersIcon size={20} strokeWidth={1.7} />}
          title={`${crypto.trustees_submitted} of ${crypto.trustees_total} trustees participated`}
        >
          Decryption needed {crypto.threshold} of {crypto.trustees_total}, so no
          single party could read or alter the result alone.
        </CryptoItem>
        {tallyFingerprint ? (
          <Fingerprint
            label="Final tally fingerprint"
            value={tallyFingerprint}
          />
        ) : null}
        {ballotsFingerprint ? (
          <Fingerprint
            label="Ballot set fingerprint"
            value={ballotsFingerprint}
          />
        ) : null}
        {board.on_chain && crypto.tip_hash ? (
          <Fingerprint
            label={`Ledger tip at block ${crypto.chain_height ?? 0}`}
            value={crypto.tip_hash}
          />
        ) : null}
      </div>
      <p style={noteText}>
        The published tally is the election's seeded result; the ceremony gates
        when it becomes readable, and the independent verifier is what proves
        enough trustees contributed. The threshold itself is enforced by the
        console, not by the ledger.
      </p>
    </Card>
  );
}

function TallyPendingNotice({ board }: { board: Board }) {
  const { crypto } = board;
  return (
    <Card>
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>
        Tally pending
      </h3>
      <p style={{ margin: 0, color: tokens.color.text2, fontSize: 15 }}>
        The ballots are sealed. The result stays unreadable until{" "}
        {crypto.threshold} of {crypto.trustees_total} trustees have contributed
        their share — {crypto.trustees_submitted}{" "}
        {crypto.trustees_submitted === 1 ? "has" : "have"} so far.
      </p>
    </Card>
  );
}

function Notice({
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

function Footer({ board }: { board: Board }) {
  // The public records; the console refuses them while the board is sealed,
  // so a link then could only 409.
  const files = board.sealed ? [] : (board.files ?? []);
  const download = files[0];

  return (
    <footer
      style={{
        borderTop: `1px solid ${tokens.color.border}`,
        marginTop: 12,
        padding: "30px 0 46px",
      }}
    >
      <div
        className="bc-wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 560, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13.5,
              color: tokens.color.text2,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            The BalotaChain bulletin board and verifier are fully open-source.
            Anyone can download the encrypted ballot record and independently
            re-run every check on their own machine — no trust in the operator
            required.
          </p>
          <p style={{ ...noteText, marginTop: 10, overflowWrap: "anywhere" }}>
            {files.length > 0
              ? files.map((a, i) => (
                  <span key={a}>
                    {i > 0 ? " · " : ""}
                    <a
                      href={fileUrl(board.election_id, a)}
                      download
                      style={{ color: tokens.color.tealDark }}
                    >
                      {a}
                    </a>
                  </span>
                ))
              : board.sealed
                ? "The verification records can be downloaded here once the trustees publish the tally."
                : "This console has no public verification records for this election."}
          </p>
          {board.on_chain ? null : (
            <p style={{ ...noteText, marginTop: 6 }}>
              The chain trail needs the Fabric network, and the console could
              not read this election from the ledger, so there is no verifier to
              open.
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {download ? (
            <FooterLink href={fileUrl(board.election_id, download)} download>
              <DownloadIcon size={16} strokeWidth={1.8} />
              Download verification data
            </FooterLink>
          ) : null}
          {/* /trail/<id> dials Fabric, so it is offered only when the console
              has just read this election from the ledger (on_chain). */}
          {board.on_chain ? (
            <FooterLink href={verifierUrl(board.election_id)} solid>
              <CodeIcon size={16} strokeWidth={1.8} />
              Open verifier
            </FooterLink>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function StudyBoard() {
  const [runs, setRuns] = useState<RunView[]>([]);
  const [runId, setRunId] = useState<string | null>(runIdFromUrl());
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  /** Bumped by Retry so the run list and the board load run again. */
  const [attempt, setAttempt] = useState(0);
  /** The one aria-live region's text: state changes read from the console. */
  const [announce, setAnnounce] = useState("");

  // Pick a run: the URL wins, otherwise the newest talliable one. /runs is
  // already sorted newest-first by the console.
  useEffect(() => {
    const ctrl = new AbortController();
    listRuns(ctrl.signal)
      .then((all) => {
        const usable = all.filter(isTalliable);
        setRuns(usable);
        if (runId) return;
        if (usable.length === 0) {
          setLoad({ kind: "empty" });
          return;
        }
        setRunId(usable[0].run_id);
        setRunInUrl(usable[0].run_id);
      })
      .catch((e: Error) => {
        if (ctrl.signal.aborted) return;
        setLoad({ kind: "error", message: e.message });
      });
    return () => ctrl.abort();
    // Re-runs when the selection changes, which costs one cheap filesystem
    // listing and keeps the picker's own labels current. It terminates: once
    // runId is set the effect returns before touching it again.
  }, [runId, attempt]);

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      if (!runId) return;
      loadBoard(runId, signal)
        .then((board) => setLoad({ kind: "ready", board }))
        .catch((e: Error) => {
          if (signal?.aborted) return;
          setLoad({ kind: "error", message: e.message });
        });
    },
    [runId],
  );

  // Poll so a board left open flips from pending to published on its own —
  // which is the whole point of watching the ceremony from here.
  useEffect(() => {
    if (!runId) return;
    const ctrl = new AbortController();
    setLoad({ kind: "loading" });
    refresh(ctrl.signal);
    const timer = window.setInterval(() => refresh(), POLL_MS);
    return () => {
      ctrl.abort();
      window.clearInterval(timer);
    };
  }, [runId, refresh, attempt]);

  function pick(id: string) {
    setRunId(id);
    setRunInUrl(id);
  }

  function retry() {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  const board = load.kind === "ready" ? load.board : null;

  // Announce what changes while the board is open, never the first load of an
  // election (opening a published board is not news).
  const published = board ? !board.sealed : false;
  const verified = Boolean(board?.verified);
  const seen = useRef<{
    id: string;
    published: boolean;
    verified: boolean;
  } | null>(null);
  useEffect(() => {
    if (!board) return;
    const prev = seen.current;
    seen.current = { id: board.election_id, published, verified };
    if (!prev || prev.id !== board.election_id) return;
    if (published && !prev.published) setAnnounce("Tally published");
    else if (verified && !prev.verified) setAnnounce("Election verified");
  }, [board, published, verified]);

  const statusChip = board ? (
    <Chip
      variant={board.sealed ? "warning" : board.verified ? "success" : "active"}
      size="lg"
      dot
    >
      {board.sealed
        ? "Tally sealed"
        : board.verified
          ? "Verified"
          : "Tally published"}
    </Chip>
  ) : null;

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
        appName="Bulletin Board"
        role={
          <>
            <RunPicker runs={runs} runId={runId} onPick={pick} />
            {statusChip}
          </>
        }
      />
      <div aria-live="polite" role="status" className="bc-sr-only">
        {announce}
      </div>

      {load.kind === "loading" ? (
        <main className="bc-wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
          <Card>
            <Skeleton label="Loading the bulletin board…" />
          </Card>
        </main>
      ) : null}
      {load.kind === "empty" ? (
        <Notice>
          No elections have been run on this console yet. Run one from the
          console's wizard, then reload this page.
        </Notice>
      ) : null}
      {load.kind === "error" ? (
        <Notice onRetry={retry}>
          Could not reach the election console — {load.message}
        </Notice>
      ) : null}

      {board ? (
        <>
          <main className="bc-wrap">
            <div style={{ padding: "34px 0 26px" }}>
              <h1
                style={{
                  fontSize: tokens.type.h1,
                  fontWeight: 700,
                  margin: "0 0 8px",
                  overflowWrap: "anywhere",
                  letterSpacing: 0.1,
                  lineHeight: 1.25,
                }}
              >
                {board.name}
              </h1>
              <div style={{ color: tokens.color.text2, fontSize: 15 }}>
                Opened <strong>{formatStamp(board.opened_at)}</strong>
                {board.closed_at ? (
                  <>
                    {" "}
                    &nbsp;·&nbsp; Closed{" "}
                    <strong>{formatStamp(board.closed_at)}</strong>
                  </>
                ) : null}
                {board.published_at ? (
                  <>
                    {" "}
                    &nbsp;·&nbsp; Tally published{" "}
                    <span className="bc-mono" style={{ fontSize: 14 }}>
                      {formatStamp(board.published_at)}
                    </span>
                  </>
                ) : null}
              </div>
              <div
                className="bc-mono"
                style={{
                  color: tokens.color.text2,
                  fontSize: 13,
                  marginTop: 6,
                  overflowWrap: "anywhere",
                }}
              >
                {board.election_id} · {board.mode}
                {board.on_chain && board.status
                  ? ` · on-chain (${board.status})`
                  : ""}
              </div>
            </div>

            {board.partial ? (
              <p style={{ ...noteText, marginBottom: 20 }}>
                Some live data could not be read: {board.partial_reason}.
              </p>
            ) : null}

            {board.sealed ? null : board.verified ? (
              <VerifiedBanner
                trusteesSigned={board.crypto.trustees_submitted}
                trusteesTotal={board.crypto.trustees_total}
              />
            ) : (
              <UnauditedBanner verified={board.verified} />
            )}

            <Section
              title="Final Results"
              note={
                board.sealed
                  ? "sealed until the trustees decrypt"
                  : `${board.contests?.length ?? 0} positions · ${formatNumber(board.integrity.ballot_records)} ballot records`
              }
            >
              {board.sealed || !board.contests?.length ? (
                <TallyPendingNotice board={board} />
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: cols(320),
                    gap: 20,
                  }}
                >
                  {board.contests.map((r) => (
                    <RaceCard key={r.id} race={r} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Integrity Summary">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: cols(200),
                  gap: 18,
                }}
              >
                <StatCard
                  label="Total ballots cast"
                  value={formatNumber(board.integrity.ballot_records)}
                  caption={`${formatNumber(board.integrity.voters)} voters × ${board.integrity.positions} positions`}
                />
                <StatCard
                  label="Verified"
                  icon={
                    board.integrity.verified > 0 ? (
                      <span
                        style={{ color: tokens.color.success, display: "flex" }}
                      >
                        <CheckIcon size={15} strokeWidth={2.4} />
                      </span>
                    ) : undefined
                  }
                  value={formatNumber(board.integrity.verified)}
                  caption={
                    board.verified
                      ? "every ballot re-verified by the auditor"
                      : "not audited yet"
                  }
                  ok={board.verified}
                />
                <StatCard
                  label="Tampered ballots refused"
                  value={formatNumber(board.integrity.rejected)}
                  caption={board.integrity.rejected_note ?? "negative tests"}
                />
                <StatCard
                  label="Voter turnout"
                  value={`${board.integrity.turnout_pct.toFixed(1)}%`}
                  caption={`of ${formatNumber(board.integrity.voters)} generated voters`}
                />
              </div>
              <p style={noteText}>{board.integrity.turnout_note}</p>
            </Section>

            <Section
              title="Cryptographic Verification"
              note="Anyone can reproduce these checks with the open verifier"
            >
              <CryptoVerification board={board} />
            </Section>

            <Section title="Verifier Checks">
              <CheckList checks={board.checks} />
            </Section>

            {/* The mockup's verify card carries its own heading — no section head. */}
            <div style={{ marginBottom: 38 }}>
              <VerifyVoteCard
                runId={board.election_id}
                onChain={board.mode === "onchain"}
                announce={setAnnounce}
              />
            </div>
          </main>

          <Footer board={board} />
        </>
      ) : null}
    </div>
  );
}

/**
 * Which board this page is. With `?run=` the board answer decides: a `live`
 * object means the live view. Without it, the console's live route decides:
 * a live election (or live mode with nothing set up yet) is the live view,
 * which follows the console's current election; any other answer is the
 * study board, exactly as before.
 */
type Entry =
  | { kind: "probing" }
  /** No try got an answer: say so and offer to try again. */
  | { kind: "unanswered" }
  | { kind: "study" }
  | { kind: "live-run"; runId: string; board: Board }
  | { kind: "live-follow"; view: LiveElectionView | null };

/** One probe try waits this long for an answer. */
export const PROBE_LIMIT_MS = 4000;
/** Tries in all before the page says it got no answer. */
export const PROBE_TRIES = 4;
/** Waits between tries: a short backoff. */
export const PROBE_BACKOFF_MS = [500, 1000, 2000];

/**
 * Which board this page is, decided only by an answer. A definitive answer
 * decides (see `askEntry`). An answer that says nothing (a network error, a
 * 5xx, 408 or 429, no answer within `PROBE_LIMIT_MS`) is tried again, up to
 * `PROBE_TRIES` times; after that the page says so and offers to try again.
 * It never falls back to the study board on silence.
 */
async function probeEntry(signal: AbortSignal): Promise<Entry> {
  for (let i = 0; i < PROBE_TRIES; i++) {
    if (i > 0) await sleep(PROBE_BACKOFF_MS[i - 1]!, signal);
    if (signal.aborted) break;
    const entry = await tryEntry(signal);
    if (entry) return entry;
  }
  return { kind: "unanswered" };
}

/** Waits `ms`, or less if `signal` aborts; the timer never outlives it. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = window.setTimeout(done, ms);
    function done() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done);
  });
}

/** One try with a time limit; null when the console said nothing. */
function tryEntry(signal: AbortSignal): Promise<Entry | null> {
  const inner = new AbortController();
  const stop = () => inner.abort();
  signal.addEventListener("abort", stop);
  let timer: number | undefined;
  const limit = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => {
      inner.abort();
      resolve(null);
    }, PROBE_LIMIT_MS);
  });
  return Promise.race([askEntry(inner.signal), limit]).finally(() => {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  });
}

/** A failure that is an answer: an HTTP status below 500, not 408 or 429. */
function isAnswer(e: unknown): boolean {
  return e instanceof HttpError && !saysNothing(e.status);
}

async function askEntry(signal: AbortSignal): Promise<Entry | null> {
  const run = runIdFromUrl();
  if (run) {
    try {
      const board = await loadBoard(run, signal);
      return board.live
        ? { kind: "live-run", runId: run, board }
        : { kind: "study" };
    } catch (e) {
      // A 404 for the run, or any other answer: the study board loads it
      // again and shows the console's own words. A non-JSON page is an
      // answer too (a SyntaxError from the body).
      if (isAnswer(e) || e instanceof SyntaxError) return { kind: "study" };
      return null;
    }
  }
  try {
    const probe = await getLiveElection(signal);
    if (probe.kind === "live") return { kind: "live-follow", view: probe.view };
    if (probe.kind === "none") return { kind: "live-follow", view: null };
    // `live mode is off`, a non-JSON page, 401, 403: the study board.
    return { kind: "study" };
  } catch {
    // A network error, an abort at the limit, a 5xx, 408 or 429.
    return null;
  }
}

function App() {
  const [entry, setEntry] = useState<Entry>({ kind: "probing" });
  /** Bumped by "Try again" on the no-answer notice. */
  const [probe, setProbe] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setEntry({ kind: "probing" });
    probeEntry(ctrl.signal).then((e) => {
      if (!ctrl.signal.aborted) setEntry(e);
    });
    return () => ctrl.abort();
  }, [probe]);

  switch (entry.kind) {
    case "study":
      return <StudyBoard />;
    case "live-run":
      return <LiveBoard runId={entry.runId} initialBoard={entry.board} />;
    case "live-follow":
      return <LiveBoard initialView={entry.view} />;
    default:
      return (
        <div
          style={{
            minHeight: "100vh",
            background: tokens.color.bg,
            color: tokens.color.text1,
            fontFamily: tokens.type.fontFamily,
          }}
        >
          <TopBar appName="Bulletin Board" />
          <main
            className="bc-wrap"
            style={{ paddingTop: 60, paddingBottom: 60 }}
          >
            <Card>
              {entry.kind === "unanswered" ? (
                <>
                  <p
                    role="status"
                    style={{
                      margin: 0,
                      fontSize: tokens.font.body,
                      color: tokens.color.text2,
                    }}
                  >
                    The board could not reach the election console. It asked{" "}
                    {PROBE_TRIES} times and got no answer it could use.
                  </p>
                  <div style={{ marginTop: tokens.space.sm }}>
                    <SecondaryButton onClick={() => setProbe((n) => n + 1)}>
                      Try again
                    </SecondaryButton>
                  </div>
                </>
              ) : (
                <Skeleton label="Loading the bulletin board…" />
              )}
            </Card>
          </main>
        </div>
      );
  }
}

export default App;
