---
name: saksi-first-sequencing
description: Paper-alignment plan LOCKED order — finish saksi backend (Phases 0-6) before balotachain apps (Phase 7)
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

Thesis paper-alignment plan (`C:\Users\User\.claude\plans\wobbly-stirring-leaf.md`,
reviewed via /plan-ceo-review + /plan-eng-review 2026-07-13). **LOCKED sequencing:**
finish the **saksi backend first** (Phases 0-6 — all saksi: R1 on-chain CDS, R2
multi-position + per-position nullifier, generator, benchmark harness, accuracy,
security suite, privacy, campaigns), THEN the **balotachain apps** (Phase 7 — voter
Flutter + trustee Tauri + auditor/verifier e2e via fabric-adapter, demo-only, scope
frozen).

**Why:** working the backend now; Phases 0-6 live in the saksi repo, Phase 7 is the
only balotachain-repo lane and depends on the finished backend + evaluation data.

**How to apply:** don't start Phase 7 app work until 0-6 are done. Next build step =
Phase 0 (R1 CDS-verify Go port in chaincode, R2 nullifier change). See [[balotachain-ui-demo-plan]].
