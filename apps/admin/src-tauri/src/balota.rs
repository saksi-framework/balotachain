//! Tauri commands for the Admin wizard. Bridges the React UI to the
//! `bulletin-store` crate so each wizard step writes the real bulletin.
//!
//! Plain `*_impl` functions take an injected [`BulletinSource`] so they are
//! testable without touching real state, and so the same code works whether the
//! backend is the local file or the containerized gateway. The
//! `#[tauri::command]` wrappers resolve [`BulletinSource::from_env`] (file
//! unless `BALOTA_BULLETIN_URL` is set) and delegate.

use bulletin_store::{
    Bulletin, BulletinSource, Credential, Election, Position, TrusteeEntry, Voter,
};
use rand::Rng;
use sha2::{Digest, Sha256};

const ELECTION_ID: &str = "bc-2028-ph";
const THRESHOLD: u32 = 3;

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// SHA-256 stub for cryptographic material (joint public key, public shares).
/// Real proofs land in Saksi later; for the demo we just hash deterministic
/// inputs and truncate to 32 bytes (64 hex chars) so the schema is satisfied.
fn sha_stub(inputs: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for s in inputs {
        hasher.update(s.as_bytes());
    }
    hex::encode(hasher.finalize())
}

fn default_trustees(election_name: &str, opens: &str) -> Vec<TrusteeEntry> {
    (1..=5)
        .map(|i| {
            let id = format!("t{:02}", i);
            let public_share = sha_stub(&[election_name, opens, &id]);
            TrusteeEntry {
                id,
                name: format!("Trustee {}", i),
                public_share,
            }
        })
        .collect()
}

pub fn load_bulletin_impl(store: &BulletinSource) -> Result<Bulletin, String> {
    store.load().map_err(|e| e.to_string())
}

pub fn create_election_impl(
    store: &BulletinSource,
    name: String,
    opens: String,
    closes: String,
    positions: Vec<Position>,
) -> Result<Bulletin, String> {
    let mut bulletin = store.load().map_err(|e| e.to_string())?;
    let joint_public_key = sha_stub(&[&name, &opens]);
    let trustees = default_trustees(&name, &opens);
    bulletin.election = Some(Election {
        id: ELECTION_ID.into(),
        name,
        opens,
        closes,
        joint_public_key,
        trustees,
        threshold: THRESHOLD,
        positions,
    });
    store.save(&bulletin).map_err(|e| e.to_string())?;
    Ok(bulletin)
}

pub fn register_voter_impl(
    store: &BulletinSource,
    voter_id: String,
    email: String,
    name: String,
) -> Result<Bulletin, String> {
    let mut bulletin = store.load().map_err(|e| e.to_string())?;
    bulletin.voters.push(Voter {
        id: voter_id,
        email,
        name,
    });
    store.save(&bulletin).map_err(|e| e.to_string())?;
    Ok(bulletin)
}

pub fn issue_credential_impl(store: &BulletinSource, voter_id: String) -> Result<Bulletin, String> {
    let mut bulletin = store.load().map_err(|e| e.to_string())?;
    if !bulletin.voters.iter().any(|v| v.id == voter_id) {
        return Err(format!("voter {} is not registered", voter_id));
    }
    let mut rng = rand::rngs::OsRng;
    let token_bytes: [u8; 16] = rng.r#gen();
    let token = hex::encode(token_bytes);
    let mut hasher = Sha256::new();
    hasher.update(voter_id.as_bytes());
    hasher.update(b":");
    hasher.update(token.as_bytes());
    let digest = hasher.finalize();
    let nullifier = format!("sha256:{}", hex::encode(digest));
    bulletin.credentials.push(Credential {
        voter_id,
        nullifier,
        token,
        issued_at: now_rfc3339(),
    });
    store.save(&bulletin).map_err(|e| e.to_string())?;
    Ok(bulletin)
}

#[tauri::command]
pub fn load_bulletin() -> Result<Bulletin, String> {
    load_bulletin_impl(&BulletinSource::from_env())
}

#[tauri::command]
pub fn create_election(
    name: String,
    opens: String,
    closes: String,
    positions: Vec<Position>,
) -> Result<Bulletin, String> {
    create_election_impl(&BulletinSource::from_env(), name, opens, closes, positions)
}

#[tauri::command]
pub fn register_voter(voter_id: String, email: String, name: String) -> Result<Bulletin, String> {
    register_voter_impl(&BulletinSource::from_env(), voter_id, email, name)
}

#[tauri::command]
pub fn issue_credential(voter_id: String) -> Result<Bulletin, String> {
    issue_credential_impl(&BulletinSource::from_env(), voter_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn tmp_store() -> (TempDir, BulletinSource) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bulletin.json");
        (dir, BulletinSource::File(path))
    }

    #[test]
    fn create_election_writes_to_bulletin() {
        let (_dir, store) = tmp_store();
        let updated =
            create_election_impl(&store, "x".into(), "y".into(), "z".into(), vec![]).expect("creates");
        assert!(updated.election.is_some());
        let reloaded = store.load().unwrap();
        assert!(reloaded.election.is_some());
        let e = reloaded.election.unwrap();
        assert_eq!(e.id, ELECTION_ID);
        assert_eq!(e.name, "x");
        assert_eq!(e.opens, "y");
        assert_eq!(e.closes, "z");
        assert_eq!(e.threshold, THRESHOLD);
        assert_eq!(e.trustees.len(), 5);
        assert_eq!(e.joint_public_key.len(), 64);
        for (i, t) in e.trustees.iter().enumerate() {
            assert_eq!(t.id, format!("t{:02}", i + 1));
            assert_eq!(t.public_share.len(), 64);
        }
    }

    #[test]
    fn register_voter_appends_one_voter() {
        let (_dir, store) = tmp_store();
        let updated = register_voter_impl(
            &store,
            "V-000001".into(),
            "voter1@wmsu.edu.ph".into(),
            "Demo Voter".into(),
        )
        .expect("registers");
        assert_eq!(updated.voters.len(), 1);
        assert_eq!(updated.voters[0].id, "V-000001");
        assert_eq!(updated.voters[0].email, "voter1@wmsu.edu.ph");
        assert_eq!(updated.voters[0].name, "Demo Voter");
        let reloaded = store.load().unwrap();
        assert_eq!(reloaded.voters.len(), 1);
    }

    #[test]
    fn issue_credential_errors_when_voter_not_registered() {
        let (_dir, store) = tmp_store();
        let err = issue_credential_impl(&store, "V-NOPE".into())
            .expect_err("should error when voter is absent");
        assert!(err.contains("V-NOPE"), "got: {err}");
    }

    #[test]
    fn issue_credential_produces_nullifier_and_32_hex_token() {
        let (_dir, store) = tmp_store();
        register_voter_impl(
            &store,
            "V-000001".into(),
            "voter1@wmsu.edu.ph".into(),
            "Demo Voter".into(),
        )
        .unwrap();
        let updated = issue_credential_impl(&store, "V-000001".into()).expect("issues");
        assert_eq!(updated.credentials.len(), 1);
        let c = &updated.credentials[0];
        assert_eq!(c.voter_id, "V-000001");
        // 16 random bytes -> 32 hex chars
        assert_eq!(c.token.len(), 32);
        assert!(
            c.token.chars().all(|ch| ch.is_ascii_hexdigit()),
            "token must be hex: {}",
            c.token
        );
        // sha256:<64 hex>
        assert!(c.nullifier.starts_with("sha256:"), "got: {}", c.nullifier);
        let hex_part = c.nullifier.trim_start_matches("sha256:");
        assert_eq!(hex_part.len(), 64);
        assert!(hex_part.chars().all(|ch| ch.is_ascii_hexdigit()));
        // issued_at parses as rfc3339
        assert!(
            chrono::DateTime::parse_from_rfc3339(&c.issued_at).is_ok(),
            "issued_at must be RFC3339: {}",
            c.issued_at
        );
    }
}
