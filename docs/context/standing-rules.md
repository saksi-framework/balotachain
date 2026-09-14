# Standing rules

Decisions the user has made and working rules learned on this project. They apply
until the user changes them. Dated where the date matters.

## Approvals

- **Merging a PR, or pushing to `main` or another shared branch, needs the user's
  explicit go, per PR.** Ask with a question whose recommended option is "merge when
  CI is green"; approval for one PR does not cover the next. Feature branches can be
  pushed freely.
- **saksi** merges with merge commits (`gh pr merge --merge`). **balotachain** allows
  squash merges only (`gh pr merge --squash`).
- **Capstone rows 5 to 9** of the run table stay on hold until the user says to run them.
- **`docs/manuscript-amendments.md` and `docs/CLAIMS.md`** change only for a decision
  the user made or evidence that exists (a run folder, a test, a merged commit).
- Plans that change behaviour are written to `docs/plans/` and approved before work
  starts; `/plan` from the user means plan mode.

## Commits and PRs

- Conventional Commits (`feat(scope):`, `fix(scope):`, `docs:`), one logical change per
  commit, the message explaining why.
- Every commit ends with a `Co-Authored-By: Claude …` line and a `Claude-Session:` line
  with the session URL; every PR body ends with the Claude Code line and the session URL.
- Never stage stray local files (tool output, scratch notes, other agents' worktrees).

## How work is done

- `/ban-init` is the default for multi-step work: the main session plans, dispatches
  workers, reviews and reports; see `tooling/ban-init/SKILL.md` and `.claude/agents/`.
- If a worker stalls, or the user asks, stop it and finish the work in the main
  session from the state it left.
- Say in a line what is happening during long work. Report outcomes plainly, including
  failures and anything skipped.
- A plan in plan mode freezes live workers: with workers running, edit the plan file
  instead.

## Claims discipline (Chapter 4)

- Every capability is **design intent**, **implemented** or **demonstrated**; never
  claim beyond the strongest status reached. No number without the artifact behind it.
- A security run's throughput never enters RQ3; measured repetitions never run attacks.
- An attack PASS counts only when the declared gate refused it; otherwise INCONCLUSIVE.
  On-chain verdicts from saksi `adba922` or earlier were discarded, not re-used.
- Reordering is **not detected**. The chaincode has no caller authorization
  (front-running denial of service). Chaum-Pedersen proofs are checked for presence
  on-chain and verified only by the auditor. The ceremony is simulated.
- Ballot-secrecy evidence must come from runs at saksi `1812139` or later (random DKG
  dealers, saksi #50); earlier runs support correctness, verifiability, integrity and
  performance only.
- Terminology: **Saksi is the framework, BalotaChain is the application.**

## Measurement environment (the Table 3.12 desktop)

- Orderer batch parameters `MaxMessageCount 50`, `BatchTimeout 2s`,
  `PreferredMaxBytes 2 MB`; **Ballots in flight** at least 50 (presets use 128).
- One saksi build per study: no pull or rebuild mid-study; run the ladder once per build.
- Start the console with `SAKSI_PHASE_TIMEOUT=5h ./tools/up.sh` for the study.
- Never `wsl --shutdown` and never restart Docker Desktop during runs. Never touch
  Docker resources `network.sh` did not create. Do not change Docker Desktop's
  "Disk image location" (the data disk is on the NVMe through a junction).
- No games or other heavy programs during a measurement; preflight's host CPU row is a
  gate, not advice.

## Documents

- **Defense Reviewer PDF:** pages 1 to 21 are the original and are never edited. Part 5
  is `docs/defense-reviewer/part5-codebase.html`, appended by `build.py` from the
  untouched original. Its style: Liberation Sans or Arial, no em or en dashes, ranges as
  "1 to 3", second-person coaching voice.
- The execution-trace page shows only source extracted from a pinned commit
  (`execution-trace/`), never retyped code.

## Tool quirks seen on the Windows dev box

- Git Bash rewrites `origin/main:path` into a Windows path: prefix `MSYS_NO_PATHCONV=1`.
- The Bash tool strips backslashes in heredocs: write Python scripts to a file, or use
  `chr(92)`.
- Python's text mode writes CRLF on Windows: write with `newline="\n"` or bytes.
- `tar` treats `C:` as a remote host: use `--force-local` or `/c/...` paths.
- The repository path contains a space, which breaks `fabric-samples`: run Fabric in
  WSL2 (`~/Code/saksi`).
- Very long paths can stop a worktree folder from being deleted after `git worktree
  remove`; `git worktree prune` still clears the registration.
