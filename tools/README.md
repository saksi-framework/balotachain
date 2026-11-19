# tools

Repository-local scripts, code generators, and developer tooling for BalotaChain.

Contents accumulate as the project develops. Likely future occupants:

- `bootstrap.sh` / `bootstrap.ps1` — toolchain installation helper (issue #3).
- Benchmark harness for crypto primitives.
- Scaling simulator for evaluating the bulletin board under SK / citywide / national load.
- Codegen scripts if `saksi-protocol` ends up Protocol-Buffers-defined.

Anything that runs at build, test, or release time and is not a package in its own right belongs here.

- `demo-up.sh` — one command to bring the defense demo up from a clean network (reset, web build, serve, seed an MP-1K election); `demo-record.md` — the screen-recording checklist and fallback order.
- Live election demo kit (the defense's live election on the MacBook; see `docs/live-demo/README.md`):
  - `live-accounts.sh`: makes the admin and trustee accounts (no voter accounts: voters check in from the precinct's voter list) and the trustee tokens in the state folder (`~/.balotachain-live`), and a password handout it never prints.
  - `live-dns.sh`: points `vote` and `t1` to `t5` under the domain at this Mac's hotspot address through the Cloudflare API (`--dry-run`, `--check`, `--remove`).
  - `live-up.sh`: checks Docker, the certificate, the running Fabric network, binaries, accounts, names and ports, then starts the console and the five trustee processes (`up`, `down`, `status`, `--build`). It never starts or stops Fabric.
  - `live-reset.sh`: stops the kit and moves the runs and trustee folders into the state folder's archive for a clean second run.
  - `live-lib.sh`: helpers the four scripts share.
