/**
 * Typed adapter over the Rust `balota::*` Tauri commands defined in
 * `apps/auditor/src-tauri/src/balota.rs`. These shapes must stay in lock-step
 * with the Rust structs in `crates/bulletin-store` — the auditor app is
 * read-only, so we mirror serde's snake_case JSON form directly.
 */

import { invoke } from "@tauri-apps/api/core";
import type { RaceResult } from "./tally";

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

export type BallotVerification = {
  tracking_code: string;
  submitted_at: string;
  ballot_index: number;
};

export function loadBulletin(): Promise<Bulletin> {
  return invoke<Bulletin>("load_bulletin");
}

export function verifyTrackingCode(
  code: string,
): Promise<BallotVerification | null> {
  return invoke<BallotVerification | null>("verify_tracking_code", { code });
}
