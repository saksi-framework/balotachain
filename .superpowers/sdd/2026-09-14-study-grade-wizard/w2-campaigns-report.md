# W2 report — preflight, ladder job, campaigns, export

- Repo: saksi. Worktree: `Q:/Code - LAPTOP/Code/projects/saksi-wizard-campaigns`, branch `feat/wizard-campaigns` off `origin/main` adba922.
- PR: https://github.com/saksi-framework/saksi/pull/43
- Commits:
  - `a1b08a4` feat(campaign): preflight, ladder job, campaigns and thesis export in the console
  - `6f83d17` fix(wizard): default ballots in flight to 128
  - `6acf1ac` docs(runbook): study API routes, preflight findings and campaign layout

## Files

New (package `campaign`, `packages/saksi-campaign/`):
- `internal.go`: the in-process transport, `internalCall`, `Server.internalClient`.
- `jobs.go`: `jobBoard` (the single job slot), `job`, `jobLog`, `POST /api/ladder`, `GET /api/jobs/<id>`.
- `preflight.go`: `PreflightReport`, `Server.preflight`, `GET /api/preflight`, and the named thresholds.
- `campaign.go`: campaign persistence, row refresh, `/api/campaigns`, `/api/campaigns/<id>[/cancel|/export]`.
- `export_bundle.go`: the streamed zip.
- `campaign_test.go`: all of the new tests.

Edited, kept to the smallest change that works (so W1 rebases cleanly):
- `server.go`:
  - one new `jobs jobBoard` field on `Server`;
  - five `mux.HandleFunc` lines.
- `auth.go`:
  - five role-table lines (admin);
  - `if s.auth == nil || internalCall(r)` in `authorize`.
- `repeat.go`: optional seams, all nil by default, so the CLI is unchanged:
  - `RepeatOpts.Client`;
  - `LadderOpts.Client`;
  - `LadderOpts.Head`.
- `web/wizard.html`: concurrency default 8 → 128, and the helper text now names the MaxMessageCount / 2 s BatchTimeout rule.
- `docs/research-election-console-runbook.md`:
  - the §4 auth role table lists the new routes;
  - the auth note says campaigns can be started from the console;
  - §9 has a new "Study API" section (routes, findings table, campaign layout).

## Internal transport

- `internalTransport.RoundTrip` clones the request with `context.WithValue(ctx, internalCallKey{}, true)`. It sets `Host` to the lexicographically first allowed host (or `console.internal` when there is no allowlist). It then calls `Server.ServeHTTP` (guard, then authorize, then the mux) into an `httptest.ResponseRecorder` and returns `rec.Result()`.
- `authorize` treats a marked request exactly as it treats every request when auth is off.
- Why the marker cannot be forged:
  - The key type is unexported.
  - For network requests, `net/http` builds the context itself.
  - No header, query parameter, cookie or RemoteAddr maps into a context value.
  - So there is no token to issue or leak.
- Why the auth-off path rather than an admin session (differs from the brief's wording "internal admin caller"):
  - The repeat driver POSTs `/ceremony/submit` for every trustee on offline runs.
  - That route is `accessTrustee`, and `denial` returns 403 to an admin.
  - `handleCeremonySubmit` also checks that `sess.TrusteeID` matches the submitted trustee.
  - An admin session would therefore break every offline campaign and the ladder when auth is on. With no session in the context, the handlers behave as they do with auth off. That is exactly what the CLI driver gets from a console with auth off.
- Hooks in the transport, active only when a job is attached:
  - A POST `/generate` from a job whose cancel flag is set fails with `errJobCancelled`. `Repeat` returns at `create`, between repetitions.
  - A `/generate` that got 202 calls `job.onRun(runID)`. A campaign uses this to append a row.

## Jobs

- `jobBoard` guards everything with one mutex: the active job, the map of all jobs, log lines, and campaign.json reads and writes. The zero value is ready to use.
- `start` returns the running job when the slot is taken. Both handlers turn that into `409 {"error": "...; <kind> <id> is running", "job": id}`.
- `run(j, fn, persist)`:
  - It sets the status to running, then calls `fn`.
  - Its result is `done`, `failed` (the error text is kept), or `cancelled` (`errors.Is(err, errJobCancelled)`).
  - `persist` runs in the same critical section that frees the slot. No reader can therefore see the slot free while `campaign.json` still says running.
- Ladder:
  - `RunLadder` runs with `DataDir: store.Root()` and `Head: s.gitHead`, so the commit it writes is the one the gate checks.
  - The job's result is the bytes of `ladder.json`.
- The job log keeps the last 200 lines (`jobLogLines`).

## Preflight

- Query parameters: `mode` (defaults to `onchain`), `voters`, `positions`, `concurrency`. A value that is not an integer, or is negative, gets 400.
- `fabric`: enabled, peer, channel. `reachable` comes from `dialFabric` (a TCP dial with `fabricProbeTimeout` = 2 s) and is null when Fabric is not configured.
- `orderer_batch`: from `probeOrdererBatch(exec.demoBin, …)`. This is the same function `CollectEnv` uses, called directly so preflight does not wait on the Docker probes. `concurrency_min_advised` is `MaxMessageCount` parsed as an int, or null.
- `ladder`:
  - `ok` is true when `ladder.json`'s commit equals `s.gitHead()`;
  - `ladder_commit` and `console_commit` are both reported;
  - the block comes from `s.ladderGate`.
- `disk`:
  - `path` is `fabric.PeerVolume`, or the store root when that is empty. This is the same volume the disk gate uses. (The brief said "runs volume"; I mirrored the gate so the report and the `/generate` refusal cannot disagree.)
  - `free_bytes` comes from `s.freeSpace` and is null when the probe fails.
  - `projected_ledger_bytes` = voters × positions × `LedgerBytesPerBallot`, when both are given.
  - The block comes from `s.diskGate`.
- `host`: `load1` and `load5` are parsed from `readLoadAvg()` (`/proc/loadavg`) and are null when the file is absent (Windows). `cpus` = `runtime.NumCPU()`.
- `verify_threads_default`: `SAKSI_AUDIT_THREADS`, then `RAYON_NUM_THREADS`, then `NumCPU`. This matches `saksi-auditor/src/demo.rs`: when the env var is unset it uses rayon's global pool.
- Findings, each `{severity, code, message}`:
  - block `fabric_unreachable`: Fabric is enabled, the dial fails, and the mode is onchain.
  - block `ladder_missing`: `ladderGate` refuses.
  - block `disk_short`: `diskGate` refuses (onchain only).
  - warn `host_load`: load1 > `hostLoadWarnFraction` (0.25) × CPUs.
  - warn `concurrency_low`: onchain, concurrency > 0, and concurrency < `MaxMessageCount`.
  - warn `verify_threads`: the default is 1 (`singleVerifyThread`).

## Campaigns

- Request: `{config, warmups, reps, sweep?, window_s?, burst?, force?}`.
  - The config goes through `applyDefaults`, then `SkipAttacks = true`, then `Validate`.
  - Options must be ≥ 0. `sweep` must be 0 or > 1. At least one of reps, warmups, burst or sweep must be set.
- Order of checks:
  1. If a job is already running: 409 naming it.
  2. Preflight on `{mode, voters, positions, concurrency}`. A block without `force` gets `409 {error, warnings}` and nothing is written to disk.
  3. Claim the job slot, which can still 409 on a race.
- Stored in `<runs>/campaigns/<id>/`:
  - `campaign.json`: `{id, status, error, created_at, finished_at, config, options, preflight, reps[]}`. It is written through a temp file and rename.
  - `summary.csv`: the `Repeat` `Out` file.
  - `log.txt`: an `io.MultiWriter` with the job log.
- `RunStore.List` skips the `campaigns` folder because it has no `run.json`.
- The campaign id and the job id are the same (`campaign-YYYYMMDD-HHMMSS-N`), checked against `runIDPattern` before any path join.
- Rows: `onRun` appends `{index, kind}` from the run's own `run.json` `config.rep`.
- `refreshReps`, run on every GET and export and at finish:
  - It reads `perf.csv` (`perfRowCells`) and the journal (`runEndEvent`).
  - It uses `collect`'s failure rules: run.end `failed` (with its reason), then no perf.csv, then no run.end.
  - Only the newest row of a live campaign can show `running`.
- GET `/api/campaigns/<id>` also returns `summary` (the parsed `summary.csv`) whenever the file exists.
- Cancel: `POST .../cancel` returns 202 while the campaign runs and 409 otherwise. The next `/generate` is refused and the job ends `cancelled`. No `summary.csv` is written, because `Repeat` returns before writing it.
- Restart: `loadCampaign` marks a `running` file `interrupted` (and saves it) when this process's active job is not that campaign. This happens on the first read, which is lazy; there is no startup hook.

## Export

- Headers: `Content-Type: application/zip`, with `Content-Disposition` set to the attachment `<id>.zip`.
- Written with `archive/zip` straight to the ResponseWriter.
- For each distinct run in the rows, when present: `run.json`, `perf.csv`, `perf-schema.md`, `correctness.csv`, `negative-tests.csv`, `ground-truth-check.json`, `timings.json`. Also `journal-line1.json` (line 1 of the journal, trimmed). All are named `<run-id>/<file>`.
- At the zip root: `summary.csv` (if present), `campaign.json` (the refreshed record), `preflight.json`.

## Tests (all in `campaign_test.go`)

| Test | Proves |
|---|---|
| `TestInternalCallerCannotBeForged` | Auth on, real listener. Forged headers, query parameters and cookies still get 401 on `/api/preflight`. A header on a local request is not internal |
| `TestInternalTransportWorksWithAuthOnAndOff` | Both modes, with a Host allowlist. In-process `GET /api/preflight` returns 200 and `POST /generate` returns 202. `POST /ceremony/submit` (trustee-only) is not 401 or 403. Confirms auth is really on (anonymous `/generate` gets 401) |
| `TestPreflightFabricReachability` | Unreachable blocks onchain only; reachable does not; not configured gives null reachable |
| `TestPreflightLadder` | Missing, stale or matching `ladder.json` above the ceiling; a tier at the ceiling does not block |
| `TestPreflightDisk` | need−1 blocks, need does not; the numbers and path are reported |
| `TestPreflightHostLoad` | Load 50 % of CPUs warns, 10 % does not; no loadavg gives null |
| `TestPreflightConcurrencyAgainstMaxMessageCount` | Real configtx in a temporary git root: min advised 50, 8 warns, 128 does not; no configtx gives null |
| `TestPreflightVerifyThreads` | `SAKSI_AUDIT_THREADS=1` warns; unset uses NumCPU |
| `TestPreflightRouteRejectsBadNumbers` | 400 on bad numbers; defaults are applied |
| `TestCampaignRefusedOnBlockUnlessForced` | 409 with `ladder_missing` and nothing on disk; `force` gives 202 and keeps the snapshot |
| `TestCampaignExclusivityAndCancel` | Fake executor that blocks. Ladder and second-campaign starts get 409 naming the job. Cancel mid-rep gives one row and `cancelled`, the job log is not empty, `skip_attacks` is in the config and in the run's `run.json`, cancelling again gets 409, and `log.txt` exists |
| `TestCampaignMarkedInterruptedAfterRestart` | `interrupted` on GET and in the list, and saved to disk |
| `TestCampaignExportBundle` | Exact set of zip entries, `journal-line1.json` content, refreshed rows, preflight snapshot |
| `TestLadderJobReportsFailure` | Fake executor: job `failed` with the tier reason, no `ladder.json`, `GET /api/jobs` works |
| `TestCampaignAgainstRealDemo` | **Real saksi-demo, auth on, Host allowlist**: 1 warm-up and 2 reps at 10 voters. Rows `{1 warmup, 1 measured, 2 measured}` all `done`; summary `runs_measured` 2 and `runs_failed` 0; export has every run's files and the campaign files. About 7 s |
| `TestLadderJobAgainstRealDemo` | **Real saksi-demo, auth on**: the full ladder (1/10/100/1000). Result = `ladder.json` with 4 runs; preflight then shows ladder OK. About 16 s, skipped with `-short` |
| `TestStudyRoutesAreAdminOnly` | Every new route: anonymous 401, trustee 403, admin allowed; no probe starts a job |

`TestRouteAccessCoversEveryRoute` and `TestRouteRolesWhenAuthOn` still pass.

## Verification

- `gofmt -l .`: clean. `go vet ./...`: clean.
- Windows: `SAKSI_DEMO_BIN=…/saksi-instrument-gap/target/release/saksi-demo.exe go test ./... -count=1` passes (96 s).
- WSL (`go1.25.1`, module copied with `git archive` to `/tmp/w2race`):
  - `go test -race -count=1 ./...` passes.
  - The first attempt failed only because `packages/saksi-bulletin/network` was left out of the archive (`TestCommittedConfigtxDeclaresAdoptedOrdererParameters`). Added it and the rerun was green.
  - The three job/campaign/ladder tests, including both real-demo ones, pass under `-race` with `SAKSI_DEMO_BIN=/home/user/Code/saksi/target/release/saksi-demo`.
- I did not touch the Fabric network, Docker, tmux or port 8090. The Ubuntu distro was stopped and booted only to run `go test`.
- CI on PR #43: all 8 checks pass (Build, Lint, Security and Test on ubuntu and macOS).

## Concerns / deferred

1. **The internal caller takes the auth-off path, not an admin session.** The reason is above (`/ceremony/submit` is trustee-only). The route table is still applied to every external request.
2. **`attack_plan` is not dropped.** W1 has not landed; `ElectionConfig` has no such field yet. Whichever branch rebases second should clear it in `handleCampaigns` next to `c.SkipAttacks = true`.
3. **A cancelled campaign has no `summary.csv`.** `Repeat` returns before writing it. The finished rows are still in `campaign.json` and the export. The summary could be built from the rows if W4 needs one.
4. **`interrupted` is applied on the next read.** There is no startup sweep; the first list or GET after a restart marks it.
5. **`disk.path` mirrors the disk gate.** It uses the peer volume when configured, otherwise the runs root. The brief said "runs volume".
6. **Preflight vs. manual runs.** Preflight while a campaign runs will see that campaign's own load. Nothing stops a manual wizard run from starting on the same console during a campaign; the plan limits only one job at a time. Add a check against `s.busy` if W4 wants it.
7. **`config.go` `DefaultConcurrency` is still 8.** Only the wizard default changed, as briefed. A campaign posted without `concurrency` gets 8 and a `concurrency_low` warning.
8. **The real-demo tests used existing binaries.** On Windows, the `saksi-instrument-gap` binary; in WSL, `~/Code/saksi` (possibly older than main). Both passed.

## Fix round 1 (Opus review: Needs fixes)

Everything above describes round 0; where it differs, this section supersedes it.

- Commits:
  - `0a7f2da` fix(campaign): review round 1 — burst preflight, narrow internal caller, WSL host CPU
  - `212cb01` docs(runbook): internal route allowlist, forceable findings, host CPU, manifest, cancel on the last rep
- Pushed to PR #43.

### Changes

- **I1: the burst is checked at start.** In `handleCampaigns`, the burst config is `b := c` with `Voters = o.Burst`, `SendRate = 0` and `WindowS = 0`.
  - `b.Validate()` failing returns 400 `burst of N voters: …`.
  - `s.ladderGate(b)` or `s.diskGate(b)` refusing adds a `ladder_missing` / `disk_short` block that names the burst.
  - `TestBurstEscapesPreflight` covers:
    - 10 voters, 2 reps, burst 2000: 409 naming the burst's ladder block, with and without force;
    - on-chain, where the measured reps fit the disk and the burst does not: 409 `disk_short` naming the burst;
    - nothing is left on disk and no job is started.
- **I2: the internal caller only reaches the driver's routes.**
  - `authorize` checks `internalCall(r)` before the auth-off branch. It serves the request with no session only when `internalRouteAllowed` matches the pattern and method; otherwise it answers 403, with auth on and off.
  - Allowlist, re-derived from `repeat.go` (`create`, `once`'s check, `phase`, `ceremony`, `waitIdle`, `export`) and `RunLadder` (which only calls `once`). It is **unchanged** from the coordinator's list: POST `/generate`, GET `/api/check/`, POST `/submit`, POST `/ceremony/start`, GET `/api/ceremony/`, POST `/ceremony/submit`, POST `/ceremony/publish`, POST `/verify`, GET `/api/runs/`, GET `/export/`.
  - GET on `/api/runs/` reaches only `status`, because `resume` and `verify-only` refuse every method except POST.
  - `TestInternalTransportWorksWithAuthOnAndOff` now expects 403 for internal GET `/api/preflight`, POST `/api/ladder`, GET `/api/campaigns`, POST resume and verify-only, GET `/wizard`, POST `/attack`, GET `/generate` and POST `/export/…`.
  - `TestInternalRoutesCoverTheDriver` runs `Repeat` (warm-up, rep, sweep, burst; offline and onchain) and `RunLadder` against `fakeConsole` through a recording transport. Every call is resolved through a mux built from `s.routes`. The test fails if a call's pattern/method is not in the allowlist, or if an allowlist entry is never called. I checked that it bites by deleting `/api/ceremony/` from the list: it fails, naming the call.
- **I3: Windows host CPU under WSL.**
  - When `/proc/sys/kernel/osrelease` contains `microsoft`, `hostCPUCommand` runs `powershell.exe -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"` through `cmdRunner`, with `hostCPUProbeTimeout` of 5 s. On failure the value is null. The output is trimmed, a comma decimal is accepted, and the value must be between 0 and 100.
  - Warn `host_cpu` above 25 %.
  - `host` now carries `guest_load1`, `guest_load5`, `host_cpu_pct` and `cpus`.
  - Checked live in WSL (6.18.33.2-microsoft-standard-WSL2): the command takes 1.6–1.8 s, and `sampleHost()` returned `guest_load1=0.79` with `host_cpu_pct=44`. That is the G7 blind spot: the guest looked idle while Windows was busy.
  - The seams are separate package vars (`readOSRelease`, `hostCPUCommand`), not `cmdRunner` itself, so faking them cannot race with background `CollectEnv` probes.
- **M12: host samples per repetition.**
  - `host_start` is sampled in the transport before the repetition's `/generate` is served.
  - `host_end` is sampled when the driver GETs `/export/<run>/perf.csv`. `collect` only does that after verify's `waitIdle`, so no sample falls inside a phase (sampling right after POST `/verify` would have landed inside the async verify).
  - Both are stored on the row in `campaign.json`, so they are in the export too.
- **M1:** `reps` must be ≥ 1 unless `sweep` or `burst` is set. The body is decoded with `DisallowUnknownFields`, so `"rep"` gives 400 `unknown field`. This applies to nested config fields too.
- **M3:** `fabric_not_configured` is an unforceable block for an on-chain run when Fabric is not enabled.
- **M4:** the `forceableBlocks` set is `{fabric_unreachable}`, and `PreflightWarning.forceable` is set on every finding. Any unforceable block gives 409 `preflight blocks this campaign, and force cannot override <codes>: each fails the first /generate or every run`, whether or not `force` is sent. A forceable-only block without force gives the old 409, which now adds "(only fabric_unreachable can be forced)".
- **M5:** `auditThreadsDefault()` uses `os.LookupEnv`. When `SAKSI_AUDIT_THREADS` is set (empty included), the value is trimmed, one leading `+` is allowed (Rust's usize parse accepts it), then it goes through `ParseUint` and must be ≥ 1. Anything else is a `verify_threads_invalid` unforceable block. Unset falls back to `RAYON_NUM_THREADS`, then NumCPU.
- **M6:** `loadCampaign` settles the rows (`refreshReps(rec, false)`) before saving the interrupted state. `listCampaigns` refreshes rows.
- **M7: rows are cached once final.**
  - `refreshReps` skips rows whose status is done or failed.
  - Rows are settled and saved when the next repetition is recorded, at `endRep`, and at the end of the job.
  - While a campaign runs, `loadCampaign` serves a copy of the in-memory record (`job.campaign`) instead of reading `campaign.json`, so only the newest in-progress row touches its run folder.
  - `TestCampaignMarkedInterruptedAfterRestart` rewrites `perf.csv` after settling and checks that the list still shows the cached 12.5.
- **M8: manifest and abort on read errors.**
  - The export adds `MANIFEST.txt`: per run `<run-id> (<kind> <index>, <status>)` with `included:` and `missing:` lines, plus a campaign section.
  - A missing file (`fs.ErrNotExist`) is listed as missing.
  - Any other open, read or zip error calls `panic(http.ErrAbortHandler)`.
  - `TestCampaignExportAbortsOnReadError` makes `timings.json` a directory to trigger this.
- **M9:** `serveRecovering` recovers a handler panic inside `RoundTrip` and returns it as an error. `TestInternalTransportRecoversHandlerPanic` covers it.
- **M10:** the runbook API table says that cancelling during the last repetition, with no sweep or burst after it, ends `done` with `summary.csv`.
- **M11:** `persistCampaign` logs a save failure and sets `save_error` (timestamp and error). A running campaign's GET shows it through the in-memory record, and the next successful save writes it. `TestPersistCampaignRecordsSaveError` covers it.
- **M13 (deferred to W3/W4):** a non-internal `/generate` (a manual wizard run) is not refused while a campaign or ladder job runs. That busy guard belongs with W3's "refused while busy" infrastructure guard.
- **Rebase note (not done now):** when W1 lands, `c.AttackPlan = nil` goes right after `c.SkipAttacks = true` in `handleCampaigns`, before `c.Validate()`.

### New or renamed tests

- New:
  - `TestInternalRoutesCoverTheDriver`
  - `TestInternalTransportRecoversHandlerPanic`
  - `TestPreflightHostCPUOnWSL`
  - `TestCampaignBodyValidation`
  - `TestBurstEscapesPreflight`
  - `TestCampaignForceOverridesOnlyFabricUnreachable` (replaces `TestCampaignRefusedOnBlockUnlessForced`)
  - `TestCampaignExportAbortsOnReadError`
  - `TestPersistCampaignRecordsSaveError`
- Renamed: `TestPreflightFabricReachability` → `TestPreflightFabric` (now also covers `fabric_not_configured`).
- Extended:
  - `TestPreflightVerifyThreads` (invalid values, `+8`, unset);
  - `TestCampaignExclusivityAndCancel` (host samples on the row);
  - `TestCampaignMarkedInterruptedAfterRestart` (settled and cached rows);
  - `TestCampaignExportBundle` (`MANIFEST.txt`);
  - `TestCampaignAgainstRealDemo` (host samples, manifest);
  - `TestInternalCallerCannotBeForged` (now forges POST `/generate`).

### Verification

- `gofmt -l` and `go vet ./...` are clean.
- Windows: `go test ./... -count=1` with `SAKSI_DEMO_BIN` set passes.
- WSL: `go test -race -count=1 ./...` passes. The demo-gated tests (campaign, cancel, full ladder) also pass under `-race` with the WSL `saksi-demo`. A throwaway live `sampleHost` test under `-race` passed; it was not committed.
- CI on PR #43: all 8 checks pass.

## Fix round 2 (scoped re-review: Ready to merge, five follow-ups)

- Commits:
  - `98aca86` fix(campaign): project the whole campaign's ledger against free space (N3, committed first on its own)
  - `bfcc0a9` fix(campaign): steadier host CPU sample, cached preflight host sample, served-like internal requests (N2, N1, N5, N4)
- Both pushed.

### Changes

- **N3: disk projection for the whole campaign.**
  - `campaignLedgerBytes(c, o)` computes:
    - `(warmups + reps) × perRun`, where `perRun = voters × positions × LedgerBytesPerBallot` (12,000);
    - plus `maxSweepSteps (12) × perRun` when there is a sweep;
    - plus `burst × positions × 12,000` for the burst.
  - `handleCampaigns` checks it for on-chain configs against the preflight's `free_bytes`. A failed probe does not refuse, the same as the disk gate.
  - Over the limit, it adds an unforceable `disk_short` block that names the total, the breakdown, the free bytes and the path. This replaces the burst-only `diskGate` check.
  - `TestCampaignDiskProjectsEveryRun` sets up 1 warm-up, 2 reps, a sweep and a 5-voter burst with free = total−1. Each single run fits and preflight alone does not block, but the campaign gets 409 naming the total and every part, with or without force. The helper's arithmetic is also checked.
  - `TestBurstEscapesPreflight`'s on-chain case now leaves room for the two reps but not the burst.
  - The runbook's `disk_short` row gives the formula.
- **N2: steadier host CPU reading.**
  - The command is now `$v = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 3).CounterSamples.CookedValue; (($v[1] + $v[2]) / 2).ToString([cultureinfo]::InvariantCulture)`. Single quotes inside are safe through WSL interop's argv quoting. The 5 s timeout is unchanged.
  - Measured live before choosing, with three runs each:
    - two `Win32_Processor` samples, keeping the second: 29, 25, 16 (3.4–3.6 s);
    - Get-Counter, averaging the last two: 29.4, 23.9, 9.1 (3.7 s).
  - Through Go's exec under `-race` in WSL it read 14.46, 13.47 and 18.07, each in 3.7 s.
  - The parser test now uses the Get-Counter output format (`29.430375364287\r\n`). The comma-decimal fallback stays.
  - Limitation: the counter path is English, so on a localized Windows the reading is null, not wrong.
- **N1: cached preflight host sample.**
  - `hostSampleCache` is a new field on `Server`, so `server.go` gets one line. It holds the sample for 10 s (`preflightHostTTL`), and at most one sample is in flight: other callers wait on its channel.
  - `preflight()` uses it. Per-repetition samples still call `sampleHost()` directly.
  - `TestPreflightHostSampleCached`:
    - 5 concurrent preflights run 1 command;
    - a preflight within the TTL runs 0 more;
    - an expired sample runs again;
    - `sampleHost()` is always live.
  - The test-only `hostSampleCache.reset()` lives in the test file.
- **N5:** the internal transport sets `r.RemoteAddr = "127.0.0.1:0"`, and `r.Body = http.NoBody` when the body is nil. `TestInternalTransportRequestLooksServed` covers it.
- **N4:** the `TestInternalRoutesCoverTheDriver` comment now says it covers the success path only. The error-branch pass was cheap, so I added it as `TestInternalRoutesCoverTheDriverOnErrors`: each allowed route in turn fails once with a 500, in both local and on-chain mode, and every later driver call must still be allowed.

### Verification

- `gofmt` and `go vet` are clean. Windows `go test ./...` with `SAKSI_DEMO_BIN` set passes.
- WSL `-race ./...` passes, and the demo-gated tests pass under `-race`.
- CI run 34842955992 on `bfcc0a9`: all 8 checks pass.

## Rebase onto #44 (attack timeline), AttackPlan drop, run_busy

- **Rebase:** `feat/wizard-campaigns` is rebased onto `origin/main` eabe840 with **no conflicts**: all 7 commits applied cleanly. New tip `12eb3fc`, force-pushed with lease.
- **AttackPlan:** `c.AttackPlan = nil` goes in `campaign.go` `handleCampaigns`, right after `c.SkipAttacks = true` and before `c.Validate()`; the burst copy inherits the nil.
  - `TestCampaignDropsAttackPlan` posts a config carrying a valid plan (stages ballots and close) with 1 warm-up, 1 rep and a 3-voter burst. It checks the 202, that `campaign.json` has no plan, and that each repetition's `run.json` contains no `attack_plan`.
  - Mutation check: with the line commented out, the test fails with 400 `attack_plan contradicts skip_attacks`.
- **run_busy: added, since the check is cheap.**
  - W1's pause (`pauseForAttacks`) runs inside the dispatched phase, so a paused run holds `s.busy[runID]` for the whole pause.
  - Preflight snapshots `s.busy` under `s.mu` and names each run, adding "(paused at the <stage> attack stage)" from `exec.PauseStatus`. The result is an unforceable `run_busy` block.
  - `TestPreflightBlocksWhileARunIsBusy` covers: a busy, paused run blocks with its name and stage; a forced campaign still gets 409; nothing starts; once the run is released the block clears.
  - The runbook's findings table gains the row, and the campaigns row notes that the plan is dropped.
- **Verification:**
  - `cargo build --release -p saksi-demo` built in the worktree (from main).
  - `gofmt` and `go vet` are clean.
  - `go test ./... -count=1` with `SAKSI_DEMO_BIN` pointing at that binary passes; the real-demo campaign and ladder tests ran, not skipped.
  - WSL `-race ./...` passes (demo-gated tests skipped there: the WSL binary predates #44).
  - CI run 34846503361 on `12eb3fc`: all 8 checks pass; PR is MERGEABLE.
