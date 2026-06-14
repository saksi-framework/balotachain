//! Pure-function implementation of the balota-encrypt CLI.
//!
//! The CLI in `main.rs` is a thin wrapper that parses argv and prints JSON.
//! All logic lives here so it is exercised by `tests/cli.rs`.

use bulletin_store::{Ballot, BulletinSource, Ciphertext};
use chrono::Utc;
use rand::RngCore;
use rand::rngs::OsRng;
use saksi_ffi_flutter::api::{CiphertextDto, encrypt_ballot};
use serde::{Deserialize, Serialize};

/// Arguments accepted by `encrypt_impl` (the `encrypt` subcommand).
#[derive(Debug, Clone)]
pub struct EncryptArgs {
    pub public_key: String,
    pub choice: u64,
    pub randomness: u64,
}

/// Arguments accepted by `submit_ballot_impl` (the `submit-ballot` subcommand).
#[derive(Debug, Clone)]
pub struct SubmitArgs {
    pub voter_id: String,
    pub token: String,
    pub choice: u64,
}

/// JSON-serialisable success body for `submit-ballot`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SubmitResult {
    pub tracking_code: String,
    pub submitted_at: String,
}

/// Pure ElGamal encrypt wrapper. Maps saksi `Result<_, String>` straight through.
pub fn encrypt_impl(args: EncryptArgs) -> Result<CiphertextDto, String> {
    encrypt_ballot(args.public_key, args.choice, args.randomness)
}

/// Full submit-ballot flow against the given bulletin source.
///
/// 1. Load bulletin; require an election + a credential for the given voter
///    whose `token` matches.
/// 2. Generate randomness via `OsRng` and encrypt with the election's
///    `joint_public_key`.
/// 3. Generate a unique `BC-XXXX-XXXX` tracking code (retry on collision).
/// 4. Append a `Ballot` and persist.
pub fn submit_ballot_impl(store: &BulletinSource, args: SubmitArgs) -> Result<SubmitResult, String> {
    let mut rng = OsRng;
    submit_ballot_with_rng(store, args, &mut rng)
}

/// Same as `submit_ballot_impl` but with an injectable RNG. Convenient for tests
/// that want determinism (not currently used; OsRng collisions are unreachable
/// in practice).
pub fn submit_ballot_with_rng<R: RngCore>(
    store: &BulletinSource,
    args: SubmitArgs,
    rng: &mut R,
) -> Result<SubmitResult, String> {
    let mut bulletin = store.load().map_err(|e| format!("load bulletin: {e}"))?;

    let election = bulletin
        .election
        .as_ref()
        .ok_or_else(|| "no election in bulletin".to_string())?
        .clone();

    let credential = bulletin
        .credentials
        .iter()
        .find(|c| c.voter_id == args.voter_id)
        .ok_or_else(|| format!("no credential for voter {}", args.voter_id))?
        .clone();

    if credential.token != args.token {
        return Err("credential token does not match".to_string());
    }

    let randomness = next_randomness(rng);
    let ciphertext_dto = encrypt_ballot(election.joint_public_key.clone(), args.choice, randomness)
        .map_err(|e| format!("encrypt: {e}"))?;

    let tracking_code = unique_tracking_code(rng, &bulletin.ballots);
    let submitted_at = Utc::now().to_rfc3339();

    bulletin.ballots.push(Ballot {
        tracking_code: tracking_code.clone(),
        nullifier: credential.nullifier,
        ciphertext: Ciphertext {
            pad: ciphertext_dto.pad,
            data: ciphertext_dto.data,
        },
        submitted_at: submitted_at.clone(),
    });

    store.save(&bulletin).map_err(|e| format!("save bulletin: {e}"))?;

    Ok(SubmitResult {
        tracking_code,
        submitted_at,
    })
}

/// Backend the CLI binary talks to: the gateway if `BALOTA_BULLETIN_URL` is set,
/// otherwise the local `~/.balotachain/bulletin.json` file.
pub fn cli_source() -> BulletinSource {
    BulletinSource::from_env()
}

fn next_randomness<R: RngCore>(rng: &mut R) -> u64 {
    // The saksi small-int ElGamal accepts any u64 randomness scalar; we just
    // need a fresh per-ballot value. OsRng is uniform over u64.
    let mut bytes = [0u8; 8];
    rng.fill_bytes(&mut bytes);
    u64::from_le_bytes(bytes)
}

fn unique_tracking_code<R: RngCore>(rng: &mut R, existing: &[Ballot]) -> String {
    loop {
        let code = generate_tracking_code(rng);
        if !existing.iter().any(|b| b.tracking_code == code) {
            return code;
        }
    }
}

fn generate_tracking_code<R: RngCore>(rng: &mut R) -> String {
    let mut bytes = [0u8; 4];
    rng.fill_bytes(&mut bytes);
    let a = u16::from_le_bytes([bytes[0], bytes[1]]);
    let b = u16::from_le_bytes([bytes[2], bytes[3]]);
    format!("BC-{:04X}-{:04X}", a, b)
}
