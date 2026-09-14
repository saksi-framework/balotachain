---
name: ban-init
description: Use when starting a multi-step coding task in a repo (fresh or existing) and the main session should orchestrate while cheaper subagents implement; when the user says "/ban-init", "orchestrate this", "use subagents for the work", "set up the workflow for this repo"; or when Fable is about to write bulk code, debug at length, or review its own workers' diffs itself.
---

# ban-init — Fable orchestrates, tiered subagents execute

**Wraps `superpowers:subagent-driven-development` (SDD).** SDD owns briefs, review packages, the ledger, the fix loop with its five-round cap, and the final review. ban-init adds only: the installer, the model ladder, the delegate-or-do rule, the worktree criteria, the plan-mode rule, and the caveman levels. Read SDD's SKILL.md after this one; where they overlap, SDD's mechanics win and this file's model choices win.

## Step 0 — install (idempotent; fresh or existing repo)

```bash
bash ~/.claude/skills/ban-init/scripts/install.sh            # default: caveman ultra
bash ~/.claude/skills/ban-init/scripts/install.sh --caveman full
```

Read the `STATUS` lines. `present` means already installed and untouched; `installed` means written now; a non-zero exit names the missing prerequisite (git repo, superpowers). Re-running is a no-op. Then say one line: what was installed, what was already there.

## Step 1 — plan in a file, never in plan mode

Write the plan to `docs/plans/<date>-<slug>.md` with `## Task N` headings SDD's `task-brief` can extract, a **Global Constraints** section with exact values, and a task table with three extra columns: `model`, `where` (in place | worktree: reason), `reviewer model`. If a plan already exists, reuse it.

**Plan mode is session-wide.** It freezes every live subagent mid-task (observed: a worker stopped between passing tests and its commit). If a worker is live, do not call EnterPlanMode; edit the plan file instead. If the user invokes `/plan` while workers are live, say so and finish or stop the workers first.

## Step 2 — classify each task

| Task shape | Agent (model) | Reviewer |
|---|---|---|
| Repetitive, fully specified per file: renames, same edit across files, fixtures, doc mirrors, batched one-liners the brief spells out | `mech-executor` (Sonnet) | `reviewer` (Sonnet) |
| Everything else: features, refactors, integration, **debugging**, concurrency, protocol or crypto code, anything with an open question | `executor` (Opus) | `reviewer` (Sonnet); `final-reviewer` (Opus) for concurrency, crypto, or security diffs |
| Lookup with compact output: find uses, map a directory, what a test covers | `scout` (Haiku) | none |
| Fix rounds 1–3 | resume the same agent | `reviewer` scoped re-review |
| Fix rounds 4–5 | fresh `executor` (Opus) with "a prior implementer attempted this N times; read the report" | `reviewer` |
| Whole branch, once, before the PR | — | `final-reviewer` (Opus) |

Fable is never a worker. Opus rate-limited mid-plan: use `mech-executor` for the current task, write `Ruling: opus rate-limited, task N on sonnet` in the ledger, continue.

**Scout first.** Before dispatching an implementer on a task that needs locating (uses of a symbol, files a change must touch), dispatch `scout` and put its `path:line` map in the brief. Implementers then edit instead of exploring; exploration turns are where worker spend goes.

**Delegate or do.** Do it yourself only when it is a few tool calls with small output (read one file, a one-line fix, a git command). A dispatch costs thousands of tokens of overhead; a debugging session or a multi-file edit costs far more of Fable's context than that. The baseline failure this rule exists for: "I do the hang investigation myself, it needs live iterative debugging." Debugging is `executor` work; hand it the symptom, the repro command, and the report file.

**Review is a dispatch, not a read.** After every implementer task run SDD's `review-package` and dispatch `reviewer`. The baseline failure: "I read the diff myself and run the tests before accepting." That spends Fable tokens on a Sonnet job and skips the spec-compliance verdict.

## Step 3 — where the work runs

Use a worktree when any is true; otherwise work in place.

| Condition | Why |
|---|---|
| The task edits files a live worker or the main checkout is editing | two writers, one tree, lost edits |
| The task targets a different branch or repo | a checkout has one HEAD |
| The task will open its own PR | its branch must survive after the worker exits |

Every worktree dispatch carries three lines verbatim: the tree is fresh (run the install step: `corepack pnpm install`, `cargo fetch`, whatever the repo needs); the stash stack is shared with every other worktree (never bare `git stash`, use a WIP commit); the path must contain no spaces if the repo runs Fabric or similar tooling. One implementer per shared tree; parallel dispatch only across worktrees or provably disjoint directories.

## Step 4 — dispatch, review, ledger

Follow SDD's task loop exactly: record BASE, `task-brief`, dispatch with brief path + report path + only the interfaces this task needs, wait, `review-package`, dispatch `reviewer`, fix loop, ledger line, next task. Reports go to files; workers reply in under 15 lines. The ledger (`.superpowers/sdd/<plan>/progress.md`) is the memory; after compaction trust it and `git log`, never recollection. A TODO list is not a ledger.

Between tool calls, narrate at most one line.

## Step 5 — finish

SDD final review on `final-reviewer`, one fix wave, one scoped re-review, then `superpowers:finishing-a-development-branch`. Final message: PRs, what is verified locally versus left to CI, every `Ruling:` line from the ledger with what it costs if wrong, and the ledger's per-task model column so the cost split is visible. If the caveman plugin is installed, run `/caveman-stats` and include its line.

## Caveman levels

- Orchestrator chat: **ultra**, set by the installer. Every reply, including status lines between tool calls.
- Drop to **full** for the rest of the reply when any of these is true: the reply contains a security warning; it confirms an irreversible action; it is an ordered multi-step sequence the user must follow; ultra wording would leave a technical statement ambiguous. Drop to **lite** for the next three replies when the user says a reply was unclear. Return to ultra afterwards.
- Workers: reply contracts in **lite** (their agent files say so). Report files, review findings, code, comments, commits, PR bodies, docs: full prose. Findings must be exact; ultra is never applied to them.
- The four stop conditions (destructive action, security-sensitive action, push or merge to a shared branch, plan so broken every path is a guess) are always written in full prose.

## Red flags — stop and re-read this file

- "I'll just fix this myself, dispatching is overhead" on anything beyond a few tool calls.
- "Let me read the diff to check their work" instead of dispatching `reviewer`.
- "This needs live debugging so I'll do it directly."
- "Quick plan mode to confirm" while a worker is live.
- A Sonnet dispatch for a task with an open design question, or an Opus dispatch for a rename.
- Progress that exists only in a TODO list or in chat.
- A worker replying with a wall of text instead of the 15-line contract.

## Quick reference

| Need | Do |
|---|---|
| Install in a repo | `bash ~/.claude/skills/ban-init/scripts/install.sh` |
| Change chat compression | `/caveman lite\|full\|ultra` or re-run the installer with `--caveman` |
| Task brief / review package / ledger | SDD scripts under its `scripts/` dir |
| Worktree | `superpowers:using-git-worktrees`; carry the three warnings |
| Finish | `superpowers:finishing-a-development-branch` |
