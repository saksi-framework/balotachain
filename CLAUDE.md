# CLAUDE.md — BalotaChain

Orientation for coding agents. Read this first, then the active plan.

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

## Current state (2026-06-14)

- Repo = scaffolding only: monorepo layout, pnpm workspace (`apps/trustee|admin|auditor`),
  CI (TS only), ADRs 0001–0004, docs, bootstrap scripts. **All four apps are README-only —
  no UI, no app source yet.**
- Three high-fidelity designs delivered via claude.design (voter app, trustee console, bulletin
  board) — to be implemented pixel-faithful. Full design system + screen specs captured in the
  active plan.
- Saksi happy-path verified working: `encrypt_ballot`, `partial_decrypt` + DKG combine, Fabric
  `SubmitBallot`/`GetBallot`, protobuf wire types. Proofs (CDS, Benaloh, credentials,
  Chaum-Pedersen, Schnorr) are **stubs returning SHA-256 digests** — using as-is for the demo.

## Where we left off / next steps

Planning complete; implementation not started. Resume by:
1. Read **`docs/plans/2026-06-14-balotachain-ui-demo-plan.md`** (the active plan).
2. Resolve the 3 OPEN DECISIONS in that plan (voter tech, build depth, admin step).
3. Execute Phase 0 → 3.

## Locked decisions
- Use Saksi proof stubs as-is for the demo (real proofs = later Saksi work).
- Build all UIs on the real Saksi happy-path.
- Designs are the UI source of truth; recreate pixel-faithful (tokens in the plan).

## Conventions
- Architecture is locked in `docs/architecture/2026-05-20-initial-architecture-decisions.md`;
  changes need an ADR (`docs/adr/`, see `template.md`) + maintainer approval.
- Commits: Conventional Commits. See `CONTRIBUTING.md`.
- Dev setup: `docs/dev-environment.md`; toolchain check: `tools/bootstrap.{sh,ps1}`.
- No Go toolchain on the primary dev machine — verify Go via CI / in the Saksi repo.
