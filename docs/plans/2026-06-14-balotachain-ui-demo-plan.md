# BalotaChain — UI Implementation & One-Voter E2E Demo Plan

_Created 2026-06-14._

## Context

BalotaChain is an end-to-end verifiable cryptographic voting app (WMSU thesis). The repo
currently holds only scaffolding: monorepo layout, pnpm workspace, CI (TS only), ADRs, docs,
bootstrap scripts. **All four client apps are README-only — zero UI, zero app source.**

All crypto / FFI / chaincode now live in the sibling **Saksi** repo
(`../saksi`, i.e. `github.com/saksi-framework/saksi`), consumed as a dependency.

The user produced three high-fidelity designs in claude.design (handoff bundle read in full)
and wants them implemented for real, wired to Saksi, as a one-voter / one-election staging
demo. Fabric is permissioned → no gas fees.

## Saksi readiness (verified against current code)

**Works now (real, tested):**
- `encrypt_ballot()` — real ElGamal (saksi-ffi-flutter `src/api.rs`)
- `partial_decrypt()` + DKG combine — real (saksi-ffi-tauri `src/commands.rs`, saksi-crypto `dkg.rs`)
- Fabric `SubmitBallot` / `GetBallot` — real Go chaincode (saksi-bulletin `chaincode/contract.go`),
  runs on `fabric-samples` test-network (present locally), client SDK in `client-sdk/`
- protobuf wire types (Rust + Go) — generated, golden vector `ballot-v1.hex`

**Stubbed (return only a SHA-256 digest, NOT real crypto):**
- CDS OR proof, Benaloh challenge, credentials/nullifier/presentation (`saksi-credentials` empty),
  Chaum-Pedersen, Schnorr

**Decision locked:** use stubs as-is. Build all UIs on the real Saksi happy-path; proofs stay
placeholders (pass structural checks, not cryptographically real). Real proofs = separate later
work in the Saksi repo. Good enough for a staging/demo, NOT a trustable election.

## The three designs (source of truth)

Design bundle (claude.design React/HTML prototypes), recreate pixel-faithful:

1. **Voter app** — mobile 390×844, 8 screens:
   Splash → Onboarding (3 slides, skippable, page dots) → Email login (email only, no password)
   → Election home (**Philippine National Elections 2028**, 3 positions) → stepped Ballot
   (President pick 1 / VP pick 1 / Senators multi up to 12, live "N of 12" counter, cap-locks)
   → Review (grouped by position + amber finality warning) → Vote submitted (tracking code
   e.g. `BC-7F3A-92K1`, Copy) → Verification (code lookup → success card).

2. **Trustee Console** — desktop 1280px:
   Header ("BalotaChain — Trustee Console" + signed-in trustee + secure indicator) → identity &
   key-share card ("Key share: held securely ✓", never leaves device) → threshold decryption
   panel (3-of-5, live progress meter, 5-trustee roster w/ status chips Submitted/Pending/Offline,
   YOU marker) → Submit Partial Decryption (teal pill, plain-language note, irreversible/logged,
   2-step confirm) → verification context (aggregate fingerprint + ballots count + homomorphic
   reassurance) → ceremony audit log (read-only, monospaced timestamps) → footer.

3. **Bulletin Board** — public desktop dashboard:
   Header (wordmark + "Election Closed" badge) → verified banner → Final Results (3 race cards
   w/ vote counts, share bars, ELECTED tags) → integrity summary (4 stat cards) → cryptographic
   verification (`sha256:` tally fingerprint + Copy, "3 of 5 trustees") → verify-your-vote lookup
   (success/error) → footer (open-source Saksi note). Responsive → single column.

### Design system (exact tokens)
- Colors: teal `#0F6E6E`, dark `#0A5252`, light `#E3F1F1`, bg `#FAFAF8`, surface `#FFFFFF`,
  text-1 `#1A2526`, text-2 `#5C6B6B`, success `#2E7D5B`, warn `#C8851A`, error `#C0392B`,
  border `#E0E4E3`. Teal + neutrals do the work; green/amber/red only for status.
- Shape: cards 16px radius, buttons 12px, primary buttons = pill (9999), one soft shadow/card.
- Spacing: 8 / 16 / 24 / 32. Buttons min-height 56px.
- Type: system font stack; body 16, headings 24–28, button 18, line-height 1.5.
- Component primitives (from `balota-components.jsx`): PrimaryButton (teal pill), SecondaryButton
  (outlined), TextButton, OptionCard (selectable; selected = teal border + light-teal fill +
  check; supports `multi` + `disabled`), TextInput (mono variant), TopBar, PageDots, line-glyph
  icon set (lock, shieldCheck, globe, check, copy, back, chevron, clock, alert).

Design bundle source: the three claude.design handoff links (Trustee Console / Bulletin Board /
BalotaChain standalone). Each is a gzipped tar with `chats/chat1.md` (full intent transcript),
`project/*.jsx` (React source), and standalone HTML. Re-fetch from those links if needed.

## Locked decisions (resolved 2026-06-14)

1. **Voter app tech: Flutter** — honors ADR-0001. Port React designs to Dart; wire
   `saksi-ffi-flutter`. No ADR amendment needed.
2. **Build depth: UI-first then wire Saksi** — Phase 1 ships all 4 apps pixel-faithful with
   mock data, Phase 2 swaps in real Saksi calls per app.
3. **Admin step: minimal admin UI in design system** — small Tauri admin app reusing
   shared React tokens/primitives; covers create-election, voter register, credential
   issuance. Replaces the script/CLI option.

## Implementation phases

- **Phase 0 — Shared design system (two flavors):**
  - **0a (TS/React):** `packages/ui` — tokens + primitives (PrimaryButton, SecondaryButton,
    OptionCard, TextInput, TopBar, PageDots, icons) consumed by `apps/trustee`, `apps/admin`,
    `apps/auditor` (Tauri).
  - **0b (Flutter):** mirror tokens + widgets as a Flutter theme/package consumed by
    `apps/voter`. Match React tokens 1:1.
- **Phase 1 — Port the 4 UIs pixel-faithful** with mock data, fully clickable:
  - `apps/voter` (Flutter) — 8 screens + stepped ballot state machine.
  - `apps/trustee` (Tauri/React) — console + submit-decryption flow.
  - `apps/auditor` (Tauri/React) — bulletin board dashboard.
  - `apps/admin` (Tauri/React) — create election, register voter, issue credential.
- **Phase 2 — Wire real Saksi happy-path:**
  - voter: `encrypt_ballot()` via `saksi-ffi-flutter` → submit ballot hex to Fabric via
    client SDK.
  - trustee: `partial_decrypt()` via `saksi-ffi-tauri` → DKG combine; advance ceremony.
  - bulletin/auditor: read ballots + tally from Fabric (`GetBallot`), show results + sha256.
  - admin: create election + voter register + credential issuance on chain.
  - Bring up `fabric-samples` test-network + deploy saksi chaincode (`network.sh`,
    `run-one-transaction.sh`, `cmd/submit-ballot`).

## Verification (end-to-end one-voter cycle)

### Status: implemented and green (2026-06-14)

Local dev machine lacks Go and Docker is not running, so Fabric is swapped for a file-backed
**bulletin store** at `~/.balotachain/bulletin.json` (schema:
`docs/bulletin-store-schema.md`, crate: `crates/bulletin-store/`). The store is a drop-in
stand-in — each app's bulletin adapter is a thin interface that can be swapped for the real
`saksi-bulletin/client-sdk` once Fabric is up.

End-to-end driver: `crates/e2e-runner/` (binary: `balota-e2e`).

```
cargo run --release -p e2e-runner -- ~/.balotachain/bulletin.json
```

This runs the full cycle through every library on disk (no Tauri/Flutter shell required):
admin commands → voter encrypt (real ElGamal via `saksi-ffi-flutter::api::encrypt_ballot`) →
trustee partial decrypt (real `saksi-ffi-tauri::commands::partial_decrypt`) → demo tally with a
deterministic `sha256:` fingerprint. After it runs, launching the Tauri apps reads the same
bulletin and the auditor's verify-vote / tally fingerprint cards reflect real numbers.

### Test totals (2026-06-14, all green)

| Layer            | Count | Command |
|---|---|---|
| Rust crates       | 19 | `cargo test -p bulletin-store -p balota-encrypt -p e2e-runner` (9 + 6 + 2 + 2 docs) |
| Rust src-tauri    | 15 | `cargo test --lib` in `apps/{trustee,admin,auditor}/src-tauri` (4 + 4 + 7) |
| TS vitest         | 29 | `pnpm -r test` (trustee 7 + admin 6 + auditor 16) |
| Dart flutter_test | 9  | `flutter test` in `apps/voter` |
| Type/build/lint   | —  | `pnpm -r typecheck`, `pnpm -r build`, `flutter analyze` all clean |

### Remaining (real-Fabric path, future work)

1. Install Go toolchain locally OR run the demo on a CI runner with Go + Docker preinstalled.
2. Bring up `fabric-samples` test-network + deploy `saksi-bulletin/chaincode`.
3. Replace each app's bulletin adapter (one file per app) with a `saksi-bulletin/client-sdk` gRPC implementation.
4. Implement real DKG combine + tally decryption (currently a deterministic demo tally).
