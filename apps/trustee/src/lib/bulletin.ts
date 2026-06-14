// Typed adapter over the trustee Tauri commands. Mirrors the
// `bulletin-store` Rust schema (see docs/bulletin-store-schema.md).

import { invoke } from "@tauri-apps/api/core";

export type Ciphertext = {
  pad: string;
  data: string;
};

export type Ballot = {
  tracking_code: string;
  nullifier: string;
  ciphertext: Ciphertext;
  submitted_at: string;
};

export type PartialDecryption = {
  trustee_id: string;
  ballot_index: number;
  share: string;
  submitted_at: string;
};

export type TrusteeEntry = {
  id: string;
  name: string;
  public_share: string;
};

export type Position = {
  id: string;
  label: string;
  pick: number;
};

export type Election = {
  id: string;
  name: string;
  opens: string;
  closes: string;
  joint_public_key: string;
  trustees: TrusteeEntry[];
  threshold: number;
  positions: Position[];
};

export type Voter = {
  id: string;
  email: string;
  name: string;
};

export type Credential = {
  voter_id: string;
  nullifier: string;
  token: string;
  issued_at: string;
};

export type CandidateResult = {
  id: string;
  name: string;
  party: string;
  votes: number;
  elected?: boolean;
};

export type RaceResult = {
  candidates: CandidateResult[];
};

export type Tally = {
  results: Record<string, RaceResult>;
  fingerprint: string;
  trustees_signed: number;
  trustees_total: number;
  closed_at: string;
};

export type Bulletin = {
  version: number;
  election: Election | null;
  voters: Voter[];
  credentials: Credential[];
  ballots: Ballot[];
  partial_decryptions: PartialDecryption[];
  tally: Tally | null;
};

export function loadBulletin(): Promise<Bulletin> {
  return invoke<Bulletin>("load_bulletin");
}

export function saveBulletin(bulletin: Bulletin): Promise<void> {
  return invoke<void>("save_bulletin", { bulletin });
}

export function submitPartialDecryption(
  trusteeId: string,
  secretShare: number,
  ballotIndex: number,
): Promise<Bulletin> {
  return invoke<Bulletin>("submit_partial_decryption", {
    trusteeId,
    secretShare,
    ballotIndex,
  });
}

export function submitAllPartialDecryptions(
  trusteeId: string,
  secretShare: number,
): Promise<Bulletin> {
  return invoke<Bulletin>("submit_all_partial_decryptions", {
    trusteeId,
    secretShare,
  });
}
