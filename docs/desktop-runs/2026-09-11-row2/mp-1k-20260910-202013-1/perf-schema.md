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
| `proof_gen_cpu_ms` | ms | `gen-timings.json` `cds_prove_cpu_ms` |
| `proof_verify_inproc_ms` | ms | `timings.json` `verify_ballots` — in-auditor-process, per-ballot CDS + credential verification |
| `aggregate_inproc_ms` | ms | `timings.json` `aggregate` |
| `combine_inproc_ms` | ms | `timings.json` `combine` — Lagrange recombination |
| `decrypt_inproc_ms` | ms | `timings.json` `decode` — discrete-log tally recovery |
| `submit_window_ms` | ms | wall clock of the timed ballot window (submit→commit only; no receipt fetch, no file write inside it) |
| `committed`, `dropped` | count | ballot window outcome |
| `committed_tps` | tx/s | committed ÷ window |
| `driver_ceiling_tps` | tx/s | concurrency ÷ median submit latency — the harness's own ceiling. A `committed_tps` near it means the driver, not the network, was the limit |
| `latency_*_ms` | ms | per-ballot submit→commit latency stats (nearest-rank percentiles, population stddev) |
| `peak_cpu_pct_{peer,orderer,client}` | % | `docker stats` sampler peak (`client` is this console's own process) |
| `peak_mem_mb_{peer,orderer,client}` | MB | same sampler |
| `ledger_bytes_delta` | bytes | on-disk ledger growth over the ballot window; empty unless a peer volume path is configured |
| `sustained` | bool | the run was one uninterrupted window |
| `scaling_limit` | true\|false\|inconclusive | sustained TPS vs. the arrival rate the tier demands; `inconclusive` when the driver was the ceiling |
| `failed`, `fail_reason` | bool, text | the run-failed predicate: stage error, any drop, reconcile mismatch, nonzero E, or interruption |

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
