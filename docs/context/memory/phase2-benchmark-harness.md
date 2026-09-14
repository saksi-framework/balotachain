---
name: phase2-benchmark-harness
description: Phase 2 benchmark harness — testable core (percentiles/CSV/driver) DONE + green; live Fabric timing deferred to Phase 6
metadata:
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

**Phase 2 (benchmark harness) — network-free core DONE + green** (2026-07-14).
Follows [[phase1-ballot-model]]. saksi repo, new Go package
`packages/saksi-bulletin/client-sdk/bench/`.

Shipped + unit-tested (incl. `go test -race`):
- `metrics.go` — `Percentiles(durs)` p50/p95/p99 nearest-rank (input copied, monotonic,
  empty→0); `PhaseTimings{Endorse,CDSVerify,Order,Validate,Commit}` with `Total()`
  (CDSVerify is a sub-cost of Endorse, not summed); `ThroughputTPS(committed, window)`;
  `Row` = the Appendix-C schema (tier, ballot_axis, positions, candidates, send_rate,
  submitted/committed/dropped, throughput, latency p50/95/99, per-phase p50 incl. CDS
  sub-split, decrypt_ms, peak cpu/mem); `WriteCSV`/`WriteRow`/`Header`.
- `driver.go` — `Run(n, concurrency, sendRate, SubmitFunc) RunResult`: bounded-concurrency
  worker pool + optional ticker rate-limit; records per-committed latency; **counts drops,
  never swallows them** (submitted == committed+dropped). `RunResult.ToRow(...)`.
- Wired into `cmd/saksi-console`: `--auto --metrics-csv PATH --concurrency K --send-rate N
  --bench-axis single|multi` → `submitBallotsBenchmarked` runs `bench.Run` over the bundle's
  ballots and appends an Appendix-C row (header-if-fresh). Compiles + `go vet` clean; **executes
  only against a live network**.
- Generator now emits `positions`/`candidates` in the bundle JSON (Go `bundle` struct + Rust
  `fixture_to_bundle_json`) for the CSV labels.

**Deferred to Phase 6 campaign runner (needs live Fabric + peer/orderer access, can't build/test
on this box — dev path's space breaks fabric-samples):** the fine Fabric phase split
(endorse/order/validate/commit) from gateway/commit events, the CDS-verify sub-cost isolation,
`docker stats` CPU/mem peaks, threshold-decrypt timing. `submitBallotsBenchmarked` leaves those
Row fields zero (ponytail comment in place). All green: cargo workspace/clippy/fmt + go test
chaincode+sdk(+bench -race)+vet.

Next testable-without-network work: **Phase 3 (accuracy)** — reconcile committed==submitted==
ground_truth, tally-error E=0 per position (auditor already decodes per contest), pinned
ElectionGuard vector subset. Phases 2-live + 6 (campaigns) need the network.
