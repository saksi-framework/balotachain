# Adviser items 5 and 6 (W2 #2, W3 #10)

Written 2026-10-01 against saksi `4a38a54` (the study build; WSL binary `saksi-demo` SHA-256 `112fffa0…`, the
one every Chapter 4 run used). This is a report only: no code or scenarios were changed.

Sources read:
- the consultation records (Week 2 #2, Week 3 #10);
- the paper text: §Security p54–55, Table 3.8 (T1–T8), Table 3.9 (threat matrix) p56–57, Table 3.10 p57–58,
  Appendix A p66–67;
- in saksi:
  - `packages/saksi-campaign/scenarios.go`;
  - `packages/saksi-auditor/src/{security_privacy,tests,independent_verification,demo,stream,fixtures,ground_truth}.rs`;
  - `packages/saksi-bulletin/chaincode/*_test.go`;
- the run notes on `docs/ch4-study-2026-09-30` (`docs/desktop-runs/2026-09-30-sp-10k-security.md`) and
  `docs/ch4-night1-2026-10-01` (`docs/desktop-runs/2026-10-01-mp-1k-security.md`), plus `ch4-gap.md`.

All saksi paths below are relative to `Q:\Code - LAPTOP\Code\projects\saksi\packages\`.

---

## Item 5: adversary-class coverage (W2 #2)

The adviser asked that every adversary class have a matching test. The paper names eight classes:
- Table 3.9 has six rows: malicious voter, compromised client, malicious trustees (up to two), network
  adversary, ledger administrator and external attacker.
- p54–55 and Table 3.10 add a **malicious administrator** who manipulates the manifest, and a **privacy
  adversary** who attempts voter-ballot linkage.
- The **malicious bulletin-board node** of p55 and Table 3.10 is the same party as Table 3.9's ledger
  administrator, so it is folded into that row.

### Evidence levels used below

| Level | Meaning |
|---|---|
| **Live** | A real submission to the chaincode during a running election in a study security run. The chaincode's own gate refused it. |
| **Sim** | Mounted in a study security run against a *copy* of the run. The independent auditor scored the attack. Nothing was submitted to the ledger. |
| **Unit** | An auditor (Rust) or chaincode (Go) unit test. It ran in the test suites, not in a study run. |

Both study security runs were on saksi `4a38a54`:
- **SP-10K** run `sp-10k-ch4-sec-20260929-183410-129`;
- **MP-1K** run `mp-1k-ch4-sec-20260930-185139-29`, with 3 positions.

Each run recorded the same verdicts: 8 PASS at the declared gate, 1 SKIPPED, 0 FAIL. Five of the PASS verdicts
were live and three were simulated.

### Coverage table

| # | Class (paper) | Attack-catalogue entries (`saksi-campaign/scenarios.go`) | Auditor tests (`saksi-auditor/src/`) | Chaincode tests (`saksi-bulletin/chaincode/`) | Study runs | Verdict on coverage |
|---|---|---|---|---|---|---|
| 1 | **Malicious voter**: double vote, malformed ballot, overvote, self-issued credential | `reused-nullifier` (176), `tamper-ballot-proof` (162), `corrupted-ballot-bytes` (231), `overvote` (304), `self-issued-credential` (293) | `tests.rs:59` per_position_double_vote_is_caught; `tests.rs:208` reused_nullifier_is_caught; `tests.rs:160` tampered_ballot_cds_proof_is_caught; `tests.rs:606` overvote_is_caught_by_selection_sum; `tests.rs:624` tampered_selection_proof_is_caught; `tests.rs:444` wrong_issuer_pk_is_caught; `demo.rs:996` forged_self_issued_ballot_passes_the_chain_checks_and_fails_issuer_binding; `demo.rs:1041` overvote_ballot_passes_cds_and_fails_selection_sum; `stream.rs:631` the_chunk_gate_rejects_a_replayed_nullifier | `contract_test.go:294` TestSubmitBallotRejectsDoubleVote; `:315` …RejectsTamperedCDSProof; `:261` TestSubmitBallotIssuerBinding; `:414` …RejectsBadHex; `:426` …RejectsMissingNullifier; `:441` …RejectsMalformedCiphertext; `:394` …RejectsUnknownPosition; `:352` …RejectsContestCountMismatch; `selection_test.go:143` TestSubmitBallotSelectionProof; `selection_test.go:192` TestSubmitBallotRefusesAnEmptyPositionOnAPositionedElection; `contract_test.go:1256` TestLiveAttackMutationsMeetTheirDeclaredGateFirst | **Live** in both runs: all five entries were refused by their declared gate (`nullifier`, `cds`, `decode`, `selection`, `issuer`). MP-1K adds the per-position check: 3,000 records with distinct per-position nullifiers were all accepted, and a copied nullifier was refused. | **Strong.** The paper's "expired credential" case is uncovered (see the flags below). |
| 2 | **Compromised client**: substituted proof, altered ciphertext, credential misuse | `tamper-ballot-proof` (162) is the substituted proof; `corrupted-ballot-bytes` (231) is wire corruption, not a well-formed altered ciphertext | `tests.rs:179` tampered_credential_presentation_proof_is_caught; `tests.rs:160`; `independent_verification.rs:56` tamper_ballot_proof_detected | `contract_test.go:707` TestSubmitBallotRejectsBadCredentialSignature; `:441` …RejectsMalformedCiphertext; `:315` | **Live**: `tamper-ballot-proof` and `corrupted-ballot-bytes` in both runs | **Partial.** No test alters a ciphertext to a different *valid* point while keeping the old proof. The CDS gate would catch it, but nothing exercises that case. Credential misuse is covered by unit tests only. Table 3.9's "client holds no key material" is a design claim with no test. |
| 3 | **Malicious trustees (up to two)**: corrupt or withhold partials, sub-threshold decryption | `tamper-partial-decryption` (245) is the corrupt partial; `tamper-dkg-transcript` (268) is the corrupt DKG commitment | `security_privacy.rs:112` sub_threshold_decryption_fails_but_full_threshold_succeeds; `tests.rs:306` under_threshold_decryptions_are_caught; `tests.rs:343` under_threshold_with_canonical_layout_is_caught; `tests.rs:251` tampered_partial_decryption_share_is_caught; `tests.rs:276` tampered_chaum_pedersen_response_is_caught; `tests.rs:766` duplicate_partial_decryption_for_contest_is_caught; `tests.rs:749` partial_decryption_with_unknown_contest_id_is_caught; `tests.rs:938` below_threshold_tally_signatures_are_caught; `independent_verification.rs:125` tamper_partial_decryption_detected; `independent_verification.rs:141` tamper_dkg_transcript_detected; `tests.rs:712` dkg_transcript_trustee_count_mismatch_is_caught | `contract_test.go:1091` TestPublishTallyRejectsBelowThreshold; `:1104` …RejectsDuplicateTrusteeSignature; `:1117` …RejectsUnknownTrusteeSignature; `:869` TestSubmitPartialDecryptionRejectsMalformedShareOrMissingProof; `:837` …RejectsUnknownContestOrTrustee; `:657` TestPublishDKGTranscriptRejectsThresholdMismatch | **Sim** in both runs: `tamper-partial-decryption` was caught by `decryption.cp_proof` and `tamper-dkg-transcript` by `dkg.decode`. **Live, incidentally**: in both runs only trustees 1–3 submitted, so two withheld and the tally still published with 3 of 3. No run attempted a sub-threshold publish. | **Weak on-chain.** The chaincode checks a partial's proof for presence only and a DKG transcript for shape only. Both corruption attacks are therefore simulated: the paper's expected "invalid partial committed, then detected" is shown on a copy, never on the ledger. Sub-threshold decryption is covered by unit tests only, plus the console's quorum gate (`saksi-campaign/ceremony.go:41`). |
| 4 | **Network adversary**: interception, replay | `reused-nullifier` (176) is the replay as a duplicate nullifier | `tests.rs:208`; `stream.rs:631`; `security_privacy.rs:176` on_chain_ballot_record_carries_no_voter_identity | `contract_test.go:294`, which resubmits the identical ballot bytes (exact replay) | **Live**: `reused-nullifier` in both runs | **Replay: covered.** **Interception: no test.** Table 3.9 states that the console serves plain HTTP with no transport encryption, and no test observes traffic. "No plaintext observable" rests on ciphertext semantics and the structural privacy test, not on an interception experiment. |
| 5 | **Ledger administrator / malicious BB node**: drop, reorder, tamper, front-run | `dropped-ballot` (193); `reordered-ballots` (215), which is never mounted | `security_privacy.rs:41` malicious_bb_node_dropping_a_committed_ballot_is_detected; `security_privacy.rs:73` malicious_bb_node_reordering_ballots_is_not_detected_and_leaves_the_tally_unchanged; `independent_verification.rs:88` dropped_ballot_detected; `independent_verification.rs:72` tamper_tally_total_detected; `tests.rs:381` wrong_tally_is_caught; `tests.rs:889` tampered_tally_signature_is_caught; `stream.rs:659` a_corrupt_ballot_line_fails_the_stream_audit | `contract_test.go:1175` TestPublishTallyRejectsTamperedTotals; `:1137` …RejectsSignatureOverOtherTotals; `:643` TestPublishDKGTranscriptRejectsDuplicate and `:855` TestSubmitPartialDecryptionRejectsDuplicate, which show the front-running lock-out | **Sim**: `dropped-ballot` was caught by `stream.completeness` in both runs. **SKIPPED**: `reordered-ballots` (no gate). Every study run also re-reads the ledger and checks `ledger_matches_local = true`, which is passive evidence against tampering. | **Weak and simulated only.** No attack is made by an actual peer or orderer operator: drop is shown on an audited copy, and reorder is a documented gap (undetected, with no effect on the order-independent tally). Front-running a DKG transcript or partial decryption is **not prevented**: the chaincode never authorises callers, and the console does not mount it. Table 3.9 states this as a limitation. |
| 6 | **External attacker**: no credentials; unauthorised submission, forged identity | `self-issued-credential` (293) is the forged credential, but the attacker in it has channel access | `tests.rs:444`, `tests.rs:482` parameters_issuer_mismatch_is_caught; `demo.rs:996` | `contract_test.go:261`, `:707`, `:1320` TestCreateElectionValidatesTheIssuerKey | **Live**: `self-issued-credential` in both runs | **Membership service: uncovered.** No test submits from an identity outside the channel MSP. The chaincode never reads the caller identity: there is no `GetClientIdentity` or `cid` use outside `vendor/`. Fabric's MSP would refuse an unenrolled client, but this is assumed, not exercised. Only the forged-credential half has a test. |
| 7 | **Malicious administrator**: manipulate the manifest (p54–55, Table 3.10; no Table 3.9 row) | none; the catalogue has no manifest attack | `security_privacy.rs:149` malicious_admin_altering_a_contest_id_is_detected; `tests.rs:402` bad_parameters_version_is_caught; `tests.rs:423` empty_contests_is_caught; `tests.rs:444` wrong_issuer_pk_is_caught; `tests.rs:482`; `tests.rs:501` parameters_without_issuer_key_are_flagged; `tests.rs:712` | `contract_test.go:515` TestCreateElectionRejectsDuplicate; `:529` …RejectsBadThreshold; `:540` …RejectsEmptyContestsOrTrustees; `:553` …RejectsMissingIDOrWrongVersion; `:1320` | **None.** No study run mounts a manifest attack. | **Unit tests only.** T4 lists "manipulated manifests" as a test input, but no catalogue entry or live run carries one. The class also has no row in Table 3.9, although the text says every class has one. |
| 8 | **Privacy adversary**: voter-ballot linkage, ballot secrecy (p54, Table 3.10) | none | `security_privacy.rs:176` on_chain_ballot_record_carries_no_voter_identity; `security_privacy.rs:226` only_the_aggregate_is_decrypted_never_an_individual_ballot; `security_privacy.rs:259` privacy_linkage_attempt_fails_over_the_anonymity_set; threshold secrecy as in row 3 | none | **None.** The linkage join has not been run over a tier export (`ch4-gap.md`, "Needs analysis"). | **Weak.** The tests are structural and use a 5-voter fixture. Timing, metadata and submitter-identity linkage are out of scope. Credential issuance is simulated. Two ballots from the same credential share a commitment, so they are linkable to each other but not to an identity (`security_privacy.rs:318` comment). |

### Flags

**No test at all:**
- **Network interception.** There is no experiment, and the transport is plain HTTP.
- **External attacker outside the MSP.** No test submits from an unenrolled identity, and the chaincode does no
  caller check.
- **Expired credential.** p55 and T5 list it, but the code has no expiry concept: no `expir` appears in saksi
  outside `vendor/`.
- **Front-running a DKG transcript or partial decryption.** It is not tested as an attack and not prevented. Two
  chaincode tests show the duplicate lock-out it relies on, and the paper states it as a limitation.
- **Ballot reordering.** The scenario exists but has no gate, so it is SKIPPED by design. The auditor test at
  `security_privacy.rs:73` documents that reordering is undetected and has no effect on the tally.

**Weak, or simulated only:**
- **Malicious trustees.** The corrupt partial and corrupt DKG commitment are simulated, because on-chain checks
  are shape-only. Sub-threshold decryption is unit-tested only.
- **Ledger administrator.** Drop is simulated. No actual peer or orderer operator attack is made.
- **Malicious administrator.** Covered by unit tests only, with no catalogue entry and no Table 3.9 row.
- **Privacy adversary.** Structural tests on a 5-voter fixture, with no tier-scale linkage join.
- **Compromised client.** No valid-point ciphertext substitution test, and "client holds no key material" is not
  tested.

**Strong:**
- **Malicious voter.** Five live gates, in both a single-position and a multi-position run.

---

## Item 6: ground-truth numbers and the selection rule (W3 #10)

### Command (the actual code path)

The study build's binary is `saksi-demo` in WSL at saksi `4a38a54`, SHA-256 `112fffa0124943a4…`. This is the binary
whose hash the run notes record. Its `gen-ground-truth` subcommand is the plaintext-only path. It writes the same
population `gen` would, through the same `SelectionPlan` (`saksi-demo/src/main.rs:235`,
`saksi-auditor/src/ground_truth.rs:103`). The Windows `target/release/saksi-demo.exe` dates from 2026-09-15 and is
stale, so it was not used.

```
wsl.exe -e bash -lc 'D=~/Code/saksi/target/release/saksi-demo; for d in uniform skewed realistic; do \
  $D gen-ground-truth --voters 500 --positions 1 --candidates 4 --distribution $d --out-dir /tmp/gt500-$d; \
  cat /tmp/gt500-$d/ground-truth-summary.csv; done'
```

### Counts: single position, 500 voters, 4 candidates

| Candidate | uniform | skewed | realistic |
|---|---|---|---|
| CAND_PRES_01 | 125 | 250 | **245** |
| CAND_PRES_02 | 125 | 84 | **90** |
| CAND_PRES_03 | 125 | 83 | **85** |
| CAND_PRES_04 | 125 | 83 | **80** |
| Total | 500 | 500 | 500 |

### What changed, and what did not

The tie-breaking change did **not** modify uniform or skewed. It added a third profile, `realistic`, which every
Chapter 4 study run uses: `run.json` reads `realistic`, and the console's campaign repetitions hard-code it at
`saksi-campaign/repeat.go:700`. The two original profiles are unchanged, and the test
`fixtures.rs:1477 existing_profiles_are_untouched` pins them.

So Appendix A's **250 / 84 / 83 / 83 is still correct as the skewed profile's output**. It is no longer the
distribution the study measures. The study's 500-voter single-position equivalent is **245 / 90 / 85 / 80**.

The manuscript needs three amendments:
- Appendix A's "two deterministic profiles" should read three, and the sample table should show `realistic`, or
  sit beside it.
- The "pure arithmetic function of the voter index, position index, candidate count, and distribution profile"
  sentence should add **the voter count V**. `realistic` apportions quotas over the whole electorate, and its
  voter-to-bracket mapping uses a stride derived from V.
- The paper should state that `realistic` was introduced in de79b0f and simplified to "skewed plus a reserved
  slice" in 3d8797e.

### The selection rule as implemented

**Uniform** (`fixtures.rs:665`). Voter `v` picks candidate `(v + p) mod C` for position `p`.

**Skewed** (`fixtures.rs:667`). Even-indexed voters pick candidate 0. An odd-indexed voter picks
`1 + ((v/2 + p) mod (C−1))`. Every loser therefore ends level, which is the tie the change removes.

**Realistic** (`fixtures.rs:497` `realistic_quotas`). The candidate counts for each position are computed first,
then voters are assigned to them:

1. **Reserved share** (`fixtures.rs:506`): `pct = 10 + 5·(p mod 3)`. That is 10 % for the president, 15 % for the
   vice-president and 20 % for the senator, then the cycle repeats.
2. **Floor 1, the reserve floor** (`fixtures.rs:507`):
   - `reserve = min(V, max(⌊V·pct/100⌋, C·(C+1)))`;
   - the reserve is never smaller than C(C+1), two votes per adjacent rank, so the spread cannot be finer than the
     round-robin's own one-vote wobble.
3. **Base allocation** (`fixtures.rs:508–514`). The first `V − reserve` voters vote exactly by the skewed rule.
   The reserved voters are taken out of the electorate, not added, so every voter still votes once and the
   position total equals V.
4. **Apportion the reserve down the ranks** (`fixtures.rs:518–527`):
   - the weights are `w_k = C − k` (4, 3, 2, 1 for four candidates);
   - each candidate first gets `⌊reserve·w_k / Σw⌋`;
   - the integer remainder is dealt out one vote at a time from rank 0 upward (`a[k mod C] += 1`).
   All of this is integer arithmetic, so the result is the same on every machine.
5. **Floor 2, the winner floor** (`fixtures.rs:532`). If `q[0] ≤ q[1]` after apportionment, one vote moves from the
   lowest-ranked candidate holding any to candidate 0. This guarantees a clear winner even when V is too small for
   the apportionment to separate the top two, and the sum stays exactly V.
6. **Voter placement** (`fixtures.rs:638–640`, `SelectionPlan::select`):
   - voter `v` maps to `r = (v·stride + p) mod V`, where the stride is a golden-ratio step made coprime to V
     (`interleave_stride`), so the map is a permutation;
   - the voter takes the first cumulative-quota bracket greater than `r`;
   - the counts are exactly the quotas, and the ballot table reads as a mixed electorate rather than sorted runs.

Worked example for V = 500, C = 4, p = 0:
- reserve = max(50, 20) = 50, so 450 base voters;
- the skewed rule over 450 voters gives 225 / 75 / 75 / 75;
- apportioning the reserve by 4:3:2:1 adds 20 / 15 / 10 / 5;
- the result is 245 / 90 / 85 / 80;
- floor 2 does not trigger, since 245 > 90.

The tests that pin the rule:
- `fixtures.rs:1370` there_is_always_a_clear_winner;
- `fixtures.rs:1388` counts_strictly_decrease_once_the_electorate_can_afford_it, which asserts from V ≥ C(C+1);
- `fixtures.rs:1415` positions_usually_differ_but_it_is_not_guaranteed;
- `fixtures.rs:1456` the_plan_realizes_its_quotas_exactly;
- `fixtures.rs:1477` existing_profiles_are_untouched.
