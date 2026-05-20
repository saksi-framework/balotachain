# Developer Environment

This guide describes the local setup expected for BalotaChain contributors. The
project is in early scaffold form, so install the toolchains now and expect more
package-specific commands to appear as implementation work lands.

## Version Policy

- **Rust:** stable. The MSRV is declared in `rust-toolchain.toml`.
- **Go:** the version declared by `packages/tala-bulletin/chaincode/go.mod`,
  `packages/tala-bulletin/client-sdk/go.mod`, and
  `packages/tala-protocol/go/go.mod` (currently 1.22). Used only inside those
  modules.
- **Node.js:** the version declared in `.nvmrc`.
- **pnpm:** the `packageManager` field in `package.json`, through Corepack.
- **Dart and Flutter:** Flutter stable. The voter app under `apps/voter/`
  targets iOS and Android.
- **Docker:** Docker Desktop or Docker Engine capable of running Hyperledger
  Fabric containers, for the local Fabric network in
  `packages/tala-bulletin/network/`.

## macOS

Install system tools:

```sh
xcode-select --install
brew install git gh node rustup go docker
rustup toolchain install stable
corepack enable

# Flutter (mobile voter client). Tap the cask, then run `flutter doctor`.
brew install --cask flutter
flutter doctor
```

Docker Desktop is the simplest path for local Fabric work. Start Docker before
running any Fabric scripts.

## Linux

Install common prerequisites with your distribution package manager:

```sh
sudo apt-get update
sudo apt-get install -y build-essential curl git pkg-config libssl-dev
```

Install Rust with rustup, Node.js with your preferred version manager, and Go
from your package manager or the official tarball. Enable pnpm through Corepack:

```sh
rustup toolchain install stable
corepack enable
```

Install Flutter following the official guide for Linux at
<https://docs.flutter.dev/get-started/install/linux>, then run `flutter
doctor`.

For Docker:

```sh
sudo usermod -aG docker "$USER"
```

Log out and back in after changing Docker group membership.

## Windows

Use WSL2 for development unless a future Windows-specific Tauri or Flutter task
requires native Windows tooling.

1. Install WSL2 with Ubuntu.
2. Install Docker Desktop and enable WSL integration.
3. Inside the WSL distribution install: Rust (rustup), Go, Node.js (with a
   version manager), pnpm through Corepack, Git, and the GitHub CLI.
4. Install Flutter for Linux inside WSL, or install Flutter on the native
   Windows host if you intend to run Android emulators or build Windows Tauri
   binaries.
5. Clone the repository inside the Linux filesystem, not under `/mnt/c`, for
   better file watching and build performance.

## Bootstrap Check

After cloning:

```sh
corepack enable
pnpm install
cargo check --workspace
for d in packages/tala-bulletin/chaincode packages/tala-bulletin/client-sdk packages/tala-protocol/go; do
  (cd "$d" && go build ./...)
done
```

If a toolchain is missing, run the bootstrap helper for a checklist:

```sh
./tools/bootstrap.sh
```

On Windows PowerShell:

```powershell
.\tools\bootstrap.ps1
```

## Tauri Prerequisites

The trustee, admin, and auditor desktop apps under `apps/trustee/`,
`apps/admin/`, and `apps/auditor/` are not yet scaffolded (issues #33, #35,
#36). When that work starts, install the platform prerequisites before building:

- **macOS:** Xcode command line tools and WebKit dependencies provided by Tauri.
- **Linux:** WebKitGTK, OpenSSL, libappindicator, librsvg, and the
  build-essential packages required by Tauri.
- **Windows:** Microsoft C++ Build Tools and WebView2.

Refer to <https://tauri.app/v2/guides/getting-started/prerequisites/> for the
authoritative list.

## Flutter Prerequisites

The voter app under `apps/voter/` is not yet scaffolded (issue #31). When that
work starts:

- Install the Flutter SDK and run `flutter doctor` to resolve any missing
  pieces.
- For Android development, install Android Studio and an Android SDK with the
  emulator, or use a physical device with USB debugging enabled.
- For iOS development on macOS, install the latest Xcode plus CocoaPods.
- The voter app links the Rust crypto core through
  `packages/tala-ffi-flutter/` via
  [`flutter_rust_bridge`](https://github.com/fzyzcjy/flutter_rust_bridge).

## Hyperledger Fabric Local Network

The bulletin board uses Hyperledger Fabric. Until the local network scripts
exist (issue #26), prepare:

- Docker and Docker Compose.
- Fabric binaries and images matching the chosen Fabric release.
- A local workspace for chaincode package, install, approve, and commit flows.

The dev network targets five trustee organizations (`Org1`..`Org5`), one peer
each, matching the 3-of-5 threshold default declared in the architecture.

Expected future workflow once issue #26 lands:

```sh
cd packages/tala-bulletin/network
./network.sh up
./network.sh deployCC
./network.sh down
```

## Editor Configuration

Recommended editor support:

- EditorConfig support for whitespace rules.
- rust-analyzer for Rust.
- Go extension or gopls for Go.
- ESLint, Prettier, and TypeScript language service for TypeScript.
- Dart and Flutter extensions for the voter client.
- Markdown linting for docs and ADRs.

Prefer repository settings over personal defaults when they differ.
