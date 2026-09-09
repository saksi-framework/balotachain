// Demo data for the trustee console, mirroring the Claude Design mockup
// (`.design-src/trustee-console.html`). Superseded by the live bulletin as
// soon as `loadBulletin()` returns an election with trustees.

export type TrusteeStatus = "Submitted" | "Pending" | "Offline";

export type Trustee = {
  id: number;
  name: string;
  /** Organisation the trustee represents, shown under their name. */
  role: string;
  status: TrusteeStatus;
  isYou?: boolean;
};

export type LogEntry = {
  ts: string;
  /** Bold lead-in of the log line. */
  lead: string;
  /** Optional trailing detail, rendered in normal weight. */
  detail?: string;
  /** Green node for completed steps, teal for ceremony milestones. */
  kind?: "ok" | "teal";
  /** Rows appended during this session animate in. */
  isNew?: boolean;
};

export const TRUSTEES: Trustee[] = [
  {
    id: 1,
    name: "Maria Santos",
    role: "Commission on Elections",
    status: "Submitted",
  },
  {
    id: 2,
    name: "Roberto Lim",
    role: "Independent Election Observer",
    status: "Pending",
    isYou: true,
  },
  {
    id: 3,
    name: "David Cruz",
    role: "Parish Pastoral Council for Responsible Voting",
    status: "Submitted",
  },
  {
    id: 4,
    name: "Elena Reyes",
    role: "University IT Department",
    status: "Offline",
  },
  {
    id: 5,
    name: "Ahmad Faisal",
    role: "National Citizens' Movement for Free Elections",
    status: "Pending",
  },
];

export const YOU_NAME = "Roberto Lim";
export const YOU_ROLE = "Independent Election Observer";
export const YOU_ORDINAL = 2;
export const TRUSTEE_TOTAL = 5;
export const THRESHOLD_REQUIRED = 3;

export const ELECTION_NAME = "Philippine National Elections 2028";
export const POLLS_CLOSED_AT = "polls closed May 8, 2028 · 7:00 PM PHT";

export const KEY_SHARE_FINGERPRINT = "ks2:4a7f…e0c1";
export const KEY_SHARE_CEREMONY = "Key generation · May 1";
export const AGGREGATE_FINGERPRINT =
  "sha256:9f3a7c2e8b1d4056af92e7c0d3b618fe4a2c9d70e15b8843f6a0c2e9b71d4f88";
export const BALLOT_COUNT = 12611219;
export const POSITION_NAMES = "President · Vice President · Senator";

export const INITIAL_LOG: LogEntry[] = [
  {
    ts: "May 1, 2028 · 09:12:40",
    lead: "Key generation ceremony completed",
    detail: "5 of 5 trustees, threshold set to 3",
    kind: "ok",
  },
  {
    ts: "May 8, 2028 · 07:00:00",
    lead: "Election opened",
    detail: "ballots accepted to bulletin board",
    kind: "ok",
  },
  {
    ts: "May 8, 2028 · 19:00:00",
    lead: "Election closed",
    detail: "12,613,540 ballots sealed",
    kind: "ok",
  },
  {
    ts: "May 8, 2028 · 21:30:15",
    lead: "Homomorphic aggregation completed",
    detail: "12,611,219 verified ballots",
    kind: "ok",
  },
  {
    ts: "May 8, 2028 · 21:42:08",
    lead: "Decryption ceremony opened",
    kind: "teal",
  },
  {
    ts: "May 8, 2028 · 21:44:51",
    lead: "Trustee 1 (Maria Santos)",
    detail: "submitted partial decryption",
    kind: "ok",
  },
  {
    ts: "May 8, 2028 · 21:46:20",
    lead: "Trustee 3 (David Cruz)",
    detail: "submitted partial decryption",
    kind: "ok",
  },
];

/** "Roberto Lim" -> "RL"; used for the avatar tiles. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
