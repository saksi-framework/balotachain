# apps/admin

Desktop client for election administrators.

- **Platform:** Tauri v2 (Rust backend + TypeScript front end). Targets macOS, Linux, Windows.
- **Crypto:** linked against the Rust workspace via [`packages/tala-ffi-tauri`](../../packages/tala-ffi-tauri).
- **Initialized by:** [issue #35](https://github.com/tala-blockchain/balotachain/issues/35).

Covers the election lifecycle:

- Election creation (races, options, trustees, threshold, bootstrap method).
- Voter roll import and management.
- Credential issuance under any of the pluggable bootstrap methods: WMSU SSO (OIDC), Student-ID + birthdate lookup, in-person QR token.
- Election open and close orchestration.
- Audit log of every administrative action.
