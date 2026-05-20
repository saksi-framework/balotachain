# ADR-0002: Monorepo Workspace Layout

## Status

Accepted

## Context

BalotaChain is both an application and a proving ground for the reusable Tala
framework. The repository needs stable locations for application clients,
cryptographic Rust packages, Hyperledger Fabric bulletin board code, shared
TypeScript protocol types, protocol specifications, documentation, and tooling.

The project is still early, so the layout should be explicit without forcing
premature implementation details. It also needs to support Rust, Go, and
TypeScript in the same repository.

## Decision

The repository will use a monorepo layout with these top-level directories:

- `apps/` for deployable applications, starting with `apps/balotachain/`.
- `packages/` for reusable Tala framework packages.
- `packages/tala-crypto/` for Rust cryptographic primitives.
- `packages/tala-credentials/` for Rust anonymous credential code.
- `packages/tala-bulletin/` for Go bulletin board chaincode and clients.
- `packages/tala-protocol/` for shared TypeScript protocol types.
- `spec/` for protocol specifications and threat models.
- `docs/` for developer, operator, and architecture documentation.
- `tools/` for repository scripts and local development helpers.

TypeScript workspaces will use pnpm with Turborepo for orchestration. Rust
packages will be grouped with a Cargo workspace. Go code will start as a module
under `packages/tala-bulletin` and be exposed through a root `go.work` file.

## Consequences

Future work has a predictable place to land, and CI can target each language
without guessing package locations.

Using three language-specific workspace systems adds some coordination overhead,
but it keeps each ecosystem close to its standard tooling while still allowing
root-level commands to orchestrate common tasks.

