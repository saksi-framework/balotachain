# Precinct-to-national canvass runs (desktop, 2026-10-18)

Later build (Appendix E), desktop only, never pooled with AX42. Every Chapter IV number stays on saksi `4a38a54`; these runs are a separate, later build. The A-additive outputs are **a re-analysis of the archived record** of SP-3.5M m3 and MP-3.5M offline, not precinct runs.

## Machine and build

- The Table 3.12 desktop: Ryzen 7 5700G, 32 GB, Windows 11 Pro 26200; WSL2 Ubuntu (16 vCPU, 23 GB visible, swap 0); Docker Desktop engine 29.7.2; Fabric 2.5.15 test-network (2 peers, 1 Raft orderer); channel `saksi`; chaincode `saksi-bulletin`.
- Orderer parameters: the adopted saksi configtx (BatchTimeout 2 s, MaxMessageCount 50, PreferredMaxBytes 2 MB, SnapshotIntervalSize 256 MB), installed by `network.sh` on every reset.
- saksi `0cdc335` (merge of #61) in `~/Code/saksi`; balotachain `20d9860` cloned to `~/balotachain`.
- Binary digests (sha256), from `binary-sha256.txt`:

  - `saksi-demo`: `9cdab7917819030e27ebb464efeacc5a772dba956637a78a71e2ace04b98bd19`
  - `saksi-campaign`: `77a046ce5fd490709ff36077e0ed92144f30fb87a794f319ff823e08d12fb1f1`
  - `saksi-canvass-demo`: `6ce375e14590261b88c9130144174eca952b1682cdd155f6fa75d24ce9717b6e`
  - `tamper_invoke`: `655a76ca825e993e3e0adc8dd16e14196dcaba1e4960d9a37ea01c02c7cb0aac`

- `tools/security/canvass/selftest.sh` against this `saksi-demo`: 11/11 file scenarios PASS.

## Procedure

- One `tools/tier.sh 10000 3` reset (network down, fresh channel, chaincode redeployed) before every run: the smoke run, each probe, each attack and each clean run. The reset log is `logs/resets.txt` (local times, +08:00; `started` fields in the JSON are UTC).
- Smoke run before anything else: 2 precincts x 20 voters x 3 positions, 60 records each, all seven checks pass.
- Precinct ballot window: the console's closed-loop submitter at its default concurrency 8 (`saksi-canvass-demo` at 0cdc335 has no concurrency flag). With MaxMessageCount 50 above 8 in-flight ballots, every block is cut by the 2 s BatchTimeout, so per-precinct TPS (about 3.9) and latency (about 2.04 s) measure the batch timeout, not the protocol.
- Generation: `saksi-demo gen --stream <dir> --precincts 10 --voters V --positions 3 --candidates 4 --trustees 5 --threshold 3 --distribution realistic`; driver `saksi-canvass-demo --distribution realistic` with the Org1 User1 identity. `--fabric-peer-volume` was not set (the Docker Desktop volume is not visible from the Ubuntu distro), so `ledger_bytes_delta` is null.
- Attack runs: `tools/security/canvass/run_all.sh --only <id>` with `VOTERS=1000` (10 precincts x 100 voters x 3 positions = 300 records per precinct). Clean runs: the plan size, `--voters 10000` (1,000 voters and 3,000 records per precinct).
- Ledger dumps (`ledger/ballots.ndjson`) are not committed; their sha256 is in each run's `ledger-sha256.txt`. `authority.key` is never copied.

## Clean canvass runs

2 of 4 clean runs (warm-up + m1-m3) are in this commit; m2 and m3 are pending (the user starts them separately).

### warmup (warm-up, not measured)

Started 2026-10-18T00:28:39Z (UTC); driver total 7832.5 s; national canvass 12683 ms; exit 0; canvass pass: True.

| precinct | records / verified | window s | committed TPS | p50 ms | p95 ms | p99 ms | precinct window s | close to return s | audit | close block |
|---|---|---|---|---|---|---|---|---|---|---|
| p01 | 3000 / 3000 | 761.4 | 3.940 | 2029.8 | 2035.0 | 2041.6 | 782.1 | 15.5 | pass | 389 |
| p02 | 3000 / 3000 | 761.0 | 3.942 | 2029.0 | 2034.0 | 2039.9 | 781.8 | 15.6 | pass | 772 |
| p03 | 3000 / 3000 | 761.1 | 3.942 | 2029.4 | 2034.1 | 2040.5 | 782.1 | 15.7 | pass | 1155 |
| p04 | 3000 / 3000 | 761.1 | 3.942 | 2029.0 | 2035.3 | 2041.1 | 782.1 | 15.8 | pass | 1538 |
| p05 | 3000 / 3000 | 761.1 | 3.941 | 2029.3 | 2035.2 | 2050.0 | 782.0 | 15.6 | pass | 1921 |
| p06 | 3000 / 3000 | 761.1 | 3.942 | 2028.8 | 2034.7 | 2045.8 | 781.9 | 15.6 | pass | 2304 |
| p07 | 3000 / 3000 | 761.1 | 3.942 | 2028.9 | 2034.8 | 2047.3 | 781.9 | 15.5 | pass | 2687 |
| p08 | 3000 / 3000 | 761.2 | 3.941 | 2029.2 | 2033.9 | 2051.7 | 782.0 | 15.5 | pass | 3070 |
| p09 | 3000 / 3000 | 761.1 | 3.942 | 2029.1 | 2033.6 | 2046.9 | 781.9 | 15.5 | pass | 3453 |
| p10 | 3000 / 3000 | 761.1 | 3.942 | 2029.1 | 2033.6 | 2053.5 | 782.0 | 15.7 | pass | 3836 |

| check | verdict | reason |
|---|---|---|
| canvass.registry | pass | 10 returns, each for a distinct registered precinct of cv-warmup |
| canvass.completeness | pass | all 10 registered precincts have an accepted return |
| canvass.signature | pass | every return verifies under its registered authority key |
| canvass.precinct_recompute | pass | every return equals the recompute from its ledger read-back and close reference |
| canvass.national_sum | pass | product of 10 accepted aggregates equals the national aggregate |
| canvass.accuracy | pass | 10 precinct audits pass with E = 0; national decryption of the ledger product gives E = 0 |
| canvass.nullifier_unique | pass | 30000 nullifiers, none in two precinct ledgers |

### m1 (measured)

Started 2026-10-18T08:43:00Z (UTC); driver total 7835.1 s; national canvass 12960 ms; exit 0; canvass pass: True.

| precinct | records / verified | window s | committed TPS | p50 ms | p95 ms | p99 ms | precinct window s | close to return s | audit | close block |
|---|---|---|---|---|---|---|---|---|---|---|
| p01 | 3000 / 3000 | 761.1 | 3.942 | 2028.9 | 2034.8 | 2056.0 | 782.4 | 15.9 | pass | 389 |
| p02 | 3000 / 3000 | 761.0 | 3.942 | 2028.6 | 2033.9 | 2047.9 | 782.5 | 15.5 | pass | 772 |
| p03 | 3000 / 3000 | 761.0 | 3.942 | 2028.9 | 2034.9 | 2044.0 | 781.7 | 15.5 | pass | 1155 |
| p04 | 3000 / 3000 | 761.1 | 3.942 | 2028.6 | 2034.2 | 2048.2 | 781.8 | 15.5 | pass | 1538 |
| p05 | 3000 / 3000 | 761.1 | 3.942 | 2028.7 | 2035.2 | 2049.7 | 782.1 | 15.7 | pass | 1921 |
| p06 | 3000 / 3000 | 761.4 | 3.940 | 2029.6 | 2034.8 | 2049.0 | 782.5 | 15.9 | pass | 2304 |
| p07 | 3000 / 3000 | 761.3 | 3.940 | 2029.5 | 2035.3 | 2053.8 | 782.1 | 15.6 | pass | 2687 |
| p08 | 3000 / 3000 | 761.4 | 3.940 | 2029.7 | 2035.8 | 2054.8 | 782.4 | 15.5 | pass | 3070 |
| p09 | 3000 / 3000 | 761.5 | 3.940 | 2029.6 | 2035.1 | 2058.7 | 782.3 | 15.6 | pass | 3453 |
| p10 | 3000 / 3000 | 761.2 | 3.941 | 2029.4 | 2034.6 | 2057.0 | 782.1 | 15.5 | pass | 3836 |

| check | verdict | reason |
|---|---|---|
| canvass.registry | pass | 10 returns, each for a distinct registered precinct of cv-m1 |
| canvass.completeness | pass | all 10 registered precincts have an accepted return |
| canvass.signature | pass | every return verifies under its registered authority key |
| canvass.precinct_recompute | pass | every return equals the recompute from its ledger read-back and close reference |
| canvass.national_sum | pass | product of 10 accepted aggregates equals the national aggregate |
| canvass.accuracy | pass | 10 precinct audits pass with E = 0; national decryption of the ledger product gives E = 0 |
| canvass.nullifier_unique | pass | 30000 nullifiers, none in two precinct ledgers |

## Attack runs

Verdict = strict set equality against the corrected Task 2 table (`docs/plans/precinct-m-reports/task2-review.md`). T15, T16 and T24 are committed, then detected: the precinct ledger is untouched, so `canvass.accuracy` stays green.

| scenario | mount | expected failing checks | failed checks | on chain | verdict |
|---|---|---|---|---|---|
| T19 | ballot resubmitted across precincts (submit-raw --channel) | refused on chain: none | none | refused (verbatim below) | PASS |
| T20 | a precinct's tally published on another precinct | refused on chain: none | none | refused (verbatim below) | PASS |
| T9 | one aggregate byte flipped after signing | canvass.signature,canvass.completeness,canvass.precinct_recompute,canvass.national_sum | canvass.completeness,canvass.signature,canvass.precinct_recompute,canvass.national_sum | n/a | PASS |
| T10 | return delivered twice | canvass.registry | canvass.registry | n/a | PASS |
| T11 | unregistered precinct, fresh-key signature | canvass.registry | canvass.registry | n/a | PASS |
| T12 | sibling return relabelled and substituted | canvass.signature,canvass.completeness,canvass.precinct_recompute,canvass.national_sum | canvass.completeness,canvass.signature,canvass.precinct_recompute,canvass.national_sum | n/a | PASS |
| T13 | return dropped on the path | canvass.completeness,canvass.national_sum | canvass.completeness,canvass.national_sum | n/a | PASS |
| T14a | wrong election id, re-signed with the real key | canvass.registry,canvass.completeness,canvass.national_sum | canvass.registry,canvass.completeness,canvass.national_sum | n/a | PASS |
| T14b | stale close reference, re-signed with the real key | canvass.precinct_recompute | canvass.precinct_recompute | n/a | PASS |
| T15 | real key over a ledger missing one ballot | canvass.precinct_recompute,canvass.national_sum | canvass.precinct_recompute,canvass.national_sum | n/a | PASS |
| T16 | doctored aggregate re-signed with the stolen real key | canvass.precinct_recompute,canvass.national_sum | canvass.precinct_recompute,canvass.national_sum | n/a | PASS |
| T21 | signed with another registered precinct's key | canvass.signature,canvass.completeness,canvass.national_sum | canvass.completeness,canvass.signature,canvass.national_sum | n/a | PASS |
| T24 | accepted national/returns file replaced after acceptance | canvass.signature,canvass.completeness,canvass.precinct_recompute,canvass.national_sum | canvass.completeness,canvass.signature,canvass.precinct_recompute,canvass.national_sum | n/a | PASS |

### Chain responses (verbatim)

- **T19**: `[REFUSED] T19 -> submit ballot: rpc error: code = Aborted desc = failed to endorse transaction, see attached details for more info; chaincode response 500, gate=election-open: election "cv-T19-p03" is not open for ballots`
- **T20**: `[REFUSED] T20 -> publish tally: rpc error: code = Aborted desc = failed to endorse transaction, see attached details for more info; chaincode response 500, a tally is already published for election "cv-T20-p03"`

T19 resubmits a committed precinct-03 ballot while precinct-04 is open. The ballot carries p03's election id, and p03 is closed, so the chaincode's election-open gate refuses it. T20 publishes precinct-03's tally while precinct-04 sits between its partial decryptions and PublishTally. The tally carries p03's election id and p03 already has a tally, so it is refused. In both runs p04's own tally then published and the canvass passed all seven checks. Paper wording: refused by the election binding of the target precinct.

### Failing-check reasons per scenario

- **T9**: `canvass.completeness`: no accepted return from p03 (received but rejected: p03.json); `canvass.signature`: p03.json (p03): signature does not verify under this public key; `canvass.precinct_recompute`: p03: aggregates differ (president/cand0); `canvass.national_sum`: product of returned aggregates differs from the national aggregate in president/cand0, president/cand1, president/cand2, president/cand3, vice-president/cand0, vice-president/cand1, vice-president/cand2, vice-president/cand3, senator/cand0, senator/cand1, senator/cand2, senator/cand3
- **T10**: `canvass.registry`: p03.json: second return for p03 (first: p03-dup.json)
- **T11**: `canvass.registry`: p99.json: precinct "p99" is not in the registry
- **T12**: `canvass.completeness`: no accepted return from p04 (received but rejected: p04.json); `canvass.signature`: p04.json (p04): signature does not verify under this public key; `canvass.precinct_recompute`: p04: ledger digest differs, aggregates differ (president/cand0, president/cand1, president/cand2, president/cand3, vice-president/cand0, vice-president/cand1, vice-president/cand2, vice-president/cand3, senator/cand0, senator/cand1, senator/cand2, senator/cand3), close block 144 vs close.json 190, close tip hash differs from close.json; `canvass.national_sum`: product of returned aggregates differs from the national aggregate in president/cand0, president/cand1, president/cand2, president/cand3, vice-president/cand0, vice-president/cand1, vice-president/cand2, vice-president/cand3, senator/cand0, senator/cand1, senator/cand2, senator/cand3
- **T13**: `canvass.completeness`: no accepted return from p05; `canvass.national_sum`: product of returned aggregates differs from the national aggregate in president/cand0, president/cand1, president/cand2, president/cand3, vice-president/cand0, vice-president/cand1, vice-president/cand2, vice-president/cand3, senator/cand0, senator/cand1, senator/cand2, senator/cand3
- **T14a**: `canvass.registry`: p03.json: election id "wrong-p03" is not "cv-T14a-p03"; `canvass.completeness`: no accepted return from p03 (received but rejected: p03.json); `canvass.national_sum`: product of returned aggregates differs from the national aggregate in president/cand0, president/cand1, president/cand2, president/cand3, vice-president/cand0, vice-president/cand1, vice-president/cand2, vice-president/cand3, senator/cand0, senator/cand1, senator/cand2, senator/cand3
- **T14b**: `canvass.precinct_recompute`: p03: close block 145 vs close.json 144, close tip hash differs from close.json
- **T15**: `canvass.precinct_recompute`: p06: record count 299 vs ledger 300, ledger digest differs, aggregates differ (senator/cand0, senator/cand1, senator/cand2, senator/cand3); `canvass.national_sum`: product of returned aggregates differs from the national aggregate in senator/cand0, senator/cand1, senator/cand2, senator/cand3
- **T16**: `canvass.precinct_recompute`: p07: ledger digest differs, aggregates differ (senator/cand0, senator/cand1, senator/cand2, senator/cand3); `canvass.national_sum`: product of returned aggregates differs from the national aggregate in senator/cand0, senator/cand1, senator/cand2, senator/cand3
- **T21**: `canvass.completeness`: no accepted return from p03 (received but rejected: p03.json); `canvass.signature`: p03.json (p03): signature does not verify under this public key; `canvass.national_sum`: product of returned aggregates differs from the national aggregate in president/cand0, president/cand1, president/cand2, president/cand3, vice-president/cand0, vice-president/cand1, vice-president/cand2, vice-president/cand3, senator/cand0, senator/cand1, senator/cand2, senator/cand3
- **T24**: `canvass.completeness`: no accepted return from p01 (received but rejected: p01.json); `canvass.signature`: p01.json (p01): signature does not verify under this public key; `canvass.precinct_recompute`: p01: aggregates differ (president/cand0); `canvass.national_sum`: product of returned aggregates differs from the national aggregate in president/cand0, president/cand1, president/cand2, president/cand3, vice-president/cand0, vice-president/cand1, vice-president/cand2, vice-president/cand3, senator/cand0, senator/cand1, senator/cand2, senator/cand3

| scenario | started (UTC) | driver total s | canvass ms |
|---|---|---|---|
| T19 | 2026-10-17T19:22:49Z | 1984.2 | 2062 |
| T20 | 2026-10-17T21:02:43Z | 945.3 | 1397 |
| T9 | 2026-10-17T21:19:51Z | 945.6 | 1385 |
| T10 | 2026-10-17T21:37:00Z | 945.4 | 1383 |
| T11 | 2026-10-17T21:54:08Z | 945.8 | 1387 |
| T12 | 2026-10-17T22:11:16Z | 946.0 | 1382 |
| T13 | 2026-10-17T22:28:25Z | 945.8 | 1410 |
| T14a | 2026-10-17T22:45:34Z | 945.7 | 1451 |
| T14b | 2026-10-17T23:02:43Z | 946.2 | 1382 |
| T15 | 2026-10-17T23:19:51Z | 945.9 | 1392 |
| T16 | 2026-10-17T23:37:00Z | 945.9 | 1380 |
| T21 | 2026-10-17T23:54:09Z | 952.5 | 1388 |
| T24 | 2026-10-18T00:11:25Z | 945.7 | 1386 |

## A-additive re-analysis of the archived record

`saksi-demo precinct-aggregate <scratch copy> --precinct-size 1000 --ground-truth <run>/ground-truth-ballots.csv --correctness <run>/correctness.csv`, with `SAKSI_AUDIT_THREADS=16`, on a decompressed scratch copy under `~/scratch-precinct/` (deleted afterwards). Inputs are the Q: archive copies in `Q:\thesis-archive\runs\<run>\`. The decompressed `ballots.ndjson` sha256 matched the archived `ballots.ndjson.sha256` for both runs before the fold.

| archived run | precincts | voters | records | contests | checks yes / total | overall | per-precinct E | decompress s | precinct-aggregate wall s |
|---|---|---|---|---|---|---|---|---|---|
| mp-3-5m-ch4-offline-20261003-150909-2 | 3525 | 3,524,078 | 10,572,234 | 12 | 49 / 49 | pass | n/a (no key) | 1399 | 2062 |
| sp-3-5m-ch4-m3-20261003-040010-1 | 3525 | 3,524,078 | 3,524,078 | 4 | 17 / 17 | pass | n/a (no key) | 385 | 732 |

For every contest, four checks pass. `combine.product`: the sum of the 3,525 precinct aggregates equals the region aggregate. `combine.audit_fold`: it equals the auditor's own fold. `combine.correctness_csv`: it equals the committed `aggregate_ciphertext` in the archived `correctness.csv`. `combine.ground_truth`: the sum of per-precinct ground truths equals the region's. Per-precinct E is unavailable by design, because the key and trustee shares no longer exist. The MP-3.5M fold partly overlapped a network reset attempt and an aborted, unmeasured warm-up, so its wall time is an upper bound.

## Deviations and environment fixes

- **saksi checkout.** The brief named `~/saksi`; the runs used `~/Code/saksi` (the study checkout beside `~/Code/fabric-samples`, where the adopted configtx and every Chapter IV run live), moved to `0cdc335`. `~/saksi` was left untouched.
- **Driver concurrency.** `saksi-canvass-demo` at 0cdc335 runs each precinct window at the console default concurrency 8 and has no flag for it. Under the adopted MaxMessageCount 50 every block waits the 2 s BatchTimeout, so a 3,000-record precinct takes about 13 min and a clean 10-precinct run about 2.6 h. No code was changed (the build must stay 0cdc335). Precinct TPS and latency in this folder are therefore batch-timeout bound and must not be compared with the Chapter IV ladder.
- **Attack size.** To fit the night, attack runs used `VOTERS=1000` (100 voters per precinct) instead of `run_all.sh`'s default 10,000. Detection does not depend on size; the clean runs use the plan size.
- **Reset failure.** The first T20 reset failed inside `network.sh` ("Anchor peer update failed") while the MP-3.5M decompression and hash were running. `reset.sh` now retries `tier.sh` up to three times; every later reset succeeded on the first try.
- **Aborted warm-ups (not evidence).** Warm-up attempt 1 started early because the wait guard missed the sha256 phase of the A-additive job; it was stopped at precinct-01 (the driver died with its WSL session when the orchestrating shell was killed). Attempt 2 was stopped at precinct-02 on purpose, to run the attack table first. Each was followed by a fresh reset; neither is in this folder.
- **T19 timing.** T19 ran while the A-additive job was running (allowed: attack runs are not measured), so its driver total (about 33 min) is roughly twice the other attack runs.
- No Docker compaction, no `wsl --shutdown`, no prune beyond what `tier.sh` does. `~/.saksi/campaign/runs` was not touched; the A-additive inputs were the Q: archive copies.
- **Power cut and user stop.** A power cut at about 11:28 (+08:00) killed measured run m1 (attempt 1) at precinct-04. Docker Desktop was restarted, every Fabric container had exited (255), and the network was fully reset. A second m1 attempt started at 14:07 and was stopped by the user at 14:11 (precinct-01) to free the machine. Both partial runs are kept outside this folder (`clean/m1-aborted-powercut`, `clean/m1-aborted-userstop`; not evidence). The m1 in this folder is attempt 3, run from 16:42 after a full reset at the same build and plan size with nothing else running. The warm-up (completed 10:39, before the cut) stands as the warm-up. m2 and m3 are pending; the user will start them separately.
