# Project context for new devices and new sessions

Claude Code keeps its memory under `~/.claude` on the machine that wrote it, so a
session on another device starts without it. This folder carries that context in the
repository.

Read in this order:

1. [`standing-rules.md`](standing-rules.md): the decisions and working rules that still
   apply, including what needs the user's approval.
2. [`../updates/2026-09-15-state-and-next-steps.md`](../updates/2026-09-15-state-and-next-steps.md):
   where both repos stand, how to build and run them, and the ordered next steps.
3. [`memory/MEMORY.md`](memory/MEMORY.md): the memory index. "Current" notes describe
   the project as it is; "History" notes were true when written.
4. The ledger of the active plan: `.superpowers/sdd/2026-09-14-study-grade-wizard/progress.md`.

## What is here

| Path | What it is |
|---|---|
| `standing-rules.md` | Approvals, commit conventions, claims discipline, environment do-nots, tool quirks |
| `memory/` | A copy of the Claude Code memory notes for this project (a LAN address redacted) |
| `restore-memory.sh`, `restore-memory.ps1` | Install `memory/` into this device's Claude Code memory for this checkout |
| `sync-memory.sh` | From the machine whose memory is newer: copy it back into `memory/` |
| `tooling/ban-init/` | The `/ban-init` skill the project's `CLAUDE.md` refers to |
| `execution-trace/` | Sources of the "Saksi Execution Trace" page, so it can be rebuilt anywhere |

## On a new device

1. Clone `saksi` and `balotachain` side by side (see the state note).
2. Restore the memory, from the balotachain checkout:

   ```bash
   bash docs/context/restore-memory.sh          # macOS, Linux, Git Bash
   ```

   ```powershell
   powershell -ExecutionPolicy Bypass -File docs/context/restore-memory.ps1   # Windows
   ```

   Claude Code stores a project's memory under `~/.claude/projects/<path>/memory/`,
   where `<path>` is the checkout's absolute path with every character that is not a
   letter or digit replaced by `-`. The scripts compute it from the checkout they are
   run in and never overwrite a newer file there.

3. Install the workflow skill once per device:

   ```bash
   mkdir -p ~/.claude/skills && cp -r docs/context/tooling/ban-init ~/.claude/skills/
   ```

   `/ban-init` also expects the `superpowers` plugin (and uses `caveman` if present).
   The agent definitions it installs are already committed under `.claude/agents/`.

## Keeping it current

After a session changes memory on one machine, run `bash docs/context/sync-memory.sh`
there, review the diff, and open a PR (merges need the user's approval). Update the
state note under `docs/updates/` when the next steps change.

## Rebuilding the execution-trace page

`execution-trace/` holds the manifest of functions (with their "why it matters"
notes), the page body and head, the extractor and the builder. From a balotachain
checkout with `saksi` beside it:

```bash
cd docs/context/execution-trace
python extract_fns.py manifest.json fn-data.json   # reads git objects at the pinned commits
python build.py                                    # writes saksi-trace.html
```

The extractor fails if any function moved or disappeared, so re-pinning to a new
commit (`SAKSI_COMMIT=<sha>`) shows exactly what to update in `body.html`.
`run_election.py` drives the offline election whose decoded bytes the page shows,
against a console on `127.0.0.1:8199`. The published page is a private claude.ai
artifact (link in `memory/context-in-repo.md`).
