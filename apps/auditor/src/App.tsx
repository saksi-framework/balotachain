import {
  useCallback,
  useEffect,
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
  TextInput,
  ShieldCheckIcon,
  CheckIcon,
  AlertIcon,
  UsersIcon,
  HashIcon,
  DownloadIcon,
  CodeIcon,
} from "@balotachain/ui";
import { Chip } from "./components/Chip";
import { ResultBar } from "./components/ResultBar";
import { StatCard } from "./components/StatCard";
import {
  listRuns,
  loadBoard,
  verifyTrackingCode,
  exportUrl,
  verifierUrl,
  getCapabilities,
  type Board,
  type BoardCandidate,
  type BoardContest,
  type Capabilities,
  type RunView,
} from "./lib/bulletin";

/**
 * A tracking code is the first eight HEX characters of a ballot's nullifier, so
 * anything outside [A-F0-9] can never match a real record. Rejecting it here
 * saves a request and gives the voter the real reason.
 */
const TRACKING_CODE_RE = /^BC-[A-F0-9]{4}-[A-F0-9]{4}$/i;

/** Ballots are one per voter per position, so a run's ballot count is that product. */
const POLL_MS = 4000;

type VerifyState =
  | { kind: "idle" }
  | { kind: "found"; code: string; position: string; recordedAt?: string }
  | { kind: "missing" }
  | { kind: "ambiguous" }
  | { kind: "malformed" };

type Load =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; board: Board };

const wrap: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "0 28px",
  width: "100%",
};

const eyebrow: CSSProperties = {
  fontSize: tokens.type.eyebrow,
  fontWeight: 600,
  letterSpacing: 0.8,
  color: tokens.color.text2,
  textTransform: "uppercase",
};

const sectionHeading: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: tokens.color.text2,
  margin: 0,
};

const noteText: CSSProperties = {
  fontSize: 13,
  color: tokens.color.text2,
  lineHeight: 1.5,
  margin: "12px 0 0",
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** ISO timestamp -> a readable local date, or "" for a missing one. */
function formatStamp(iso?: string): string {
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
          gap: tokens.space.sm,
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

function CandidateRow({
  candidate,
  barMax,
  showPercent,
  first,
}: {
  candidate: BoardCandidate;
  barMax: number;
  showPercent: boolean;
  first: boolean;
}) {
  const barPct = barMax > 0 ? (candidate.votes / barMax) * 100 : 0;

  return (
    <div
      style={{
        padding: "13px 0",
        borderTop: first ? "none" : `1px solid ${tokens.color.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 9,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 9,
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          {candidate.label}
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
      <ResultBar percent={barPct} dimmed={!candidate.elected} />
    </div>
  );
}

function RaceCard({ race }: { race: BoardContest }) {
  const isMultiSeat = race.seats > 1;
  const barMax = isMultiSeat
    ? Math.max(...race.candidates.map((c) => c.votes), 1)
    : race.total_votes;
  const elected = race.candidates.filter((c) => c.elected).length;

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
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
          {race.label}
        </h3>
        <span style={{ fontSize: 12.5, color: tokens.color.text2 }}>
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

function BrandMark() {
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: 11,
        background: tokens.color.teal,
        color: tokens.color.surface,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <ShieldCheckIcon size={22} strokeWidth={1.7} />
    </span>
  );
}

function TopBar({
  runs,
  runId,
  onPick,
  status,
}: {
  runs: RunView[];
  runId: string | null;
  onPick: (id: string) => void;
  status: ReactNode;
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
          minHeight: 68,
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <BrandMark />
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.2 }}>
            BalotaChain — Bulletin Board
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {runs.length > 1 ? (
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
                maxWidth: 340,
              }}
            >
              {runs.map((r) => (
                <option key={r.run_id} value={r.run_id}>
                  {r.config.name} — {formatStamp(r.created_at)}
                </option>
              ))}
            </select>
          ) : null}
          {status}
        </span>
      </div>
    </header>
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
        style={{ color: tokens.color.warn, flexShrink: 0, display: "flex" }}
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

function Fingerprint({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: tokens.space.sm,
        background: tokens.color.bg,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        flexWrap: "wrap",
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
        <HashIcon size={20} strokeWidth={1.7} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: "0 0 5px", fontSize: 15, fontWeight: 600 }}>
          {label}
        </h3>
        <div
          className="bc-mono"
          style={{
            fontSize: 14,
            color: tokens.color.tealDark,
            wordBreak: "break-all",
          }}
        >
          {value}
        </div>
      </div>
      <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
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
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
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
                    ? tokens.color.success
                    : tokens.color.warn,
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

function CheckList({ checks }: { checks: Board["checks"] }) {
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
              color: c.pass ? tokens.color.success : tokens.color.warn,
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
              <Chip variant={c.pass ? "success" : "warn"} size="sm">
                {c.pass ? "PASS" : "NOT YET"}
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
        This list is the console's summary of the artifacts this election
        produced. It is not the independent auditor's own findings list, which
        the audit tool does not currently publish in machine-readable form.
      </p>
    </Card>
  );
}

function VerifyVoteCard({ runId }: { runId: string }) {
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
        setState({
          kind: "found",
          code: outcome.record.tracking_code,
          position: outcome.record.position_label ?? "this election",
          recordedAt: outcome.record.recorded_at,
        });
      } else {
        setState({ kind: outcome.kind });
      }
    } catch {
      setState({ kind: "missing" });
    } finally {
      setPending(false);
    }
  }

  const notice = (() => {
    switch (state.kind) {
      case "found":
        return {
          ok: true,
          text: state.recordedAt
            ? `Found — ballot ${state.code} for ${state.position} was committed on ${formatStamp(state.recordedAt)} and is included in the count.`
            : `Found — ballot ${state.code} for ${state.position} is in this election's record and included in the count. (Offline run: there is no ledger timestamp to show.)`,
        };
      case "missing":
        return {
          ok: false,
          text: "No ballot record in this election starts with that code. Check the code on your receipt, and that you are looking at the right election.",
        };
      case "ambiguous":
        return {
          ok: false,
          text: "More than one ballot record starts with that code. A code is only the first eight characters of a nullifier, so this can happen — ask for the full nullifier to resolve it.",
        };
      case "malformed":
        return {
          ok: false,
          text: "That is not a tracking code. They look like BC-XXXX-XXXX, using the digits 0-9 and the letters A-F.",
        };
      default:
        return null;
    }
  })();

  return (
    <Card
      style={{
        padding: 28,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: 32,
        alignItems: "center",
      }}
    >
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
          included in the final tally — without revealing your choice. The code
          is part of your ballot's nullifier, which is unlinkable to how you
          voted. You have one code per position.
        </p>
      </div>

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
        />
        <PrimaryButton
          type="submit"
          disabled={pending}
          style={{ minHeight: 54, width: "100%" }}
        >
          {pending ? "Verifying…" : "Verify"}
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
              style={{
                color: notice.ok ? tokens.color.success : tokens.color.warn,
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
              }}
            >
              {notice.text}
            </span>
          </div>
        ) : null}
      </form>
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

function FooterLink({
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

function Footer({ board, caps }: { board: Board; caps: Capabilities | null }) {
  // The evidence set, in the console's own display order. Linking every
  // artifact beats one dead "download" button.
  const primary = ["correctness.csv", "election.csv", "ballots.csv"].filter(
    (a) => board.artifacts.includes(a),
  );
  const download = primary[0] ?? board.artifacts[0];

  // /trail/<id> dials Fabric. For an offline run, or a console with no Fabric
  // driver configured, it can only 502 — don't offer a link that errors.
  const verifierAvailable = board.mode === "onchain" && !!caps?.fabric;

  return (
    <footer
      style={{
        borderTop: `1px solid ${tokens.color.border}`,
        marginTop: 12,
        padding: "30px 0 46px",
      }}
    >
      <div
        style={{
          ...wrap,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 560 }}>
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
          {board.artifacts.length > 0 ? (
            <p style={{ ...noteText, marginTop: 10 }}>
              {board.artifacts.map((a, i) => (
                <span key={a}>
                  {i > 0 ? " · " : ""}
                  <a
                    href={exportUrl(board.election_id, a)}
                    download
                    style={{ color: tokens.color.tealDark }}
                  >
                    {a}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          {download ? (
            <FooterLink href={exportUrl(board.election_id, download)} download>
              <DownloadIcon size={16} strokeWidth={1.8} />
              Download verification data
            </FooterLink>
          ) : null}
          {verifierAvailable ? (
            <FooterLink href={verifierUrl(board.election_id)} solid>
              <CodeIcon size={16} strokeWidth={1.8} />
              Open verifier
            </FooterLink>
          ) : (
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: `1.5px solid ${tokens.color.border}`,
                  borderRadius: tokens.radius.button,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: tokens.color.text2,
                }}
              >
                <CodeIcon size={16} strokeWidth={1.8} />
                Verifier unavailable
              </span>
              <p style={{ ...noteText, margin: "6px 0 0" }}>
                the on-chain verifier needs a Fabric network; this run was
                offline
              </p>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

function App() {
  const [runs, setRuns] = useState<RunView[]>([]);
  const [runId, setRunId] = useState<string | null>(runIdFromUrl());
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [caps, setCaps] = useState<Capabilities | null>(null);

  useEffect(() => {
    getCapabilities()
      .then(setCaps)
      .catch(() => setCaps({ fabric: false }));
  }, []);

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
  }, [runId]);

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
  }, [runId, refresh]);

  function pick(id: string) {
    setRunId(id);
    setRunInUrl(id);
  }

  const board = load.kind === "ready" ? load.board : null;
  const statusChip = board ? (
    <Chip
      variant={board.sealed ? "warn" : board.verified ? "success" : "teal"}
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
      <TopBar runs={runs} runId={runId} onPick={pick} status={statusChip} />

      {load.kind === "loading" ? (
        <Notice>Loading the bulletin board…</Notice>
      ) : null}
      {load.kind === "empty" ? (
        <Notice>
          No elections have been run on this console yet. Run one from the
          console's wizard, then reload this page.
        </Notice>
      ) : null}
      {load.kind === "error" ? (
        <Notice>Could not reach the election console — {load.message}</Notice>
      ) : null}

      {board ? (
        <>
          <main style={wrap}>
            <div style={{ padding: "34px 0 26px" }}>
              <div style={eyebrow}>Public Bulletin Board</div>
              <h1
                style={{
                  fontSize: tokens.type.h1,
                  fontWeight: 700,
                  margin: "10px 0 8px",
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
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
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
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
              <VerifyVoteCard runId={board.election_id} />
            </div>
          </main>

          <Footer board={board} caps={caps} />
        </>
      ) : null}
    </div>
  );
}

export default App;
