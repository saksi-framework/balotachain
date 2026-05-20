# tala-ffi-flutter

Rust → Dart FFI bridge for the voter app, via [`flutter_rust_bridge`](https://github.com/fzyzcjy/flutter_rust_bridge).

**Status:** empty skeleton. Bridge wiring + codegen + Android / iOS build pipelines land in issue [#8](https://github.com/tala-blockchain/balotachain/issues/8).

## What it exposes

The voter app needs Rust functions for: encrypt a ballot, generate a CDS well-formedness proof, run the device side of a Benaloh challenge, derive a nullifier, present a credential, and verify a tracking-code receipt. Every one of those functions lives in [`tala-crypto`](../tala-crypto/) or [`tala-credentials`](../tala-credentials/); this crate is the thin glue layer that exposes them to Dart.

Build artifacts target Android (`.so` per ABI) and iOS (`.a` / xcframework).
