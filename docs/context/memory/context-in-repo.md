---
name: context-in-repo
description: This project's context (memory notes, standing rules, ban-init skill, execution-trace build, handoff note) is committed to balotachain docs/context so it carries to other devices.
metadata:
  type: reference
---

On 2026-09-15 the user asked for context to carry across devices. balotachain `docs/context/` holds a copy of this memory directory (`memory/`, restored with `docs/context/restore-memory.sh` or `.ps1`), `standing-rules.md`, the `/ban-init` skill (`tooling/ban-init/`, copy to `~/.claude/skills/`), and the Saksi Execution Trace page's build sources (`execution-trace/`). The dated state and next steps are `docs/updates/2026-09-15-state-and-next-steps.md`, linked from both repos' CLAUDE.md.

**Why:** Claude Code memory lives under `~/.claude` on one machine only.

**How to apply:** after changing memory here, refresh the repo copy (`docs/context/sync-memory.sh` from this machine) and open a PR. On a new device, run the restore script once from the balotachain checkout. The Defense Reviewer PDF rebuilds with `docs/defense-reviewer/build.py`; the trace page is artifact https://claude.ai/code/artifact/207a6a9f-6bf8-4e40-afac-fe53a2b777b3. See [[study-grade-wizard-done]].
