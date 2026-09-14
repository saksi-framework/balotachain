# Instrument gap report — reviewer vs. code

An audit of the BalotaChain evaluation harness against what the manuscript
commits to, as summarised in `docs/BalotaChain_Defense_Reviewer.pdf` (21 pages,
extracted with `pdftotext -layout`, read in full). Page numbers below are
reviewer pages; manuscript pages are given in brackets where the reviewer cites
them.

This is an investigation. No source was modified. The plan in §4 is proposed,
not started.

**Scope rule I applied:** "the instrument" means measurement and procedure —
what is timed, counted, recorded, repeated, and how. Cryptographic claims are
out of scope except where the reviewer makes a specific implementation claim
that the code either backs or does not (§2).

---

## Headline

| Status | Count |
|---|---|
| SATISFIED | 14 |
| PARTIAL | 13 |
| MISSING | 11 |
| CONTRADICTED | 6 |

**The single most serious finding:** the only benchmark driver that exists
(`saksi/packages/saksi-bulletin/client-sdk/cmd/saksi-console`) writes an
Appendix-C CSV row whose `decrypt_ms`, `peak_cpu_pct`, `peak_mem_mb`, and all
five per-phase latency columns are **never assigned** — they are emitted as
zeros. A reader of that CSV would take "peak CPU 0%" as a measurement. It is
not. It is a struct default. See C2, C6, C14 in the matrix and the evidence at
`bench/driver.go:83–110`.

Close behind it: **nothing in the repository times anything inside the
cryptographic path.** There is no `Instant::now()` in `saksi-auditor`,
`saksi-demo`, or `saksi-crypto`, and no `time.Since` in the campaign console
outside run-creation timestamps. The four stage timers the paper commits to
(proof generation, proof verification, aggregation, threshold decryption) do
not exist in any form.

And the paper's own reproducibility example contradicts its generator: Appendix
A's 500-voter sample (142 / 119 / 131 / 108) is produced by none of the three
profiles the code ships.

---

## 1. Commitment matrix

Evidence paths are repo-relative: `saksi/…` or `balotachain/…`. Line numbers
were read from the tree at the time of writing.

### Data collection and validation

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| C1 | Synthetic record has fields `voter_id, position, credential, nullifier, selection, scale_group, ballot_complexity, ground_truth_tally` (Table 3.2) | p. 8 [38] | PARTIAL | `saksi/packages/saksi-auditor/src/ground_truth.rs:69`; `saksi/packages/saksi-campaign/csvexport.go:69` | No single artifact has that row shape. `ground-truth-ballots.csv` is wide (one row per voter, a column per position) with no credential/nullifier; `ballots.csv` carries nullifier + commitment but no selection or ground truth. Table 3.2 describes a schema that is split across two files with different grain. |
| C2 | One record per voter per position; a multi-position voter's records share `voter_id` with their own nullifier | p. 8 [37] | SATISFIED | `saksi/packages/saksi-auditor/src/fixtures.rs:646` (`multi_position_fixture`); verified on run `halalan-e2e-20260830-052031-1`: 3,300 lines for 1,100 × 3, `voter-0` at lines 1–3 with distinct nullifiers | — |
| C3 | Seven scale tiers: 1k / 10k / 50k / 483k / 1M / 1,921,917 / 3,524,078 | p. 8 [38] | PARTIAL | `saksi/packages/saksi-campaign/web/wizard.html` `PRESETS = [1,10,100,1000,10000,50000,483000,1000000,1921917,3524078]`; `saksi/packages/saksi-campaign/config.go:118` | Presets exist. But `offline` is capped at 10,000, `onchain` has never executed (§3), and `groundtruth` runs no cryptography. **No verified mode reaches 50,000 with the cryptographic path.** See §3, item 1. |
| C4 | Data-validation gate: four checks — complete/well-formed; identifiers *and nullifiers* unique; selections in candidate set; aggregate counts internally consistent | p. 8 [39] | PARTIAL | `saksi/packages/saksi-campaign/check.go:69` (`RunCheck`), `:143` (`recountBallots`), `:230` (`compareToSummary`) | Seven checks run, covering three of the four. **Nullifier uniqueness is not checked by the gate** — it runs on the plaintext CSV before any nullifier exists. Nullifier uniqueness is checked later, by the auditor (`nullifier.unique`). The paper places it in the gate. |
| C5 | Failing data is regenerated or corrected | p. 8 [39] | PARTIAL | `saksi/packages/saksi-campaign/web/wizard.html` — `next2b.disabled = !rep.pass` | Fail-closed: a failing population cannot proceed. Nothing regenerates or corrects; the operator starts over. Stronger than the paper on one axis, weaker on the other. |
| C6 | Ground-truth-only path reaches 3,524,078 without cryptographic cost | p. 8 | SATISFIED | `saksi/packages/saksi-auditor/src/ground_truth.rs:69`; `config.go` ceiling scoped to `Mode == "offline"` | Measured earlier this cycle at 0.6 s for 3.5M × 3. |

### Development discipline

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| C7 | Validation ladder: complete protocol validated end to end at 1, 10, 100, 1,000 **before any larger tier** | p. 9 [43] | MISSING | `grep -rn 'ladder' saksi/tools saksi/packages/saksi-campaign saksi/.github` → nothing | No script, no CI job, no console mode runs the ladder. CI runs a single 3-voter on-chain smoke (`balotachain/.github/workflows/ci.yml:278`). Nothing enforces "before any larger tier". |
| C8 | Traceability: version tags, dependency manifests, build/test/deploy instructions; any result traces to the exact commit | p. 9 [43] | PARTIAL | `saksi/docs/research-election-console-runbook.md`; `Cargo.lock`, `go.sum`; no tags | Manifests and instructions exist. **No result artifact records the commit it was produced by** — `run.json` holds `run_id, config, created_at` only (`saksi/packages/saksi-campaign/runstore.go:25–27`). A result cannot be traced to a commit from the result itself. |
| C9 | Three testing tiers (unit / integration / system at 1,000 voters) must pass before any experiment | p. 10 [45] | PARTIAL | 48 Rust tests, 89 Go console tests, 46 chaincode tests; `saksi/packages/saksi-bulletin/chaincode/contract_test.go` | Unit and integration coverage is real and broad. **The "system: full lifecycle at 1,000 voters" tier is not a test** — it was run by hand once this cycle (1,100 voters, offline). Nothing gates experiments on it. |
| C10 | Hardware: Apple M4 client, separate desktop hosts Fabric (Table 3.12: Ryzen 7 5700G, 32 GB, NVMe, LevelDB history off) | p. 10, 14 | MISSING | — | No environment is recorded anywhere (see C24). The stated topology has not been exercised: every run this cycle was single-machine, offline, Windows. |

### Evaluation matrix and experiments

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| C11 | Table 3.5: single-position and multi-position evaluated at every tier; 50k compared directly with [18]; both capstones committed | p. 10 [45] | MISSING | `saksi/packages/saksi-bulletin/caliper/benchmarks/ballot-submission.yaml:25–50` | Only two concrete rounds exist (1k single, 1k multi). Larger tiers are commented-out templates. Nothing ran above 1,100 voters with cryptography. |
| C12 | Table 3.6 RQ1(a): `E = Σ\|Tᵢ − Gᵢ\| = 0` at every tier via T1 | p. 10 [46] | SATISFIED (mechanism) | `saksi/packages/saksi-auditor/src/tally.rs:171`; `saksi/packages/saksi-campaign/executor.go` `writeCorrectnessCSV`; `correctness.csv` row `president/cand0,496,496,0,true` | The mechanism is real and verified at 1,100. "At every tier" is a run-coverage gap (C11), not an instrument gap. |
| C13 | RQ1(b,c): rejection rate via T4/T5, all invalid and duplicate rejected | p. 10 [46] | PARTIAL | `saksi/packages/saksi-campaign/scenarios.go` (`Registry`, 7 scenarios); `contract_test.go` 46 tests | Rejections are verdicts (PASS/FAIL per scenario), **not a rate**. Nothing computes "N of M invalid submissions rejected" as a number. T5's "each logged with its violated gate" — the chaincode error names the gate, and `negative-tests.csv` records `expected`/`actual`, so the gate is identifiable. |
| C14 | RQ3 latency: p50, p95, p99 per tier via T1/T2/T8 | p. 10 [46] | PARTIAL | `saksi/packages/saksi-bulletin/client-sdk/bench/metrics.go:37` (`Percentiles`, nearest-rank), `driver.go:31` (`Run`) | Percentiles exist **only in the legacy console driver**, which the wizard does not use and which has never run against a network here. The campaign console's on-chain submit path (`executor.go` `lifecycle`) records receipts but **no duration**. Nearest-rank p50/p95/p99 only; see C22 for the missing statistics. |
| C15 | RQ3 throughput: committed TPS per tier, with scaling limit | p. 10 [46] | PARTIAL | `bench/metrics.go:64` (`ThroughputTPS`) | Computed as committed ÷ wall-window in the legacy driver only. No scaling-limit comparison anywhere (C25). |
| C16 | RQ3 resources: CPU, memory, disk, network of peers, orderers, **clients**; plus success rate | p. 10 [46] | PARTIAL | Caliper `monitors` block, `ballot-submission.yaml:72–79` | Caliper's docker monitor lists `peer0.org1.example.com` and `orderer.example.com` — **no client**, no disk, no network. The Go harness has `PeakCPUPct`/`PeakMemMB` fields that are never populated (`metrics.go:91–92`, comment says "docker stats"; no producer exists). |
| C17 | Metrics follow the Hyperledger PSWG white paper via Caliper: send rate, committed TPS, latency **as percentiles not averages**, success rate, resources | p. 10 [47] | CONTRADICTED | `saksi/packages/saksi-bulletin/caliper/README.md` claims Caliper "reports … latency percentiles natively"; `package.json` pins `caliper-cli ^0.6.0`; `grep -ri percentil caliper/` matches only that comment | Caliper 0.6's default report emits **max / min / avg** latency, not percentiles. The repo's own comment asserts otherwise. As configured, the paper-mandated tool would report exactly the averages the paper says it does not use. |
| C18 | Table 3.7 Reliability: repeat each configuration ≥3 times; restart a node under load (T3); 100% commit success, zero ballot loss | p. 11 | MISSING | `grep -rniE 'warm|repetition|iteration'` → one unrelated Rust test name; `grep -rnE 'docker (stop\|restart\|kill)'` in tools/network → nothing | No repetition driver. No node-restart tooling. Zero-loss is checkable via `bench.Reconcile` (`accuracy.go:12`) but only in the legacy driver. |
| C19 | Table 3.7 Response time: p50/p95/p99 under normal (T1) and **peak (T8)** load | p. 11 | PARTIAL | as C14 | No T8 burst profile exists. Caliper rounds use `fixed-rate 50 tps`; the bench driver has `sendRate` but no burst shape. |
| C20 | Table 3.7 Throughput: Caliper load at **increasing send rates until saturation** | p. 11 | MISSING | `ballot-submission.yaml:28–31` | One fixed rate per round. No sweep, no saturation detection. |
| C21 | Table 3.7 Performance log analysis: Caliper reports, peer/orderer logs, chaincode events consistent with reported metrics | p. 11 | MISSING | — | No log collection, no cross-check between sources. |

### Table 3.8 scenarios

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| T1 | Normal voting: all valid accepted, `E = 0`, **latency recorded** | p. 11 | PARTIAL | C12 satisfied; latency: C14 | Latency is not recorded on the path the wizard runs. |
| T2 | High-volume: throughput plateau documented; no accepted ballot lost | p. 11 | MISSING | `bench.Reconcile` exists; no plateau | Loss detection exists in the legacy driver. No sustained-load run, no plateau. |
| T3 | Network interruption: peer/orderer stopped mid-run and restarted; ledger consistent; accepted ballots preserved | p. 11 | MISSING | — | Nothing stops or restarts a node. Nothing checks consistency after. |
| T4 | Tampering: malformed ballots, altered ciphertexts, manipulated manifests, **modification of committed records**; verifier detects | p. 11 | PARTIAL | `scenarios.go` `tamper-ballot-proof`, `corrupted-ballot-bytes`, `tamper-dkg-transcript`; `security_privacy.rs` `malicious_admin_altering_a_contest_id_is_detected` | First three covered. "Modification of committed records" is simulated by mutating the **offline stream copy** — nothing modifies a committed ledger record (Fabric forbids it), so the verifier's detection of on-chain tampering is not exercised. |
| T5 | Unauthorized access: invalid **or expired** credentials, reused nullifiers, duplicates; 100% rejection, each logged with its violated gate | p. 11 | PARTIAL | `contract_test.go` `TestSubmitBallotRejectsBadCredentialSignature`, `…RejectsDoubleVote`; Rust `tampered_credential_commitment_is_rejected` | **"Expired" credentials do not exist in the scheme** — credentials carry no validity period. The chaincode has no expiry gate. "100% rejection" is a set of PASS verdicts, not a computed percentage. |
| T6 | Trustee: decrypt with two shares then three including one invalid proof; sub-threshold fails; invalid proof detected; three valid decrypt **and sign** | p. 11 | PARTIAL | `security_privacy.rs` `sub_threshold_decryption_fails_but_full_threshold_succeeds`; `scenarios.go` `tamper-partial-decryption`; console `CeremonyPublish` → 409 below threshold (verified live: 0/2 and 1/2 → 409, 2/2 → 202) | Sub-threshold and invalid-proof are real. **"And sign" is not implemented** — see §2, item 4. The console default is 3 trustees at threshold 2, not the paper's 3-of-5. |
| T7 | Concurrent voting: parallel ballots across positions while interim aggregates are read; per-position nullifier holds | p. 11 | MISSING | `grep -rlE 'concurren\|parallel'` → no such test | `bench.Run` has a `concurrency` parameter but no test exercises cross-position concurrency, and no "interim aggregate" is ever read (aggregation is off-chain, post hoc). |
| T8 | Peak: worst-case burst sized from the tier's real-world analog; completes or bottleneck documented as scaling limit | p. 11 | MISSING | — | No burst profile. No scaling-limit evaluation (C25). |

### Accuracy, privacy, security

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| C22 | Crypto validated against **published ElectionGuard test vectors** | p. 12 [50] | PARTIAL | `saksi/packages/saksi-crypto/src/eg_interop.rs:1–7`; `saksi/packages/saksi-protocol/test-vectors/eg-interop-v1.json` | The file's own header: *"Sanity/interop check, NOT a conformance proof … byte-level vectors are not comparable."* What is pinned is plaintext tally semantics. The paper's phrasing "validated against published test vectors" overstates this. |
| C23 | Verification experiment 1: verifier on a **separate machine**, given only the public record, reproduces the tally accepting every proof | p. 12 [50] | PARTIAL | `saksi/packages/saksi-auditor/src/independent_verification.rs` `public_record_verification_reproduces_and_accepts` (audits `public_artifacts()`, ground truth stripped) | The independence is real in software terms — a separate program, no private answer key. "Separate machine" has not been done. |
| C24 | Verification experiment 2: one public record deliberately modified; verifier must detect (Rivest software independence) | p. 12 [50] | SATISFIED | `independent_verification.rs` `tamper_ballot_proof_detected`, `tamper_tally_total_detected`, `dropped_ballot_detected`, `tamper_partial_decryption_detected`, `tamper_dkg_transcript_detected`; console `runOneScenario` with positive control | Five distinct modifications, each detected. Better than the paper's "one record". |
| C25 | Privacy 1 — unlinkability: adversary with the full board outputs a pairing; success ≤ 1/N (Pfitzmann-Hansen) | p. 12 [51] | SATISFIED | `saksi/packages/saksi-auditor/src/security_privacy.rs:253` — explicit adversary model, linkage attempt over all on-chain bytes, bound 1/(anonymity set) | A genuine experiment, not an assertion. Good defence material. |
| C26 | Privacy 2 — ballot secrecy: no individual ballot ever decrypted | p. 12 [51] | SATISFIED | `security_privacy.rs` `only_the_aggregate_is_decrypted_never_an_individual_ballot`; `decryption.rs:68` aggregates before any decryption | — |
| C27 | Privacy 3 — threshold: decryption with fewer than three shares fails | p. 12 [51] | SATISFIED | `security_privacy.rs` `sub_threshold_decryption_fails_but_full_threshold_succeeds`; console 409 below threshold | Note: "three" is the paper's 3-of-5; code is parameterised and the wizard defaults to 2-of-3. |
| C28 | Five adversary classes, **one automated deterministic test each** | p. 12 [52] | SATISFIED | `security_privacy.rs`: voter (`tamper_ballot_proof`/double vote), trustees (`sub_threshold…`, `tamper_partial…`), admin (`malicious_admin_altering_a_contest_id`), BB node (`malicious_bb_node_dropping…`, `…reordering…`), network (replay = nullifier reuse, `TestSubmitBallotRejectsDoubleVote`) | — |
| C29 | **Eleven** negative test cases, each rejected by the gate that guards it | p. 12 [52] | PARTIAL | Console registry: 7. Chaincode tests: malformed ciphertext, tampered CDS, bad credential sig, double vote, closed election, malformed share/missing proof. Rust: credential tamper, ledger digest. | Mapped: malformed ciphertext ✓ · invalid proof ✓ · invalid credential ✓ / **expired ✗ (no concept)** · reused nullifier ✓ · duplicate same position ✓ · altered transaction ~ (bytes-flip) · altered manifest ✓ (contest id) · sub-threshold ✓ · bad trustee proof ✓ · **unauthorized identity ✗** (no MSP-level test; relies on Fabric) · corrupted ledger data ~ (offline digest only). **9 of 11**, and they are spread across three test suites with no single catalogue producing the paper's eleven-row table. |
| C30 | Four implementation-level checks: input validation at every entry; SAST (Rust + Go); dependency/supply-chain scanning; Rust memory safety | p. 12 [52] | PARTIAL | `balotachain/.github/workflows/ci.yml` `security` job (`govulncheck`, `pnpm audit --prod`); `decodeJSON` 1 MiB cap | Supply-chain scanning is real. **No fuzz or boundary testing at entry points** beyond fixed-size caps. No Rust SAST beyond `clippy` in the toolchain file. Memory safety is a language property, not a check. |
| C31 | Table 3.9: every adversary row has an **evidence** column ("rejection logged", "tampering detected by verifier") | p. 12–13 | PARTIAL | `negative-tests.csv` columns `scenario,stage,layer,action,expected,actual,verdict,property,on_chain` | Evidence exists per scenario. It is not organised by adversary class, and "rejection logged" for the network adversary (TLS interception) has no test at all. |

### Audit trail and the verifier

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| C32 | Trustees digitally **sign** the tally alongside their CP proof; approved when ≥3 of 5 have signed; signed tally + proofs + signatures committed to the board | p. 13 [55] | CONTRADICTED | `grep -niE 'Sign\(' saksi/packages/saksi-bulletin/chaincode/contract.go` → nothing; `wire.proto` `TallyResult{version, election_id, totals, partial_decryptions}` — no signature field; trustee app: no signing | **No tally signature exists anywhere** — not on the wire, not on-chain, not in the trustee app. The election-return section describes a mechanism that is not implemented. |
| C33 | Verifier performs **ten** checks from the public record alone | p. 13–14 [55–57] | PARTIAL | Auditor finding ids: `parameters.shape`, `dkg.*`, `ballot.credential`, `ballot.cds_proof`, `nullifier.unique`, `tally.aggregate`, `decryption.cp_proof`, `decryption.threshold`, `tally.homomorphic_sum`, `tally.accuracy` | Checks 2–9 map directly. **Check 1 ("validity of every recorded transaction")** — the auditor validates ballots, not Fabric transactions; on-chain, nothing re-verifies. **Check 10 ("append-only consistency of the ledger")** — `ledger.rs:19` computes an order-dependent digest over the ballot set it is *handed*; it never sees blocks. `previous_hash` is recorded (`receipts.go:49`) and displayed (`trail.html:204`) but **never chained or verified**. 8 of 10. |
| C34 | Table 3.11: seven on-chain items incl. **signed final tally** and **election manifest** | p. 14 | PARTIAL | chaincode keys `election`, `dkg`, `ballot`, `nullifier`, `partialdec`, `tally` | Six of seven are stored (manifest ≡ election parameters). "Signed final tally" — see C32. |

### Performance procedure

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| C35 | ≥10 measured repetitions after 2 discarded warm-ups; capstones 3 after 1 | p. 14 [58] | MISSING | no `warm`/`repetition` anywhere | Every run is one run. |
| C36 | Every metric reported as **min, median, mean, p95, p99, standard deviation** | p. 14 [58] | MISSING | `bench/metrics.go:37` — p50/p95/p99 only; `grep -nE 'func (Mean\|StdDev\|Min)'` → nothing | Three of six statistics, in the legacy driver only. |
| C37 | Stages timed **separately**: proof generation, proof verification, aggregation, threshold decryption | p. 14 [58] | MISSING | `grep -rn 'Instant::now\|\.elapsed()' saksi-auditor saksi-demo saksi-crypto` → nothing; `bench/metrics.go:20` `PhaseTimings` has **no producer** (`grep 'PhaseTimings{'` → nothing outside tests) | No stage is timed. The struct that would hold Fabric-phase timings is never constructed. Proof generation and aggregation are not even named in it. |
| C38 | Scaling-limit rule: sustained TPS below ~28 / ~54 / ~98 at 1M / 1.92M / 3.52M is a scaling limit, not a failure | p. 14 [58] | MISSING | — | The arithmetic (voters ÷ 36,000) appears nowhere in code. No run is classified. |
| C39 | Failed runs excluded from throughput, reported separately as a failure rate | p. 14 [58] | PARTIAL | `bench/driver.go` `RunResult{Submitted, Committed, Dropped}` | Per-ballot drops are counted. **Run-level** failure is not a concept — there is no repetition, so nothing to exclude or rate. |
| C40 | Table 3.12: OS, container runtime, topology, toolchain versions, container limits **recorded at execution** | p. 14–15 [59] | MISSING | `grep -rniE 'runtime.Version\|uname\|docker version'` (excluding `up.sh` preflight) → nothing; `runstore.go:25–27` | Nothing captures the environment into any artifact. `election.csv` records crypto digests but no OS, versions, or limits. |
| C41 | Ledger ~30–50 GB per million single-position ballots; 150 GB provisioned | p. 14 | MISSING | — | No run has produced a ledger to measure. Disk is not monitored (C16). |

### Appendices

| # | Commitment | Reviewer | Status | Evidence | Gap |
|---|---|---|---|---|---|
| C42 | Appendix A: `ground-truth-ballots.csv` wide + `ground-truth-summary.csv` | p. 15 [63] | SATISFIED | `ground_truth.rs:69`; both files verified present and consistent by the gate | — |
| C43 | Appendix A: three profiles; realistic = skewed rule for most, reserved share apportioned down ranks; integer arithmetic; no random state | p. 15 [63] | SATISFIED | `fixtures.rs:464` (`realistic_quotas`), `:554` (`SelectionPlan`), `:622`; `docs/saksi/reference_generator.py` byte-identical across 9 configs | — |
| C44 | Appendix A sample: 500 voters single-position → CAND_PRES_01 **142**, _02 **119**, _03 **131**, _04 **108** | p. 15 [63] | CONTRADICTED | `balotachain/docs/saksi/reference_generator.py` at 500 × 1 × 4: uniform `125,125,125,125`; skewed `250,84,83,83`; realistic `245,90,85,80` | **No profile produces the published numbers.** The manuscript's worked reproducibility example is not reproducible. A panelist with the open-source generator can check this in one command. |
| C45 | Appendix C performance form: 14 configurations SP-1K…SP-3.5M, MP-1K…MP-3.5M; latency, TPS, threshold-decrypt time, peak CPU, peak memory | p. 15 [70] | CONTRADICTED | `bench/metrics.go:73–105` (`Row`, `csvHeader`); `driver.go:83–110` (`ToRow`) | The CSV has the columns. **`decrypt_ms`, `peak_cpu_pct`, `peak_mem_mb`, `endorse_p50_ms`, `cds_verify_p50_ms`, `order_p50_ms`, `validate_p50_ms`, `commit_p50_ms` are never assigned by `ToRow` and are written as `0`.** A completed form would carry eight fabricated zeros per row. |
| C46 | Appendix C accuracy form: config, position, candidate, decrypted, ground truth, \|diff\|; E is the sum | p. 15 [70] | SATISFIED | `correctness.csv` — `contest, ground_truth, decoded, E, pass, …` | Matches, plus recovered point and aggregate ciphertext as extra evidence. |
| C47 | Appendix C privacy form: three rows | p. 15 | PARTIAL | tests exist (C25–27) | No form is produced; results live in test output. |
| C48 | Appendix C security form: five protocol rows + four implementation rows | p. 15 | PARTIAL | `negative-tests.csv` | Seven rows by scenario, not five by adversary class; no implementation rows. |

---

## 2. Reviewer implementation claims the code does not back

Checked against the specific list in the brief.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Three chaincode gates — credential, nullifier, proof — in that order, all before commit | **Backed** | `contract.go:148` `credverify.VerifyIssuerSignature` → `:171` election-open check → `:184` nullifier spent → `:255` `cdsverify.VerifyBinaryCDS`. All inside `SubmitBallot`, all before `PutState`. |
| 2 | Nullifier per credential and position via a domain-separated hash | **Backed** | `saksi/packages/saksi-credentials/src/nullifier.rs:45` `NULLIFIER_DOMAIN = "saksi.credentials.nullifier.v1"`, `:61` `nullifier_h(election_id, position_id)` hash-to-point, `:79` `derive_nullifier = s_cred · H_e`. Verified on real bytes: same voter, two positions, zero shared bytes. |
| 3 | Bounded discrete log: linear below 50,000, BSGS at and above; bound = accepted ballot count | **Backed** | `tally.rs` `BSGS_THRESHOLD = 50_000`; `:171` `decode_tally(plaintext_point, eligible_ballot_count as u64)`; differential test asserts both paths agree. |
| 4 | Per-precinct sub-accumulators folded in one closing transaction; fold on the ledger; re-checked by the verifier | **NOT BACKED — contradicted** | `grep -niE 'precinct\|accumulator\|fold' contract.go` → nothing. The chaincode stores each ballot under `ballot\|<id>\|<nullifier>`; **no on-chain aggregate of any kind exists.** Aggregation happens only in the auditor, off-chain, post hoc (`decryption.rs:68`). The "hot key" the paper describes fixing does not exist because there is no on-chain accumulator to be hot. Algorithm 4's fix is a description of something that was never built. |
| 5 | Three profiles; realistic = reserved share down the ranks; integer arithmetic; no random state | **Backed** | C43. |
| 6 | Ground-truth-only path to 3,524,078 without crypto cost | **Backed** | C6. |
| 7 | Streaming validation gate, bounded memory | **Backed** | `check.go:143` `bufio.Scanner` with 4 MB line cap; voter ordinal vs row counter, no set. |
| 8 | Scenarios carry a lifecycle stage; tests assert the stages partition the catalogue | **Backed** | `scenarios.go` `Stage` field; `onchain_gate_test.go` `TestEveryScenarioDeclaresAStage`, `TestStagesPartitionTheCatalogue`. |
| 9 | Positive control: unmutated copy audited first; scenario fails outright if it does not pass | **Backed** | `scenarios.go` `runOneScenario` — `"positive control did not pass on the unmutated copy"`. |
| 10 | Threshold enforced at the console; chaincode validates each partial but does not count them at endorsement | **Backed, and more precisely than stated** | `contract.go:733` `PublishTally` checks status, version, id, totals length, no-existing-tally — never counts partials. `SubmitPartialDecryption` checks the CP proof is **present** (`"missing a Chaum-Pedersen proof"`), **not that it verifies**. The reviewer says "validates each partial"; the chaincode validates its *shape*. Proof verification is the auditor's. |

**Also not backed, from outside the list:**

- **Trustee tally signatures** (p. 13 [55]) — see C32. No signature field on the wire, none on-chain, none in the trustee app.
- **"3-of-5 trustees"** as the evaluated configuration — the console defaults to 3 trustees at threshold 2 (`wizard.html:262, :1133`); `GenParams::simple` in Rust defaults to 3-of-5 (`fixtures.rs:399–400`). The demo run this cycle used 2-of-3. The paper's threat model ("up to two malicious trustees … three of five") assumes the 3-of-5 shape.
- **"Latency as percentiles not averages" via Caliper** — see C17.

---

## 3. What the code does that the paper does not mention

Things a panelist could ask about that are not in the manuscript.

1. **No verified mode reaches the cryptographic path above 10,000 voters.** `offline` is capped at 10,000 (`config.go:118`). `onchain` has never executed — no Docker daemon was available; `tools/up.sh` is proven only to its preflight. `groundtruth` reaches 3.5M but runs no cryptography. The reviewer's *Known soft spots* acknowledges the on-chain gap; it does not say that 50k, 483k, 1M and both capstones are therefore currently unreachable with proofs and encryption in any mode. Table 3.5 is, as of now, an empty matrix above 10k.

2. **"perf mode" does not exist.** The offline-ceiling error says *"select on-chain/perf mode for larger tiers"* (`config.go:118`) and a comment refers to "on-chain/perf mode" (`config.go:21`). `Validate` accepts only `offline`, `onchain`, `groundtruth`. The message names a mode a user cannot select.

3. **`perf.csv` is advertised and never written.** It appears in `exportOrder` (`server.go:34`) and in the classic console's file chips (`index.html:237,240,246`), but no code produces it. A reader of the export list would expect a performance artifact that does not exist.

4. **Two encryptions of one population.** Step 2 writes `ballots.ndjson`; step 4 writes `bundle.json`. Same plaintext, unrelated ciphertexts (`OsRng`). The auditor reads the stream; the ceremony submits the bundle. Correct, but the paper describes one encrypted record, and the relationship is easy to misread as a discrepancy.

5. **The chaincode-only attack never runs offline.** `reordered-ballots` is `LayerChaincode` and reports `SKIPPED` in the only mode that has run. The paper's T4 "reorder" and negative case "corrupted ledger data" are therefore backed only by an offline digest test (`ledger.rs`), not by anything observed on a ledger.

6. **Simulated versus real attacks are both called attacks.** Offline, every scenario mutates a *copy* and re-audits. The CSV distinguishes them (`on_chain=false`), and the UI labels them "simulated" — but a reader of Table 3.8's "actual result" column needs to know that, so far, every actual result was obtained against a copy, not a ledger.

7. **Contest-mixing is a declared weakness of the test data**, recorded in the docs: under `realistic` ~8.6 % of configurations give all three positions the same multiset of totals, so `E = 0` could not distinguish contests on those. Not in the manuscript.

8. **`ground-truth-check.json`, `scenarios.json`, `ceremony.json`, `trail.json`** — run-folder state files the paper does not list in Table 3.11. Harmless, but "9 stored items" is not the whole inventory.

9. **The console can be told to skip attacks** (`skip_attacks`). Fine for a clean demo; a panelist watching a run with no attack panels should not conclude none exist.

10. **The validation gate is stricter than the paper in one way and looser in another.** Seven checks versus four; fail-closed rather than regenerate; and nullifier uniqueness deferred to the auditor (C4).

11. **The bench driver's per-ballot clock is monotonic-safe** (Go's `time.Since` reads the monotonic component) — the paper never says which clock is used, and this is a point in the code's favour if asked.

---

## 4. Proposed plan

Ordered by commitments unblocked per unit of work. **Nothing below touches
`saksi-crypto`, `saksi-credentials`, `saksi-auditor`, `saksi-protocol`, or the
chaincode.** Harness surfaces are `saksi/packages/saksi-campaign` (the console),
`saksi/packages/saksi-bulletin/client-sdk/bench` and `cmd/saksi-console` (the
driver), the Caliper config, and `saksi/tools`.

### Blocked by the constraint — separate findings, not planned around

These commitments cannot be met without touching the library or chaincode.
Listed so the decision is explicit.

| Commitment | Why it needs the library or chaincode |
|---|---|
| C37 stage timers — **proof generation, proof verification, aggregation** | These run inside `saksi-auditor` / `saksi-demo`. From the harness, only whole-invocation durations are observable (`gen` ≈ generation, `audit-stream` ≈ verification + aggregation + decryption combined). Separating them needs `Instant` stamps inside the auditor. The plan below delivers the coarse invocation timers and states the limit. |
| C37 per-phase Fabric timings (`endorse/order/validate/commit`) and `cds_verify` | Endorsement-internal timing is only visible to the peer. Client-side, `SubmitWithReceipt` sees submit→commit as one duration. **Recommendation: delete these five columns from the Appendix-C CSV** rather than keep emitting zeros. |
| C32 trustee tally signatures | Needs a signature field on `TallyResult` (`wire.proto`) and chaincode verification. |
| §2 item 4 — per-precinct sub-accumulators and the on-chain fold | Chaincode. Either build it or **remove Algorithm 4's claim from the manuscript**. |
| C33 check 10 on-chain — append-only consistency | Harness *can* walk the block chain via `qscc` and verify each `previous_hash` against the recomputed prior header (`blockHeaderHash` already exists in `client-sdk/ledger.go`). That is client-sdk work, permitted. **Included below.** |
| Endorsement-time threshold count | Chaincode. Already declared as a limitation; no change. |

### Plan items

**P1 — Run journal.** *Unblocks C8, C24-equivalent recording, C35, C39, C40, and every "recorded" gap.*
An append-only file `journal.ndjson` in the run folder, one JSON line per event, `fsync` after every checkpoint event (run-start, each stage boundary, each repetition boundary, run-end). No buffering beyond the current line. First line is the **environment snapshot captured at run start**: `runtime.GOOS/GOARCH`, `runtime.Version`, `rustc --version`, `saksi-demo --version` (or its SHA-256), `git rev-parse HEAD` of both repos, `docker version` and `docker info` (JSON), container resource limits via `docker inspect` for each peer/orderer, `uname -a`, CPU model and core count, total RAM. Every subsequent event carries a **monotonic** timestamp (`time.Now()` for wall, but durations computed from a captured `monotonic` reading; in Go, store `time.Now()` and compute with `Sub`, which uses the monotonic clock — never subtract wall times parsed from text).
Blast radius: new `journal.go` in `saksi-campaign`; `executor.go` gains a `stamp(stage)` call at each existing `publish`; `runstore.go` records the journal path. ~250 lines, Go only.

**P2 — Stage boundary stamps.** *Unblocks the coarse half of C37; T1 "latency recorded".*
Stamp `generate.start/end`, `check.start/end`, `bundle.start/end`, `create/dkg/ballots/close` boundaries (already distinct calls in `setupOnChain`), each trustee `submit.start/end`, `publish`, `verify.start/end`. Report in `perf.csv` (finally written) as durations per stage. State in the CSV header comment that `verify` = proof verification + aggregation + decryption combined, and that finer splits require auditor instrumentation.
Blast radius: `executor.go`, `ceremony.go` — one line per boundary. Removes the fabricated `perf.csv` entry from §3.

**P3 — Move the benchmark into the console's on-chain path.** *Unblocks C14, C15, C39, T1, T2 no-loss.*
`setupOnChain` currently submits ballots in a serial loop with no timing. Replace the loop body with `bench.Run(n, concurrency, sendRate, submit)` where `submit` is the existing `lifecycleStep` — receipts are still appended per ballot. Persist `RunResult` (all per-ballot latencies, not just percentiles) to the journal. Concurrency and send-rate become run config fields.
Blast radius: `executor.go` `setupOnChain`; `config.go` two fields; `bench` unchanged. **Prerequisite: the on-chain path must first execute at all** — this cannot be verified on this machine.

**P4 — Full statistics.** *Unblocks C36.*
Add `Min`, `Max`, `Mean`, `StdDev` to `bench/metrics.go` beside `Percentiles`; extend `Row` and `csvHeader`. Population standard deviation over the per-ballot latencies.
Blast radius: `bench/metrics.go`, `bench/driver.go` `ToRow`, tests. ~60 lines.

**P5 — Delete or populate the fabricated columns.** *Fixes C45.*
`decrypt_ms` ← from P2's `publish` stage duration. `peak_cpu_pct` / `peak_mem_mb` ← from P6. The five per-phase columns → **delete** (see blocked table). Until P6 lands, the two peak columns must be omitted, not zero.
Blast radius: `bench/metrics.go` `csvHeader`, `Row`; `cmd/saksi-console`.

**P6 — Resource sampler.** *Unblocks C16 (partially), C41.*
A goroutine that polls `docker stats --no-stream --format json` every N seconds for the peer, orderer, **and the client container or host process** for the run's duration, appending each sample to the journal. Peak and mean CPU/mem per container derived at run end. Disk: `du` of the peer's ledger volume at start and end. Network: container `NetIO` from the same stats line. Requires the Docker socket to be reachable from the console — true on the benchmarking desktop, not necessarily on the Mac client.
Blast radius: new `sampler.go` in `saksi-campaign`; ~150 lines.

**P7 — Repetition driver.** *Unblocks C18, C35, C39.*
A `repeat` subcommand on `saksi-campaign` (or a `tools/campaign.sh`) that runs a configuration W warm-ups + R measured repetitions, writes a **separate run folder per repetition**, tags each in its journal as `warmup` or `measured` with its index, and produces `summary.csv` across measured runs only: per-metric min/median/mean/p95/p99/stddev **across repetitions**, and a run-level **failure rate** = failed measured runs ÷ R, with failed runs excluded from throughput. Defaults W=2, R=10; capstone tiers W=1, R=3.
Blast radius: new `cmd/campaign-repeat` or script; reads journals. ~200 lines.

**P8 — Scaling-limit classifier.** *Unblocks C38, T8 half.*
At run end, compute `arrival = voters / 36000` and compare to sustained TPS from the measured window. Write `scaling_limit: true|false` and the two numbers into the journal and `summary.csv`. Sustained = TPS over the *whole measured window* of an uninterrupted run; see P9 for interrupted runs.
Blast radius: `journal.go` finaliser. ~30 lines.

**P9 — Checkpoint / resume for capstone tiers.** *Unblocks the capstones being attemptable at all.*
Checkpoint = a journal event `ballots.progress {submitted_through: i}` fsynced every K ballots. Resume = read the last checkpoint, restart submission at `i+1`.
**Replay rule (non-negotiable per the brief):** any ballot at index ≤ `submitted_through` that is re-submitted and rejected by the nullifier gate is tagged `replay: true` in the journal and **excluded from T5 rejection counts** — it is not an attack, it is a resume artefact. The tag is set by the driver, not inferred from the error text.
**Throughput rule:** a resumed run is reported **per contiguous segment**, each segment with its own window and TPS, and the journal carries an `interrupted_at` event between segments. `summary.csv` reports the segments separately and marks the run `sustained: false`. The scaling-limit classifier (P8) runs per segment. A resumed run never contributes a single whole-run TPS figure.
Blast radius: `executor.go` `setupOnChain` (resume entry), `journal.go`. ~120 lines.

**P10 — Validation ladder driver.** *Unblocks C7.*
`tools/ladder.sh` (or a console subcommand) that runs 1, 10, 100, 1,000 voters through the full offline lifecycle, asserts `E = 0` and gate pass at each, and writes `ladder.json` with the four run ids. Larger-tier runs refuse to start unless a `ladder.json` newer than the current build exists.
Blast radius: new script + one check in `handleGenerate`. ~80 lines.

**P11 — Chain walk for verifier check 10.** *Unblocks C33 check 10.*
In `client-sdk/ledger.go`, a `VerifyChain(from, to)` that fetches each block via `qscc GetBlockByNumber`, recomputes `blockHeaderHash`, and asserts block *n*'s `previous_hash` equals block *n−1*'s recomputed hash. Called at the end of an on-chain run; result to the journal and to `/trail/<id>` as a tenth check. Client-sdk only; chaincode untouched.
Blast radius: `client-sdk/ledger.go` ~60 lines; `trail.go` one call.

**P12 — Caliper percentiles, or demote Caliper.** *Fixes C17.*
Either add a Caliper `txUpdate`-based custom report that computes p50/p95/p99 from per-tx latencies, or change the README and yaml comment to say Caliper is the **cross-check for TPS and success rate only**, and the Go driver is the source of percentiles. The second is one line and honest; the first is real work in a JS workload.
Blast radius: `caliper/README.md`, `ballot-submission.yaml` comments; optionally `workloads/`.

**P13 — Send-rate sweep.** *Unblocks C20, T2 plateau, T8.*
Driver flag to run a configuration at increasing `sendRate` (e.g. ×1.5 per step) until committed TPS stops rising or drops exceed a threshold; each step is its own journal segment. Plateau = the highest step with drops below threshold.
Blast radius: P7's driver. ~80 lines.

**P14 — Rate-form rejection counts.** *Fixes C13, T5 "100 percent".*
In `negative-tests.csv` and `summary.csv`, report `rejected / attempted` per scenario as a number, not only a verdict. For live attacks, attempted = 1 per mounting; for the chaincode's own tests, cite the test count.
Blast radius: `scenarios.go` `writeNegativeTestsCSV`. ~20 lines.

**Not in the plan — manuscript changes, not code:**
- C44: regenerate the Appendix A sample from the actual generator and replace 142/119/131/108. One command: `python3 reference_generator.py --voters 500 --positions 1 --candidates 4 --distribution realistic`.
- C32 / §2 item 4: either implement tally signing and the precinct fold (both out of bounds here) or remove the claims. The election-return section (p. 55) and Algorithm 4's hot-key paragraph currently describe unbuilt mechanisms.
- T5 "expired" credentials: remove the word, or define expiry.
- 3-of-5: make the wizard default match, or state the evaluated configuration is parameterised.

### Order and dependency

```
P1 journal ─┬─ P2 stamps ─── P5 columns
            ├─ P6 sampler ──┘
            ├─ P3 bench-in-console ── P4 stats ── P7 repeat ─┬─ P8 classifier
            │                                                ├─ P9 resume
            │                                                └─ P13 sweep
            ├─ P10 ladder
            ├─ P11 chain walk
            └─ P14 rates
P12 Caliper — independent
```

P1 first: everything else writes into it. P3 is the one item that cannot be
verified here — it needs a live network, and the on-chain path has never run.

---

## Method note

Every status above was checked against the tree, not recalled. Absences were
established with `grep` over the relevant packages excluding `vendor/`,
`target/`, and `_test.go` where a test would not count as an implementation.
The Appendix A sample was recomputed with the reference generator that is
byte-identical to the Rust one. Where I could not verify a claim (the on-chain
path, the separate-machine verifier run), the matrix says so rather than
inferring.
