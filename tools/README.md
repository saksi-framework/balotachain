# tools

Repository-local scripts, code generators, and developer tooling for BalotaChain.

Contents accumulate as the project develops. Likely future occupants:

- `bootstrap.sh` / `bootstrap.ps1` — toolchain installation helper (issue #3).
- Benchmark harness for crypto primitives.
- Scaling simulator for evaluating the bulletin board under SK / citywide / national load.
- Codegen scripts if `tala-protocol` ends up Protocol-Buffers-defined.

Anything that runs at build, test, or release time and is not a package in its own right belongs here.
