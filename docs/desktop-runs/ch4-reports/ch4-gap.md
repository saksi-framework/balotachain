# Chapter IV gap analysis (2026-10-01)

Source: the final paper (`docs/paper/BalotaChain_Final_Paper.pdf`, 78 pp.) against the evidence at saksi `4a38a54`
(branch `docs/ch4-study-2026-09-30`), CLAIMS.md, manuscript-amendments.md, w6-report.md and the saksi runbook.
Full per-commitment table: produced by the Explore agent on 2026-10-01 (50 rows). Summary kept here.

## Have (up to 50K, 4a38a54)
- RQ1 (a)-(f): E = 0, ledger_matches_local, 0 dropped, verify pass, on all six tiers + security + T3.
- Latency p50/p95/p99, TPS 570-925, CPU + memory peaks, stage timers (perf.csv).
- Security run SP-10K: 8 PASS at declared gates (5 live on-chain), reordering SKIPPED (no gate).
- T3: peer down 20.3 s at 40 %, 0 loss, E = 0.
- Comparison with [18] at 50K (697 TPS vs 4.66 TPS); bracket [24] ~3000 TPS / [26] ~40 TPS.

## Missing, needs runs
| Priority | Run | Closes | Est. h (scaled x1.2-1.3) |
|---|---|---|---|
| 1 | Candidate-count check MP-1K at 10 and 28 candidates (2+5) | linear-scaling claim | 0.5 |
| 2 | MP-1K security run | T7, per-position nullifier live | 0.1 |
| 3 | Row 5 SP-483K 1+3 + rate sweep + peak burst | T2 saturation, T8 burst, 483K | 1.9 |
| 4 | Row 6 SP-1M 1+3 | 1M tier | 3.3 |
| 5 | Row 7 SP-1.92M 1+1 | capstone 1 | ~3.5 |
| 6 | Row 7 SP-3.5M 1+1 | capstone 2 | ~5.4 |
| 7 | Row 9 MP-3.5M on-chain 0+1 (phase timeout > 5 h, ~127 GB ledger) | MP capstone | 8.5-10 |
| 8 | Row 8 four offline MP tiers | MP 483K-3.5M offline | 10-11.7 |
| 9 | Small: verifier on a separate machine (RQ1e), CI/SAST log, test-suite log | RQ1e, App. C security | 1.5 |

## Needs analysis / paper amendment
- Rep counts: paper p61-62 says 2+10 (capstones 1+3); runbook uses 2+5 at 50K, 1+3 at 483K/1M, 1+1 row 7, 0+1 row 9.
- Table 3.5 lists MP-483K / MP-1M / MP-1.92M on-chain; runbook has them offline only (row 8).
- `scaling_limit` is always inconclusive in closed loop: compare TPS with the arrival rate directly.
- Threshold-decryption time: define it (combine + decode in-process, plus per-trustee partial submit).
- ElectionGuard vectors are a tally-semantics interop check, not conformance (p53, App. C overclaim).
- Privacy: run the linkage join over a tier export, anonymity set = N; state cross-position linkage and simulated issuance.
- Disk: ledger_bytes_delta empty (no peer volume wired); du the peer volume after big runs.
- Paper defects: refs [21]-[31] appear in Ch. II but the list stops at [20]; p55 cites [9] for Cortier (should be [19]); Algorithms citation numbers shifted.
- CLAIMS.md line 45 (920-1000 TPS) is wrong; the 9-28 % gap vs ef663d1 is unexplained (A/B deferred by the user).
