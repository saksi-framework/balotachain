# macOS setup — start a Claude Code session here

Bootstrap file for a **fresh Claude Code session on the MacBook**. It carries
the context a new session does not have: where the code lives, what to build, and the handful of things that will waste an hour if
they are not known up front.

Verified before writing: the console cross-builds for `darwin/arm64` and
`darwin/amd64`, and the Rust crates type-check against `aarch64-apple-darwin`.
Nothing in this stack is Windows-bound.

---

## 1. Paste this as the first message

For the **offline** demo (no Docker, works anywhere):

```
Read MACOS-SETUP.md in the repo root, then set this machine up end to end:
verify the toolchains, build both binaries, start the Research Election
Console, and give me the URL. Stop and tell me if any prerequisite is
missing rather than guessing a workaround.
```

For the **full stack including Hyperledger Fabric** (on-chain mode live):

```
Read MACOS-SETUP.md and saksi/docs/onchain-quickstart.md, then bring up
the complete stack on this Mac:

1. Confirm Docker Desktop is running and both repos are cloned as siblings
   under a path with NO SPACES (~/Code/saksi and ~/Code/balotachain).
   fabric-samples breaks on a space and the error will not say so.
2. From ~/Code/saksi run ./tools/up.sh — it installs Fabric if missing,
   starts the network, deploys the chaincode, builds saksi-demo and the
   console, and serves the wizard with on-chain mode enabled. The first
   run pulls ~1GB of Fabric images; that is expected.
3. Verify it is genuinely on-chain, do not assume:
     curl -s localhost:8090/api/capabilities   -> must show "fabric":true
   Then run one election in the wizard with mode = on-chain, 1000 voters,
   3 positions, 12 candidates, distribution = realistic, 3 senate seats,
   3 trustees with threshold 2.
4. Confirm the Encrypt step shows real ledger receipts (block number, tx
   id, block hash), that /trail/ lists the election as on chain, and that
   Verify ends with E = 0.
5. Report exactly what worked and what did not. If ./tools/up.sh fails,
   read its error — it is written to say what to do — and fix the cause
   rather than working around it. Do not fall back to offline mode
   silently; on-chain mode failing is a result I need to know about.

Useful: ./tools/up.sh status says whether on-chain is actually enabled,
and ./tools/up.sh down stops the network.
```

That is the whole bootstrap. Everything below is what the session reads.

---

## 2. Everything is on `main`

Both repos have been fast-forwarded, so `main` carries all of it: the wizard,
the trustee ceremony, the validation gate, the ground-truth export, the paper
PDF, and every document referenced here. No feature branch to hunt for and
nothing left unpushed.

On an existing clone, one command is enough:

```bash
git checkout main && git pull origin main
```

---

## 3. Repository layout

Two repos, cloned as **siblings**. `balotachain` expects to find `saksi` at
`../saksi`, so the directory names matter.

```
~/Code/
├── saksi/         branch: main    <- crypto, chaincode, console
└── balotachain/   branch: main    <- thesis repo, apps, docs
```

```bash
mkdir -p ~/Code && cd ~/Code
git clone https://github.com/saksi-framework/saksi.git
git clone https://github.com/saksi-framework/balotachain.git
```

The thing being demonstrated — the **Research Election Console** — lives in
`saksi/packages/saksi-campaign`. `balotachain` holds the manuscript, the four
client apps, and the mirrored documentation under `docs/saksi/`.

## 4. Prerequisites

| Need | Minimum | Why |
|---|---|---|
| Rust | stable, >= 1.78 | `rust-toolchain.toml` pins `stable`; workspace sets `rust-version = "1.78"` |
| Go | >= 1.23 | `packages/saksi-campaign/go.mod` declares `go 1.23` |
| Xcode CLT | any | supplies the linker the Rust build needs |
| Python 3 | any | only to run the reference generator; macOS ships it |

```bash
xcode-select --install                                        # skip if Xcode present
brew install go
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Check: `rustc --version && cargo --version && go version`

**`protoc` is not required.** The build pulls `protoc-bin-vendored`, which
ships an Apple Silicon binary and is selected automatically by
`packages/saksi-protocol/rust/build.rs`. Do not `brew install protobuf` — a
system protoc is unused and only adds a version to disagree about.

**Docker is not required** for the offline path. It is only needed for a local
Fabric network, which is not what this machine is for (see section 8).

## 5. Build

```bash
cd ~/Code/saksi

cargo build -p saksi-demo --release          # -> target/release/saksi-demo

cd packages/saksi-campaign
go build -o saksi-campaign ./cmd/saksi-campaign
```

The first Rust build compiles the whole crypto stack and takes a few minutes.
Later builds are incremental.

## 6. Run

```bash
cd ~/Code/saksi/packages/saksi-campaign
./saksi-campaign serve \
  --addr 127.0.0.1:8090 \
  --demo ../../target/release/saksi-demo \
  --runs ~/.saksi/campaign/runs
```

It prints its URL. Two pages:

- `http://127.0.0.1:8090/` — the original single-page console.
- `http://127.0.0.1:8090/wizard` — the **guided wizard**: Set up -> Ballots ->
  Check -> Encrypt -> Trustees -> Verify. This is the presentation surface.

The bind is loopback, so open it in a browser on the Mac itself. To drive a
projector from another machine, bind `0.0.0.0` and add `--allow-host <name>`.

## 7. Confirm it actually works

Two checks. The first proves the toolchain; the second proves the demo path.

```bash
# 1 - tests
cd ~/Code/saksi
cargo test -p saksi-auditor -p saksi-demo
cd packages/saksi-campaign && go test ./...
```

```bash
# 2 - generate a population with no cryptography, then read it
cd ~/Code/saksi
./target/release/saksi-demo gen-ground-truth \
  --voters 1000 --positions 3 --candidates 4 \
  --distribution skewed --election-id smoke \
  --out-dir /tmp/gt

head -3 /tmp/gt/ground-truth-ballots.csv
cat /tmp/gt/ground-truth-summary.csv
```

Every position's counts must total 1000. The skewed profile gives candidate 0
exactly half — 500 — because every even-numbered voter picks it.

Independent cross-check, no Rust involved:

```bash
cd ~/Code/balotachain/docs/saksi
python3 reference_generator.py --voters 1000 --positions 3 \
  --candidates 4 --distribution skewed --out-dir /tmp/py
diff /tmp/py/ground-truth-ballots.csv /tmp/gt/ground-truth-ballots.csv   # silent
```

A silent `diff` is the point: the Python reference and the Rust generator agree
byte for byte, so a published ground-truth table can be verified by anyone
without this repository.

## 8. On-chain mode — what this machine is and is not

The Mac is the **client**. It runs the cryptography and the console. It does
not host the Fabric network; a separate desktop does, matching the split the
manuscript describes.

- **Offline** and **ground-truth** modes are fully self-contained here. They
  need no network and no Docker. Everything needed for the presentation works
  in offline mode.
- **On-chain** mode needs a Fabric network. There is now a one-command path
  that brings the whole stack up locally:

  ```bash
  cd ~/Code/saksi
  ./tools/up.sh
  ```

  It installs Fabric if missing, starts the network, deploys the chaincode,
  builds both binaries, and runs the console wired to the ledger — then prints
  the URL with on-chain mode enabled. `./tools/up.sh down` stops it;
  `./tools/up.sh status` says whether on-chain is actually live.

  Full detail, including how to verify a record really is on the ledger:
  `saksi/docs/onchain-quickstart.md` (mirrored at
  `docs/saksi/onchain-quickstart.md`).

  Two requirements it checks for you: **Docker must be running**, and the repo
  path must contain **no spaces** — `fabric-samples` breaks on a space, which is
  exactly why the Windows box cannot run Fabric locally. `~/Code/saksi` is fine.

  Alternatively point the console at a Fabric peer hosted elsewhere with
  `--fabric-peer`, `--fabric-cert`, `--fabric-key` and `--fabric-tls-cert`.

Everything demonstrable works in **offline** mode with no Docker at all, so
bringing Fabric up is optional rather than a prerequisite for the demo.

## 9. Things that will cost an hour if unknown

1. **Do not regenerate the bundle mid-ceremony.** `saksi-demo gen` draws from
   `OsRng`, so a second run produces *different* trustee shares, and
   `CreateElection` would then also reject the election as a duplicate. The
   ceremony generates once at `/ceremony/start` and reads the cached
   `bundle.json` for every later click. Any change here must preserve that.
2. **The threshold gate is enforced by the console, not the chaincode.**
   `PublishTally` does not count partial decryptions on-chain. The *t*-of-*n*
   property is verified at audit time by the independent auditor's Lagrange
   interpolation over the submitted subset. The UI is worded to say this
   accurately — do not "fix" the wording into implying the ledger refuses.
3. **The published tally does not depend on which partials were submitted.**
   The ceremony gates *publication*; it does not recompute the tally from the
   clicked shares. The UI must not imply otherwise.
4. **Ground-truth mode produces no ciphertexts**, so the Encrypt, Trustees, and
   Verify steps do not apply and the server correctly answers 409 for them.
5. **Line endings are already handled** by `.gitattributes` (`eol=lf`). If a
   shell script ever fails with `bad interpreter: ^M`, the checkout is wrong,
   not the script.

## 10. Where the documentation is

Under `balotachain/docs/saksi/` — mirrored from `saksi/docs/`, which is
canonical. Edit there, then re-copy; edits made in the mirror are overwritten
and never reach the code they describe.

| File | What it answers |
|---|---|
| `research-election-console-runbook.md` | Building and running the console; every flag |
| `synthetic-data-generation.md` | How populations are produced; output schemas; the validation gate |
| `selection-rule-explained.md` | The selection rule line by line, with traced values |
| `rust-python-cross-reference.md` | The same rule in both languages, side by side |
| `reference_generator.py` | Runnable; reproduces any published table without Rust |

Read `balotachain/CLAUDE.md` as well — it holds the locked architectural
decisions and the current project state.

## 11. Open work, if the session asks what is next

- Appendix A and B manuscript edits are drafted but not applied. Prompts are at
  `docs/appendix-a-change-prompt.md`, `docs/appendix-b-change-prompt.md`, and
  `docs/appendix-a-replacement-draft.md`. The sample values in the Appendix A
  draft predate the last selection-rule change and should be regenerated before
  the appendix is pasted in.
- PRs #33/#34 (saksi) and #52 (balotachain) are closed; their content landed
  on `main` directly and was never formally reviewed.
- The wizard has been walked end to end in **offline** mode only. The on-chain
  walkthrough against the Fabric host has not been done.
