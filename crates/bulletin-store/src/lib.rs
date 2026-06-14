//! File-backed bulletin store for the BalotaChain one-voter demo.
//! Schema: see `docs/bulletin-store-schema.md`.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct Bulletin {
    pub version: u32,
    #[serde(default)]
    pub election: Option<Election>,
    #[serde(default)]
    pub voters: Vec<Voter>,
    #[serde(default)]
    pub credentials: Vec<Credential>,
    #[serde(default)]
    pub ballots: Vec<Ballot>,
    #[serde(default)]
    pub partial_decryptions: Vec<PartialDecryption>,
    #[serde(default)]
    pub tally: Option<Tally>,
}

impl Bulletin {
    pub fn empty() -> Self {
        Self {
            version: SCHEMA_VERSION,
            election: None,
            voters: vec![],
            credentials: vec![],
            ballots: vec![],
            partial_decryptions: vec![],
            tally: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Election {
    pub id: String,
    pub name: String,
    pub opens: String,
    pub closes: String,
    pub joint_public_key: String,
    pub trustees: Vec<TrusteeEntry>,
    pub threshold: u32,
    pub positions: Vec<Position>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TrusteeEntry {
    pub id: String,
    pub name: String,
    pub public_share: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Position {
    pub id: String,
    pub label: String,
    pub pick: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Voter {
    pub id: String,
    pub email: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Credential {
    pub voter_id: String,
    pub nullifier: String,
    pub token: String,
    pub issued_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Ballot {
    pub tracking_code: String,
    pub nullifier: String,
    pub ciphertext: Ciphertext,
    pub submitted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Ciphertext {
    pub pad: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PartialDecryption {
    pub trustee_id: String,
    pub ballot_index: usize,
    pub share: String,
    pub submitted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Tally {
    pub results: BTreeMap<String, RaceResult>,
    pub fingerprint: String,
    pub trustees_signed: u32,
    pub trustees_total: u32,
    pub closed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RaceResult {
    pub candidates: Vec<CandidateResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CandidateResult {
    pub id: String,
    pub name: String,
    pub party: String,
    pub votes: u64,
    #[serde(default)]
    pub elected: bool,
}

#[derive(Debug)]
pub enum StoreError {
    Io(std::io::Error),
    Parse(serde_json::Error),
    WrongVersion(u32),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::Io(e) => write!(f, "io: {}", e),
            StoreError::Parse(e) => write!(f, "parse: {}", e),
            StoreError::WrongVersion(v) => {
                write!(f, "bulletin schema version {} not supported", v)
            }
        }
    }
}

impl std::error::Error for StoreError {}

impl From<std::io::Error> for StoreError {
    fn from(value: std::io::Error) -> Self {
        StoreError::Io(value)
    }
}

impl From<serde_json::Error> for StoreError {
    fn from(value: serde_json::Error) -> Self {
        StoreError::Parse(value)
    }
}

pub fn default_path() -> PathBuf {
    let home = std::env::var_os("HOME").unwrap_or_default();
    PathBuf::from(home).join(".balotachain").join("bulletin.json")
}

pub fn load(path: &Path) -> Result<Bulletin, StoreError> {
    if !path.exists() {
        return Ok(Bulletin::empty());
    }
    let mut file = File::open(path)?;
    let mut buf = String::new();
    file.read_to_string(&mut buf)?;
    if buf.trim().is_empty() {
        return Ok(Bulletin::empty());
    }
    let bulletin: Bulletin = serde_json::from_str(&buf)?;
    if bulletin.version != SCHEMA_VERSION {
        return Err(StoreError::WrongVersion(bulletin.version));
    }
    Ok(bulletin)
}

pub fn save(path: &Path, bulletin: &Bulletin) -> Result<(), StoreError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp_path = path.with_extension("json.tmp");
    let mut tmp = File::create(&tmp_path)?;
    let body = serde_json::to_string_pretty(bulletin)?;
    tmp.write_all(body.as_bytes())?;
    tmp.sync_all()?;
    drop(tmp);
    fs::rename(&tmp_path, path)?;
    Ok(())
}

pub fn canonical_results_json(tally: &BTreeMap<String, RaceResult>) -> String {
    serde_json::to_string(tally).expect("BTreeMap<String, RaceResult> is serializable")
}

pub fn results_fingerprint(tally: &BTreeMap<String, RaceResult>) -> String {
    let json = canonical_results_json(tally);
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    let digest = hasher.finalize();
    format!("sha256:{}", hex::encode(digest))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn tmp_store() -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("bulletin.json");
        (dir, path)
    }

    #[test]
    fn load_nonexistent_returns_empty() {
        let (_dir, path) = tmp_store();
        let b = load(&path).unwrap();
        assert_eq!(b, Bulletin::empty());
    }

    #[test]
    fn load_empty_file_returns_empty() {
        let (_dir, path) = tmp_store();
        std::fs::write(&path, "").unwrap();
        let b = load(&path).unwrap();
        assert_eq!(b, Bulletin::empty());
    }

    #[test]
    fn save_then_load_roundtrip() {
        let (_dir, path) = tmp_store();
        let mut b = Bulletin::empty();
        b.voters.push(Voter {
            id: "v-000001".into(),
            email: "voter1@wmsu.edu.ph".into(),
            name: "Demo Voter".into(),
        });
        save(&path, &b).unwrap();
        let loaded = load(&path).unwrap();
        assert_eq!(loaded, b);
    }

    #[test]
    fn save_is_pretty_printed() {
        let (_dir, path) = tmp_store();
        save(&path, &Bulletin::empty()).unwrap();
        let body = std::fs::read_to_string(&path).unwrap();
        assert!(body.contains("\n  "), "expected pretty-printed JSON; got: {body}");
    }

    #[test]
    fn save_is_atomic_via_tmp_rename() {
        let (_dir, path) = tmp_store();
        save(&path, &Bulletin::empty()).unwrap();
        let tmp = path.with_extension("json.tmp");
        assert!(!tmp.exists(), "tmp file should be renamed away");
    }

    #[test]
    fn version_mismatch_errors() {
        let (_dir, path) = tmp_store();
        std::fs::write(&path, r#"{"version": 999}"#).unwrap();
        let err = load(&path).unwrap_err();
        assert!(matches!(err, StoreError::WrongVersion(999)));
    }

    #[test]
    fn fingerprint_is_deterministic_for_same_results() {
        let mut a = BTreeMap::new();
        a.insert(
            "president".to_string(),
            RaceResult {
                candidates: vec![CandidateResult {
                    id: "x".into(),
                    name: "X".into(),
                    party: "P".into(),
                    votes: 10,
                    elected: true,
                }],
            },
        );
        let f1 = results_fingerprint(&a);
        let f2 = results_fingerprint(&a);
        assert_eq!(f1, f2);
        assert!(f1.starts_with("sha256:"));
    }

    #[test]
    fn fingerprint_changes_when_votes_change() {
        let mut a = BTreeMap::new();
        a.insert(
            "president".to_string(),
            RaceResult {
                candidates: vec![CandidateResult {
                    id: "x".into(),
                    name: "X".into(),
                    party: "P".into(),
                    votes: 10,
                    elected: true,
                }],
            },
        );
        let mut b = a.clone();
        b.get_mut("president").unwrap().candidates[0].votes = 11;
        assert_ne!(results_fingerprint(&a), results_fingerprint(&b));
    }

    #[test]
    fn default_path_includes_home() {
        let p = default_path();
        assert!(p.ends_with(".balotachain/bulletin.json"));
    }
}
