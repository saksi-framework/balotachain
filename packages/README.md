# Tala framework packages

The Tala framework lives under `packages/`. These packages are the reusable cryptographic and bulletin-board substrate that BalotaChain (under [`../apps/`](../apps/)) is built on. Future verifiable systems written in the Philippine open-source community can reuse the same packages.

| Package | Language | Purpose | Lead issue |
|---|---|---|---|
| [`tala-crypto/`](tala-crypto/) | Rust | ElGamal threshold encryption, Pedersen DKG, Chaum-Pedersen and CDS NIZKs, Pedersen commitments, Benaloh challenge primitive | #9 + #10..#16 |
| [`tala-credentials/`](tala-credentials/) | Rust | Blind-signature anonymous credentials on ristretto255, presentation NIZK, deterministic nullifier | #18, #19 |
| [`tala-protocol/`](tala-protocol/) | Rust types + Go mirror | Canonical wire types and serialization shared between the crypto stack and the Fabric chaincode | #7 |
| [`tala-bulletin/`](tala-bulletin/) | Go | Hyperledger Fabric chaincode (`chaincode/`), development Fabric network (`network/`), and a Go client SDK wrapping `fabric-gateway` (`client-sdk/`) | #25, #26, #27, #28, #29, #30 |
| [`tala-ffi-flutter/`](tala-ffi-flutter/) | Rust | FFI bridge from `tala-crypto` + `tala-credentials` + `tala-protocol` to Dart, via `flutter_rust_bridge`, consumed by [`apps/voter/`](../apps/voter/) | #8 |
| [`tala-ffi-tauri/`](tala-ffi-tauri/) | Rust | FFI bridge to TypeScript, exposed as Tauri commands, consumed by the trustee, admin, and auditor apps | #8 |

The Rust crates are members of the root [Cargo workspace](../Cargo.toml). The Go modules under `tala-bulletin/` and `tala-protocol/go/` are package-local — Go has no monorepo-wide workspace mechanism that fits the chaincode build constraints.
