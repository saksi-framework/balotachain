//! Integration tests for the balota-encrypt pure functions.
//! TDD: these were written before the implementations existed.

use bulletin_store::{
    Ballot, Bulletin, Ciphertext, Credential, Election, Position, TrusteeEntry, Voter, save,
};
use std::path::Path;
use tempfile::TempDir;

use balota_encrypt::{EncryptArgs, SubmitArgs, encrypt_impl, submit_ballot_impl};

const DEMO_PK_HEX: &str = "e00af9c74d9edb8ebcc160ceec97d531cbd6e2956f9e9162b8e9eda260e82e43";
// joint_public_key for keygen_from_scalar(42); computed via saksi-ffi-flutter.

fn seed_bulletin_with_election(path: &Path, public_key: &str) -> Bulletin {
    let mut b = Bulletin::empty();
    b.election = Some(Election {
        id: "e-1".into(),
        name: "WMSU 2026".into(),
        opens: "2026-06-14T00:00:00Z".into(),
        closes: "2026-06-15T00:00:00Z".into(),
        joint_public_key: public_key.into(),
        trustees: vec![TrusteeEntry {
            id: "t1".into(),
            name: "T1".into(),
            public_share: "00".repeat(32),
        }],
        threshold: 1,
        positions: vec![Position {
            id: "president".into(),
            label: "President".into(),
            pick: 1,
        }],
    });
    b.voters.push(Voter {
        id: "v-000001".into(),
        email: "v1@wmsu.edu.ph".into(),
        name: "Demo Voter".into(),
    });
    b.credentials.push(Credential {
        voter_id: "v-000001".into(),
        nullifier: "ab".repeat(32),
        token: "cd".repeat(16),
        issued_at: "2026-06-14T00:00:00Z".into(),
    });
    save(path, &b).expect("seed save");
    b
}

#[test]
fn encrypt_impl_returns_hex_pad_and_data() {
    let out = encrypt_impl(EncryptArgs {
        public_key: DEMO_PK_HEX.to_string(),
        choice: 1,
        randomness: 99,
    })
    .expect("encrypt succeeds");
    assert_eq!(out.pad.len(), 64);
    assert_eq!(out.data.len(), 64);
    assert!(out.pad.chars().all(|c| c.is_ascii_hexdigit()));
    assert!(out.data.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn encrypt_impl_errors_on_bad_public_key() {
    let err = encrypt_impl(EncryptArgs {
        public_key: "not-hex".to_string(),
        choice: 1,
        randomness: 1,
    })
    .unwrap_err();
    assert!(!err.is_empty());
}

#[test]
fn submit_ballot_errors_when_no_election() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("bulletin.json");
    save(&path, &Bulletin::empty()).unwrap();
    let err = submit_ballot_impl(
        &path,
        SubmitArgs {
            voter_id: "v-000001".into(),
            token: "cd".repeat(16),
            choice: 1,
        },
    )
    .unwrap_err();
    assert!(
        err.contains("election"),
        "expected election error, got: {err}"
    );
}

#[test]
fn submit_ballot_errors_when_voter_unknown() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("bulletin.json");
    seed_bulletin_with_election(&path, DEMO_PK_HEX);
    let err = submit_ballot_impl(
        &path,
        SubmitArgs {
            voter_id: "v-999999".into(),
            token: "cd".repeat(16),
            choice: 1,
        },
    )
    .unwrap_err();
    assert!(
        err.contains("credential"),
        "expected credential error, got: {err}"
    );
}

#[test]
fn submit_ballot_appends_one_ballot_on_happy_path() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("bulletin.json");
    seed_bulletin_with_election(&path, DEMO_PK_HEX);
    let result = submit_ballot_impl(
        &path,
        SubmitArgs {
            voter_id: "v-000001".into(),
            token: "cd".repeat(16),
            choice: 0x010203,
        },
    )
    .expect("submit succeeds");

    // Tracking code format BC-XXXX-XXXX, uppercase hex.
    assert!(
        result.tracking_code.starts_with("BC-"),
        "got {}",
        result.tracking_code
    );
    assert_eq!(result.tracking_code.len(), 3 + 4 + 1 + 4); // "BC-" + 4 + "-" + 4
    let after = &result.tracking_code[3..];
    let parts: Vec<&str> = after.split('-').collect();
    assert_eq!(parts.len(), 2);
    for p in &parts {
        assert_eq!(p.len(), 4);
        assert!(p.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()));
    }

    let b = bulletin_store::load(&path).unwrap();
    assert_eq!(b.ballots.len(), 1);
    assert_eq!(b.ballots[0].tracking_code, result.tracking_code);
    assert_eq!(b.ballots[0].nullifier, "ab".repeat(32));
    assert_eq!(b.ballots[0].submitted_at, result.submitted_at);
    assert_eq!(b.ballots[0].ciphertext.pad.len(), 64);
    assert_eq!(b.ballots[0].ciphertext.data.len(), 64);
}

#[test]
fn submit_ballot_regenerates_tracking_code_on_collision() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("bulletin.json");
    let mut seed = seed_bulletin_with_election(&path, DEMO_PK_HEX);

    // Pre-seed the bulletin with every conceivable tracking code EXCEPT one
    // would be infeasible. Instead, we pre-seed with a small, deterministic
    // colliding code and prove that the implementation does not produce a
    // duplicate. With OsRng the collision is astronomically unlikely, so the
    // strongest assertion we can make here is: the returned tracking code is
    // not present in the pre-seeded ballots, AND the saved ballot list contains
    // both pre-seed + new.
    seed.ballots.push(Ballot {
        tracking_code: "BC-0000-0000".into(),
        nullifier: "ff".repeat(32),
        ciphertext: Ciphertext {
            pad: "00".repeat(32),
            data: "00".repeat(32),
        },
        submitted_at: "2026-06-14T00:00:00Z".into(),
    });
    save(&path, &seed).unwrap();

    let result = submit_ballot_impl(
        &path,
        SubmitArgs {
            voter_id: "v-000001".into(),
            token: "cd".repeat(16),
            choice: 1,
        },
    )
    .expect("submit succeeds");

    assert_ne!(result.tracking_code, "BC-0000-0000");
    let b = bulletin_store::load(&path).unwrap();
    assert_eq!(b.ballots.len(), 2);
    assert!(b.ballots.iter().any(|x| x.tracking_code == "BC-0000-0000"));
    assert!(
        b.ballots
            .iter()
            .any(|x| x.tracking_code == result.tracking_code)
    );
}
