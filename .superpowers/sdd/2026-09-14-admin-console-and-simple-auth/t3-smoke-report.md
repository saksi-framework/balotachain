# T3 report: end-to-end browser smoke of console auth + dynamic admin app

**Status:** DONE_WITH_CONCERNS. The smoke passed. The concerns are the defects found, none of which is an authorization bypass.
**PR:** https://github.com/saksi-framework/balotachain/pull/57 (branch `docs/admin-auth-smoke`, off `origin/main` b27938e).
**Commit:** `cbe4dfe docs: end-to-end browser smoke of console auth and the dynamic admin app`.
**Deliverable:** `docs/updates/2026-09-14-admin-auth-smoke.md` plus 28 PNG screenshots, 2.5 MB, in `docs/updates/2026-09-14-admin-auth-smoke/`.

## Environment as run

- **Worktrees:** fresh detached ones, `saksi-smoke` at adba922 and `balotachain-smoke` at b27938e. Both are removed.
  - `git worktree remove` hit "Filename too long" on balotachain-smoke's node_modules.
  - I deleted that directory with PowerShell `Remove-Item` on the `\\?\` long path, then ran `git worktree prune`.
  - Neither repo lists a smoke worktree now.
- **Build:**
  - `corepack pnpm install`.
  - Built `@balotachain/ui`, `auditor`, `trustee` and `admin`, and copied them into `dist-web/{board,trustee,admin}` as `tools/build-web.sh` does.
  - `go build -o saksi-campaign.exe ./cmd/saksi-campaign` (go1.26.5).
- **Users file:** `hash-password` over stdin. Accounts are `admin`, plus `trustee1`, `trustee2`, `trustee3` with trustee_id 1, 2, 3.
  - Passwords are random and live only in `scratchpad/t3/passwords.txt`.
  - I read "trustees 1, 2, 3" in the brief as trustee ids, with usernames `trustee<n>`.
- **Console:** `serve --addr 127.0.0.1:8097 --runs scratchpad/t3/runs --web-dir …/dist-web --auth-file scratchpad/t3/users.json --demo saksi-instrument-gap/target/release/saksi-demo.exe`, with no Fabric flags.
  - Pre-checks: capabilities `fabric:false`; `/api/me` 401.
  - The console was stopped at the end.
- **Untouched:** WSL, port 8090, and the main checkouts.
- **Browser:** playwright-core from `scratchpad/pw/node_modules`, Chromium 1234, headless, 1280×900, one context per actor.
  - Scripts: `scratchpad/t3/smoke.mjs` (phases a/b/c/d/e/l/r), `neg.sh`, `sse.mjs`, `req.mjs`.
  - Logs: `browser.log`, `neg.txt`, `results.jsonl`.

Run: `smoke-100-20260914-104829-1`. Tracking code verified: `BC-D259-9708` (ballots.csv row 57, vice-president).

## Results

- **Scenario:** steps 1–11 all pass. Sub-steps 6a–6e and 11a/11b are listed separately in the note.
- **Negative checks:**
  - N1 401, N2 403, N3 403, N5 401 (admin control 200), N6: 5×401, then 429 with `Retry-After: 30`, and admin 204 during the lockout.
  - N4 (anonymous `?operator=1` sealed view) cannot be observed offline: `handleTrailAPI` dials Fabric before `buildTrail`'s seal gate, so it returns 502 "chain unreachable" for anonymous and admin callers alike. No leak.
  - Extras: X1 admin submit 403, X2 anonymous publish 401, X3 anonymous `/events` 401, X4 trustee `/api/check` 403, X5 cross-origin login 403.

## Defects (full evidence in the note)

1. **D1, Important (board × auth).** With `--auth-file`, the public board's footer links all point at `/export/<run>/…`: "Download verification data" and 14 artifact links, including ground-truth file names. `/export/` is admin-only, so all 15 hrefs return 401 for anonymous visitors. The footer copy promises anyone can download and re-run the checks. Needs a decision: hide the links when auth is on, or add a public export subset. Screenshots: `D1a-board-footer-links.png`, `D1b-board-export-link-anonymous.png`.
2. **D2, Minor (trustee app).** The SSE effect (App.tsx ~1425) depends only on `[runId]`. It opens `/events` before sign-in and gets 401. EventSource does not retry after a non-200 response, and the effect does not re-run on sign-in, so the live lines stay empty for that page load. `sse.mjs` shows it: on-page sign-in → `[401]`; cookie present at load → `[200]`. Fix: add the auth state to the effect's dependencies.
3. **D3, Minor, pre-existing from #54.** The board's "Open verifier" goes to `/trail/<id>`, which shows "Failed to load: request failed: 502" for offline runs. The admin app already hides the trail link offline. Screenshot: `D2-open-verifier-offline.png`.
4. **C1, Cosmetic.** Admin step tabs truncate ("Populat…", "Ceremo…") at 1280 px, even after #56's label change.
5. **C2, Cosmetic.**
   - saksi `check.go:221` renders "V-000001 through V-100"; the real last id is V-000100.
   - `/favicon.ico` hits the admin-only `/` catch-all, which logs 401/403 console errors on every app page (found with `req.mjs`).

## Observations

- **O1.** A signed-in trustee on another trustee's link still sees their own Submit button until they submit. The notice explains this, and N3 shows the server refuses another trustee's shares. This is #56's design, but the brief's "no submit" holds only after the trustee has submitted.
- **O2.** At 100 voters the offline run finished within 3 s, so the "progress" screenshot matched the completed one. I dropped the duplicate `04a`, and also `08b`, which was byte-identical to `09a`.
- **O3.** `06f` was retaken with the page scrolled to the top, because the sticky header had painted mid-image. `shot()` now scrolls to the top before each capture.

## Could not run

- The on-chain path and the sealed/unsealed trail view. Both need Fabric, which the plan keeps out of T3.
