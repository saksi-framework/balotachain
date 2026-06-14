export type TrusteeStatus = 'Submitted' | 'Pending' | 'Offline';

export type Trustee = {
  id: number;
  name: string;
  status: TrusteeStatus;
  isYou?: boolean;
};

export type LogEntry = {
  ts: string;
  event: string;
};

export const TRUSTEES: Trustee[] = [
  { id: 1, name: 'Maria Santos', status: 'Submitted' },
  { id: 2, name: 'Carlos Tan', status: 'Submitted' },
  { id: 3, name: 'Dr. R. Mendoza', status: 'Pending', isYou: true },
  { id: 4, name: 'Lourdes Reyes', status: 'Pending' },
  { id: 5, name: 'Ahmed Hassan', status: 'Offline' },
];

export const KEY_SHARE_FINGERPRINT = 'share-3-of-5: a3f8…2c91';
export const AGGREGATE_FINGERPRINT = 'aggregate-fingerprint: sha256:9b1c…7d44';
export const BALLOT_COUNT = 1247;

export const INITIAL_LOG: LogEntry[] = [
  { ts: '2026-06-14T08:01:12Z', event: 'DKG round 1 completed' },
  { ts: '2026-06-14T08:04:38Z', event: 'Joint public key published to bulletin board' },
  { ts: '2026-06-14T18:00:00Z', event: 'Ballot collection closed; 1,247 ballots sealed' },
  { ts: '2026-06-14T18:02:11Z', event: 'Trustee 01 — Submitted partial decryption' },
  { ts: '2026-06-14T18:05:47Z', event: 'Trustee 02 — Submitted partial decryption' },
];
