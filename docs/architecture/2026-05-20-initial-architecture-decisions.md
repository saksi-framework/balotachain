# Initial Architecture Decisions

**Date:** 2026-05-20
**Status:** Accepted (to be split into individual ADRs once the ADR directory lands per issue #4)
**Author:** Vaniel John Cornelio

This document records the foundational architecture decisions for BalotaChain agreed during the initial brainstorming session. Each row in the summary table will eventually be promoted to its own Architecture Decision Record. Until then, this document is the single source of truth for these commitments.

## Locked decisions (from the thesis capsule and PRD — do not change without maintainer approval)

- **Bulletin board substrate:** Hyperledger Fabric.
- **Chaincode language:** Go, using the Hyperledger Fabric Contract API.
- **Chaincode verification split:** hybrid. The chaincode verifies credential signatures, nullifier uniqueness, and ciphertext structural shape on submission. Heavier NIZK well-formedness proofs are verified by client-side Rust auditors and the public verifier. This preserves the consensus-layer integrity properties that justify the permissioned-blockchain architecture, while keeping the chaincode audit surface small enough to maintain in Go.

## Summary table

| Layer | Decision | Rationale |
|---|---|---|
| **Voter client** | Flutter (iOS + Android) with `flutter_rust_bridge` | Reach students on phones, signed app-store binaries, direct Rust crypto reuse via FFI |
| **Trustee, admin, auditor clients** | Tauri (Rust + WebView, desktop) | Supervised devices, native binary, links the Rust crypto core directly |
| **Cryptographic group** | ristretto255 via `curve25519-dalek` | Single prime-order group, fast, mature Rust ecosystem, simplest audit surface |
| **Anonymous credentials** | Blind-signed credentials on ristretto255 | Avoids pairings, keeps the cryptographic group unified, sufficient for one-shot unlinkable eligibility tokens |
| **Tally model** | Homomorphic ElGamal (additive) with CDS OR proofs of ballot well-formedness | Single-choice and approval voting covers WMSU SC and SK; individual ballots are never decrypted |
| **Trustee threshold** | 3-of-5 by default, parameter overridable per election | Liveness with up to 2 trustees offline; configurability supports scaling experiments at SK and citywide HEI federation scales |
| **Bulletin board** | Hyperledger Fabric *(locked)* | Permissioned ledger operated by mutually-independent trustee organizations; matches thesis literature comparison |
| **Chaincode** | Go via the Hyperledger Fabric Contract API *(locked)* | Hybrid verification split: signature + nullifier + ciphertext shape on-chain; NIZKs off-chain |
| **Voter authentication** | Pluggable bootstrap (WMSU SSO via OIDC; Student-ID + birthdate lookup; in-person QR token) feeding a unified blind-signature credential layer | Reuses existing WMSU identity infrastructure; portable to non-WMSU pilots; the credential layer is identical across bootstrap methods |
| **Languages** | Rust (crypto, FFI, auditor logic) · Go (chaincode and Fabric client SDK) · Dart (Flutter mobile UI) · TypeScript (Tauri desktop UI) | One systems language for crypto, one language constrained to the chaincode boundary, one UI language per client surface |

## Repository layout (revised; supersedes issue #1)

```
balotachain/
├── apps/
│   ├── voter/                       # Flutter (Dart) — mobile voter client
│   ├── trustee/                     # Tauri (Rust + TS) — DKG and decryption ceremonies
│   ├── admin/                       # Tauri (Rust + TS) — election setup, voter roll, ceremony orchestration
│   └── auditor/                     # Tauri (Rust + TS) — public verifier, re-derives tally and checks proofs
├── packages/
│   ├── tala-crypto/                 # Rust — ElGamal, Pedersen DKG, Chaum-Pedersen, CDS, commitments, Benaloh
│   ├── tala-credentials/            # Rust — blind-signature anonymous credentials
│   ├── tala-protocol/               # Rust types + matching Go types (codegen or hand-mirrored) for on-chain payloads
│   ├── tala-bulletin/
│   │   ├── chaincode/               # Go — Hyperledger Fabric Contract API
│   │   ├── network/                 # docker-compose and configuration for a development Fabric network
│   │   └── client-sdk/              # Go — wrapper around fabric-gateway used by clients
│   ├── tala-ffi-flutter/            # Rust → Dart bridge via flutter_rust_bridge
│   └── tala-ffi-tauri/              # Rust → TypeScript bridge via Tauri commands
├── spec/                            # protocol specification, threat model, formal protocol description
├── docs/
│   ├── adr/                         # individual architecture decision records (created in issue #4)
│   ├── architecture/                # higher-level architecture documents (this file)
│   ├── dev-environment.md           # detailed developer environment setup (created in issue #3)
│   └── branch-policy.md             # branch protection summary (created in issue #6)
└── tools/                           # benchmarks, scaling simulator, dev scripts
```

## Implications for issue #1

Issue #1 specified a different layout (`packages/tala-*` only, no `apps/<role>/` split, no FFI packages, no Fabric subdirectories). This document supersedes that specification. A comment will be added to issue #1 pointing to this document.

## Cryptographic stack at a glance

- **Group:** ristretto255 (`curve25519-dalek` crate).
- **Public-key encryption:** ElGamal over ristretto255, distributed key generation by Pedersen, threshold decryption with 3-of-5 default.
- **Zero-knowledge proofs:**
  - Chaum-Pedersen NIZK for equality of discrete logarithms (used in threshold decryption proofs).
  - Cramer-Damgård-Schoenmakers (CDS) OR proofs for ballot well-formedness (each ciphertext encrypts 0 or 1; the vector sums to 1).
  - Schnorr NIZK for proof of knowledge of credential opening at cast time.
- **Commitments:** Pedersen commitments on ristretto255.
- **Anonymous credentials:** Blind-signed credentials issued at registration; one-shot unlinkable presentation at cast time; nullifier on bulletin board prevents double-spend.
- **Cast-as-intended:** Benaloh challenge — voter may spoil a ballot to force the device to reveal the encryption randomness, then re-encrypt on an independent verifier to confirm.

## Out of scope for this document

- Specific NIZK transcript framework (Merlin vs. hand-rolled Fiat-Shamir) — will be decided when `tala-crypto` work begins.
- Specific Flutter state management approach, Tauri UI framework choice — UI-layer decisions to be made per app.
- Trustee organization identities for production WMSU deployment (e.g., Office of Student Affairs, CCS faculty, COMELEC-SC, external auditor) — deployment concern, not architecture.
- Mobile app distribution strategy (Play Store / App Store / sideload) — to be decided closer to first pilot.

## Change control

These decisions are locked. Material changes (especially to the locked rows) require explicit maintainer approval and an ADR documenting the change. Minor refinements (e.g., choosing between two Rust NIZK transcript crates) are normal engineering decisions and do not require an ADR.
