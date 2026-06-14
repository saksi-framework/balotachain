//! End-to-end one-voter cycle driver.
//!
//! Walks the bulletin store through every role's writes using each layer's
//! library code: bulletin-store, balota-encrypt (voter), saksi-ffi-tauri
//! (trustee), plus inline admin + tally helpers. Verifies the demo data flow
//! works without Tauri/Flutter/Fabric being up.

use balota_encrypt::{SubmitArgs, submit_ballot_impl};
use bulletin_store::{
    Bulletin, CandidateResult, Credential, Election, PartialDecryption, Position, RaceResult,
    Tally, TrusteeEntry, Voter, load, results_fingerprint, save,
};
use chrono::Utc;
use rand::Rng;
use saksi_ffi_flutter::api::keygen_from_scalar;
use saksi_ffi_tauri::commands::{CiphertextDto as TauriCiphertextDto, partial_decrypt};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct E2eOutcome {
    pub tracking_code: String,
    pub fingerprint: String,
}

#[derive(Debug)]
pub enum E2eError {
    Store(bulletin_store::StoreError),
    Encrypt(String),
    Decrypt(String),
    Logic(&'static str),
}

impl std::fmt::Display for E2eError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            E2eError::Store(e) => write!(f, "store: {}", e),
            E2eError::Encrypt(s) => write!(f, "encrypt: {}", s),
            E2eError::Decrypt(s) => write!(f, "decrypt: {}", s),
            E2eError::Logic(s) => write!(f, "logic: {}", s),
        }
    }
}

impl std::error::Error for E2eError {}

impl From<bulletin_store::StoreError> for E2eError {
    fn from(value: bulletin_store::StoreError) -> Self {
        E2eError::Store(value)
    }
}

const DEMO_JOINT_SECRET: u64 = 42;
const DEMO_TRUSTEE_SECRET_SHARE: u64 = 17;
const DEMO_VOTER_ID: &str = "v-000001";
const DEMO_VOTER_EMAIL: &str = "voter1@wmsu.edu.ph";
const DEMO_VOTER_NAME: &str = "Demo Voter";
const DEMO_CHOICE: u64 = 1;
const TRUSTEE_IDS: [&str; 5] = ["t01", "t02", "t03", "t04", "t05"];

pub fn run_one_voter_cycle(path: &Path) -> Result<E2eOutcome, E2eError> {
    create_election(path)?;
    register_voter(path)?;
    issue_credential(path)?;
    let tracking_code = voter_casts_ballot(path)?;
    trustee_submits_partial_decryption(path)?;
    let fingerprint = finalize_demo_tally(path)?;
    Ok(E2eOutcome {
        tracking_code,
        fingerprint,
    })
}

fn create_election(path: &Path) -> Result<(), E2eError> {
    let mut b = load(path)?;
    let pubkey = keygen_from_scalar(DEMO_JOINT_SECRET).public_key;
    let trustees = TRUSTEE_IDS
        .iter()
        .enumerate()
        .map(|(idx, id)| TrusteeEntry {
            id: (*id).into(),
            name: format!("Demo Trustee {}", idx + 1),
            public_share: hex_sha256(&format!("share:{id}")),
        })
        .collect();
    b.election = Some(Election {
        id: "bc-2028-ph".into(),
        name: "Philippine National Elections 2028".into(),
        opens: "2026-06-08T06:00:00Z".into(),
        closes: "2026-06-08T18:00:00Z".into(),
        joint_public_key: pubkey,
        trustees,
        threshold: 3,
        positions: vec![
            Position {
                id: "president".into(),
                label: "President".into(),
                pick: 1,
            },
            Position {
                id: "vp".into(),
                label: "Vice President".into(),
                pick: 1,
            },
            Position {
                id: "senators".into(),
                label: "Senators".into(),
                pick: 12,
            },
        ],
    });
    save(path, &b)?;
    Ok(())
}

fn register_voter(path: &Path) -> Result<(), E2eError> {
    let mut b = load(path)?;
    b.voters.push(Voter {
        id: DEMO_VOTER_ID.into(),
        email: DEMO_VOTER_EMAIL.into(),
        name: DEMO_VOTER_NAME.into(),
    });
    save(path, &b)?;
    Ok(())
}

fn issue_credential(path: &Path) -> Result<(), E2eError> {
    let mut b = load(path)?;
    if !b.voters.iter().any(|v| v.id == DEMO_VOTER_ID) {
        return Err(E2eError::Logic("voter not registered"));
    }
    let token_bytes: [u8; 16] = rand::rngs::OsRng.r#gen();
    let token = hex::encode(token_bytes);
    let nullifier = format!(
        "sha256:{}",
        hex_sha256(&format!("{DEMO_VOTER_ID}:{token}"))
    );
    b.credentials.push(Credential {
        voter_id: DEMO_VOTER_ID.into(),
        nullifier,
        token,
        issued_at: Utc::now().to_rfc3339(),
    });
    save(path, &b)?;
    Ok(())
}

fn voter_casts_ballot(path: &Path) -> Result<String, E2eError> {
    let b = load(path)?;
    let credential = b
        .credentials
        .iter()
        .find(|c| c.voter_id == DEMO_VOTER_ID)
        .ok_or(E2eError::Logic("missing credential for demo voter"))?;
    let token = credential.token.clone();
    let args = SubmitArgs {
        voter_id: DEMO_VOTER_ID.into(),
        token,
        choice: DEMO_CHOICE,
    };
    let outcome = submit_ballot_impl(path, args).map_err(E2eError::Encrypt)?;
    Ok(outcome.tracking_code)
}

fn trustee_submits_partial_decryption(path: &Path) -> Result<(), E2eError> {
    let mut b = load(path)?;
    if b.ballots.is_empty() {
        return Err(E2eError::Logic("no ballots to decrypt"));
    }
    let now = Utc::now().to_rfc3339();
    let mut new_entries = Vec::new();
    for (ballot_index, ballot) in b.ballots.iter().enumerate() {
        let dto = TauriCiphertextDto {
            pad: ballot.ciphertext.pad.clone(),
            data: ballot.ciphertext.data.clone(),
        };
        let partial =
            partial_decrypt("t03".into(), DEMO_TRUSTEE_SECRET_SHARE, dto).map_err(E2eError::Decrypt)?;
        new_entries.push(PartialDecryption {
            trustee_id: partial.trustee_id,
            ballot_index,
            share: partial.share,
            submitted_at: now.clone(),
        });
    }
    b.partial_decryptions.extend(new_entries);
    save(path, &b)?;
    Ok(())
}

fn finalize_demo_tally(path: &Path) -> Result<String, E2eError> {
    let mut b = load(path)?;
    let mut results = BTreeMap::new();
    results.insert(
        "president".into(),
        RaceResult {
            candidates: vec![
                CandidateResult {
                    id: "maria-santos".into(),
                    name: "Maria Santos".into(),
                    party: "Lakas-CMD".into(),
                    votes: 1,
                    elected: true,
                },
                CandidateResult {
                    id: "juan-dela-cruz".into(),
                    name: "Juan Dela Cruz".into(),
                    party: "Independent".into(),
                    votes: 0,
                    elected: false,
                },
            ],
        },
    );
    results.insert(
        "vp".into(),
        RaceResult {
            candidates: vec![CandidateResult {
                id: "jose-rizal".into(),
                name: "Jose Rizal".into(),
                party: "Independent".into(),
                votes: 1,
                elected: true,
            }],
        },
    );
    results.insert(
        "senators".into(),
        RaceResult {
            candidates: vec![CandidateResult {
                id: "demo-senator".into(),
                name: "Demo Senator".into(),
                party: "Demo".into(),
                votes: 1,
                elected: true,
            }],
        },
    );
    let fingerprint = results_fingerprint(&results);
    b.tally = Some(Tally {
        results,
        fingerprint: fingerprint.clone(),
        trustees_signed: 1,
        trustees_total: TRUSTEE_IDS.len() as u32,
        closed_at: Utc::now().to_rfc3339(),
    });
    save(path, &b)?;
    Ok(fingerprint)
}

fn hex_sha256(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn summarize(b: &Bulletin) -> String {
    let mut out = String::new();
    out.push_str("Bulletin summary:\n");
    if let Some(e) = &b.election {
        out.push_str(&format!("  election:    {} ({} trustees, threshold {})\n", e.id, e.trustees.len(), e.threshold));
    } else {
        out.push_str("  election:    none\n");
    }
    out.push_str(&format!("  voters:      {}\n", b.voters.len()));
    out.push_str(&format!("  credentials: {}\n", b.credentials.len()));
    out.push_str(&format!("  ballots:     {}\n", b.ballots.len()));
    out.push_str(&format!("  partial dec: {}\n", b.partial_decryptions.len()));
    if let Some(t) = &b.tally {
        out.push_str(&format!("  tally:       {} ({}/{} trustees signed)\n", t.fingerprint, t.trustees_signed, t.trustees_total));
        for (race, r) in &t.results {
            for c in &r.candidates {
                if c.elected {
                    out.push_str(&format!("    {race:>9}: {} ({}) — ELECTED [{}]\n", c.name, c.party, c.votes));
                }
            }
        }
    } else {
        out.push_str("  tally:       none\n");
    }
    out
}
