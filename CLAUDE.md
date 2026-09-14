# CLAUDE.md — BalotaChain

Orientation for coding agents. Read this first, then the latest update doc, then the active plan.

## Latest update

- **2026-09-15:** [State and next steps](docs/updates/2026-09-15-state-and-next-steps.md) —
  start here on a new machine. The study runs from saksi's `/wizard` (campaigns, preflight,
  attack timeline, network reset, T3 fault, resume, export); the admin, trustee and board apps
  are served by that console; generator DKG keys are random from saksi `1812139` (older runs
  support no secrecy claim); Defense Reviewer Part 5 covers the codebase. Open: saksi #52
  (wizard W4c), then rewrite #48, then W6 validation on the desktop. Ledger:
  `.superpowers/sdd/2026-09-14-study-grade-wizard/progress.md`.

- **2026-09-10:** [Bulletin board + trustee console are dynamic](docs/updates/2026-09-10-dynamic-board-and-trustee.md).
  `apps/auditor` and `apps/trustee` are now **browser apps served by the saksi-campaign
  console** (`/board/?run=<id>`, `/trustee/?run=<id>&trustee=<n>`), driven by real elections
  instead of the mockup's demo data. Both `src/lib/bulletin.ts` files stopped being Tauri
  `invoke` adapters and became fetch clients; `src/mocks/` is deleted in both. Needs saksi PR
  `feat/board-api`: `GET /api/board/<run>` (offline-first — `/api/trail` dials Fabric and 502s
  without a network), `GET /api/verify-code/<run>/<code>` (tracking code = first 8 hex of a
  ballot's nullifier), `--web-dir` static serving, and ceremony timestamps. Ranking (seats,
  cut line, ties-reported-not-resolved) moved into Go so the wizard and the board share one
  rule. Verified end-to-end against a live console: 20 voters x 3 positions x 4 candidates,
  3-of-5 trustees, publish below threshold refused with 409, board flipped pending -> verified,
  E = 0 on all 12 contests. Delivery path is the browser, not Tauri; no Rust changed, so the
  Tauri crates are untouched, but they are no longer a working delivery path. (`cargo check` on
  `apps/auditor/src-tauri` cannot run on this box — `dlltool.exe` is missing, so `windows-sys`
  and `parking_lot_core` fail to build. Pre-existing environment gap, unrelated to this work.)

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

0. **Run the real demo** (current best path — the bulletin board and trustee console over a
   real saksi election):
   ```
   ./tools/build-web.sh                       # -> dist-web/{board,trustee}
   # in saksi: cargo build -p saksi-demo --release
   #           cd packages/saksi-campaign && go build ./cmd/saksi-campaign
   saksi-campaign serve --demo <saksi-demo> --web-dir <balotachain>/dist-web
   ```
   Run an election at `/wizard`, then open `/board/?run=<id>` and
   `/trustee/?run=<id>&trustee=2`. See
   `docs/updates/2026-09-10-dynamic-board-and-trustee.md`.
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
4. **Real proofs — DONE on the Saksi side (this note was stale; corrected 2026-07-21).** CDS OR,
   Benaloh, credentials, Chaum-Pedersen, and Schnorr are **real ristretto255 implementations, not
   SHA-256 stubs**: `saksi-crypto/src/nizk/cds.rs` is a genuine Chaum-Pedersen OR-proof with
   Fiat-Shamir challenge splitting (simulated branches + forced true-branch challenge), and
   `saksi-credentials` states "full implementations, not stubs". The chaincode verifies the CDS
   proof on-chain at endorsement (ADR-0007). What remains is **balotachain-side**: this repo's
   demo path still fabricates stub credentials, so balotachain-generated ballots are not
   chaincode-valid — that is the write-path gap in item 3, not missing crypto in Saksi.
   Note: saksi now exposes `partial_decrypt_v2` (Phase F); `partial_decrypt` is deprecated.
5. **Real combine + tally**: replace `crates/e2e-runner/src/lib.rs::finalize_demo_tally` with
   real DKG combine + homomorphic tally decryption (Saksi work).

## Locked decisions
- Use balotachain's stub **credentials** as-is for the demo. (Superseded in part: Saksi's *proofs*
  are real — see item 4 above. What stays stubbed is balotachain's demo credential material, which
  is why balotachain-generated ballots aren't chaincode-valid yet.)
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

<!-- ban-init:begin -->
## ban-init — orchestrator + tiered subagents

This repo runs the ban-init workflow: the main session (Fable) plans, dispatches, reviews, and synthesises; subagents implement. Invoke `/ban-init` at the start of any multi-step task; it wraps `superpowers:subagent-driven-development`.

- Fable is never dispatched as a worker. Ladder: `executor` (Opus, default implementer) · `mech-executor` (Sonnet, repetitive fully-specified edits only) · `scout` (Haiku, lookups only) · `reviewer` (Sonnet, after every task) · `final-reviewer` (Opus, once per branch). If Opus is rate-limited, fall back to `mech-executor` for the current task and say so in the ledger.
- Do it directly only when it is a few tool calls with small output; otherwise dispatch. Debugging and bulk edits are dispatched.
- Never enter plan mode while a subagent is live; plan in a file.
- Worktree when the task edits files another live worker or the main checkout is editing, targets another branch or repo, or opens its own PR; otherwise in place.
- Workers write reports to files and reply in under 15 lines; progress lives in the ledger, not in chat.
- Caveman ultra in chat; full prose in code, commits, PRs, reports, and the four stop conditions.
<!-- ban-init:end -->
