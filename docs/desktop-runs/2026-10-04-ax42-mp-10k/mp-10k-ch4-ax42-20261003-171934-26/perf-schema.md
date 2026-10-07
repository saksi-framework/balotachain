# perf.csv — column reference

One row per run, appended by the Verify phase. **An empty cell means the column
has no producer for this run** (e.g. an offline run never opens a submission
window) — it is never a measured zero.

| Column | Units | Produced by |
| --- | --- | --- |
| `run_id` | — | the run folder's id |
| `mode` | offline\|onchain\|groundtruth | run config |
| `voters`, `positions`, `candidates` | count | run config |
| `profile` | uniform\|skewed\|realistic | run config (`distribution`) |
| `gen_wall_ms` | ms | `gen-timings.json` `wall_ms` — generator wall time |
| `gen_cpu_ms` | ms | `gen-timings.json`: credential + encrypt + CDS-prove CPU, summed across worker threads (may exceed wall) |
| `proof_gen_cpu_ms` | ms | `gen-timings.json` `cds_prove_cpu_ms` — CDS proving plus each record's sum-to-one selection proof (about 79 µs per record) |
| `proof_verify_inproc_ms` | ms | `timings.json` `verify_ballots` — in-auditor-process CDS + selection-proof (about 132 µs per record) + credential verification of every ballot. **Wall-clock** time of the parallel verify phase on `verify_threads` threads, not CPU time summed across them; compare runs only at the same thread count |
| `aggregate_inproc_ms` | ms | `timings.json` `aggregate` |
| `combine_inproc_ms` | ms | `timings.json` `combine` — Lagrange recombination |
| `decrypt_inproc_ms` | ms | `timings.json` `decode` — discrete-log tally recovery |
| `submit_window_ms` | ms | wall clock of the timed ballot window (submit→commit only; no receipt fetch, no file write inside it) |
| `committed`, `dropped` | count | ballot window outcome |
| `committed_tps` | tx/s | committed ÷ window |
| `driver_ceiling_tps` | tx/s | concurrency ÷ median submit latency — the harness's own ceiling. A `committed_tps` near it means the driver, not the network, was the limit |
| `latency_*_ms` | ms | per-ballot submit→commit latency stats (nearest-rank percentiles, population stddev). On an issuer-bound election endorsement verifies each record's selection proof too (about 200 µs per record) |
| `peak_cpu_pct_{peer,orderer,client}` | % | `docker stats` sampler peak (`client` is this console's own process). On a security run the sampler also ran through the attack pause |
| `peak_mem_mb_{peer,orderer,client}` | MB | same sampler |
| `ledger_bytes_delta` | bytes | on-disk ledger growth over the ballot window; empty unless a peer volume path is configured |
| `sustained` | bool | the run was one uninterrupted window |
| `scaling_limit` | true\|false\|inconclusive | sustained TPS vs. the arrival rate the tier demands; `inconclusive` when the driver was the ceiling |
| `failed`, `fail_reason` | bool, text | the run-failed predicate: stage error (including a submit or ceremony-start stage that failed before, during or after the ballot window: `stage_error: submit: …`, `stage_error: ceremony: …`), an on-chain run that put no ballot on the chain (`nothing_submitted`), any drop, reconcile mismatch, nonzero E, or interruption |
| `verify_threads` | count | `timings.json` `verify_threads` — threads the auditor verified ballots on (all cores by default; `SAKSI_AUDIT_THREADS` pins it). Empty when the auditor did not report it |
| `security_run` | true\|empty | `true` when the run had an `attack_plan` (its lifecycle paused to mount attacks) or a `fault_plan` (the peer was stopped mid-window), so its throughput is **perturbed — not for RQ3**. The ballot window excludes the pause and the attacks mounted in it (the two halves of the window are summed), but the ledger still processed the attacks, and the `peak_cpu_pct_*`/`peak_mem_mb_*` sampler ran through the pause, so those peaks include it. `scaling_limit` is always `inconclusive`. Empty for every other run |

A window that closed because it reached its own configured time bound
(`window_s`, as a rate sweep's steps do) is **not** an interruption and not a
failure: it ended as instructed, and it still owes that every ballot it
dispatched committed. Such a run is stamped `bounded` in `journal.ndjson`'s
`run.end`. It is not a sustained measurement either — `sustained` is false and
`scaling_limit` inconclusive — because it covers a slice of the population,
not all of it.

Per-ballot latencies are in `latencies.csv` (`index,segment,ms,ok`);
the full event log with the environment snapshot is `journal.ndjson`.

A run that was RESUMED after an interrupted ballot window has more than one
window. Its `committed`, `dropped`, `failed` cells cover the whole run, but the
window and latency cells (`submit_window_ms`, `committed_tps`, `driver_ceiling_tps`, `latency_*_ms`)
describe only the FIRST window — they measure one window, and a resumed run is
not a sustained measurement (`sustained` is false, `scaling_limit` inconclusive).
The per-window figures are the `segment.end` events in `journal.ndjson`,
and each window's rows carry its segment number in `latencies.csv`.
