import { useEffect, useMemo, useState } from 'react';
import {
  PrimaryButton,
  SecondaryButton,
  tokens,
  AlertIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  ShieldCheckIcon,
} from '@balotachain/ui';
import { Card } from './components/Card';
import { Chip, type ChipVariant } from './components/Chip';
import { ProgressBar } from './components/ProgressBar';
import {
  AGGREGATE_FINGERPRINT,
  BALLOT_COUNT,
  INITIAL_LOG,
  KEY_SHARE_FINGERPRINT,
  TRUSTEES,
  type LogEntry,
  type Trustee,
  type TrusteeStatus,
} from './mocks/trustee';
import {
  loadBulletin,
  submitAllPartialDecryptions,
  type Bulletin,
} from './lib/bulletin';

// Demo wiring: the "YOU" trustee in the UI is id "t03" on the bulletin side,
// and the demo secret share is a fixed scalar. Both are intentionally
// hard-coded for the staging demo and easy to swap later.
const YOU_TRUSTEE_ID = 't03';
const DEMO_SECRET_SHARE = 17;

type SubmitPhase = 'idle' | 'confirm' | 'submitted';

const THRESHOLD_REQUIRED = 3;

function statusVariant(status: TrusteeStatus): ChipVariant {
  switch (status) {
    case 'Submitted':
      return 'success';
    case 'Pending':
      return 'warn';
    case 'Offline':
      return 'neutral';
  }
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function copy(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        copy(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'transparent',
        color: tokens.color.text2,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: tokens.type.h2,
        fontWeight: 700,
        color: tokens.color.text1,
        letterSpacing: -0.2,
      }}
    >
      {children}
    </h2>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 14,
        color: tokens.color.text2,
      }}
    >
      {children}
    </p>
  );
}

function Header() {
  return (
    <header
      style={{
        height: 56,
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1024,
          padding: `0 ${tokens.space.md}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.space.md,
        }}
      >
        <div
          style={{
            fontSize: tokens.type.h2,
            fontWeight: 700,
            color: tokens.color.text1,
            letterSpacing: -0.3,
          }}
        >
          BalotaChain — Trustee Console
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space.sm,
            color: tokens.color.text1,
            fontSize: 14,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: tokens.color.success,
              fontWeight: 600,
            }}
          >
            <ShieldCheckIcon size={16} />
            Secure session
          </span>
          <span
            aria-hidden
            style={{ width: 1, height: 16, background: tokens.color.border }}
          />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 500,
            }}
          >
            <LockIcon size={16} />
            Trustee 03 — Dr. R. Mendoza
          </span>
        </div>
      </div>
    </header>
  );
}

function IdentityCard() {
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space.sm,
        }}
      >
        <SectionTitle>Identity & key share</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: tokens.space.md,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space.sm }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: tokens.radius.button,
                background: tokens.color.tealLight,
                color: tokens.color.teal,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheckIcon size={28} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  color: tokens.color.success,
                  fontWeight: 600,
                  fontSize: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Key share: held securely
                <CheckIcon size={16} />
              </div>
              <div style={{ color: tokens.color.text2, fontSize: 14 }}>
                Never leaves this device.
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space.xs,
              padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
              background: tokens.color.bg,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.button,
            }}
          >
            <code
              style={{
                fontFamily: tokens.type.mono,
                fontSize: 13,
                color: tokens.color.text1,
              }}
            >
              {KEY_SHARE_FINGERPRINT}
            </code>
            <CopyButton value={KEY_SHARE_FINGERPRINT} label="Copy key share fingerprint" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function RosterTile({ trustee }: { trustee: Trustee }) {
  return (
    <div
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.card,
        padding: tokens.space.sm,
        background: tokens.color.surface,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space.xs,
        minHeight: 116,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: tokens.color.text2,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        Trustee {trustee.id.toString().padStart(2, '0')}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: tokens.color.text1,
        }}
      >
        {trustee.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space.xs, marginTop: 'auto' }}>
        <Chip variant={statusVariant(trustee.status)}>{trustee.status}</Chip>
        {trustee.isYou && <Chip variant="teal">YOU</Chip>}
      </div>
    </div>
  );
}

function DecryptionPanel({
  trustees,
  submitted,
  phase,
  onStart,
  onCancel,
  onConfirm,
  submitError,
}: {
  trustees: Trustee[];
  submitted: number;
  phase: SubmitPhase;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitError: string | null;
}) {
  const liveCount = Math.min(submitted, THRESHOLD_REQUIRED);
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space.md,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space.xs }}>
          <SectionTitle>Threshold decryption ceremony</SectionTitle>
          <Subtitle>3 of 5 trustees required.</Subtitle>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space.xs }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space.sm,
            }}
          >
            <div style={{ flex: 1 }}>
              <ProgressBar value={liveCount} max={THRESHOLD_REQUIRED} />
            </div>
            <div
              style={{
                fontFamily: tokens.type.mono,
                fontSize: 13,
                fontWeight: 600,
                color: tokens.color.text1,
                minWidth: 56,
                textAlign: 'right',
              }}
            >
              {liveCount} / {THRESHOLD_REQUIRED}
            </div>
          </div>
          <div style={{ color: tokens.color.text2, fontSize: 14 }}>
            {liveCount} of {THRESHOLD_REQUIRED} partial decryptions submitted.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: tokens.space.sm,
          }}
        >
          {trustees.map((t) => (
            <RosterTile key={t.id} trustee={t} />
          ))}
        </div>

        {phase === 'idle' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryButton onClick={onStart}>Submit my partial decryption</PrimaryButton>
          </div>
        )}

        {phase === 'confirm' && (
          <div
            style={{
              background: 'rgba(200, 133, 26, 0.08)',
              border: `1px solid ${tokens.color.warn}`,
              borderRadius: tokens.radius.card,
              padding: tokens.space.md,
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.space.sm,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: tokens.space.sm }}>
              <span style={{ color: tokens.color.warn, flexShrink: 0, marginTop: 2 }}>
                <AlertIcon size={20} />
              </span>
              <div style={{ color: tokens.color.text1, fontSize: 15 }}>
                Once submitted, your partial decryption is irreversible and recorded in the public
                audit log.
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: tokens.space.sm,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
              <PrimaryButton onClick={onConfirm}>Confirm submission</PrimaryButton>
            </div>
          </div>
        )}

        {phase === 'submitted' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space.xs }}>
            <div
              style={{
                background: 'rgba(46, 125, 91, 0.10)',
                border: `1px solid ${tokens.color.success}`,
                borderRadius: tokens.radius.card,
                padding: tokens.space.md,
                display: 'flex',
                alignItems: 'center',
                gap: tokens.space.sm,
                color: tokens.color.success,
                fontWeight: 600,
              }}
            >
              <CheckIcon size={20} />
              Partial decryption submitted.
            </div>
            {submitError && (
              <div
                style={{
                  fontSize: 12,
                  color: tokens.color.text2,
                  fontFamily: tokens.type.mono,
                }}
              >
                offline mode: {submitError}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function VerificationCard({ ballotCount }: { ballotCount: number }) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space.sm }}>
        <SectionTitle>Verification context</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: tokens.space.md,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.space.xs,
              padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
              background: tokens.color.bg,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.button,
              minHeight: 48,
            }}
          >
            <code
              style={{
                fontFamily: tokens.type.mono,
                fontSize: 13,
                color: tokens.color.text1,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {AGGREGATE_FINGERPRINT}
            </code>
            <CopyButton value={AGGREGATE_FINGERPRINT} label="Copy aggregate fingerprint" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: tokens.type.h2,
                fontWeight: 700,
                color: tokens.color.text1,
                letterSpacing: -0.2,
              }}
            >
              Ballots tallied: {ballotCount.toLocaleString('en-US')}
            </div>
            <div style={{ color: tokens.color.text2, fontSize: 13 }}>
              Each ballot encrypted with the joint public key. Tallied via additive homomorphic
              aggregation.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AuditLog({ entries }: { entries: LogEntry[] }) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space.sm }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SectionTitle>Ceremony audit log</SectionTitle>
          <Subtitle>Read-only public record.</Subtitle>
        </div>
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {entries.map((e, idx) => (
            <li
              key={`${e.ts}-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '220px 1fr',
                gap: tokens.space.sm,
                padding: `${tokens.space.xs + 2}px 0`,
                borderTop: idx === 0 ? 'none' : `1px solid ${tokens.color.border}`,
                fontSize: 14,
              }}
            >
              <span
                style={{
                  fontFamily: tokens.type.mono,
                  fontSize: 12,
                  color: tokens.color.text2,
                }}
              >
                {formatTs(e.ts)}
              </span>
              <span style={{ color: tokens.color.text1 }}>{e.event}</span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

function Footer() {
  return (
    <footer
      style={{
        textAlign: 'center',
        color: tokens.color.text2,
        fontSize: 13,
        padding: `${tokens.space.md}px 0`,
      }}
    >
      BalotaChain v0.1 — staging demo. Open-source on Saksi.
    </footer>
  );
}

// Translate a Bulletin into the Trustee[] roster used by the UI. If the live
// bulletin has an election with trustees, prefer it; otherwise fall back to
// the mock so the demo still renders before admin/voter steps have run.
function deriveRoster(
  bulletin: Bulletin | null,
  fallback: Trustee[],
): Trustee[] {
  if (!bulletin || !bulletin.election || bulletin.election.trustees.length === 0) {
    return fallback;
  }
  const submittedIds = new Set(
    bulletin.partial_decryptions.map((p) => p.trustee_id),
  );
  return bulletin.election.trustees.map((entry, idx) => {
    const numericId = Number.parseInt(entry.id.replace(/[^0-9]/g, ''), 10) || idx + 1;
    const status: TrusteeStatus = submittedIds.has(entry.id)
      ? 'Submitted'
      : 'Pending';
    return {
      id: numericId,
      name: entry.name,
      status,
      isYou: entry.id === YOU_TRUSTEE_ID,
    };
  });
}

export default function App() {
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [trustees, setTrustees] = useState<Trustee[]>(TRUSTEES);
  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBulletin()
      .then((b) => {
        if (cancelled) return;
        setBulletin(b);
        setTrustees(deriveRoster(b, TRUSTEES));
      })
      .catch(() => {
        // Not inside Tauri (e.g. vite dev or vitest) — keep mock display.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submittedCount = useMemo(
    () => trustees.filter((t) => t.status === 'Submitted').length,
    [trustees],
  );

  function start() {
    setPhase('confirm');
  }

  function cancel() {
    setPhase('idle');
  }

  async function confirm() {
    setSubmitError(null);
    try {
      const updated = await submitAllPartialDecryptions(
        YOU_TRUSTEE_ID,
        DEMO_SECRET_SHARE,
      );
      const ts = nowIso();
      const myPartials = updated.partial_decryptions.filter(
        (p) => p.trustee_id === YOU_TRUSTEE_ID,
      ).length;
      setBulletin(updated);
      setTrustees((prev) => {
        const derived = deriveRoster(updated, prev);
        // Even when the bulletin has no election yet, mark the YOU trustee
        // submitted so the demo roster visibly updates.
        return derived.map((t) =>
          t.isYou ? { ...t, status: 'Submitted' as TrusteeStatus } : t,
        );
      });
      setLog((prev) => [
        ...prev,
        {
          ts,
          event: `Trustee 03 — Submitted ${myPartials} partial decryption(s)`,
        },
      ]);
      setPhase('submitted');
    } catch (err) {
      // No Tauri runtime in tests or dev preview — degrade gracefully so the
      // visible flow still completes for the demo.
      const message = err instanceof Error ? err.message : String(err);
      setSubmitError(message);
      const ts = nowIso();
      setTrustees((prev) =>
        prev.map((t) =>
          t.isYou ? { ...t, status: 'Submitted' as TrusteeStatus } : t,
        ),
      );
      setLog((prev) => [
        ...prev,
        { ts, event: 'Trustee 03 — Submitted partial decryption (offline)' },
      ]);
      setPhase('submitted');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.color.bg,
        color: tokens.color.text1,
        fontFamily: tokens.type.fontFamily,
      }}
    >
      <Header />
      <main
        style={{
          maxWidth: 1024,
          margin: '0 auto',
          padding: `${tokens.space.md}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space.md,
        }}
      >
        <IdentityCard />
        <DecryptionPanel
          trustees={trustees}
          submitted={submittedCount}
          phase={phase}
          onStart={start}
          onCancel={cancel}
          onConfirm={confirm}
          submitError={submitError}
        />
        <VerificationCard
          ballotCount={bulletin?.ballots.length ?? BALLOT_COUNT}
        />
        <AuditLog entries={log} />
        <Footer />
      </main>
    </div>
  );
}
