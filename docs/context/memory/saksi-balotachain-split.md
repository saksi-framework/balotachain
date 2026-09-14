---
name: saksi-balotachain-split
description: State of the Tala→Saksi rename and the BalotaChain/Saksi two-repo split
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
---

As of 2026-06-10, the framework was renamed **Tala → Saksi** and split into two
repos under the new GitHub org **`saksi-framework`**:

- **`github.com/saksi-framework/saksi`** — the standalone framework (Cargo
  workspace `saksi-crypto`, `saksi-credentials`, `saksi-protocol`,
  `saksi-bulletin`, `saksi-ffi-flutter`, `saksi-ffi-tauri`; mirrored Go modules;
  proto + test-vectors). CI green (Rust + Go).
- **`github.com/saksi-framework/balotachain`** — the voting **application**
  (`apps/{voter,trustee,admin,auditor}`, all still README-only). The framework
  was removed; the empty Rust workspace was deleted; CI is Node/Tauri-only.
  BalotaChain consumes Saksi as a **Cargo `git` dependency** (Tauri),
  `flutter_rust_bridge` (Flutter), and a Go module import (bulletin SDK).

The old `tala-blockchain/balotachain` repo was transferred into `saksi-framework`
via `gh api -X POST repos/.../transfer`. Decisions recorded in **ADR-0002**.

**Phase 2 (wire-identity migration) — DONE** (saksi PR #1, merged 2026-06-10).
All `tala.*` wire tokens flipped to `saksi.*`: 7 transcript labels + 6 FFI
labels, proto package `saksi.protocol.v1` (dir moved to `proto/saksi/protocol/v1/`),
domain-hash `b"saksi-protocol-v1"`, prost include path. **Key finding:**
`ballot-v1.hex` did NOT need regeneration — protobuf wire bytes are independent
of the package name, so the golden vector is byte-identical and its stability
test still passes on both Rust and Go. The breaking part is only the
Fiat-Shamir/domain-hash digests (NIZK proofs + FFI digests), not the message
encoding. The only `tala` string left in the saksi repo is ADR-0002's history.

The whole effort (rename + split + wire migration) is complete.

**Working constraints on this machine (as of 2026-06-10; superseded):** `cargo` is available, **`go` is NOT
installed** (Go changes verified via CI only). UPDATED 2026-09-15: Go, cargo, Docker and pnpm all work locally; saksi PRs now merge with merge commits, balotachain is squash-only (see [[merge-approval]]). A local clone of the saksi repo
sits at `Q:\Code - LAPTOP\Code\projects\saksi`. The repo allows **squash merges
only** (no rebase/merge-commit). See [[saksi-go-toolchain-missing]].
