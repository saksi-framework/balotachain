//! Tauri commands that bridge the Trustee Console UI to the bulletin-store
//! crate and the saksi-ffi-tauri Saksi crypto bridge.
//!
//! Plain functions (`*_impl`) take an injected bulletin path so they are
//! testable without touching `$HOME/.balotachain/bulletin.json`. The
//! `#[tauri::command]` wrappers just resolve `bulletin_store::default_path()`
//! and delegate.

use std::path::Path;

use bulletin_store::{Bulletin, PartialDecryption, default_path, load, save};
use saksi_ffi_tauri::commands::{CiphertextDto, partial_decrypt};

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn submit_partial_decryption_impl(
    path: &Path,
    trustee_id: String,
    secret_share: u64,
    ballot_index: usize,
) -> Result<Bulletin, String> {
    let mut bulletin = load(path).map_err(|e| e.to_string())?;
    let ballot = bulletin
        .ballots
        .get(ballot_index)
        .ok_or_else(|| format!("ballot_index {} out of range", ballot_index))?;
    let dto = CiphertextDto {
        pad: ballot.ciphertext.pad.clone(),
        data: ballot.ciphertext.data.clone(),
    };
    let partial = partial_decrypt(trustee_id, secret_share, dto)?;
    bulletin.partial_decryptions.push(PartialDecryption {
        trustee_id: partial.trustee_id,
        ballot_index,
        share: partial.share,
        submitted_at: now_rfc3339(),
    });
    save(path, &bulletin).map_err(|e| e.to_string())?;
    Ok(bulletin)
}

pub fn submit_all_partial_decryptions_impl(
    path: &Path,
    trustee_id: String,
    secret_share: u64,
) -> Result<Bulletin, String> {
    let mut bulletin = load(path).map_err(|e| e.to_string())?;
    let mut new_partials: Vec<PartialDecryption> = Vec::with_capacity(bulletin.ballots.len());
    for (idx, ballot) in bulletin.ballots.iter().enumerate() {
        let dto = CiphertextDto {
            pad: ballot.ciphertext.pad.clone(),
            data: ballot.ciphertext.data.clone(),
        };
        let partial = partial_decrypt(trustee_id.clone(), secret_share, dto)?;
        new_partials.push(PartialDecryption {
            trustee_id: partial.trustee_id,
            ballot_index: idx,
            share: partial.share,
            submitted_at: now_rfc3339(),
        });
    }
    bulletin.partial_decryptions.extend(new_partials);
    save(path, &bulletin).map_err(|e| e.to_string())?;
    Ok(bulletin)
}

#[tauri::command]
pub fn load_bulletin() -> Result<Bulletin, String> {
    load(&default_path()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_bulletin(bulletin: Bulletin) -> Result<(), String> {
    save(&default_path(), &bulletin).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn submit_partial_decryption(
    trustee_id: String,
    secret_share: u64,
    ballot_index: usize,
) -> Result<Bulletin, String> {
    submit_partial_decryption_impl(&default_path(), trustee_id, secret_share, ballot_index)
}

#[tauri::command]
pub fn submit_all_partial_decryptions(
    trustee_id: String,
    secret_share: u64,
) -> Result<Bulletin, String> {
    submit_all_partial_decryptions_impl(&default_path(), trustee_id, secret_share)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bulletin_store::{Ballot, Ciphertext};
    use tempfile::TempDir;

    // A 32-byte-hex compressed Ed25519 point known to be valid; lifted from
    // the saksi-ffi-tauri test vector to keep the math deterministic.
    const VALID_PAD: &str =
        "0e1d5b2771666dd340a8285c3d315e94f21c3b48be9c5d65352eb952541db019";
    const DATA: &str =
        "8af8a8933f35789af543aa4aeace1b033a03e87bb603bc77f8bb85e2b2bff92a";

    fn tmp_path() -> (TempDir, std::path::PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bulletin.json");
        (dir, path)
    }

    fn ballot(tracking: &str) -> Ballot {
        Ballot {
            tracking_code: tracking.into(),
            nullifier: format!("null-{}", tracking),
            ciphertext: Ciphertext {
                pad: VALID_PAD.into(),
                data: DATA.into(),
            },
            submitted_at: "2026-06-14T18:00:00Z".into(),
        }
    }

    fn seed_with_ballots(path: &std::path::Path, n: usize) {
        let mut b = Bulletin::empty();
        for i in 0..n {
            b.ballots.push(ballot(&format!("b{:03}", i)));
        }
        save(path, &b).unwrap();
    }

    #[test]
    fn submit_partial_decryption_appends_one_entry_with_trustee_id() {
        let (_dir, path) = tmp_path();
        seed_with_ballots(&path, 1);

        let updated =
            submit_partial_decryption_impl(&path, "t03".into(), 17, 0).expect("submits");

        assert_eq!(updated.partial_decryptions.len(), 1);
        let p = &updated.partial_decryptions[0];
        assert_eq!(p.trustee_id, "t03");
        assert_eq!(p.ballot_index, 0);
        // share is the 32-byte hex of secret_share * pad
        assert_eq!(p.share.len(), 64);
    }

    #[test]
    fn submit_all_partial_decryptions_appends_one_per_ballot() {
        let (_dir, path) = tmp_path();
        seed_with_ballots(&path, 3);

        let updated =
            submit_all_partial_decryptions_impl(&path, "t03".into(), 17).expect("submits");

        assert_eq!(updated.partial_decryptions.len(), 3);
        for (i, p) in updated.partial_decryptions.iter().enumerate() {
            assert_eq!(p.trustee_id, "t03");
            assert_eq!(p.ballot_index, i);
            assert_eq!(p.share.len(), 64);
        }
    }

    #[test]
    fn submit_partial_decryption_missing_ballot_index_errors() {
        let (_dir, path) = tmp_path();
        seed_with_ballots(&path, 1);

        let err =
            submit_partial_decryption_impl(&path, "t03".into(), 17, 99).expect_err("should err");
        assert!(err.contains("out of range"), "got: {err}");
    }

    #[test]
    fn submit_persists_to_disk() {
        let (_dir, path) = tmp_path();
        seed_with_ballots(&path, 1);

        submit_partial_decryption_impl(&path, "t03".into(), 17, 0).unwrap();

        let reloaded = load(&path).unwrap();
        assert_eq!(reloaded.partial_decryptions.len(), 1);
        assert_eq!(reloaded.partial_decryptions[0].trustee_id, "t03");
    }
}
