# BalotaChain

[![CI](https://github.com/saksi-framework/balotachain/actions/workflows/ci.yml/badge.svg)](https://github.com/saksi-framework/balotachain/actions/workflows/ci.yml)

*End-to-end verifiable cryptographic voting on the Saksi framework.*

## Project Status

BalotaChain is a research project under active development by the author as part of an undergraduate thesis at the College of Computing Studies, Western Mindanao State University. The project is in early development and most components are not yet implemented. This repository will be built up incrementally as the work progresses.

## What is BalotaChain

BalotaChain is an end-to-end verifiable cryptographic voting application. It is designed to give every voter direct, mathematical assurance that an election was conducted honestly, without requiring trust in any single party — including the election administrators, the device used to cast a ballot, or the operators of the underlying infrastructure. The initial deployment target is student council elections at Western Mindanao State University, with the architecture evaluated through simulation against larger scales such as Sangguniang Kabataan and national elections.

The system provides three verifiability properties to every voter. *Cast-as-intended* lets a voter confirm that the device encrypted the choice they actually made, using a Benaloh challenge before the ballot is committed. *Recorded-as-cast* lets a voter confirm that their encrypted ballot was published on the bulletin board, using a per-ballot tracking code. *Counted-as-recorded* lets any participant — voter, observer, or auditor — independently re-derive the announced tally from the on-chain ballots and verify the threshold decryption proof. Together these properties allow the integrity of an election to be checked end-to-end by anyone, without disclosing any individual vote.

## What is Saksi

Saksi is the open-source cryptographic application framework on which BalotaChain is built. It composes ElGamal threshold encryption with Pedersen distributed key generation, Chaum-Pedersen and Cramer-Damgård-Schoenmakers zero-knowledge proofs, anonymous credentials, commitment schemes, and a Hyperledger Fabric chaincode bulletin board operated by mutually-independent trustee nodes. The framework is designed so that no single party — and no proper subset of trustees below the threshold — can decrypt individual ballots, forge votes, or tamper with the recorded ledger.

The relationship between the two projects is intentional: BalotaChain is one verifiable application built on top of Saksi, and Saksi is intended to outlive it as reusable Philippine open-source cryptographic infrastructure. Future Filipino developers and researchers will be able to build their own verifiable systems — beyond elections — on the same primitives. In this repository the framework lives under `packages/saksi-*` and the application clients under `apps/{voter,trustee,admin,auditor}`; the Saksi framework will be extracted into its own repository so it can be consumed independently.

## License

BalotaChain is released under the Apache License 2.0. See [LICENSE](LICENSE).

## Security

For responsible disclosure of security vulnerabilities, see [SECURITY.md](SECURITY.md). The project has not undergone a third-party security audit.

## Author

Vaniel John Cornelio — BSCS-3A, College of Computing Studies, Western Mindanao State University.
