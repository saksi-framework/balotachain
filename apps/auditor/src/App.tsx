import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  tokens,
  PrimaryButton,
  TextButton,
  TextInput,
  ShieldCheckIcon,
  ClockIcon,
  CheckIcon,
  CopyIcon,
  AlertIcon,
} from "@balotachain/ui";
import { Card } from "./components/Card";
import { Chip } from "./components/Chip";
import { ResultBar } from "./components/ResultBar";
import { StatCard } from "./components/StatCard";
import {
  RACES,
  TALLY_SHA256,
  BALLOTS_CAST,
  TRUSTEES_SIGNED,
  TRUSTEES_TOTAL,
  POLLS_CLOSED_AT,
  SAMPLE_VOTE_RECORDED_AT,
  ENCRYPTION_SCHEME,
  type Race,
  type Candidate,
} from "./mocks/results";
import {
  loadBulletin,
  verifyTrackingCode,
  type Bulletin,
  type Tally,
} from "./lib/bulletin";

const TRACKING_CODE_RE = /^BC-[A-F0-9]{4}-[A-F0-9]{4}$/i;

type VerifyState =
  | { kind: "idle" }
  | { kind: "success"; code: string; submittedAt: string }
  | { kind: "error" };

type TallyMode =
  | { kind: "mock" }
  | { kind: "pending" }
  | { kind: "real"; tally: Tally; ballotsCount: number };

const pageWrap: CSSProperties = {
  minHeight: "100vh",
  background: tokens.color.bg,
  color: tokens.color.text1,
  fontFamily: tokens.type.fontFamily,
  fontSize: tokens.type.body,
  lineHeight: tokens.type.lineHeight,
};

const container: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: `${tokens.space.md}px`,
  display: "flex",
  flexDirection: "column",
  gap: tokens.space.lg,
};

const sectionTitle: CSSProperties = {
  fontSize: tokens.type.h2,
  fontWeight: 700,
  color: tokens.color.text1,
  margin: 0,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  color: tokens.color.text2,
  fontWeight: 500,
  letterSpacing: 0.2,
};

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function percentOf(votes: number, total: number): number {
  if (total <= 0) return 0;
  return (votes / total) * 100;
}

/**
 * Map a real bulletin tally into the same Race[] shape the UI components
 * already render against. The mock has handcrafted titles
 * ("Senators — top 12 elected" with a subtitle), so when we render real data
 * we fall back to the position id capitalised and emit a single-line subtitle.
 */
function tallyToRaces(tally: Tally, ballotsCount: number): Race[] {
  const races: Race[] = [];
  const ids = Object.keys(tally.results).sort();
  for (const id of ids) {
    const r = tally.results[id];
    const candidates: Candidate[] = r.candidates.map((c) => ({
      name: c.name,
      party: c.party,
      votes: c.votes,
      elected: c.elected,
    }));
    races.push({
      title: titleCase(id),
      subtitle: `${formatNumber(ballotsCount)} ballots tallied`,
      pickLimit: 1,
      ballotsTotal: ballotsCount,
      candidates,
    });
  }
  return races;
}

function titleCase(id: string): string {
  if (id.length === 0) return id;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function CandidateRow({
  candidate,
  denominator,
  barMax,
  showPercent,
  dim,
}: {
  candidate: Candidate;
  denominator: number;
  barMax: number;
  showPercent: boolean;
  dim: boolean;
}) {
  const pct = percentOf(candidate.votes, denominator);
  const barPct = barMax > 0 ? (candidate.votes / barMax) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.space.xs,
        opacity: dim ? 0.55 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: tokens.space.md,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: tokens.space.xs,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: tokens.color.text1, fontWeight: 600 }}>
              {candidate.name}
            </span>
            {candidate.elected ? <Chip variant="success">ELECTED</Chip> : null}
          </div>
          <span style={{ fontSize: 13, color: tokens.color.text2 }}>
            {candidate.party}
          </span>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <div style={{ color: tokens.color.text1, fontWeight: 600 }}>
            {formatNumber(candidate.votes)}
          </div>
          {showPercent ? (
            <div style={{ fontSize: 13, color: tokens.color.text2 }}>
              {pct.toFixed(1)}%
            </div>
          ) : null}
        </div>
      </div>
      <ResultBar percent={barPct} dimmed={dim} />
    </div>
  );
}

function RaceCard({ race }: { race: Race }) {
  const isMultiSeat = race.pickLimit > 1;
  const barMax = isMultiSeat
    ? Math.max(...race.candidates.map((c) => c.votes))
    : race.ballotsTotal;

  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.space.md,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ ...sectionTitle, fontSize: tokens.type.h2 }}>
            {race.title}
          </h3>
          {race.subtitle ? (
            <span style={{ fontSize: 14, color: tokens.color.text2 }}>
              {race.subtitle}
            </span>
          ) : (
            <span style={{ fontSize: 13, color: tokens.color.text2 }}>
              {formatNumber(race.ballotsTotal)} ballots cast — pick{" "}
              {race.pickLimit}
            </span>
          )}
        </header>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.sm,
          }}
        >
          {race.candidates.map((c) => (
            <CandidateRow
              key={c.name}
              candidate={c}
              denominator={race.ballotsTotal}
              barMax={barMax}
              showPercent={!isMultiSeat}
              dim={isMultiSeat && c.elected !== true}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function Header() {
  return (
    <header
      style={{
        height: 56,
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `0 ${tokens.space.md}px`,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space.md,
        }}
      >
        <span
          style={{
            fontSize: tokens.type.h2,
            fontWeight: 700,
            color: tokens.color.text1,
          }}
        >
          BalotaChain — Bulletin Board
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: tokens.space.xs,
            padding: "8px 16px",
            background: tokens.color.bg,
            color: tokens.color.text1,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.pill,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <ClockIcon size={16} />
          Election Closed
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
        background: "rgba(46, 125, 91, 0.08)",
        border: `1px solid ${tokens.color.success}`,
        borderRadius: tokens.radius.card,
        padding: `${tokens.space.sm}px ${tokens.space.md}px`,
        display: "flex",
        alignItems: "center",
        gap: tokens.space.sm,
      }}
    >
      <span style={{ color: tokens.color.success, display: "inline-flex" }}>
        <ShieldCheckIcon size={24} />
      </span>
      <span style={{ color: tokens.color.text1, fontWeight: 600 }}>
        Tally verified — {trusteesSigned} of {trusteesTotal} trustees signed the
        decryption.
      </span>
    </div>
  );
}

function IntegritySummary({
  ballotsCast,
  trusteesSigned,
  trusteesTotal,
  closedAt,
}: {
  ballotsCast: number;
  trusteesSigned: number;
  trusteesTotal: number;
  closedAt: string;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: tokens.space.sm }}
    >
      <h2 style={sectionTitle}>Integrity summary</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: tokens.space.sm,
        }}
      >
        <StatCard
          label="Ballots cast"
          value={formatNumber(ballotsCast)}
          caption="verified on chain"
          emphasize
        />
        <StatCard
          label="Trustees signed"
          value={`${trusteesSigned} / ${trusteesTotal}`}
          caption="threshold met"
          emphasize
        />
        <StatCard
          label="Encryption"
          value={ENCRYPTION_SCHEME}
          caption="joint public key"
        />
        <StatCard label="Closed" value={closedAt} caption="polls closed" />
      </div>
    </div>
  );
}

function CryptoVerification({
  fingerprint,
  trusteesSigned,
  trusteesTotal,
}: {
  fingerprint: string;
  trusteesSigned: number;
  trusteesTotal: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyFingerprint() {
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable in some sandboxed contexts; silently ignore
    }
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.space.md,
        }}
      >
        <h2 style={sectionTitle}>Cryptographic verification</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 200px) 1fr",
            gap: tokens.space.sm,
            alignItems: "start",
          }}
        >
          <span style={labelStyle}>Tally fingerprint</span>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: tokens.space.xs,
              minWidth: 0,
            }}
          >
            <code
              style={{
                fontFamily: tokens.type.mono,
                fontSize: 13,
                color: tokens.color.text1,
                background: tokens.color.bg,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: tokens.radius.button,
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                wordBreak: "break-all",
                lineHeight: 1.45,
                flex: 1,
                minWidth: 0,
              }}
            >
              {fingerprint}
            </code>
            <button
              type="button"
              onClick={copyFingerprint}
              aria-label="Copy tally fingerprint"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: tokens.space.xs,
                background: tokens.color.surface,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: tokens.radius.button,
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                color: tokens.color.text1,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <CopyIcon size={16} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <span style={labelStyle}>Trustee signatures</span>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.space.xs,
            }}
          >
            <span style={{ color: tokens.color.text1, fontWeight: 600 }}>
              {trusteesSigned} of {trusteesTotal} trustees
            </span>
            <span
              style={{ color: tokens.color.success, display: "inline-flex" }}
            >
              <ShieldCheckIcon size={16} />
            </span>
          </div>

          <span style={labelStyle}>Bulletin transcript</span>
          <div>
            <TextButton
              onClick={() => console.log("Download bulletin transcript (JSON)")}
            >
              Download (JSON)
            </TextButton>
          </div>
        </div>
      </div>
    </Card>
  );
}

function VerifyVoteCard({
  fallbackSubmittedAt,
}: {
  fallbackSubmittedAt: string;
}) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length === 0) return;
    if (!TRACKING_CODE_RE.test(trimmed)) {
      setState({ kind: "error" });
      return;
    }
    setPending(true);
    try {
      const result = await verifyTrackingCode(trimmed);
      if (result) {
        setState({
          kind: "success",
          code: result.tracking_code,
          submittedAt: result.submitted_at || fallbackSubmittedAt,
        });
      } else {
        setState({ kind: "error" });
      }
    } catch {
      setState({ kind: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.space.md,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={sectionTitle}>Verify your vote</h2>
          <span style={{ fontSize: 14, color: tokens.color.text2 }}>
            Enter your tracking code to confirm your ballot was recorded.
          </span>
        </header>

        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            gap: tokens.space.sm,
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <TextInput
              variant="mono"
              placeholder="BC-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              aria-label="Tracking code"
            />
          </div>
          <div style={{ flex: "0 0 auto", minWidth: 160 }}>
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "Verifying…" : "Verify"}
            </PrimaryButton>
          </div>
        </form>

        {state.kind === "success" ? (
          <div
            style={{
              background: "rgba(46, 125, 91, 0.08)",
              border: `1px solid ${tokens.color.success}`,
              borderRadius: tokens.radius.card,
              padding: tokens.space.md,
              display: "flex",
              alignItems: "flex-start",
              gap: tokens.space.sm,
            }}
          >
            <span
              style={{ color: tokens.color.success, display: "inline-flex" }}
            >
              <CheckIcon size={24} />
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: tokens.color.text1, fontWeight: 700 }}>
                Vote verified
              </span>
              <span style={{ color: tokens.color.text2, fontSize: 14 }}>
                Your ballot was recorded on {state.submittedAt}.
              </span>
              <code
                style={{
                  fontFamily: tokens.type.mono,
                  fontSize: 13,
                  color: tokens.color.text1,
                  marginTop: 4,
                }}
              >
                {state.code}
              </code>
            </div>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div
            style={{
              background: "rgba(192, 57, 43, 0.08)",
              border: `1px solid ${tokens.color.error}`,
              borderRadius: tokens.radius.card,
              padding: tokens.space.md,
              display: "flex",
              alignItems: "flex-start",
              gap: tokens.space.sm,
            }}
          >
            <span style={{ color: tokens.color.error, display: "inline-flex" }}>
              <AlertIcon size={24} />
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: tokens.color.text1, fontWeight: 700 }}>
                Tracking code not found.
              </span>
              <span style={{ color: tokens.color.text2, fontSize: 14 }}>
                Check the format BC-XXXX-XXXX and try again.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function TallyPendingNotice() {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.space.sm,
        }}
      >
        <h2 style={sectionTitle}>Results</h2>
        <span style={{ color: tokens.color.text2 }}>
          Tally pending — trustees decrypting.
        </span>
      </div>
    </Card>
  );
}

function Footer() {
  return (
    <footer
      style={{
        textAlign: "center",
        color: tokens.color.text2,
        fontSize: 13,
        paddingTop: tokens.space.md,
        paddingBottom: tokens.space.md,
      }}
    >
      BalotaChain v0.1 — staging demo. Public verifier powered by open-source
      Saksi.
    </footer>
  );
}

function deriveTallyMode(bulletin: Bulletin | null): TallyMode {
  if (!bulletin) return { kind: "mock" };
  if (bulletin.tally) {
    return {
      kind: "real",
      tally: bulletin.tally,
      ballotsCount: bulletin.ballots.length,
    };
  }
  if (bulletin.ballots.length > 0) return { kind: "pending" };
  return { kind: "mock" };
}

function App() {
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBulletin()
      .then((b) => {
        if (!cancelled) setBulletin(b);
      })
      .catch(() => {
        // Tauri unavailable (browser dev / test); fall back to mocked UI.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mode = useMemo(() => deriveTallyMode(bulletin), [bulletin]);

  const mockRaces = useMemo(() => RACES, []);

  const realRaces = useMemo(() => {
    if (mode.kind !== "real") return null;
    return tallyToRaces(mode.tally, mode.ballotsCount);
  }, [mode]);

  const fingerprint =
    mode.kind === "real" ? mode.tally.fingerprint : `sha256:${TALLY_SHA256}`;

  const trusteesSigned =
    mode.kind === "real" ? mode.tally.trustees_signed : TRUSTEES_SIGNED;

  const trusteesTotal =
    mode.kind === "real" ? mode.tally.trustees_total : TRUSTEES_TOTAL;

  const ballotsCast = mode.kind === "real" ? mode.ballotsCount : BALLOTS_CAST;

  const closedAt =
    mode.kind === "real" ? mode.tally.closed_at : POLLS_CLOSED_AT;

  return (
    <div style={pageWrap}>
      <Header />
      <main style={container}>
        <VerifiedBanner
          trusteesSigned={trusteesSigned}
          trusteesTotal={trusteesTotal}
        />

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space.md,
          }}
        >
          <h2 style={sectionTitle}>
            Final Results — Philippine National Elections 2028
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.space.md,
            }}
          >
            {mode.kind === "pending" ? (
              <TallyPendingNotice />
            ) : mode.kind === "real" && realRaces ? (
              realRaces.map((r) => <RaceCard key={r.title} race={r} />)
            ) : (
              mockRaces.map((r) => <RaceCard key={r.title} race={r} />)
            )}
          </div>
        </section>

        <IntegritySummary
          ballotsCast={ballotsCast}
          trusteesSigned={trusteesSigned}
          trusteesTotal={trusteesTotal}
          closedAt={closedAt}
        />
        <CryptoVerification
          fingerprint={fingerprint}
          trusteesSigned={trusteesSigned}
          trusteesTotal={trusteesTotal}
        />
        <VerifyVoteCard fallbackSubmittedAt={SAMPLE_VOTE_RECORDED_AT} />
        <Footer />
      </main>
    </div>
  );
}

export default App;
