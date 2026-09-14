# Validation run — SP-1K and MP-1K on saksi `076b730`

A **correctness/validation run, not a campaign**. It rebuilds saksi at main `076b730` on the
Ryzen desktop under WSL2 and reruns the two smallest tiers of the run table — SP-1K and
MP-1K, nothing larger — to check two optimizations live against the parallel-auditor
baseline of 2026-09-12 (`2026-09-12-rows2-4-parallel.md`, saksi `ef663d1`):

- **saksi PR #40** — the parallel auditor, `verify_threads` = 16. Already in the baseline;
  this run checks it is still live and still costs the same.
- **saksi PR #41** — NEW in `076b730`: the `ballots.progress` checkpoint no longer fsyncs on
  the ballot dispatcher goroutine. In the baseline the checkpoint fsync sat on the dispatch
  path and cost 69 s across 62 reps (12 reps affected), showing up as multi-second gaps with
  no ballot in flight.

Everything else is held fixed against the baseline: the same two tiers, the same 2 warm-ups
+ 10 measured reps, the same `b50-t2s` orderer parameters installed by `network.sh`, the
same driver concurrency 128, the same machine and the same NVMe-backed Docker storage.

**The headline is that PR #41 cannot be validated at these tier sizes.** §4 shows why: in
the baseline, all 12 affected reps and all 69 s of loss are at the 10K and 50K tiers. SP-1K
and MP-1K carry **zero** pauses in the baseline, so there is nothing at 1K for PR #41 to fix
and nothing to measure. What this run does establish is that PR #41 causes **no regression**
and that PR #40 is unchanged.

Artifacts are in `docs/desktop-runs/2026-09-12-validation-1k/`: one folder per run
(`perf.csv`, `correctness.csv`, `run.json`, `stages.json`, `journal-line1.json`) and the two
`<tier>-val-summary.csv` files. The full run folders (ballots, latencies, receipts,
journals, ledger dumps) stay in WSL under `~/.saksi/campaign/runs/{sp,mp}-1k-val-*`.

## 1. Environment

| | |
|---|---|
| Machine | AMD Ryzen 7 5700G (8C/16T), 31.9 GB RAM — the paper's Table 3.12 desktop |
| OS | Windows 11 Pro 10.0.26200, Fabric inside WSL2 Ubuntu 26.04, kernel 6.18.33.2-microsoft-standard-WSL2 |
| Docker data disk | `docker_data.vhdx` on the Kingston NVMe (junctioned from the default C: path) |
| RAM available to the run | 23 GB (`docker_info.MemTotal` 25,199,009,792), **swap 0** |
| CPU available to the run | 16 vCPU (`docker_info.NCPU` = 16) |
| Docker | Docker Desktop 4.90.0 (238679), server 29.7.2 |
| Fabric | 2.5.15 (`fabric-samples` test-network, channel `saksi`, chaincode `saksi-bulletin` 1.0), a fresh channel + empty ledger per tier |
| **saksi commit** | **`076b7303af73a8d164d4c6dc38b9fd84de77699c`** (main, PR #41) |
| **Auditor threads** | **`verify_threads` = 16** on all 24 reps of both tiers |
| **Orderer parameters** | `b50-t2s`, installed from the repo by `network.sh`'s `install_configtx` |
| Driver concurrency | **128** (unchanged from the baseline; not re-probed) |
| Container limits | none: `HostConfig.Memory` = 0 and `HostConfig.NanoCpus` = 0 on all three Fabric containers |
| Toolchains | cargo 1.98.1, go 1.25.1 |

**Build identity.** `git_head_console` = `git_head_saksi` = `076b7303…` in every
`journal-line1.json`. `saksi-demo` SHA-256
`836109988d9a98bcad0c91e289dc3fadc850ed036957fb667abd962619598ce9` — **byte-identical to the
baseline's**, as it must be: PR #41 touches only Go (`packages/saksi-campaign`), so the
Rust measurement path is literally the same binary and the whole delta is the campaign's.
`saksi-campaign` is `59cdc4525ebd4dddc54a279272b14e444cf4d6f677b4931ff1f7165d60a40599`.

**Gate.** `cargo build -p saksi-demo --release` ok; `go build` of `saksi-campaign` ok;
`go test ./...` in `packages/saksi-campaign` **passed clean** (`ok … 9.196s`), including PR
#41's new `journal_progress_test.go` (578 lines). Rerunning `TestSingleRunLockReturns409`
alone three times gave FAIL, ok, ok — the same pre-existing `t.TempDir` cleanup race seen at
`cf9fd2a`, `3cb07fc` and `ef663d1`, and it did not fire in the full-suite run at all.

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

## 2. How the two tiers were run

Per tier: `tools/tier.sh <voters> <positions>` (network down, fresh channel generated from
the repo's `configtx.yaml`, chaincode redeployed — an empty ledger), the console restarted in
tmux `console` via `tools/up.sh` and waited on until `GET /api/capabilities` returned
`{"fabric":true,"peer":"localhost:7051","channel":"saksi"}`, then

```
saksi-campaign --repeat --config ~/<tier>.json \
    --warmups 2 --reps 10 --base-url http://127.0.0.1:8090 \
    --out ~/<tier>-val-summary.csv
```

Configs are 5 trustees, threshold 3, 4 candidates, `realistic`, `onchain`,
`concurrency: 128`, `name` `sp-1k-val` / `mp-1k-val` so the run ids stay separable from the
baseline's `*-par-*`. Medians below are `summary.csv`'s own (lower of the two middle values
for even n) — the baseline note's convention, so the before/after compares like with like.

## 3. Before/after, the two tiers

**Before** = the parallel-auditor baseline (`2026-09-12-rows2-4-parallel.md`, saksi
`ef663d1`). **After** = this note (saksi `076b730`). Same tiers, rep counts, orderer
parameters, concurrency, machine and storage; the only difference is PR #41.

| | SP-1K before | **SP-1K after** | MP-1K before | **MP-1K after** |
|---|---|---|---|---|
| committed_tps (median) | 1004.09 | **960.04** | 1011.79 | **993.24** |
| committed_tps (mean ± sd) | 994.33 ± 53.14 | **914.41 ± 120.95** | 1005.60 ± 30.19 | **984.38 ± 36.59** |
| committed_tps (min) | 849.03 | **633.86** | 946.19 | **925.53** |
| latency p50 / p95 / p99 ms (medians) | 133.01 / 157.51 / **206.52** | 139.50 / 166.96 / **212.07** | 136.83 / 156.59 / **164.67** | 139.09 / 158.59 / **167.29** |
| worst rep's p99 ms | 236.3 | **323.6** | 244.8 | **310.8** |
| verify stage s (median, range) | 0.9 (0.9–1.0) | **0.9 (0.9–1.0)** | 2.6 (2.6–2.8) | **2.6 (2.6–2.7)** |
| `verify_ballots` = `proof_verify_inproc_ms` ms | 154 (153–188) | **154 (153–165)** | 458 (454–576) | **459 (457–488)** |
| `verify_threads` | 16 on all 12 reps | **16 on all 12 reps** | 16 on all 12 reps | **16 on all 12 reps** |
| **reps with a pause ≥ 1 s** | **0 of 10** | **0 of 10** | **0 of 10** | **0 of 10** |
| **seconds lost to pauses** | **0.0** | **0.0** | **0.0** | **0.0** |
| reps with a pause ≥ 3 s / s lost | 0 of 10 / 0.0 | 0 of 10 / 0.0 | 0 of 10 / 0.0 | 0 of 10 / 0.0 |
| `coalesced_total` | never emitted | **never emitted** | never emitted | **never emitted** |
| runs_measured / runs_failed | 10 / **0** | 10 / **0** | 10 / **0** | 10 / **0** |
| committed / dropped | 1000 / **0** every rep | 1000 / **0** every rep | 3000 / **0** every rep | 3000 / **0** every rep |
| `ledger_matches_local` | true, 48 `source=ledger` rows | **true, 48 rows** | true, 144 rows | **true, 144 rows** |
| E / pass per contest | 0 / true everywhere | **0 / true everywhere** | 0 / true everywhere | **0 / true everywhere** |
| ballots per block | 50.0 every rep | **50.0 every rep** | 50.0 every rep | **50.0 every rep** |
| `ledger.dump` read path | `batched` every rep | **`batched` every rep** | `batched` every rep | **`batched` every rep** |
| `sustained` / `scaling_limit` / `fail_reason` | true / inconclusive / *(empty)* | **same on all 12 reps** | true / inconclusive / *(empty)* | **same on all 12 reps** |
| lifecycle tail s (median) | 6 | **6** | 10 | **10** |
| run wall s (median) | 15 | **15** | 24 | **24** |
| `slow fdatasync` on the orderer | 0 | **0** | 0 | **0** |
| block gaps ≥ 3 s (`stall.csv`) | 0 | **0** | 0 | **0** |

Per-rep `committed_tps`, measured reps 1–10:

- **SP-1K after**: 644.68, 743.72, 1024.59, 852.87, 1015.52, 971.23, 958.47, 968.90, 1004.06, 960.04
  (before: 1012.99, 958.68, 1027.78, 1034.69, 1038.02, 1020.52, 849.03, 1002.27, 1004.09, 995.23)
- **MP-1K after**: 1024.77, 951.78, 1029.76, 925.53, 1022.12, 951.40, 994.98, 941.20, 993.24, 1008.99
  (before: 1029.83, 1044.71, 971.89, 1011.79, 946.19, 1021.72, 974.89, 1022.53, 1033.21, 999.22)

**The SP-1K deficit is a cold-start ramp, not a regression.** Docker Desktop had been
restarted before this session, so the first reps ran against cold peers and freshly built
chaincode containers. `stall.csv`'s `org1_commit_p50_ms` per run index reads 51, 52, **56,
36**, 28, 30, 29, 30, 31, 31, 28, 29: the two warm-ups and the first two measured reps
commit at 36–56 ms, everything after at 28–31 ms, which is the baseline's own 24–32 ms band.
Those same four reps are the ones with elevated p99 (283–324 ms) — **slower commits, not idle
time**: their in-flight coverage has no hole at all (§4). Dropping the two cold measured reps
leaves measured reps 3–10 at a median of **968.9** and a mean of **969.5 ± 53.7** against the
baseline's 994.3 ± 53.1 — the same spread, a −2.5 % mean difference, t ≈ 1.0 at n = 8 vs 10.
MP-1K, which ran second on a fully warm box, is −2.1 % on the mean (984.4 vs 1005.6, t ≈ 1.4).
**Neither tier moved significantly, in either direction.**

## 4. The PR #41 check — why 1K cannot answer it

A **pause** here is an interval in which *no ballot was in flight*. Two independent
derivations were computed for every rep of both rounds:

- **(A) in-flight coverage**, from `latencies.csv` + `receipts.csv`, as the baseline report
  did. Ballot *i* was in flight over `[commit_ts − ms/1000, commit_ts]`, where `commit_ts` is
  the timestamp of the block that carried it and `ms` its end-to-end latency. Merge those
  intervals across the submission window; the holes are the intervals in which nothing was
  in flight. This is independent of the journal.
- **(B) journal checkpoints**, from `journal.ndjson`'s `ballots.progress` `mono_ms` — the
  interval between two consecutive checkpoints, 1,000 dispatched ballots apart. This is the
  cross-check and the derivation that produced the baseline's headline numbers.

**Result at 1K, before and after: zero.** Not one measured rep of SP-1K or MP-1K, in either
round, carries a hole ≥ 1 s — and the same at ≥ 3 s. `coalesced_total` never appears in any
journal of either round, as expected at this rate.

The reason is arithmetic. `ballots.progress` fires every 1,000 dispatched ballots, so an
**SP-1K rep has exactly one checkpoint** — there is no consecutive pair, so derivation (B)
is empty there by construction — and an **MP-1K rep has three**. The MP-1K checkpoint
intervals that do reach 1 s (1.0–1.2 s, in 5 of 12 baseline reps and 6 of 12 after) are
simply the time to dispatch 1,000 ballots at ~1,000 TPS, and derivation (A) confirms the
chain was busy throughout them.

**Where the baseline's 69 s actually lives.** Rerunning the baseline report's own derivation
over all 62 `*-par-*` reps reproduces its figure exactly — 12 reps with a pause ≥ 3 s, **69 s
lost** — and every one of those reps is at 10K or 50K:

| Baseline tier | reps (2 warm-ups + measured) | reps with a pause ≥ 3 s, (B) | s lost, (B) | measured reps with a hole ≥ 3 s, (A) | s lost, (A) |
|---|---|---|---|---|---|
| **SP-1K** | 12 | **0** | **0** | **0 of 10** | **0.0** |
| **MP-1K** | 12 | **0** | **0** | **0 of 10** | **0.0** |
| SP-10K | 12 | 2 | 8 | 1 of 10 | 5.8 |
| MP-10K | 12 | 3 | 24 | 1 of 10 | 13.8 |
| SP-50K | 7 | 1 | 6 | 1 of 5 | 4.6 |
| MP-50K | 7 | 6 | 31 | 1 of 5 | 12.6 |
| **all six** | **62** | **12** | **69** | **4 of 50** | **36.8** |

The (B) column reproduces the baseline report's headline exactly: **12 of 62 reps, 69 s**.
(A) is computed over the measured reps only and is the smaller number, because it counts
only genuinely idle seconds, where (B) counts the whole oversized checkpoint interval less
one second of normal dispatch. The two agree on what matters here: **both are zero at SP-1K
and MP-1K.**

So the defect's incidence at 1K is **zero in the baseline**, and a run that removes zero
seconds cannot be distinguished from one that does not. The ~3 % TPS understatement PR #41
removes is a whole-campaign figure carried by the large tiers; at 1K the expected effect is
nil, and nil is what §3 measures.

## 5. Verdict

**PR #40 is confirmed live and unchanged.** `verify_threads` is **16** on all 24 reps of
both tiers — never 1, never empty — and the audit cost is identical to the baseline's:
`verify_ballots` 154 ms at SP-1K (baseline 154) and 459 ms at MP-1K (baseline 458), i.e.
0.154 and 0.153 ms per ballot record, with the verify *stage* at 0.9 s and 2.6 s exactly as
before. **PR #41 is confirmed not to regress anything, but it is not validated by this run**:
at SP-1K and MP-1K the defect it fixes has zero incidence — the baseline loses 0 s to
dispatcher pauses at both tiers (all 12 affected reps and all 69 s sit at 10K and 50K), so
there is no stall for the fix to remove and no throughput for it to return. The measured
before/after difference is −2.1 % to −2.5 % on the mean, inside one standard deviation and
not significant at n = 10, and SP-1K's larger drop is fully accounted for by a cold-start
ramp on the first four reps after a Docker restart (peer commit p50 of 36–56 ms against the
warm 28–31 ms), not by any idle time. Everything the run *can* assert about the new build it
does assert: the go test suite passes including PR #41's own 578-line journal test,
`coalesced_total` never fires, `runs_failed` = 0, 0 ballots dropped, `ledger_matches_local`
true on all 192 `source=ledger` rows, E = 0 and `pass` true everywhere, 50.0 ballots per
block on every rep, `read_path` `batched` on every rep, and no `slow fdatasync` in any
submission window. **Validating PR #41 requires a tier at which the baseline actually
stalled** — MP-10K (3 of 12 reps, 24 s) or MP-50K (6 of 7 reps, 31 s) is where the
before/after would carry signal.

## 6. Caveats

- **The run cannot validate PR #41** (§4). This is the main caveat and the reason for the
  verdict above.
- **SP-1K's first four reps ran cold** after a Docker Desktop restart. Two warm-ups were not
  enough on a cold daemon; the tier's median and stddev carry that. MP-1K, running second,
  is unaffected.
- **`peak_cpu_pct_*` is empty on both tiers** — submission windows of 1–3 s against a 5 s
  sampler. Unchanged from the baseline.
- **`ledger_bytes_delta` is empty in every run** (as in every session so far): no producer
  for the column on this path.
- **`negative-tests.csv` is absent in every run**: the `--repeat` driver does not run the
  Scenarios stage that writes it.
- **No concurrency probe was run.** c = 128 is settled from 2026-09-11 and reused unchanged.
- **`scaling_limit` is `inconclusive` on all 24 reps**, as in the baseline: `committed_tps`
  sits at or above the driver ceiling, so these are floors set by the harness, not system
  limits.
- **One `go test` flake**, `TestSingleRunLockReturns409`, reproduced 1 of 3 times when run in
  isolation and not at all in the full-suite run. Pre-existing `t.TempDir` cleanup race, not
  a measurement-path defect.
- **`docs/manuscript-amendments.md`, `CLAIMS.md`, `cost-model.md` and `cost_model.py` were
  not edited.** The cost model is not refitted on these runs: two 1K tiers are not a fit, and
  nothing in them moves a coefficient.
