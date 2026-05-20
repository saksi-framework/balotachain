# apps/auditor

Desktop client for the public verifier. This client is the keystone of BalotaChain's end-to-end verifiability story: any party — voter, observer, researcher, journalist — can run it against any closed election and independently confirm the result.

- **Platform:** Tauri v2 (Rust backend + TypeScript front end). Targets macOS, Linux, Windows.
- **Crypto:** linked against the Rust workspace via [`packages/tala-ffi-tauri`](../../packages/tala-ffi-tauri).
- **Initialized by:** [issue #36](https://github.com/tala-blockchain/balotachain/issues/36).

The audit pipeline verifies, for any closed election:

1. Every ballot is well-formed (full CDS NIZK verification per ballot).
2. Every credential presentation is valid under the registrar's published key.
3. Every nullifier is unique within the election (no double-vote).
4. Each trustee's partial decryption verifies under that trustee's published key (Chaum-Pedersen proof of equal discrete logs).
5. The announced tally equals the BSGS recovery of the Lagrange combination of the partials.
6. The announced tally equals the homomorphic sum of the on-chain ballots.

The auditor only needs read access to the bulletin board. No identity, no keys, no privileged credentials.
