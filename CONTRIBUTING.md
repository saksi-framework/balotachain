# Contributing to BalotaChain

Thanks for helping with BalotaChain and the underlying Saksi framework. This
project is still early research-grade software, so contributions should make the
codebase clearer, safer, and easier to review.

## Goals

- Build an end-to-end verifiable voting application for BalotaChain.
- Grow Saksi as reusable open-source cryptographic infrastructure.
- Keep protocol, implementation, and operational decisions reviewable.
- Favor correctness, auditability, and explicit tradeoffs over speed.

## Non-Goals

- Do not treat the current codebase as production-ready election software.
- Do not add deployment automation before the deployment model is designed.
- Do not merge cryptographic changes without clear references, tests, and
  review context.

## Prerequisites

Use stable toolchains unless a file in the repository pins a narrower version.

- **Node.js** matching `.nvmrc`, with pnpm managed through Corepack. Used by
  the Tauri desktop apps under `apps/trustee`, `apps/admin`, `apps/auditor`.
- **Dart + Flutter** for the mobile voter client under `apps/voter`. Install
  Flutter from <https://docs.flutter.dev/get-started/install>; the Dart SDK
  ships with it.
- **Rust** stable — the Tauri app crates depend on the Saksi framework
  (`saksi-ffi-tauri`) as a Cargo `git` dependency, so building them pulls and
  compiles Saksi.
- **Go** (currently 1.22) — app-side relays import the Saksi bulletin client SDK
  (`github.com/saksi-framework/saksi/packages/saksi-bulletin/client-sdk`).
- **Git** and the **GitHub CLI** for the branch and pull request workflow.

The Saksi cryptographic framework itself is developed in its own repository,
[`saksi-framework/saksi`](https://github.com/saksi-framework/saksi); contribute
framework changes there.

Platform-specific setup notes are in [docs/dev-environment.md](docs/dev-environment.md).

## Bootstrap

From a fresh clone:

```sh
git clone https://github.com/saksi-framework/balotachain.git
cd balotachain
corepack enable
pnpm install
```

The repository is scaffolded before the application clients have real
implementations, so some commands may initially exercise placeholder packages
only. Rust and Go dependencies (the Saksi framework) are fetched on demand when
the app crates that consume them are built.

Flutter setup for `apps/voter/` and Tauri setup for `apps/trustee/`,
`apps/admin/`, `apps/auditor/` are deferred to the respective scaffolding
issues (#31, #33, #35, #36). The bootstrap above does not require Flutter or
Tauri to be installed.

## Test Commands

TypeScript (Tauri apps once they are initialized):

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Rust and Go checks for the cryptographic framework run in the
[Saksi repository](https://github.com/saksi-framework/saksi). In this repository,
Rust and Go are exercised only when an application client that consumes Saksi is
built.

Dart and Flutter (when `apps/voter/` is initialized in issue #31):

```sh
cd apps/voter
dart format --output none --set-exit-if-changed .
flutter analyze
flutter test
```

## Style

- Follow `.editorconfig` for whitespace and line endings.
- Use `cargo fmt` for Rust formatting.
- Use `gofmt` for Go formatting.
- Use Prettier and ESLint for TypeScript and Markdown where configured.
- Use `dart format` for Dart.
- Keep public cryptographic APIs small, documented, and testable.

## Commits

Use Conventional Commits:

```text
feat(crypto): add ElGamal encryption on ristretto255
fix(ci): run cargo clippy on all targets
docs(adr): record workspace layout decision
```

Common scopes include `repo`, `ci`, `docs`, `crypto`, `credentials`,
`bulletin`, `chaincode`, `protocol`, `ffi`, `voter`, `trustee`, `admin`,
`auditor`.

## Branch and Pull Request Workflow

1. Create a topic branch from `main`.
2. Keep each pull request focused on one issue or one coherent change.
3. Link related issues and ADRs in the pull request description.
4. Run the relevant checks before requesting review.
5. Include cryptographic or security notes when the change touches protocols,
   primitives, credentials, trustees, bulletin board behavior, or threat models.
6. Wait for review and required status checks before merge.

## Architectural Changes

Architectural decisions are captured as ADRs in `docs/adr/`. Write or update an
ADR when a change affects long-term structure, protocol choices, security
assumptions, major dependencies, or operational behavior. Start from
`docs/adr/template.md` and follow the process in `docs/adr/README.md`. The
locked baseline is in
[`docs/architecture/2026-05-20-initial-architecture-decisions.md`](docs/architecture/2026-05-20-initial-architecture-decisions.md) —
do not modify that document; supersede it with new ADRs if a decision changes.

## Security Reports

Do not open public issues for vulnerabilities. Follow the private disclosure
process in [SECURITY.md](SECURITY.md).
