---
name: ban-init-workflow
description: "Global /ban-init skill (Fable orchestrates, tiered subagents execute) exists and is installed in balotachain; user wants it used for every multi-step task."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eddf28aa-046c-419f-96ab-1f6c6ce58884
  modified: 2026-09-10T04:36:05.034Z
---

`/ban-init` lives at `~/.claude/skills/ban-init/` (installer + agent templates + CLAUDE.md section) and is installed in balotachain (2026-09-10). It wraps `superpowers:subagent-driven-development`.

**Why:** User wants near-Fable quality at lower cost: Fable plans, dispatches, reviews, synthesises; never a worker. Opus 5 = default executor; Sonnet 5 only for repetitive fully-specified edits; Haiku = lookups; Sonnet reviewer after every task; Opus final review. Caveman ultra in chat, tone down on ambiguity.

**How to apply:** Invoke `/ban-init` at the start of multi-step tasks. Never enter plan mode with live subagents (it freezes them). Worktree only when files are contested, branch/repo differs, or the task opens its own PR. Reports to files, 15-line replies, ledger in `.superpowers/sdd/<plan>/progress.md`. Related: [[saksi-first-sequencing]].
