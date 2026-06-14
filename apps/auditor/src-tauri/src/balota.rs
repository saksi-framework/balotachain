//! Read-only Tauri commands that bridge the Auditor Bulletin Board UI to the
//! bulletin-store crate. The auditor app never mutates the bulletin; it only
//! reads the published state and confirms a voter's tracking code is recorded.
//!
//! Plain `*_impl` functions take an injected bulletin path so they are testable
//! without depending on `$HOME/.balotachain/bulletin.json`. The
//! `#[tauri::command]` wrappers resolve `bulletin_store::default_path()` and
//! delegate.

use std::path::Path;

use bulletin_store::{Bulletin, default_path, load};
use serde::{Deserialize, Serialize};

/// Result returned to the UI when a tracking code is found on the bulletin.
/// The auditor sends this back to the verify-vote card so the voter sees
/// the exact ballot index and timestamp recorded on chain.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BallotVerification {
    pub tracking_code: String,
    pub submitted_at: String,
    pub ballot_index: usize,
}

pub fn load_bulletin_impl(path: &Path) -> Result<Bulletin, String> {
    load(path).map_err(|e| e.to_string())
}

pub fn verify_tracking_code_impl(
    path: &Path,
    code: &str,
) -> Result<Option<BallotVerification>, String> {
    let bulletin = load(path).map_err(|e| e.to_string())?;
    let found = bulletin
        .ballots
        .iter()
        .enumerate()
        .find(|(_, b)| b.tracking_code == code)
        .map(|(idx, b)| BallotVerification {
            tracking_code: b.tracking_code.clone(),
            submitted_at: b.submitted_at.clone(),
            ballot_index: idx,
        });
    Ok(found)
}

#[tauri::command]
pub fn load_bulletin() -> Result<Bulletin, String> {
    load_bulletin_impl(&default_path())
}

#[tauri::command]
pub fn verify_tracking_code(code: String) -> Result<Option<BallotVerification>, String> {
    verify_tracking_code_impl(&default_path(), &code)
}

#[cfg(test)]
mod tests {
    use super::*;
    use bulletin_store::{
        Ballot, Bulletin, Ciphertext, CandidateResult, RaceResult, Tally, save,
    };
    use std::collections::BTreeMap;
    use std::path::PathBuf;
    use tempfile::TempDir;

    fn tmp_path() -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bulletin.json");
        (dir, path)
    }

    fn ballot(tracking: &str) -> Ballot {
        Ballot {
            tracking_code: tracking.into(),
            nullifier: format!("null-{}", tracking),
            ciphertext: Ciphertext {
                pad: "pad-stub".into(),
                data: "data-stub".into(),
            },
            submitted_at: "2026-06-08T21:14:00Z".into(),
        }
    }

    #[test]
    fn load_bulletin_impl_returns_empty_when_file_missing() {
        let (_dir, path) = tmp_path();
        let bulletin = load_bulletin_impl(&path).expect("load");
        assert_eq!(bulletin, Bulletin::empty());
    }

    #[test]
    fn load_bulletin_impl_returns_persisted_state() {
        let (_dir, path) = tmp_path();
        let mut b = Bulletin::empty();
        b.ballots.push(ballot("BC-AAAA-0001"));
        save(&path, &b).unwrap();

        let loaded = load_bulletin_impl(&path).expect("load");
        assert_eq!(loaded.ballots.len(), 1);
        assert_eq!(loaded.ballots[0].tracking_code, "BC-AAAA-0001");
    }

    #[test]
    fn verify_tracking_code_impl_returns_some_for_matching_code() {
        let (_dir, path) = tmp_path();
        let mut b = Bulletin::empty();
        b.ballots.push(ballot("BC-AAAA-0001"));
        b.ballots.push(ballot("BC-BBBB-0002"));
        save(&path, &b).unwrap();

        let result = verify_tracking_code_impl(&path, "BC-BBBB-0002").expect("verify");
        let found = result.expect("found");
        assert_eq!(found.tracking_code, "BC-BBBB-0002");
        assert_eq!(found.ballot_index, 1);
        assert_eq!(found.submitted_at, "2026-06-08T21:14:00Z");
    }

    #[test]
    fn verify_tracking_code_impl_returns_none_for_missing_code() {
        let (_dir, path) = tmp_path();
        let mut b = Bulletin::empty();
        b.ballots.push(ballot("BC-AAAA-0001"));
        save(&path, &b).unwrap();

        let result = verify_tracking_code_impl(&path, "BC-9999-9999").expect("verify");
        assert!(result.is_none());
    }

    #[test]
    fn verify_tracking_code_impl_returns_none_for_empty_bulletin() {
        let (_dir, path) = tmp_path();
        let result = verify_tracking_code_impl(&path, "BC-AAAA-0001").expect("verify");
        assert!(result.is_none());
    }

    /// Cross-language fingerprint fixture.
    /// The TS counterpart in `apps/auditor/src/lib/tally.test.ts` asserts the
    /// same fingerprint for the same logical input. Any change here must be
    /// mirrored there.
    #[test]
    fn cross_language_fingerprint_fixture() {
        let mut results: BTreeMap<String, RaceResult> = BTreeMap::new();
        results.insert(
            "president".to_string(),
            RaceResult {
                candidates: vec![CandidateResult {
                    id: "a".into(),
                    name: "Alice".into(),
                    party: "Lakas".into(),
                    votes: 10,
                    elected: true,
                }],
            },
        );
        results.insert(
            "vp".to_string(),
            RaceResult {
                candidates: vec![CandidateResult {
                    id: "b".into(),
                    name: "Bob".into(),
                    party: "Liberal".into(),
                    votes: 5,
                    elected: false,
                }],
            },
        );
        let fp = bulletin_store::results_fingerprint(&results);
        assert_eq!(
            fp,
            CROSS_LANG_FINGERPRINT,
            "Rust fingerprint must match the hard-coded value used in tally.test.ts"
        );
    }

    /// Sanity check: verify_tracking_code_impl works even when a tally has been
    /// published (auditor still wants ballot lookup post-tally).
    #[test]
    fn verify_tracking_code_impl_works_with_tally_present() {
        let (_dir, path) = tmp_path();
        let mut b = Bulletin::empty();
        b.ballots.push(ballot("BC-CAFE-0001"));
        b.tally = Some(Tally {
            results: BTreeMap::new(),
            fingerprint: "sha256:placeholder".into(),
            trustees_signed: 3,
            trustees_total: 5,
            closed_at: "2026-06-08T23:59:00Z".into(),
        });
        save(&path, &b).unwrap();

        let found = verify_tracking_code_impl(&path, "BC-CAFE-0001")
            .expect("verify")
            .expect("found");
        assert_eq!(found.ballot_index, 0);
    }

    /// Hard-coded fingerprint computed from
    /// `crates/bulletin-store::results_fingerprint` against the
    /// `cross_language_fingerprint_fixture` input. Mirrored in
    /// `apps/auditor/src/lib/tally.test.ts`.
    const CROSS_LANG_FINGERPRINT: &str =
        "sha256:06da800e0783cc671ea02ba669728085a430a1a22c1956363293bfd746510682";
}
