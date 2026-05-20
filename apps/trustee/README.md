# apps/trustee

Desktop client for trustees.

- **Platform:** Tauri v2 (Rust backend + TypeScript front end). Targets macOS, Linux, Windows.
- **Crypto:** linked against the Rust workspace via [`packages/tala-ffi-tauri`](../../packages/tala-ffi-tauri).
- **Initialized by:** [issue #33](https://github.com/tala-blockchain/balotachain/issues/33).

The trustee app drives two ceremonies:

1. **Pedersen distributed key generation** (issue #11) at election setup — the trustee participates with the other four in producing the joint ElGamal public key without anyone holding the master secret.
2. **Threshold decryption** (issue #12, UI in issue #34) at election close — three of the five trustees co-decrypt the homomorphic tally with Chaum-Pedersen proofs of correct partial decryption.

The trustee's private share is sealed at rest by the device passcode and never leaves the machine.
