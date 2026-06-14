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

## OPEN DECISIONS (resolve before implementation)

1. **Voter app tech:** Flutter (honor ADR-0001, port React→Dart, wire `saksi-ffi-flutter`)
   **vs** React+Tauri/PWA (reuse prototype directly, one design language across all apps, wire
   `saksi-ffi-tauri`, needs ADR amendment to drop Flutter).
2. **Build depth:** UI pixel-faithful with mock data first → then wire real Saksi
   **vs** wire Saksi per app as built.
3. **Admin step** (no design; needed for full one-voter cycle = create election + register voter +
   issue credential): seed via setup script/CLI **vs** minimal admin UI in design system
   **vs** defer (hardcode election params).

Recommendation: React+Tauri voter (fastest, reuse) · UI-first then wire · seed via script.

## Implementation phases (once decisions resolved)

- **Phase 0 — Shared design system:** extract tokens + primitives into a shared package
  (e.g. `packages/ui` TS/React, or Flutter theme) so all apps pull one source. Map
  `balota-components.jsx` primitives 1:1.
- **Phase 1 — Port the 3 UIs pixel-faithful** with mock data, fully clickable:
  - `apps/voter` — 8 screens + stepped ballot state machine.
  - `apps/trustee` — Tauri shell + console screen + submit-decryption flow.
  - `apps/auditor` (or standalone bulletin web page) — bulletin board dashboard.
- **Phase 2 — Wire real Saksi happy-path:**
  - voter: `encrypt_ballot()` → submit ballot hex to Fabric via client SDK.
  - trustee: `partial_decrypt()` → DKG combine; advance ceremony.
  - bulletin/auditor: read ballots + tally from Fabric (`GetBallot`), show results + sha256.
  - Bring up `fabric-samples` test-network + deploy saksi chaincode (`network.sh`,
    `run-one-transaction.sh`, `cmd/submit-ballot`).
- **Phase 3 — Admin/setup** (per decision): create election, register the 1 voter, issue
  credential (stub nullifier passes chaincode structural check).
- **ADR:** if voter goes React, write ADR amending ADR-0001 (Flutter → React/Tauri for voter).

## Verification (end-to-end one-voter cycle)
1. Start Fabric test-network, deploy chaincode (saksi `tools`/`network.sh`).
2. Admin/script: create election (3 positions), register 1 voter, issue credential.
3. Voter app: log in → cast stepped ballot → `encrypt_ballot` → submit → get tracking code.
4. Confirm ballot recorded on Fabric (`GetBallot`); voter verification screen resolves code.
5. Trustee console: submit partial decryption → combine → tally decrypted.
6. Bulletin board: shows final results + integrity stats + sha256 tally fingerprint; verify-vote
   lookup of the tracking code succeeds.
7. Tests: `cargo test` (saksi), `pnpm test` (apps), Go chaincode test (note: chaincode/client-sdk
   Go tests currently fail on setup — needs Fabric test harness fix).
