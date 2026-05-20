# tala-ffi-tauri

Rust → TypeScript bridge for the trustee, admin, and auditor desktop apps. The Rust functions in [`tala-crypto`](../tala-crypto/), [`tala-credentials`](../tala-credentials/), and [`tala-protocol`](../tala-protocol/) are surfaced as Tauri commands and called from each app's TypeScript front end.

**Status:** empty skeleton. Command surface, TypeScript type emission (via `specta` or `ts-rs`), and per-app integration land in issue [#8](https://github.com/tala-blockchain/balotachain/issues/8).
