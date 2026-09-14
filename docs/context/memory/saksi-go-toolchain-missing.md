---
name: saksi-go-toolchain-missing
description: Toolchain availability on the primary Windows dev box (Go now present — earlier "no Go" note is stale)
metadata:
  node_type: memory
  type: reference
  originSessionId: 9d759c4f-3041-4dac-8a74-0340156e6d99
  modified: 2026-08-10T14:50:04.318Z
---

TWO WINDOWS PROFILES (learned 2026-07-21 the hard way): this box has a `corne` profile AND a
`User` profile. The repos (`Q:\Code - LAPTOP\...`) are owned by `corne`'s SID, and the FULL
toolchain (rust+msvc, go1.26.4, docker, node, pnpm) lives under `corne`. A session that resumes/
starts as `User` has ONLY node/git/gh/docker — no cargo/go/pnpm, and `git` throws "dubious
ownership". Two fixes: (A) run the session as `corne` (everything works, correct repo identity);
(B) install under `User`: rustup + go via winget, THEN Visual Studio 2022 Build Tools with the
`Microsoft.VisualStudio.Workload.VCTools --includeRecommended` workload (provides `link.exe` +
Windows SDK — the msvc target `rust-toolchain.toml` pins needs it; the gnu toolchain is NOT a
shortcut, it needs MinGW `dlltool`). After a `User` install, cargo is at
`C:\Users\User\.cargo\bin\cargo.exe`; the Bash/PowerShell tool PATH won't include it, so prepend
`$env:Path = "C:\Users\User\.cargo\bin;C:\Program Files\Go\bin;$env:Path"` and run
`git config --global --add safe.directory <repo>` for both repos.

UPDATED 2026-06-14 (holds under `corne`): the box HAS Go (`go1.26.4 windows/amd64`),
Docker 29.5.3, Docker Compose v5.1.4, cargo/rust, node (v25), pnpm — Go + Docker changes
(e.g. `saksi-protocol/go`, `saksi-bulletin`, chaincode, containerized backend) can be built and
tested locally. Always verify with `go version` / `cargo --version` before relying on this.

CAVEAT (Flutter): the box has Dart 3.9.2 / an older Flutter, but `apps/voter` pubspec requires
Dart `^3.11.4` (Flutter 3.44.2). So `flutter pub get` / `flutter test` for the voter app FAIL
here ("version solving failed"). Voter Flutter changes can't be verified on this box — verify on
the device with Flutter 3.44.2 or in CI. Rust, Go, Docker, Node/pnpm all fine locally.
CAVEAT (Fabric path space): the projects live under `Q:\Code - LAPTOP\...` — the SPACE in
"Code - LAPTOP" breaks Hyperledger Fabric's `fabric-samples` test-network scripts (e.g.
`. /q/Code - LAPTOP/...` → ". : /q/Code: is a directory", `fatalln/println/createConfigUpdate:
command not found`, MSP material never generated). The saksi chaincode vendors + `go build`s fine;
only the network bring-up fails. To run real Fabric locally, use a SPACE-FREE path (copy repos to
e.g. `C:\balota\`) or run in WSL2 / the devcontainer (Linux `/workspaces` paths). Fabric binaries
present at `fabric-samples/bin/*.exe`, images 2.5.15 pulled. Related: [[saksi-balotachain-split]],
[[balotachain-ui-demo-plan]].
