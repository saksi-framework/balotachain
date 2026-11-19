/**
 * The bulletin board for a live election (design review D4, D7, D8, D9, D18,
 * D19, D20, D21): one page that always says what is happening now, for the
 * projector and for a phone. The study board (App.tsx) is untouched by it.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Card,
  Chip,
  TextButton,
  TopBar,
  VerifiableValue,
  AlertIcon,
  CodeIcon,
  idToName,
  pollSignal,
} from "@balotachain/ui";
import {
  CheckList,
  FooterLink,
  RaceCard,
  VerifyVoteCard,
  formatNumber,
} from "../components/boardParts";
import {
  fileUrl,
  getLiveElection,
  loadBoard,
  verifierUrl,
  type Board,
  type LiveElectionView,
} from "../lib/bulletin";
import {
  bandFor,
  buildModel,
  nextStuckHold,
  NO_HOLD,
  type StuckHold,
  checkDisabledReason,
  checksFailed,
  countFromConsole,
  countOf,
  liveTitle,
  resultsMark,
  resultsSentence,
  showTotals,
  sayable,
  type Band,
  type LiveModel,
} from "./model";
import "./live.css";

/** D9: ask again every 2 to 3 seconds while the tab is visible. */
export const LIVE_POLL_MS = 2500;

export type LiveBoardProps =
  /** `?run=<id>`: this run, whatever the console's current election is. */
  | { runId: string; initialBoard: Board; initialView?: undefined }
  /** No `?run=`: follow the console's current election (null: none yet). */
  | {
      runId?: undefined;
      initialBoard?: undefined;
      initialView: LiveElectionView | null;
    };

export function LiveBoard(props: LiveBoardProps) {
  const fixedRun = props.runId ?? null;
  const [board, setBoard] = useState<Board | null>(props.initialBoard ?? null);
  const [view, setView] = useState<LiveElectionView | null>(
    props.initialView ?? null,
  );
  /** The last poll failed: keep what is shown and say so. */
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  /** The stuck hold at `closed` (review of rehearsal 5), per run id. */
  const [hold, setHold] = useState<StuckHold>(NO_HOLD);

  const poll = useCallback(
    async (signal: AbortSignal) => {
      // Each request gives up after POLL_TIMEOUT_MS: a hung one is a failed
      // poll (the notice below), and the next tick asks again.
      const limit = pollSignal(signal);
      const req = limit.signal;
      try {
        if (fixedRun) {
          const [b, probe] = await Promise.all([
            loadBoard(fixedRun, req),
            getLiveElection(req).catch(() => null),
          ]);
          if (signal.aborted) return;
          setBoard(b);
          // A failed view request keeps the last good view of this page
          // load, so one lost answer does not change who is "current".
          if (probe !== null)
            setView(probe.kind === "live" ? probe.view : null);
        } else {
          const probe = await getLiveElection(req);
          if (signal.aborted) return;
          if (probe.kind === "off") throw new Error("not a live console");
          if (probe.kind === "none") {
            setView(null);
            setBoard(null);
          } else {
            setView(probe.view);
            const b = await loadBoard(probe.view.run_id, req);
            if (signal.aborted) return;
            setBoard(b);
          }
        }
        setUnreachable(false);
      } catch {
        if (!signal.aborted) setUnreachable(true);
      } finally {
        limit.done();
      }
    },
    [fixedRun],
  );

  // One poll at a time; "Check now" joins the one in flight.
  const ctrl = useRef<AbortController | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const tick = useCallback(() => {
    if (!inFlight.current && ctrl.current) {
      const p: Promise<void> = poll(ctrl.current.signal).finally(() => {
        // Only this request's own slot: a stale one (StrictMode's first
        // mount) must not clear a newer request in flight.
        if (inFlight.current === p) inFlight.current = null;
      });
      inFlight.current = p;
    }
    return inFlight.current ?? Promise.resolve();
  }, [poll]);

  useEffect(() => {
    ctrl.current = new AbortController();
    let timer: number | undefined;
    const start = () => {
      if (timer !== undefined) return;
      void tick();
      timer = window.setInterval(() => void tick(), LIVE_POLL_MS);
    };
    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () =>
      document.visibilityState === "hidden" ? stop() : start();
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      ctrl.current?.abort();
      ctrl.current = null;
      inFlight.current = null;
    };
  }, [tick]);

  async function checkNow() {
    setBusy(true);
    try {
      await tick();
    } finally {
      setBusy(false);
    }
  }

  // In follow mode a board for an older run is not shown with a newer view.
  const shownBoard =
    board && (fixedRun || (view && board.election_id === view.run_id))
      ? board
      : null;
  // One step of the stuck hold per answer: `board` and `view` are new
  // objects on each poll, so this runs once per poll, not per render.
  useEffect(() => {
    const b =
      board && (fixedRun || (view && board.election_id === view.run_id))
        ? board
        : null;
    setHold((h) => nextStuckHold(h, buildModel(b, view), Date.now()));
  }, [board, view, fixedRun]);
  const built = buildModel(shownBoard, view);
  const model = {
    ...built,
    stuckHeld: hold.stuck && hold.id === built.runId,
  };
  const band = bandFor(model);

  // D13: the tab says the state.
  const title = liveTitle(band);
  useEffect(() => {
    document.title = title;
  }, [title]);

  // D9: announce a changed state or count, never an unchanged one, and never
  // the first answer (opening the board is not news).
  const spoken = `${band.heading}.${band.figure ? ` ${formatNumber(band.figure.value)} ${band.figure.words}.` : ""}`;
  const lastSpoken = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastSpoken.current;
    lastSpoken.current = spoken;
    if (prev !== null && prev !== spoken) setAnnounce(spoken);
  }, [spoken]);

  return (
    <div className="lb-root">
      <TopBar appName="" electionName={model.title || undefined} />
      <div aria-live="polite" role="status" className="bc-sr-only">
        {announce}
      </div>
      <main className="lb-page">
        <div className="lb-top">
          <StatusBand
            band={band}
            model={model}
            busy={busy}
            onCheckNow={checkNow}
          />
          {unreachable ? (
            <p className="lb-notice" role="status">
              The board could not be reached. It keeps the last answer shown and
              tries again every few seconds.
            </p>
          ) : null}
          {band.variant === "failed" && model.failedChecks.length > 0 ? (
            <FailedChecks model={model} />
          ) : null}
        </div>

        <div className="lb-check">
          <VerifyVoteCard
            key={model.runId ?? "none"}
            runId={model.runId ?? ""}
            onChain
            announce={setAnnounce}
            live
            disabledReason={checkDisabledReason(model)}
          />
        </div>

        {/* m10: the voter list sits under the results, so at desktop width
            the two columns carry about the same height. */}
        <div className="lb-main">
          <LiveSection
            className="lb-results"
            title="Results"
            note={resultsMark(model)}
          >
            <Results model={model} />
          </LiveSection>
          {model.voterList ? (
            <LiveSection className="lb-voters" title="Voter list">
              <VoterList key={model.runId ?? "none"} model={model} />
            </LiveSection>
          ) : null}
        </div>

        <div className="lb-side">
          <LiveSection className="lb-trustees" title="Trustees">
            <Trustees model={model} />
          </LiveSection>
        </div>

        <LiveSection className="lb-proofs" title="Proofs">
          <Proofs model={model} />
        </LiveSection>
      </main>
    </div>
  );
}

function LiveSection({
  className,
  title,
  note,
  children,
}: {
  className: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className={className} aria-label={title}>
      <div className="lb-section-head">
        <h2 className="lb-section-title">{title}</h2>
        {note ? <span className="lb-section-note">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function StatusBand({
  band,
  model,
  busy,
  onCheckNow,
}: {
  band: Band;
  model: LiveModel;
  busy: boolean;
  onCheckNow: () => void;
}) {
  return (
    <Card style={{ padding: 0 }}>
      <section
        className="lb-band"
        aria-labelledby="lb-band-heading"
        data-variant={band.variant}
      >
        <div className="lb-band-head">
          <h2
            id="lb-band-heading"
            className={
              band.figure ? "lb-band-heading" : "lb-band-heading lb-figure"
            }
          >
            {band.heading}
          </h2>
          <Chip variant={band.chip.variant} size="lg" dot>
            {band.chip.word}
          </Chip>
        </div>
        {band.figure ? (
          <p className="lb-figure-line">
            <span className="lb-figure">{formatNumber(band.figure.value)}</span>{" "}
            <span className="lb-figure-words">{band.figure.words}</span>
          </p>
        ) : null}
        {band.lines.map((line) => (
          <p key={line} className="lb-band-line">
            {line}
          </p>
        ))}
        {band.recordLink && model.runId ? (
          <p className="lb-band-line">
            <a className="lb-link" href={verifierUrl(model.runId)}>
              Open the record on chain
            </a>
          </p>
        ) : null}
        <div className="lb-band-foot">
          {model.jointKey ? (
            <div className="lb-band-key">
              <VerifiableValue label="Election key" value={model.jointKey} />
            </div>
          ) : null}
          <TextButton
            type="button"
            onClick={onCheckNow}
            disabled={busy}
            aria-busy={busy}
            style={{ minHeight: 44, flexShrink: 0 }}
          >
            {busy ? "Checking…" : "Check now"}
          </TextButton>
        </div>
      </section>
    </Card>
  );
}

/** D8: each failed check in words, full width, first under the band. */
function FailedChecks({ model }: { model: LiveModel }) {
  return (
    <section className="lb-failed" aria-label="Failed checks">
      <h2 className="lb-section-title lb-failed-title">Failed checks</h2>
      <ul className="lb-failed-list">
        {model.failedChecks.map((name) => (
          <li key={name}>
            <span aria-hidden className="lb-failed-icon">
              <AlertIcon size={18} strokeWidth={1.9} />
            </span>
            <span>
              The verifier's check <strong>{name}</strong> failed on the record
              on chain.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Results({ model }: { model: LiveModel }) {
  if (showTotals(model)) {
    return (
      <div className="lb-stack">
        {model.contests.map((race) => (
          <RaceCard key={race.id} race={race} nameOf={idToName} />
        ))}
      </div>
    );
  }
  return (
    <Card>
      <p className="lb-text">{resultsSentence(model)}</p>
      {model.positions.length > 0 ? (
        <ul className="lb-positions">
          {model.positions.map((p) => (
            <li key={p.id}>
              <h3 className="lb-position-name">{idToName(p.id)}</h3>
              {p.candidates.length > 0 ? (
                <p className="lb-position-candidates">
                  {p.candidates.map(idToName).join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

/**
 * The precinct's voter list as the console states it: the label, three
 * counts, the fingerprint (first 16 hex, the full value on demand with a copy
 * control) and the console's sentence on where the list is kept. No names.
 */
function VoterList({ model }: { model: LiveModel }) {
  const list = model.voterList;
  const [full, setFull] = useState(false);
  if (!list) return null;
  const counts: [string, number | null][] = [
    ["Voters on the list", list.onList],
    ["Checked in", list.checkedIn],
    ["Credentials issued", list.credentialsIssued],
  ];
  return (
    <Card>
      <div className="lb-stack">
        <p className="lb-text lb-precinct">{list.precinctLabel}</p>
        <ul className="lb-list-counts">
          {counts.map(([words, n]) =>
            n === null ? null : (
              <li key={words}>
                {words}: {formatNumber(n)}
              </li>
            ),
          )}
        </ul>
        {full ? (
          <div className="lb-fingerprint">
            <VerifiableValue
              label="List fingerprint (SHA-256)"
              value={list.fingerprint}
            />
            <div>
              <TextButton
                type="button"
                onClick={() => setFull(false)}
                style={{ minHeight: 44 }}
              >
                Show the short form
              </TextButton>
            </div>
          </div>
        ) : (
          <div className="lb-fingerprint lb-fingerprint-short">
            <span className="lb-text">List fingerprint:</span>
            <code className="bc-mono">{list.fingerprintShort}</code>
            <TextButton
              type="button"
              onClick={() => setFull(true)}
              // m6: on its own line it starts at the card's text edge.
              style={{ minHeight: 44, paddingInline: 0 }}
            >
              Show the full fingerprint
            </TextButton>
          </div>
        )}
        {list.note ? <p className="lb-text lb-muted">{list.note}</p> : null}
      </div>
    </Card>
  );
}

function Trustees({ model }: { model: LiveModel }) {
  const all = model.trustees;
  const threshold = model.threshold;
  const before =
    model.state === "none" ||
    model.state === "setup" ||
    model.state === "ceremony" ||
    model.state === "open";

  if (model.state === "abandoned") {
    return (
      <Card>
        <p className="lb-text">
          The election was abandoned before voting opened, so no trustee shares
          were recorded.
        </p>
      </Card>
    );
  }
  if (before || all === null || threshold === null) {
    const joined =
      model.state === "ceremony" &&
      model.trusteesJoined !== null &&
      all !== null
        ? `${model.trusteesJoined} of ${all} trustees joined the key ceremony. `
        : "";
    const need =
      threshold !== null && all !== null
        ? `${threshold} of ${all} trustees must each record a share to decrypt the tally.`
        : "";
    return (
      <Card>
        <p className="lb-text">
          {joined}
          Trustee shares are recorded after voting closes. {need}
        </p>
      </Card>
    );
  }

  const decrypted = new Set(model.decryption?.decrypted ?? []);
  const signed = new Set(model.decryption?.tally_signatures ?? []);
  // The console's own counts only; a missing one leaves its line out.
  const k = countOf(
    model.decryption?.trustees_decrypted,
    model.counts?.trustees_decrypted,
  );
  const sigs = countOf(
    model.decryption?.tally_signatures?.length,
    model.counts?.tally_signatures,
  );
  return (
    <Card>
      {k !== null ? (
        <p className="lb-trustee-count">
          {k} of {threshold} trustee {threshold === 1 ? "share" : "shares"}{" "}
          recorded
        </p>
      ) : null}
      {sigs !== null ? (
        <p className="lb-text lb-muted">
          {sigs} {sigs === 1 ? "tally signature" : "tally signatures"} recorded.
        </p>
      ) : null}
      <ul className="lb-trustee-list">
        {Array.from({ length: all }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <span className="lb-trustee-name">Trustee {n}</span>
            <span className="lb-trustee-chips">
              <Chip
                variant={decrypted.has(n) ? "success" : "neutral"}
                size="sm"
              >
                {decrypted.has(n) ? "Share recorded" : "No share"}
              </Chip>
              {signed.has(n) ? (
                <Chip variant="success" size="sm">
                  Signed
                </Chip>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Proofs({ model }: { model: LiveModel }) {
  const failed = checksFailed(model);
  const checks = model.checks.map((c) => ({
    ...c,
    name: sayable(c.name, model),
    detail: sayable(c.detail, model),
  }));
  return (
    <div className="lb-proofs-grid">
      {checks.length > 0 ? (
        <CheckList
          checks={checks}
          note={
            countFromConsole(model)
              ? "This list is the console's summary of the election's record. The ballot count above is the console's, not the chain's."
              : "This list is the console's summary of the election's record on chain."
          }
          failWord={(c) =>
            failed && c.detail.startsWith("failed") ? "FAILED" : "NOT YET"
          }
        />
      ) : null}
      <Card>
        <div className="lb-stack">
          {model.jointKey ? (
            <VerifiableValue label="Election key" value={model.jointKey} />
          ) : (
            <p className="lb-text lb-muted">
              The election key appears here when the key ceremony finishes.
            </p>
          )}
          {model.roster ? (
            <VerifiableValue label="Trustee roster" value={model.roster} />
          ) : null}
          <p className="lb-text lb-muted">
            Names shown are the ids recorded on chain.
          </p>
          {model.runId ? (
            <div className="lb-links">
              <FooterLink href={verifierUrl(model.runId)} solid>
                <CodeIcon size={16} strokeWidth={1.8} />
                Open the record on chain
              </FooterLink>
            </div>
          ) : null}
          {model.runId && model.files.length > 0 ? (
            <p className="lb-text lb-muted lb-files">
              Public records:{" "}
              {model.files.map((f, i) => (
                <span key={f}>
                  {i > 0 ? ", " : ""}
                  <a
                    className="lb-link"
                    href={fileUrl(model.runId!, f)}
                    download
                  >
                    {f}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
