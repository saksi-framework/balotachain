/**
 * D14: requests the chain should refuse, sent on purpose, with the chain's
 * own answer shown in place. An outcome names no gate itself; it shows the
 * console's `gate` and `reason` word for word. Before a press, the publish
 * row says what it will send and which check should refuse it
 * (http-api.md, "When the demonstration can run").
 */
import { useEffect, useRef, useState } from "react";
import { tokens, Card, ChevronIcon, SecondaryButton } from "@balotachain/ui";
import {
  LiveError,
  publishTally,
  readElection,
  readLedger,
  sendBallot,
} from "./api";
import { flipNullifierByte } from "./model";
import type { LiveElectionView } from "./types";
import { body, ErrorBox, muted, secondarySmall, small } from "./parts";

type RowId = "replay" | "flip" | "publish";

/** What one row's press came to. */
export type Outcome =
  | {
      kind: "refused";
      gate?: string;
      reason?: string;
      error: string;
      records: RecordsLine;
    }
  | { kind: "turned-away"; error: string; records: RecordsLine }
  | { kind: "accepted"; records: RecordsLine }
  | { kind: "busy"; seconds: number }
  | { kind: "not-sent"; why: string }
  /** 500 `accepted-unsigned`: the chain took the unsigned tally. */
  | { kind: "accepted-unsigned"; error: string }
  /** The console answered, but it is not the chain's refusal (409, 502 …). */
  | { kind: "console"; status: number; error: string }
  /** 401 or 403: the page goes to sign-in. */
  | { kind: "session"; error: string }
  /** No answer at all: whether the request arrived is not known. */
  | { kind: "unreached"; error: string };

/**
 * The publish row may send only when the chain's threshold check is what
 * answers (http-api.md, "When the demonstration can run"): the election is
 * closed and fewer than `threshold` signatures are held. From the close until
 * `threshold` trustees have decrypted no totals exist, and the console sends
 * a tally no trustee signed; the trustee processes sign by themselves within
 * seconds after that, so this is the moment to press it.
 */
export function publishDemoOpen(v: LiveElectionView | null): boolean {
  const sigs = v?.counts?.tally_signatures;
  return (
    v?.state === "closed" && typeof sigs === "number" && sigs < v.threshold
  );
}

/**
 * What the publish row sends, from the console's counts (http-api.md,
 * `POST /api/live/tally/publish`). Null when the row is off.
 */
export function publishDemoSends(v: LiveElectionView | null): string | null {
  if (!v || !publishDemoOpen(v)) return null;
  const sigs = v.counts!.tally_signatures;
  const shares = v.counts?.trustees_decrypted;
  const what =
    sigs > 0
      ? `Sends the totals with the ${sigs} trustee ${sigs === 1 ? "signature" : "signatures"} the console holds, fewer than the ${v.threshold} needed.`
      : typeof shares === "number" && shares >= v.threshold
        ? "Sends the totals the trustees' shares combine to, with no trustee signature."
        : "Sends a tally that no trustee signed, with zero for every contest: no totals exist before the trustees decrypt.";
  return `${what} The chain's threshold check should refuse it: nobody, the console included, can publish a result without the trustees.`;
}

/** Ballot records before and after, from fresh reads of the view. */
export type RecordsLine = {
  before?: number;
  after?: number;
  fromChain: boolean;
};

const records = (v: LiveElectionView | null) =>
  typeof v?.counts?.ballot_records === "number"
    ? v.counts.ballot_records
    : undefined;

async function fresh(): Promise<LiveElectionView | null> {
  try {
    return await readElection();
  } catch {
    return null;
  }
}

/**
 * A press's answer that is about this page's session: a 401, or the
 * console's own 403 "admin role required". Any other 403 (the console's
 * host guard, a proxy) is the console's answer, not a sign-in matter.
 */
function aboutSession(e: LiveError): boolean {
  return (
    e.status === 401 ||
    (e.status === 403 && e.message === "admin role required")
  );
}

function RecordsText({ line }: { line: RecordsLine }) {
  if (line.after === undefined)
    return <p style={muted}>The page could not read the ballot count again.</p>;
  const where = line.fromChain
    ? "Ballot records on chain"
    : "Ballot records in the console's record (the chain did not answer)";
  if (line.before === undefined || line.before === line.after)
    return (
      <p style={body}>
        {where}: {line.after}
        {line.before === undefined ? "" : " (unchanged)"}
      </p>
    );
  return (
    <ErrorBox live={false}>
      {where}: {line.after} (changed from {line.before})
    </ErrorBox>
  );
}

function OutcomeView({ outcome }: { outcome: Outcome }) {
  switch (outcome.kind) {
    case "refused":
      return (
        <div style={{ display: "grid", gap: 6 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ ...body, fontWeight: 600 }}>
              Refused by the chain
            </span>
            {outcome.gate ? (
              <span style={body}>
                Gate:{" "}
                <span className="bc-mono" style={{ fontWeight: 600 }}>
                  {outcome.gate}
                </span>
              </span>
            ) : null}
          </div>
          <p
            className="bc-mono"
            style={{
              ...small,
              color: tokens.color.text1,
              fontSize: tokens.font.mono,
              overflowWrap: "anywhere",
            }}
          >
            {outcome.reason ?? outcome.error}
          </p>
          <RecordsText line={outcome.records} />
        </div>
      );
    case "turned-away":
      return (
        <div style={{ display: "grid", gap: 6 }}>
          <p style={body}>
            The console turned this away before it reached the chain:{" "}
            {outcome.error}
          </p>
          <RecordsText line={outcome.records} />
        </div>
      );
    case "accepted":
      return (
        <div style={{ display: "grid", gap: 6 }}>
          <ErrorBox live={false}>
            The chain accepted this. Stop the demo.
          </ErrorBox>
          <RecordsText line={outcome.records} />
        </div>
      );
    case "busy":
      return <p style={body}>The console is busy, try again.</p>;
    case "not-sent":
      return <p style={body}>{outcome.why}</p>;
    case "accepted-unsigned":
      return (
        <ErrorBox live={false}>
          The chain accepted a tally that no trustee signed. Stop the demo. The
          console did not record it as the result: {outcome.error}
        </ErrorBox>
      );
    case "console":
      return (
        <p style={body}>
          Not a refusal by the chain. The console answered {outcome.status}:{" "}
          {outcome.error}
        </p>
      );
    case "session":
      return (
        <p style={body}>
          The console did not accept this page&apos;s session: {outcome.error}.
          Sign in again.
        </p>
      );
    case "unreached":
      return (
        <p style={body}>
          The page could not reach the console ({outcome.error}). Whether the
          request arrived is not known.
        </p>
      );
  }
}

/** Classifies a press's answer. */
function outcomeOf(e: unknown, line: RecordsLine): Outcome {
  if (e instanceof LiveError) {
    if (e.status === 422)
      return {
        kind: "refused",
        gate: e.gate,
        reason: e.reason,
        error: e.message,
        records: line,
      };
    if (e.status === 400)
      return { kind: "turned-away", error: e.message, records: line };
    if (e.status === 429) return { kind: "busy", seconds: e.retryAfter ?? 1 };
    if (aboutSession(e)) return { kind: "session", error: e.message };
    if (e.code === "accepted-unsigned")
      return { kind: "accepted-unsigned", error: e.message };
    return { kind: "console", status: e.status, error: e.message };
  }
  return {
    kind: "unreached",
    error: e instanceof Error ? e.message : String(e),
  };
}

export function Demonstrations({
  view,
  epoch,
  onFresh,
  onAuthFail,
}: {
  view: LiveElectionView;
  /** The page's write epoch now, read when a fresh read is sent. */
  epoch: () => number;
  /**
   * Hands a fresh view to the page with the epoch at its send; the page
   * drops it when a write began or ended meanwhile.
   */
  onFresh: (v: LiveElectionView, sentAt: number) => void;
  /** The page's own handling of a 401 or 403 (sign-in). */
  onAuthFail: (e: unknown) => void;
}) {
  const [busy, setBusy] = useState<RowId | null>(null);
  const [outcomes, setOutcomes] = useState<Partial<Record<RowId, Outcome>>>({});
  /** Until when a row waits after a 429 (Retry-After). */
  const [wait, setWait] = useState<Partial<Record<RowId, boolean>>>({});
  const timers = useRef<number[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const list = timers.current;
    return () => {
      mounted.current = false;
      list.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const counts = view.counts;
  const recorded = records(view) ?? 0;
  const ballotsOn = view.state === "open" && recorded > 0;
  const sigs = counts?.tally_signatures;
  const publishOn = publishDemoOpen(view);

  async function run(row: RowId) {
    /** The count the publish button named when it was pressed. */
    const shownSigs = sigs;
    /** The sentence the row showed when pressed: what it said it sends. */
    const shownSends = publishDemoSends(view);
    setBusy(row);
    setOutcomes((o) => ({ ...o, [row]: undefined }));
    let outcome: Outcome;
    const beforeAt = epoch();
    const before = await fresh();
    if (before) onFresh(before, beforeAt);
    try {
      if (row === "publish") {
        // Never publish a real result: send only if the fresh read still
        // shows a closed election below the threshold.
        const s = before?.counts?.tally_signatures;
        if (!publishDemoOpen(before)) {
          outcome = {
            kind: "not-sent",
            why: !before
              ? "Not sent: the page could not read the election first."
              : before.state === "closed" &&
                  typeof s === "number" &&
                  s >= before.threshold
                ? `Not sent: the console now holds ${s} of ${before.threshold} signatures, so this could publish the real result.`
                : `Not sent: the election is ${before.state} with ${s ?? "an unknown number of"} signatures, so the chain's threshold check would not be what answers.`,
          };
        } else if (s !== shownSigs) {
          // Said before sending: the button named another count.
          outcome = {
            kind: "not-sent",
            why: `Not sent: the console now holds ${s} of ${before!.threshold} signatures, not the ${shownSigs} the button named. The button now names what it sends; press it again to send it.`,
          };
        } else if (publishDemoSends(before) !== shownSends) {
          // Same count, but what would be sent is no longer what the row
          // said (the shares reached the threshold meanwhile).
          outcome = {
            kind: "not-sent",
            why: "Not sent: what this would send changed since the row was read. The row now says what it sends; press it again to send it.",
          };
        } else {
          await publishTally();
          outcome = {
            kind: "accepted",
            records: { before: records(before), fromChain: false },
          };
        }
      } else {
        let ledger: Awaited<ReturnType<typeof readLedger>> | null = null;
        let ledgerError = "";
        try {
          ledger = await readLedger();
        } catch (e) {
          ledgerError = e instanceof Error ? e.message : String(e);
        }
        const first = (ledger?.ballots ?? [])[0];
        if (!ledger) {
          outcome = {
            kind: "not-sent",
            why: `Not sent: the page could not read the ballot records from the chain (${ledgerError}). Nothing was sent.`,
          };
        } else if (!first) {
          outcome = {
            kind: "not-sent",
            why: "Not sent: the chain holds no ballot record yet.",
          };
        } else if (row === "replay") {
          await sendBallot(first.ballot);
          outcome = {
            kind: "accepted",
            records: { before: records(before), fromChain: false },
          };
        } else {
          const flipped = flipNullifierByte(first.ballot);
          if (!flipped) {
            outcome = {
              kind: "not-sent",
              why: "Not sent: the page could not find the nullifier in the recorded ballot.",
            };
          } else {
            await sendBallot(flipped.hex);
            outcome = {
              kind: "accepted",
              records: { before: records(before), fromChain: false },
            };
          }
        }
      }
    } catch (e) {
      outcome = outcomeOf(e, { before: records(before), fromChain: false });
      if (outcome.kind === "session") onAuthFail(e);
    }
    // The count after, from a fresh read.
    if ("records" in outcome) {
      const afterAt = epoch();
      const after = await fresh();
      if (after) onFresh(after, afterAt);
      outcome = {
        ...outcome,
        records: {
          before: outcome.records.before,
          after: records(after),
          fromChain: after?.counts?.ballot_records_source === "chain",
        },
      };
    }
    if (outcome.kind === "busy") {
      setWait((w) => ({ ...w, [row]: true }));
      timers.current.push(
        window.setTimeout(() => {
          if (mounted.current) setWait((w) => ({ ...w, [row]: false }));
        }, outcome.seconds * 1000),
      );
    }
    if (!mounted.current) return;
    setOutcomes((o) => ({ ...o, [row]: outcome }));
    setBusy(null);
  }

  const rows: {
    id: RowId;
    label: string;
    enabled: boolean;
    why: string;
    /** What a press sends and what should refuse it, while it is on. */
    sends?: string | null;
  }[] = [
    {
      id: "replay",
      label: "Send a recorded ballot again",
      enabled: ballotsOn,
      why: "Opens while voting is open and at least one ballot is recorded.",
    },
    {
      id: "flip",
      label: "Send a ballot with one byte changed",
      enabled: ballotsOn,
      why: "Opens while voting is open and at least one ballot is recorded.",
    },
    {
      id: "publish",
      label:
        typeof sigs === "number"
          ? `Publish with ${sigs} of ${view.threshold} signatures`
          : "Publish with too few signatures",
      enabled: publishOn,
      why: `Opens in the Decrypt step, from the close until ${view.threshold} signatures are held. Press it before ${view.threshold} trustees decrypt: their processes then sign within seconds and the console publishes.`,
      sends: publishDemoSends(view),
    },
  ];

  return (
    <Card>
      <details className="lp-demos">
        <summary>
          <ChevronIcon
            size={20}
            className="lp-chevron"
            aria-hidden
            style={{ flexShrink: 0, marginRight: tokens.space.xs }}
          />
          Demonstrations: requests the chain should refuse
        </summary>
        <div
          style={{
            display: "grid",
            gap: tokens.space.sm,
            marginTop: tokens.space.xs,
          }}
        >
          <p style={muted}>Each button sends a deliberately bad request.</p>
          {rows.map((r) => {
            const outcome = outcomes[r.id];
            const isBusy = busy === r.id;
            return (
              <section key={r.id} aria-label={r.label} className="lp-row">
                <div>
                  <SecondaryButton
                    onClick={() => void run(r.id)}
                    disabled={
                      !r.enabled || busy !== null || wait[r.id] === true
                    }
                    aria-busy={isBusy || undefined}
                    style={{ ...secondarySmall, fontSize: tokens.font.body }}
                  >
                    {isBusy ? "Sending…" : r.label}
                  </SecondaryButton>
                </div>
                {!r.enabled ? <p style={small}>{r.why}</p> : null}
                {r.enabled && r.sends ? <p style={small}>{r.sends}</p> : null}
                <div aria-live="polite">
                  {outcome ? <OutcomeView outcome={outcome} /> : null}
                </div>
              </section>
            );
          })}
        </div>
      </details>
    </Card>
  );
}
