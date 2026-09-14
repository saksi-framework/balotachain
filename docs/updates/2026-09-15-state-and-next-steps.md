# State and next steps — 15 September 2026

Where the thesis work stands, how to pick it up on a different machine, and what is
queued. Written so a fresh checkout (and a fresh Claude Code session) needs nothing
from the machine it was written on.

## Where things stand

| Repo | `main` | Open PRs |
|---|---|---|
| saksi | `2f8bbc9` | #52 wizard: sweep and burst fields, reopen any run, phase timeout (W4c) · #48 study-from-wizard docs, held until #52 lands |
| balotachain | this commit | none |

Landed on 14 and 15 September:

- **Study-grade wizard** (saksi #42 to #49): console auth, campaigns with preflight and
  the ladder, the attack timeline with gate-matched verdicts, network reset and the
  peer-restart fault, resume and verify-only, public board files, `--phase-timeout`,
  the export zip for the cost model.
- **Random DKG dealers** (saksi #50, `1812139`): the generator's election keys are drawn
  from `OsRng`. Runs generated before that commit have keys derivable from the source;
  they support correctness, verifiability and performance, not ballot secrecy
  (`docs/CLAIMS.md`, `docs/manuscript-amendments.md` §10). Wizard docs updated (saksi #51).
- **Dynamic client side** (balotachain #54 to #58): admin, trustee and board web apps
  over the console API, with sign-in.
- **Defense Reviewer Part 5** (balotachain #59): the codebase section, pages 22 to 26 of
  `BalotaChain_Defense_Reviewer.pdf`, built by `docs/defense-reviewer/build.py`.
- **Saksi Execution Trace** (claude.ai artifact, private): one election traced function
  by function at saksi `1812139`.

## Starting on another machine

1. **Clone both repos side by side** (some legacy crates use `../saksi` paths):

   ```
   git clone https://github.com/saksi-framework/saksi
   git clone https://github.com/saksi-framework/balotachain
   ```

2. **Toolchain.** Rust stable (workspace `rust-version` 1.78), Go 1.25 (CI's version;
   `go.mod` needs 1.23), Node 20 with pnpm 9, Python 3 for the cost model. Only to
   rebuild the reviewer PDF: `pip install pymupdf` and Microsoft Edge or Chromium.

3. **Run an election offline** (Windows, macOS or Linux, no Fabric needed):

   ```
   cd saksi
   cargo build --release -p saksi-demo
   cd packages/saksi-campaign && go build ./cmd/saksi-campaign
   ./saksi-campaign serve --demo ../../target/release/saksi-demo
   # open http://127.0.0.1:8090/wizard
   ```

   To serve the BalotaChain apps too: in `balotachain`, `pnpm install` then
   `./tools/build-web.sh` (or `tools/build-web.ps1`), and add
   `--web-dir <path-to>/balotachain/dist-web` to `serve`. The apps appear at `/admin/`,
   `/trustee/` and `/board/`. Add `--auth-file users.json` for sign-in (runbook §4).

4. **Run on-chain** (Linux or WSL2 with Docker): `saksi/tools/up.sh` installs Fabric
   2.5.15, brings up the network, deploys the chaincode and starts the console on
   `127.0.0.1:8090`. For the capstone tiers start it as `SAKSI_PHASE_TIMEOUT=4h
   ./tools/up.sh`. Operator steps: `saksi/docs/research-election-console-runbook.md`.

5. **Tests.** `cargo test --workspace` in saksi; `go test ./...` in
   `saksi/packages/saksi-campaign` (set `SAKSI_DEMO_BIN` to a release `saksi-demo` to
   include the real-binary tests); in balotachain, `pnpm --filter @balotachain/ui build`
   first (the apps import its built output), then `pnpm test`.

## Where the running record lives

- **Ledger for the current plan:** `.superpowers/sdd/2026-09-14-study-grade-wizard/progress.md`,
  with each task's report beside it. The admin-console plan's ledger is in the sibling
  folder.
- **Plans:** `docs/plans/2026-09-14-study-grade-wizard.md`,
  `docs/plans/2026-09-14-admin-console-and-simple-auth.md`.
- **Chapter 4 evidence:** `docs/CLAIMS.md` (what may be claimed and on what evidence),
  `docs/manuscript-amendments.md`, `docs/desktop-runs/` (run notes and `cost_model.py`).
- **Backlog:** `TODOS.md`.
- Claude Code's own memory stays on the machine that wrote it and is not in git; this
  note and the ledger carry what a new session needs.

## Next, in order

1. **Review and merge saksi #52** (W4c).
2. **Rewrite and merge saksi #48.** Its runbook §10 and study checklist still list gaps
   that W4b and W4c closed: the 10,000-voter offline cap, no sweep or burst fields, no way
   to reopen a run, the fixed 60-minute phase timeout, and the export lacking what
   `cost_model.py` reads. Rewrite those paragraphs, and the `<!-- W4b -->` blocks, against
   the merged code.
3. **W6 validation on the desktop** (rebuild the WSL console on `main` first):
   - a wizard SP-1K campaign whose medians match a CLI `--repeat` of the same config
     within 5 %;
   - one on-chain single election with the full attack timeline, each attack refused by
     its declared gate;
   - the campaign export bundle loads in `cost_model.py`;
   - four live checks: a real network reset ends done with `chain_height`; the T3 fault
     on the new build (`window_conn_ready` within 3 minutes, refusals behave); Ctrl-C
     during `down_s` restores the peer; a second `CloseElection` through the real gateway
     answers "is already closed";
   - `go test -race` for the fault, resume and campaign tests under WSL.
4. **balotachain follow-ups:** point the public board's download links at
   `GET /api/board/<run>/files/<name>` (today they hit admin-only `/export/`); teach
   `docs/desktop-runs/cost_model.py` the campaign export layout (`journal.ndjson`,
   `gen-timings.json`, `receipts-lifecycle.csv`).
5. **CLAIMS.md rows still to write:** DKG commitments are not validated as points
   on-chain; reordering is not detected; no chaincode caller authorization
   (a front-running denial of service); the T3 resilience result (no committed ballot
   lost, resume recovered every pending ballot, E = 0); PR #41 confirmed at 10K.
6. **Secrecy evidence** must come from runs at saksi `1812139` or later.
7. **Capstone rows 5 to 9** stay on hold until the researchers decide.

## The desktop environment (Table 3.12)

The measured runs used the Ryzen 7 5700G desktop: Fabric inside WSL2 Ubuntu on Docker
Desktop, whose data disk sits on the NVMe drive. Settings that made the runs valid,
and must not be undone before a measurement session:

- `.wslconfig`: `memory=24GB`, `swap=0`.
- Docker's data disk on the NVMe through a junction; do not change Docker Desktop's
  "Disk image location" in its settings, which errors on the junction.
- Orderer batch parameters: `MaxMessageCount 50`, `BatchTimeout 2s`,
  `PreferredMaxBytes 2 MB`. Keep "Ballots in flight" at or above `MaxMessageCount`, or
  every block waits the batch timeout.
- During a run: no other heavy programs, no sleep, no `wsl --shutdown`, no Docker
  Desktop restart. Preflight's host CPU row catches the first.
