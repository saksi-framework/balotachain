# Validation run — SP/MP-1K and SP/MP-10K on saksi `076b730`

A **correctness/validation run, not a campaign**. It rebuilds saksi at main `076b730` on the
Ryzen desktop under WSL2 and reruns four tiers of the run table — SP-1K, MP-1K, SP-10K,
MP-10K, nothing larger — to check two optimizations live against the parallel-auditor
baseline of 2026-09-12 (`2026-09-12-rows2-4-parallel.md`, saksi `ef663d1`):

- **saksi PR #40** — the parallel auditor, `verify_threads` = 16. Already in the baseline;
  this run checks it is still live and still costs the same.
- **saksi PR #41** — NEW in `076b730`: the `ballots.progress` checkpoint no longer fsyncs on
  the ballot dispatcher goroutine. In the baseline the checkpoint fsync sat on the dispatch
  path and cost 69 s across 62 reps (12 reps affected), showing up as multi-second gaps with
  no ballot in flight.

Everything else is held fixed against the baseline: the same `b50-t2s` orderer parameters
installed by `network.sh`, the same driver concurrency 128, the same machine and the same
NVMe-backed Docker storage. The 1K tiers ran 2 warm-ups + 10 measured (as the baseline did);
the 10K tiers ran 2 + 5 to keep this a validation rather than a campaign.

**The two tier sizes answer different questions.** `ballots.progress` fires every 1,000
dispatched ballots, so the number of checkpoints per rep — and with it the chance of ever
observing the defect — is set by the tier:

| Tier | ballot records per rep | **checkpoints per rep** | can it exercise PR #41? |
|---|---|---|---|
| SP-1K | 1,000 | **1** | **no** — a single checkpoint has no consecutive pair |
| MP-1K | 3,000 | **3** | **no** — the baseline loses 0 s here |
| SP-10K | 10,000 | **10** | **yes** — the baseline loses 5.8 s over 10 measured reps |
| MP-10K | 30,000 | **30** | **yes** — the baseline loses 20.0 s over 10 measured reps |

So the 1K tiers establish that nothing regressed, and **the 10K tiers are where PR #41 is
actually tested**. It passes at both: §5.

**MP-10K was run three times.** The first two attempts ran while another Windows process
held about 43 % of the machine's 16 cores (§3b); they are reported, labelled contended, and
not used for the before/after. The third attempt, `mp-10k-val3`, ran on an idle host and is
the MP-10K row.

Artifacts are in `docs/desktop-runs/2026-09-12-validation/`: one folder per run (`perf.csv`,
`correctness.csv`, `run.json`, `stages.json`, `journal-line1.json`) and the per-attempt
`<tier>-val*-summary.csv` files, for every run named in this note including the two
contended MP-10K attempts. The full run folders (ballots, latencies, receipts, journals,
ledger dumps) stay in WSL under `~/.saksi/campaign/runs/*-val*`.

## 1. Environment

| | |
|---|---|
| Machine | AMD Ryzen 7 5700G (8C/16T), 31.9 GB RAM — the paper's Table 3.12 desktop |
| OS | Windows 11 Pro 10.0.26200, Fabric inside WSL2 Ubuntu 26.04, kernel 6.18.33.2-microsoft-standard-WSL2 |
| Docker data disk | `docker_data.vhdx` on the Kingston NVMe (junctioned from the default C: path) |
| RAM available to the run | 23 GB (`docker_info.MemTotal` 25,199,009,792), **swap 0** |
| CPU available to the run | 16 vCPU (`docker_info.NCPU` = 16) — **shared with the Windows host**, see §3b |
| Docker | Docker Desktop 4.90.0 (238679), server 29.7.2 |
| Fabric | 2.5.15 (`fabric-samples` test-network, channel `saksi`, chaincode `saksi-bulletin` 1.0), a fresh channel + empty ledger per tier and per MP-10K attempt |
| **saksi commit** | **`076b7303af73a8d164d4c6dc38b9fd84de77699c`** (main, PR #41) |
| **Auditor threads** | **`verify_threads` = 16** on all 52 reps of the session |
| **Orderer parameters** | `b50-t2s`, installed from the repo by `network.sh`'s `install_configtx` |
| Driver concurrency | **128** (unchanged from the baseline; not re-probed) |
| Container limits | none: `HostConfig.Memory` = 0 and `HostConfig.NanoCpus` = 0 on all three Fabric containers |
| Toolchains | cargo 1.98.1, go 1.25.1 |

**Build identity.** `git_head_console` = `git_head_saksi` = `076b7303…` in every
`journal-line1.json`. `saksi-demo` SHA-256
`836109988d9a98bcad0c91e289dc3fadc850ed036957fb667abd962619598ce9` — **byte-identical to the
baseline's**, as it must be: PR #41 touches only Go (`packages/saksi-campaign`), so the Rust
measurement path is literally the same binary and the whole delta is the campaign's.
`saksi-campaign` is `59cdc4525ebd4dddc54a279272b14e444cf4d6f677b4931ff1f7165d60a40599`.

**Gate.** `cargo build -p saksi-demo --release` ok; `go build` of `saksi-campaign` ok;
`go test ./...` in `packages/saksi-campaign` **passed clean** (`ok … 9.196s`), including PR
#41's new `journal_progress_test.go` (578 lines). Rerunning `TestSingleRunLockReturns409`
alone three times gave FAIL, ok, ok — the same pre-existing `t.TempDir` cleanup race seen at
`cf9fd2a`, `3cb07fc` and `ef663d1`; it did not fire in the full-suite run.
`tools/ladder.sh` **PASSED on `076b7303…`** on all four ladder tiers (1, 10, 100, 1,000
voters), recorded in `ladder.json`.

**Orderer parameters, checked before the first tier.** The installed
`fabric-samples/test-network/configtx/configtx.yaml` carries `MaxMessageCount: 50`,
`BatchTimeout: 2s`, `PreferredMaxBytes: 2 MB`, `SnapshotIntervalSize: 268435456`, and its
pristine backup `configtx.yaml.test-network-default` is genuinely pristine
(`MaxMessageCount: 10`, `PreferredMaxBytes: 512 KB`) — the mislabelled-backup defect the
baseline repaired has stayed repaired. Journal line 1 of every run carries, verbatim and
**identical to the baseline's**:

```json
"orderer_batch":{"AbsoluteMaxBytes":"99 MB","BatchTimeout":"2s","MaxMessageCount":"50","PreferredMaxBytes":"2 MB","SnapshotIntervalSize":"268435456","saksi_configtx":"saksi"}
```

`null_probes` is empty in every run: every environment probe succeeded.

## 2. How the tiers were run

Per tier: `tools/tier.sh <voters> <positions>` (network down, fresh channel generated from
the repo's `configtx.yaml`, chaincode redeployed — an empty ledger), the console restarted in
tmux `console` via `tools/up.sh` and waited on until `GET /api/capabilities` returned
`{"fabric":true,"peer":"localhost:7051","channel":"saksi"}`, then

```
saksi-campaign --repeat --config ~/<tier>.json \
    --warmups 2 --reps <10 at 1K, 5 at 10K> --base-url http://127.0.0.1:8090 \
    --out ~/<tier>-val-summary.csv
```

Configs are 5 trustees, threshold 3, 4 candidates, `realistic`, `onchain`,
`concurrency: 128`, `name` `<tier>-val` (`mp-10k-val2`, `mp-10k-val3` for the MP-10K
retries) so the run ids stay separable from the baseline's `*-par-*`. Each MP-10K attempt got
its own tier reset, i.e. its own empty ledger. Medians below are `summary.csv`'s own (lower
of the two middle values for even n) — the baseline note's convention, so the before/after
compares like with like. Note the 10K medians are over 5 measured reps against the
baseline's 10.

## 3. Two host effects that are not the code

Both rounds ran the same byte-identical Rust binary, so `gen_cpu_ms` and
`proof_verify_inproc_ms` **per ballot record** measure how much CPU this box was actually
giving the run at that moment. Two effects show up, and both have to be read out of the
throughput numbers before any comparison.

**(a) A cold start at SP-1K.** Docker Desktop had been restarted before this session, so the
first reps ran against cold peers and freshly built chaincode containers. `stall.csv`'s
`org1_commit_p50_ms` per run index reads 51, 52, **56, 36**, 28, 30, 29, 30, 31, 31, 28, 29:
the two warm-ups and the first two measured reps commit at 36–56 ms, everything after at
28–31 ms, which is the baseline's own 24–32 ms band. The same four reps carry the elevated
p99 (283–324 ms) and **no idle time at all** (§5). Nothing is excluded — the SP-1K median
below includes them — but measured reps 3–10 alone give a median of **968.9** and a mean of
**969.5 ± 53.7** against the baseline's 994.3 ± 53.1.

**The 10K tiers do not start cold.** Their first measured rep commits at the same speed as
the later ones: SP-10K `org1_commit_p50_ms` reads 33, 33 for the warm-ups and **33**, 33, 33,
33, 34 for the measured reps; the clean MP-10K attempt reads 31, 32 and **32**, 33, 33, 32,
35 — inside the baseline's own 32–33 ms medians for those tiers. By the time the 10K tiers
ran, the daemon and the chaincode images were warm, and two warm-ups sufficed.

**(b) Host CPU contention from another Windows process during two MP-10K attempts.** A game,
`sp22-cod`, was running on the Windows host. Sampling every process's CPU time over 10 s
while the second attempt ran put it at **42.9 % of all 16 cores** — about 7 cores held
continuously — with nothing else above 1 %; the WSL VM, and with it the generator, the
driver, the peers and the auditor, had the rest. It is visible in the runs' own
per-record CPU cost, on identical code:

| MP-10K attempt | rep | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| `mp-10k-val` (contended from rep 3) | `gen_cpu` ms/record | 2.474 | 2.502 | 2.841 | 3.214 | **4.100** | 3.921 | 4.001 |
| | in-process verify ms/record | 0.160 | 0.180 | 0.261 | 0.267 | 0.270 | 0.267 | 0.218 |
| | committed_tps | 892.8 | 798.1 | 795.1 | 464.2 | 489.3 | 481.6 | 468.1 |
| `mp-10k-val2` (contended throughout) | `gen_cpu` ms/record | 3.891 | 4.083 | 4.230 | 4.078 | 4.088 | 4.073 | 4.103 |
| | in-process verify ms/record | 0.268 | 0.269 | 0.259 | 0.265 | 0.259 | 0.258 | 0.201 |
| | committed_tps | 450.2 | 458.6 | 424.6 | 453.7 | 416.0 | 454.0 | 475.4 |
| **`mp-10k-val3` (idle host)** | `gen_cpu` ms/record | **2.280** | **2.387** | **2.291** | **2.304** | **2.375** | **2.286** | 2.869 |
| | in-process verify ms/record | 0.158 | 0.157 | 0.151 | 0.156 | 0.154 | 0.153 | 0.150 |
| | committed_tps | 1012.3 | 995.0 | 975.3 | 975.5 | 993.7 | 993.2 | 909.2 |

(Reps 1–2 of each attempt are its warm-ups.) The baseline's own MP-10K stayed flat at
**2.31–2.45** and 0.152–0.162 ms/record across all twelve of its reps.

- **`mp-10k-val`** starts in the baseline band and leaves it at rep 3: generate cost rises
  1.66× and in-process verify 1.69× — pure local CPU work, so the only way it gets more
  expensive is fewer effective cycles. `driver_ceiling_tps` falls with it (848.9 → 464.9), so
  the harness itself could not dispatch faster.
- **`mp-10k-val2` was still contended, on every rep.** It was started after a 7-minute idle
  wait — at the time I misread the first attempt as thermal throttling and expected a
  cooldown to clear it — but its very first warm-up already costs 3.891 ms/record and no rep
  drops below 3.89. The contending process was still running, which the process sample taken
  during this attempt confirmed. The wait could not help, because the cause was never heat.
- **`mp-10k-val3`** ran after the game was closed. Six of its seven reps cost **2.28–2.39
  ms/record** — inside, or marginally below, the baseline's band — and in-process verify is
  0.150–0.158. **It is the clean attempt and the MP-10K row of §4.** Its last measured rep
  (run index 7) costs 2.869 ms/record to generate, 25 % above the other six, with the tier's
  lowest throughput (909.2 TPS) and a slightly higher peer commit p50 (35 ms): some brief host
  activity during that rep's generation. It has no pause (§5) and it is included, not dropped.

Both contended attempts' throughput is therefore not comparable to the baseline and is not
used in §4. Their **pause** evidence is kept and reported in §5.2 as what it is: the new
build under far worse conditions than the baseline ever ran in.

This failure mode — a measurement silently running on a host whose CPU is shared with
something else — is exactly what the console's **preflight host-CPU check** now guards
against: saksi PR #43 (merged) samples host CPU before a campaign starts and reports it as a
preflight finding, WSL included. It was not in `076b730`, so this session could not have
caught it that way.

## 4. Before/after, all four tiers

**Before** = the parallel-auditor baseline (`2026-09-12-rows2-4-parallel.md`, saksi
`ef663d1`). **After** = this note (saksi `076b730`; MP-10K from the clean attempt
`mp-10k-val3`). Same orderer parameters, concurrency, machine and storage; the code
difference is PR #41 alone.

| | SP-1K before → after | MP-1K before → after | SP-10K before → after | MP-10K before → after (`val3`) |
|---|---|---|---|---|
| reps (warm-ups + measured) | 2+10 → 2+10 | 2+10 → 2+10 | 2+10 → 2+5 | 2+10 → 2+5 |
| **checkpoints per rep** | **1** | **3** | **10** | **30** |
| **committed_tps** median | 1004.09 → **960.04** | 1011.79 → **993.24** | 968.99 → **936.66** | 954.69 → **975.52** |
| committed_tps mean ± sd | 994.33 ± 53.14 → 914.41 ± 120.95 | 1005.60 ± 30.19 → 984.38 ± 36.59 | 886.59 ± 141.56 → **939.49 ± 8.70** | 905.16 ± 116.92 → **969.39 ± 31.15** |
| committed_tps min | 849.03 → 633.86 | 946.19 → 925.53 | **626.58 → 930.74** | **571.65 → 909.22** |
| driver_ceiling_tps median | 960.78 → 910.43 | 932.79 → 906.38 | 908.18 → 875.11 | 892.76 → 927.77 |
| **committed_tps ÷ driver ceiling** | 1.045 → **1.055** | 1.085 → **1.096** | 1.067 → **1.070** | 1.069 → **1.051** |
| latency p50 / p95 / **p99** ms | 133.0/157.5/**206.5** → 139.5/167.0/**212.1** | 136.8/156.6/**164.7** → 139.1/158.6/**167.3** | 140.3/168.5/**221.2** → 146.3/176.3/**251.8** | 142.8/175.1/**226.4** → 138.0/177.4/**217.0** |
| worst rep's p99 ms | 236.3 → 323.6 | 244.8 → 310.8 | **327.4 → 259.8** | **289.3 → 238.3** |
| verify stage s | 0.9 → **0.9** | 2.6 → **2.6** | 8.2 → **8.5** | 24.5 → **24.3** |
| `verify_ballots` ms (ms/record) | 154 → **154** (0.154 → 0.154) | 458 → **459** (0.153 → 0.153) | 1540 → **1606** (0.154 → 0.161) | 4702 → **4590** (0.157 → 0.153) |
| **`verify_threads`** | **16 → 16**, every rep | **16 → 16**, every rep | **16 → 16**, every rep | **16 → 16**, every rep |
| **reps with a pause ≥ 1 s** | 0 of 10 → **0 of 10** | 0 of 10 → **0 of 10** | **1 of 10 → 0 of 5** | **2 of 10 → 0 of 5** |
| **seconds lost to pauses** | 0.0 → **0.0** | 0.0 → **0.0** | **5.8 → 0.0** | **20.0 → 0.0** |
| **max checkpoint interval ÷ mean** | n/a (1 ckpt/rep) | 1.15 → 1.11 | **3.87 → 1.23** | **8.32 → 1.30** |
| `coalesced_total` | never → **never** | never → **never** | never → **never** | never → **never** |
| runs_measured / runs_failed | 10/**0** → 10/**0** | 10/**0** → 10/**0** | 10/**0** → 5/**0** | 10/**0** → 5/**0** |
| committed / dropped | 1000/**0** → 1000/**0** | 3000/**0** → 3000/**0** | 10000/**0** → 10000/**0** | 30000/**0** → 30000/**0** |
| `ledger_matches_local` | true → **true** (48 rows) | true → **true** (144 rows) | true → **true** (28 rows) | true → **true** (84 rows) |
| E / pass per contest | 0 / true → **0 / true** | 0 / true → **0 / true** | 0 / true → **0 / true** | 0 / true → **0 / true** |
| ballots per block | 50.0 → **50.0** | 50.0 → **50.0** | 50.0 → **50.0** | 50.0 → **50.0** |
| `ledger.dump` read path | `batched` → **`batched`** | `batched` → **`batched`** | `batched` → **`batched`** | `batched` → **`batched`** |
| `sustained` | true → **true** | true → **true** | true → **true** | true → **true** |
| `scaling_limit` | inconclusive → inconclusive | inconclusive → inconclusive | false/inconclusive → inconclusive | false/inconclusive → inconclusive |
| `fail_reason` | *(empty)* → *(empty)* | *(empty)* → *(empty)* | *(empty)* → *(empty)* | *(empty)* → *(empty)* |
| block gaps ≥ 3 s / `slow fdatasync` | 0 / 0 → **0 / 0** | 0 / 0 → **0 / 0** | 1 / 0 → **0 / 0** | 2 / 0 → **0 / 0** |
| lifecycle tail s | 6 → **6** | 10 → **10** | 6 → **6** | 10 → **10** |
| run wall s (median) | 15 → **15** | 24 → **24** | 36 → **37** | 88 → **86** |

Per-rep `committed_tps`, measured reps:

- **SP-1K after**: 644.68, 743.72, 1024.59, 852.87, 1015.52, 971.23, 958.47, 968.90, 1004.06, 960.04
  (before: 1012.99, 958.68, 1027.78, 1034.69, 1038.02, 1020.52, 849.03, 1002.27, 1004.09, 995.23)
- **MP-1K after**: 1024.77, 951.78, 1029.76, 925.53, 1022.12, 951.40, 994.98, 941.20, 993.24, 1008.99
  (before: 1029.83, 1044.71, 971.89, 1011.79, 946.19, 1021.72, 974.89, 1022.53, 1033.21, 999.22)
- **SP-10K after**: 956.16, 930.74, 936.66, 938.27, 935.65
  (before: 991.73, 980.43, 968.99, 974.58, 769.17, 637.43, 954.82, 626.58, 981.86, 980.33)
- **MP-10K after, clean attempt `val3`**: 975.29, 975.52, 993.67, 993.23, 909.22
  (before: 961.61, 959.71, 963.93, 954.69, 964.43, 945.05, 955.39, 938.33, 571.65, 836.84)
- MP-10K after, contended attempts, *not used for the comparison*: `val` 795.07, 464.19,
  489.33, 481.59, 468.14; `val2` 424.62, 453.68, 415.97, 454.05, 475.41.

**Both 10K tiers move the way removing a stall should.** A stall does not shave every rep; it
collapses a few, which drags the mean and the minimum and inflates the spread while barely
touching the median. That is what the baseline shows and what the new build no longer does:

- **MP-10K**: mean **905.2 → 969.4, +7.1 %**; minimum **571.7 → 909.2, +59 %**; standard
  deviation **116.9 → 31.1**; median **954.7 → 975.5, +2.2 %**; worst p99 **289 → 238 ms**,
  median p99 226 → 217 ms. The lowest rep is the one with the elevated generate cost of §3b,
  not a pause.
- **SP-10K**: mean **886.6 → 939.5, +6.0 %**; minimum **626.6 → 930.7, +48 %**; standard
  deviation **141.6 → 8.7**, a 16-fold reduction; worst p99 327 → 260 ms. The median is 3.3 %
  lower, but the baseline's median sat above its own mean because the tier was bimodal. Five
  consecutive reps inside a 25 TPS band is the tightest 10K measurement of any session.
  SP-10K's per-record cost is mildly above its baseline (generate 2.58–2.91 against
  2.53–2.73, verify 0.156–0.170 against 0.152–0.166), so it may carry the leading edge of the
  contention of §3b; if so, its throughput is understated rather than flattered.

Against their own `driver_ceiling_tps` the ratios barely move at either 10K tier (1.067 →
1.070, 1.069 → 1.051): the driver ceiling itself varies by ±4 % between sessions (it is lower
at 1K and SP-10K, higher at MP-10K), so the ratio is given to show the tiers are not flattered
by a faster client. The p99 rise at SP-10K (221 → 252 ms, median) does not reproduce at
MP-10K (226 → 217 ms), which ran on the verified-idle host.

The 1K rows moved by −2.1 % (MP) and −4.4 % (SP) on the median, inside one standard
deviation and not significant at n = 10 (t ≈ 1.4 and, on SP-1K's warm reps, t ≈ 1.0); SP-1K's
larger drop is the cold start of §3a. Normalised against the driver ceiling both 1K tiers
are marginally **up**. This is what "no pause to remove" looks like.

## 5. The PR #41 check

A **pause** here is an interval in which *no ballot was in flight*. Two independent
derivations were computed for every rep of both rounds:

- **(A) in-flight coverage**, from `latencies.csv` + `receipts.csv`, as the baseline report
  did. Ballot *i* was in flight over `[commit_ts − ms/1000, commit_ts]`, where `commit_ts` is
  the timestamp of the block that carried it and `ms` its end-to-end latency. Merge those
  intervals across the submission window; the holes are the intervals in which nothing was in
  flight. Journal-independent.
- **(B) journal checkpoints**, from `journal.ndjson`'s `ballots.progress` `mono_ms` — the
  interval between two consecutive checkpoints, 1,000 dispatched ballots apart. This is the
  cross-check and the derivation that produced the baseline's headline numbers. Because the
  interval's *floor* is the time to dispatch 1,000 ballots, it is reported here **normalised
  by the rep's own mean interval** (`1000 / committed_tps`), which keeps it comparable
  between a fast rep and a slow one.

### 5.1 Where the baseline's 69 s lives

Rerunning (B) over all 62 `*-par-*` baseline reps reproduces the baseline report's headline
exactly — **12 reps with a pause ≥ 3 s, 69 s lost** — and **every affected rep is at 10K or
50K**:

| Baseline tier | reps | ckpts/rep | pauses ≥ 3 s, (B) | s lost, (B) | measured reps with a hole ≥ 1 s, (A) | s lost, (A) |
|---|---|---|---|---|---|---|
| **SP-1K** | 12 | **1** | **0** | **0** | **0 of 10** | **0.0** |
| **MP-1K** | 12 | **3** | **0** | **0** | **0 of 10** | **0.0** |
| **SP-10K** | 12 | **10** | 2 | 8 | **1 of 10** | **5.8** |
| **MP-10K** | 12 | **30** | 3 | 24 | **2 of 10** | **20.0** |
| SP-50K | 7 | 50 | 1 | 6 | 1 of 5 | 4.6 |
| MP-50K | 7 | 150 | 6 | 31 | 1 of 5 | 12.6 |
| **all six** | **62** | | **12** | **69** | **5 of 50** | **43.0** |

The 1K zeros are arithmetic, not luck: an SP-1K rep fires **one** checkpoint, so (B) has no
consecutive pair at all, and an MP-1K rep fires three. That is why the 1K tiers cannot test
PR #41 and the 10K tiers can.

### 5.2 After PR #41: no pause survives at either 10K tier

| | SP-10K before | **SP-10K after** | MP-10K before | **MP-10K after (`val3`)** |
|---|---|---|---|---|
| measured reps | 10 | **5** | 10 | **5** |
| reps with a hole ≥ 1 s, (A) | **1** | **0** | **2** | **0** |
| reps with a hole ≥ 3 s, (A) | **1** | **0** | **1** | **0** |
| seconds lost, (A) | **5.8** | **0.0** | **20.0** | **0.0** |
| seconds lost per measured rep | 0.58 | **0.00** | 2.00 | **0.00** |
| largest checkpoint interval | **6.18 s** | 1.29 s | **14.56 s** | 1.33 s |
| largest interval ÷ that rep's mean | **3.87×** | **1.23×** | **8.32×** | **1.30×** |
| `coalesced_total` | never | **never** | never | **never** |

The per-rep detail for every pause that remains on the clean runs: **there is none.** Not one
measured rep of SP-10K or of the clean MP-10K attempt has an interval, at any threshold from
1 s up, in which no ballot was in flight. The clean MP-10K attempt's largest checkpoint
interval per measured rep is 1.33, 1.25, 1.19, 1.23 and 1.23 s — 1.12–1.30× the rep's own
dispatch mean, the same band as SP-10K after (1.13–1.23×) and as the baseline's *unaffected*
reps (1.11–1.28×).

The baseline's surviving detail, for contrast — these are the reps PR #41 targets. All three
have the defect's signature: a long idle hole with a *normal* p99, because nothing was stuck,
nothing was being sent:

| Baseline rep | tps | p99 ms | (A) holes | s lost | largest checkpoint interval |
|---|---|---|---|---|---|
| `sp-10k-par-…-10` (measured 8) | 626.58 | 215.8 | 5.8 s | 5.8 | 6.18 s at done = 10,000 |
| `mp-10k-par-…-11` (measured 9) | 571.65 | 226.4 | 13.8 s; 1.8 s; 2.8 s | 18.3 | 14.56 s at done = 2,000 |
| `mp-10k-par-…-12` (measured 10) | 836.84 | 289.3 | 1.6 s | 1.6 | 3.24 s at done = 15,000 |

**The contended MP-10K attempts, reported for completeness and not counted.**

| Contended attempt | measured reps with a hole ≥ 1 s, (A) | s lost | largest interval ÷ mean, per measured rep |
|---|---|---|---|
| `mp-10k-val` | **0 of 5** | 0.0 | 1.25, 1.21, 1.27, 1.27, 1.42 |
| `mp-10k-val2` | **1 of 5** | 1.5 | 1.34, 1.30, 1.80, 1.30, **5.94** |

- **`mp-10k-val`** has no pause at all even while contended. Every absolute checkpoint
  interval roughly doubled (≈1.05 s → ≈2.1 s) because dispatch itself had halved, and the
  normalised ratio stayed at 1.21–1.42× — a dispatcher that no longer blocks on an fsync slows
  down uniformly with the CPU; it does not freeze in bursts.
- **`mp-10k-val2`, measured rep 5** is the one exception, and it is a **different event**.
  It has a 12.48 s checkpoint interval at done = 7,000 (5.94× its mean) and, inside it, a
  1.5 s hole with no ballot in flight. But in the same interval the slowest ballots took
  **6.16 s** to commit, the rep's p99 is **2,571 ms**, and a block was cut short by the
  batch timeout (`ballots_per_block` 49.92 in that rep, 50.0 in every other rep of every
  attempt): ballots were *stuck in flight* for six seconds, and the short hole is the tail of
  that. The PR #41 defect has the opposite signature — the chain idle, in-flight latency
  normal (the pauses tabulated in the baseline note's §10 had slowest single ballots of
  309–625 ms). This is the whole VM being starved under the heaviest
  contention of the session, and it is reported as such. It is not evidence about PR #41 in
  either direction, which is why the verdict rests on the clean attempt.

`coalesced_total` never appears in any journal line of any run, at any tier, in either round
or any attempt — as expected: the queue never filled at these rates.

## 6. Verdict, per optimization

**PR #40 — parallel auditor: CONFIRMED at all four tiers.** `verify_threads` is **16** on all
52 reps of the session — never 1, never empty — and the audit cost matches the baseline
record for record on every uncontended run: `verify_ballots` 154 ms at SP-1K (baseline 154),
459 ms at MP-1K (458), 1,606 ms at SP-10K (1,540) and 4,590 ms at MP-10K (4,702), i.e. 0.154,
0.153, 0.161 and 0.153 ms per ballot record against the baseline's 0.154, 0.153, 0.154 and
0.157, with the verify *stage* at 0.9, 2.6, 8.5 and 24.3 s against 0.9, 2.6, 8.2 and 24.5.
SP-10K's 4 % is inside the possible contention edge of §3b; the contended MP-10K attempts'
0.26–0.27 ms/record is the contention, not the auditor.

**PR #41 — progress checkpoint off the submission path: CONFIRMED at both 10K tiers.** At the
two tiers that can exercise it, every dispatcher pause is gone on a clean host: SP-10K **1 of
10 measured reps and 5.8 s lost → 0 of 5 and 0.0 s**, MP-10K **2 of 10 and 20.0 s → 0 of 5
and 0.0 s**, with the largest checkpoint interval falling from 3.87× to 1.23× and from 8.32×
to 1.30× of the rep's own dispatch mean. The throughput signature follows at both tiers: the
collapsed reps are gone, so the mean rises (+6.0 % SP-10K, +7.1 % MP-10K), the minimum rises
(+48 %, +59 %), and the spread collapses (141.6 → 8.7 and 116.9 → 31.1 TPS). Nothing was
traded for it — `runs_failed` = 0, 0 ballots dropped, `ledger_matches_local` true on all 472
`source=ledger` rows of the session (304 in the reported runs), E = 0 and `pass` true
everywhere, 50.0 ballots per block on every clean rep, `read_path` `batched` on every rep, no
`slow fdatasync` in any submission window, and `coalesced_total` never fires. The one hole on
the new build, in a contended attempt, carries a starved-VM signature, not the defect's (§5.2).

**PR #41 is NOT validated at 1K, and cannot be.** SP-1K fires one checkpoint per rep and
MP-1K three; the baseline loses 0 s to pauses at both, so there is nothing for the fix to
remove and the −2.1 %/−4.4 % medians there are cold start and run-to-run spread (§3a, §4).
The negative result is stated rather than papered over: **1K tiers must not be cited as
evidence for or against PR #41.**

## 7. Caveats

- **The 10K medians are over 5 measured reps, the baseline's over 10.** This was run as a
  validation, not a campaign. The pause counts are therefore reported per measured rep as
  well as raw.
- **Two of three MP-10K attempts ran under host CPU contention** from another Windows
  process (`sp22-cod`, ≈43 % of 16 cores; §3b). Their throughput is not used; their pause
  evidence is reported and labelled. The clean attempt `mp-10k-val3` is the MP-10K row, and
  its last measured rep shows a brief rise in generate cost (2.869 ms/record) that is
  included, not dropped. I first misattributed the slowdown to thermal throttling, and the
  7-minute idle wait before `mp-10k-val2` was based on that misreading; a host process
  sample established the actual cause. saksi PR #43's preflight host-CPU check exists for
  this case and was not in the build under test.
- **SP-10K may carry the leading edge of that contention** — its per-record CPU cost is a
  few per cent above its baseline — so its throughput row is, if anything, understated.
- **SP-1K's first four reps ran cold** after a Docker Desktop restart (§3a). Two warm-ups are
  not enough on a cold daemon; nothing was excluded, but the affected reps are named. The 10K
  tiers show no cold first rep.
- **`driver_ceiling_tps` varies ±4 % between sessions** (−5.2 % at SP-1K, −2.8 % at MP-1K,
  −3.6 % at SP-10K, +3.9 % at MP-10K against the baseline). Ratios against it are given
  alongside the raw medians for that reason.
- **The 10K tiers tripped the validation-ladder gate** (`POST /generate: 400 … validation
  ladder has not been run for this build`) on the first attempt; `tools/ladder.sh` was run and
  PASSED on `076b730`, and the tier was restarted from a fresh channel. The 1K tiers never
  hit the gate, which is why it did not surface earlier in the session.
- **`peak_cpu_pct_*` is empty at SP-1K and MP-1K** — submission windows of 1–3 s against a 5 s
  sampler. Populated from 10K up. Unchanged from the baseline.
- **`ledger_bytes_delta` is empty in every run** (as in every session so far): no producer for
  the column on this path.
- **`negative-tests.csv` is absent in every run**: the `--repeat` driver does not run the
  Scenarios stage that writes it.
- **No concurrency probe was run.** c = 128 is settled from 2026-09-11 and reused unchanged.
- **`scaling_limit` is `inconclusive` on every clean rep**: `committed_tps` sits at or above
  the driver ceiling, so these are floors set by the harness, not system limits.
- **One `go test` flake**, `TestSingleRunLockReturns409`, reproduced 1 of 3 times in isolation
  and not at all in the full-suite run. Pre-existing `t.TempDir` cleanup race.
- **The rename of this note from `2026-09-12-validation-1k.md`, and of its artifacts
  directory, landed in commit `a94be78`** alongside an unrelated plan document, because the
  `git mv` was staged when that commit was made. The content change is in the commit that
  adds the 10K artifacts.
- **`docs/manuscript-amendments.md`, `CLAIMS.md`, `cost-model.md` and `cost_model.py` were not
  edited.** The cost model is not refitted on these runs; nothing here is a fit.
