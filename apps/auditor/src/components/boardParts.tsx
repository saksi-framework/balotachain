/**
 * Pieces shared by the study board (App.tsx) and the live board
 * (live/LiveBoard.tsx): result rows, the check list, fingerprints and the
 * tracking-code check. Moved here unchanged from App.tsx; the live view's
 * options are opt-in props, so the study view draws as before.
 */
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  tokens,
  Card,
  Chip,
  PrimaryButton,
  TextInput,
  VerifiableValue,
  CheckIcon,
  AlertIcon,
  idToName,
} from "@balotachain/ui";
import { ResultBar } from "./ResultBar";
import {
  verifyTrackingCode,
  type Board,
  type BallotRecord,
  type BoardCandidate,
  type BoardContest,
} from "../lib/bulletin";

/**
 * A tracking code is the first eight HEX characters of a ballot's nullifier, so
 * anything outside [A-F0-9] can never match a real record. Rejecting it here
 * saves a request and gives the voter the real reason.
 */
export const TRACKING_CODE_RE = /^BC-[A-F0-9]{4}-[A-F0-9]{4}$/i;
export type VerifyState =
  | { kind: "idle" }
  | { kind: "found"; record: BallotRecord }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "malformed" }
  /** Live board only: the console did not answer the check. */
  | { kind: "error" };

/** Grid columns that drop to one below their minimum, so no page scroll. */
export const cols = (min: number) =>
  `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`;

export const noteText: CSSProperties = {
  fontSize: 13,
  color: tokens.color.text2,
  lineHeight: 1.5,
  margin: "12px 0 0",
};

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** ISO timestamp -> a readable local date, or "" for a missing one. */
export function formatStamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CandidateRow({
  candidate,
  barMax,
  showPercent,
  first,
  lead,
  name,
}: {
  candidate: BoardCandidate;
  barMax: number;
  showPercent: boolean;
  first: boolean;
  /** Leading candidates get the primary bar; the rest get `neutral-bar`. */
  lead: boolean;
  /**
   * The text shown for the candidate (the live board passes the id through
   * `idToName`). Given, the name wraps and the count stays on its first line
   * (D20); absent, the row draws as the study board always has.
   */
  name?: string;
}) {
  const barPct = barMax > 0 ? (candidate.votes / barMax) * 100 : 0;

  return (
    <div
      style={{
        // The board's compact table row (DESIGN.md: 8px vertical padding).
        padding: "8px 0",
        borderTop: first ? "none" : `1px solid ${tokens.color.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: name === undefined ? "center" : "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: name === undefined ? 15 : tokens.font.body,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 9,
            minWidth: 0,
            flexWrap: "wrap",
            overflowWrap: name === undefined ? undefined : "anywhere",
          }}
        >
          {name ?? candidate.label}
          {candidate.elected ? (
            <Chip variant="success" size="sm">
              ELECTED
            </Chip>
          ) : null}
        </div>
        <div
          style={{
            fontSize: 14,
            color: tokens.color.text1,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {formatNumber(candidate.votes)}
          <span
            style={{
              color: tokens.color.text2,
              fontWeight: 400,
              marginLeft: 6,
              fontSize: 13,
            }}
          >
            {showPercent
              ? `${candidate.share.toFixed(1)}%`
              : `#${candidate.rank}`}
          </span>
        </div>
      </div>
      <ResultBar percent={barPct} dimmed={!lead} />
    </div>
  );
}

export function RaceCard({
  race,
  nameOf,
}: {
  race: BoardContest;
  /**
   * The live board shows each id through `idToName` (D19) and lets names
   * wrap (D20). Absent, the study board's labels draw as before.
   */
  nameOf?: (id: string) => string;
}) {
  const isMultiSeat = race.seats > 1;
  const barMax = isMultiSeat
    ? Math.max(...race.candidates.map((c) => c.votes), 1)
    : race.total_votes;
  const elected = race.candidates.filter((c) => c.elected).length;
  // Elected candidates lead; with nobody elected (an undecided cut) the
  // candidates level at the top do.
  const leads = (c: BoardCandidate) => (elected > 0 ? c.elected : c.rank === 1);

  return (
    <Card style={{ padding: "22px 22px 8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <h3
          style={{
            fontSize: nameOf ? tokens.font.h3 : 17,
            fontWeight: 700,
            margin: 0,
            minWidth: nameOf ? 0 : undefined,
            overflowWrap: nameOf ? "anywhere" : undefined,
          }}
        >
          {nameOf ? nameOf(race.id) : race.label}
        </h3>
        <span
          style={{
            fontSize: nameOf ? tokens.font.small : 12.5,
            color: tokens.color.text2,
            whiteSpace: nameOf ? "nowrap" : undefined,
          }}
        >
          {race.seats === 1 ? "1 seat" : `${race.seats} seats`}
        </span>
      </div>
      <p
        style={{
          fontSize: tokens.type.small,
          color: tokens.color.text2,
          margin: "0 0 16px",
        }}
      >
        {formatNumber(race.total_votes)} votes counted
        {isMultiSeat && !race.contested
          ? ` · ${elected} of ${race.candidates.length} elected`
          : ""}
        {race.contested ? " · the cut is not decided" : ""}
      </p>
      {race.candidates.map((c, i) => (
        <CandidateRow
          key={c.id}
          candidate={c}
          barMax={barMax}
          showPercent={!isMultiSeat}
          first={i === 0}
          lead={leads(c)}
          name={nameOf ? nameOf(c.id) : undefined}
        />
      ))}
      {race.contested ? (
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.text2,
            padding: "12px 0 4px",
            borderTop: `1px solid ${tokens.color.border}`,
          }}
        >
          More candidates are level at the last elected place than there are
          seats left, so this race awards nothing. The result is reported as it
          stands rather than resolved.
        </div>
      ) : null}
    </Card>
  );
}

/** A hash across the whole crypto grid: the full value, wrapping, with Copy. */
export function Fingerprint({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
      <VerifiableValue label={label} value={value} />
    </div>
  );
}

export function CheckList({
  checks,
  note,
  failWord,
}: {
  checks: Board["checks"];
  /** The live board's own note under the list; absent, the study note. */
  note?: string;
  /** The chip word for a check that did not pass; absent, "NOT YET". */
  failWord?: (check: Board["checks"][number]) => string;
}) {
  return (
    <Card style={{ padding: "8px 22px" }}>
      {checks.map((c, i) => (
        <div
          key={c.name}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: "14px 0",
            borderTop: i === 0 ? "none" : `1px solid ${tokens.color.border}`,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              flexShrink: 0,
              marginTop: 1,
              color: c.pass ? tokens.color.success : tokens.color.warnText,
            }}
          >
            {c.pass ? (
              <CheckIcon size={19} strokeWidth={2.4} />
            ) : (
              <AlertIcon size={19} strokeWidth={1.9} />
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {c.name}{" "}
              <Chip
                variant={
                  c.pass
                    ? "success"
                    : failWord?.(c) === "FAILED"
                      ? "error"
                      : "warning"
                }
                size="sm"
              >
                {c.pass ? "PASS" : failWord ? failWord(c) : "NOT YET"}
              </Chip>
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: tokens.color.text2,
                marginTop: 3,
                wordBreak: "break-word",
              }}
            >
              {c.detail}
            </div>
          </div>
        </div>
      ))}
      <p style={{ ...noteText, paddingBottom: 14 }}>
        {note ??
          "This list is the console's summary of the artifacts this election produced. It is not the independent auditor's own findings list, which the audit tool does not currently publish in machine-readable form."}
      </p>
    </Card>
  );
}

export function VerifyVoteCard({
  runId,
  onChain,
  announce,
  live = false,
  disabledReason,
}: {
  runId: string;
  /** The election was run in on-chain mode, so it is never called offline. */
  onChain: boolean;
  /** The app's one aria-live region: the outcome is read out when it lands. */
  announce: (text: string) => void;
  /**
   * The live board's wording: "Check your ballot", no claim of a counted
   * ballot before the tally, position names through `idToName`.
   */
  live?: boolean;
  /** Set, the check is disabled and this sentence says why (live board). */
  disabledReason?: string;
}) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length === 0) return;
    if (!TRACKING_CODE_RE.test(trimmed)) {
      setState({ kind: "malformed" });
      return;
    }
    setPending(true);
    try {
      const outcome = await verifyTrackingCode(runId, trimmed);
      if (outcome.kind === "found") {
        setState({ kind: "found", record: outcome.record });
      } else {
        setState({ kind: outcome.kind });
      }
    } catch {
      setState(live ? { kind: "error" } : { kind: "missing" });
    } finally {
      setPending(false);
    }
  }

  const notice = live
    ? liveNotice(state)
    : (() => {
        switch (state.kind) {
          case "found": {
            const {
              tracking_code: code,
              recorded_at: at,
              block_number: block,
              committed_on_chain: committed,
            } = state.record;
            const position = state.record.position_label ?? "this election";
            const where = block ? ` in block ${block}` : "";
            let text: string;
            if (committed && at) {
              text = `Found — ballot ${code} for ${position} was committed on-chain${where} on ${formatStamp(at)} and is included in the count.`;
            } else if (committed) {
              text = `Found — ballot ${code} for ${position} is committed on-chain${where} and included in the count. No per-ballot ledger timestamp was recorded for it.`;
            } else if (onChain) {
              // Never call an on-chain election offline: the ballot is in the
              // record, the ledger just could not confirm this one record.
              text = `Found — ballot ${code} for ${position} is in this election's record and included in the count. This election is recorded on-chain, but no commit receipt for this ballot could be read.`;
            } else {
              text = `Found — ballot ${code} for ${position} is in this election's record and included in the count. (Offline run: there is no ledger timestamp to show.)`;
            }
            return { ok: true, said: "Ballot found", text };
          }
          case "missing":
            return {
              ok: false,
              said: "No ballot found",
              text: "No ballot record in this election starts with that code. Check the code on your receipt, and that you are looking at the right election.",
            };
          case "ambiguous":
            return {
              ok: false,
              said: "More than one ballot matches",
              text: "More than one ballot record starts with that code. A code is only the first eight characters of a nullifier, so this can happen — ask for the full nullifier to resolve it.",
            };
          case "malformed":
            return {
              ok: false,
              said: "Not a tracking code",
              text: "That is not a tracking code. They look like BC-XXXX-XXXX, using the digits 0-9 and the letters A-F.",
            };
          default:
            return null;
        }
      })();

  // A short word, not the notice itself, so the text is not on the page twice.
  const said = notice?.said ?? "";
  useEffect(() => {
    if (said) announce(said);
  }, [said, announce]);

  return (
    <Card
      style={
        live
          ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }
          : {
              padding: 28,
              display: "grid",
              gridTemplateColumns: cols(340),
              gap: 32,
              alignItems: "center",
            }
      }
    >
      {live ? (
        <div>
          <h2
            style={{
              fontSize: tokens.font.h3,
              fontWeight: 700,
              color: tokens.color.text1,
              margin: "0 0 8px",
            }}
          >
            Check your ballot
          </h2>
          <p
            style={{
              fontSize: tokens.font.body,
              color: tokens.color.text2,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {disabledReason ??
              "Type the tracking code your phone showed to find your ballot record. The code does not show how you voted. You have one code per position."}
          </p>
        </div>
      ) : (
        <div>
          <h2
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: tokens.color.text1,
              margin: "0 0 8px",
            }}
          >
            Verify your vote
          </h2>
          <p
            style={{
              fontSize: 15,
              color: tokens.color.text2,
              margin: 0,
              maxWidth: 440,
              lineHeight: 1.55,
            }}
          >
            Paste the tracking code from your receipt to confirm your ballot was
            included in the final tally — without revealing your choice. The
            code is part of your ballot's nullifier, which is unlinkable to how
            you voted. You have one code per position.
          </p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <TextInput
          variant="mono"
          placeholder="e.g. BC-7F3A-92C1"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          aria-label="Tracking code"
          disabled={disabledReason !== undefined}
        />
        <PrimaryButton
          type="submit"
          disabled={pending || disabledReason !== undefined}
          style={{ minHeight: 54, width: "100%" }}
        >
          {live
            ? pending
              ? "Checking…"
              : "Check"
            : pending
              ? "Verifying…"
              : "Verify"}
        </PrimaryButton>

        {notice ? (
          <div
            style={{
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "13px 16px",
              borderRadius: tokens.radius.button,
              background: notice.ok
                ? tokens.color.successLight
                : tokens.color.warnLight,
              border: `1px solid ${
                notice.ok ? tokens.color.successBorder : tokens.color.warnBorder
              }`,
            }}
          >
            <span
              aria-hidden
              style={{
                color: notice.ok ? tokens.color.success : tokens.color.warnText,
                flexShrink: 0,
              }}
            >
              {notice.ok ? (
                <CheckIcon size={20} strokeWidth={2.4} />
              ) : (
                <AlertIcon size={20} strokeWidth={1.7} />
              )}
            </span>
            <span
              style={{
                fontSize: 14,
                color: notice.ok
                  ? tokens.color.successText
                  : tokens.color.warnText,
                fontWeight: 600,
                lineHeight: 1.4,
                overflowWrap: "anywhere",
              }}
            >
              {notice.text}
            </span>
          </div>
        ) : null}
        {state.kind === "found" ? (
          <>
            <VerifiableValue
              label="Tracking code"
              value={state.record.tracking_code}
            />
            {state.record.nullifier ? (
              <VerifiableValue
                label="Nullifier"
                value={state.record.nullifier}
                truncate
              />
            ) : null}
            {live && state.record.ballot_fingerprint ? (
              <VerifiableValue
                label="Ballot fingerprint"
                value={state.record.ballot_fingerprint}
              />
            ) : null}
            {state.record.ballot_sha256 ? (
              <VerifiableValue
                label="Ballot SHA-256"
                value={state.record.ballot_sha256}
                truncate
              />
            ) : null}
          </>
        ) : null}
      </form>
    </Card>
  );
}

type VerifyNotice = { ok: boolean; said: string; text: string };

/** The live board's words for a check's outcome: no em dash, no claim of a
 * counted ballot (the tally may not exist yet), the position through
 * `idToName`. */
function liveNotice(state: VerifyState): VerifyNotice | null {
  switch (state.kind) {
    case "found": {
      const r = state.record;
      const position = r.position_id
        ? idToName(r.position_id)
        : "this election";
      const where = r.block_number ? ` in block ${r.block_number}` : "";
      const at = formatStamp(r.recorded_at);
      let text: string;
      if (r.committed_on_chain && at) {
        text = `Found. Ballot ${r.tracking_code} for ${position} was recorded on chain${where} on ${at}.`;
      } else if (r.committed_on_chain) {
        text = `Found. Ballot ${r.tracking_code} for ${position} is recorded on chain${where}.`;
      } else {
        text = `Found. Ballot ${r.tracking_code} for ${position} is in this election's record. No commit receipt for it could be read from the chain.`;
      }
      return { ok: true, said: "Ballot found", text };
    }
    case "missing":
      return {
        ok: false,
        said: "No ballot found",
        text: "No ballot record in this election starts with that code. Check the code your phone showed, and that this is the right election.",
      };
    case "ambiguous":
      return {
        ok: false,
        said: "More than one ballot matches",
        text: "More than one ballot record starts with that code. A code is only the first eight characters of a nullifier, so this can happen. Ask for the full nullifier.",
      };
    case "malformed":
      return {
        ok: false,
        said: "Not a tracking code",
        text: "That is not a tracking code. They look like BC-XXXX-XXXX, using the digits 0 to 9 and the letters A to F.",
      };
    case "error":
      return {
        ok: false,
        said: "Could not check",
        text: "The board could not reach the console to check this code. Try again.",
      };
    default:
      return null;
  }
}

export function FooterLink({
  children,
  href,
  solid = false,
  download = false,
}: {
  children: ReactNode;
  href: string;
  solid?: boolean;
  download?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      download={download || undefined}
      target={download ? undefined : "_blank"}
      rel="noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
        border: `1.5px solid ${
          solid
            ? hover
              ? tokens.color.tealDark
              : tokens.color.teal
            : hover
              ? tokens.color.teal
              : tokens.color.border
        }`,
        borderRadius: tokens.radius.button,
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 600,
        color: solid
          ? tokens.color.surface
          : hover
            ? tokens.color.tealDark
            : tokens.color.text1,
        background: solid
          ? hover
            ? tokens.color.tealDark
            : tokens.color.teal
          : tokens.color.surface,
        transition: "border-color 150ms, background 150ms, color 150ms",
      }}
    >
      {children}
    </a>
  );
}
