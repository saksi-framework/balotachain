# 2026-06-14 — Phase 0-3 shipped (one-voter staging demo)

Snapshot of the build session that took BalotaChain from scaffolding-only to a
working end-to-end one-voter demo. Pair with
[`docs/plans/2026-06-14-balotachain-ui-demo-plan.md`](../plans/2026-06-14-balotachain-ui-demo-plan.md)
for the original plan and [`docs/bulletin-store-schema.md`](../bulletin-store-schema.md)
for the shared data contract.

## Locked decisions

1. **Voter app stack: Flutter.** Honors ADR-0001. Wires `saksi-ffi-flutter`.
2. **Build depth: UI-first then wire Saksi.** All four apps shipped with mock
   data before any crypto wiring landed.
3. **Admin step: minimal admin UI in design system.** New Tauri app, not a
   bootstrap script.

## What landed

### Shared design systems (Phase 0)

- `packages/ui` — `@balotachain/ui` (private pnpm workspace). Tokens object
  (`tokens.color/radius/space/type/shadow`), 7 React primitives
  (`PrimaryButton`, `SecondaryButton`, `TextButton`, `OptionCard`, `TextInput`,
  `TopBar`, `PageDots`), 9 inline-SVG icons, `styles.css` base reset.
- `apps/voter/lib/design/` — Flutter mirror. `BcColors`, `BcRadii`, `BcSpace`,
  `BcType`, `bcTheme()`, 9 widget primitives (`BcPrimaryButton`,
  `BcSecondaryButton`, `BcTextButton`, `BcOptionCard`, `BcTextInput`,
  `BcTopBar`, `BcPageDots`, `BcCard`, `Icons.*` constants).
- Hex values match byte-for-byte across both flavors.

### Four client apps (Phase 1)

| App | Stack | Highlights |
|---|---|---|
| `apps/voter`   | Flutter | 8 screens (Splash, Onboarding, EmailLogin, ElectionHome, stepped Ballot Pres/VP/Senators, Review, Submitted, Verify). Senators cap-lock at 12. `BC-XXXX-XXXX` tracking code. |
| `apps/trustee` | Tauri 2 + React 18 + TS | Identity card, 3-of-5 threshold panel with progress meter, 5-trustee roster, 2-step Submit Partial Decryption, audit log. |
| `apps/auditor` | Tauri 2 + React 18 + TS | Verified banner, 3 race result cards with elected tags, 4 integrity stat cards, sha256 tally fingerprint with copy, verify-your-vote lookup. |
| `apps/admin`   | Tauri 2 + React 18 + TS | 3-step wizard (election, voter roll, credentials) + summary. Reuses shared tokens. |

### Bulletin store (Phase 2 foundation)

Local file-backed stand-in for Hyperledger Fabric chaincode while Docker and Go
are unavailable on the dev machine. Path: `~/.balotachain/bulletin.json`.

- Schema: [`docs/bulletin-store-schema.md`](../bulletin-store-schema.md).
- Rust crate: `crates/bulletin-store/` (typed `Bulletin` + `load`/`save` +
  `results_fingerprint`).
- Adapters in each Tauri app at `apps/<app>/src/lib/bulletin.ts` and in the
  voter at `apps/voter/lib/data/bulletin_store.dart`. All adapters share one
  small interface so they can be swapped for a `saksi-bulletin/client-sdk`
  gRPC implementation later without touching app code.

### Real Saksi crypto wiring (Phase 2)

- **Voter:** `crates/balota-encrypt/` Rust CLI exposes
  `saksi_ffi_flutter::api::encrypt_ballot` over stdin/stdout JSON. The voter
  app shells out via `Process.run` from
  `apps/voter/lib/services/encrypt_service.dart`. Real ElGamal hex is written
  into `bulletin.json`.
- **Trustee:** `apps/trustee/src-tauri/src/balota.rs` exposes Tauri commands
  wrapping `saksi_ffi_tauri::commands::partial_decrypt`. Submit click runs
  real partial decryption against every ballot.
- **Auditor:** read-only Tauri commands surface the bulletin and look up
  tracking codes. A pure-TS canonical-JSON fingerprint mirrors the Rust
  `results_fingerprint` byte-for-byte (verified by a cross-language fixture
  `sha256:06da800e...0682`).
- **Admin:** Tauri commands write election + voter + credential into the
  bulletin (credentials use a sha256 nullifier stub matching the placeholder
  behavior in the empty `saksi-credentials` crate).

### End-to-end driver (Phase 3)

`crates/e2e-runner/` (binary `balota-e2e`) walks the full cycle through every
library on disk (no Tauri/Flutter shell needed): admin commands → voter
encrypt (real ElGamal) → trustee partial decrypt (real curve25519 math) →
deterministic demo tally + sha256 fingerprint.

```
cargo run --release -p e2e-runner -- ~/.balotachain/bulletin.json
```

After this runs, launching any of the Tauri apps reads the same file and the
auditor reflects the real numbers.

## Test totals (all green at HEAD)

| Layer            | Count | Command |
|---|---|---|
| Rust crates       | 17 | `cargo test -p bulletin-store -p balota-encrypt -p e2e-runner` (9 + 6 + 2) |
| Rust src-tauri    | 15 | `cargo test --lib` in `apps/{trustee,admin,auditor}/src-tauri` (4 + 4 + 7) |
| TS vitest         | 29 | `pnpm -r test` (trustee 7 + admin 6 + auditor 16) |
| Dart flutter_test | 9  | `flutter test` in `apps/voter` |
| Type/build/lint   | —  | `pnpm -r typecheck`, `pnpm -r build`, `flutter analyze` all clean |

**Grand total: 70 tests passing.** TDD red→green pairs were performed during
Phase 2 + 3 wiring for every adapter, command, and impl function.

## Running the demo

### macOS desktop (full E2E)

```
cargo install --path crates/balota-encrypt
cargo run --release -p e2e-runner -- ~/.balotachain/bulletin.json
pnpm --filter trustee tauri dev      # in another shell
pnpm --filter auditor tauri dev      # ditto
pnpm --filter admin   tauri dev      # ditto
cd apps/voter && flutter run -d macos
```

### iOS simulator / Android emulator

UI runs, navigation runs, ballot submit fails on encrypt (`Process.run` to a
host CLI is sandboxed). Real mobile encrypt path is the next chunk of work
(flutter_rust_bridge codegen for `saksi-ffi-flutter`).

## Toolchain installed in this session

- `pnpm@9.15.9` (via `npm install -g pnpm@9`).
- `cargo tauri@2.11.2` (via `cargo install tauri-cli`).

## Known stubs and follow-up

1. **Real Fabric path:** install Go + run Docker. Each app's
   `bulletin.ts`/`bulletin_store.dart` swaps to a `saksi-bulletin/client-sdk`
   gRPC adapter. Schema does not change.
2. **Real proofs:** CDS OR proof, Benaloh, credentials, Chaum-Pedersen,
   Schnorr — currently SHA-256 stubs in Saksi. Re-running on the real
   implementations does not need balotachain changes.
3. **Real combine + tally:** replace
   `crates/e2e-runner/src/lib.rs::finalize_demo_tally` with real DKG combine
   and homomorphic tally decryption (Saksi side).
4. **Mobile encrypt:** wire `flutter_rust_bridge` for `saksi-ffi-flutter` so
   the voter app can encrypt on iOS / Android without shelling to a host CLI.

## Commits

- `cbdba49` — feat: implement BalotaChain one-voter staging demo (Phase 0-3)
- `da7294d` — docs: mark Phase 0-3 demo as shipped in plan and CLAUDE.md
