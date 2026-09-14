---
name: phase0-r1-done
description: Phase 0 COMPLETE + green — R1 (on-chain CDS verification) + R2 (per-position nullifier); Phase 1 (generator) next
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

**Phase 0 / R1 (on-chain CDS ballot-well-formedness verification) is DONE and
fully green** (saksi repo, 2026-07-13). Part of [[saksi-first-sequencing]].

What shipped:
- CDS OR-proof verification moved on-chain into the Fabric chaincode
  (`packages/saksi-bulletin/chaincode/cdsverify/`), byte-exact with the Rust
  prover, pinned by a cross-language golden vector
  (`saksi-protocol/test-vectors/cds-proof-v1.hex`).
- **Serial-free binding** (key design decision): CDS context =
  `binding_context(election_id ‖ contest_id ‖ nullifier)` in
  `saksi_crypto::nizk::cds::binding_context`. The old auditor binding used the
  ballot's positional serial, which Fabric endorsement can't know (runs before
  ordering). The nullifier is order-independent → concurrent-submission safe.
- Election pubkey derived on-chain from the DKG transcript
  (`chaincode/electionpk.go`, `Σ` constant-term commitments). `SubmitBallot` now
  requires a published DKG transcript.
- Auditor + fixture prover updated to the same binding (lockstep).
- **ADR-0007** records this, partially superseding ADR-0005.
- All green: cargo test workspace, go test chaincode (incl. new CDS-gate tests:
  accept, tamper, missing-DKG, count-mismatch, double-vote), clippy -D warnings,
  gofmt, go vet, fmt.

Not aligned yet (deferred to Phase 7 apps): FFI `generate_cds_proof_v2` still
binds `contest_id` only — commented in `saksi-ffi-flutter/src/api.rs`.

**R2 (per-position nullifier) is DONE + green** (2026-07-13). Decision
"Crypto now, model with Phase 1": nullifier = `PRF(s_cred, election_id ‖
position_id)` with 8-byte length prefixes (empty position = legacy per-election
path). Shipped in `nullifier_h`/`derive_nullifier` (nullifier.rs), threaded
through `present()`/`verify_presentation()` (presentation.rs) + FFI
`derive_nullifier_v2`/`present_credential_v2` (new `position_id` arg). Auditor +
fixtures pass `b""` (transitional legacy path). **No chaincode change needed** —
different position → different nullifier bytes → the chaincode's existing
nullifier-value uniqueness key already enforces per-position double-vote
rejection. Pinned vector regen'd to `682bab1fac2ec1fbbcbde1774aad52067ce115c703a7d70c9edd8324435fd354`
(s=123, election-2026, president). E3 regression (legacy single-position
round-trip) holds. All green: cargo test workspace / clippy -D / fmt / go test.

The one-record-per-position **ballot model** restructure is deferred to Phase 1's
generator (`saksi-demo gen --positions P`). **Phase 1 next**: parameterized
synthetic-data generator + seeded ground-truth in the bundle JSON + fail-closed
validation gate.
