# CLAUDE.md — BalotaChain

Orientation for coding agents. Read this first, then the latest update doc, then the active plan.

## Latest update

- **2026-06-14:** Containerized backend (Stage 1) + client wiring (Stage 1.5). `crates/bulletin-gateway`
  HTTP service + `docker-compose.yml` + `.devcontainer`; `docker compose up` serves shared bulletin
  state on `:8080` (verified building/running/persisting). All clients flip to the gateway via
  `BALOTA_BULLETIN_URL`: the 3 Tauri apps + `balota-encrypt` use `BulletinSource::from_env()`
  (Rust), the voter Flutter read path uses `bulletinSourceFromEnv()` → `HttpBulletinStore`.
  Verified live end-to-end (wired CLI records a real ElGamal ballot in the container). `e2e-runner`
  stays file-only (offline driver). See `docker/README.md`. ⚠ The voter Flutter changes
  (`bulletin_store.dart` HTTP store + `review_screen` wiring + `http_bulletin_store_test.dart`)
  are UNVERIFIED on this box — Dart here is 3.9.2 but `apps/voter` needs Flutter 3.44.2 / Dart
  ^3.11.4; run `flutter test` on that toolchain to confirm. Rust/gateway/live-E2E are verified.
- **2026-06-14:** [Phase 0-3 shipped — one-voter staging demo](docs/updates/2026-06-14-phase-0-3-shipped.md)
  (UI for all 4 apps + real Saksi crypto + file-backed bulletin stand-in + E2E driver; 70 tests green).

## What this is

BalotaChain — end-to-end verifiable cryptographic voting app (WMSU undergrad thesis).
Initial target: a one-voter / one-election **staging demo** of the full cycle.

Four client roles:
- **voter** — `apps/voter` — mobile (Flutter per ADR-0001, OR React/Tauri — see open decision)
- **trustee** — `apps/trustee` — Tauri desktop (DKG + threshold decryption ceremonies)
- **admin** — `apps/admin` — Tauri desktop (election lifecycle) — no design yet
- **auditor** — `apps/auditor` — Tauri desktop (public verifier)

All crypto / FFI / Fabric chaincode live in the **sibling Saksi repo** (`../saksi`,
`github.com/saksi-framework/saksi`), consumed as a dependency. This repo manages TS/Tauri via
pnpm; Rust + Go live in Saksi.

## Current state (2026-06-14, end of build session)

- Plan Phases 0, 1, 2, and E2E verification are **complete**. See
  `docs/plans/2026-06-14-balotachain-ui-demo-plan.md` for the locked decisions
  (voter=Flutter, UI-first then wire Saksi, minimal admin UI) and the final test totals.
- All four client apps now have source + tests + green build pipelines:
  - `apps/voter` — Flutter (8 screens, splash→verify, Material 3 theme, `flutter_test` 9/9).
  - `apps/trustee`, `apps/admin`, `apps/auditor` — Tauri 2 + React 18 + TS, vitest passing.
- Shared design systems:
  - `packages/ui` — `@balotachain/ui` (tokens + React primitives + 9 icons).
  - `apps/voter/lib/design/` — Flutter mirror (tokens + 9 widget primitives).
- Bulletin store (file-backed Fabric stand-in until Docker/Go available):
  - Schema: `docs/bulletin-store-schema.md`. Path: `~/.balotachain/bulletin.json`.
  - Crate: `crates/bulletin-store/`. Each Tauri app's `src-tauri/src/balota.rs` exposes Tauri
    commands wrapping it. Voter writes via the `balota-encrypt` CLI.
- Real Saksi crypto wired:
  - voter → `saksi-ffi-flutter::api::encrypt_ballot` (via `crates/balota-encrypt/`, shelled
    out from Dart with `Process.run`).
  - trustee → `saksi-ffi-tauri::commands::partial_decrypt` (via Tauri command in
    `apps/trustee/src-tauri/`).
- End-to-end driver: `crates/e2e-runner/` (binary `balota-e2e`). Tests the whole one-voter
  cycle without Tauri/Flutter shells. 2/2 integration tests green.

## Where we left off / next steps

Containerized backend (Stage 1) is in and verified. Resume options:

1. **Run the containerized backend**: `docker compose up -d --build` (see `docker/README.md`),
   then start any client with `BALOTA_BULLETIN_URL=http://localhost:8080` to share state.
2. **Run the demo locally** (file mode):
   ```
   cargo install --path crates/balota-encrypt           # voter CLI on PATH
   cargo run --release -p e2e-runner -- ~/.balotachain/bulletin.json
   pnpm --filter trustee tauri dev    # in another shell, etc.
   flutter run -d windows            # from apps/voter
   ```
3. **Stage 2 — real Fabric**: add Fabric test-network + saksi Go chaincode as compose services;
   gateway routes the ballot slice through `saksi-bulletin/client-sdk`. Gateway REST surface +
   schema unchanged, so clients don't change. (Go + Docker ARE installed on this box now.)
4. **Real proofs**: finish Saksi side (CDS OR, Benaloh, credentials, Chaum-Pedersen, Schnorr —
   all SHA-256 stubs). Note: saksi now exposes `partial_decrypt_v2` (Phase F); `partial_decrypt`
   is deprecated.
5. **Real combine + tally**: replace `crates/e2e-runner/src/lib.rs::finalize_demo_tally` with
   real DKG combine + homomorphic tally decryption (Saksi work).

## Locked decisions
- Use Saksi proof stubs as-is for the demo (real proofs = later Saksi work).
- Build all UIs on the real Saksi happy-path.
- Designs are the UI source of truth; recreate pixel-faithful (tokens in the plan).

## Conventions
- Architecture is locked in `docs/architecture/2026-05-20-initial-architecture-decisions.md`;
  changes need an ADR (`docs/adr/`, see `template.md`) + maintainer approval.
- Commits: Conventional Commits. See `CONTRIBUTING.md`.
- Dev setup: `docs/dev-environment.md`; toolchain check: `tools/bootstrap.{sh,ps1}`. Reproducible
  env: `.devcontainer/` (Rust + Go + Node/pnpm + Docker).
- Primary Windows dev box now HAS Go (`go1.26.4`) + Docker (29.5.3) + Compose — the old "no Go
  here, verify via CI" note is stale; Go/Docker changes can be built and tested locally.
