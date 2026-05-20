//! # tala-crypto
//!
//! Cryptographic primitives for the Tala framework over the ristretto255 prime-order group.
//!
//! This crate is currently an **empty skeleton**. The primitives land in their own issues
//! and pull requests:
//!
//! | Primitive | Issue |
//! |---|---|
//! | ElGamal encryption | [#10](https://github.com/tala-blockchain/balotachain/issues/10) |
//! | Pedersen distributed key generation | [#11](https://github.com/tala-blockchain/balotachain/issues/11) |
//! | Threshold decryption | [#12](https://github.com/tala-blockchain/balotachain/issues/12) |
//! | Chaum-Pedersen NIZK | [#13](https://github.com/tala-blockchain/balotachain/issues/13) |
//! | CDS OR proof | [#14](https://github.com/tala-blockchain/balotachain/issues/14) |
//! | Pedersen commitments | [#15](https://github.com/tala-blockchain/balotachain/issues/15) |
//! | Benaloh challenge | [#16](https://github.com/tala-blockchain/balotachain/issues/16) |
//!
//! ## Conventions
//!
//! - All scalar arithmetic uses [`curve25519_dalek::scalar::Scalar`]; all group elements use
//!   [`curve25519_dalek::ristretto::RistrettoPoint`].
//! - Fiat-Shamir transcripts use [`merlin::Transcript`] with domain-separated labels documented
//!   on each prover and verifier API.
//! - Constant-time comparisons use the [`subtle`] crate; secret material is zeroized on drop
//!   via the [`zeroize`] crate.
//! - Serialization uses [`serde`] with the canonical encoding defined in
//!   [`tala-protocol`](https://github.com/tala-blockchain/balotachain/tree/main/packages/tala-protocol).

#![forbid(unsafe_code)]
#![warn(missing_docs)]
