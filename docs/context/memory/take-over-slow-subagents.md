---
name: take-over-slow-subagents
description: "When a dispatched subagent runs long, the user wants the main session to stop it and finish the work in the conversation."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eddf28aa-046c-419f-96ab-1f6c6ce58884
  modified: 2026-09-14T19:25:59.383Z
---

On 2026-09-15 the user asked "What's taking the subagent too long" and then "could you move that subagents work to this main conversation agents work lets just work on it here". The W4b subagent was stopped and its remaining items were finished directly, commit by commit, from the state it left in its worktree.

**Why:** the user values progress they can see over the ban-init cost model when a worker stalls; they also asked earlier to stop an already-finished agent ("That agent is already finished soo better stop it lol").

**How to apply:** ban-init (orchestrate, dispatch workers) stays the default for multi-step work, but if a worker is slow or the user asks, stop it, inspect what it committed and left uncommitted, and continue in the main session. Kill orphaned processes it started. Say in a line what is being done while working. See [[ban-init-workflow]], [[merge-approval]].
