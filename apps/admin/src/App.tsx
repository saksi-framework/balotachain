import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  tokens,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  ShieldCheckIcon,
  CheckIcon,
  CopyIcon,
  AlertIcon,
} from '@balotachain/ui';
import { Card } from './components/Card';
import { Chip } from './components/Chip';
import { Stepper } from './components/Stepper';
import { defaultElection, defaultVoter, positions as uiPositions } from './mocks/defaults';
import {
  loadBulletin,
  createElection,
  registerVoter,
  issueCredential,
  type Bulletin,
  type Position,
  type Voter as StoreVoter,
  type Credential as StoreCredential,
} from './lib/bulletin';

type ElectionForm = { name: string; opens: string; closes: string };
type VoterDraft = { id: string; email: string; name: string };
type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { label: '1 Election' },
  { label: '2 Voter roll' },
  { label: '3 Credentials' },
];

const PAGE_MAX = 960;
const FIELD_MAX = 480;

// Real schema positions for the bulletin. The UI tile list is keyed by the
// same titles; we map labels to {id, label, pick} for the Rust backend.
const SCHEMA_POSITIONS: Position[] = [
  { id: 'president', label: 'President', pick: 1 },
  { id: 'vp', label: 'Vice President', pick: 1 },
  { id: 'senators', label: 'Senators', pick: 12 },
];

function emptyBulletin(): Bulletin {
  return {
    version: 1,
    election: null,
    voters: [],
    credentials: [],
    ballots: [],
    partial_decryptions: [],
    tally: null,
  };
}

function validEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
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
      }}
    >
      <div
        style={{
          maxWidth: PAGE_MAX,
          margin: '0 auto',
          width: '100%',
          padding: `0 ${tokens.space.md}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: tokens.type.fontFamily,
            fontSize: tokens.type.body,
            fontWeight: 700,
            color: tokens.color.text1,
            letterSpacing: 0.2,
          }}
        >
          BalotaChain — Admin
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: tokens.space.xs,
            color: tokens.color.text2,
            fontSize: 14,
          }}
        >
          <ShieldCheckIcon size={18} style={{ color: tokens.color.teal }} />
          <span>Authority: WMSU Election Commission</span>
        </div>
      </div>
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', maxWidth: FIELD_MAX }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: tokens.color.text2,
          marginBottom: 6,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: tokens.space.md }}>
      <h2
        style={{
          margin: 0,
          fontSize: tokens.type.h2,
          fontWeight: 700,
          color: tokens.color.text1,
          lineHeight: tokens.type.lineHeight,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            margin: `${tokens.space.xs}px 0 0 0`,
            color: tokens.color.text2,
            fontSize: tokens.type.body,
            lineHeight: tokens.type.lineHeight,
            maxWidth: 640,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Banner({
  variant,
  children,
}: {
  variant: 'success' | 'error';
  children: ReactNode;
}) {
  const isSuccess = variant === 'success';
  const fg = isSuccess ? tokens.color.success : tokens.color.error;
  const bg = isSuccess ? 'rgba(46, 125, 91, 0.08)' : 'rgba(192, 57, 43, 0.08)';
  const border = isSuccess ? 'rgba(46, 125, 91, 0.24)' : 'rgba(192, 57, 43, 0.24)';
  const Icon = isSuccess ? CheckIcon : AlertIcon;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space.xs,
        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: tokens.radius.button,
        color: fg,
        fontSize: 14,
        fontWeight: 500,
        marginBottom: tokens.space.md,
      }}
    >
      <span style={{ color: fg, display: 'inline-flex' }}>
        <Icon size={18} />
      </span>
      <span>{children}</span>
    </div>
  );
}

function MonoText({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: tokens.type.mono,
        fontSize: 13,
        color: tokens.color.text1,
        wordBreak: 'break-all',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // clipboard unavailable in some sandboxes
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'transparent',
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        padding: '4px 8px',
        cursor: 'pointer',
        color: copied ? tokens.color.success : tokens.color.text2,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: tokens.type.fontFamily,
      }}
      aria-label="Copy"
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{
        display: 'block',
        width: '100%',
        padding: tokens.space.sm,
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        color: tokens.color.text1,
        fontSize: tokens.type.body,
        fontFamily: tokens.type.fontFamily,
        lineHeight: tokens.type.lineHeight,
        outline: 'none',
        appearance: 'none',
      }}
    >
      {children}
    </select>
  );
}

function PositionTile({ title, pick }: { title: string; pick: number }) {
  return (
    <div
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        padding: tokens.space.sm,
        background: tokens.color.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.space.sm,
      }}
    >
      <span
        style={{ color: tokens.color.text1, fontSize: tokens.type.body, fontWeight: 600 }}
      >
        {title}
      </span>
      <Chip variant="neutral">Pick {pick}</Chip>
    </div>
  );
}

function VoterRollTable({ voters }: { voters: StoreVoter[] }) {
  const cell: CSSProperties = {
    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
    fontSize: 14,
    color: tokens.color.text1,
    borderTop: `1px solid ${tokens.color.border}`,
    textAlign: 'left',
  };
  const head: CSSProperties = {
    ...cell,
    color: tokens.color.text2,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    borderTop: 'none',
    background: tokens.color.bg,
  };
  return (
    <div
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.button,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={head}>ID</th>
            <th style={head}>Email</th>
            <th style={head}>Name</th>
          </tr>
        </thead>
        <tbody>
          {voters.length === 0 ? (
            <tr>
              <td
                style={{ ...cell, color: tokens.color.text2, fontStyle: 'italic' }}
                colSpan={3}
              >
                No voters registered yet.
              </td>
            </tr>
          ) : (
            voters.map((v) => (
              <tr key={v.id}>
                <td style={cell}>
                  <MonoText>{v.id}</MonoText>
                </td>
                <td style={cell}>{v.email}</td>
                <td style={cell}>{v.name}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space.xs }}>
      <span
        style={{
          width: 80,
          fontSize: 12,
          color: tokens.color.text2,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <MonoText style={{ flex: 1 }}>{value}</MonoText>
      <CopyButton value={value} />
    </div>
  );
}

function CredentialList({ creds }: { creds: StoreCredential[] }) {
  if (creds.length === 0) return null;
  return (
    <div style={{ marginTop: tokens.space.md, display: 'grid', gap: tokens.space.xs }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: tokens.color.text2,
          letterSpacing: 0.2,
        }}
      >
        Issued credentials
      </div>
      {creds.map((c, i) => (
        <div
          key={i}
          style={{
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.button,
            padding: tokens.space.sm,
            background: tokens.color.bg,
            display: 'grid',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.space.sm,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: tokens.space.xs,
              }}
            >
              <Chip variant="success">Issued</Chip>
              <MonoText style={{ color: tokens.color.text1, fontWeight: 600 }}>
                {c.voter_id}
              </MonoText>
            </div>
            <span style={{ fontSize: 12, color: tokens.color.text2 }}>
              {c.issued_at}
            </span>
          </div>
          <Row label="nullifier" value={c.nullifier} />
          <Row label="token" value={c.token} />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [bulletin, setBulletin] = useState<Bulletin>(emptyBulletin);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [election, setElection] = useState<ElectionForm>({
    name: defaultElection.name,
    opens: defaultElection.opens,
    closes: defaultElection.closes,
  });
  const [electionCreated, setElectionCreated] = useState(false);

  const [voterDraft, setVoterDraft] = useState<VoterDraft>({
    id: defaultVoter.id,
    email: defaultVoter.email,
    name: defaultVoter.name,
  });
  const [voterError, setVoterError] = useState<string | null>(null);

  const [selectedVoterId, setSelectedVoterId] = useState<string>('');

  // Hydrate from the bulletin store on mount. If the Tauri bridge is not
  // available (e.g. running in a browser, vitest), fall back to local state
  // so the wizard still demos.
  useEffect(() => {
    let cancelled = false;
    loadBulletin()
      .then((b) => {
        if (cancelled) return;
        setBulletin(b);
        if (b.election) setElectionCreated(true);
        if (b.voters.length > 0) {
          setSelectedVoterId((prev) => prev || b.voters[0]!.id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setBackendError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const voters = bulletin.voters;
  const creds = bulletin.credentials;

  const canRegister = useMemo(
    () =>
      voterDraft.id.trim() !== '' &&
      voterDraft.name.trim() !== '' &&
      validEmail(voterDraft.email),
    [voterDraft],
  );

  async function handleCreateElection() {
    try {
      const updated = await createElection({
        name: election.name,
        opens: election.opens,
        closes: election.closes,
        positions: SCHEMA_POSITIONS,
      });
      setBulletin(updated);
      setElectionCreated(true);
      setBackendError(null);
      setCurrentStep(2);
    } catch (err) {
      // Tauri unavailable: still advance, mark created locally.
      setBackendError(String(err));
      setElectionCreated(true);
      setCurrentStep(2);
    }
  }

  async function handleRegisterVoter() {
    if (!canRegister) {
      setVoterError('Provide a voter ID, a valid email, and a display name.');
      return;
    }
    const id = voterDraft.id.trim();
    if (voters.some((v) => v.id === id)) {
      setVoterError(`A voter with ID ${id} is already registered.`);
      return;
    }
    setVoterError(null);
    const args = {
      voterId: id,
      email: voterDraft.email.trim(),
      name: voterDraft.name.trim(),
    };
    try {
      const updated = await registerVoter(args);
      setBulletin(updated);
      setBackendError(null);
    } catch (err) {
      setBackendError(String(err));
      setBulletin((prev) => ({
        ...prev,
        voters: [
          ...prev.voters,
          { id: args.voterId, email: args.email, name: args.name },
        ],
      }));
    }
    setVoterDraft({ id: '', email: '', name: '' });
  }

  function handleAdvanceToCredentials() {
    if (voters.length === 0) return;
    setSelectedVoterId((prev) => prev || voters[0]!.id);
    setCurrentStep(3);
  }

  async function handleIssueCredential() {
    if (!selectedVoterId) return;
    try {
      const updated = await issueCredential({ voterId: selectedVoterId });
      setBulletin(updated);
      setBackendError(null);
    } catch (err) {
      setBackendError(String(err));
      // Local fallback so the credential list still shows something useful.
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      const token = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
      const nullifier = `sha256:${token}${token}`;
      setBulletin((prev) => ({
        ...prev,
        credentials: [
          ...prev.credentials,
          {
            voter_id: selectedVoterId,
            nullifier,
            token,
            issued_at: new Date().toISOString(),
          },
        ],
      }));
    }
  }

  function handleFinish() {
    setCurrentStep(4);
  }

  function handleEditAgain() {
    setCurrentStep(1);
  }

  const electionId = bulletin.election?.id ?? defaultElection.id;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.color.bg,
        fontFamily: tokens.type.fontFamily,
        color: tokens.color.text1,
      }}
    >
      <Header />

      <main
        style={{
          maxWidth: PAGE_MAX,
          margin: '0 auto',
          padding: tokens.space.md,
          display: 'grid',
          gap: tokens.space.md,
        }}
      >
        {currentStep !== 4 && (
          <Stepper steps={STEPS} current={currentStep} />
        )}

        {backendError && (
          <Banner variant="error">
            Backend unavailable — running with local state only.
          </Banner>
        )}

        {currentStep === 1 && (
          <Card>
            <SectionTitle title="Create election" />
            {electionCreated && (
              <Banner variant="success">
                Election created. ID: {electionId}
              </Banner>
            )}
            <div style={{ display: 'grid', gap: tokens.space.md }}>
              <Field label="Election name">
                <TextInput
                  value={election.name}
                  onChange={(e) =>
                    setElection({ ...election, name: e.currentTarget.value })
                  }
                />
              </Field>
              <Field label="Polls open (YYYY-MM-DD HH:mm)">
                <TextInput
                  value={election.opens}
                  onChange={(e) =>
                    setElection({ ...election, opens: e.currentTarget.value })
                  }
                />
              </Field>
              <Field label="Polls close (YYYY-MM-DD HH:mm)">
                <TextInput
                  value={election.closes}
                  onChange={(e) =>
                    setElection({ ...election, closes: e.currentTarget.value })
                  }
                />
              </Field>

              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.color.text2,
                    marginBottom: 6,
                    letterSpacing: 0.2,
                  }}
                >
                  Positions
                </div>
                <div style={{ display: 'grid', gap: tokens.space.xs }}>
                  {uiPositions.map((p) => (
                    <PositionTile key={p.title} title={p.title} pick={p.pick} />
                  ))}
                </div>
                <p
                  style={{
                    margin: `${tokens.space.xs}px 0 0 0`,
                    fontSize: 13,
                    color: tokens.color.text2,
                  }}
                >
                  Positions are fixed for the demo.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PrimaryButton onClick={handleCreateElection}>
                  Create election
                </PrimaryButton>
              </div>
            </div>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <SectionTitle title="Register voter" />
            {voterError && <Banner variant="error">{voterError}</Banner>}
            <div style={{ display: 'grid', gap: tokens.space.md }}>
              <Field label="Voter ID">
                <TextInput
                  value={voterDraft.id}
                  onChange={(e) =>
                    setVoterDraft({ ...voterDraft, id: e.currentTarget.value })
                  }
                  placeholder="V-000001"
                />
              </Field>
              <Field label="Email">
                <TextInput
                  value={voterDraft.email}
                  onChange={(e) =>
                    setVoterDraft({ ...voterDraft, email: e.currentTarget.value })
                  }
                  placeholder="voter1@wmsu.edu.ph"
                  type="email"
                />
              </Field>
              <Field label="Display name">
                <TextInput
                  value={voterDraft.name}
                  onChange={(e) =>
                    setVoterDraft({ ...voterDraft, name: e.currentTarget.value })
                  }
                  placeholder="Demo Voter"
                />
              </Field>

              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.color.text2,
                    marginBottom: 6,
                    letterSpacing: 0.2,
                  }}
                >
                  Voter roll ({voters.length})
                </div>
                <VoterRollTable voters={voters} />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: tokens.space.sm,
                  flexWrap: 'wrap',
                }}
              >
                <SecondaryButton onClick={() => setCurrentStep(1)}>Back</SecondaryButton>
                <div
                  style={{ display: 'inline-flex', gap: tokens.space.xs, flexWrap: 'wrap' }}
                >
                  <PrimaryButton onClick={handleRegisterVoter} disabled={!canRegister}>
                    Register voter
                  </PrimaryButton>
                  <PrimaryButton
                    onClick={handleAdvanceToCredentials}
                    disabled={voters.length === 0}
                  >
                    Next: issue credential
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <SectionTitle
              title="Issue credential"
              subtitle="A blinded credential ties a voter to a one-time nullifier without revealing identity."
            />
            <div style={{ display: 'grid', gap: tokens.space.md }}>
              <Field label="Voter">
                <Select value={selectedVoterId} onChange={setSelectedVoterId}>
                  {voters.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} — {v.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                }}
              >
                <PrimaryButton
                  onClick={handleIssueCredential}
                  disabled={!selectedVoterId}
                >
                  Issue credential
                </PrimaryButton>
              </div>

              <CredentialList creds={creds} />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: tokens.space.sm,
                  marginTop: tokens.space.sm,
                  flexWrap: 'wrap',
                }}
              >
                <SecondaryButton onClick={() => setCurrentStep(2)}>Back</SecondaryButton>
                <PrimaryButton onClick={handleFinish} disabled={creds.length === 0}>
                  Finish setup
                </PrimaryButton>
              </div>
            </div>
          </Card>
        )}

        {currentStep === 4 && (
          <Card style={{ textAlign: 'center', padding: tokens.space.lg }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: tokens.radius.pill,
                background: 'rgba(46, 125, 91, 0.12)',
                color: tokens.color.success,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: tokens.space.md,
              }}
            >
              <CheckIcon size={36} />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: tokens.type.h2,
                fontWeight: 700,
                color: tokens.color.text1,
              }}
            >
              Election ready
            </h2>
            <p
              style={{
                margin: `${tokens.space.xs}px auto ${tokens.space.md}px`,
                color: tokens.color.text2,
                fontSize: tokens.type.body,
                lineHeight: tokens.type.lineHeight,
                maxWidth: 520,
              }}
            >
              1 election, {voters.length} voter(s), {creds.length} credential(s) issued.
              The demo can now run end-to-end.
            </p>
            <div
              style={{
                textAlign: 'left',
                background: tokens.color.bg,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: tokens.radius.button,
                padding: tokens.space.sm,
                margin: '0 auto',
                maxWidth: 520,
                display: 'grid',
                gap: 6,
              }}
            >
              <Row label="election" value={electionId} />
              {voters.map((v) => (
                <Row key={`v-${v.id}`} label="voter" value={v.id} />
              ))}
              {creds.map((c, i) => (
                <Row key={`c-${i}`} label="cred" value={c.nullifier} />
              ))}
            </div>
            <div style={{ marginTop: tokens.space.md }}>
              <SecondaryButton onClick={handleEditAgain}>Edit again</SecondaryButton>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
