# apps/voter

Mobile voter client for BalotaChain.

- **Platform:** Flutter (iOS + Android), Dart.
- **Crypto:** linked against the Rust workspace via [`packages/tala-ffi-flutter`](../../packages/tala-ffi-flutter) using `flutter_rust_bridge`.
- **Initialized by:** [issue #31](https://github.com/tala-blockchain/balotachain/issues/31) — `flutter create` happens there.
- **Cast flow + Benaloh challenge UX:** [issue #32](https://github.com/tala-blockchain/balotachain/issues/32).

All cryptographic operations (encryption, CDS well-formedness proof, Benaloh randomness commitment, credential presentation, nullifier derivation) execute on-device against the Rust core. The voter device never sends a plaintext ballot, randomness, or credential secret over the network.
