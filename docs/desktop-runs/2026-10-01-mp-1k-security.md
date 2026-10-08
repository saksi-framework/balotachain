# Chapter 4 study, Night 1: MP-1K security run on saksi `4a38a54`

Executed 2026-10-01 02:49–02:55 local time (2026-09-30 18:49–18:55 UTC) on the Ryzen desktop under WSL2, as Night 1 item 2. The network was reset first. This is one MP-1K election with the attack timeline on, per saksi runbook §10.5, run through the API by `~/ch4/night1.py`. It is the multi-position counterpart of the SP-10K security run of 2026-09-30. It covers all four attack stages and all nine scenarios, with a live per-position nullifier check on a three-position ballot (T7). **Its throughput is not for RQ3**: `perf.csv` carries `security_run = true`. Night index: [`2026-10-01-night1.md`](2026-10-01-night1.md).

Artifacts are in `docs/desktop-runs/2026-10-01-mp-1k-security/`:
- `preflight.json`;
- under `mp-1k-ch4-sec-20260930-185139-29/`: `run.json`, `perf.csv`, `perf-schema.md`, `correctness.csv`, `negative-tests.csv`, `journal.ndjson`, `timings.json`, `scenarios.json`, `ground-truth-check.json`, `submit-metrics.json`, `ceremony.json`;
- `logs/ledger-size.txt`. The peer and orderer logs are in WSL at `~/ch4/night1/logs/mp-1k-ch4-sec/`.

The ballots, receipts, ledger dump and mutated scenario copies stay in WSL.

## 1. Build and environment

- saksi and console **`4a38a54fe0223b58f28c53ec54e47fbeab222837`**; the machine and orderer are as in [cand10](2026-10-01-mp-1k-cand10.md) §1.
- Brave had been closed before this item.

| | |
|---|---|
| Run | **`mp-1k-ch4-sec-20260930-185139-29`** (`MP-1K ch4 sec`) |
| Election | 1,000 voters x 3 positions (president, vice-president, senator), 4 candidates, 5 trustees, threshold 3, `realistic`, on-chain, concurrency 128 |
| Attack plan | stages `dkg`, `ballots`, `close`, `ceremony`; `ballots_at` 0.5; `timeout_s` 300; every pause decided **run all** |
| Network | fresh: reset `network-reset-20260930-184935-9` (1000 x 3), done, chain height 6, 92 s |
| Preflight host sample | 2026-09-30T18:51:35Z: host CPU 6.1 %, guest load1 1.40 / load5 0.84; warnings `[]` |

## 2. Verdicts

The verdicts come from `negative-tests.csv`:

| Scenario | Stage | Mount | Election state at mount | Declared gate | Observed gate | Verdict |
|---|---|---|---|---|---|---|
| `tamper-dkg-transcript` | dkg | simulated | open, 0 committed, height 7 | auditor `dkg.decode` | `dkg.decode` | **PASS** |
| `tamper-ballot-proof` | ballots | **live submission** | open, 1,500 committed, height 38 | chaincode `cds` | `cds` | **PASS** |
| `reused-nullifier` | ballots | **live submission** | open, 1,500 committed, height 38 | chaincode `nullifier` | `nullifier` | **PASS** |
| `corrupted-ballot-bytes` | ballots | **live submission** | open, 1,500 committed, height 38 | chaincode `decode` | `decode` | **PASS** |
| `self-issued-credential` | ballots | **live submission** | open, 1,500 committed, height 38 | chaincode `issuer` | `issuer` | **PASS** |
| `overvote` | ballots | **live submission** | open, 1,500 committed, height 38 | chaincode `selection` | `selection` | **PASS** |
| `dropped-ballot` | close | simulated | closed, 3,000 committed, height 69 | auditor `stream.completeness` | `stream.completeness` (also `decryption.cp_proof`, `decryption.threshold`, `tally.homomorphic_sum`) | **PASS** |
| `reordered-ballots` | close | never mounted | closed, 3,000 committed, height 69 | none | none | **SKIPPED** |
| `tamper-partial-decryption` | ceremony | simulated | closed, 3,000 committed, height 105 | auditor `decryption.cp_proof` | `decryption.cp_proof` | **PASS** |

**8 PASS, 0 INCONCLUSIVE, 0 FAIL, 1 SKIPPED.** The summary row reads 8 attempted, 8 rejected, rate 1.00. The five ballots-stage attacks were real chaincode submissions mid-election. The chaincode's reasons, verbatim from `actual`:

- `tamper-ballot-proof`: `contest "president/cand0" CDS well-formedness proof failed: CDS branch 0 verification equation failed`
- `reused-nullifier`: `nullifier already spent in election "mp-1k-ch4-sec-20260930-185139-29" (double vote)`
- `corrupted-ballot-bytes`: `decode ballot: proto: cannot parse invalid wire-format data`
- `self-issued-credential`: `credential issuer key is not the issuer bound to election "mp-1k-ch4-sec-20260930-185139-29"`
- `overvote`: `position "president" selection proof failed: selection proof challenge does not match Fiat-Shamir transcript`

The auditor's reasons:
- `dropped-ballot`: "audited 2999 of the 3000 ballot lines the header declares";
- `tamper-dkg-transcript`: "trustee 1 coefficient_commitments[0] is not a valid ristretto point";
- `tamper-partial-decryption`: "partial_decryptions[0] (trustee 1, contest president/cand0) Chaum-Pedersen failed".

**Per-position enforcement (T7, in part).** The ballots stage paused at 1,500 of 3,000 ballot records: 500 voters x 3 positions, submitted concurrently (128 in flight) across all three positions. Each voter's three records carry three distinct per-position nullifiers, and all 3,000 were accepted: 3,000 committed, 0 dropped. So one voter's ballot for vice-president is not refused as a double vote of the same voter's president ballot. A copied nullifier was refused live with "nullifier already spent … (double vote)". Every accepted record was counted exactly once: E = 0 on all 12 contests, below.

T7 also asks for interim aggregates read while ballots are submitted. That was not exercised: aggregation is post hoc, and the console reads no interim aggregate. This half of T7 remains a stated limit.

`reordered-ballots` is a **gap, not a pass**: no gate exists to test it. The on-chain limitations stated beside the SP-10K verdicts apply unchanged (runbook §10.5):
- the DKG transcript is shape-checked only on-chain;
- partial-decryption proofs are checked for presence only on-chain;
- reordering is not detected;
- callers are not authorised, so front-running is possible.

## 3. Election outcome

| | |
|---|---|
| Verify | `overall pass`, `failed_checks` `[]` |
| E per contest | **E = 0** and `pass` true on all 12 contests (3 positions x 4 candidates), on both the `source=local` and the `source=ledger` rows |
| `ledger_matches_local` | **true** on all ledger rows; `run.end` `{failed false, ledger_audit ok, ledger_matches_local true, security_run true}` |
| Ledger dump | 3,000 ballot records, `read_path` `batched` |
| Ballots | 3,000 submitted, 3,000 committed, 0 dropped (`window_ms` 4,057) |
| Ledger size | peer0.org1 39,610,500 bytes, orderer 156,573,468 bytes (`logs/ledger-size.txt`) |

## 4. Caveats

One election, 1K. The simulated mounts are audited copies, not submissions. The window TPS (739) is perturbed by the pause and is not reported for RQ3.
