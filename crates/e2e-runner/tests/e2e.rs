use bulletin_store::load;
use e2e_runner::run_one_voter_cycle;
use tempfile::TempDir;

#[test]
fn one_voter_cycle_populates_every_section_of_the_bulletin() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("bulletin.json");

    let outcome = run_one_voter_cycle(&path).expect("cycle should complete");
    let bulletin = load(&path).expect("bulletin should be loadable");

    assert!(bulletin.election.is_some(), "election must be present");
    let election = bulletin.election.as_ref().unwrap();
    assert_eq!(election.id, "bc-2028-ph");
    assert_eq!(election.trustees.len(), 5);
    assert_eq!(election.threshold, 3);

    assert_eq!(bulletin.voters.len(), 1, "one voter registered");
    assert_eq!(bulletin.voters[0].id, "v-000001");

    assert_eq!(bulletin.credentials.len(), 1, "one credential issued");
    assert_eq!(bulletin.credentials[0].voter_id, "v-000001");
    assert!(
        bulletin.credentials[0].nullifier.starts_with("sha256:"),
        "nullifier must be sha256-prefixed"
    );
    assert_eq!(
        bulletin.credentials[0].token.len(),
        32,
        "16-byte token = 32 hex chars"
    );

    assert_eq!(bulletin.ballots.len(), 1, "one ballot submitted");
    let ballot = &bulletin.ballots[0];
    assert!(ballot.tracking_code.starts_with("BC-"));
    assert_eq!(ballot.ciphertext.pad.len(), 64, "ristretto255 point is 32 bytes = 64 hex");
    assert_eq!(ballot.ciphertext.data.len(), 64);
    assert_eq!(
        ballot.nullifier, bulletin.credentials[0].nullifier,
        "ballot nullifier must match credential"
    );

    assert_eq!(
        bulletin.partial_decryptions.len(),
        1,
        "one partial decryption per ballot from the one trustee that submitted"
    );
    assert_eq!(bulletin.partial_decryptions[0].trustee_id, "t03");
    assert_eq!(bulletin.partial_decryptions[0].ballot_index, 0);

    assert!(bulletin.tally.is_some(), "demo tally written for auditor display");
    let tally = bulletin.tally.as_ref().unwrap();
    assert!(tally.fingerprint.starts_with("sha256:"));
    assert_eq!(tally.trustees_total, 5);
    assert!(tally.results.contains_key("president"));
    assert!(tally.results.contains_key("vp"));
    assert!(tally.results.contains_key("senators"));

    assert_eq!(outcome.tracking_code, ballot.tracking_code);
    assert_eq!(outcome.fingerprint, tally.fingerprint);
}

#[test]
fn cycle_is_idempotent_on_re_run_in_a_fresh_dir() {
    let dir1 = TempDir::new().unwrap();
    let dir2 = TempDir::new().unwrap();
    let r1 = run_one_voter_cycle(&dir1.path().join("bulletin.json")).unwrap();
    let r2 = run_one_voter_cycle(&dir2.path().join("bulletin.json")).unwrap();
    assert_eq!(r1.fingerprint, r2.fingerprint, "deterministic tally fingerprint");
}
