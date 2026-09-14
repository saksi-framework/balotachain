---
name: phase4-5-security-privacy
description: Phase 4 (security adversary classes) + Phase 5 (privacy structural) DONE + green; auditor security_privacy.rs with traceability matrix
metadata:
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

**Phases 4 (security) + 5 (privacy) DONE + green** (2026-07-14). Follows
[[phase2-benchmark-harness]]. saksi repo, new
`packages/saksi-auditor/src/security_privacy.rs` (5 tests, each with a positive
control; module doc has the adversary-class → test traceability matrix).

Most classes were ALREADY covered by `tests.rs` + chaincode `contract_test.go`:
- Class 1 double-vote / 6 replay → `reused_nullifier_is_caught`,
  `per_position_double_vote_is_caught`, chaincode `TestSubmitBallotRejectsDoubleVote`.
- Class 2 malformed/tampered → `tampered_ballot_cds_proof_is_caught`,
  chaincode `TestSubmitBallotRejectsTamperedCDSProof` / count-mismatch / unknown-position.
- Class 3 sub-threshold → `under_threshold_decryptions_are_caught`.
- Class 4 admin params → `bad_parameters_version` / `wrong_issuer_pk` / `dkg…mismatch`.

NEW in security_privacy.rs (the gaps):
- Class 5 malicious BB node (drop): dropping a committed ballot post-tally →
  detected as `tally.homomorphic_sum` mismatch (1-org framing: detect, not prevent).
- Explicit positive controls for classes 3 + 4 + 5 (attack fails, honest op passes).
- Phase 5 structural: on-chain ballot carries no voter identity (only 32-byte
  anonymous commitment + PRF nullifier); only the per-contest aggregate is
  decrypted, never an individual ballot.

Green: cargo test -p saksi-auditor (30 tests) + clippy -D + fmt.

**Git (saksi):** branch `paper-alignment-evaluation` pushed to origin, 4 commits:
- `ae7e7a4` feat: on-chain CDS + per-position model + generator (Phases 0-1)
- `23b3156` feat(bench): Appendix-C benchmark harness (Phase 2 core)
- `514deab` test(auditor): security + privacy suite (Phases 4-5)
- `c41b906` test(crypto,bench): ElectionGuard interop + accuracy reconcile (Phase 3)
PR not yet opened: https://github.com/saksi-framework/saksi/pull/new/paper-alignment-evaluation

**Phase 3 DONE (testable parts, 2026-07-14):** EG interop check (chosen source =
official ElectionGuard model) — `saksi-crypto/src/eg_interop.rs` +
`saksi-protocol/test-vectors/eg-interop-v1.json`, pinned tally SCENARIOS (not
ciphertext bytes — EG is integer-ElGamal mod p, Saksi is ristretto255, so bytes
aren't comparable; framed as interop SANITY, not conformance). Encrypt {0,1}
selections → homomorphic add → decrypt → assert per-selection totals match. Plus
`bench/accuracy.go Reconcile(submitted,committed,expected)` fail-loud gate.
Tally-error E=0 already enforced by the auditor.

**Remaining = network-gated or last:** Phase 2-live timing (endorse/order/validate/
commit split, docker stats) + Phase 6 campaigns (1k→1M) need a live Fabric network
(space-free path / WSL — dev path's space breaks fabric-samples). Phase 7 apps last.
Full branch green: cargo workspace(30+29+86+…)/clippy -D/fmt + go test chaincode+sdk+bench.
