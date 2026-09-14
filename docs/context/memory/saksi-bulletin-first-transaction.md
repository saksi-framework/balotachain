---
name: saksi-bulletin-first-transaction
description: Saksi bulletin board can run one real transaction (SubmitBallot/GetBallot) on a Fabric network
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

As of 2026-06-10, the Saksi bulletin board has a complete, runnable first
transaction (built in the **saksi** repo, not balotachain — per the user's
"don't create balotachain yet"). Four layers, each its own squash-merged PR:

- **saksi-protocol/go** (#2): hand-written Go codec for the `saksi.protocol.v1`
  wire types, pinned to the Rust `prost` bytes by a golden round-trip test
  against `ballot-v1.hex` (protoc-gen-go supersedes it later).
- **saksi-bulletin/chaincode** (#4, flattened to root `package main` in #8):
  `SmartContract.SubmitBallot` (on-chain checks: version, 32-byte ciphertext
  shape, nullifier presence + uniqueness = no double vote) and `GetBallot`.
  Unit-tested with in-memory fakes; heavy NIZK stays off-chain.
- **saksi-bulletin/client-sdk** (#7): `BulletinClient` (Submit/GetBallot) over a
  fabric-gateway `Contract`, a `Connect` TLS/MSP helper, and a runnable
  `cmd/submit-ballot` CLI.
- **saksi-bulletin/network** (#9): `network.sh` + `run-one-transaction.sh`
  wrapping the fabric-samples **test-network** (minimal one-org now; 5-org
  3-of-5 is a later additive step) + a runbook.

**To actually run it** (needs Docker running + a fabric-samples checkout +
local Go — none required for the code, all verified via CI): from
`packages/saksi-bulletin/network/`: `./network.sh all` then
`./run-one-transaction.sh` then `./network.sh down`.

**CI notes from this work:** bumped Go toolchain 1.22→1.24→1.25 to clear
stdlib advisories (#3, #5), and made **govulncheck advisory**
(continue-on-error) because Fabric's transitive deps (grpc/x.net) carry CVEs
not reachable from first-party code (#6); cargo-audit stays strict. See
[[saksi-go-toolchain-missing]] and [[saksi-balotachain-split]].
