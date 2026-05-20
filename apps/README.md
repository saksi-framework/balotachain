# BalotaChain application clients

This directory holds the four role-specific clients defined by the locked architecture in [`docs/architecture/2026-05-20-initial-architecture-decisions.md`](../docs/architecture/2026-05-20-initial-architecture-decisions.md):

| Directory | Audience | Stack | Initialized in |
|---|---|---|---|
| [`voter/`](voter/) | Voters | Flutter (Dart) + `flutter_rust_bridge` to the Rust crypto core | issue #31 |
| [`trustee/`](trustee/) | Trustees running DKG and threshold decryption ceremonies | Tauri (Rust + TypeScript) | issue #33 |
| [`admin/`](admin/) | Election administrators (election setup, voter roll, credential issuance) | Tauri (Rust + TypeScript) | issue #35 |
| [`auditor/`](auditor/) | Public verifier — anyone can re-derive the tally and verify all proofs | Tauri (Rust + TypeScript) | issue #36 |

Each subdirectory currently contains only a README describing its role. The actual Flutter project (`flutter create`) and Tauri projects (`pnpm create tauri-app`) are produced by the respective scaffolding issues.

There is no `apps/balotachain/`. Anything proposing a single combined client is a misunderstanding of the locked architecture.
