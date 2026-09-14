---
name: merge-approval
description: "Never merge a PR or push to main/shared branches without the user's explicit go; ask with AskUserQuestion, recommended option \"merge when CI is green\"."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eddf28aa-046c-419f-96ab-1f6c6ce58884
  modified: 2026-09-14T19:25:54.022Z
---

Every merge in this project has been approved explicitly by the user, one PR (or a named set) at a time, through AskUserQuestion. The user usually picks the recommended "merge when green" option, but the approval is per PR: approval for one PR does not cover the next (e.g. #50 approved did not cover docs PR #51; it was asked separately).

**Why:** the repos carry thesis evidence; the user wants to see what lands on main.

**How to apply:** open the PR, run the checks, then ask ("Merge when CI is green (Recommended)" / "Hold for my review"). After approval, wait for CI and merge. saksi PRs merge with merge commits (`gh pr merge --merge`); balotachain allows squash only (`--squash`). Commit trailers: `Co-Authored-By: Claude …` and `Claude-Session: <session url>`; PR bodies end with the Claude Code line and the session URL. Feature branches can be pushed freely. See [[take-over-slow-subagents]].
