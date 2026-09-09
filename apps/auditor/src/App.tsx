import {
  useEffect,
  useMemo,
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
  RACES,
  TALLY_SHA256,
  BALLOTS_CAST,
  BALLOTS_VERIFIED,
  BALLOTS_REJECTED,
  TURNOUT,
  REGISTERED_VOTERS,
  PRECINCTS,
  TRUSTEES_SIGNED,
  TRUSTEES_TOTAL,
  ELECTION_NAME,
  POLLS_CLOSED_AT,
  TALLY_PUBLISHED_AT,
  SAMPLE_VOTE_RECORDED_AT,
  type Race,
  type Candidate,
} from "./mocks/results";
import {
  loadBulletin,
  verifyTrackingCode,
  type Bulletin,
  type Tally,
} from "./lib/bulletin";

const TRACKING_CODE_RE = /^BC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

type VerifyState =
  | { kind: "idle" }
  | { kind: "success"; code: string; submittedAt: string }
  | { kind: "error" };

type TallyMode =
  | { kind: "mock" }
  | { kind: "pending" }
  | { kind: "real"; tally: Tally; ballotsCount: number };

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

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function percentOf(votes: number, total: number): number {
  if (total <= 0) return 0;
  return (votes / total) * 100;
}

/**
 * Map a real bulletin tally into the same Race[] shape the UI already renders.
 * The mock races carry handcrafted seat counts and subtitles; real positions
 * only give us an id, so we title-case it and describe the ballot volume.
 */
function tallyToRaces(tally: Tally, ballotsCount: number): Race[] {
  return Object.keys(tally.results)
    .sort()
    .map((id) => {
      const candidates: Candidate[] = tally.results[id].candidates.map((c) => ({
        name: c.name,
        party: c.party,
        votes: c.votes,
        elected: c.elected,
      }));
      return {
        title: titleCase(id),
        seatLabel: "1 seat",
        subtitle: `${formatNumber(ballotsCount)} votes counted`,
        pickLimit: 1,
        ballotsTotal: ballotsCount,
        candidates,
      };
    });
}

function titleCase(id: string): string {
  if (id.length === 0) return id;
  return id.charAt(0).toUpperCase() + id.slice(1);
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
  denominator,
  barMax,
  rank,
  showPercent,
  first,
}: {
  candidate: Candidate;
  denominator: number;
  barMax: number;
  rank?: string;
  showPercent: boolean;
  first: boolean;
}) {
  const pct = percentOf(candidate.votes, denominator);
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
          {candidate.name}
          {candidate.party ? (
            <span
              style={{
                fontWeight: 400,
                color: tokens.color.text2,
                fontSize: 13,
              }}
            >
              · {candidate.party}
            </span>
          ) : null}
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
            {showPercent ? `${pct.toFixed(1)}%` : rank}
          </span>
        </div>
      </div>
      <ResultBar percent={barPct} dimmed={candidate.elected !== true} />
    </div>
  );
}

function RaceCard({ race }: { race: Race }) {
  const isMultiSeat = race.pickLimit > 1;
  const barMax = isMultiSeat
    ? Math.max(...race.candidates.map((c) => c.votes))
    : race.ballotsTotal;

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
          {race.title}
        </h3>
        <span style={{ fontSize: 12.5, color: tokens.color.text2 }}>
          {race.seatLabel}
        </span>
      </div>
      <p
        style={{
          fontSize: tokens.type.small,
          color: tokens.color.text2,
          margin: "0 0 16px",
        }}
      >
        {race.subtitle}
      </p>
      {race.candidates.map((c, i) => (
        <CandidateRow
          key={c.name}
          candidate={c}
          denominator={race.ballotsTotal}
          barMax={barMax}
          rank={c.rank}
          showPercent={!isMultiSeat}
          first={i === 0}
        />
      ))}
      {race.footnote ? (
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.text2,
            padding: "12px 0 4px",
            borderTop: `1px solid ${tokens.color.border}`,
          }}
        >
          {race.footnote}
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

function TopBar() {
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
          height: 68,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <BrandMark />
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.2 }}>
            BalotaChain — Bulletin Board
          </span>
        </span>
        <Chip variant="teal" dot>
          Election Closed
        </Chip>
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
          The complete tally has been cryptographically confirmed and
          independently reproduced by {trusteesSigned} of {trusteesTotal}{" "}
          trustees. No ballots were added, removed, or altered.
        </p>
      </div>
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

function CryptoVerification({
  fingerprint,
  trusteesSigned,
  trusteesTotal,
}: {
  fingerprint: string;
  trusteesSigned: number;
  trusteesTotal: number;
}) {
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
          icon={<CheckIcon size={20} strokeWidth={2} />}
          title={
            <>
              Tally proof:{" "}
              <span style={{ color: tokens.color.success, fontWeight: 600 }}>
                verified ✓
              </span>
            </>
          }
        >
          A zero-knowledge proof confirms the published totals match the
          encrypted ballots — without decrypting any single vote.
        </CryptoItem>
        <CryptoItem
          icon={<UsersIcon size={20} strokeWidth={1.7} />}
          title={`${trusteesSigned} of ${trusteesTotal} trustees participated`}
        >
          Decryption required a threshold of independent trustees, so no single
          party could read or alter the results alone.
        </CryptoItem>
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
              Final tally fingerprint
            </h3>
            <div
              className="bc-mono"
              style={{
                fontSize: 14,
                color: tokens.color.tealDark,
                wordBreak: "break-all",
              }}
            >
              {fingerprint}
            </div>
          </div>
          <CopyButton value={fingerprint} label="Copy tally fingerprint" />
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
          included in the final tally — without revealing your choice.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <TextInput
          variant="mono"
          placeholder="e.g. BC-7F3A-92K1"
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

        {state.kind === "success" ? (
          <div
            style={{
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "13px 16px",
              borderRadius: tokens.radius.button,
              background: tokens.color.successLight,
              border: `1px solid ${tokens.color.successBorder}`,
            }}
          >
            <span style={{ color: tokens.color.success, flexShrink: 0 }}>
              <CheckIcon size={20} strokeWidth={2.4} />
            </span>
            <span
              style={{
                fontSize: 14,
                color: tokens.color.successText,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              Vote verified — ballot {state.code} was recorded on{" "}
              {state.submittedAt} and included in the verified tally.
            </span>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div
            style={{
              marginTop: 2,
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "13px 16px",
              borderRadius: tokens.radius.button,
              background: tokens.color.warnLight,
              border: `1px solid ${tokens.color.warnBorder}`,
            }}
          >
            <span style={{ color: tokens.color.warn, flexShrink: 0 }}>
              <AlertIcon size={20} strokeWidth={1.7} />
            </span>
            <span
              style={{
                fontSize: 14,
                color: tokens.color.warnText,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              Tracking code not found. Check the format BC-XXXX-XXXX on your
              receipt and try again.
            </span>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

function TallyPendingNotice() {
  return (
    <Card>
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>
        Tally pending
      </h3>
      <p style={{ margin: 0, color: tokens.color.text2, fontSize: 15 }}>
        Ballots are sealed and the trustees are decrypting. Final results appear
        here once the threshold is met.
      </p>
    </Card>
  );
}

function FooterLink({
  children,
  solid = false,
}: {
  children: ReactNode;
  solid?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href="#"
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

function Footer() {
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
        <p
          style={{
            fontSize: 13.5,
            color: tokens.color.text2,
            maxWidth: 560,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          The BalotaChain bulletin board and verifier are fully open-source.
          Anyone can download the encrypted ballot record and independently
          re-run every check on their own machine — no trust in the operator
          required.
        </p>
        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          <FooterLink>
            <DownloadIcon size={16} strokeWidth={1.8} />
            Download verification data
          </FooterLink>
          <FooterLink solid>
            <CodeIcon size={16} strokeWidth={1.8} />
            Open verifier
          </FooterLink>
        </div>
      </div>
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
  const electionName =
    mode.kind === "real"
      ? (bulletin?.election?.name ?? ELECTION_NAME)
      : ELECTION_NAME;

  const races = realRaces ?? RACES;
  const verifiedPct =
    ballotsCast > 0 ? (BALLOTS_VERIFIED / ballotsCast) * 100 : 0;

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
      <TopBar />

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
            {electionName}
          </h1>
          <div style={{ color: tokens.color.text2, fontSize: 15 }}>
            Polls closed <strong>{closedAt}</strong> &nbsp;·&nbsp; Tally
            published{" "}
            <span className="bc-mono" style={{ fontSize: 14 }}>
              {TALLY_PUBLISHED_AT}
            </span>
          </div>
        </div>

        {mode.kind === "pending" ? null : (
          <VerifiedBanner
            trusteesSigned={trusteesSigned}
            trusteesTotal={trusteesTotal}
          />
        )}

        <Section
          title="Final Results"
          note={`${races.length} positions · 100% of precincts reporting`}
        >
          {mode.kind === "pending" ? (
            <TallyPendingNotice />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 20,
              }}
            >
              {races.map((r) => (
                <RaceCard key={r.title} race={r} />
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
              value={formatNumber(ballotsCast)}
              caption={`across ${formatNumber(PRECINCTS)} precincts`}
            />
            <StatCard
              label="Verified"
              icon={
                <span style={{ color: tokens.color.success, display: "flex" }}>
                  <CheckIcon size={15} strokeWidth={2.4} />
                </span>
              }
              value={formatNumber(BALLOTS_VERIFIED)}
              caption={`${verifiedPct.toFixed(2)}% of all ballots`}
              ok
            />
            <StatCard
              label="Rejected"
              value={formatNumber(BALLOTS_REJECTED)}
              caption="duplicate or malformed"
            />
            <StatCard
              label="Voter turnout"
              value={`${TURNOUT.toFixed(1)}%`}
              caption={`of ${formatNumber(REGISTERED_VOTERS)} registered`}
            />
          </div>
        </Section>

        <Section
          title="Cryptographic Verification"
          note="Anyone can reproduce these checks with the open verifier"
        >
          <CryptoVerification
            fingerprint={fingerprint}
            trusteesSigned={trusteesSigned}
            trusteesTotal={trusteesTotal}
          />
        </Section>

        {/* The mockup's verify card carries its own heading — no section head. */}
        <div style={{ marginBottom: 38 }}>
          <VerifyVoteCard fallbackSubmittedAt={SAMPLE_VOTE_RECORDED_AT} />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
