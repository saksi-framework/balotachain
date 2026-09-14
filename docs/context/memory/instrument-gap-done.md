---
name: instrument-gap-done
description: Thesis instrument gap closed — saksi PR #36 (instrument-gap, 13 tasks) merged to main 2026-09-11; desktop on-chain tier runs are the next phase.
metadata:
  type: project
---

Saksi PR #36 (`instrument-gap`, 42 commits, base bb1197d) merged into `main` as merge commit 51c7f19 on 2026-09-11. It delivers the whole eng-reviewed plan `docs/plans/2026-09-10-instrument-gap-execution.md`: journal + sampler, bench stats, resume, ledger audit, tally signatures with on-chain `sigverify`, `--repeat`/sweep/ladder/tier/T3 scripts, streaming generator + auditor, manuscript amendments (balotachain `docs/manuscript-amendments.md`, now on balotachain main via #55).

**Why:** the paper's Appendix C / Table 3.5 rows had no honest producer; now every column has one or is amended.

UPDATED 2026-09-15: rows 1–4 were run on the desktop and the study moved to the wizard; see [[study-grade-wizard-done]].

**How to apply (historical):** next phase is the desktop run table (plan rows 1–9: `tools/up.sh` + `tools/ladder.sh` first, SP-1K measures real TPS before rows 4–9 are scheduled). Parked follow-ups: `audit-stream` does not enforce `verify_stream` on the ledger dump; `--repeat` duplicate `CreateElection` after Submit; saksi PR #35 `feat/board-api` must rebase onto main. After that: live-election mode + admin panel plan (see [[ban-init-workflow]]).
