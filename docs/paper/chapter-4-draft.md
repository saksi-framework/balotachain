# CHAPTER IV: RESULTS AND DISCUSSION

Draft of 2026-10-02, written against the manuscript's Chapter III and updated from the earlier draft
(`docs/paper/chapter-4-draft.docx`, `ch4-data.json`, main checkout) with every run completed up to 2026-10-02 00:00.
Where the extracted manuscript text is older than the Week 4 consultation record, the Week 4 revisions are assumed:
Table B.1 lists six chaincode checks, the negative test catalogue has fourteen cases, the verifier checklist has
fourteen checks, reference [32] supports three rounds per capstone experiment, and the scaling-limit rule requires a
resource trace at the point of failure.

**Conventions used in this draft.**

- **Build.** Every study run reported here ran on Saksi and the campaign console at commit
  `4a38a54fe0223b58f28c53ec54e47fbeab222837` (`run.json` `git_head_saksi` and `git_head_console`), with the
  generator binary `saksi-demo` of SHA-256 `112fffa0124943a4...763c52`. Commit 4a38a54 contains the issuer-binding
  and selection-sum gates and descends from 1812139, the commit that made key generation random, so every run cited
  here is eligible for issuer-binding, selection-sum and secrecy claims.
- **Evidence.** The balotachain evidence commits are:
  - `8739722`, branch `docs/ch4-study-2026-09-30`, PR #66: rows 2 to 4, the SP-10K security run, T3;
  - `f2d8921`: candidate-count check, MP-1K security run, SP-483K and its sweep and burst;
  - `5aef011` and `3f08f5a`: SP-1M;
  - `f9aa09b`: validation gate;
  - `475bdfb`, `3b87854`, `1640390`, `4f4a0d9`, `b5d2095` and `f8f5c34`: the SP-1.92M capstone.

  All but the first are on branch `docs/ch4-night1-2026-10-01`. Each table names its source files beneath it.
- **Status tags.** Each claim carries one of three tags:
  - *[design intent]*: stated in the design, not implemented or not tested;
  - *[implemented]*: present in the code at 4a38a54, shown at most by unit tests;
  - *[demonstrated]*: observed in a study run on 4a38a54.
- **Placeholders.** A result not yet run is marked `[PENDING: tier, configuration]`. No pending value is estimated.
  The open placeholders are listed at the end of the chapter.

---

## Test Tiers and Environment

Table 4.1 records the environment as executed, completing the fields that Table 3.12 left to be recorded at
execution.

**Table 4.1. Benchmarking environment as executed.**

| Item | Specification |
|---|---|
| Processor | AMD Ryzen 7 5700G, 8 cores, 16 threads |
| Memory | 31.9 GB on the host; 24 GB allotted to WSL2 (`docker_info.MemTotal` 25,199,009,792 bytes), swap off |
| Storage | Docker Desktop data disk (`docker_data.vhdx`, dynamically expanding) on the host's 931 GB data drive Q: (NVMe); LevelDB state database |
| Operating system and container runtime | Windows 11 Pro 10.0.26200; WSL2 Ubuntu, kernel 6.18.33.2-microsoft-standard-WSL2; Docker server 29.7.2 |
| Blockchain platform | Hyperledger Fabric 2.5.15 test network, channel `saksi`, chaincode `saksi-bulletin`, single Raft orderer |
| Orderer block configuration | BatchTimeout 2 s, MaxMessageCount 50, PreferredMaxBytes 2 MB, AbsoluteMaxBytes 99 MB |
| Network topology | Two organizations with one peer each and one Raft orderer, all on one machine; a fresh network and empty ledger for every attempt (network reset) |
| Toolchain versions | Saksi and console at commit 4a38a54 in every study run; `saksi-demo` SHA-256 `112fffa0...763c52` |
| Container resource limits | None (`HostConfig.Memory` 0, `NanoCpus` 0 on every container); 16 vCPU visible to Docker |
| Load generator | Closed loop, 128 ballot records in flight, no send-rate cap (`send_rate` 0), except the rate sweep; verifier on 16 threads |
| Election parameters | 4 candidates per position (except the candidate-count check), 5 trustees, threshold 3, `realistic` selection profile |
| Capstone instrumentation | External 10 s resource sampler per run (`resources.csv`): per-container CPU, memory and block I/O; guest memory and load; Windows processor time, available memory, per-disk busy time and queue length; host free space; virtual-disk sizes |

Source: journal line 1 (`env`) of every run; `docs/desktop-runs/2026-09-30-mp-50k.md` section 1 (branch
`docs/ch4-study-2026-09-30`); `docs/desktop-runs/tools/controller.py` class `Sampler`.

Table 4.2 gives the evaluation matrix of Table 3.5 as it was executed.

**Table 4.2. Evaluation matrix as executed.**

| Tier | Voters x positions | Mode | Warm-ups + measured | Failed measured runs | Standing campaign or runs | Evidence commit |
|---|---|---|---|---|---|---|
| SP-1K | 1,000 x 1 | on-chain | 2 + 10 | 0 | `campaign-20260929-174641-11` | `8739722` |
| MP-1K | 1,000 x 3 | on-chain | 2 + 10 | 0 | `campaign-20260929-180218-15` | `8739722` |
| SP-10K | 10,000 x 1 | on-chain | 2 + 10 | 0 | `campaign-20260929-182259-19` | `8739722` |
| MP-10K | 10,000 x 3 | on-chain | 2 + 10 | 0 | `campaign-20260929-191104-23` | `8739722` |
| SP-50K | 50,000 x 1 | on-chain | 2 + 5 | 0 | `campaign-20260929-195715-27` | `8739722` |
| MP-50K | 50,000 x 3 | on-chain | 2 + 5 | 0 | `campaign-20260929-201819-29` | `8739722` |
| SP-483K | 483,000 x 1 | on-chain | 1 + 3; then a 5-step rate sweep and a 144,900-ballot burst | 0 | `campaign-20260930-185730-11`; sweep and burst `campaign-20260930-205246-12` | `f2d8921` |
| SP-1M | 1,000,000 x 1 | on-chain | 0 + 3 | 0 | `campaign-20261001-035442-2` (supersedes `campaign-20260930-214456-14`, 2 of 3 failed when the host disk filled) | `5aef011`, `3f08f5a` |
| SP-1.92M (capstone) | 1,921,917 x 1 | on-chain | 1 + 3, each a single-run campaign on a freshly reset network | 0 lost ballots; m1 resumed after a power loss and flagged `failed` by the console (see Reliability) | warm-up `campaign-20261001-082938-2`; m1 `-102357-4`; m2 `-123440-2`; m3 `-142136-2` | `475bdfb`, `3b87854`, `1640390`, `4f4a0d9`, `b5d2095`, `f8f5c34` |
| SP-3.5M (capstone) | 3,524,078 x 1 | on-chain | 1 + 3 planned | | [PENDING: SP-3.5M, single-position on-chain capstone] | |
| MP-483K | 483,000 x 3 | offline | 0 + 1 planned | | [PENDING: MP-483K, multi-position offline (row 8)] | |
| MP-1M | 1,000,000 x 3 | offline | 0 + 1 planned | | [PENDING: MP-1M, multi-position offline (row 8)] | |
| MP-1.92M (capstone) | 1,921,917 x 3 | offline | 0 + 1 planned | | [PENDING: MP-1.92M, multi-position offline (row 8)] | |
| MP-3.5M (capstone) | 3,524,078 x 3 | offline | 0 + 1 planned | | [PENDING: MP-3.5M, multi-position offline (row 8)] | |
| MP-483K to MP-1.92M | x 3 | on-chain | not attempted (amendment to Table 3.5) | | | |
| MP-3.5M | 3,524,078 x 3 | on-chain | not attempted: disk requirement exceeds the machine (see Capstone Outcome) | | | |
| Candidate-count check | 1,000 x 3, 10 and 28 candidates | on-chain | 2 + 5 each | 0 | `campaign-20260930-173157-4`, `campaign-20260930-175515-8` | `f2d8921` |
| Security runs | SP-10K; MP-1K | on-chain | 1 each | 0 | `sp-10k-ch4-sec-20260929-183410-129`; `mp-1k-ch4-sec-20260930-185139-29` | `8739722`; `f2d8921` |
| T3 node restart | 10,000 x 1 | on-chain | 1 | 0 | `sp-10k-ch4-t3-20260929-183754-130` | `8739722` |
| Validation gate | 14 tiers, SP and MP | ground-truth only | 3 timed checks each | 0 | `*-ch4-gate-20261001-*` | `f9aa09b` |

Source: `campaign.json` and `summary.csv` of each tier export under `docs/desktop-runs/`; plan
`docs/plans/2026-10-01-ch4-runs-and-chapter.md`; study log
`.superpowers/sdd/2026-09-14-study-grade-wizard/ch4-study-log.md`.

The repetition counts depart from Chapter III's ten measured repetitions after two warm-ups:
- The 50,000-voter tiers ran 2 + 5, and SP-483K ran 1 + 3.
- SP-1M ran 0 + 3, by the researchers' decision of 1 October that a start-up effect is negligible over an election
  of that length.
- The capstones follow the 1 + 3 protocol of Chapter III, supported by [32].
- The multi-position tiers from 483,000 voters up are run offline, through generation and verification without the
  blockchain.

These departures are recorded as manuscript amendments. A tier was rerun once from a fresh network when a measured
repetition was flagged for host contention, and the rerun stood whatever its flags. Superseded attempts are kept
with the evidence.

---

## Correctness of the Framework (Research Question 1)

Correctness was checked on every election, warm-ups included, because a warm-up is still a complete election. The
independent verifier audited each election twice, once over the console's local record and once over the ballots read
back from the ledger, and compared the two (`ledger_matches_local`).

### Accuracy

**Table 4.3. Accuracy: correctness per tier, all elections including warm-ups.**

| Tier | Elections audited | Contest rows (local + ledger) | Largest E | Every contest passes | Ledger matches local | Ballots dropped | Verifier verdict |
|---|---|---|---|---|---|---|---|
| SP-1K | 12 | 96 | 0 | Yes | Yes | 0 | pass |
| MP-1K | 12 | 288 | 0 | Yes | Yes | 0 | pass |
| SP-10K | 12 | 96 | 0 | Yes | Yes | 0 | pass |
| MP-10K | 12 | 288 | 0 | Yes | Yes | 0 | pass |
| SP-50K | 7 | 56 | 0 | Yes | Yes | 0 | pass |
| MP-50K | 7 | 168 | 0 | Yes | Yes | 0 | pass |
| SP-483K (1 + 3) | 4 | 32 | 0 | Yes | Yes | 0 | pass |
| SP-483K burst | 1 | 8 | 0 | Yes | Yes | 0 | pass |
| SP-483K sweep steps | 5 | 40 | 0 | local rows yes; ledger rows no (time-bounded windows by design) | No (bounded) | 0 | not an accuracy row |
| SP-1M | 3 | 24 | 0 | Yes | Yes | 0 | pass |
| SP-1.92M (1 + 3) | 4 | 32 | 0 | Yes | Yes | 0 | pass |
| SP-3.5M | [PENDING: SP-3.5M, single-position on-chain capstone] | | | | | | |
| MP-483K to MP-3.5M offline | [PENDING: MP-483K, MP-1M, MP-1.92M, MP-3.5M, multi-position offline (row 8)] | | | | | | |
| MP-1K, 10 and 28 candidates | 14 | 60 and 84 per election | 0 | Yes | Yes | 0 | pass |
| SP-10K security run | 1 | 8 | 0 | Yes | Yes | 0 | pass |
| MP-1K security run | 1 | 24 | 0 | Yes | Yes | 0 | pass |
| SP-10K T3 (peer restart) | 1 | 8 | 0 | Yes | Yes | 0 after resume | pass |

Source: `correctness.csv` and `journal.ndjson` (`stage.verify.end`, `run.end`) of every run; rows 1K to 50K from
branch `docs/ch4-study-2026-09-30` (`8739722`), the rest from `docs/ch4-night1-2026-10-01`.

**Table 4.4. Accuracy and integrity recording form (Appendix C): largest completed single- and multi-position tiers.**

| Configuration | Position | Candidate | Decrypted count | Ground-truth count | Absolute difference |
|---|---|---|---|---|---|
| SP-1.92M, m3 | president | cand0 | 941,740 | 941,740 | 0 |
| SP-1.92M, m3 | president | cand1 | 345,945 | 345,945 | 0 |
| SP-1.92M, m3 | president | cand2 | 326,726 | 326,726 | 0 |
| SP-1.92M, m3 | president | cand3 | 307,506 | 307,506 | 0 |
| MP-50K, m1 | president | cand0 / cand1 / cand2 / cand3 | 24,500 / 9,000 / 8,500 / 8,000 | 24,500 / 9,000 / 8,500 / 8,000 | 0 |
| MP-50K, m1 | vice-president | cand0 / cand1 / cand2 / cand3 | 24,250 / 9,333 / 8,584 / 7,833 | 24,250 / 9,333 / 8,584 / 7,833 | 0 |
| MP-50K, m1 | senator | cand0 / cand1 / cand2 / cand3 | 24,000 / 9,667 / 8,666 / 7,667 | 24,000 / 9,667 / 8,666 / 7,667 | 0 |

Source: `correctness.csv` (source = local) of runs `sp-1-92m-ch4-m3-20261001-142140-1` (`f8f5c34`) and
`mp-50k-ch4-20260929-203416-171` (`8739722`). The SP-1.92M counts are identical in all four capstone elections,
because the population is generated deterministically from the same parameters.

The announced tally equalled the ground truth, with E = 0, on every contest of every election from 1,000 to
1,921,917 voters single-position and from 1,000 to 50,000 voters multi-position *[demonstrated]*. It held as well at
10 and 28 candidates per position, under attack in both security runs, and after a peer restart. The capstone repetition cut
by a power loss (SP-1.92M m1) also decoded every contest exactly once it was resumed. The SP-1.92M tally has a clear
winner (941,740 against 345,945) because the `realistic` profile apportions a reserved share of the electorate down
the candidate ranks (Appendix A ground truth, below). The result does not yet cover SP-3.5M or the offline
multi-position tiers above 50,000 voters.

### Correctness Criteria

**Table 4.5. Research Question 1: results by criterion.**

| Criterion | Evidence | Result | Status |
|---|---|---|---|
| (a) Announced tally equals ground truth | E per contest over local and ledger records | Met at every completed tier, SP-1K to SP-1.92M and MP-1K to MP-50K (Table 4.3). SP-3.5M and the offline MP tiers: [PENDING: SP-3.5M, single-position on-chain capstone]; [PENDING: MP-483K to MP-3.5M, multi-position offline (row 8)] | demonstrated |
| (b) Invalid ballots rejected | Security runs: tampered proof, corrupted bytes, self-issued credential, overvote (live on-chain); altered key-generation commitment and partial-decryption proof (verifier) | Met for every mounted attack: 8 of 8 refused at the declared gate in each of the two security runs | demonstrated |
| (c) Duplicate votes rejected | `reused-nullifier` submitted live mid-election in both security runs | Met: refused by the chaincode nullifier gate in both runs, including per position on the three-position election | demonstrated |
| (d) All accepted ballots in the tally | Dropped ballots, stream completeness, ledger matches local; T3 and capstone m1 reconciliation | Met: 0 dropped in every non-bounded run; T3 reconciled 10,000 of 10,000; SP-1.92M m1 reconciled 881,628 of 881,628 at the cut, then committed the remaining 1,040,289 | demonstrated |
| (e) Independently verifiable | Verifier over the ballots read back from the ledger; verifier on a separate machine | Met on the ledger read-back. Separate machine: [PENDING: RQ1e, verifier on a separate machine from a copied public record] | demonstrated (read-back); pending (separate machine) |
| (f) All proofs verify | Verifier overall verdict and failed checks | Met: `overall pass`, `failed_checks` empty, on every audited run | demonstrated |

Source: Tables 4.3, 4.7 and 4.11; `negative-tests.csv` of both security runs; `docs/desktop-runs/2026-09-30-sp-10k-t3.md`
(`8739722`); `docs/desktop-runs/2026-10-01-sp-1.92m/m1/RESUMED.md` (`1640390`).

Criteria (a), (b), (c), (d) and (f) were met wherever they were measured. Criterion (e) was met only in part: the
verifier reproduced every tally from public data read back from the ledger, but the separate-machine experiment of
Chapter III has not been run. Chapter III's reference to the ElectionGuard test vectors [14] is narrower than it reads.
The vectors in the test suite check that the tally follows ElectionGuard's semantics. They do not establish conformance
with the ElectionGuard specification, and no conformance claim is made.

---

## Integrity, Privacy, and Security (Research Question 2)

The console mounted the attacks during a live election. It paused the election at four stages: after key
generation, halfway through the ballot window, after closing, and during the decryption ceremony. At each pause it
mounted the attacks defined for that stage, then resumed. Attacks in the ballot window were real submissions to the
chaincode. Attacks that cannot be expressed as one submission were mounted on a copy of the record and scored by the
verifier. Neither security run's throughput is used for Research Question 3.

### Integrity: Testing Scenarios T1 to T8

**Table 4.6. Integrity: Table 3.8 "Actual result and verdict" for scenarios T1 to T8.**

| ID | Scenario | Actual result | Verdict | Status |
|---|---|---|---|---|
| T1 | Normal voting operations | Every election at every completed tier accepted all valid ballots, with E = 0. Latency was recorded per tier (Table 4.13). | Pass to SP-1.92M and MP-50K. SP-3.5M: [PENDING: SP-3.5M, single-position on-chain capstone] | demonstrated |
| T2 | High-volume voter transactions | Rate sweep at SP-483K: offered 250, 400, 640, 1,024 and 1,638 ballots/s; committed 239.2, 388.5, 564.6, 610.9 and 595.7 TPS; plateau 610.9 TPS at an offered 1,024/s; 0 dropped in every step | Pass at SP-483K: plateau documented, no accepted ballot lost. One tier only | demonstrated |
| T3 | Network interruption and recovery | Planned: `peer0.org1` stopped for 20.3 s at 40 % of the SP-10K window; afterwards 10,000 of 10,000 ballots on chain, 0 missing, E = 0. Unplanned: the whole host lost power during SP-1.92M m1; resumed on the surviving ledger with 0 lost, E = 0, chain walk linked | Pass for a peer outage. The orderer was not stopped deliberately | demonstrated |
| T4 | Vote or election-return tampering | Live: a tampered proof and corrupted bytes were refused by the `cds` and `decode` gates. On a copy: an altered key-generation commitment was caught by the verifier (`dkg.decode`) and a dropped ballot by `stream.completeness`. Manipulated manifests and modification of committed records by an operator were not mounted | Pass for the mounted inputs. Manifest and committed-record modification not tested | demonstrated (mounted); implemented (manifest, unit tests) |
| T5 | Unauthorized access | Live: a self-issued credential was refused by the `issuer` gate and a reused nullifier by the `nullifier` gate. An invalid credential signature is covered by a chaincode unit test only. "Expired" credentials cannot occur: credentials carry no validity period | 100 % rejection of the mounted cases, each logged with its gate | demonstrated (mounted); implemented (signature) |
| T6 | Trustee validation and approval | The corrupted partial decryption was mounted on a copy and caught by the verifier's Chaum-Pedersen check. The chaincode checks only that the proof is present, so in the study build the partial was never committed on-chain. A sub-threshold attempt was not mounted in any study run. Three valid shares decrypted and signed the tally in every run | Partial. The sub-threshold refusal is shown on Saksi commit 1181015 (draft PR #57, not merged) and was not exercised on 4a38a54: [PENDING: T6 sub-threshold attempt, demonstration on a merged build] | demonstrated (detection on a copy; 3-of-5 publication); implemented (sub-threshold refusal) |
| T7 | Concurrent voting and result transmission | MP-1K security run: 3,000 records from 1,000 voters x 3 positions carried distinct per-position nullifiers and all were admitted; a copied nullifier was refused; every accepted ballot was counted exactly once (E = 0 on all 12 contests). The verifier ran after close, not during submission | Pass for per-position enforcement. Concurrent verifier read not exercised | demonstrated |
| T8 | Peak election conditions | SP-483K burst: 144,900 ballots unthrottled, completed at 512.9 TPS, p99 549.9 ms, 0 dropped, E = 0. The SP-1.92M capstone completed. The largest configured tier: [PENDING: SP-3.5M, single-position on-chain capstone] | Pass at SP-483K; the largest tier is pending | demonstrated (483K, 1.92M) |

Source: `negative-tests.csv` of `sp-10k-ch4-sec-20260929-183410-129` and `mp-1k-ch4-sec-20260930-185139-29`;
`docs/desktop-runs/2026-10-01-sp-483k.md` sections 4 and 5 (`f2d8921`); `docs/desktop-runs/2026-09-30-sp-10k-t3.md`;
`docs/desktop-runs/2026-10-01-sp-1.92m/m1/RESUMED.md`.

The system resisted every scenario it was exposed to under the stated threat model, and the table also shows what
was not tested. Two expected behaviours in Table 3.8 are not what the study build does:
- T6 expects the corrupted partial decryption to be committed on-chain and then detected. In the study runs it was
  detected on a copy of the record, and it was not committed.
- T4 lists manipulated manifests, which no study run mounted.

The sub-threshold half of T6 was not attempted on the study build. A refusal at 2 of 5 shares is implemented and
tested on an unmerged branch.

### Attack Scenarios in the Security Runs

**Table 4.7. Attack scenarios mounted during the security runs.**

| Scenario | Stage | Mount | Declared gate | Observed gate | SP-10K | MP-1K |
|---|---|---|---|---|---|---|
| tamper-dkg-transcript | dkg | simulated, verifier | dkg.decode | dkg.decode | PASS | PASS |
| tamper-ballot-proof | ballots | live on-chain | cds | cds | PASS | PASS |
| reused-nullifier | ballots | live on-chain | nullifier | nullifier | PASS | PASS |
| corrupted-ballot-bytes | ballots | live on-chain | decode | decode | PASS | PASS |
| self-issued-credential | ballots | live on-chain | issuer | issuer | PASS | PASS |
| overvote | ballots | live on-chain | selection | selection | PASS | PASS |
| dropped-ballot | close | simulated, verifier | stream.completeness | stream.completeness | PASS | PASS |
| reordered-ballots | close | not mounted | none | none | SKIPPED | SKIPPED |
| tamper-partial-decryption | ceremony | simulated, verifier | decryption.cp_proof | decryption.cp_proof | PASS | PASS |

Source: `negative-tests.csv` of both security runs; `docs/desktop-runs/2026-09-30-sp-10k-security.md` (`8739722`);
`docs/desktop-runs/2026-10-01-mp-1k-security.md` (`f2d8921`).

Eight scenarios passed and one was skipped in each run, a rejection rate of 8 of 8 per run *[demonstrated]*.
- **Live.** Five were live submissions, each refused by the chaincode with its own recorded reason: the
  validity-proof equation failed, the nullifier was already spent, the bytes could not be decoded, the credential's
  issuer was not the one bound to the election, and the selection proof did not match.
- **Verifier.** Three were caught by the verifier on a copy.
- **Skipped.** Reordering has no gate in either the chaincode or the stateless verifier. The tally is an
  order-independent homomorphic sum, so a reordering cannot change the result, but it is not detected. The skip is
  therefore a documented gap, not a pass.

The rate is one attempt per scenario per run, not a sampled rate. The issuer and selection gates exist from 4a38a54,
and both security runs were on that build.

### Tamper Trial

The tamper attacks of the study build are those of Table 4.7: three tamper scenarios (`tamper-dkg-transcript`,
`tamper-ballot-proof` and `tamper-partial-decryption`), mounted at their lifecycle stage in two security runs. All
three were refused or detected at their declared gate *[demonstrated]*. On 4a38a54 the chaincode admits nothing
tampered, so no committed record carried a tampered artifact in any study run.

An earlier tamper trial, run on 2026-09-15 on Saksi branch `feat/sample-chains` (commit 7272837, before the issuer
gate of 4a38a54), committed tampered artifacts to real channels (`sample-stuffing`, `sample-partial`):
- a forged self-issued ballot was committed and later flagged by the verifier (`ballot.issuer_binding`,
  `ballot.credential`);
- a tampered partial decryption was committed and later flagged by `decryption.cp_proof`.

That trial is the behaviour Table 3.8 describes for T6. It is cited as history only, not as a 4a38a54 result, because
its build predates the issuer gate (source: `.superpowers/sdd/2026-09-14-study-grade-wizard/progress.md`, entry of
2026-09-15).

### Negative Test Catalogue

**Table 4.8. Coverage of the fourteen-case negative test catalogue.**

| # | Case | Guarding gate or check | Exercised in the study runs (4a38a54) | Unit test (Saksi source at 4a38a54) | Status |
|---|---|---|---|---|---|
| 1 | Malformed ciphertext | decode (chaincode) | corrupted-ballot-bytes: PASS, live, both security runs | `TestSubmitBallotRejectsMalformedCiphertext` | demonstrated |
| 2 | Invalid or substituted validity proof | cds (chaincode) | tamper-ballot-proof: PASS, live, both runs | `TestSubmitBallotRejectsTamperedCDSProof` | demonstrated |
| 3 | Invalid or expired credential | credential signature (chaincode) | Not mounted. Credentials carry no validity period, so "expired" is not a reachable state | `TestSubmitBallotRejectsBadCredentialSignature` | implemented (invalid); design intent (expired) |
| 4 | Reused nullifier | nullifier (chaincode) | reused-nullifier: PASS, live, both runs | `TestSubmitBallotRejectsDoubleVote` | demonstrated |
| 5 | Duplicate vote for the same position | nullifier (chaincode), per position | reused-nullifier on the three-position MP-1K election: PASS, live | `TestSubmitBallotRejectsDoubleVote`; auditor `per_position_double_vote_is_caught` | demonstrated |
| 6 | Altered transaction | Fabric endorsement and signature checks | Not mounted; not exercised | none named | design intent (platform) |
| 7 | Altered manifest | verifier (election parameters, issuer binding) | No manifest edit mounted. An altered key-generation commitment was caught by the verifier (simulated) | `TestCreateElectionValidatesTheIssuerKey`; auditor `malicious_admin_altering_a_contest_id_is_detected` | implemented |
| 8 | Decryption with fewer than three shares | tally signature threshold (chaincode); `decryption.threshold` (verifier) | Not mounted; every ceremony published with 3 of 5 signers | `TestPublishTallyRejectsBelowThreshold`; on commit 1181015 (unmerged) `TestPublishAtTwoOfFiveIsRefusedWithReason` | implemented |
| 9 | Incorrect trustee decryption proof | `decryption.cp_proof` (verifier) | tamper-partial-decryption: PASS, simulated, both runs | chaincode checks presence only | demonstrated (verifier) |
| 10 | Submission from outside the channel membership | Fabric membership service | Not mounted; the chaincode reads no caller identity | none named | design intent (platform) |
| 11 | Credential not issued under the election's issuer key | issuer (chaincode) | self-issued-credential: PASS, live, both runs | `TestSubmitBallotIssuerBinding` | demonstrated |
| 12 | Overvote (a position's selections sum above one) | selection (chaincode) | overvote: PASS, live, both runs | `TestSubmitBallotSelectionProof` | demonstrated |
| 13 | Ballot record that names no position | shape (chaincode) | Not mounted | `TestSubmitBallotRefusesAnEmptyPositionOnAPositionedElection` | implemented |
| 14 | Corrupted ledger data | `stream.completeness` and chain walk (verifier) | dropped-ballot: PASS, simulated, both runs; chain walk PASS in T3 (204 linked blocks) and SP-1.92M m1 | auditor `a_corrupt_ballot_line_fails_the_stream_audit` | demonstrated |

Source: manuscript, Security section; Saksi test names at 4a38a54
(`packages/saksi-bulletin/chaincode/*_test.go`, `packages/saksi-auditor/src/*.rs`) as listed in
`.superpowers/sdd/2026-09-14-study-grade-wizard/adviser-items-5-6.md`; security-run `negative-tests.csv`.

Eight of the fourteen cases were exercised in the study runs, each refused or detected at its guarding gate (cases 1,
2, 4, 5, 9, 11, 12 and 14). Cases 3, 7, 8 and 13 have named unit tests, but no archived test-suite log at 4a38a54 yet:
[PENDING: test-suite and CI/SAST log at 4a38a54]. Cases 6 and 10 rest on Fabric itself and were not exercised. The
claim that every case "must be rejected by the specific gate that guards it" is therefore shown for eight cases,
implemented for four, and assumed of the platform for two.

### The Verifier's Fourteen Checks

**Table 4.9. The fourteen verifier checks of Chapter III and their evidence.**

| # | Check (Chapter III) | Nearest auditor check identifiers at 4a38a54 | Positive result in the study runs | Negative case exercised | Status |
|---|---|---|---|---|---|
| 1 | Validity of every recorded transaction | `ballot.shape`, `parameters.shape`, `dkg.shape`, `decryption.shape`, `tally.shape` | No failure in any audited run | Corrupted bytes refused upstream by the chaincode | demonstrated (positive) |
| 2 | Issuer key present; each credential issued under it | `parameters.issuer_binding`, `ballot.issuer_binding` | No failure | Self-issued credential refused upstream (issuer gate, live) | demonstrated |
| 3 | Validity of each credential signature | `ballot.credential` | No failure | Unit tests only | implemented |
| 4 | Nullifier uniqueness and derivation | `nullifier.unique` | No failure | Reused nullifier refused upstream (live) | demonstrated |
| 5 | Well-formedness of every ciphertext | `ballot.decode` | No failure | Corrupted bytes refused upstream (live) | demonstrated |
| 6 | Disjunctive validity proof of every slot | `ballot.cds_proof` | No failure | Tampered proof refused upstream (live) | demonstrated |
| 7 | Selection-sum proof of every position | `ballot.selection_sum` | No failure | Overvote refused upstream (live) | demonstrated |
| 8 | Completeness of the committed stream | `stream.completeness` | No failure | dropped-ballot caught (simulated) | demonstrated |
| 9 | Homomorphic aggregate recomputed | `tally.homomorphic_sum`, `tally.aggregate` | No failure | Unit test `wrong_tally_is_caught` | demonstrated (positive) |
| 10 | Key-generation commitments are group elements | `dkg.decode` | No failure | tamper-dkg-transcript caught (simulated) | demonstrated |
| 11 | Chaum-Pedersen decryption proof per trustee | `decryption.cp_proof` | No failure | tamper-partial-decryption caught (simulated) | demonstrated |
| 12 | At least three of five trustees contributed | `decryption.threshold` | No failure (3 of 5 in every run) | Unit tests only | implemented |
| 13 | Announced tally equals the decrypted aggregate | `tally.accuracy`, `tally.signatures` | No failure; E = 0 everywhere | Unit tests `wrong_tally_is_caught`, `tampered_tally_signature_is_caught` | demonstrated (positive) |
| 14 | Append-only consistency of the ledger | chain walk (`verify_only.chain`); `run.end` `ledger_audit` | `ledger_audit` "ok" on every run cited; chain walk PASS, linked, in T3 and SP-1.92M m1 | none mounted | demonstrated (positive) |

Source: `journal.ndjson` `stage.verify.end` (`overall`, `failed_checks`) and `run.end` of every run; auditor check
identifiers from `git grep` over `packages/saksi-auditor/src` at 4a38a54. The mapping of identifiers to the fourteen
numbered checks is by name and was not taken from a published table.

The verifier passed every audited election with no failed check *[demonstrated]*. For checks 8, 10 and 11 the study
also showed the negative direction: a fault was mounted and the verifier caught it. For checks 2, 4, 5, 6 and 7 the
chaincode refused the faulty input first, so the verifier never received it. These checks are defended twice, but the
study runs show only the chaincode refusing. Checks 3, 9, 12 and 13 rest on unit tests for their negative direction.

### Adversary Coverage

**Table 4.10. Adversary coverage: each Table 3.9 class mapped to scenarios and catalogue entries.**

| Class | Scenarios and catalogue cases | Evidence level | Coverage | Untested part |
|---|---|---|---|---|
| Malicious voter | reused-nullifier, tamper-ballot-proof, corrupted-ballot-bytes, overvote, self-issued-credential; cases 1, 2, 4, 5, 11, 12 | Live in both runs | Strong | "Expired" credential (no expiry concept) |
| Compromised client | tamper-ballot-proof (substituted proof), corrupted-ballot-bytes; cases 1, 2, 3 | Live; credential misuse by unit test | Partial | A ciphertext altered to another valid point with the old proof; "client holds no key material" is a design claim with no test |
| Malicious trustees (up to two) | tamper-partial-decryption, tamper-dkg-transcript; cases 8, 9 | Simulated (verifier); sub-threshold by unit test and on unmerged commit 1181015 | Weak on-chain | Corrupt partial never committed on-chain in the study build; sub-threshold decryption not attempted in a study run |
| Network adversary | reused-nullifier (replay); case 4 | Live | Replay covered | **Interception: no test.** The console serves plain HTTP |
| Ledger administrator or malicious bulletin-board node | dropped-ballot, reordered-ballots; case 14 | Simulated; reordering SKIPPED | Weak, simulated only | No attack by an actual peer or orderer operator; **reordering undetected**; **front-running a transcript or partial: no test, and not prevented** (no caller authorization) |
| External attacker | self-issued-credential; cases 10, 11 | Live (forged credential) | Partial | **Submission from outside the channel membership: no test** |
| Malicious administrator (text and Table 3.10; no Table 3.9 row) | case 7 | Unit tests only | Unit tests only | No catalogue entry, no study run; the class lacks a Table 3.9 row |
| Privacy adversary (text and Table 3.10) | none in the catalogue | Structural unit tests on a 5-voter fixture | Weak | **Tier-scale linkage join not run**: [PENDING: privacy linkage join over a tier export] |

Source: `.superpowers/sdd/2026-09-14-study-grade-wizard/adviser-items-5-6.md`, item 5, which cites test files and
lines at 4a38a54; Tables 4.7 and 4.8.

Every class named in the manuscript has at least one test, but coverage is uneven:
- Only the malicious voter is covered strongly, by five live gates in both a single- and a multi-position run.
- **No test at all** exists for interception, submission from outside the membership service, an expired
  credential, front-running, or detection of reordering.
- The malicious-administrator class appears in the text and in Table 3.10 but has no Table 3.9 row, so the
  statement that every class has a row does not hold for it.

### Reliability

**Table 4.11. Reliability: commit success and ballot loss per tier, and recovery.**

| Tier or run | Measured runs | Failed runs (console) | Ballots committed per run | Dropped | Recovery event | Result |
|---|---|---|---|---|---|---|
| SP-1K to MP-50K | 50 | 0 | all | 0 | none | 100 % success |
| SP-483K (1 + 3, burst) | 3 + burst | 0 | 483,000; 144,900 | 0 | none | 100 % success |
| SP-1M (Night 2) | 3 | 0 | 1,000,000 | 0 | none | 100 % success |
| SP-1M (Night 1, superseded) | 3 | 2 | m1 1,000,000; m2 932,700 | m2 67,300 | host data drive full at 07:34; m3 found no peer | environment fault (Instrument Findings); excluded |
| SP-1.92M (1 + 3) | 3 | 1 (m1, flagged `failed` after its resume: reason `nothing_submitted`, no `perf.csv`) | 1,921,917 in every run (m1: 881,628 + 1,040,289) | 0 | m1: host power loss at 19:07, resumed on the surviving ledger | 0 ballots lost; m1 verify pass, E = 0 |
| T3, SP-10K | 1 | 0 | 10,000 | 6,000 recorded as dropped by the closed loop at the stop, all resubmitted; 0 missing after resume | `peer0.org1` down 20.3 s at 40 % | 0 ballots lost, E = 0 |

**T3 detail (SP-10K):** peer down 20.3 s; ready 1.1 s after restart. At the stop the chain held 3,893 ballots and the
driver counted 4,000 committed. The chain held 4,045 when the resume began. The resume submitted 5,955, committed
5,955, with 0 dropped and 0 replays. Reconcile: 10,000 of 10,000, 0 missing. Chain walk PASS over 204 linked blocks
(9,958 receipts sampled). E = 0 on 4 contests.

Source: `summary.csv` per tier; `docs/desktop-runs/2026-10-01-sp-1m-night1.md`; `docs/desktop-runs/2026-09-30-sp-10k-t3.md`;
`docs/desktop-runs/2026-10-01-sp-1.92m/m1/RESUMED.md` and its `journal.ndjson` (`run.end` `resumed: true`).

No accepted ballot was lost in any standing run, so the Table 3.7 reliability criterion (100 % commit success, zero
ballot loss after recovery) was met *[demonstrated]*. The console's failure flag on SP-1.92M m1 is a bookkeeping
outcome of the resume: the run has no single uninterrupted ballot window and so no `perf.csv`. All 1,921,917 ballots
committed and the verification passed, so m1 is reported as a correctness record and excluded from the throughput
statistics (runbook section 10.7). By the console's flag the capstone's failure rate is 1 of 3 measured runs; by
ballot loss it is 0. Two qualifications apply:
- The closed-loop load generator counts every ballot after a fault as dropped. T3's 6,000 is therefore the rest of
  the window, not the loss over a 20-second outage.
- Only a peer was stopped deliberately. With a single orderer the study cannot demonstrate orderer crash tolerance,
  although the m1 power loss restarted the orderer along with everything else, and it recovered as Raft leader at
  block 17,640.

### Privacy

**Table 4.12. Privacy evaluation form.**

| Check | Method | Result | Status |
|---|---|---|---|
| Unlinkability | Linkage join over a tier export; success compared with 1/N | [PENDING: privacy linkage join over a tier export] | implemented (structural unit tests only) |
| Ballot secrecy | Inspection of the tally path in the run records | Held: each trustee submitted one partial decryption per contest (4 at SP-10K, 12 at MP-1K), on the aggregate ciphertext only; no ballot-level decryption occurs | demonstrated |
| Sub-threshold resistance | Decryption attempted with fewer than three shares | Not mounted in any study run. The chaincode refuses a sub-threshold tally (`TestPublishTallyRejectsBelowThreshold`); the console refusal at 2 of 5 is on unmerged commit 1181015 (draft PR #57); every ceremony published with 3 of 5 | implemented |

Source: ceremony journal events of `sp-10k-ch4-sec-20260929-183410-129` and `mp-1k-ch4-sec-20260930-185139-29`;
saksi PR #57.

Every run cited here is on 4a38a54, a descendant of 1812139, so the trustee key-generation polynomials were drawn at
random. The secrecy result therefore holds for these runs, which runs generated before 1812139 could not support. Two
limits bound it:
- The key-generation and registration ceremonies were simulated: one generator process produced every trustee share
  and every credential, so secrecy holds against every party except that process.
- Linkage across a voter's positions through timing or submission order was not analysed.

### Mapping to Philippine Electoral and Data Privacy Law

**Table 4.13. Simulated adversary classes, Philippine legal provisions, and observed outcomes.**

| Simulated adversary (threat) | Provision (Table 3.10) | Observed in this study |
|---|---|---|
| Malicious voter: double voting | BP 881, Sec. 261; penalties under Sec. 264 | Refused live by the nullifier gate in both security runs |
| Malicious voter: malformed ballot | BP 881, Sec. 261(j); RA 9369, Sec. 35 | Refused live by the decode, CDS and selection gates |
| Sub-threshold trustees: corrupt decryption | RA 9369, Sec. 35(a) | Altered decryption proof detected by the verifier; sub-threshold decryption not mounted |
| Malicious administrator: manipulate manifest | BP 881, Sec. 261(j); RA 9369, Sec. 35(a) | Manifest edit not mounted; altered key-generation commitment detected by the verifier |
| Malicious bulletin-board node: drop or reorder | RA 9369, Sec. 35(a) | Drop detected; reordering not detected (no effect on the tally) |
| Network adversary: interception or replay | RA 9369, Sec. 35; RA 10173, Sec. 29 | Replay refused; interception not tested (plain HTTP) |
| Privacy adversary: linkage or secrecy | RA 10173, Secs. 25, 28, 29 | Aggregate-only decryption held; linkage [PENDING: privacy linkage join over a tier export] |

Source: Table 3.10; Tables 4.7, 4.8 and 4.12. As in Chapter III, no claim of legal validity, compliance or
certification is made.

### Election Return Approval, Audit Trail and Limits

The threshold ceremony approved the decrypted tally in every run. Trustees 1, 2 and 3 of five submitted their
partial decryptions, and the tally was published with 3 signers at threshold 3. The chaincode checked the signatures
at publication. The verifier then established from the public record that the signed totals equal the decrypted
aggregate *[demonstrated]*. The ceremony was simulated, so trust separation between trustees was not exercised.

The audit trail was the ledger plus the per-run records: journal, performance export, correctness record,
negative-test record and, for the capstones, the resource trace. Every figure in this chapter was recomputed from
them.

The security results show resistance to the defined scenarios under the stated threat model. They are not a general
claim of security. Several limits were observed directly:
- the chaincode checks a key-generation transcript for shape only, and a partial-decryption proof for presence only;
- the chaincode performs no caller authorization;
- one machine hosted every node;
- the console served plain HTTP.

The implementation-level testing of Chapter III (input validation, static analysis, dependency scanning) has no
archived log at 4a38a54: [PENDING: test-suite and CI/SAST log at 4a38a54].

---

## Performance (Research Question 3)

Throughput is committed ballot records per second over the submission window (committed TPS); latency is the
client-observed submit-to-commit time per record. Figures are medians over measured repetitions as `summary.csv`
computes them (the lower middle value when n is even). Capstone throughput comes from the uninterrupted measured runs
m2 and m3, which are reported individually.

### Response Time

**Table 4.14. Response time: latency and throughput per tier, median over measured repetitions.**

| Tier | n | Committed TPS (min to max) | p50 ms | p95 ms | p99 ms | Driver ceiling TPS | Failure rate |
|---|---|---|---|---|---|---|---|
| SP-1K | 10 | 893.9 (741.1 to 944.4) | 143.9 | 180.0 | 227.9 | 862.5 | 0 |
| MP-1K | 10 | 924.6 (675.5 to 973.7) | 146.7 | 174.5 | 208.2 | 856.5 | 0 |
| SP-10K | 10 | 885.8 (853.9 to 955.9) | 146.0 | 206.2 | 252.7 | 872.5 | 0 |
| MP-10K | 10 | 789.3 (460.7 to 881.1) | 152.8 | 253.3 | 372.8 | 836.3 | 0 |
| SP-50K | 5 | 697.3 (613.7 to 735.0) | 163.0 | 277.7 | 417.2 | 785.2 | 0 |
| MP-50K | 5 | 570.3 (563.8 to 581.9) | 218.7 | 339.3 | 524.5 | 585.3 | 0 |
| SP-483K | 3 | 509.0 (450.2 to 533.2) | 246.3 | 446.9 | 537.6 | 519.8 | 0 |
| SP-1M | 3 | 574.5 (561.2 to 628.1) | 230.4 | 311.0 | 482.3 | 555.7 | 0 |
| SP-1.92M m2 | 1 | 633.3 | 182.6 | 283.8 | 460.4 | 701.0 | 0 |
| SP-1.92M m3 | 1 | 637.1 | 182.0 | 277.9 | 430.2 | 703.3 | 0 |
| SP-1.92M warm-up (not a statistic) | 1 | 632.0 | 183.7 | 276.6 | 437.8 | | |
| SP-3.5M | [PENDING: SP-3.5M, single-position on-chain capstone] | | | | | | |
| SP-483K burst (T8) | 1 | 512.9 | 232.2 | | 549.9 | | 0 |

Source: `summary.csv` of each tier export (rows 1K to 50K: `8739722`; SP-483K: `f2d8921`; SP-1M: `5aef011`; SP-1.92M:
`475bdfb`, `4f4a0d9`, `f8f5c34`). Burst: `sp-483k-ch4-20260930-213103-39`.

Latency stayed in the low hundreds of milliseconds at every tier *[demonstrated]*:
- p50 ran from 144 ms at SP-1K to 246 ms at SP-483K, and back to 182 ms at SP-1.92M;
- p99 stayed between 208 and 538 ms;
- under the T8 burst, p99 was 549.9 ms.

The latency does not grow with the electorate as such. It follows the ledger that had accumulated on the network
under the repetition (see Scalability).

### Scalability

**Table 4.15. Scalability: throughput, per-record cryptographic cost and accumulated ledger per tier.**

| Tier | Committed TPS (median) | Proof generation CPU ms / record | In-process verification ms / record | Records on the network before the last measured run | Repetitions per network |
|---|---|---|---|---|---|
| MP-1K (4 candidates) | 924.6 | 1.614 | 0.176 | up to 33,000 | 12 per network |
| SP-483K | 509.0 | 1.601 | 0.172 | 1,449,000 before m3 | 4 per network |
| SP-1M | 574.5 | 1.605 | 0.174 | 2,000,000 before m3 | 3 per network |
| SP-1.92M (m2, m3) | 633.3, 637.1 | 1.556, 1.560 | 0.169, 0.169 | 0 (fresh network per run) | 1 per network |

Source: `summary.csv` medians divided by records (`proof_gen_cpu_ms`, `proof_verify_inproc_ms`); the 1K figures from
`docs/desktop-runs/2026-10-01-night1.md` section 2; repetition layout from Table 4.2.

**Figure 4.1. Committed throughput against election size, single- and multi-position, on-chain.**
`docs/paper/ch4-figures/fig-4-1-tps.png` plots tiers to 50,000 voters only.
[PENDING: Figure 4.1 regeneration with SP-483K, SP-1M and SP-1.92M]

**Figure 4.2. p99 submit-to-commit latency against election size, on-chain.**
`docs/paper/ch4-figures/fig-4-2-p99.png` plots tiers to 50,000 voters only.
[PENDING: Figure 4.2 regeneration with SP-483K, SP-1M and SP-1.92M]

The per-record cryptographic cost was flat across a 1,900-fold range of election size *[demonstrated]*: 1.56 to 1.61
ms of CPU for proof generation and 0.17 to 0.18 ms for verification per record. That is the linear part of the cost
model, and it held.

Throughput did not fall monotonically with election size. From 1,000 to 483,000 voters it fell from about 900 to 509
TPS, but SP-1M reached a median of 574.5 and the capstone runs reached 633 to 637. The ordering of these figures
matches how much ledger was already on the network:
- At SP-483K and SP-1M the repetitions shared one network, and throughput fell repetition over repetition (533, 509,
  450 and 628, 574, 561 TPS).
- Each capstone repetition ran alone on a fresh network, and its throughput was close to SP-1M's first repetition on
  a fresh network (628.1).

One observation does not fit. The SP-483K warm-up, the first run on its network, committed 527.1 TPS. The study
suggests ledger accumulation as the main driver of the decline but has not isolated it. The 9 to 28 % slowdown
against the earlier build (Performance Log Analysis) also remains unexplained.

### Throughput: Saturation and Peak Burst

**Table 4.16. Throughput at saturation (T2) and under the peak burst (T8), SP-483K.**

| Step | Run | Offered /s | Concurrency | Committed | Committed TPS | p50 ms | p99 ms | Dropped |
|---|---|---|---|---|---|---|---|---|
| 1 | `sp-483k-ch4-20260930-205249-34` | 250 | 128 | 29,209 | 239.2 | 186.1 | 522.6 | 0 |
| 2 | `sp-483k-ch4-20260930-205931-35` | 400 | 214 | 47,418 | 388.5 | 167.6 | 622.7 | 0 |
| 3 | `sp-483k-ch4-20260930-210708-36` | 640 | 403 | 68,939 | 564.6 | 261.1 | 1,302.8 | 0 |
| **4 (plateau)** | `sp-483k-ch4-20260930-211446-37` | 1,024 | 1,339 | 74,632 | **610.9** | 2,025.2 | 3,523.3 | 0 |
| 5 | `sp-483k-ch4-20260930-212207-38` | 1,638.4 | 5,777 | 75,527 | 595.7 | 9,727.0 | 11,869.3 | 0 |
| Burst (T8) | `sp-483k-ch4-20260930-213103-39` | unthrottled, 144,900 ballots | 128 | 144,900 | 512.9 | 232.2 | 549.9 | 0 |

Source: `docs/desktop-runs/2026-10-01-sp-483k/sweep/summary.csv` (`plateau_tps` 610.928) and
`docs/desktop-runs/2026-10-01-sp-483k.md` sections 4 and 5 (`f2d8921`).

The sweep located a plateau of 610.9 TPS at SP-483K. Past the knee, latency became queueing: p99 rose from 1.3 s to
11.9 s, and no ballot was dropped *[demonstrated]*. The plateau is 20 % above the closed-loop median of the same tier.
The closed-loop figure is therefore a sustained rate for 128 records in flight and understates saturation by about
15 to 20 % at this scale. The burst committed a worst-case hour of Zamboanga City, 144,900 ballots sized as three times
the mean hourly arrival, in 282.5 s. Two limits apply:
- one sweep with 120 s steps;
- a peak-hour factor of 3 that is assumed, not measured.

The sweep was run at one tier only. Saturation at the capstones is not measured.

### Stage Timers, Validation Gate and Threshold Decryption

**Table 4.17. Stage timers, median over measured repetitions; validation gate timed separately.**

| Tier | Validation gate s (standalone, median of 3) | Generation wall s | Generation CPU s | Proof generation CPU s | Verification s (16 threads) | Aggregate ms | Combine ms | Decode ms | Submission window s |
|---|---|---|---|---|---|---|---|---|---|
| SP-1K | 0.055 | 0.2 | 2.7 | 1.6 | 0.18 | 1 | 0 | 0 | 1.1 |
| MP-1K | 0.004 | 0.6 | 7.5 | 4.8 | 0.53 | 4 | 1 | 0 | 3.2 |
| SP-10K | 0.056 | 2.0 | 27.4 | 16.1 | 1.85 | 14 | 0 | 3 | 10.8 |
| MP-10K | 0.007 | 5.6 | 75.6 | 48.5 | 5.17 | 44 | 1 | 9 | 36.4 |
| SP-50K | 0.064 | 10.0 | 137.7 | 80.8 | 8.65 | 73 | 0 | 4 | 71.7 |
| MP-50K | 0.019 | 27.9 | 380.7 | 244.9 | 26.00 | 224 | 1 | 20 | 263.0 |
| SP-483K | 0.158 | 96.1 | 1,318.0 | 773.4 | 82.85 | 769 | 0 | 14 | 948.9 |
| SP-1M | 0.208 | 207.2 | 2,737.8 | 1,605.3 | 174.04 | 1,488 | 0 | 20 | 1,740.7 |
| SP-1.92M m2 | 0.481 | 427.9 | 5,101.9 | 2,990.9 | 325.29 | 2,967 | 0 | 29 | 3,034.9 |
| SP-1.92M m3 | 0.481 | 416.8 | 5,115.4 | 2,998.1 | 324.90 | 3,023 | 0 | 29 | 3,016.5 |
| SP-3.5M | 0.800 | [PENDING: SP-3.5M, single-position on-chain capstone] | | | | | | | |
| MP-483K offline | 0.178 | [PENDING: MP-483K, multi-position offline (row 8)] | | | | | | | |
| MP-1M offline | 0.309 | [PENDING: MP-1M, multi-position offline (row 8)] | | | | | | | |
| MP-1.92M offline | 0.558 | [PENDING: MP-1.92M, multi-position offline (row 8)] | | | | | | | |
| MP-3.5M offline | 0.848 | [PENDING: MP-3.5M, multi-position offline (row 8)] | | | | | | | |

Source: `summary.csv` of each tier export; validation gate:
`docs/desktop-runs/2026-10-01-sp-1.92m/validation-gate-timing.md` and `.json` (`f9aa09b`).

**Table 4.18. Validation gate per tier (W3 #3): the seven-check, fail-closed data check, timed alone.**

| Tier | Voters (table rows) | Ballot records | Check s (median of 3) | Rows per second | Checks passing |
|---|---|---|---|---|---|
| SP-1K | 1,000 | 1,000 | 0.055 | 18,182 | 7 of 7 |
| SP-10K | 10,000 | 10,000 | 0.056 | 178,571 | 7 of 7 |
| SP-50K | 50,000 | 50,000 | 0.064 | 781,250 | 7 of 7 |
| SP-483K | 483,000 | 483,000 | 0.158 | 3,056,962 | 7 of 7 |
| SP-1M | 1,000,000 | 1,000,000 | 0.208 | 4,807,692 | 7 of 7 |
| SP-1.92M | 1,921,917 | 1,921,917 | 0.481 | 3,995,669 | 7 of 7 |
| SP-3.5M | 3,524,078 | 3,524,078 | 0.800 | 4,405,098 | 7 of 7 |
| MP-1K | 1,000 | 3,000 | 0.004 | 250,000 | 7 of 7 |
| MP-10K | 10,000 | 30,000 | 0.007 | 1,428,571 | 7 of 7 |
| MP-50K | 50,000 | 150,000 | 0.019 | 2,631,579 | 7 of 7 |
| MP-483K | 483,000 | 1,449,000 | 0.178 | 2,713,483 | 7 of 7 |
| MP-1M | 1,000,000 | 3,000,000 | 0.309 | 3,236,246 | 7 of 7 |
| MP-1.92M | 1,921,917 | 5,765,751 | 0.558 | 3,444,296 | 7 of 7 |
| MP-3.5M | 3,524,078 | 10,572,234 | 0.848 | 4,155,752 | 7 of 7 |

Source: `docs/desktop-runs/2026-10-01-sp-1.92m/validation-gate-timing.json` (`f9aa09b`), runs
`*-ch4-gate-20261001-101851-2` to `-102020-15`, ground-truth populations (no cryptography), checked three times each
between capstone runs on an idle network, seconds from the journal's `stage.check.end` `mono_ms`. Rows per second are
table rows (voters) per second.

The validation gate is a negligible cost against the cryptographic workload *[demonstrated]*:
- At SP-1.92M it took a median of 0.481 s, against 2,991 CPU-seconds of proof generation and 325 s of verification
  per repetition.
- It finished in under 0.85 s even at MP-3.5M (10,572,234 records), which confirms that its stream processing
  stays bounded at the largest population.

Inside the cryptographic runs, the same check stage recorded 0.30 to 2.53 s at SP-1.92M and 0.07 to 28.9 s at
SP-483K. These figures come from the journal's `stage.check.end` of each run, timed right after generation. The
spread is recorded, but its cause was not investigated, so the standalone timings are the figure reported for the
gate.

Threshold decryption was small in process at every tier: combine plus decode took at most 29 ms, at SP-1.92M. The
on-chain submission of partial decryptions dominated it. In the security runs each trustee submitted 4 partials in
8.2 s at SP-10K and 12 partials in 24.6 to 24.7 s at MP-1K. That is about 2.06 s per partial, close to the 2 s
batch timeout of the orderer, an explanation the study did not test.

### Resource Consumption

**Table 4.19. Peak CPU and memory per tier, median over measured repetitions (console sampler).**

| Tier | Peer CPU % | Orderer CPU % | Client CPU % | Peer memory MB | Orderer memory MB | Client memory MB |
|---|---|---|---|---|---|---|
| SP-1K, MP-1K | not sampled (window shorter than the 5 s sampler) | | | | | |
| SP-10K | 344.0 | 86.5 | 74.1 | 256.7 | 1,030.1 | 59.0 |
| MP-10K | 376.5 | 84.8 | 73.9 | 325.5 | 2,340.9 | 179.4 |
| SP-50K | 377.4 | 78.9 | 73.3 | 304.8 | 2,465.8 | 179.5 |
| MP-50K | 340.8 | 83.5 | 69.0 | 2,439.2 | 4,339.7 | 180.8 |
| SP-483K | 332.2 | 73.7 | 53.1 | 3,417.1 | 5,955.6 | 204.3 |
| SP-1M | 418.3 | 94.2 | 65.5 | 1,579.0 | 7,859.2 | 330.7 |
| SP-1.92M m2 | 413.7 | 81.3 | 67.5 | 707.9 | 8,343.6 | 419.1 |
| SP-1.92M m3 | 407.1 | 112.7 | 65.8 | 656.0 | 8,141.8 | 427.3 |
| SP-3.5M | [PENDING: SP-3.5M, single-position on-chain capstone] | | | | | |

Source: `summary.csv` of each tier export. CPU is percent of one core, of 1,600 % available.

**Table 4.20. Capstone resource trace (10 s external sampler), SP-1.92M ballot windows.**

| Run | Ballot window (local) | Samples | Windows CPU max % (includes the WSL VM) | Contended samples (> 25 % excluding the VM) | peer0.org1 CPU % peak / mean | Orderer CPU % peak | Windows available memory min MB | WSL MemAvailable min GB | WSL load1 mean (of 16) | Disk busy mean % C: / Q: |
|---|---|---|---|---|---|---|---|---|---|---|
| warm-up | 16:41:56 to 17:32:41 | 304 | 87.3 | not VM-corrected (302 raw) | 400.2 / 261.4 | 94.5 | 40 | 21.8 | 16.9 | 23.4 / 47.5 |
| m1 (window includes the outage) | 18:38:48 to 19:50:35 | 364 | 89.1 | flagged: user at the machine (354 raw) | 400.0 / 252.0, one sample 1,506.1 at 19:02:29 | 118.7 | 227 | 21.6 | 14.0 | 130.4 / 49.4 |
| m2 | 20:45:44 to 21:36:19 | 303 | 85.3 | 0 (reclassified; preflight host CPU 2.8 %) | 404.1 / 262.8 | 85.0 | 594 | 21.8 | 15.6 | 15.9 / 49.2 |
| m3 | 22:32:51 to 23:23:49 | 303 | 81.0 | 0 (max 23.3 % excluding the VM) | 416.2 / 270.6 | 103.8 | 461 | 21.7 | 15.4 | 21.7 / 47.9 |

Source: `resources.csv` and `resources-summary.txt` under `docs/desktop-runs/2026-10-01-sp-1.92m/<run>/`; minima
recomputed from `resources.csv` over each ballot window; `m2/NOTE.md` "Contention (corrected 22:20)".

Across the tiers no single container used more than about a quarter of the 1,600 % of processor available. The peer
peaked at 332 to 418 %, the orderer at 74 to 113 %.

The capstone trace shows where the load went:
- The WSL guest's run queue sat near its 16 processors through the ballot window, with a mean load of 15.4 to 16.9.
  That figure includes the chaincode container, which peaked at 460 to 490 %.
- The guest never ran short of memory: at least 21.6 GB stayed available.
- Windows' own available memory fell to between 40 and 594 MB, because the WSL VM holds most of the 31.9 GB host.
- The orderer's memory grew with the ledger, to 8.1 to 8.3 GB at SP-1.92M.

No resource was exhausted in any completed capstone run. Under the Chapter III rule there is therefore no scaling
limit to attribute at 1,921,917 voters.

Network utilization is not reported. All containers shared one host, so the traffic never left the machine.

### Disk Consumption

**Table 4.21. Ledger size on disk (`du -sb` after each item).**

| Item | Ballot records on the network | peer0.org1 bytes | Orderer bytes | Peer bytes per record |
|---|---|---|---|---|
| MP-1K security | 3,000 | 39,610,500 | 156,573,468 | ~13,200 (setup overhead dominates) |
| MP-1K, 10 candidates (7 elections) | 21,000 | 439,655,321 | 789,804,807 | ~20,900 |
| MP-1K, 28 candidates (7 elections) | 21,000 | 984,940,185 | 1,593,866,795 | ~46,900 |
| SP-483K (measured, sweep, burst) | ~2,372,700 | 28,109,465,672 | 23,430,185,389 | ~11,850 |
| SP-1M (Night 2) | 3,000,000 | 35,483,116,738 | 29,132,099,100 | 11,828 |
| SP-1.92M warm-up | 1,921,917 | 22,903,711,701 | 19,184,885,715 | 11,917 |
| SP-1.92M m1 | 1,921,917 | 22,845,034,111 | 19,151,726,583 | 11,887 |
| SP-1.92M m2 | 1,921,917 | 22,839,034,598 | 19,070,735,690 | 11,884 |
| SP-1.92M m3 | 1,921,917 | 22,823,819,846 | 19,054,649,272 | 11,876 |
| Rows 1K to 50K | not measured (the per-run ledger column was not wired) | | | |

Source: `ledger-size.txt` of each item (`f2d8921`, `5aef011`, `475bdfb`, `3b87854`, `4f4a0d9`, `f8f5c34`).

At four candidates the ledger costs 11.8 to 11.9 KB per ballot record on each peer, and the orderer about 9.7 to 10.0
KB *[demonstrated]*. The three copies of this test network together cost 33.4 to 33.7 KB per record. The per-record
size grows with the candidate count: about 20.9 KB at 10 candidates and 46.9 KB at 28.

The disk the host actually spent was about three times larger. Docker's virtual disk grows with every block the
guest writes for the first time after a compaction, including blocks rewritten by LevelDB compaction. The measured
growth, set out in Table 4.26, was 95 to 119 KB of host disk per record.

### Capstone Outcome

**Table 4.22. Capstone outcome (primary finding).**

| Capstone | Configuration | Outcome | Evidence |
|---|---|---|---|
| 1,921,917 voters (three Zamboanga Peninsula provinces) | single-position, on-chain, 1 + 3 | **Completed.** Every election committed all ballots and decoded exactly (E = 0, verifier pass). m2 633.3 TPS and m3 637.1 TPS sustained, p99 460 and 430 ms, about 11.9 times the ten-hour arrival rate. m1 resumed after a host power loss, with no ballot lost; it is a correctness record only. No resource exhausted | Tables 4.3, 4.11, 4.14, 4.20 |
| 3,524,078 voters (full ZAMBASULTA) | single-position, on-chain, 1 + 3 | **Not started.** Scheduled after the host power supply is replaced. Validation gate 0.800 s; disk rule 396 GB needed per repetition against about 435 GB free after compaction | [PENDING: SP-3.5M, single-position on-chain capstone] |
| 1,921,917 voters | multi-position, offline | **Not started** (row 8) | [PENDING: MP-1.92M, multi-position offline (row 8)] |
| 3,524,078 voters | multi-position, offline | **Not started** (row 8) | [PENDING: MP-3.5M, multi-position offline (row 8)] |
| 3,524,078 voters | multi-position, on-chain | **Not attempted.** At 10,572,234 records, the single-position per-record costs give about 356 GB of ledger across the three copies and more than 1.0 TB of host-disk growth, against a 931 GB data drive and the 150 GB of Table 3.12. These are measured per-record costs, not a result for this tier | Tables 4.21 and 4.26 |

The first capstone was completed. At 1,921,917 voters the system committed every ballot, decrypted an exact tally
and was independently verified, while sustaining about 12 times the election-day arrival rate *[demonstrated]*.

The repetition cut by a power loss counts as a finding about recovery, not a scaling limit:
- Windows logged Kernel-Power Event 41 with no bugcheck and no power-button press, the second that day. The System
  log holds ten such events since 24 September.
- The resource trace up to the cut shows no exhaustion: in its last samples Windows had 3.3 to 3.5 GB available and
  the guest 22.2 GB.
- The cut is therefore attributed to the host's power supply, which is suspected. The trace cannot by itself rule
  out a hard hang.

The run then recovered on its own ledger, with nothing lost and nothing double-counted.

The second single-position capstone and the multi-position capstones remain to be run. For the on-chain MP-3.5M run,
the measured per-record disk cost already exceeds this machine. That is a statement about the host, not a measured
scaling limit of the system.

### Candidate-Count Check

**Table 4.23. Per-record cost against candidates per position, MP-1K (3,000 records per election).**

| Candidates | Campaign | Generation CPU ms | Proof generation CPU ms | Verification ms (16 threads) | Submission window ms | p50 latency ms | Committed TPS |
|---|---|---|---|---|---|---|---|
| 4 | `campaign-20260929-180218-15` | 2.51 | 1.61 | 0.176 | 1.08 | 146.7 | 924.6 |
| 10 | `campaign-20260930-173157-4` | 5.73 | 3.98 | 0.395 | 1.86 | 230.9 | 536.5 |
| 28 | `campaign-20260930-175515-8` | 15.26 | 10.99 | 1.084 | 3.37 | 455.5 | 297.2 |
| Fit (fixed + per candidate k) | | 0.40 + 0.531k | 0.06 + 0.390k (R² 0.99999) | 0.020 + 0.0380k (R² 0.99992) | 0.81 + 0.092k (R² 0.990) | 98.9 + 12.77k (R² 0.999) | R² 0.836 (linear) |

Source: `summary.csv` medians / 3,000 of the three campaigns (`8739722`, `f2d8921`);
`docs/desktop-runs/2026-10-01-night1.md` section 2.

**Figure 4.3. Per-record time against candidates per position, MP-1K, with least-squares lines.**
`docs/paper/ch4-figures/fig-4-3-candidates.png` (still holds: same three campaigns).

The cryptographic cost per record is linear in the candidate count over a sevenfold range, with near-zero intercepts
*[demonstrated]*. Each candidate slot carries one ciphertext and one disjunctive proof, at about 0.39 ms of
generation and 0.038 ms of verification. The submission window per record is linear with a large fixed part (0.81 ms
plus 0.092 ms per candidate), so throughput fell from 924.6 to 297.2 TPS while proof generation grew 6.8 times.

These figures come from three points, so they show a trend rather than a validated model. The 10- and 28-candidate
campaigns were flagged for host CPU (a browser was running), which affects their throughput more than their CPU
times. A Philippine ballot with more candidates per position will cost more per record, in close to linear
proportion, and commit fewer records per second.

### Election-Day Arrival Rate

**Table 4.24. Committed throughput against the ten-hour arrival rate.**

| Tier | Voters | Arrival, records/s | Committed TPS (median) | Margin |
|---|---|---|---|---|
| SP-1K | 1,000 | 0.03 | 893.9 | 32,181x |
| MP-1K | 1,000 | 0.08 | 924.6 | 11,095x |
| SP-10K | 10,000 | 0.28 | 885.8 | 3,189x |
| MP-10K | 10,000 | 0.83 | 789.3 | 947x |
| SP-50K | 50,000 | 1.39 | 697.3 | 502x |
| MP-50K | 50,000 | 4.17 | 570.3 | 137x |
| SP-483K | 483,000 | 13.42 | 509.0 (slowest 450.2) | 37.9x (33.6x) |
| SP-1M | 1,000,000 | 27.78 | 574.5 | 20.7x |
| SP-1.92M | 1,921,917 | 53.39 | 633.3 (m2), 637.1 (m3) | 11.9x |
| SP-3.5M | 3,524,078 | 97.89 | [PENDING: SP-3.5M, single-position on-chain capstone] | |
| MP-3.5M on-chain | 3,524,078 | 293.67 | not attempted | |

Source: arrival = voters x positions / 36,000 s (Chapter III; `run.end` `arrival_tps`); TPS from Table 4.14.

The console's own `scaling_limit` verdict reads "inconclusive" in closed loop by construction, including on every
SP-483K, SP-1M and SP-1.92M run. The measured TPS is therefore compared with the arrival rate directly. Every
completed tier sustained at least 11.9 times the rate a ten-hour election day would impose *[demonstrated]*, so no
completed tier meets Chapter III's scaling-limit rule.

### Predicted Against Measured

**Table 4.25. Predicted against measured, per tier: run time, throughput and arrival margin.**

| Tier | Predicted h/run (cost model, fitted at ef663d1) | Measured h/run (first to last journal line) | Error | Throughput assumed (fit: 1/s; CLAIMS) | Measured TPS | Margin predicted at ~1,000 TPS (CLAIMS) | Margin measured |
|---|---|---|---|---|---|---|---|
| SP-483K | 0.309 | 0.480 (0.458, 0.480, 0.490) | +55 % | 805; ~1,000 | 509.0 | 74.5x | 37.9x |
| SP-1M | 0.632 | 0.939 (0.858, 0.939, 0.965) | +49 % | 805; ~1,000 | 574.5 | 36.0x | 20.7x |
| SP-1.92M | 1.207 | 1.622 (m2), 1.599 (m3) | +34 %, +32 % | 805; ~1,000 | 633.3, 637.1 | 18.7x | 11.9x |
| SP-3.5M | 2.195 | [PENDING: SP-3.5M, single-position on-chain capstone] | | 805; ~1,000 | | 10.2x | |
| MP-483K offline | 0.628 | [PENDING: MP-483K, multi-position offline (row 8)] | | n/a | | | |
| MP-1M offline | 1.300 | [PENDING: MP-1M, multi-position offline (row 8)] | | n/a | | | |
| MP-1.92M offline | 2.495 | [PENDING: MP-1.92M, multi-position offline (row 8)] | | n/a | | | |
| MP-3.5M offline | 4.547 | [PENDING: MP-3.5M, multi-position offline (row 8)] | | n/a | | | |
| MP-3.5M on-chain | 6.572 | not attempted | | 805; ~1,000 | | 3.4x | |

Source: `docs/desktop-runs/cost-model.md` section 3 (fitted on rows 2 to 4 at ef663d1; submit coefficient `s` 1.243
ms/record, that is 805 records/s); `docs/CLAIMS.md` RQ3 rows (~1,000 TPS; 10x and 3.4x margins); journals of each run.

**Table 4.26. Predicted against measured: disk.**

| Quantity | Predicted or planned | Measured | Source |
|---|---|---|---|
| Peer ledger per record, 4 candidates | 12,000 B (preflight projection) | 11,828 B (SP-1M); ~11,850 B (SP-483K); 11,876 to 11,917 B (SP-1.92M) | Table 4.21 |
| Ledger per million single-position ballots | 30 to 50 GB (Table 3.12) | 11.8 to 11.9 GB per peer copy; 33.4 to 33.7 GB across the three copies | Table 4.21 |
| Ledger across three copies per record | 34 KB (Night 2 budget); ~36 KB (Night 1 index) | 33.4 KB (SP-1M); 33.7 KB (SP-1.92M m3) | `ledger-size.txt` |
| Host disk growth per record | 34 KB (Night 2 budget, implicitly) | ~95 KB (SP-1M, at 2.0M records); ~101 KB (SP-1M, 3.0M records); 98.3, 118.8 and 110.3 KB (SP-1.92M warm-up, m2, m3, each from a freshly compacted disk) | study log 13:32, 14:48; `NOTE.md` "Disk after" against the start lines |
| Disk for MP-3.5M on-chain | 150 GB provisioned (Table 3.12) | about 356 GB of ledger and more than 1.0 TB of host growth at the measured per-record costs | Table 4.22 |

The linear model held where it modelled work per record. Per-record cryptographic cost was constant from 1,000 to
1,921,917 voters (Table 4.15). Per-record cost was linear in the candidate count with R² of at least 0.9999 (Table
4.23). Ledger bytes per record were constant across tiers and within 2 % of the preflight projection.

It did not hold in three places:
- **Throughput.** The model assumed about 805 records/s and CLAIMS about 1,000; the measured rates were 509 to 637.
  This made every run 32 to 55 % longer than predicted and halved the predicted arrival margins. The error shrank at
  the capstones, which ran on fresh networks.
- **Build.** The study build ran slower than the build the model was fitted on (Table 4.28), so the error mixes model
  and build.
- **Host disk.** It was not linear in the ledger. The virtual disk grew about three times faster than the data it
  held, and Table 3.12's provision for the full-ZAMBASULTA multi-position run is far short of the measured
  per-record cost.

The "linear cost model" claim should therefore be stated for per-record computation and ledger size. Throughput and
host disk should be reported as measured.

### Cross-Study Comparison with [18]

**Table 4.27. Cross-study comparison (not a controlled experiment: different hardware and deployment).**

| System | Scale and workload | Throughput | Latency | Hardware |
|---|---|---|---|---|
| Galal, El Reheem and Guirguis [18] | 50,000 voters, single race of four candidates, Hyperledger Fabric | ~4.66 TPS | ~1.07 s per vote | Different from this study |
| BalotaChain SP-50K | 50,000 voters, one position, four candidates, Fabric 2.5.15 | 697.3 TPS (median) | p50 163 ms, p99 417 ms | Table 4.1 |
| BalotaChain SP-1M | 1,000,000 voters, one position | 574.5 TPS (median) | p50 230 ms, p99 482 ms | Table 4.1 |
| BalotaChain SP-1.92M | 1,921,917 voters, one position | 633.3 and 637.1 TPS (m2, m3) | p50 182 to 183 ms, p99 430 to 460 ms | Table 4.1 |
| [18], beyond one million voters | projection | [PENDING: [18] beyond-one-million projection figure, quoted from the source] | | |
| Fabric 2.5 benchmark [24] | Fixed-asset workload, one million assets | ~3,000 TPS peak | | Different from this study |
| ElGamal homomorphic tally on Fabric [26] | Closest prior encrypted-tally evaluation | ~40 TPS peak | | Different from this study |

Source: manuscript, Performance section (pp. 60 to 61); Table 4.14.

This is a cross-study comparison, not a controlled experiment, because the hardware and deployment differ. At the
50,000-voter tier used for the direct comparison, BalotaChain committed 697.3 ballots per second against the
approximately 4.66 TPS of [18]. That is about 150 times as many, at a median latency of 163 ms against about 1.07 s
per vote. The figures also lie between the two reference points of Chapter III, above the approximately 40 TPS of
[26] and below the approximately 3,000 TPS of [24].

Three caveats apply:
- [18]'s per-vote time may not measure the same interval as submit-to-commit latency.
- BalotaChain's figures come from one machine that hosted every node and the load generator.
- The figures in this table are specific to the build: the study build ran 9 to 28 % slower than an earlier one
  (Table 4.28).

### Performance Log Analysis: Findings About the Instrument

The Performance log analysis experiment checks that the logs are consistent with the reported metrics. It found
five things that qualify the figures above.

**Table 4.28. Committed throughput on the study build against the earlier build ef663d1.**

| Tier | ef663d1 TPS | 4a38a54 TPS | Difference |
|---|---|---|---|
| SP-1K | 1,004.09 | 893.92 | -11.0 % |
| MP-1K | 1,011.79 | 924.61 | -8.6 % |
| SP-10K | 968.99 | 885.85 | -8.6 % |
| MP-10K | 954.69 | 789.35 | -17.3 % |
| SP-50K | 933.32 | 697.35 | -25.3 % |
| MP-50K | 793.02 | 570.29 | -28.1 % |

Source: `docs/desktop-runs/2026-09-12-rows2-4-parallel.md` section 7 (main); Table 4.14.

**Table 4.29. Measured repetitions with multi-second in-network stalls.**

| Tier | Campaign | Repetition | Committed TPS | p99 ms | Longest checkpoint gap s | Host CPU start / end % |
|---|---|---|---|---|---|---|
| MP-10K | `campaign-20260929-191104-23` (standing) | m6 | 460.672 | 2,903.0 | 10.6 | 13.7 / 1.9 |
| MP-10K | `campaign-20260929-191104-23` (standing) | m7 | 625.552 | 1,960.1 | 9.4 | 18.2 / 3.9 |
| SP-50K | `campaign-20260929-195715-27` (standing) | m3 | 613.702 | 1,785.0 | 4.8 | 2.9 / 5.8 |
| SP-50K | `campaign-20260929-193508-25` (superseded) | m2 | 642.827 | 698.0 | 6.3 | 2.4 / 11.0 |
| SP-50K | `campaign-20260929-193508-25` (superseded) | m3 | 590.038 | 2,005.0 | 7.8 | 4.4 / 8.6 |
| SP-483K | `campaign-20260930-185730-11` | m3 | 450.201 | 595.2 | 21.2 | 3.1 / 2.9 |

Source: `docs/desktop-runs/2026-09-30-ch4-study.md` section 2(c) (`8739722`); `docs/desktop-runs/2026-10-01-sp-483k.md`
section 3.

1. **The build difference.** The study build was 9 to 28 % slower than ef663d1 on the same six tiers and machine,
   and the gap widened with scale. The study did not isolate the cause:
   [PENDING: A/B of ef663d1 against 4a38a54 on one network (deferred by the researchers)]. The two sets of figures are
   not pooled.
2. **Throughput follows the accumulated ledger.** Throughput fell repetition over repetition wherever repetitions
   shared a network (SP-483K, SP-1M), and was highest on fresh networks (SP-1.92M; SP-1M m1). See Scalability.
3. **The contention rule counted the run's own load, twice.**
   - The guest load average flagged every repetition from 10,000 voters up, because it includes the run's own
     generation and audit. From Night 1 the rule used host CPU alone.
   - During the capstone, Windows' total processor time was found to include the WSL VM that runs the election, so
     every sample of an unloaded run read above 25 %.
   - The rule now subtracts the VM's processor time. Repetition 2 was reclassified as not contended, and repetition 3
     recorded none.
   - "Contended" is cited as interference in this chapter only where a corrected host sample or the study log
     supports it.
4. **In-network stalls.** Six measured repetitions stalled for 4.8 to 21.2 s between progress checkpoints while host
   CPU was low (Table 4.29). The tail rose, and the median did not. The cause lies inside the Fabric and Docker stack
   and was not identified. From Night 1, peer and orderer logs are kept for every run, but they have not been
   analysed.
5. **The host environment can fail a run that the system would complete.** In Night 1 the host data drive filled
   during SP-1M:
   - Docker's virtual disk could not grow, so the guest took the disk offline.
   - SP-1M m2 lost its last 67,300 ballots, and m3 found no peer.
   - Nothing in the instrument checked the host drive: the preflight reads the run store, and the guest sees the
     virtual disk's nominal 1 TB.

   After this, each capstone repetition ran on a freshly reset network, preceded by a host-disk check and, when
   needed, a compaction. The superseded attempt is kept and excluded.

---

## Summary of Findings

**Table 4.30. Findings against the objectives.**

| Objective | Finding | Status |
|---|---|---|
| 1. Implement the framework and verify correct end-to-end operation across scales | E = 0, no ballot lost, ledger matching the local record, and a passing verifier on every election from 1,000 to 1,921,917 voters single-position and 1,000 to 50,000 multi-position, warm-ups included; also under a peer restart and after a host power loss | Met to SP-1.92M and MP-50K. [PENDING: SP-3.5M, single-position on-chain capstone]; [PENDING: MP-483K to MP-3.5M, multi-position offline (row 8)]; [PENDING: RQ1e, verifier on a separate machine from a copied public record] |
| 2. Evaluate integrity, privacy and security under the threat model | 8 of 8 mounted attacks refused at the declared gate in each security run (5 live); 8 of 14 catalogue cases exercised; every class tested, but interception, outside-membership submission, expiry, front-running and reordering detection have no test; aggregate-only decryption held | Met for the mounted scenarios. [PENDING: privacy linkage join over a tier export]; [PENDING: test-suite and CI/SAST log at 4a38a54]; [PENDING: T6 sub-threshold attempt, demonstration on a merged build] |
| 3. Characterize performance and compare with a baseline on the same platform | 509 to 925 TPS, p99 208 to 538 ms; plateau 610.9 TPS and burst completed at SP-483K; first capstone completed at 633 to 637 TPS with no resource exhausted; per-record crypto cost flat with scale and linear in candidates; validation gate under 1 s at every tier; about 150 times the throughput of [18] at 50,000 voters (cross-study) | Met to SP-1.92M. [PENDING: SP-3.5M, single-position on-chain capstone]; MP-3.5M on-chain not attempted (disk) |

The framework operated correctly at every tier completed, up to the first ZAMBASULTA capstone of 1,921,917 voters:
- every announced tally equalled the ground truth;
- every accepted ballot was counted;
- every proof verified;
- the result was reproduced from the ledger's own record.

It refused every mounted attack at the gate declared for it, within the coverage and gaps of Table 4.10. On one
desktop that hosted the whole network, throughput stayed at least 11.9 times above the ten-hour arrival rate at every
tier measured, and the first capstone was completed with no resource exhausted. The full-region capstone and the
multi-position capstones decide the remaining scale claims.

---

## Appendix A Ground Truth (500 voters, 4 candidates, single position)

Re-verified on 2026-10-02 with the study build's generator (`saksi-demo` SHA-256 `112fffa0124943a4...`, saksi
`4a38a54`, WSL), using the plaintext-only path that writes the same population `gen` does:

```
saksi-demo gen-ground-truth --voters 500 --positions 1 --candidates 4 --distribution <profile> --out-dir <dir>
```

| Candidate | uniform | skewed | realistic |
|---|---|---|---|
| CAND_PRES_01 | 125 | 250 | **245** |
| CAND_PRES_02 | 125 | 84 | **90** |
| CAND_PRES_03 | 125 | 83 | **85** |
| CAND_PRES_04 | 125 | 83 | **80** |
| Total | 500 | 500 | 500 |

**Every Chapter IV run used `realistic`** (`run.json` `config.distribution`). The 250 / 84 / 83 / 83 currently in
Appendix A is still the correct output of the `skewed` profile. The tie-breaking change added `realistic` and left
the two original profiles unchanged, which a test pins (`fixtures.rs` `existing_profiles_are_untouched`). It is not
the distribution the study measured.

**The selection rule, in plain terms.**

- **Uniform.** Voter v chooses candidate (v + p) mod C for position p, so every candidate gets the same count.
- **Skewed.** Even-numbered voters choose the first candidate. Odd-numbered voters rotate over the others, so all
  the losing candidates end level.
- **Realistic.** This is the skewed rule with a reserved portion of the electorate held back and apportioned down
  the candidate ranks.
  - The reserved share is 10 % for the first position, 15 % for the second and 20 % for the third, repeating.
  - **The first floor:** the reserve is never smaller than C x (C + 1) voters, two votes per adjacent rank, so the
    spread between candidates cannot be finer than the rotation's own one-vote wobble.
  - The remaining voters vote by the skewed rule.
  - The reserve is shared out in proportion to C, C - 1, ..., 1 (4 : 3 : 2 : 1 for four candidates), and any integer
    remainder is dealt one vote at a time from the top rank down.
  - The reserved voters are taken out of the electorate, not added, so each voter still votes exactly once and every
    position's total equals the number of voters.
  - **The second floor:** if the first candidate does not lead after apportionment, one vote moves to it from the
    lowest-ranked candidate holding any. This guarantees a clear winner even in a very small electorate.
  - Voters are then placed into the candidate quotas through a permutation of the voter index (a golden-ratio stride
    made coprime to V). The counts are exact, and the ballot table reads as a mixed electorate rather than sorted
    runs.
  - All of this is integer arithmetic, so the result is the same on every machine.

**Worked example (V = 500, C = 4, first position).**
1. The reserve is max(50, 20) = 50, leaving 450 voters.
2. The skewed rule over 450 voters gives 225 / 75 / 75 / 75.
3. The reserve, split 4 : 3 : 2 : 1, adds 20 / 15 / 10 / 5.
4. The result is 245 / 90 / 85 / 80. The second floor does not trigger.

Three amendments follow for Appendix A:
- It should name three profiles, not two, and show `realistic` beside the existing table.
- The "pure arithmetic function" sentence should add the voter count V, because `realistic` apportions over the
  whole electorate and its stride depends on V.
- It should state that `realistic` was introduced in de79b0f and simplified in 3d8797e.

Source: `.superpowers/sdd/2026-09-14-study-grade-wizard/adviser-items-5-6.md`, item 6 (rule with `fixtures.rs` line
references at 4a38a54); counts re-run as above.

---

## Open Placeholders

| # | Placeholder | Where | What closes it |
|---|---|---|---|
| 1 | [PENDING: SP-3.5M, single-position on-chain capstone] | Tables 4.2, 4.3, 4.5, 4.6 (T1, T8), 4.14, 4.17, 4.19, 4.22, 4.24, 4.25, 4.30 | The SP-3.5M capstone, 1 warm-up + 3 measured, each on a freshly reset network after compaction (weekend, after the PSU replacement); its exports, `resources.csv` and `ledger-size.txt` per run |
| 2 | [PENDING: MP-483K, multi-position offline (row 8)] | Tables 4.2, 4.3, 4.5, 4.17, 4.25, 4.30 | Row 8 offline run at 483,000 x 3 (0 + 1) and its export |
| 3 | [PENDING: MP-1M, multi-position offline (row 8)] | as row 2 | Row 8 offline run at 1,000,000 x 3 |
| 4 | [PENDING: MP-1.92M, multi-position offline (row 8)] | as row 2, and Table 4.22 | Row 8 offline run at 1,921,917 x 3 |
| 5 | [PENDING: MP-3.5M, multi-position offline (row 8)] | as row 2, and Table 4.22 | Row 8 offline run at 3,524,078 x 3 |
| 6 | [PENDING: RQ1e, verifier on a separate machine from a copied public record] | Tables 4.5, 4.30 | Verifier run on a second machine from a copied public election record of a study run, with its output archived |
| 7 | [PENDING: privacy linkage join over a tier export] | Tables 4.10, 4.12, 4.13, 4.30 | The linkage join over a tier export (anonymity set = N), success rate against 1/N |
| 8 | [PENDING: test-suite and CI/SAST log at 4a38a54] | Tables 4.8, 4.30; Limits | Archived chaincode and auditor test-suite log plus the CI/SAST and dependency-scan log at commit 4a38a54 |
| 9 | [PENDING: T6 sub-threshold attempt, demonstration on a merged build] | Table 4.6, Table 4.30 | Merge of saksi PR #57 (`1181015`) after the capstone campaign, then one ceremony run showing the 2-of-5 refusal and the 3-of-5 publication, archived |
| 10 | [PENDING: Figure 4.1 regeneration with SP-483K, SP-1M and SP-1.92M] | Figure 4.1 | Rebuild `fig-4-1-tps.png` from the summary files of Table 4.14 (`ch4-data.json` update) |
| 11 | [PENDING: Figure 4.2 regeneration with SP-483K, SP-1M and SP-1.92M] | Figure 4.2 | Rebuild `fig-4-2-p99.png` likewise |
| 12 | [PENDING: [18] beyond-one-million projection figure, quoted from the source] | Table 4.27 | Quote [18]'s projected figure beyond one million voters, with page, from the reference itself |
| 13 | [PENDING: A/B of ef663d1 against 4a38a54 on one network (deferred by the researchers)] | Performance Log Analysis, finding 1 | A/B run of the two builds on one network; deferred until the researchers request it |
