---
name: phase1-ballot-model
description: Phase 1 DONE + green — Option A one-record-per-position (position_id on Ballot proto) + parameterized generator + validation gate
metadata:
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

**Phase 1 multi-position ballot model = Option A (one record per position)**, user-locked
2026-07-13. Follows [[phase0-r1-done]] (R2 per-position nullifier). saksi repo.

The encoding:
- **`position_id` added to the `Ballot` proto** (additive field #7). Each `(voter, position)`
  is its own `Ballot`: carries that position's `C` candidate ciphertexts + `C` CDS proofs +
  one credential presentation whose nullifier = `PRF(s_cred, election_id ‖ position_id)` (R2).
- **`contest_ids` become position-qualified** — `"<position_id>/<candidate_idx>"`, so the
  election-wide list is `P×C` slots. A ballot's `C` ciphertexts map to the `C` contest_ids
  belonging to its `position_id` (deterministic prefix filter, order-preserving —
  endorsement-safe).
- **Chaincode** verifies each per-position record against just its position's `C` contests
  (relax the old `len(ciphertexts)==len(all contest_ids)` to the position subset). CDS binds
  `(election_id, position-qualified contest_id, nullifier)`. Still only checks nullifier-VALUE
  uniqueness (per-position falls out: distinct nullifier per position). Does NOT recompute the
  nullifier binding (that stays off-chain in the auditor).
- **Tally** = `P×C` totals; partial decryptions keyed `(election_id, contest_id, trustee)` over
  the `P×C` labels. P=1 subsumes the current single-position model (ballot axis: single vs multi).

Ripples (all locally testable — cargo + go test, no live Fabric): proto codegen (Rust+Go),
chaincode SubmitBallot + tests, auditor `ballot.rs`/`fixtures.rs`/`demo.rs`, console bundle
(+ per-ballot position_id + ground-truth arrays), re-pin CDS/wire golden vectors. Rejected:
B (one atomic all-position ballot, reverses R2) and C (position=separate election_id, sidesteps R2).

**Phase 1 deliverable on top:** parameterized generator (`--voters N --positions P --candidates C`),
seeded ground-truth in the bundle JSON, fail-closed validation gate (unique voter ids, unique
nullifiers, in-range selections, per-position aggregate == sum of ballots).

**DONE + fully green (2026-07-14).** Shipped:
- Proto: `position_id` field #7 on `Ballot`. Regenerated Go via host vendored protoc
  (`~/.cargo/.../protoc-bin-vendored-win32-3.2.0/bin/protoc.exe` + `go install protoc-gen-go@v1.34.2`
  → `~/go/bin`) — **Docker Desktop was down, so `scripts/codegen.sh` (Docker) failed**; used host
  protoc instead. Rust regenerates at build time (prost). Re-vendored the copy in chaincode +
  client-sdk (`go mod vendor`). Re-pinned `ballot-v1.hex` golden (empty position omits in proto3;
  the pinned sample now sets position "president" → `+3a09707265736964656e74`).
- Shared mapping helper `contest_indices_for_position(contest_ids, position_id)` — Rust
  (`saksi-auditor/src/lib.rs`, pub(crate)) + Go mirror `contestIndicesForPosition` (`contract.go`),
  prefix `"<position_id>/"`, empty→all. Trailing slash disambiguates pos1 vs pos10 (Go unit-tested).
- Auditor: `ballot.rs` verifies per-position + threads `position_id` to `verify_presentation`;
  `decryption.rs` aggregates per global contest via the helper; `tally.rs` unchanged (already
  iterates contest_ids = P×C).
- Generator: `fixtures::multi_position_fixture(v,p,c)` (one record per (voter,position),
  per-position nullifier, position-qualified contests "pos{p}/cand{k}", ground_truth);
  `demo::election_bundle_json_params` + `validate_population` (fail-closed gate) + `ground_truth`
  in bundle JSON; `saksi-demo gen --voters/--positions/--candidates`.
- Chaincode: SubmitBallot verifies each per-position record against its position's contests;
  rejects unknown position.
- Tests: 25 auditor (incl. multi-position audit, per-position double-vote caught, cross-position
  allowed, 3 gate self-checks), chaincode (helper parity + unknown-position reject), proto golden
  both langs. Green: cargo test workspace / clippy -D / fmt / go test chaincode+sdk / go vet.
- Dry-runs: `gen --voters 4 --positions 3 --candidates 3` → gate passes → audit PASS; **1k population**
  (`--voters 1000 --positions 1 --candidates 2`) generates+validates+audits in ~1.1s (tally 500/500).

Deferred (Phase 7 apps): FFI `derive_nullifier_v2`/`present_credential_v2` now take a `position_id`
arg but the Flutter Dart bindings aren't regenerated; `generate_cds_proof_v2` still contest_id-only.
**Phase 2 (benchmark harness) next.**
