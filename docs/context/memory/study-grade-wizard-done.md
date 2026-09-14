---
name: study-grade-wizard-done
description: "The Chapter 4 study runs from saksi's /wizard — plan W0–W5 plus W4b/W4c merged by 2026-09-15 (saksi #42–#49, #52, docs #48); next is W6 validation on the desktop."
metadata: 
  node_type: memory
  type: project
  originSessionId: eddf28aa-046c-419f-96ab-1f6c6ce58884
  modified: 2026-09-14T19:25:40.265Z
---

Plan `balotachain/docs/plans/2026-09-14-study-grade-wizard.md` is implemented and merged (saksi main `5ead2db`, 2026-09-15): console auth (#42), attack timeline with gate-matched verdicts and pause points (#44), campaigns + preflight + ladder job + export (#43), network reset + peer-restart fault + resume/verify-only fixes (#46), wizard UI (#47), follow-ups W4b (#49: offline disk/memory guards instead of the 10k cap, public board files route, `--phase-timeout`, export carries journal/gen-timings/receipts-lifecycle, run fails on submit/ceremony stage error), W4c (#52: sweep/burst fields, **Open** to finish any run, phase-timeout preflight row), and the operator docs (#48: runbook §10 + `docs/study-checklist.md`, bring-up with `SAKSI_PHASE_TIMEOUT=5h`). The balotachain admin/trustee/board apps are served by that console (#54–#58).

**Why:** the user wants every Chapter 4 number and verdict produced by clicking through `/wizard`, with written instructions, not by Claude running things in a terminal.

**How to apply:** next is W6 validation on the desktop (wizard SP-1K campaign vs CLI `--repeat` within 5 %; on-chain attack timeline each refused by its declared gate; export loads in `cost_model.py`; four live checks; `-race` in WSL). Then balotachain follow-ups: board download links to `/api/board/<run>/files/<name>`, `cost_model.py` reading the export layout, CLAIMS rows (no on-chain DKG point check, reordering undetected, no caller authorization / front-running DoS, T3 resilience result, PR #41 at 10K). Capstone rows 5–9 stay on hold until the user says. Ledger: `balotachain/.superpowers/sdd/2026-09-14-study-grade-wizard/progress.md`. See [[random-dkg-dealers]], [[desktop-fabric-environment]].
