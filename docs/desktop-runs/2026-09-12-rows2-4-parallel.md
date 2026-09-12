# Desktop runs — rows 2–4 on the parallel auditor, saksi `ef663d1`

Executed 2026-09-12 on the Ryzen desktop under WSL2, rerunning run-table rows 2, 3 and 4
so that **every reported row shares one verifier configuration**. The previous run of the
same six tiers (`2026-09-11-rows2-4-b50.md`, saksi `cf9fd2a`) measured a **serial**
auditor; saksi PR #40 (merged as `ef663d1`) verifies ballots on all cores, which changes
`proof_verify_inproc_ms` from summed per-ballot CPU time on one thread into wall time on
`verify_threads` threads. Numbers from the two builds are not comparable, so rather than
mix them the rows were rerun.

Everything else is held fixed against the 2026-09-11 run: the same six tiers, the same
rep counts (2 warm-ups + 10 measured at 1K and 10K, 2 + 5 at 50K), the same orderer
parameters, the same driver concurrency (128 — settled by the 2026-09-11 probe, not
re-probed), the same machine, the same storage. **Only the auditor differs**, which is
what makes §8 a controlled before/after and the paper's verification-scaling evidence.

Artifacts for every figure below are in `docs/desktop-runs/2026-09-12-rows2-4-parallel/`:
one folder per run (`run.json`, `perf.csv`, `perf-schema.md`, `correctness.csv`,
`ground-truth-check.json`, `timings.json`, `journal-line1.json`, `stages.json`), the six
`<tier>-summary.csv` files, the stall-evidence table `stall.csv`, and `ladder.json`. The
full run folders (ballots, latencies, receipts, journals, ledger dumps) stay in WSL in
`~/saksi-runs-2026-09-12-rows2-4-parallel.tgz`.

## Environment

| | |
|---|---|
| Machine | AMD Ryzen 7 5700G (8C/16T), 31.9 GB RAM — the paper's Table 3.12 desktop |
| OS | Windows 11 Pro 10.0.26200, Fabric inside **WSL2 Ubuntu 26.04** |
| Docker data disk | `docker_data.vhdx` on the Kingston NVMe (`Q:\DockerDesktop\...`, junctioned from the default C: path) |
| RAM available to the run | 24 GB of 32 (`.wslconfig` `memory=24GB`; `docker_info.MemTotal` 25,199,005,696), swap 0 |
| CPU available to the run | 16 vCPU (`docker_info.NCPU` = 16) |
| Kernel | 6.18.33.2-microsoft-standard-WSL2 |
| Docker | Docker Desktop 4.90.0 (238679), server 29.7.2 |
| Fabric | 2.5.15 (`fabric-samples` test-network, channel `saksi`, chaincode `saksi-bulletin` 1.0), a fresh channel + empty ledger per tier |
| **saksi commit** | **`ef663d1`** (main, PR #40 — parallel auditor) |
| **Auditor threads** | **`verify_threads` = 16** on every rep of every tier (`timings.json`, `perf.csv`) |
| **Orderer parameters** | `b50-t2s`, now **declared in the saksi repo** — see below |
| Driver concurrency | **128** (unchanged from 2026-09-11; not re-probed) |
| Container limits | none: `HostConfig.Memory` = 0 and `HostConfig.NanoCpus` = 0 on all three Fabric containers |
| Toolchains | cargo 1.98.1, go 1.25.1 |

**The orderer configuration is now installed by the repo, and recorded in the journal.**
Since saksi PR #39, `packages/saksi-bulletin/network/network.sh` has an `install_configtx`
step that copies the repo's own `configtx.yaml` into
`fabric-samples/test-network/configtx/configtx.yaml` on every `up`, and the campaign
stamps the declared values into journal line 1 as `orderer_batch`. Both were checked
before the first tier: the installed file carries `MaxMessageCount: 50`, `BatchTimeout:
2s`, `PreferredMaxBytes: 2 MB`, `SnapshotIntervalSize: 268435456`, and journal line 1 of
every run of this session carries, verbatim:

```json
"orderer_batch":{"AbsoluteMaxBytes":"99 MB","BatchTimeout":"2s","MaxMessageCount":"50","PreferredMaxBytes":"2 MB","SnapshotIntervalSize":"268435456","saksi_configtx":"saksi"}
```

So the orderer regime is now a recorded field rather than a run-name convention — which
is what the cost model's regime guard reads (§9).

## 1. Build identity

- saksi commit `ef663d18c126f7ea2e4de1bd051a4116da074250` (main, PR #40);
  `git_head_console` = `git_head_saksi` = that commit in every `journal-line1.json`
- `saksi-demo` SHA-256
  `836109988d9a98bcad0c91e289dc3fadc850ed036957fb667abd962619598ce9` — **different from
  the 2026-09-11 runs** (`3b04f5a6…`), as it must be: PR #40 rewrites `saksi-auditor`,
  which `saksi-demo` links.
- Gate: `cargo build -p saksi-demo --release` ok, `go build` of `saksi-campaign` ok,
  `go test ./...` in `packages/saksi-campaign`: **one failure, `TestSingleRunLockReturns409`,
  and it is not a test assertion** — the only output is
  `testing.go:1369: TempDir RemoveAll cleanup: unlinkat …: directory not empty`. It is the
  same pre-existing `t.TempDir` cleanup race seen at `cf9fd2a` and `3cb07fc`; rerunning
  the single test three times here gave FAIL, ok, ok. It says nothing about the
  measurement path.
- Validation ladder at `ef663d1`: **PASS** on all four tiers (1, 10, 100, 1,000 voters) in
  11 s, `ladder.json` `"commit"` = `ef663d18…`. A new build closes the gate by
  construction, so the ladder was rerun before the first tier.

`journal.ndjson` line 1 (the environment snapshot), verbatim, from
`sp-1k-par-20260911-232043-3` — `null_probes` is empty, so every probe succeeded:

```json
{"containers":[{"HostConfig.Memory":0,"HostConfig.NanoCpus":0,"Name":"/peer0.org1.example.com"},{"HostConfig.Memory":0,"HostConfig.NanoCpus":0,"Name":"/orderer.example.com"},{"HostConfig.Memory":0,"HostConfig.NanoCpus":0,"Name":"/peer0.org2.example.com"}],"cpu_model":"AMD Ryzen 7 5700G with Radeon Graphics","docker_info":{"NCPU":16,"MemTotal":25199005696,"ServerVersion":"29.7.2","OSType":"linux"},"docker_version":{"Client":{"ApiVersion":"1.55","Arch":"amd64","BuildTime":"Wed Aug  5 18:27:38 2026","Context":"default","DefaultAPIVersion":"1.55","GitCommit":"a7dcaa6","GoVersion":"go1.26.5","Os":"linux","Version":"29.7.2"},"Server":{"ApiVersion":"1.55","Arch":"amd64","BuildTime":"2026-08-05T18:28:36.000000000+00:00","Components":[{"Details":{"ApiVersion":"1.55","Arch":"amd64","BuildTime":"Wed Aug  5 18:28:36 2026","Experimental":"false","GitCommit":"6a43e3d","GoVersion":"go1.26.5","KernelVersion":"6.18.33.2-microsoft-standard-WSL2","MinAPIVersion":"1.40","Module":"github.com/moby/moby/v2","ModuleVersion":"v2.0.0+unknown","Os":"linux"},"Name":"Engine","Version":"29.7.2"},{"Details":{"GitCommit":"aad11006b869517fcd3009450b6f82da282e1a9b"},"Name":"containerd","Version":"v2.3.3"},{"Details":{"GitCommit":"v1.4.3-0-gbb14dabe"},"Name":"runc","Version":"1.4.3"},{"Details":{"GitCommit":"de40ad0"},"Name":"docker-init","Version":"0.19.0"}],"GitCommit":"6a43e3d","GoVersion":"go1.26.5","KernelVersion":"6.18.33.2-microsoft-standard-WSL2","MinAPIVersion":"1.40","Os":"linux","Platform":{"Name":"Docker Desktop 4.90.0 (238679)"},"Version":"29.7.2"}},"event":"env","git_head_console":"ef663d18c126f7ea2e4de1bd051a4116da074250","git_head_saksi":"ef663d18c126f7ea2e4de1bd051a4116da074250","go_arch":"amd64","go_os":"linux","go_version":"go1.25.1","null_probes":[],"orderer_batch":{"AbsoluteMaxBytes":"99 MB","BatchTimeout":"2s","MaxMessageCount":"50","PreferredMaxBytes":"2 MB","SnapshotIntervalSize":"268435456","saksi_configtx":"saksi"},"saksi_demo_sha256":"836109988d9a98bcad0c91e289dc3fadc850ed036957fb667abd962619598ce9","ts":"2026-09-11T23:20:44Z","uname":"Linux Ban-PC 6.18.33.2-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC Thu Jun 18 21:54:43 UTC 2026 x86_64 GNU/Linux"}
```

## 2. Proof that the parallel verifier is live

Checked on the **first completed run of the session** (`sp-1k-par-20260911-232011-1`,
warm-up 1) before any long tier was started, as the brief required:

- `timings.json`: `{"verify_ballots":154,"aggregate":1,"combine":0,"decode":0,"verify_threads":16}`
- `perf.csv`: the `verify_threads` column is populated — `16` — and
  `proof_verify_inproc_ms` is `154`.

Against the same tier in the 2026-09-11 note (serial auditor, same tier, same
concurrency, same orderer parameters): `stage.verify` **3.5 s → 0.9 s** and
`verify_ballots` **1,416 ms → 154 ms**, i.e. 1.417 ms/record on one thread against
0.154 ms/record on sixteen. `verify_threads` is 16 on all 12 reps of every tier below;
it is never 1, never empty.

The orderer parameters still take, on the ledger rather than the config: every rep of
every tier has `ballots_per_block` = 50.0 in its `stages.json` and `max_per_block` = 50
in its `stall.csv` row, and `ledger.dump` `read_path` is `batched` in every rep.

## 3. How every tier was run

Per tier: `tools/tier.sh <voters> <positions>` (network down, fresh channel generated
from the repo's `configtx.yaml`, chaincode redeployed — an empty ledger), the console
restarted in tmux `console` and `up.sh status` waited on until it reported on-chain
ENABLED (`{"fabric":true,"peer":"localhost:7051","channel":"saksi"}` reconfirmed), then

```
saksi-campaign --repeat --config ~/rows24/<tier>-par.json \
    --warmups <W> --reps <R> --out ~/rows24/<tier>-par-summary.csv
```

Each config is 5 trustees, threshold 3, 4 candidates, `realistic`, `onchain`,
`concurrency: 128`, with `name`, `voters` and `positions` per tier. The driver is
`~/rows24/rowspar.sh 128`, one tmux session (`rows`), log `~/saksi-logs/rows-par.log`.
After each tier, `stats.sh` wrote one stall-evidence row per rep and `stages.py` one
`stages.json` per rep. **No concurrency probe was run**: c = 128 was settled on
2026-09-11 and is reused unchanged.

A **stall** is a measured rep with p99 > 5 s (the brief's definition). A **slow rep** is
one with 1 s < p99 ≤ 5 s — reported, not counted as a stall. Medians in the field tables
are `summary.csv`'s own, which takes the lower of the two middle values for even n — the
same convention as the two earlier notes, so the before/after in §8 compares like with
like.

## 4. Row 2 — SP-1K and MP-1K (2 warm-ups + 10 measured each)

### SP-1K — 1,000 voters × 1 position

| Field | Value | Source |
|---|---|---|
| **committed_tps** | **1004.088** median (mean 994.329, min 849.028, p95 1038.015, stddev 53.135, n = 10) | `sp-1k-summary.csv` |
| **sustained** | `true` — on all 12 reps | `perf.csv`, `run.end` |
| **scaling_limit** | `inconclusive` — on all 12 reps | `perf.csv`, `run.end` |
| **fail_reason** | *(empty)* — on all 12 reps | `perf.csv`, `run.end` |
| **ledger_matches_local** | **true** — on all 48 `source=ledger` rows of all 12 reps; E / pass pairs seen: E = 0 / pass = true | `correctness.csv` |
| driver_ceiling_tps | 960.784 median (mean 953.753, min 859.987, stddev 44.132) | `sp-1k-summary.csv` |
| warm-ups discarded | 2 (`sp-1k-par-20260911-232011-1`, `sp-1k-par-20260911-232027-2`) | |
| runs_measured | 10 | |
| runs_failed | **0** | |
| committed / dropped | 1000 / 0 on every rep | |
| latency p50 / p95 / p99 | 133.006 / 157.505 / 206.519 ms (medians; worst rep's p99 236.3 ms) | `sp-1k-summary.csv` |
| submit_window_ms | 987 median | `sp-1k-summary.csv` |
| peak CPU, peer / orderer | *(empty)* / *(empty)* % of one core (max over measured reps) | `perf.csv` |
| **stalls (p99 > 5 s)** | **0** of 10 measured | `perf.csv` |
| slow reps (1 s < p99 ≤ 5 s) | 0 | `perf.csv` |
| lifecycle tail (`CloseElection` → `PublishTally`) | 6 s median (range 6–7) | `receipts.csv` via `stages.json` |
| verify stage | 0.9 s median (range 0.9–1.0) | `journal.ndjson` via `stages.json` |
| **verify_threads** | **16** — on all 12 reps | `perf.csv`, `timings.json` |
| `verify_ballots` (`proof_verify_inproc_ms`) | 154 ms median (range 153–188) | `timings.json` via `perf.csv` |
| run wall time | 15 s median | `run.start` → `run.end` |
| ballots per block | 50.0 in every rep | `receipts.csv` via `stages.json` |
| `ledger.dump` read path | `batched` in every rep | `journal.ndjson` |
| block gaps ≥ 3 s / `slow fdatasync` | 0 / 0 over all measured reps | `stall.csv` |
| peer commit p50 / max, org1 · org2 | 28 / 57 ms · 21 / 46 ms (median of per-rep p50; max of per-rep max) | `stall.csv` |

Per-rep `committed_tps`, measured reps 1–10: 1012.994, 958.680, 1027.778, 1034.690, 1038.015, 1020.521, 849.028, 1002.274, 1004.088, 995.226.

The submission window is ~1 s, so each rep is dominated by ramp-up and by which block
boundary it straddles, and the 5 s CPU sampler never ticks — `peak_cpu_pct_*` is empty
(the honest-CSV rule writes empty rather than zero). `committed_tps` is above the driver
ceiling, hence `inconclusive`: 1,004 TPS is a floor, not a system limit.

### MP-1K — 1,000 voters × 3 positions

| Field | Value | Source |
|---|---|---|
| **committed_tps** | **1011.79** median (mean 1005.598, min 946.193, p95 1044.712, stddev 30.188, n = 10) | `mp-1k-summary.csv` |
| **sustained** | `true` — on all 12 reps | `perf.csv`, `run.end` |
| **scaling_limit** | `inconclusive` — on all 12 reps | `perf.csv`, `run.end` |
| **fail_reason** | *(empty)* — on all 12 reps | `perf.csv`, `run.end` |
| **ledger_matches_local** | **true** — on all 144 `source=ledger` rows of all 12 reps; E / pass pairs seen: E = 0 / pass = true | `correctness.csv` |
| driver_ceiling_tps | 932.787 median (mean 931.249, min 904.863, stddev 15.205) | `mp-1k-summary.csv` |
| warm-ups discarded | 2 (`mp-1k-par-20260911-232519-1`, `mp-1k-par-20260911-232543-2`) | |
| runs_measured | 10 | |
| runs_failed | **0** | |
| committed / dropped | 3000 / 0 on every rep | |
| latency p50 / p95 / p99 | 136.83 / 156.587 / 164.666 ms (medians; worst rep's p99 244.8 ms) | `mp-1k-summary.csv` |
| submit_window_ms | 2936 median | `mp-1k-summary.csv` |
| peak CPU, peer / orderer | *(empty)* / *(empty)* % of one core (max over measured reps) | `perf.csv` |
| **stalls (p99 > 5 s)** | **0** of 10 measured | `perf.csv` |
| slow reps (1 s < p99 ≤ 5 s) | 0 | `perf.csv` |
| lifecycle tail (`CloseElection` → `PublishTally`) | 10 s median (range 10–11) | `receipts.csv` via `stages.json` |
| verify stage | 2.6 s median (range 2.6–2.8) | `journal.ndjson` via `stages.json` |
| **verify_threads** | **16** — on all 12 reps | `perf.csv`, `timings.json` |
| `verify_ballots` (`proof_verify_inproc_ms`) | 458 ms median (range 454–576) | `timings.json` via `perf.csv` |
| run wall time | 24 s median | `run.start` → `run.end` |
| ballots per block | 50.0 in every rep | `receipts.csv` via `stages.json` |
| `ledger.dump` read path | `batched` in every rep | `journal.ndjson` |
| block gaps ≥ 3 s / `slow fdatasync` | 0 / 0 over all measured reps | `stall.csv` |
| peer commit p50 / max, org1 · org2 | 30 / 65 ms · 23 / 40 ms (median of per-rep p50; max of per-rep max) | `stall.csv` |

Per-rep `committed_tps`, measured reps 1–10: 1029.827, 1044.712, 971.888, 1011.790, 946.193, 1021.724, 974.893, 1022.528, 1033.212, 999.216.

Three positions cost three ballot records per voter and the per-record rate is the same
(1,011.8 vs 1,004.1 TPS): the position count multiplies the work without slowing the
chain. This tier is also the steadiest 1K measurement so far (stddev 30 TPS against 85
on 2026-09-11).

## 5. Row 3 — SP-10K and MP-10K (2 warm-ups + 10 measured each)

### SP-10K — 10,000 voters × 1 position

| Field | Value | Source |
|---|---|---|
| **committed_tps** | **968.985** median (mean 886.59, min 626.577, p95 991.732, stddev 141.557, n = 10) | `sp-10k-summary.csv` |
| **sustained** | `true` — on all 12 reps | `perf.csv`, `run.end` |
| **scaling_limit** | `false`, `inconclusive` — mixed across the 12 reps | `perf.csv`, `run.end` |
| **fail_reason** | *(empty)* — on all 12 reps | `perf.csv`, `run.end` |
| **ledger_matches_local** | **true** — on all 48 `source=ledger` rows of all 12 reps; E / pass pairs seen: E = 0 / pass = true | `correctness.csv` |
| driver_ceiling_tps | 908.179 median (mean 908.452, min 888.522, stddev 10.083) | `sp-10k-summary.csv` |
| warm-ups discarded | 2 (`sp-10k-par-20260911-233200-1`, `sp-10k-par-20260911-233236-2`) | |
| runs_measured | 10 | |
| runs_failed | **0** | |
| committed / dropped | 10000 / 0 on every rep | |
| latency p50 / p95 / p99 | 140.305 / 168.518 / 221.218 ms (medians; worst rep's p99 327.4 ms) | `sp-10k-summary.csv` |
| submit_window_ms | 10260 median | `sp-10k-summary.csv` |
| peak CPU, peer / orderer | 384.68 / 91.94 % of one core (max over measured reps) | `perf.csv` |
| **stalls (p99 > 5 s)** | **0** of 10 measured | `perf.csv` |
| slow reps (1 s < p99 ≤ 5 s) | **0** | `perf.csv` |
| lifecycle tail (`CloseElection` → `PublishTally`) | 6 s median (range 6–7) | `receipts.csv` via `stages.json` |
| verify stage | 8.2 s median (range 8.0–8.4) | `journal.ndjson` via `stages.json` |
| **verify_threads** | **16** — on all 12 reps | `perf.csv`, `timings.json` |
| `verify_ballots` (`proof_verify_inproc_ms`) | 1540 ms median (range 1521–1661) | `timings.json` via `perf.csv` |
| run wall time | 36 s median | `run.start` → `run.end` |
| ballots per block | 50.0 in every rep | `receipts.csv` via `stages.json` |
| `ledger.dump` read path | `batched` in every rep | `journal.ndjson` |
| block gaps ≥ 3 s / `slow fdatasync` | 1 / 0 over all measured reps | `stall.csv` |
| peer commit p50 / max, org1 · org2 | 32 / 112 ms · 24 / 99 ms (median of per-rep p50; max of per-rep max) | `stall.csv` |

Per-rep `committed_tps`, measured reps 1–10: 991.732, 980.426, 968.985, 974.575, 769.167, 637.430, 954.824, 626.577, 981.855, 980.326.

**No stall, no slow rep, and the 2026-09-11 downward drift did not reproduce.** The worst
p99 of the tier is 327 ms (it was 1,132 ms on 2026-09-11) and the last two measured reps,
on the largest ledger of the tier, are back at 980 TPS. The three reps below 800 TPS
(5, 6, 8) all have normal p99 — the loss is submission time with nothing in flight, not
latency; §10 decomposes them.

### MP-10K — 10,000 voters × 3 positions

| Field | Value | Source |
|---|---|---|
| **committed_tps** | **954.686** median (mean 905.163, min 571.647, p95 964.432, stddev 116.917, n = 10) | `mp-10k-summary.csv` |
| **sustained** | `true` — on all 12 reps | `perf.csv`, `run.end` |
| **scaling_limit** | `false`, `inconclusive` — mixed across the 12 reps | `perf.csv`, `run.end` |
| **fail_reason** | *(empty)* — on all 12 reps | `perf.csv`, `run.end` |
| **ledger_matches_local** | **true** — on all 144 `source=ledger` rows of all 12 reps; E / pass pairs seen: E = 0 / pass = true | `correctness.csv` |
| driver_ceiling_tps | 892.762 median (mean 893.145, min 881.111, stddev 6.282) | `mp-10k-summary.csv` |
| warm-ups discarded | 2 (`mp-10k-par-20260911-234203-1`, `mp-10k-par-20260911-234330-2`) | |
| runs_measured | 10 | |
| runs_failed | **0** | |
| committed / dropped | 30000 / 0 on every rep | |
| latency p50 / p95 / p99 | 142.818 / 175.107 / 226.372 ms (medians; worst rep's p99 289.3 ms) | `mp-10k-summary.csv` |
| submit_window_ms | 31400 median | `mp-10k-summary.csv` |
| peak CPU, peer / orderer | 387.12 / 96.80 % of one core (max over measured reps) | `perf.csv` |
| **stalls (p99 > 5 s)** | **0** of 10 measured | `perf.csv` |
| slow reps (1 s < p99 ≤ 5 s) | **0** | `perf.csv` |
| lifecycle tail (`CloseElection` → `PublishTally`) | 10 s median (range 10–11) | `receipts.csv` via `stages.json` |
| verify stage | 24.5 s median (range 24.4–24.9) | `journal.ndjson` via `stages.json` |
| **verify_threads** | **16** — on all 12 reps | `perf.csv`, `timings.json` |
| `verify_ballots` (`proof_verify_inproc_ms`) | 4702 ms median (range 4574–4851) | `timings.json` via `perf.csv` |
| run wall time | 88 s median | `run.start` → `run.end` |
| ballots per block | 50.0 in every rep | `receipts.csv` via `stages.json` |
| `ledger.dump` read path | `batched` in every rep | `journal.ndjson` |
| block gaps ≥ 3 s / `slow fdatasync` | 2 / 0 over all measured reps | `stall.csv` |
| peer commit p50 / max, org1 · org2 | 33 / 101 ms · 25 / 101 ms (median of per-rep p50; max of per-rep max) | `stall.csv` |

Per-rep `committed_tps`, measured reps 1–10: 961.610, 959.713, 963.931, 954.686, 964.432, 945.049, 955.391, 938.326, 571.647, 836.842.

**No stall, no slow rep.** Eight of the ten measured reps sit in a 26 TPS band
(938–964). Reps 9 and 10 are the tier's two block gaps ≥ 3 s: each lost a single long
submission pause (14.6 s and 16.2 s) with **no ballot in flight** — the slowest of rep 9's
30,000 ballots took 309 ms — so neither is a chain stall. §10 establishes what they are.

## 6. Row 4 — SP-50K and MP-50K (2 warm-ups + 5 measured each)

### SP-50K — 50,000 voters × 1 position

| Field | Value | Source |
|---|---|---|
| **committed_tps** | **933.315** median (mean 914.352, min 833.96, p95 936.514, stddev 40.214, n = 5) | `sp-50k-summary.csv` |
| **sustained** | `true` — on all 7 reps | `perf.csv`, `run.end` |
| **scaling_limit** | `inconclusive` — on all 7 reps | `perf.csv`, `run.end` |
| **fail_reason** | *(empty)* — on all 7 reps | `perf.csv`, `run.end` |
| **ledger_matches_local** | **true** — on all 28 `source=ledger` rows of all 7 reps; E / pass pairs seen: E = 0 / pass = true | `correctness.csv` |
| driver_ceiling_tps | 884.554 median (mean 884.702, min 880.446, stddev 3.107) | `sp-50k-summary.csv` |
| warm-ups discarded | 2 (`sp-50k-par-20260912-000309-1`, `sp-50k-par-20260912-000519-2`) | |
| runs_measured | 5 | |
| runs_failed | **0** | |
| committed / dropped | 50000 / 0 on every rep | |
| latency p50 / p95 / p99 | 144.705 / 180.279 / 230.078 ms (medians; worst rep's p99 253.0 ms) | `sp-50k-summary.csv` |
| submit_window_ms | 53572 median | `sp-50k-summary.csv` |
| peak CPU, peer / orderer | 415.69 / 115.51 % of one core (max over measured reps) | `perf.csv` |
| **stalls (p99 > 5 s)** | **0** of 5 measured | `perf.csv` |
| slow reps (1 s < p99 ≤ 5 s) | 0 | `perf.csv` |
| lifecycle tail (`CloseElection` → `PublishTally`) | 6 s median (range 6–7) | `receipts.csv` via `stages.json` |
| verify stage | 40.8 s median (range 40.6–42.6) | `journal.ndjson` via `stages.json` |
| **verify_threads** | **16** — on all 7 reps | `perf.csv`, `timings.json` |
| `verify_ballots` (`proof_verify_inproc_ms`) | 7846 ms median (range 7824–7864) | `timings.json` via `perf.csv` |
| run wall time | 133 s median | `run.start` → `run.end` |
| ballots per block | 50.0 in every rep | `receipts.csv` via `stages.json` |
| `ledger.dump` read path | `batched` in every rep | `journal.ndjson` |
| block gaps ≥ 3 s / `slow fdatasync` | 1 / 0 over all measured reps | `stall.csv` |
| peer commit p50 / max, org1 · org2 | 34 / 97 ms · 25 / 94 ms (median of per-rep p50; max of per-rep max) | `stall.csv` |

Per-rep `committed_tps`, measured reps 1–5: 936.514, 933.139, 934.830, 933.315, 833.960.

Four of the five measured reps are inside 3.4 TPS of each other (933.1–936.5) on a
channel that holds 350,000 ballots by the last rep; the fifth lost 6.4 s to one
submission pause (§10). `committed_tps` is 106 % of the driver ceiling, hence
`inconclusive`: at c = 128 the harness, not the network, set the rate.

### MP-50K — 50,000 voters × 3 positions

| Field | Value | Source |
|---|---|---|
| **committed_tps** | **793.015** median (mean 788.753, min 753.335, p95 828.886, stddev 25.106, n = 5) | `mp-50k-summary.csv` |
| **sustained** | `true` — on all 7 reps | `perf.csv`, `run.end` |
| **scaling_limit** | `inconclusive` — on all 7 reps | `perf.csv`, `run.end` |
| **fail_reason** | *(empty)* — on all 7 reps | `perf.csv`, `run.end` |
| **ledger_matches_local** | **true** — on all 84 `source=ledger` rows of all 7 reps; E / pass pairs seen: E = 0 / pass = true | `correctness.csv` |
| driver_ceiling_tps | 830.397 median (mean 838.811, min 825.129, stddev 13.71) | `mp-50k-summary.csv` |
| warm-ups discarded | 2 (`mp-50k-par-20260912-002127-1`, `mp-50k-par-20260912-002742-2`) | |
| runs_measured | 5 | |
| runs_failed | **0** | |
| committed / dropped | 150000 / 0 on every rep | |
| latency p50 / p95 / p99 | 154.143 / 260.894 / 337.146 ms (medians; worst rep's p99 362.4 ms) | `mp-50k-summary.csv` |
| submit_window_ms | 189151 median | `mp-50k-summary.csv` |
| peak CPU, peer / orderer | 418.17 / 98.68 % of one core (max over measured reps) | `perf.csv` |
| **stalls (p99 > 5 s)** | **0** of 5 measured | `perf.csv` |
| slow reps (1 s < p99 ≤ 5 s) | 0 | `perf.csv` |
| lifecycle tail (`CloseElection` → `PublishTally`) | 11 s median (range 10–11) | `receipts.csv` via `stages.json` |
| verify stage | 123.0 s median (range 122.2–128.5) | `journal.ndjson` via `stages.json` |
| **verify_threads** | **16** — on all 7 reps | `perf.csv`, `timings.json` |
| `verify_ballots` (`proof_verify_inproc_ms`) | 23635 ms median (range 23456–23982) | `timings.json` via `perf.csv` |
| run wall time | 407 s median | `run.start` → `run.end` |
| ballots per block | 50.0 in every rep | `receipts.csv` via `stages.json` |
| `ledger.dump` read path | `batched` in every rep | `journal.ndjson` |
| block gaps ≥ 3 s / `slow fdatasync` | 2 / 0 over all measured reps | `stall.csv` |
| peer commit p50 / max, org1 · org2 | 37 / 249 ms · 28 / 210 ms (median of per-rep p50; max of per-rep max) | `stall.csv` |

Per-rep `committed_tps`, measured reps 1–5: 753.335, 773.587, 793.015, 794.944, 828.886.

150,000 ballot records per rep, 189 s submission windows, every measured rep between 753
and 829 TPS (stddev 25 against 62 on 2026-09-11), no stall and no slow rep. Every measured
rep of this tier carries at least one checkpoint pause (§10); the tier's spread is
essentially how many seconds each rep lost to them (2–15 s).

## 7. The six tiers in one table

Medians over the measured reps, `summary.csv` convention; p99 as median / worst rep;
stalls are measured reps with p99 > 5 s; peak CPU is the maximum over measured reps, in
% of one core (of 1,600 % available).

| Tier | records/rep | reps measured / failed | committed_tps | p99 ms | stalls | verify s | lifecycle tail s | wall s/rep | peak CPU peer / orderer |
|---|---|---|---|---|---|---|---|---|---|
| SP-1K | 1,000 | 10 / **0** | **1004.09** | 206.5 / 236.3 | **0** | 0.9 | 6 | 15 | *(empty)* / *(empty)* |
| MP-1K | 3,000 | 10 / **0** | **1011.79** | 164.7 / 244.8 | **0** | 2.6 | 10 | 24 | *(empty)* / *(empty)* |
| SP-10K | 10,000 | 10 / **0** | **968.99** | 221.2 / 327.4 | **0** | 8.2 | 6 | 36 | 384.68 / 91.94 |
| MP-10K | 30,000 | 10 / **0** | **954.69** | 226.4 / 289.3 | **0** | 24.5 | 10 | 88 | 387.12 / 96.80 |
| SP-50K | 50,000 | 5 / **0** | **933.32** | 230.1 / 253.0 | **0** | 40.8 | 6 | 133 | 415.69 / 115.51 |
| MP-50K | 150,000 | 5 / **0** | **793.02** | 337.1 / 362.4 | **0** | 123.0 | 11 | 407 | 418.17 / 98.68 |

`ledger_matches_local` is **true** on every `source=ledger` row of all 62 reps, E = 0 and
`pass` = true everywhere, 0 ballots dropped anywhere, 0 `slow fdatasync` warnings on the
orderer in any submission window, and `runs_failed` = 0 in every tier. The peer never
exceeds 4.2 of 16 cores and the orderer never exceeds 1.2: the CPU is not what limits this
network.

## 8. Verification scaling — the same rows on 1 thread and on 16

This is the controlled comparison the rerun exists for. **Before** is
`2026-09-11-rows2-4-b50.md`: the same six tiers, the same 2 + 10 / 2 + 5 rep counts, the
same `b50-t2s` orderer parameters, the same driver concurrency 128, the same machine and
the same NVMe-backed Docker storage, on saksi `cf9fd2a` — a **serial** auditor
(`verify_threads` absent = 1). **After** is this note, on saksi `ef663d1` — the same
everything, with PR #40's **parallel** auditor reporting `verify_threads` = **16** (the
box has 8 physical cores / 16 threads; the auditor takes rayon's default pool, which is
16 here).

`verify_ballots` is `timings.json`'s ballot-verification figure, which the campaign copies
into `perf.csv` as `proof_verify_inproc_ms`. It changes meaning between the two builds —
summed per-ballot CPU time on one thread before, wall time on 16 threads after — which is
exactly why `verify_threads` was added and why the two builds' runs may not be pooled.
The per-record audit cost below is that figure divided by the rep's ballot records.

| Tier | records | wall s/rep before → after | verify stage s before → after | committed_tps before → after | `verify_ballots` ms before → after | **audit ms/record, 1 thread → 16** |
|---|---|---|---|---|---|---|
| SP-1K | 1,000 | 18 → **15** (1.20×) | 3.5 → **0.9** (3.86×) | 948.5 → 1004.1 | 1,416 → **154** | 1.417 → **0.154** (9.20×) |
| MP-1K | 3,000 | 32 → **24** (1.33×) | 10.3 → **2.6** (3.97×) | 933.8 → 1011.8 | 4,288 → **458** | 1.429 → **0.153** (9.36×) |
| SP-10K | 10,000 | 68 → **36** (1.89×) | 35.5 → **8.2** (4.31×) | 758.8 → 969.0 | 14,786 → **1,540** | 1.479 → **0.154** (9.60×) |
| MP-10K | 30,000 | 172 → **88** (1.95×) | 103.9 → **24.5** (4.23×) | 859.8 → 954.7 | 43,230 → **4,702** | 1.441 → **0.157** (9.19×) |
| SP-50K | 50,000 | 263 → **133** (1.98×) | 171.3 → **40.8** (4.20×) | 951.8 → 933.3 | 75,286 → **7,846** | 1.506 → **0.157** (9.60×) |
| MP-50K | 150,000 | 764 → **407** (1.88×) | 494.3 → **123.0** (4.02×) | 803.8 → 793.0 | 208,475 → **23,635** | 1.390 → **0.158** (8.82×) |

**The per-record audit cost is the citable number: 1.39–1.51 ms/record on one thread
against 0.153–0.158 ms/record on sixteen, a 8.8–9.6× speedup across a 150-fold range of
tier sizes.** It is flat in the tier size at both thread counts, which is what a
per-record cost should be, and the speedup exceeds the 8 physical cores because the two
SMT threads per core do useful work on this workload. It matches PR #40's own off-chain
benchmark (8.4× on `verify_ballots` at 30,000 ballots) on a different host.

What does **not** scale with threads, and why the whole-run numbers are smaller:

- **The verify *stage* gains 3.9–4.3×, not 9×**, because the stage is the ledger dump plus
  the in-process audit plus a second pass. At MP-50K the stage is 123 s of which
  `verify_ballots` is 23.6 s; the rest is the batched `GetBallots` dump — whose
  `ledger.dump` record in that rep is stamped 70.7 s into the verify stage — and the
  second pass. The dump is I/O against the peer and is untouched by PR #40: it is now the
  verification bottleneck, where before the change the audit was.
- **A whole run gains 1.2–2.0×**, because submission, the lifecycle tail and the ceremony
  are unchanged. Verify was 65–70 % of a 50K run before and is 31 % (SP-50K) / 30 %
  (MP-50K) now.
- **Throughput is not part of the comparison.** `committed_tps` moved by −2 % to +28 %
  between the two rounds, in both directions, with no thread-count mechanism behind it:
  the auditor runs after the submission window closes. The SP-10K rise (758.8 → 969.0) is
  the 2026-09-11 run's downward drift not reproducing, and the SP-50K and MP-50K falls
  (−2 % and −1 %) are inside the run-to-run spread. §10 shows where those seconds go.

## 9. Cost model, refitted on the parallel-auditor runs

`docs/desktop-runs/cost-model.md` is regenerated by `cost_model.py` from **the rows 2–4
runs of this note only** (62 folders: 50 measured reps, and 12 warm-ups the script
excludes), plus the one true-offline run for row 8:

```
python3 docs/desktop-runs/cost_model.py \
    --runs /home/user/.saksi/campaign/runs --runs /home/user/.saksi/campaign/runs-offline \
    --match 'sp-*-par-*' --match 'mp-*-par-*' --match 'offline-*' \
    --fit-concurrency 128 --out docs/desktop-runs/cost-model.md
```

No change to the script was needed. Its regime guard — a regime being (auditor
`verify_threads`, `orderer_batch` from journal line 1, saksi commit) — does the work it
was added for: these runs are `verify_threads` = 16, `orderer_batch` as quoted in the
Environment section, commit `ef663d1`, and it would refuse to fit them together with the
serial runs. **The serial fit is kept, not overwritten**, as
`docs/desktop-runs/cost-model-serial.md` (same script, `--match '*-b50-*'`); the two
files are the two regimes.

**Refitted coefficients** — on-chain, fitted at c = 128 over the 50 measured reps of rows
2–4, against the serial refit of 2026-09-11 (same tiers, same parameters, same
concurrency, serial auditor):

| Symbol | Serial refit (`cf9fd2a`) | **Parallel refit (`ef663d1`)** | 95 % CI | What moved it |
|---|---|---|---|---|
| `g` generate | 0.1723 ms/record | **0.1801** | ± 0.0023 | nothing by design — a different Rust binary, same generator; +4.5 % is run-to-run |
| `s` submit | 1.248 ms/record | **1.243** | ± 0.0265 | nothing — the auditor is not on the submission path (−0.4 %) |
| `v_audit` in-process audit | 1.435 ms/record | **0.1592** | ± 0.00041 | **PR #40: 9.0× — the whole point** |
| `v_dump` ledger dump + 2nd pass | 1.907 ms/record | **0.6687** | ± 0.0043 | 2.85×: the second pass is parallel too; the dump itself is not |
| per-record total | 4.762 ms/record | **2.251 ms/record** | | 2.12× cheaper per ballot record |
| `tau` → `L(1)`, `L(3)` | 0 → 0 | **0 → 0** | | unchanged: partials still share blocks (PR #38) |
| `c0` fixed per run | 26.3 s | **24.5 s** | ± 5.5 s | unchanged within its interval |

**Fit quality.** In-sample error of the median rep: SP-1K −43.9 %, MP-1K −23.2 %,
SP-10K −23.4 %, MP-10K −4.4 %, SP-50K −3.0 %, MP-50K +12.4 %. As in the serial fit the
small tiers are over-predicted by seconds, because `c0` is one mean over per-run
residuals that grow with the tier; with the audit term now nine times smaller, `c0`
dominates everything below 10K, so the relative error there is larger even though the
absolute error is a few seconds. MP-50K is now under-predicted by 12 % (it was +3.2 %):
that tier lost 2–15 s per rep to the submission pauses of §10, which the model does not
carry.

**Rows 5–9, predicted** (`cost-model.md` §3; reps = warm-ups + measured, as scheduled):

| Row | Tier | Reps | Predicted h/run | ± MoE | Predicted h, all reps | Serial-fit h/run |
|---|---|---|---|---|---|---|
| 5 | SP-483K | 1 + 3 | 0.309 | 0.004 | 1.24 | 0.646 |
| 6 | SP-1M | 1 + 3 | 0.632 | 0.008 | 2.53 | 1.330 |
| 7 | SP-1.92M | 1 + 1 | 1.207 | 0.014 | 2.42 | 2.547 |
| 7 | SP-3.5M | 1 + 1 | 2.195 | 0.026 | 4.39 | 4.637 |
| 8 | MP-483K / 1M / 1.92M / 3.5M offline | 1 each | 0.628 / 1.300 / 2.495 / 4.547 | n/a | 8.97 | same |
| 9 | MP-3.5M on-chain | 1 | 6.572 | 0.079 | 6.57 | 13.895 |
| | **rows 5–9 total** | | | | **26.1 h** | *45.1 h* |

Rows 4–9 together: **27.1 h** (against 47.1 h on the serial fit and 64.8 h in v1). The big
mover is row 9: MP-3.5M on-chain falls from 13.9 h to 6.6 h per run, because 10.5 million
ballot records at 1.28 ms/record less verification is 3.7 h saved on that one run.

**Row 8 is unchanged and is still a serial-auditor number.** Its coefficients come from
the single true-offline run (`offline-mp-10k-20260910-211140-1`, saksi `302d569`,
`verify_threads` = 1), which is a different cost class, so the guard permits it alongside
the parallel on-chain class without pooling. Its `v_audit` of 1.369 ms/record is the
serial cost. Substituting the measured parallel `v_audit` into the offline class
(0.1631 + 0.152 + 0.0262 = 0.341 ms/record over row 8's 20.7 M records) puts row 8 at
roughly **2 h instead of 8.97 h**: about 7 h, the largest remaining saving in the table,
and it is one true-offline run on `ef663d1` away.

The MoE is the coefficients' uncertainty only. It does not cover the pauses of §10, a
regime change at larger tiers, or the ~0.2 ms/record of work no stage timer captures
(the console's ceremony and receipt fetch are not stamped as stages), which sits in `c0`
and makes predictions above 1M records a few per cent low.

## 10. What the submission pauses are

The 2026-09-11 note reported two unexplained pauses — 15 s in an MP-10K rep and 26 s in an
MP-50K rep — in which no ballot was in flight, so nothing was being submitted and the
chain was idle rather than stalled. They recur here, and the journal identifies them.

**Mechanism.** The bench driver calls `OnProgress` **from its dispatcher goroutine**
(`client-sdk/bench/driver.go`: "called from the dispatcher goroutine … every 1,000
dispatched indices"), and the console's callback stamps a `ballots.progress` journal
record. `ballots.progress` is a **journal checkpoint** (`journal.go`, `isCheckpoint`), and
`Journal.writeLine` calls `f.Sync()` on the checkpoint path while holding the journal
mutex. While that fsync is outstanding the dispatcher submits nothing: the in-flight
ballots drain and commit normally, and then the chain sits idle until the fsync returns.
That is exactly the observed signature — a multi-second block gap with a normal p99 and a
small maximum ballot latency.

**Evidence, from `journal.ndjson`'s own millisecond `mono_ms` inside the ballot phase.**
Every pause sits between two consecutive `ballots.progress` records, always at a multiple
of 1,000 dispatched ballots:

| Round | Rep | tps | p99 ms | pauses ≥ 3 s between checkpoints | slowest single ballot |
|---|---|---|---|---|---|
| 2026-09-11 | `mp-10k-b50-…-8` | 558.9 | 230.8 | 16 s at done = 28,000; 5 s at 29,000 | 348 ms |
| 2026-09-11 | `mp-50k-b50-…-5` | 681.5 | 315.3 | 13 s at 15,000; **27 s at 16,000**; 3 s at 148,000 | 625 ms |
| 2026-09-12 | `mp-10k-par-…-11` | 571.6 | 226.4 | **15 s at 1,000**; 3 s at 2,000; 4 s at 16,000 | 309 ms |
| 2026-09-12 | `mp-50k-par-…-3` | 753.3 | 305.6 | 7 s at 27,000; 8 s at 28,000; 3 s at 124,000 | — |
| 2026-09-12 | `sp-50k-par-…-7` | 834.0 | 253.0 | 7 s at 38,000 | — |

Across this session's 62 reps, 12 reps carry at least one pause ≥ 3 s and **69 s in total**
is lost to them (against 115 s over the 2026-09-11 session's 62 reps). They are the whole
explanation of this session's low reps: SP-10K rep 8 (627 TPS) lost 6 s at done = 9,000,
MP-10K rep 9 (572 TPS) lost 19 s, MP-50K rep 1 (753 TPS) lost 15 s.

**Which layer stalls.** The docker-stats sampler is a second goroutine on the same journal,
ticking every 5 s with a 10 s per-probe timeout. In the 2026-09-11 MP-50K pause it went
quiet for the same 15 s and 23 s — `docker stats` itself was not returning. In this
session's MP-10K pause it kept stamping, but late: its ticks landed at `mono_ms` 9,378 and
14,801 instead of 5,000/10,000/15,000, and one tick returned only one of the three
containers. So the fsync and the Docker daemon slow down together, which points at the
host's I/O rather than at either process — the journal file is on the WSL root ext4
volume, `docker stats` goes to the Docker Desktop daemon. What is certain is the
**mechanism by which a host I/O hiccup becomes lost throughput**: the checkpoint fsync
sits on the dispatch path.

Two things are ruled out. `docker logs` is not involved: `stats.sh` runs it only after a
tier's whole campaign has finished, never during a rep. And the orderer is not involved:
`slow fdatasync` count is 0 in every submission window of both sessions — with no ballots
arriving there is nothing for the orderer's WAL to sync.

**The fix is saksi-side and small**: stamp `ballots.progress` off the dispatcher goroutine
(or drop it from `isCheckpoint`, keeping the fsync for the stage and segment boundaries
that resume actually needs). Worth about 1 % of wall time at these tiers, and more at
row 7–9 sizes, where a rep carries thousands of checkpoints.

**The SP-10K throughput drift of 2026-09-11 did not reproduce, and it is not the ledger.**
Per-rep `committed_tps` for SP-10K this session, measured reps 1–10: 991.7, 980.4, 969.0,
974.6, 769.2, 637.4, 954.8, 626.6, 981.9, 980.3 — the last two reps, on the largest ledger
of the tier, are back at the tier's best. `ledger_bytes` is absent from these journals (no
peer volume path is configured), so ledger growth is measured by block height instead: the
starting block number of each rep, from its `receipts.csv`, rises by exactly 206–207 per
rep (420 at measured rep 1, 2,274 at rep 10). Against that, `committed_tps` correlates at
**r = −0.245** this session and **r = −0.420** on 2026-09-11 — neither significant at
n = 10 — and the two dips here (reps 6 and 8) carry normal p99 values, i.e. they are
pause seconds, not slower commits. The SP-50K tier is the control in both sessions: it
puts 350,000 ballots on one channel and holds a 3.4 TPS spread over four of its five
measured reps.

## 11. Caveats and what the instrument refused

- **`scaling_limit` is never `true`.** It is `inconclusive` on every rep of five tiers and
  mixed on SP-10K and MP-10K, where the reps that lost seconds to a pause fell below
  0.8 × the driver ceiling. 790–1,010 TPS is what this network sustained under a
  closed-loop driver at c = 128, not a proven system ceiling.
- **No concurrency probe was run.** c = 128 is taken from the 2026-09-11 probe. It was
  chosen on a serial-auditor build, but the auditor runs after the submission window, so
  the choice does not depend on it.
- **`peak_cpu_pct_*` are empty for SP-1K and MP-1K** — windows of 1–3 s against a 5 s
  sampler. From 10K up they are populated.
- **`ledger_bytes_delta` is empty in every run** (as in every session so far): no producer
  for the column on this path. Ledger size is inferred from block height where it matters
  (§10).
- **`negative-tests.csv` is absent in every run**: the `--repeat` driver does not run the
  Scenarios stage that writes it.
- **One `go test` failure at the gate**, `TestSingleRunLockReturns409` — a `t.TempDir`
  cleanup race, pre-existing at `cf9fd2a` and `3cb07fc`, reproduced 1 of 3 times here
  (§1). Not a measurement-path defect.
- **A mislabelled configtx backup was repaired on the host, not in the repo.** PR #39's
  `install_configtx` backs the pristine test-network file up as
  `configtx.yaml.test-network-default` "only on the install path, and never over a copy of
  our own", which it detects by a marker comment. The file it found installed here was the
  2026-09-11 hand-installed `b50-t2s` copy, which carries no marker, so the backup it took
  was a *tuned* file labelled pristine. It was replaced with the genuine pristine file that
  the 2026-09-11 session had kept beside it (`configtx.default.yaml`, `MaxMessageCount: 10`).
  Nothing in this session used the backup — every tier ran from the repo's own file — but
  a later `SAKSI_CONFIGTX=default` control run would have silently measured the tuned
  parameters. Worth a saksi follow-up: the marker test only protects against saksi's own
  file, not against another tuned one.
- **`docs/manuscript-amendments.md` and `CLAIMS.md` were not edited.** What of this enters
  Table 3.12 and Chapter 4 is the user's decision.

## 12. What is running

- **Fabric network up** on the repo's declared orderer parameters, installed by
  `network.sh`'s `install_configtx` at every tier reset: `MaxMessageCount` 50,
  `BatchTimeout` 2 s, `PreferredMaxBytes` 2 MB, `SnapshotIntervalSize` 268,435,456.
  Channel `saksi` holds the MP-50K tier's ledger (7 reps × 150,000 ballot records); the
  next `tools/tier.sh <voters> <positions>` gives an empty one.
- **Console** in WSL tmux session `console`, `http://127.0.0.1:8090`, saksi `ef663d1`;
  `GET /api/capabilities` → `{"fabric":true,"peer":"localhost:7051","channel":"saksi"}`.
- Docker: only the containers `network.sh` created (orderer, two peers, two chaincode
  containers); nothing else was started, stopped or pruned.
- WSL: `~/saksi-runs-2026-09-12-rows2-4-parallel.tgz` (the 62 run folders and
  `ladder.json`); the 2026-09-11 runs and their tarball are untouched. Harness in
  `~/rows24/`; logs in `~/saksi-logs/` (`build-par`, `ladder-par`, `rows-par`,
  `collect-par`, `up-rows24`).

