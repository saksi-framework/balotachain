# Chapter 4 study — SP-10K security run on saksi `4a38a54`

Executed 2026-09-30 02:34–02:38 local time (2026-09-29 18:34–18:37 UTC) on the Ryzen desktop
under WSL2. One election with the attack timeline on, run on the SP-10K network straight after
that tier's standing campaign (`campaign-20260929-182259-19`, reset
`network-reset-20260929-182052-18`), per saksi runbook §10.5. **Its throughput is not for
RQ3**: the pauses and attacks perturb timing, and `perf.csv` carries `security_run = true`.
Index of the whole study: [`2026-09-30-ch4-study.md`](2026-09-30-ch4-study.md).

Artifacts are in `docs/desktop-runs/2026-09-30-sp-10k-security/`: `preflight.json` (the driver's
preflight before the run) and, under `sp-10k-ch4-sec-20260929-183410-129/`, `run.json`,
`perf.csv`, `perf-schema.md`, `correctness.csv`, `negative-tests.csv`, `journal.ndjson`,
`timings.json`, `scenarios.json` (the verdicts with their mount state),
`ground-truth-check.json`, `submit-metrics.json` and `ceremony.json`. Left in WSL (bulky):
`ballots.csv`/`ballots.ndjson` (80 MB), `receipts.csv`, `latencies.csv`, `header.json`, the
`ledger/` dump and `scenarios/<name>/` (the mutated ballot and header copies the three
simulated attacks were audited against, about 39 MB each).

## 1. Build and environment

Same build and machine as every tier of the study (see any tier note, e.g.
[`2026-09-30-sp-10k.md`](2026-09-30-sp-10k.md) §1): saksi and console
**`4a38a54fe0223b58f28c53ec54e47fbeab222837`**, `saksi-demo` SHA-256 `112fffa0…763c52`,
Docker Desktop 4.90.0, `MemTotal` 25,199,009,792, 16 vCPU, Fabric 2.5.15, orderer `b50-t2s`
(`MaxMessageCount` 50, `BatchTimeout` 2s), `null_probes` empty.

| | |
|---|---|
| Run | **`sp-10k-ch4-sec-20260929-183410-129`** (`SP-10K ch4 sec`) |
| Election | 10,000 voters x 1 position, 4 candidates, 5 trustees, threshold 3, `realistic`, on-chain, concurrency 128 |
| Attack plan | stages `dkg`, `ballots`, `close`, `ceremony`; `ballots_at` 0.5; `timeout_s` 300; every pause decided **run all** |
| Network | the SP-10K network from reset `network-reset-20260929-182052-18`, after that tier's 12 campaign repetitions |
| Preflight host sample | 2026-09-29T18:34:06Z: host CPU 12.5 %, guest load1 3.77 / load5 6.41; warnings `[]`; Fabric reachable; ladder ok. The two checks before it (02:33:02 and 02:33:36 local) read amber on `host_load` (load1 5.55, then 4.64) as the campaign's own load settled |

## 2. Verdicts

From `negative-tests.csv` (and identically in the journal's `attack.result` events):

| Scenario | Stage | Mount | Election state at mount | Declared gate | Observed gate | Verdict |
|---|---|---|---|---|---|---|
| `tamper-dkg-transcript` | dkg | simulated | open, 0 committed, height 2479 | auditor `dkg.decode` | `dkg.decode` | **PASS** |
| `tamper-ballot-proof` | ballots | **live submission** | open, 5,000 committed, height 2580 | chaincode `cds` | `cds` | **PASS** |
| `reused-nullifier` | ballots | **live submission** | open, 5,000 committed, height 2580 | chaincode `nullifier` | `nullifier` | **PASS** |
| `corrupted-ballot-bytes` | ballots | **live submission** | open, 5,000 committed, height 2580 | chaincode `decode` | `decode` | **PASS** |
| `self-issued-credential` | ballots | **live submission** | open, 5,000 committed, height 2580 | chaincode `issuer` | `issuer` | **PASS** |
| `overvote` | ballots | **live submission** | open, 5,000 committed, height 2580 | chaincode `selection` | `selection` | **PASS** |
| `dropped-ballot` | close | simulated | closed, 10,000 committed, height 2681 | auditor `stream.completeness` | `stream.completeness` (also `decryption.cp_proof`, `decryption.threshold`, `tally.homomorphic_sum`) | **PASS** |
| `reordered-ballots` | close | never mounted | closed, 10,000 committed, height 2681 | none | none | **SKIPPED** |
| `tamper-partial-decryption` | ceremony | simulated | closed, 10,000 committed, height 2693 | auditor `decryption.cp_proof` | `decryption.cp_proof` | **PASS** |

**8 PASS, 0 INCONCLUSIVE, 0 FAIL, 1 SKIPPED.** `negative-tests.csv`'s summary row: 8
attempted, 8 rejected, rate 1.00. Every PASS was refused by its declared gate. The five
ballots-stage attacks were real submissions to the chaincode mid-election; the chaincode's
own reasons, verbatim from `actual`:

- `tamper-ballot-proof`: `contest "president/cand0" CDS well-formedness proof failed: CDS branch 0 verification equation failed`
- `reused-nullifier`: `nullifier already spent in election "sp-10k-ch4-sec-20260929-183410-129" (double vote)`
- `corrupted-ballot-bytes`: `decode ballot: proto: cannot parse invalid wire-format data`
- `self-issued-credential`: `credential issuer key is not the issuer bound to election "sp-10k-ch4-sec-20260929-183410-129"`
- `overvote`: `position "president" selection proof failed: selection proof challenge does not match Fiat-Shamir transcript`

`reordered-ballots` is a **gap, not a pass**: no gate exists to test (ordering is checked
neither on-chain nor by the stateless auditor).

**On-chain limitations to state beside these verdicts** (runbook §10.5): the chaincode checks
the DKG transcript's shape, not its points, so `tamper-dkg-transcript` is caught by the auditor
only; partial-decryption proofs are checked for presence only on-chain, and verified by the
auditor (`decryption.cp_proof`); ballot reordering is not detected; and the chaincode does not
authorise callers, so a front-running DKG transcript or partial decryption (`dkg-duplicate`,
`partial-duplicate`) could lock the honest one out. The console does not mount those live.

## 3. Election outcome

| | |
|---|---|
| Verify | `overall pass`, `failed_checks` `[]` |
| E per contest | **E = 0** and `pass` true on all 4 contests, both the `source=local` and the `source=ledger` rows |
| `ledger_matches_local` | **true** on all 8 rows; `run.end` `ledger_matches_local: true`, `ledger_audit: ok` |
| Ledger dump | 10,000 ballots, `read_path` `batched` |
| Ballots | 10,000 submitted, 10,000 committed, 0 dropped (window 10,287 ms) |
| `run.end` | `failed: false`, `security_run: true`, `scaling_limit: inconclusive` |
| Ceremony | trustees 1, 2, 3 each submitted 4 partials (8.2 s each); publish with 3 of threshold 3 |
| Audit cost | `verify_ballots` 1,640 ms at `verify_threads` 16 |

## 4. Timeline (UTC, from `journal.ndjson`)

| Time | Event |
|---|---|
| 18:34:10 | run start; generate 2.6 s |
| 18:34:42 | pause at **dkg** (0 committed, height 2479); `tamper-dkg-transcript` PASS; resumed after 10.1 s |
| 18:34:54 | ballot window opens (10,000 ballots, concurrency 128) |
| 18:34:59 | pause at **ballots**, 5,000 committed, height 2580; five live attacks, all PASS; resumed after 0.66 s |
| 18:35:05 | window ends: 10,000 committed, 0 dropped |
| 18:35:10 | pause at **close** (closed, height 2681); `dropped-ballot` PASS, `reordered-ballots` SKIPPED; resumed after 14.1 s |
| 18:35:30–18:36:38 | trustees 1–3 submit shares |
| 18:37:00 | pause at **ceremony** (height 2693); `tamper-partial-decryption` PASS; resumed after 13.9 s |
| 18:37:16 | tally published |
| 18:37:28 | verify `overall pass`; `run.end` |

## 5. Caveats

- One security run, on one tier; each scenario was attempted once. The rejection rate is 8 of
  8, not a sampled rate.
- Three of the eight PASS verdicts are **simulated** mounts scored by the auditor
  (`tamper-dkg-transcript`, `dropped-ballot`, `tamper-partial-decryption`); five are live
  on-chain submissions. The paper should keep the two kinds apart.
- `dropped-ballot`'s observed gate lists four auditor checks; the declared one
  (`stream.completeness`) is among them, which is what PASS requires.
- `perf.csv` reports 972.065 TPS for the window, but a security run's throughput is excluded
  from RQ3 by design (the ballots pause sits inside the window).
- The study log's account of this run matches the files in every figure checked.
