# Chapter 4 claims register

What we can say, what backs it, and what is still a hypothesis. One row per
claim. Status: **measured** (artifact exists), **predicted** (model, artifact
pending), **pending** (run scheduled), **hypothesis** (not testable in this
cycle; write as future work, never as a result). Update when a row lands.

Evidence paths are relative to this repo unless prefixed `saksi/`. Every measured
number traces to a run folder whose `journal.ndjson` line 1 records the
environment and whose `run.json` records the config and both repos' commits.

## Environment (Table 3.12)

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| Runs executed on the declared desktop: AMD Ryzen 7 5700G, NVMe | measured | `docs/desktop-runs/2026-09-11-row2.md` §Environment; journal line 1 of every run | Fabric runs under WSL2 Ubuntu 26.04 (16 vCPU) with **24 GB of the 32 GB** allotted and swap off (`.wslconfig`, from 2026-09-12), on Docker Desktop whose data disk (`docker_data.vhdx`) sits on the NVMe. Runs before 2026-09-12 had 15 GB and the disk on the SATA SSD; they are superseded for RQ3 and kept only as instrument findings. Table 3.12 must name the WSL2 + Docker Desktop layer. |
| Fabric 2.5.15 test-network, 2 orgs, 1 Raft orderer, LevelDB, chaincode with on-chain CDS + tally-signature verification | measured | `saksi/tools/up.sh`, `docs/desktop-runs/2026-09-11-row2.md` | Single machine hosts client, peers and orderer. Not a multi-host deployment. |
| Orderer batch parameters (declared environment): `BatchTimeout 2s`, `MaxMessageCount 50`, `PreferredMaxBytes 2 MB`, `SnapshotIntervalSize 256 MB`; `AbsoluteMaxBytes` default | measured | saksi `packages/saksi-bulletin/network/configtx.yaml` (installed by `network.sh` on every bring-up, saksi PR #39); `orderer_batch` in journal line 1; probe in `docs/desktop-runs/2026-09-11-orderer-probe.md` | Chosen by a pre-registered probe (defaults 488/465 TPS at c=96/192; 50/2s 812/1006 TPS, p99 halved, zero gaps). Declared in Ch. 3 as the platform configuration, not described as a mid-experiment change. Rule the probe established: `MaxMessageCount` must not exceed the steady in-flight ballot count, or `BatchTimeout` must sit far below target latency, else every block waits the timeout (c=8 on defaults: 3.9 TPS; 500/2s at c=96: 45 TPS). `SAKSI_CONFIGTX=default` reproduces stock Fabric for A/B. |
| Load-generator concurrency is chosen per tier so the harness is not the ceiling (Ch. 3 rule: verdict withheld when `committed_tps ≥ 0.8 × driver_ceiling_tps`) | measured | probe tables in `2026-09-11-row2.md` §3, `2026-09-11-orderer-probe.md`, and the rows 2–4 note under the declared config | Calibration of the instrument, not a system change. Under the declared config the probe chose `concurrency = 128` (lowest c within 15 % of the best TPS with p99 < 1 s and no gaps ≥ 3 s): c=128 926, c=192 853, c=256 805, c=384 967 TPS. |

## RQ1 — correctness

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| Every contest decodes exactly the seeded ground truth (E = 0) at 1K, 10K, 50K on-chain across all measured repetitions | measured (1K), pending (10K, 50K running) | `correctness.csv` per run; `summary.csv` `runs_failed = 0` | `ground_truth` on `source=ledger` rows comes from the local header; the chain publishes none. |
| Validation ladder (1/10/100/1000 voters × 3 positions) passes and gates every larger tier to the exact commit | measured | `ladder.json` (commit `302d569`, rerun on `3cb07fc`) | First ladder ran on-chain by accident (offline-mode defect, fixed in saksi PR #37); the rerun is the offline gate as designed. Both passed. |
| The chain's own record equals the console's: same nullifier set, same per-contest aggregate ciphertexts (`ledger_matches_local = true`) | measured (1K), pending (larger) | `correctness.csv` `source=ledger` rows; `run.end` journal event | A mismatch is a finding, not a failure; none seen. |
| Capstone tiers verify with bounded memory (streaming generator and auditor) | predicted | `saksi/packages/saksi-auditor/src/stream.rs` tests; row 8 offline runs | Nullifier set ≈ 32 B × ballots (≈ 340 MB at 10.5M). Pending row 8. |

## RQ2 — integrity and security

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| Published tally carries trustee Schnorr signatures; the chaincode rejects a tally below threshold, with duplicate or unknown signers, or with a non-verifying signature | measured | `saksi/packages/saksi-bulletin/chaincode/sigverify/`, golden vector `tally-sig-v1.hex`; `trail.ndjson` check 10 per run | Harness (no-ceremony) path publishes the generator's full n-of-n set; the trustee-ceremony path publishes only the signers who took part. Say which path produced the reported run (`manuscript-amendments.md` §6). |
| Append-only chain walk passes: `previous_hash` linkage over the run's block range and sampled `receipt.block_hash` equal the recomputed header hash | measured | `VerifyChain` result in `trail.ndjson` / `run.end`; `saksi/packages/saksi-bulletin/client-sdk/ledger.go` | "not run" (never PASS) when qscc is unavailable. |
| Mutation scenarios are rejected at the layer that owns them (rate reported, not count) | measured (offline) | `negative-tests.csv` from Scenarios runs | `--repeat` runs do not execute Scenarios; the rate comes from dedicated Scenarios runs. |
| Harness elections use a random DKG: every trustee's polynomial coefficient is drawn from `OsRng`, so the election's secret key is not derivable from the source | measured (code and tests) | saksi #50 (merge `1812139`): `Dealer::random` in `saksi/packages/saksi-crypto/src/dkg.rs`, `gen_prologue` in `saksi/packages/saksi-auditor/src/fixtures.rs`, tests `every_generated_election_gets_a_fresh_dkg` and `random_dealers_are_fresh_and_their_key_decrypts_at_threshold`; `manuscript-amendments.md` §10 | Runs generated before saksi `1812139` used fixed dealer polynomials, so their keys can be derived from the source: they support correctness, verifiability, integrity and performance results, not ballot secrecy. A secrecy claim cites a run whose `run.json` `git_head_saksi` is `1812139` or later. |
| Ceremony is simulated: all partials and signatures are produced by the generator in one process and forwarded by the console | limitation, state it | `manuscript-amendments.md` §6 | Cryptography is real; trust separation between trustees is not exercised. |
| Partial-decryption Chaum-Pedersen proofs are checked for shape on-chain and verified cryptographically off-chain | limitation, state it | `saksi/packages/saksi-bulletin/chaincode/contract.go` `SubmitPartialDecryption`; `TODOS.md` | Full on-chain CP verification is a TODO, not a result. |

## RQ3 — performance and scaling

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| Sustained committed throughput on this desktop ≈ 920–1000 TPS at concurrency 128, declared orderer parameters, NVMe-backed storage | measured (1K, 10K), pending (50K) | SP-1K median 995 TPS and MP-1K 952 TPS over 10 measured reps each (p99 ≤ 271 ms, 0 failed); 10K probe rows | `scaling_limit` may still read `inconclusive` when TPS sits near the closed-loop driver ceiling; quote as a **lower bound** until the open-loop sweep (row 5) pins the plateau. The earlier 470–490 TPS figure is the stock-Fabric (defaults) configuration and belongs to the orderer-probe sensitivity result. |
| The throughput ceiling is the Fabric ordering/commit pipeline, not CPU and not the protocol's cryptography | measured | Two configurations on one box: stock defaults (10 tx/block) plateau at ≈ 480 TPS with peer CPU ≈ 240 % and orderer ≈ 66 % of 1600 %, and collapse at c=256 (p99 64 s, TPS ÷5, zero drops); the declared 50 tx/block reaches ≈ 920–1000 TPS with peer CPU ≈ 372 % and orderer ≈ 100 %. Raising block size, and nothing else, doubled throughput while the machine stayed under a quarter busy. On-chain CDS verification ≈ 1 ms per ballot at endorsement. | One Raft orderer and serial block commit per peer on a single-host test network. A platform property of this configuration; multi-orderer or multi-host deployments are future work. |
| The chain keeps up with election-day arrival at the largest tier: arrival = voters / 36,000 s → SP-3.5M 97 TPS (≈ 10× margin), MP-3.5M 292 TPS (≈ 3.4× margin) against ≈ 1000 TPS sustained under the declared config | predicted | arrival rule in the plan's Global Constraints; measured TPS above | Becomes **measured** when rows 7 and 9 report `scaling_limit = false`. On stock defaults the margins were 5.0× and 1.6×. |
| Latency at the operating point: p50 ≈ 150 ms, p99 ≈ 230–270 ms (declared config, c=128); on stock defaults c=96 gave p50 ≈ 190 ms, p99 ≈ 440 ms; p50 ≈ 2.0 s at c=8 on defaults is the orderer `BatchTimeout`, not the system | measured | rows 2–4 note (declared config); probe tables; superseded c=8 table in `2026-09-11-row2.md` §6 | Latency is client-observed submit→commit; Fabric phase timings (endorse/order/validate/commit) are not client-observable and are not reported (Ch. 3 amendment). |
| Whole-pipeline cost is linear in ballot records: T(n,p) = n·p·(g + s + v) + L(p) + c0, with L(p) = τ·(4 + trustees·p·candidates) fixed per run | measured (fit), predicted (capstones) | `docs/desktop-runs/cost-model.md` (fitted coefficients with 95 % CI, predictions rows 2–9, actual and error % as tiers land) | Predictions for rows 5–9 are committed before those rows run; the error % column is the honesty check. |
| Per-ballot cost split (being refitted under the declared config): submit ≈ 1.0 ms at ~1000 TPS; ledger dump ≈ 0.7 ms (batched `GetBallots`, saksi PR #38); two auditor passes ≈ 1.42 ms each on one core, ≈ 0.2 ms each on 16 threads once saksi PR #40 is deployed; generate ≈ 0.2 ms; fixed per run ≈ 12 s (lifecycle partials submitted concurrently, PR #38) | measured (split from MP-1K/SP-1K journals), refit pending | `docs/desktop-runs/cost-model.md` (refit by the rows 2–4 note); `timings.json` `verify_ballots` / `verify_threads` | Stale figures from 2026-09-11 (submit 2.0, verify 4.9, lifecycle 48/128 s) describe the defaults/SATA/old-code state. |
| Offline pipeline (generate + verify, no chain) runs at ≈ 600 ballots/s on this box | measured (one datapoint) | `offline-mp-10k` on a Fabric-less console, `2026-09-11-row2.md` §7 | Single run; row 8 will give four more. |
| Full end-to-end verification of a 3.5M-voter single-position election in under one working day on one desktop | predicted | cost model: SP-3.5M ≈ 6.9 h per run, MP-3.5M ≈ 20.7 h | Pending rows 7 and 9. |

## Hardware and deployment claims (scope carefully)

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| Generation and the auditor passes scale with cores (rayon); more cores shorten g and the audit half of v | hypothesis, supportable | `gen-timings.json` `*_cpu_ms > wall_ms`; auditor stream tests | Not measured across core counts. Say "expected", give the model's share of T these terms represent. |
| Submission throughput and the ledger dump scale with the Fabric deployment (dedicated peer/orderer hosts, more orderers, larger blocks), not with the client machine | hypothesis, supportable | peer CPU ≈ 15 % of the box while TPS is flat; orderer probe result when it lands | Do **not** write "faster hardware makes the chain faster". Write "a production deployment separates the roles this test co-hosts". |
| A custom Fabric fork could raise the ceiling | hypothesis, **future work only** | none from this cycle | We measured that the ceiling is the platform's ordering/commit path, not the protocol's cryptography (≈ 1 ms per ballot of CDS verification against ≈ 2 ms per ballot of platform cost at 480 TPS). That supports "the protocol is not the limit" and "platform tuning or a different ordering configuration is the lever". A fork is a claim we cannot test here; list it under future work beside orderer tuning, multi-orderer Raft, and batched ledger reads, and cite the probe numbers as the reason. |
| Commodity, government-procurable hardware suffices for national-scale ingest with full verification in one day | predicted | arrival-margin row above; cost-model predictions | Conditional on rows 7 and 9. State the exact machine and that it is one box. |
| Verifier timing meaning: `proof_verify_inproc_ms` (and `timings.json` `verify_ballots`) is wall-clock on `verify_threads` threads; proof generation (`proof_gen_cpu_ms`) is CPU time summed across threads | rule, state it | saksi PR #40 (`perf-schema.md`, runbook); `verify_threads` column in `perf.csv` | Never form a generation/verification ratio from the two without normalizing. Runs before PR #40 have no `verify_threads` (serial, = 1). A public verifier using all cores is a legitimate claim; report the thread count beside every verification time. |

## Instrument findings worth a sentence each

- Storage stall on the SATA-backed Docker disk: both peers' block commits took up to 7.8 s at once (`block_and_pvtdata_commit` dominant, `state_validation=0ms`), with Raft `slow fdatasync` warnings. Idle fsync on that virtual disk was p50 3.5 ms / max 59 ms against 0.8 / 3 ms native. After moving the disk to the NVMe: fsync p50 1.35 / max 3.3 ms, peer commit max 54 ms, zero block gaps. The instrument's p99 and gap counts are what exposed it. `2026-09-11-orderer-probe.md`.
- Concurrency 8 measured the orderer's 2 s `BatchTimeout` (3.9 TPS, p50 2037 ms ± 5 ms); the driver-ceiling rule flagged it as inconclusive, which is the instrument working. `2026-09-11-row2.md` §6.
- `mode: offline` on a Fabric-wired console still submitted on-chain through the ceremony phase; fixed in saksi PR #37 with zero-ledger-call tests. The first ladder therefore proved the on-chain path at four tiers.
- `--repeat` issued a duplicate `CreateElection` on on-chain runs (rejected by the chaincode, harmless, noisy); fixed in the same PR.
- `ledger_bytes_delta` was empty in every run because `up.sh` does not pass `--fabric-peer-volume`; ledger growth per ballot (≈ 12 KB planned) is unmeasured until that flag is wired. Do not cite a ledger size without it.

## Optimizations in flight or queued (change no reported number unless stated)

- Concurrency calibration (done: c = 96).
- Orderer batch-size probe (queued after row 4): changes TPS; declare or discard per the rule above.
- Batched `GetBallots` ledger read and concurrent partial decryptions (`TODOS.md`): shorten v and L; no reported number changes except the auditor stage timers if the audit is parallelised, which must then be declared.
