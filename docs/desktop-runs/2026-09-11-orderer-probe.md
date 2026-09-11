# Orderer batch-parameter probe — SP-10K on NVMe-backed Docker storage

Executed 2026-09-11 on the Ryzen desktop under WSL2, after the stall investigation in
`2026-09-11-row2.md` traced the multi-second block gaps in the c = 192 row-3 runs to
Docker Desktop's disk image rather than to Fabric. Two things changed at once and this
probe separates them: the VHDX moved from the SATA SSD to the NVMe, and the orderer's
batching parameters were varied across four configurations.

Artifacts: `docs/desktop-runs/2026-09-11-orderer-probe/` — one `perf.csv` per probe run
(`otune-<variant>-c<c>-perf.csv`), the concatenated `results.csv`, the stall-evidence
table `stall.csv`, `configtx-diffs.txt` (each variant against the test-network default),
`perf-schema.md`, and `journal-line1.json` (the environment snapshot). Full run folders
stay in WSL under `~/.saksi/campaign/runs/otune-*`.

## 1. Environment delta since the row-2 / row-3 runs

| | Before (rows 1–3) | Now (this probe) |
|---|---|---|
| **Docker data disk** | `docker_data.vhdx` on **C:** — a faspeed K7-512G **SATA** SSD | `Q:\DockerDesktop\DockerDesktopWSL\disk\docker_data.vhdx` on the **Kingston NVMe** (Table 3.12's NVMe), junctioned from the old C: path |
| **RAM allotted to WSL** | 15 GB of 32 (`MemTotal` 16,709,726,208) | **24 GB** of 32 (`MemTotal` 25,199,005,696), set in `.wslconfig` |
| **WSL swap** | default | **0** |
| Ubuntu boot | hung on an NFS `fstab` entry | fixed; the `Processing /etc/fstab` warning is gone |
| Everything else | \- | unchanged: AMD Ryzen 7 5700G (8C/16T), 16 vCPU, WSL2 Ubuntu 26.04, kernel 6.18.33.2-microsoft-standard-WSL2, Docker Desktop server 29.7.2, Fabric 2.5.15, channel `saksi`, chaincode `saksi-bulletin` 1.0, no container CPU/memory limits |

Build identity for every row below: saksi `3cb07fcb30d5625baceb3ce5878786f5e57bf79d`
(main, after PR #37), `saksi-demo` SHA-256
`3b04f5a6ec29de9e9bc1de11d03a4fa6e4c4b60ab50b476537ce61f2e2b8554d`, go 1.25.1,
`null_probes` empty on every run.

Storage remains a **VHDX on Hyper-V**, not the raw NVMe — that qualification still
belongs in Table 3.12; what changed is which physical disk backs the VHDX.

## 2. The variants

Each variant is a whole `configtx.yaml` swapped into
`~/Code/fabric-samples/test-network/configtx/` before `tools/tier.sh 10000 1`, which
tears the network down and regenerates the channel genesis block from that file. The
parameters therefore take effect for real, and §4 proves it from the ledger rather than
from the config.

| Variant | `BatchTimeout` | `MaxMessageCount` | `PreferredMaxBytes` | `AbsoluteMaxBytes` | `SnapshotIntervalSize` |
|---|---|---|---|---|---|
| `default` (test-network stock) | 2 s | 10 | 512 KB | 99 MB | *(unset — Fabric default 16 MB)* |
| `tuned-batch-only` | 2 s | 500 | 16 MB | 99 MB | *(unset)* |
| `b50-t2s` | 2 s | **50** | 2 MB | 99 MB | **256 MB** |
| `b500-t250ms` | **250 ms** | **500** | 2 MB | 99 MB | **256 MB** |

`tuned-batch-only` (and the `tuned` variant that was prepared alongside it, which adds
only `SnapshotIntervalSize` and was never run) raised `MaxMessageCount` to 500 while
leaving `BatchTimeout` at 2 s. That combination is **not a tuning candidate** — see §5 —
but its rows are kept because they are the cleanest possible demonstration of the
failure mode.

Workload for all eight rows: SP-10K — 10,000 voters, 1 position, 4 candidates, realistic
distribution, 5 trustees / threshold 3, `mode: onchain`, one measured rep, no warm-ups,
a fresh empty ledger per variant.

## 3. Results

`tps` is `committed_tps`; `ceiling` is `driver_ceiling_tps`; latencies are per-ballot
submit latencies in ms; CPU is `peak_cpu_pct_peer` / `peak_cpu_pct_orderer` straight from
`perf.csv` (percent of a single core, so values over 100 mean more than one core busy).

| Variant | c | tps | ceiling | window ms | p50 | p95 | p99 | dropped | peer CPU % | orderer CPU % |
|---|---|---|---|---|---|---|---|---|---|---|
| **default** (NVMe) | 96 | **487.94** | 515.51 | 20,494 | 186.2 | 267.1 | **351.0** | 0 | 259.24 | 75.73 |
| **default** (NVMe) | 192 | **464.61** | 472.14 | 21,523 | 406.7 | 471.9 | **559.3** | 0 | 261.95 | 75.88 |
| `tuned-batch-only` ⚠ | 96 | 45.48 | 45.90 | 219,871 | 2091.3 | 2117.8 | 2127.0 | 0 | 44.72 | 9.78 |
| `tuned-batch-only` ⚠ | 192 | 88.31 | 89.86 | 113,235 | 2136.6 | 2177.5 | 2203.6 | 0 | 82.13 | 20.74 |
| **`b50-t2s`** | 96 | **812.01** | 795.17 | 12,315 | 120.7 | 136.7 | **176.7** | 0 | 270.28 | 59.92 |
| **`b50-t2s`** | 192 | **1005.88** | 1012.26 | 9,941 | 189.7 | 237.9 | **301.4** | 0 | 360.63 | 83.91 |
| `b500-t250ms` | 96 | 284.43 | 287.54 | 35,157 | 333.9 | 352.1 | 355.3 | 0 | 105.16 | 30.03 |
| `b500-t250ms` | 192 | 508.90 | 520.39 | 19,650 | 369.0 | 403.4 | 427.0 | 0 | 164.04 | 50.47 |
| *SATA baseline, defaults* † | 96 | 474.39 | 504.49 | 21,079 | 190.3 | 279.0 | 441.7 | 0 | 236.56 | 60.25 |
| *SATA baseline, defaults* ‡ | 192 | ~491 | — | — | — | — | ~502 | 0 | — | — |

⚠ **invalid configuration: the block never fills at this concurrency** — kept as
evidence, not as a candidate (§5).
† `2026-09-11-row2.md` §3, probe 2, c = 96 — same workload, same defaults, SATA-backed VHDX.
‡ the later c = 192 probe (probe 3) recorded in the execution ledger; only tps and p99
were carried forward, so the remaining cells are left empty rather than guessed.

No row dropped a ballot; `failed=false` and `fail_reason` empty on all eight.

## 4. Stall evidence, and proof the parameters took effect

Window = first to last `SubmitBallot` receipt timestamp, padded 5 s before and 15 s
after. Blocks and ballots-per-block are distinct `block_number` values over the
`SubmitBallot` rows of `receipts.csv` — this is the *ledger's own* account of the batch
size, so it proves the genesis block carried the variant's parameters. Gaps are between
consecutive block timestamps (second resolution). `slow fdatasync` is counted from
`docker logs orderer.example.com` over exactly that window; peer commit times from
`Committed block … in Nms` in each peer's log over the same window.

| Variant | c | blocks | ballots/block (avg / max) | blocks/s | gaps ≥ 3 s | max gap | `slow fdatasync` (n / total s) | org1 commit p50 / max ms | org2 commit p50 / max ms |
|---|---|---|---|---|---|---|---|---|---|
| default | 96 | 1000 | 10.0 / 10 | 48.8 | **0** | 1 s | **0 / 0.000** | 16 / 54 | 16 / 55 |
| default | 192 | 1000 | 10.0 / 10 | 46.5 | **0** | 1 s | **0 / 0.000** | 18 / 64 | 17 / 44 |
| `tuned-batch-only` | 96 | 105 | 95.2 / 96 | 0.48 | 9 | 3 s | 0 / 0.000 | 21 / 101 | 22 / 93 |
| `tuned-batch-only` | 192 | 53 | 188.7 / 192 | 0.47 | 7 | 3 s | 0 / 0.000 | 34 / 53 | 34 / 72 |
| `b50-t2s` | 96 | 200 | **50.0 / 50** | 16.2 | **0** | 1 s | **0 / 0.000** | 15 / 30 | 15 / 31 |
| `b50-t2s` | 192 | 200 | **50.0 / 50** | 20.1 | **0** | 1 s | **0 / 0.000** | 38 / 75 | 25 / 49 |
| `b500-t250ms` | 96 | 105 | 95.2 / 96 | 3.0 | **0** | 1 s | **0 / 0.000** | 22 / 36 | 22 / 34 |
| `b500-t250ms` | 192 | 53 | 188.7 / 192 | 2.7 | **0** | 1 s | **0 / 0.000** | 30 / 56 | 30 / 78 |
| *SATA, defaults, row-3 c = 192 stalls* † | 192 | — | 10 / 10 | — | **yes** | — | 4 warnings, `took=3.2s` | — / **7,829** | — / **7,760** |

† from the row-3 investigation recorded in the execution ledger: 3 of 12 SP-10K reps and
every MP-10K rep stalled, tps falling to ~131 and p99 to 28–37 s; both peers took 5–6 s
in `block_and_pvtdata_commit` plus 2 s in `state_commit` on the same blocks, five blocks
over 2 s each.

**Parameters demonstrably took effect.** Ballots per block are exactly 10 on `default`
(`MaxMessageCount` 10), exactly 50 on `b50-t2s` (`MaxMessageCount` 50), and equal to the
driver's in-flight count — 96 and 192 — on the two 500-message variants, where the
message cap is never reached and the block is cut by the in-flight ceiling or the
timeout instead. Nothing else in the pipeline could produce those three distinct,
exactly-matching batch sizes.

**Storage was the stall cause.** On the NVMe-backed VHDX the *default* configuration —
the same one that stalled 3 of 12 reps on SATA — shows **zero gaps ≥ 3 s, zero
`slow fdatasync` warnings, and peer commit times of 16–18 ms p50 / 54–64 ms max**, at the
same ~48 blocks/s (≈ 48 orderer WAL fsyncs/s plus each peer's block and state writes)
that produced the 7.8 s commits on SATA. The fsync rate did not change; the disk under it
did, and the stalls went with the disk.

## 5. Why `tuned-batch-only` is invalid rather than slow

With `MaxMessageCount` 500 and `BatchTimeout` 2 s, a closed-loop driver holding 96
requests in flight can never put more than 96 messages in front of the orderer, so the
block *never* fills and every block waits out the full 2 s timeout. The measured p50 of
2091 ms (min 2059 ms, stddev tiny) is exactly that timeout, and throughput collapses to
in-flight ÷ timeout: 96 / 2 s = 48 ≈ the measured 45.5 tps, and 192 / 2 s = 96 ≈ the
measured 88.3 tps.

This is the **same failure as the c = 8 result in `2026-09-11-row2.md` §3, seen from the
other side**: there, 8 in flight could not fill a 10-message block; here, 96 in flight
cannot fill a 500-message block. Both measure `BatchTimeout`, not the platform.

The rule both failures give:

> **`MaxMessageCount` must be ≤ the steady in-flight count, or `BatchTimeout` must be
> well below the target per-ballot latency.** A configuration satisfying neither measures
> the timeout and nothing else.

`b50-t2s` satisfies the first clause (50 ≤ 96 ≤ 192 — the block always fills, the timeout
never fires). `b500-t250ms` satisfies the second (250 ms), which is why it runs at a
sane rate — but at 96 in flight its 250 ms timeout still sets the latency floor (min
289.7 ms, p50 333.9 ms) and costs it 42 % of the default's throughput.

## 6. Recommendation

Applying the decision rule:

1. **Did the default variant on NVMe show zero gaps ≥ 3 s and p99 < 1 s at c = 96?**
   Yes — 0 gaps, p99 351 ms. **The SATA-backed VHDX was the stall cause**, not Fabric's
   batching. That clause says keep defaults *unless a tuned variant gains ≥ 1.5× tps*.
2. **Does a tuned variant gain ≥ 1.5× tps?** Yes: `b50-t2s` reaches **1.66× at c = 96**
   (812.0 vs 487.9) and **2.17× at c = 192** (1005.9 vs 464.6), and does so while
   *halving* p99 (176.7 vs 351.0 ms; 301.4 vs 559.3 ms) with zero drops.

**Declare `b50-t2s` in Table 3.12 and rerun rows 2–4 under it.**

| Declared orderer parameter | Value | Against test-network default |
|---|---|---|
| `BatchTimeout` | 2 s | unchanged |
| `MaxMessageCount` | **50** | 10 |
| `PreferredMaxBytes` | **2 MB** | 512 KB |
| `AbsoluteMaxBytes` | 99 MB | unchanged |
| `SnapshotIntervalSize` | **256 MB** | Fabric default 16 MB |

Applying the secondary fsync criterion — *cut fsyncs/s the most while keeping p99 within
~1.5× of default's* — as a cross-check: at c = 96 default's p99 is 351 ms, so the
admissible band is ≤ 527 ms. Both `b50-t2s` (176.7 ms, 16.2 blocks/s) and `b500-t250ms`
(355.3 ms, 3.0 blocks/s) are inside it, and `b500-t250ms` cuts block-rate — hence
fsync-rate — a further 5×. It is **not** chosen, because that criterion exists to buy
stall immunity and there are no stalls left to buy: on the NVMe every variant including
the default records zero gaps and zero `slow fdatasync` warnings, and giving up 528 tps
(65 % of `b50-t2s`'s throughput) to remove fsyncs that no longer hurt is a bad trade. Should this campaign
ever move back to a storage tier where fsync latency bites, `b500-t250ms` is the fallback
and its numbers are in §3 for that purpose.

Two caveats for the rerun:

- `b50-t2s`'s advantage **depends on the operating point**: 50 ≤ in-flight. At the
  procedure's old default of c = 8 it would degrade exactly as `tuned-batch-only` did. The
  c = 96 operating point (ruled for all tiers after the row-3 knee) and
  `MaxMessageCount` 50 must be declared together.
- Each row here is **one rep**. The 1.66×/2.17× gains are far outside run-to-run noise
  (compare 487.9 here with 474.4 on SATA for the same configuration, 2.8 %), but the
  rows 2–4 reruns, with their warm-ups and 10+ measured reps, are what enters the
  manuscript.

## 7. What is running

The default `configtx.yaml` has been restored into
`~/Code/fabric-samples/test-network/configtx/` (`BatchTimeout: 2s`,
`MaxMessageCount: 10`, `PreferredMaxBytes: 512 KB`, no `SnapshotIntervalSize`), the
network was reset onto it with `tools/tier.sh 10000 1` (empty ledger, chaincode
deployed), and the console is serving in the WSL tmux session `console`:

```
Status
  ✓ docker running
  ✓ Fabric network up
  ✓ console up at http://127.0.0.1:8090 with on-chain ENABLED
```
