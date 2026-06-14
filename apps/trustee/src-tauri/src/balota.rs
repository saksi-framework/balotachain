//! Tauri commands that bridge the Trustee Console UI to the bulletin-store
//! crate and the saksi-ffi-tauri Saksi crypto bridge.
//!
//! Plain `*_impl` functions take an injected [`BulletinSource`] so they are
//! testable and backend-agnostic (local file or containerized gateway). The
//! `#[tauri::command]` wrappers resolve [`BulletinSource::from_env`] and delegate.

use bulletin_store::{Bulletin, BulletinSource, PartialDecryption};
use saksi_ffi_tauri::commands::{CiphertextDto, partial_decrypt};

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn submit_partial_decryption_impl(
    store: &BulletinSource,
    trustee_id: String,
    secret_share: u64,
    ballot_index: usize,
) -> Result<Bulletin, String> {
    let mut bulletin = store.load().map_err(|e| e.to_string())?;
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
    store.save(&bulletin).map_err(|e| e.to_string())?;
    Ok(bulletin)
}

pub fn submit_all_partial_decryptions_impl(
    store: &BulletinSource,
    trustee_id: String,
    secret_share: u64,
) -> Result<Bulletin, String> {
    let mut bulletin = store.load().map_err(|e| e.to_string())?;
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
    store.save(&bulletin).map_err(|e| e.to_string())?;
    Ok(bulletin)
}

#[tauri::command]
pub fn load_bulletin() -> Result<Bulletin, String> {
    BulletinSource::from_env().load().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_bulletin(bulletin: Bulletin) -> Result<(), String> {
    BulletinSource::from_env()
        .save(&bulletin)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn submit_partial_decryption(
    trustee_id: String,
    secret_share: u64,
    ballot_index: usize,
) -> Result<Bulletin, String> {
    submit_partial_decryption_impl(
        &BulletinSource::from_env(),
        trustee_id,
        secret_share,
        ballot_index,
    )
}

#[tauri::command]
pub fn submit_all_partial_decryptions(
    trustee_id: String,
    secret_share: u64,
) -> Result<Bulletin, String> {
    submit_all_partial_decryptions_impl(&BulletinSource::from_env(), trustee_id, secret_share)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bulletin_store::{Ballot, Ciphertext};
    use tempfile::TempDir;

    // A 32-byte-hex compressed Ed25519 point known to be valid; lifted from
    // the saksi-ffi-tauri test vector to keep the math deterministic.
    const VALID_PAD: &str = "0e1d5b2771666dd340a8285c3d315e94f21c3b48be9c5d65352eb952541db019";
    const DATA: &str = "8af8a8933f35789af543aa4aeace1b033a03e87bb603bc77f8bb85e2b2bff92a";

    fn tmp_store() -> (TempDir, BulletinSource) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bulletin.json");
        (dir, BulletinSource::File(path))
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

    fn seed_with_ballots(store: &BulletinSource, n: usize) {
        let mut b = Bulletin::empty();
        for i in 0..n {
            b.ballots.push(ballot(&format!("b{:03}", i)));
        }
        store.save(&b).unwrap();
    }

    #[test]
    fn submit_partial_decryption_appends_one_entry_with_trustee_id() {
        let (_dir, store) = tmp_store();
        seed_with_ballots(&store, 1);

        let updated =
            submit_partial_decryption_impl(&store, "t03".into(), 17, 0).expect("submits");

        assert_eq!(updated.partial_decryptions.len(), 1);
        let p = &updated.partial_decryptions[0];
        assert_eq!(p.trustee_id, "t03");
        assert_eq!(p.ballot_index, 0);
        // share is the 32-byte hex of secret_share * pad
        assert_eq!(p.share.len(), 64);
    }

    #[test]
    fn submit_all_partial_decryptions_appends_one_per_ballot() {
        let (_dir, store) = tmp_store();
        seed_with_ballots(&store, 3);

        let updated =
            submit_all_partial_decryptions_impl(&store, "t03".into(), 17).expect("submits");

        assert_eq!(updated.partial_decryptions.len(), 3);
        for (i, p) in updated.partial_decryptions.iter().enumerate() {
            assert_eq!(p.trustee_id, "t03");
            assert_eq!(p.ballot_index, i);
            assert_eq!(p.share.len(), 64);
        }
    }

    #[test]
    fn submit_partial_decryption_missing_ballot_index_errors() {
        let (_dir, store) = tmp_store();
        seed_with_ballots(&store, 1);

        let err =
            submit_partial_decryption_impl(&store, "t03".into(), 17, 99).expect_err("should err");
        assert!(err.contains("out of range"), "got: {err}");
    }

    #[test]
    fn submit_persists_to_disk() {
        let (_dir, store) = tmp_store();
        seed_with_ballots(&store, 1);

        submit_partial_decryption_impl(&store, "t03".into(), 17, 0).unwrap();

        let reloaded = store.load().unwrap();
        assert_eq!(reloaded.partial_decryptions.len(), 1);
        assert_eq!(reloaded.partial_decryptions[0].trustee_id, "t03");
    }
}
