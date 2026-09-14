## ban-init — orchestrator + tiered subagents

This repo runs the ban-init workflow: the main session (Fable) plans, dispatches, reviews, and synthesises; subagents implement. Invoke `/ban-init` at the start of any multi-step task; it wraps `superpowers:subagent-driven-development`.

- Fable is never dispatched as a worker. Ladder: `executor` (Opus, default implementer) · `mech-executor` (Sonnet, repetitive fully-specified edits only) · `scout` (Haiku, lookups only) · `reviewer` (Sonnet, after every task) · `final-reviewer` (Opus, once per branch). If Opus is rate-limited, fall back to `mech-executor` for the current task and say so in the ledger.
- Do it directly only when it is a few tool calls with small output; otherwise dispatch. Debugging and bulk edits are dispatched.
- Never enter plan mode while a subagent is live; plan in a file.
- Worktree when the task edits files another live worker or the main checkout is editing, targets another branch or repo, or opens its own PR; otherwise in place.
- Workers write reports to files and reply in under 15 lines; progress lives in the ledger, not in chat.
- Caveman ultra in chat; full prose in code, commits, PRs, reports, and the four stop conditions.
