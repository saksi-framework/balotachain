# W4 report: the study wizard UI (`/wizard`)

- **Status:** DONE_WITH_CONCERNS. Nothing is failing. The concerns are two measurement-path gaps found while testing, and the preset row the server refuses.
- **PR:** https://github.com/saksi-framework/saksi/pull/47 (`feat/wizard-study-ui`, off `origin/main` 5420034). CI 8/8 pass on 51c1410.
- **Worktree:** `Q:/Code - LAPTOP/Code/projects/saksi-wizard-ui`
- **Infrastructure panel:** built against PR #46's branch contract (851ef86), plus the controller's review notes. The branch also merges cleanly (`git merge-tree`) with #46's fix round at ff7d4cc, and the helpers it calls keep their signatures there. I did not build against ff7d4cc itself.

## Commits

| SHA | Message |
|---|---|
| b80ea03 | feat(campaign): serve /wizard to sign in, and say where each run stands |
| d324f15 | feat(campaign): runs list carries the T3 trail |
| 8e0945b | feat(wizard): run the study from /wizard |
| edc5b66 | fix(wizard): catch a run action's errors, wrap the header |
| 00383a5 | fix(wizard): keep a run action's error when the runs list reloads |
| 9956685 | fix(wizard): judge Resume and Verify-only by the run's record |
| 51c1410 | fix(wizard): refresh the runs list when verify ends |


## Files

- `packages/saksi-campaign/web/wizard.html`: all UI.
- `packages/saksi-campaign/auth.go`: `/wizard` moves from `accessAdmin` to `accessPublic`.
- `packages/saksi-campaign/server.go`: `runView` gains state fields, filled by `fillState`.
- Tests:
  - `server_test.go`: `TestRunsListReportsWhereEachRunStands`.
  - `auth_test.go`: the `/wizard` probes move to public; the logout and expiry tests now probe `/api/preflight` and `/api/me`.
  - `web_test.go`: new function names in the definitions test, plus `TestWizardContendedThresholdMatchesPreflight`.
- `docs/research-election-console-runbook.md`: role table (`/wizard` page public) and the `/runs` fields in the Study API section.

## Why the Go changes

1. **`/wizard` had to become public.** With auth on, the page was admin-only, so a signed-out browser got `{"error":"login required"}` JSON and never reached a sign-in box (plan G9). The page holds no data; every route it calls keeps its own role.
2. **`/runs` had no status.** The brief's runs list (status, Resume and Verify-only "when applicable", fault eligibility) needed:
   - `busy`, `paused_stage`
   - `status` (`new`, `open`, `ended`, `failed` with `reason`, or `interrupted`)
   - `ballots_started`
   - `resumable`: `planResume` itself, so the button matches the route exactly
   - `was_interrupted`, `resume_pending` (the latest `segment.start.pending`), `reconciled` (`verify_only.reconcile` seen)

   The last three come from controller notes 2 and 3: `remaining` can read 0 after a fault, and Verify-only is required after Resume, by which time the window is no longer resumable.

## What was built (brief items)

1. **Sign-in.**
   - `GET /api/me`: a 404 shows "authentication off"; a 401 shows the sign-in box, which posts `/api/login`; a non-admin is told the wizard needs an admin.
   - A who chip with sign out.
   - `apiFetch` sends any later 401 back to sign-in and stops polling.
   - After signing in again, preflight, the lists and an open campaign view reload. The single-election step timers do not restart; the operator uses Back or Next, or the runs list.
2. **Mode switch** ("Single election" or "Measurement campaign"). It can be changed only at setup.
3. **Preflight panel.**
   - Debounced 500 ms on mode, voters, positions, concurrency, warm-ups and reps, and on a mode switch; plus "Check again".
   - Rows: Fabric, orderer batch, ballots in flight, ladder, disk (with the campaign-wide projection), host, verify threads; a busy row only when a finding applies; a row for any unclaimed code.
   - Colours: green; amber (warn, stale ladder, or no configtx on an on-chain run); red (block).
   - Start is disabled on any block. When every block is forceable (`fabric_unreachable`), a "Start anyway" checkbox appears and sends `force:true`.
4. **Presets = thesis run table.** They fill name, trustees and threshold, 4 candidates, voters, positions, realistic distribution, senate 0, mode, concurrency 128, and warm-ups and reps.
   - "Ballots in flight" shows the orderer rule from `concurrency_min_advised` (amber below it).
   - An offline-ceiling hint appears above 10,000 offline voters.
5. **Campaign view.**
   - `POST /api/campaigns`; 400 and 409 bodies are shown verbatim, including warnings.
   - Polls every 3 s while queued or running and stops on any other status.
   - Repetition table with contended chips (`HOST_WARN_FRACTION` 0.25, pinned to Go by a test), summary table, driver log tail from `/api/jobs/<id>`.
   - Cancel with its note; Export is a plain download link.
   - Campaigns list with Open and export.
6. **Ladder** button when `ladder.ok` is false. Polls the job every 2 s, shows the log tail and result, then refreshes preflight. On a 409 whose `job` starts `ladder-`, it follows that job.
7. **Attack timeline editor.**
   - Four labelled moments; a `ballots_at` slider (0.05–0.95); a per-stage wait; "Skip all attacks".
   - A "Security run — throughput perturbed, not for RQ3" chip on setup and on the rail.
   - PR #44's pause panels are reused. Gate lines read "declared gate / observed gate / mounted at"; INCONCLUSIVE stays amber.
8. **Runs list.**
   - Resume when `resumable && !busy`.
   - Verify-only when on-chain, `caps.fabric`, not busy, and (`resumable || was_interrupted`). It is not offered on clean runs, because it stamps `interrupted_at`.
   - Tags: campaign rep, security run, fault armed; export chips.
   - A run action opens `/events` and waits for it to open before the POST (the hub does not replay), collects error events, then judges the outcome by re-reading `/runs`: a resume is unfinished if the run is still `resumable`, a verify-only if not `reconciled`.
9. **Infrastructure panel.**
   - Reset: tier from the form, exact `RESET`, destroy warning, job log tail and result; follows an existing `network-reset-*` job on a 409.
   - Fault: eligible-run select (on-chain, not a rep, no attack plan, no fault plan, `window_s` 0, not busy, journal present, ballots not started), `at` and `down_s`, exact `RESTART`, the armed message.
   - T3 help text follows controller notes 3–5: restart → wait for the failed run → Resume → Verify-only (required) → trustees, publish, Verify. It includes the closed-loop caveat (loss over the outage window needs a fixed send rate) and the recovery commands `docker start peer0.org1.example.com` and `tools/up.sh status`.
10. **Help links** to runbook §10 (anchor `#10-running-the-study-from-the-wizard`; W5 must use that heading, or the link lands at the top) and to `docs/study-checklist.md`.

## Tests

**Go (worktree):**
- `gofmt -l .` and `go vet ./...` are clean.
- `SAKSI_DEMO_BIN=<worktree>/target/release/saksi-demo.exe go test ./... -count=1` passes (50 s; the demo-gated tests ran).
- `go vet` is also clean on a scratch merge with `feat/wizard-infra` 851ef86.

**Browser.**
- Setup: Playwright 1.63 driving the cached headless Chromium 1234. Consoles built from a scratch detached merge (this branch plus `feat/wizard-infra`), `saksi-demo` from this worktree, fresh runs dirs in the scratchpad. Ports 8099 (auth off) and 8097 (auth on).
- Scripts: `<scratchpad>/pw/authoff.mjs`, `authon.mjs`. Results: `<scratchpad>/authoff.out`, `authon.out`, `shots/results-*.json`.
- The final pass on the final build (51c1410 merged with 851ef86) was all green.

| Scenario | Result |
|---|---|
| Auth off: preflight renders, preset fills, a red block disables Start, concurrency amber, offline-ceiling hint | PASS |
| Ladder job runs (4 runs) and the preflight ladder row turns green | PASS |
| Campaign 10 voters × 1 position, 1 warm-up + 2 measured: done, 3 rows, summary table, export is a zip (21 KB) | PASS |
| Cancel on a second campaign: `cancelled` after 1 repetition; no polls after it ends | PASS |
| Single offline election, all four stages: paused at dkg, ballots, close and ceremony; run-all everywhere; 7 verdict rows with declared and observed gates; E = 0; rail security chip | PASS |
| INCONCLUSIVE vs PASS distinct (see note) | PASS |
| Runs list: Resume only on the interrupted run; a resume that did nothing is reported unfinished and Resume is offered again | PASS |
| Auth on: sign-in box, bad password, trustee refused, admin in; 401 mid-session returns to sign-in; sign out ends the session server-side | PASS |
| `fabric_unreachable` gives "Start anyway", and the campaign is sent with `force:true` | PASS |
| Resume / Verify-only matrix (interrupted: both; resumed: Verify-only only; clean, generated, windowed: none); "last resume: 46 pending" | PASS |
| Verify-only connect failure shown, not reported as done | PASS |
| Infrastructure: typed confirmations gate the buttons; reset on Windows shows **Refused (501)** with the Windows reason; `down_s` 3 gets 400 verbatim; fault arms (ballot 50 of 100); run tagged and dropped from the select | PASS |

Totals: auth-off 45/45, auth-on 26/26, no console errors in either.

**Note on INCONCLUSIVE.** Offline, the real auditor passed every mounted scenario, so no genuine INCONCLUSIVE was available. The test rewrote the `/api/scenarios/<run>` response in flight (Playwright `route`), setting `reused-nullifier` to INCONCLUSIVE with observed gate `cds`. The dot colour differed (green `rgb(23,134,74)` vs amber `rgb(138,97,0)`), and the attack step read "Not a pass …" with both gates shown. This tests the rendering, not a real verdict.

**Seeded runs.** The on-chain run shapes (generated, interrupted, resumed, clean, windowed, campaign rep) are hand-written `run.json` and journal folders, because a Windows console cannot run Fabric. The Resume, Verify-only and fault routes were exercised against them: resume dispatched and then did nothing (no bundle, no Fabric); verify-only failed to connect (dummy certificates); the fault armed successfully.

**Screenshots.**
- Full size: `<scratchpad>/shots/*.png` (23 screens).
- Compressed subset: `<scratchpad>/pr-shots/*.jpg`, listed in the PR body. GitHub image upload is not possible from `gh`.
- `<scratchpad>` = `C:/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad`.

## Bugs found and fixed during the browser runs

1. A run action's error events were lost:
   - the POST went out before the EventSource subscription reached the hub, which does not replay — fixed by waiting for `onopen`;
   - `loadRuns()` then cleared `#rlErr` — fixed by showing list-load errors inside the list.
2. A resume that returns before publishing anything was reported "Done" — fixed by judging the outcome from the run's record.
3. The runs list was stale after verify, and the header squeezed the title when the id chip is long.

## Concerns / findings for the controller

1. **An on-chain campaign repetition whose Fabric connect fails is recorded as passing.** This is on the measurement path, it predates this PR, and the CLI `--repeat` behaves the same.
   - `Repeat` posts `/submit` (async 202). `Executor.Submit` publishes `connect to Fabric: …` and returns, and nothing stamps a failure.
   - `/verify` then passes on the local ballots: `run.end {failed:false}`, `perf.csv` with empty `committed`, `summary.csv` `runs_failed 0`.
   - Reproduced on the auth-on console (unreachable peer, forced campaign). Relevant to W6 if the peer is down during a campaign: the repetition would look clean except for a missing TPS.
2. **`handleResume` has no `fabric.Enabled()` check** (`handleVerifyOnly` has one), and `Executor.Resume`'s early returns (no bundle, no Fabric) publish no event, so the operator sees a 202 and then silence. The UI now detects it. The server-side fix belongs with #46's fix round or a follow-up.
3. **Row 8 presets (MP-483K … MP-3.5M offline) are refused by `Validate`** (`OfflineVoterCeiling` 10,000). The form states it, and the 400 is shown. Row 8 needs the CLI chunked generator, or a ceiling change, which is a measurement decision and not made here.
4. **The #46 contract may still move in review.** I checked ff7d4cc: the fault adds a `window_s` refusal, which the UI already mirrors; resume-close is retryable through `planResume`, which the `resumable` flag follows automatically. Response shapes are unchanged. Re-run `authon.mjs` against a build of the merged #46 if anything else changes.
5. **Verify-only gating is a judgement call:** it is offered only on runs that were interrupted, not on every on-chain run, because it stamps `interrupted_at` on whatever run it is given.
6. **The runbook §10 anchor is assumed** (`10-running-the-study-from-the-wizard`). W5 should use exactly the heading "10. Running the study from the wizard", or update the link.
7. **`/runs` now reads each run's journal** (twice for on-chain runs, via `planResume`), and it is public. That is fine for the run-store sizes seen; a `ponytail:` comment names the fold-into-one-scan upgrade.

## Leftovers

- Scratch worktree removed.
- Test consoles stopped.
- Scratch runs dirs, screenshots and scripts remain in the scratchpad.
- WSL, Docker, the Fabric network and port 8090 were not touched.

## Fix round 1 (Sonnet review: Needs fixes)

Commits, pushed to PR #47 (CI 8/8 pass on 2f8e2c5; macOS Security first failed on a GitHub 504 downloading cargo-audit, and the rerun passed):
- `c8a6210` fix(campaign): send a failed run's reason on /runs only to admins
- `2f8e2c5` fix(wizard): show why a network reset failed, and pin the fault filter

**Important 1, `followReset`.**
- On failure: `#rsStatus` keeps exit code, duration and log path; `#rsErr` shows "Reset <status>" with `v.error` (for example "tools/tier.sh succeeded but this console cannot read the new network…") and "reading the new network: <result.chain_error>".
- On success: "the console reads the new network (channel height N)" from `result.chain_height`, and any earlier error is cleared.
- The error goes to its own element, so `watchJob`'s last render of the job error is not lost.
- Fields match `reset.go` on `feat/wizard-infra` at fa4f4f8 (PR #46's second fix round; `reset.go` is unchanged since ff7d4cc).

**Important 2, reason gating.**
- `handleRuns` sends `reason` only when `s.auth == nil` or the session role is admin. Anonymous and trustee callers still get `status`, `resumable`, `was_interrupted`, `resume_pending` and `reconciled`.
- The wizard already renders `reason` when present.
- The runbook's Study API paragraph says so.
- Test: `TestRunsReasonOnlyForAdminsOrAuthOff`, in `auth_test.go`. It covers anonymous (none), trustee (none), admin (present) and auth off (present). It failed before the fix, for anonymous and trustee.

**Minor 3.**
- `TestWizardFaultFilterMirrorsTheFaultRoute` (`web_test.go`) pins each clause of `faultEligible` to its fault-route refusal: on-chain, not a rep, no attack plan, no fault plan, `window_s`, not busy, generated, ballots not started.
- Mutation check: removing the `window_s` clause fails the test.
- `faultEligible`'s comment names `handleFault` (`fault.go`, PR #46) and the test.
- The test pins the page's text, not the server logic: `handleFault` is not on `main` yet. Once #46 lands, a table test that drives `handleFault` for each clause could replace it.

**Checks.**
- `gofmt` and `go vet` are clean.
- `go test ./... -count=1` with `SAKSI_DEMO_BIN` passes (49 s).
- `go vet` is clean on a scratch merge with `feat/wizard-infra` at fa4f4f8.

**Browser, re-run on this branch merged with PR #46 at fa4f4f8 (fresh runs dirs), all PASS:**
- `fix1.mjs` 9/9:
  - `/runs` anonymous with auth on has no reason; auth off has it; an admin session has it, and the wizard shows it.
  - The real reset on Windows gets 501.
  - A stubbed failed job shows the job error, the chain_error, exit 0 and the duration.
  - A stubbed success shows channel height 7 with no error left.
- `authoff.mjs` 45/45, `authon.mjs` 27/27, both on the fa4f4f8 merge. Two expectations were updated for #46 round 2's contract, and neither needed a UI change:
  - Resume on a console without Fabric is now refused with 400 before dispatch, and the page shows the refusal verbatim.
  - A resumed run with no close on record is `resumable` again (CloseOnly retry), so Resume stays offered. The test now seeds a resumed run with `ceremony.json`, which offers Verify-only only, and a close-failed run, which offers Resume and Verify-only.
- An environmental miss in the first re-run: the console binary was placed outside a git checkout, so the ladder refused to pin a commit. Rebuilt inside the scratch checkout and all passed.

**Not rebased.** PR #46 is still OPEN (head fa4f4f8). Once it merges: rebase onto `origin/main`, drop nothing (the branch merges cleanly), re-run the three scripts against the merged build.

## Rebase onto merged PR #46 (saksi main eb64c90)

- The rebase applied cleanly: all 9 commits, no conflicts. Force-pushed with lease; head is 0ca579b.
- One behaviour change surfaced in `TestRunsListReportsWhereEachRunStands`:
  - #46's `planResume` now accepts a resumed run that has no close on record, as a `CloseOnly` retry.
  - Fixed in `fix(campaign): report a close-only resume as close-pending on /runs`. `/runs` now reports `close-pending` (still `resumable`). The test seeds both shapes: closed, with `ceremony.json`, and close failed. The wizard gives the new status an amber pill, and the runbook lists it.
- Checks on the rebased tree, with `saksi-demo` rebuilt there:
  - `gofmt -l` and `go vet` are clean.
  - `go test ./... -count=1` passes (53 s).
  - An earlier run failed only because it ran alongside the browser suites. That was the close-pending case, so a real failure; it passed alone after the fix.
- Browser suites against the rebased build (binary inside the checkout, fresh runs dirs):
  - fix-round checks: 9/9
  - auth off: 45/45
  - auth on: 28/28, including "close-failed run reads close-pending"
- CI 8/8 pass on 0ca579b.
  - macOS Test first failed in `TestSingleRunLockReturns409` with "TempDir RemoveAll cleanup: directory not empty". That test is not touched by this branch: a phase was still writing when the test's temp dir was cleaned up.
  - The rerun passed.
