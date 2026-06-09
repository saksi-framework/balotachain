# Saksi framework packages

The Saksi framework lives under `packages/`. These packages are the reusable cryptographic and bulletin-board substrate that BalotaChain (under [`../apps/`](../apps/)) is built on. Future verifiable systems written in the Philippine open-source community can reuse the same packages.

| Package | Language | Purpose | Lead issue |
|---|---|---|---|
| [`saksi-crypto/`](saksi-crypto/) | Rust | ElGamal threshold encryption, Pedersen DKG, Chaum-Pedersen and CDS NIZKs, Pedersen commitments, Benaloh challenge primitive | #9 + #10..#16 |
| [`saksi-credentials/`](saksi-credentials/) | Rust | Blind-signature anonymous credentials on ristretto255, presentation NIZK, deterministic nullifier | #18, #19 |
| [`saksi-protocol/`](saksi-protocol/) | Rust types + Go mirror | Canonical wire types and serialization shared between the crypto stack and the Fabric chaincode | #7 |
| [`saksi-bulletin/`](saksi-bulletin/) | Go | Hyperledger Fabric chaincode (`chaincode/`), development Fabric network (`network/`), and a Go client SDK wrapping `fabric-gateway` (`client-sdk/`) | #25, #26, #27, #28, #29, #30 |
| [`saksi-ffi-flutter/`](saksi-ffi-flutter/) | Rust | FFI bridge from `saksi-crypto` + `saksi-credentials` + `saksi-protocol` to Dart, via `flutter_rust_bridge`, consumed by [`apps/voter/`](../apps/voter/) | #8 |
| [`saksi-ffi-tauri/`](saksi-ffi-tauri/) | Rust | FFI bridge to TypeScript, exposed as Tauri commands, consumed by the trustee, admin, and auditor apps | #8 |

The Rust crates are members of the root [Cargo workspace](../Cargo.toml). The Go modules under `saksi-bulletin/` and `saksi-protocol/go/` are package-local — Go has no monorepo-wide workspace mechanism that fits the chaincode build constraints.
