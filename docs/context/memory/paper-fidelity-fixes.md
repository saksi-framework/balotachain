---
name: paper-fidelity-fixes
description: "Four paper-fidelity gaps (reorder+hash, real EG vectors, voter_id+distributions+named positions, Caliper) all fixed + pushed on branch paper-alignment-evaluation."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

All four user-approved paper-fidelity fixes DONE + committed + pushed as
verifiable chunks on branch `paper-alignment-evaluation` (saksi repo), 2026-07-14:

- **Named positions + voter_id + distributions** (79d2809) — President/Vice
  President/Senator; synthetic voter_id (off-wire, in bundle JSON only, preserves
  Phase-5 unlinkability); uniform|skewed selection profiles; `saksi-demo gen
  --distribution`. Validation gate extended.
- **Reorder + hash verification** (62d4ead, "Fix B") — `saksi-auditor/src/ledger.rs`
  `ledger_digest(ballots)`: order-dependent SHA-256 hash chain (adversary class 5;
  reorder is invisible to the order-independent homomorphic tally, so the digest
  is the sole detector). See [[phase4-5-security-privacy]].
- **Real ElectionGuard vectors** (524a066, "Fix C") — replaced authored model
  scenarios with EG's ACTUAL published sample ballots
  (electionguard-python data/plaintext_ballots_simple.json vs
  election_manifest_simple.json). justice-supreme-court (votes_allowed=2) =
  [6,1,2,3]; referendum-pineapple = [1,1]. Test invariant relaxed exactly-one →
  count ≤ votes_allowed (real EG is multi-select + undervotes). Still interop
  SANITY not conformance (EG int-ElGamal mod p vs Saksi ristretto255).
- **Caliper** (f268225, "Fix D") — `packages/saksi-bulletin/caliper/`: workload
  module drives SubmitBallot from the SAME bundle JSON; workers submit disjoint
  slices (partition.js + assert self-check). Kept Go bench as cross-check. Added
  `saksi-console --setup-only` (CreateElection+DKG, exit) so Caliper owns the
  measured ballot round. Live run network-gated (Phase 6).

Verified: cargo test --workspace (169 green) + Go chaincode + client-sdk green;
node partition self-check; YAML/JSON parse; go build/vet/gofmt.

Remaining in the plan ([[balotachain-ui-demo-plan]] direction): Phase 2-live
timing + Phase 6 campaigns (network-gated, need space-free path/WSL); Phase 7
apps LAST. See [[saksi-first-sequencing]].
