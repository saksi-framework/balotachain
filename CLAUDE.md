# CLAUDE.md — BalotaChain

Orientation for coding agents. Read this first, then the latest update doc, then the active plan.

## Latest update

- **2026-06-14:** Stage 2 — **read-path link to real Fabric done + CI-verified**. New
  `services/fabric-adapter/` (Go) connects to the saksi chaincode via client-sdk and serves
  `GET /bulletin` in the BalotaChain schema, so the auditor/bulletin board views a REAL on-chain
  election by pointing `BALOTA_BULLETIN_URL` at it. protobuf→JSON mapping is pure + unit-tested
  (local + `adapter` CI job). The `fabric` CI job records a real election lifecycle on-chain via
  `saksi-demo` then asserts the adapter's `GET /bulletin` returns it. Read-only: the chaincode
  verifies real credential signatures, so writing balotachain's stub-credential demo data on-chain
  needs the full real protocol (deferred — conflicts with the locked "stubs as-is" decision).
  Saksi #31 (full lifecycle client-sdk + demo bundle generator) made this possible.
- **2026-06-14:** Stage 2 (real Fabric) — base verified in CI. New `fabric` job (Linux, push/manual
  only) checks out saksi, installs Fabric 2.5.15, vendors + **deploys the saksi chaincode** to the
  test-network (deployCC green). Can't run locally: the dev path's space breaks `fabric-samples`
  (chaincode vendors + builds fine; only bring-up fails). NOT yet asserted: a full on-chain ballot
  round-trip — the chaincode gates `SubmitBallot` on an existing/open election, but saksi's
  `run-one-transaction.sh` skips `CreateElection` and there's no election test-vector. Two saksi-side
  follow-ups: (a) election-setup-before-ballot demo, (b) the gateway↔chaincode integration (Go
  adapter exposing the lifecycle + JSON↔protobuf mapping). The chaincode is a FULL bulletin board
  (CreateElection/PublishDKGTranscript/SubmitBallot/CloseElection/SubmitPartialDecryption/PublishTally).
- **2026-06-14:** Containerized backend (Stage 1) + client wiring (Stage 1.5). `crates/bulletin-gateway`
  HTTP service + `docker-compose.yml` + `.devcontainer`; `docker compose up` serves shared bulletin
  state on `:8080` (verified building/running/persisting). All clients flip to the gateway via
  `BALOTA_BULLETIN_URL`: the 3 Tauri apps + `balota-encrypt` use `BulletinSource::from_env()`
  (Rust), the voter Flutter read path uses `bulletinSourceFromEnv()` → `HttpBulletinStore`.
  Verified live end-to-end (wired CLI records a real ElGamal ballot in the container). `e2e-runner`
  stays file-only (offline driver). See `docker/README.md`.
- **2026-06-14:** CI fully green. Added voter Flutter (3.44.2) + Rust backend-crate jobs, and
  fixed the TS pipeline: build `@balotachain/ui` before typecheck/test (its `exports` point at
  `dist`), prettier-format the recovered sources (+ `.prettierignore` Flutter platform dirs),
  `eslint` ignore nested `dist`/`target`, bump vitest ^3 / happy-dom ^20 (clears criticals), and
  scope `pnpm audit` to `--prod`. The voter Dart can't be built on this box (Dart 3.9.2 < 3.11.4),
  so CI is its verification path.
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
3. **Stage 2 — real Fabric**: base CI-verified (deploy) and the **read-path link is done**
   (`services/fabric-adapter` → auditor/bulletin views a real on-chain election; CI-verified).
   Remaining = the **write path**: making balotachain produce chaincode-valid ballots (real
   credentials/DKG/presentation proofs end-to-end) — large, reverses the locked "stubs" decision.
   To actually point the auditor at real Fabric, run the adapter (needs a live network reachable;
   local Fabric needs a space-free path / WSL — the dev path's space breaks fabric-samples).
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
