# spec

Protocol specifications, threat model, and formal protocol descriptions for BalotaChain and the Tala framework.

Contents will accumulate as the project develops. Initial focus:

- Formal description of the voting protocol (ballot encoding, encryption, CDS proofs, credential presentation, nullifier derivation, threshold decryption, tally).
- Threat model and trust assumptions, including the trust each role places in which party.
- End-to-end verifiability analysis (cast-as-intended, recorded-as-cast, counted-as-recorded).
- Parameter choices and their justifications.

Architecture decisions live in [`../docs/architecture/`](../docs/architecture/) and individual ADRs in [`../docs/adr/`](../docs/adr/). This directory is for cryptographic protocol artifacts, not engineering decisions.
