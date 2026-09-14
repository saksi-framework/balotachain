---
name: balotachain-ui-demo-plan
description: "BalotaChain Phase 0-3 SHIPPED — one-voter staging demo built (4 apps + real Saksi happy-path + file-backed bulletin + E2E runner), 70 tests green."
metadata:
  node_type: memory
  type: project
  originSessionId: 4c01e9b5-a5fd-45a0-9782-274985b23407
---

BalotaChain one-voter staging demo BUILT (Phase 0-3 complete, commits cbdba49/da7294d/2253e87
on main). Snapshot: `docs/updates/2026-06-14-phase-0-3-shipped.md`. CLAUDE.md updated.

Decisions resolved: voter=Flutter (ADR-0001), UI-first then wire Saksi, minimal admin UI (Tauri).

What landed: shared design system (`packages/ui` @balotachain/ui + Flutter mirror `apps/voter/lib/design/`);
all 4 apps with source+tests — voter Flutter 8 screens, trustee/admin/auditor Tauri2+React18. Real Saksi
happy-path wired: voter→encrypt_ballot via `crates/balota-encrypt` CLI (Process.run from Dart);
trustee→partial_decrypt Tauri command. File-backed bulletin stand-in `~/.balotachain/bulletin.json`
(`crates/bulletin-store`, schema `docs/bulletin-store-schema.md`) replacing Fabric until Go/Docker.
E2E driver `crates/e2e-runner` (binary balota-e2e). 70 tests green.

SINCE THEN (2026-06-14, same day, later commits on main):
- Containerized backend (Stage 1): `crates/bulletin-gateway` (axum) + `docker-compose.yml` + `.devcontainer`;
  `BulletinSource` (File|Http) in bulletin-store; all clients flip via `BALOTA_BULLETIN_URL`. Verified.
- CI fully green: added voter Flutter (3.44.2) + Rust-core jobs; fixed TS pipeline (build @balotachain/ui
  before typecheck/test, prettier, eslint nested ignores, vitest^3/happy-dom^20, `pnpm audit --prod`).
- Stage 2 real Fabric: base CI-verified (chaincode deploys). READ-PATH LINK DONE + CI-verified —
  `services/fabric-adapter` (Go, imports saksi client-sdk via sibling-path replace) serves GET /bulletin
  from a real on-chain election; mapping unit-tested; `fabric` CI job records a real election via
  saksi-demo then asserts the adapter. saksi #31 added the full-lifecycle client-sdk + demo generator.

REMAINING: (1) write-path link = balotachain produces chaincode-valid ballots (real credentials/DKG/
proofs) — large, reverses locked "stubs" decision; (2) real proofs in saksi; (3) real combine+tally
(e2e-runner finalize_demo_tally); (4) mobile encrypt via flutter_rust_bridge.
ENV: this Windows box has Go+Docker+Fabric bins/images BUT the dev path's SPACE breaks fabric-samples →
real Fabric runs only in CI / a space-free path / WSL. See [[saksi-go-toolchain-missing]],
[[saksi-bulletin-first-transaction]], [[saksi-balotachain-split]].
