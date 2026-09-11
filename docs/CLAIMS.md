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
| Runs executed on the declared desktop: AMD Ryzen 7 5700G, NVMe | measured | `docs/desktop-runs/2026-09-11-row2.md` §Environment; journal line 1 of every run | Fabric ran under WSL2 Ubuntu 26.04 with 16 vCPU and **15 GB of the 32 GB** allotted. Amend Table 3.12 to say so or raise `.wslconfig` memory before the capstone rows. |
| Fabric 2.5.15 test-network, 2 orgs, 1 Raft orderer, LevelDB, chaincode with on-chain CDS + tally-signature verification | measured | `saksi/tools/up.sh`, `docs/desktop-runs/2026-09-11-row2.md` | Single machine hosts client, peers and orderer. Not a multi-host deployment. |
| Orderer batch parameters: `BatchTimeout 2s`, `MaxMessageCount 10`, `PreferredMaxBytes 512 KB` (fabric-samples defaults) | measured | same; `docs/desktop-runs/2026-09-11-orderer-probe.md` when it lands | If the orderer probe shows ≥ 1.5× gain, the tuned values become the declared environment and rows 2–4 are rerun under them (path 2). Otherwise defaults stay and this row is the environment (path 1). Never describe a mid-experiment change; declare the configuration. |
| Load-generator concurrency is chosen per tier so the harness is not the ceiling (Ch. 3 rule: verdict withheld when `committed_tps ≥ 0.8 × driver_ceiling_tps`) | measured | probe tables in `2026-09-11-row2.md` §3 and `2026-09-11-rows3-4.md`; `saksi/packages/saksi-campaign/repeat.go` sweep sizing | This is calibration of the instrument, not a system change. Report the probe as the procedure that fixed `concurrency = 96`. |

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
| Ceremony is simulated: all partials and signatures are produced by the generator in one process and forwarded by the console | limitation, state it | `manuscript-amendments.md` §6 | Cryptography is real; trust separation between trustees is not exercised. |
| Partial-decryption Chaum-Pedersen proofs are checked for shape on-chain and verified cryptographically off-chain | limitation, state it | `saksi/packages/saksi-bulletin/chaincode/contract.go` `SubmitPartialDecryption`; `TODOS.md` | Full on-chain CP verification is a TODO, not a result. |

## RQ3 — performance and scaling

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| Sustained committed throughput on this desktop ≈ 470–490 TPS at concurrency 96–192, default orderer parameters | measured | probe tables (10K voters, 21–75 s windows): c=48 471, c=96 474, c=128 474, c=192 491 TPS; SP-1K 490, MP-1K 494 median over 10 reps | `scaling_limit` reads `inconclusive` under the strict 0.8 rule because the closed-loop driver's ceiling tracks TPS. Quote as a **lower bound** until the open-loop sweep (row 5) pins the plateau. |
| The throughput ceiling is the Fabric ordering/commit pipeline, not CPU and not the protocol's cryptography | measured | peer CPU peaks at ≈ 240 % of 1600 % and orderer ≈ 66 % while TPS is flat from c=96 to c=192; at c=256 p99 rises to 64 s and TPS falls 5× (queue collapse), still zero drops; on-chain CDS verification ≈ 1 ms per ballot at endorsement | One Raft orderer, 10 tx per block, serial block commit per peer. This is a platform property of the single-node test-network configuration. |
| The chain keeps up with election-day arrival at the largest tier: arrival = voters / 36,000 s → SP-3.5M 97 TPS (5.0× margin), MP-3.5M 292 TPS (1.6× margin) against 480 TPS sustained | predicted | arrival rule in the plan's Global Constraints; measured TPS above | Becomes **measured** when rows 7 and 9 report `scaling_limit = false`. |
| Latency at the operating point (c=96): p50 ≈ 190 ms, p95 ≈ 280 ms, p99 ≈ 440 ms at 10K; p50 ≈ 2.0 s at c=8 is the orderer `BatchTimeout`, not the system | measured | probe tables; superseded c=8 table in `2026-09-11-row2.md` §6 | Latency is client-observed submit→commit; Fabric phase timings (endorse/order/validate/commit) are not client-observable and are not reported (Ch. 3 amendment). |
| Whole-pipeline cost is linear in ballot records: T(n,p) = n·p·(g + s + v) + L(p) + c0, with L(p) = τ·(4 + trustees·p·candidates) fixed per run | measured (fit), predicted (capstones) | `docs/desktop-runs/cost-model.md` (fitted coefficients with 95 % CI, predictions rows 2–9, actual and error % as tiers land) | Predictions for rows 5–9 are committed before those rows run; the error % column is the honesty check. |
| Per-ballot cost split on this box at c=96: submit ≈ 2.0 ms, verify ≈ 4.9 ms (ledger dump ≈ half, two auditor passes ≈ half), generate ≈ 0.2 ms; lifecycle tail ≈ 48 s (SP) / 128 s (MP) per run | measured | `2026-09-11-row2.md` §7 (corrected model, predicts rep wall clock within 3–6 %) | Verify, not the chain, dominates capstone wall time. |
| Offline pipeline (generate + verify, no chain) runs at ≈ 600 ballots/s on this box | measured (one datapoint) | `offline-mp-10k` on a Fabric-less console, `2026-09-11-row2.md` §7 | Single run; row 8 will give four more. |
| Full end-to-end verification of a 3.5M-voter single-position election in under one working day on one desktop | predicted | cost model: SP-3.5M ≈ 6.9 h per run, MP-3.5M ≈ 20.7 h | Pending rows 7 and 9. |

## Hardware and deployment claims (scope carefully)

| Claim | Status | Evidence | Caveat |
|---|---|---|---|
| Generation and the auditor passes scale with cores (rayon); more cores shorten g and the audit half of v | hypothesis, supportable | `gen-timings.json` `*_cpu_ms > wall_ms`; auditor stream tests | Not measured across core counts. Say "expected", give the model's share of T these terms represent. |
| Submission throughput and the ledger dump scale with the Fabric deployment (dedicated peer/orderer hosts, more orderers, larger blocks), not with the client machine | hypothesis, supportable | peer CPU ≈ 15 % of the box while TPS is flat; orderer probe result when it lands | Do **not** write "faster hardware makes the chain faster". Write "a production deployment separates the roles this test co-hosts". |
| A custom Fabric fork could raise the ceiling | hypothesis, **future work only** | none from this cycle | We measured that the ceiling is the platform's ordering/commit path, not the protocol's cryptography (≈ 1 ms per ballot of CDS verification against ≈ 2 ms per ballot of platform cost at 480 TPS). That supports "the protocol is not the limit" and "platform tuning or a different ordering configuration is the lever". A fork is a claim we cannot test here; list it under future work beside orderer tuning, multi-orderer Raft, and batched ledger reads, and cite the probe numbers as the reason. |
| Commodity, government-procurable hardware suffices for national-scale ingest with full verification in one day | predicted | arrival-margin row above; cost-model predictions | Conditional on rows 7 and 9. State the exact machine and that it is one box. |

## Instrument findings worth a sentence each

- Concurrency 8 measured the orderer's 2 s `BatchTimeout` (3.9 TPS, p50 2037 ms ± 5 ms); the driver-ceiling rule flagged it as inconclusive, which is the instrument working. `2026-09-11-row2.md` §6.
- `mode: offline` on a Fabric-wired console still submitted on-chain through the ceremony phase; fixed in saksi PR #37 with zero-ledger-call tests. The first ladder therefore proved the on-chain path at four tiers.
- `--repeat` issued a duplicate `CreateElection` on on-chain runs (rejected by the chaincode, harmless, noisy); fixed in the same PR.
- `ledger_bytes_delta` was empty in every run because `up.sh` does not pass `--fabric-peer-volume`; ledger growth per ballot (≈ 12 KB planned) is unmeasured until that flag is wired. Do not cite a ledger size without it.

## Optimizations in flight or queued (change no reported number unless stated)

- Concurrency calibration (done: c = 96).
- Orderer batch-size probe (queued after row 4): changes TPS; declare or discard per the rule above.
- Batched `GetBallots` ledger read and concurrent partial decryptions (`TODOS.md`): shorten v and L; no reported number changes except the auditor stage timers if the audit is parallelised, which must then be declared.
