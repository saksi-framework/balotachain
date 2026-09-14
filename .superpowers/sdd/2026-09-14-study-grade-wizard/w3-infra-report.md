# W3 report: guarded infrastructure controls (network reset, peer-restart fault)

- **Status:** DONE_WITH_CONCERNS (the concerns are behaviour choices a reviewer should confirm; nothing is failing).
- **PR:** https://github.com/saksi-framework/saksi/pull/46, `feat/wizard-infra` off `origin/main` 0cb72ce.
- **Worktree:** `Q:/Code - LAPTOP/Code/projects/saksi-infra`.
- **CI:** 8/8 pass on 851ef86 (Build, Lint, Security, Test on ubuntu and macOS).

## Commits

- `85f2b64` feat(campaign): guarded network reset and peer-restart fault
- `851ef86` docs(runbook): infrastructure API, fault arming rule and the T3 resume flow

## Files

New:
- `packages/saksi-campaign/reset.go`: the reset handler and job, `runStreaming`, `locateTierScript`, `startExclusiveJob`, `dropChainConn`
- `packages/saksi-campaign/fault.go`: `FaultPlan`, `handleFault`, `armedFault`, `peerFault`
- `packages/saksi-campaign/procgroup_unix.go` and `procgroup_windows.go`: kill the process group on cancel
- `packages/saksi-campaign/reset_test.go` and `fault_test.go`

Modified:
- `server.go`:
  - new `Server` fields `tierScript` and `runScript`;
  - the new route;
  - `faultGate` wired into the executor;
  - `tryStart` is replaced by `claim`, which returns a reason and refuses during a reset;
  - `busyRunsLocked`;
  - the `fault` action.
- `executor.go`:
  - the fault inside `submitBallots`;
  - `closeElection`, extracted from `setupOnChain`;
  - `Resume` now calls `resumeAndClose`;
  - `securityRun()`.
- `config.go`: `FaultPlan` field, `Validate` refuses it, `securityRun()`.
- `auth.go`: route table entry.
- `jobs.go`: the ladder goes through `startExclusiveJob`.
- `preflight.go`: uses `busyRunsLocked`.
- `internal.go`: comment only.
- `perf.go`: `security_run` schema text.
- `executor_onchain_test.go`: `fakeLedger.peerDown`.
- `campaign_test.go`: `tryStart` renamed to `claim`.
- `docs/research-election-console-runbook.md`: new *Infrastructure API* section, a T3 pointer, and the resume-closes note.

## What was built

### `POST /api/network/reset {voters, positions, confirm}`

The guards run in this order:

1. POST only (`405`).
2. `isLoopback(RemoteAddr)`, or `403`. This applies even with auth on and an admin session.
3. JSON body with `DisallowUnknownFields`, or `400`.
4. `confirm == "RESET"` exactly, or `400`.
5. `voters >= 1` and `positions >= 1`, or `400`.
6. Fabric enabled, or `400` with the `errNoFabric` text.
7. `tierScript()`, or `501` with the reason: Windows, no bash on PATH, the console binary not inside a git checkout, or no `tools/tier.sh`.
8. `startExclusiveJob`, under `s.mu`:
   - a running job gives `409` naming it (`busyResponse`);
   - otherwise, busy runs (paused ones annotated with their stage) give `409` with a `busy` list;
   - otherwise it claims the slot as kind `network-reset`.

Admin-only comes from the route table (`/api/network/reset: accessAdmin`). The route is not in `internalRoutes`, so an internal call gets `403` (tested).

The job:
- Opens `<runs>/network-resets.log` (append). If it cannot, the job fails and the reset does not run unrecorded.
- Writes a start line with the requester and the command.
- Runs `bash <root>/tools/tier.sh V P` with cwd set to the repo root, under a `networkResetTimeout` (15 min) context.
- Sends stdout and stderr, merged line by line, to both the job log (last 200 lines) and the console log.
- Writes an end line with the exit code, the duration and the outcome.
- Result: `{exit_code, timed_out, duration_ms, voters, positions, log}`. A non-zero exit, a timeout or a spawn error fails the job.
- Drops the cached `/api/trail` connection whatever the outcome.
- `runStreaming` puts the child in its own process group (`Setpgid`), and `cmd.Cancel` kills `-pgid` with SIGKILL, with `WaitDelay` 5 s. On Windows exec's default kill applies, which does not matter because a reset is refused there.

Busy parity:
- `claim` refuses every run phase while a reset job holds the slot. The ladder and campaigns are refused by the slot itself.
- The ladder now also refuses while any run phase is running (`startExclusiveJob`); a fault run's phase is one.
- A campaign already refused through preflight `run_busy`.
- A reset refuses while a fault run's phase is active, since the phase holds the run's lock.
- A fault never fires while a job is active: `Executor.faultGate`, set in `NewServer`, is checked at the moment of firing and stamps `fault.refused`.

### Identity reload finding

Nothing is cached at startup:
- `FabricConfig.Connect` goes through client-sdk `Connect`, which calls `os.ReadFile` for the TLS CA, the certificate and the key on every call.
- Every executor phase, and the ceremony status refresh, calls `Connect` afresh.

The only cached connection is `Server.chainConn`, used by `dialChain` for `/api/trail`. It holds the old TLS `CertPool` and the old signing identity, so after cryptogen regenerates the material, trail requests would fail until a restart. The reset job now calls `dropChainConn()`.

cryptogen writes fixed file names (`keystore/priv_sk`, `signcerts/User1@org1.example.com-cert.pem`, `peers/peer0.org1.example.com/tls/ca.crt`), so the paths `tools/up.sh` passed at startup stay valid. This was verified live: the cert mtime changed at the reset.

`TestResetReloadsTheFabricIdentity` shows it:
1. It writes self-signed identity A (ECDSA P-256, PKCS #8) and connects through `s.dial()`. `Gateway().Identity().Credentials()` is A.
2. The fake `tier.sh` writes identity B at the same paths.
3. After the job, `s.dial()` presents B, and a fresh `FabricConfig.Connect()` presents B.

Without `dropChainConn` the test fails, because the cached connection still presents A.

### `POST /api/runs/<id>/fault {kind, at, down_s, confirm}`

The guards run in this order:

1. POST only.
2. Loopback, or `403`.
3. A valid run id.
4. JSON body with `DisallowUnknownFields`.
5. `confirm == "RESTART"`, or `400`.
6. The run record.
7. `FaultPlan.validate(voters x positions)`, or `400`:
   - `kind == "peer-restart"`;
   - `0 < at < 1`;
   - `5 <= down_s <= 120` (`faultMinDownS` / `faultMaxDownS`);
   - `int(at x n)` in `[1, n-1]`.
8. Eligibility, or `409`: mode onchain, `Rep == nil`, `AttackPlan == nil`.
9. Fabric enabled, or `400`.
10. `claim(runID)` held for the rest of the handler, or `409`.
11. The journal is readable, or `409` ("generate it first").
12. The journal has no `stage.ballots.start`, or `409` ("already started").

When every guard passes, it writes `fault_plan` into `run.json`, stamps `fault.armed`, and answers `200 {kind, at, down_s, at_index, ballots, container, run_id}`.

**Decision: `fault_plan` on `ElectionConfig`, not "requires an `attack_plan`".**
- A fault is itself the perturbation. Requiring attacks would force ballots-stage pauses (which split the window with `pausedWindow`) into the T3 run and confound its drops and its resume.
- So a fault run must NOT carry an `attack_plan` (`409`), and `securityRun()` is `AttackPlan != nil || FaultPlan != nil`. It feeds `run.end` / `perf.csv` `security_run` in both `finaliseInput` and `resumeBallots`.
- A campaign repetition can never carry a fault, for two reasons. `Validate` refuses any config that carries `fault_plan`, and every posted config passes through `Validate` (`/generate`, `/run-all`, campaigns, `RunStore.Create`). The route also refuses a run with `Rep != nil`.

**Arming rule: only before the ballots stage starts, and only through the route.** Two reasons:
- Arming at `/generate` would bypass the loopback and confirm guards, because `/generate` is reachable by the internal driver and by non-loopback admins.
- Arming at the dkg pause is not offered: a fault run has no attack plan, so there is no dkg pause.

The race is closed two ways:
- The route holds the run lock for its check-and-write.
- The window re-reads `fault_plan` from `run.json` when it opens (`armedFault`), so a phase dispatched from a record read before the write still fires the fault.

**Firing (`peerFault`, created in `submitBallots`).**

1. The window stamps `fault.window {at_index, down_s}` when it opens.
2. The submit closure calls `fault.dispatched(i)`. The first `i >= at_index` wins a CAS. It checks `faultGate`; if a job is running it stamps `fault.refused`, runs no docker command, and the window carries on. Otherwise it continues with step 3.
3. That worker, synchronously:
   - reads the committed count and `chainHeight(led)`;
   - runs `docker stop peer0.org1.example.com` through `Executor.run` (60 s timeout; `faultPeerContainer` is a constant, and no other container name exists in the code);
   - stamps `fault.start {kind, container, at_index, ballots_committed, block_height, stop_ms, ok}`.
4. The other workers keep dispatching. Their failures are drops, counted as usual.
5. A goroutine (`recover`):
   - sleeps `down_s`, cut short if the phase is cancelled;
   - always runs `docker start`;
   - stamps `fault.end {down_ms, ballots_committed, ok}`;
   - polls readiness (1 s poll, `peerReadyTimeout` 3 min). Each probe opens a fresh `FabricConfig.Connect()` and calls `ChainInfo`, so the time measures the peer, not gRPC reconnect backoff.
   - then waits for the window's own connection to answer too, because the receipts are collected over it next;
   - stamps `fault.peer_ready {ok, wait_ms, block_height, ballots_committed}`.
6. After `runBench`:
   - if the fault fired and `Dropped > 0`, it sets `res.Stopped = true`, so the window is stamped `stage.ballots.interrupted` (with `fault` set) rather than `stage.ballots.end`, and `planResume` accepts it;
   - `fault.wait()` runs after the window's closing stamps and before receipts are collected, so the phase (and its run lock) lasts until the peer answers;
   - if the window ended before `at_index`, `wait()` stamps `fault.not_fired`.
7. `submitBallots` returns `"N of M ballots did not commit"`, so the ceremony stops before `CloseElection`.

**Resume change (needed for the flow).**
- Before this PR, `Resume` submitted only the pending ballots. The election stayed open, and no route could close it. `writeLedgerHeader` needs `GetTally`, so a resumed run could never publish a tally or pass the ledger audit, and "Verify with `ledger_matches_local` true" was impossible.
- `resumeAndClose` now runs `resumeBallots`, then, only if it succeeded, commits `CloseElection` through `closeElection` (the close-stage pause included, if a plan lists it). It then calls `writeCeremony`, the same end state `/ceremony/start` leaves.
- The operator then runs `/ceremony/submit` for at least the threshold of trustees, `/ceremony/publish`, and `/verify`.
- This applies to every resume, not only fault runs.

## Tests

Test functions:
- `reset_test.go`:
  - `TestResetRefusals`
  - `TestResetNeedsAdminAndLoopbackWithAuthOn`
  - `TestInfraRoutesAreNotInternal`
  - `TestResetRefusedWhileAnythingIsBusy`
  - `TestResetExcludesPhasesLadderAndCampaigns`
  - `TestResetJobRecordsOutputAndExitCode`
  - `TestRunStreamingCapturesOutputExitCodeAndKillsOnTimeout`, which uses `TestResetScriptHelper` as the child process
  - `TestLocateTierScript`
  - `TestResetReloadsTheFabricIdentity`
- `fault_test.go`:
  - `TestFaultRouteRefusals`
  - `TestFaultArmsAGeneratedRun`
  - `TestPeerRestartFaultFiresAtItsBallotAndResumeFinishesTheRun`
  - `TestPeerRestartFaultRefusedWhileAJobRuns`
  - `TestPeerRestartFaultNotReachedIsStamped`
  - `TestArmedFaultIsReadWhenTheWindowOpens`

Coverage against the brief's list:
- **Loopback-only even as admin from a non-loopback address:** yes, for both routes (IPv4, IPv6, 10.x).
- **Wrong or missing confirm gives `400`:** yes, including lowercase and padded.
- **Busy gives `409` for each source:** a phase, a paused run, a campaign job, a ladder job, a reset job.
- **Windows or no bash:** `501` with the reason; also no script, and not a git checkout.
- **Job log:** captures output and exit code (0 and 3); the console log file has the start, the output and the end.
- **Timeout kills the process:** the real `runStreaming` against a hanging child.
- **Identity reload after a reset.**
- **Fault only on on-chain security runs:** offline, repetition and attack-plan runs are refused; the run becomes a security run once armed.
- **`at` and `down_s` bounds.**
- **The fault fires at the right ballot count against a fake ledger** and stamps the journal events in order: concurrency 1 makes the count exact (30 of 100).
- **Only the exact container name reaches docker:** asserted as exactly `[docker stop peer0.org1.example.com] [docker start peer0.org1.example.com]`.
- **Also:** resume after the fault, `fault.refused`, `fault.not_fired`, a late arm read when the window opens, `/generate` with `fault_plan` refused, and the route table and internal allowlist.

Runs:
- Windows `go test -count=1 ./...` with `SAKSI_DEMO_BIN` set to this worktree's `target/release/saksi-demo.exe`: ok (53 s).
- WSL `go test -race -count=1 ./...` with `SAKSI_DEMO_BIN` set to the WSL release build of this branch: ok (121 s). Log: `~/saksi-logs/w3-race.log`.
- `gofmt` and `go vet` are clean.

## Live check (WSL, 2026-09-14)

Setup:
- Docker Desktop was stopped at the start. I started it, then restarted the exited containers (`docker start orderer peer0.org1 peer0.org2`) so that `up.sh` would skip its own bring-up.
- WSL `~/Code/saksi`: `git checkout feat/wizard-infra` at 851ef86.
- tmux `console`: `./tools/up.sh` built saksi-demo release and the console. Log: `~/saksi-logs/w3-up.log`.
- Console pid 1439, started 13:33:09Z, auth off, and never restarted afterwards.
- Driver helpers: `~/saksi-logs/w3lib.sh`.

### (a) Reset, then an SP-1K election with no restart

- A reset with confirm `"reset"` was refused with `400`.
- The real reset: job `network-reset-20260914-133612-1`, status `done`, `exit_code` 0, 93.6 s. `network-resets.log` has the start and end lines.
- The chaincode package id changed from `saksi-bulletin_1.0-44a30454…` to `saksi-bulletin_1.0-1fbb2faa…`. That is the #44 gate-prefix chaincode, whose source (`contract.go:691`, `gate=<id>:`) is in the checkout.
- The User1 certificate was regenerated at 13:36:19Z.

The election `w3-sp-1k-gate-20260914-133829-1`:
- Config: 1000 voters, 1 position, 4 candidates, 5 trustees with threshold 3, realistic distribution, concurrency 128, `attack_plan {stages:["ballots"], ballots_at:0.5}`.
- `/generate` and `/api/check` passed; `/ceremony/start` paused at ballots with `ballots_committed` 500, `block_height` 18, election open, live.
- **Receipts: 20 blocks, each with exactly 50 `SubmitBallot`.**
- Live verdicts at the ballots pause (`negative-tests.csv` `actual`, verbatim):
  - `tamper-ballot-proof`: **PASS**, `gate_expected` cds, `gate_observed` cds:
    `rejected by chaincode gate cds (the declared gate): contest "president/cand0" CDS well-formedness proof failed: CDS branch 0 verification equation failed`
  - `reused-nullifier`: PASS, nullifier/nullifier:
    `rejected by chaincode gate nullifier (the declared gate): nullifier already spent in election "w3-sp-1k-gate-20260914-133829-1" (double vote)`
  - `corrupted-ballot-bytes`: PASS, decode/decode:
    `rejected by chaincode gate decode (the declared gate): decode ballot: proto: cannot parse invalid wire-format data`
  - The W1 open question is therefore answered: the `gate=<id>:` text survives Fabric's gateway transport for all three live gates.
- Trustees 1-3, publish, verify: `run.end` `failed:false`, `security_run:true`, `ledger_audit:"ok"`, `ledger_matches_local:true`; every contest `E=0`.

### (b) SP-10K security run with a peer-restart fault at 0.5, down 20 s

- `/api/ladder` ran as a job first (the tier is above 1000 voters): done, commit 851ef86. Preflight had no warnings.
- The run: `w3-sp-10k-t3-20260914-134019-6`, 10,000 voters, 1 position, concurrency 128, no attack plan.

Arming:
- Missing confirm: `400`. `down_s` 3: `400`.
- Armed: `200 {at_index:5000, ballots:10000, container:"peer0.org1.example.com"}`; `run.json` has `fault_plan`.

Live guard checks during the phase:
- `POST /api/network/reset` got `409 {"busy":["w3-sp-10k-t3-…"]}`.
- `POST /api/ladder` got `409` naming the run.

Journal (`/ceremony/start`; the phase took 38 s):
- `fault.window {at_index:5000, down_s:20}`
- `fault.start {at_index:5000, ballots_committed:4878, block_height:142, stop_ms:772, ok:true}`
- `stage.ballots.interrupted {submitted:10000, committed:5000, dropped:5000, fault:"peer-restart", stopped:true, window_ms:6107}`
- `segment.end {index:0, committed:5000, tps:818.6}`
- `fault.end {down_ms:20244, ballots_committed:5000, ok:true}`
- `fault.peer_ready {wait_ms:1060, block_height:146, ok:true}`, at mono 31463: about 4 s after the fresh probe answered, spent waiting for the window's own connection.
- `stage.ceremony.end`

Resume (`POST /api/runs/<id>/resume` answered `202 {segment:1, remaining:0}`; `remaining` is the journal estimate, and the exact figure followed):
- `segment.start {index:1, pending:4946}`: **the chain already held 54 of the 5000 ballots the window counted as dropped.** They were in flight when the peer stopped, the orderer committed them, and only their commit status was lost. The resume skipped them.
- `stage.ballots.end {segment:1, submitted:4946, committed:4946, dropped:0, replayed:0}`
- `run.end {resumed:true, sustained:false, scaling_limit:"inconclusive", security_run:true, failed:false}`
- `receipts.csv` has 1 `CloseElection`; `ceremony.json` is ready and closed.

Trustees 1-3, publish, verify:
- `ledger.dump {ballots:10000, read_path:"batched", ok:true}`
- `run.end {failed:false, ledger_audit:"ok", ledger_matches_local:true, resumed:true, security_run:true}`
- `correctness.csv`: 4 contests x (local, ledger), all `E=0`, `pass` true, `ledger_matches_local` true.
- `perf.csv`: committed 10000, dropped 0.

Leftovers on the WSL box:
- The network is up on the fresh ledger holding these two elections.
- The console is still running in tmux `console` (window `race` is idle).
- No run folders were deleted.

## Concerns / notes for the reviewer

1. **The resume behaviour changed for every resume**: it now closes the election and opens the ceremony. It was needed (a resumed election could never be closed, tallied or ledger-audited), but it is a lifecycle change outside the fault path. The close-stage attack pause runs if a plan lists it.
2. **`res.Stopped = true` for a faulted window with drops.** The journal and `submit-metrics.json` say `stopped:true` even though every ballot was dispatched. I used it to reuse the existing interrupted, resumable semantics rather than adding a new state.
3. **`fault.peer_ready`'s `mono_ms`** includes the wait for the window's own gRPC connection (about 4 s live). `wait_ms` is the fresh-connection figure (1.06 s). T3 analysis should use `wait_ms`.
4. **Loopback includes anything local**: SSH tunnels, and the Windows browser through WSL localhost forwarding, which W4 needs. With auth off the guards are therefore loopback, the typed confirm and the Host/Origin guard. `allowedHosts` defaults to the bind address, so DNS rebinding is blocked.
5. **The ladder now refuses while any run phase is running**, which is new behaviour. No existing test depended on the old behaviour; `TestCampaignExclusivityAndCancel` needed the running job named first, which is done.
6. **A fault armed on a run whose phase is later dispatched while a campaign runs does not fire** (`fault.refused`). The run's ballots still share the network with the campaign, as any single run does today. That is not new, but it means a refused fault run should be discarded.
7. **The live check (a) election used an `attack_plan`** (to exercise the gate), so it is a security run. The "50 ballots/block" evidence is from that run: its window was split at 500, and all 20 blocks were still full.
8. **Not tested live:** the `501` Windows refusal through a real Windows console, and the 15-minute timeout against the real `tier.sh`. Both are covered by unit tests; the process-group kill ran under `-race` on Linux.

## Fix round 1 (review of PR #46)

The branch is rebased onto origin/main 5420034 (includes #45) without conflicts. Commits: `149d483` (the code fix and its tests), `ff7d4cc` (runbook). Both are pushed with force-with-lease.

- **I1:** `handleCampaigns` now claims the slot through `startExclusiveJob(w, "campaign")`, so the busy check and the claim both happen under `s.mu`. Test `TestCampaignRefusesARunThatStartedDuringPreflight` blocks preflight inside `freeSpace`, claims a run, then releases, and expects 409 naming the run. Mutation-checked: with the old `jobs.start`, the test gets 202.
- **I2:**
  - Arming goes through `claimAlone`, which returns 409 under `s.mu` if a job is running or another run is busy.
  - `Server.faultGate(runID)` refuses at firing time if a job is running or any run other than runID is busy; it is wired as `exec.faultGate`.
  - `busyRunsLocked(except)` now takes an exclusion.
  - Tests: `TestFaultArmingRefusedWhileTheNetworkIsInUse` covers another run, a campaign job, and window_s. `TestPeerRestartFaultRefusedWhileAnythingElseUsesTheNetwork` has three subtests (campaign job, another run's phase, only its own phase fires). Mutation-checked: without the other-run check, the "another run's phase" subtest fails.
- **I3:**
  - The fault goroutine is renamed `restore`; a deferred `recover()` calls `start()` (runs `docker start` once, then decrements `peersDown`) and stamps `fault.panic`.
  - The stop path also calls `start()` on a panic, then re-panics.
  - `Executor.peersDown` is incremented before `docker stop`. `Executor.RestorePeer()` runs `docker start` when the count is above 0.
  - `main.go` `restorePeerOnSignal`: on SIGINT or SIGTERM, calls `RestorePeer` and then exits 1. It is small; the testable part is `RestorePeer`.
  - Test `TestPeerIsStartedAgainOnShutdownAndPanic` has two subtests: shutdown while the peer is held down, and a panic in the sleep.
  - Runbook: manual `docker start` + `tools/up.sh status` for a console killed any other way.
- **Resume:**
  - `resumeAndClose` returns "the election stays open: resume again" when `ctx.Err()` is set after `resumeBallots`, before the close.
  - Retryable close: `planResume` returns `CloseOnly` when the last window was a resume (a `segment.start` index of 1 or more seen) that ended with `dropped` 0, and `closeRecorded` is false (no CloseElection receipt, no ceremony.json).
  - `resumeBallots` refuses a CloseOnly plan.
  - A close error whose `clientsdk.ErrorText` contains "is already closed" counts as success. `resume.close {ok, close_only, already_closed}` is stamped.
  - Tests: `TestResumeStoppedPartWayDoesNotClose`; `TestResumeCloseIsRetryable`, whose two subtests are a retry that succeeds and a retry against an already-closed election, and which asserts the close-only resume submits no ballots and that nothing is left to resume afterwards.
  - The acceptable loss is documented in both code and runbook: an attack run cancelled at its ballots pause.
- **M2:** `Remaining` is now n minus the interrupted window's committed count, falling back to n minus last_done after a hard kill. A faulted 100-ballot window reports 70, which the firing test asserts. The live SP-10K run would now show 5000 against a true 4946 (an upper bound). The runbook names `segment.start.pending` as the exact count.
- **M3:** The runbook explains the closed-loop drop semantics and suggests send_rate for loss over the outage. verify-only is REQUIRED (step 4). The firing test runs verifyOnly before the resume and checks `reconciled: true`.
- **M4:** `waitReady(probe)` returns windowReady. `fault.peer_ready` has `window_conn_ready`, and `ok` requires both. `peerReadyTimeout` is now a var. Test: `TestPeerReadyNeedsTheWindowConnection`.
- **M5:** After exit 0, `readNewChain()` calls `s.dial()` and then `ChainInfo`, retrying for `resetCheckTimeout` (1 min) every 2 s and dropping a connection that fails. The result carries `chain_height` or `chain_error`; an unreadable chain fails the job. Test: `TestResetFailsWhenTheConsoleCannotReadTheNewNetwork`. The identity test now expects the job to fail on its dead endpoint, and still asserts the new identity is used.
- **M6:** window_s > 0 returns 409 (tested).
- **M7:** The runbook covers the reset's own process group, that it survives Ctrl-C, and that it is not busy-guarded after a console restart.
- **M8:** `copyLines` uses `bufio.Reader.ReadLine` and cuts lines over 1 MiB with a " [line cut at 1 MiB]" marker, then keeps reading. The helper test prints a 2 MiB line followed by another line.
- **M9:** The journal.go `SecurityRun` comment is updated.
- **M10:** `decodeExactKeys` walks the object's tokens, accepts only exact allowed keys, rejects duplicates and trailing data, then unmarshals. It is used by both routes. Tests cover `Confirm`, a case-folded duplicate (`CONFIRM`), an exact duplicate, a non-object body, and `KIND`.
- **Verification:**
  - Windows `go test ./...` with `SAKSI_DEMO_BIN` passes.
  - WSL `go test -race ./...` at ff7d4cc passes (126 s, `~/saksi-logs/w3-race2.log`).
  - CI 8/8 passes on ff7d4cc.
  - `gofmt` and `go vet` are clean.
- **Not re-run live:** the signal handler and the post-reset chain read. The live network still holds the two W3 elections, and a reset would destroy them. The WSL console in tmux still runs the 851ef86 binary; rebuild it with `tools/up.sh` before W4/W6.

## Fix round 2

Commit `fa4f4f8` (pushed).

- **N1: no phase starts while a fault holds the peer.**
  - `Executor.faulting`, guarded by `faultMu`, marks a fault active from the moment it fires until `restore` ends, which is after `fault.peer_ready`.
  - While any fault is active, `claim` refuses and names the fault's run.
  - Test: `TestNoPhaseStartsWhileAFaultHoldsThePeer`. It checks that `claim` is refused and that `/generate` answers 409 naming run-1, then that phases start again once the fault is over.
- **N2: a resume that still drops ballots stays resumable.**
  - `resumeBallots` now stamps the window interrupted when `res.Stopped || dropped > 0`.
  - Test: `TestALossyResumeStaysResumable`. The first resume drops 1 ballot and the plan stays open for segment 2; the second resume commits that ballot and closes.
  - `TestResumeFailsOnAGenuineDrop` now asserts `stage.ballots.interrupted` instead of `stage.ballots.end`.
- **N3: a Ctrl-C during the stop waits for it.**
  - `Executor.stopMu` is held across `docker stop`, and `RestorePeer` takes it before checking `peersDown`.
  - Test: `TestRestorePeerWaitsForAStopInFlight`. A fake stop blocks, `RestorePeer` does not return until the stop is released, and the recorded order is stop-begin, stop-end, start.
- **N4:** `signal.Stop(sigs)` runs after the first signal, so a second Ctrl-C exits at once.
- **N5:** a failed close counts as done only when the error contains `fmt.Sprintf("election %q is already closed", b.ElectionID)`.
- **N6:**
  - The `busyRunsLocked` comment is fixed.
  - The `handleResume` comment now describes the estimate: an overcount from the committed count, and an undercount after a hard kill (ballots in flight).
  - The runbook now documents the close-stage pause being skipped when a retried close finds the election already closed.
- **Resume refusals (from the #47 review).** `handleResume` now refuses before dispatch:
  - 400 with the `errNoFabric` text when Fabric is not configured;
  - 409 with the `loadBundle` error ("read bundle: …") when there is no readable bundle.

  These come after `planResume`, so an offline run still gets its "on-chain" 409. Test: `TestResumeAPIRefusesBeforeDispatch`, covering no Fabric, no bundle, and nothing to resume, and checking that none of them claims the run.
- **Runbook:**
  - phases are held off during a fault;
  - a lossy resume stays resumable;
  - the synchronous resume refusals;
  - the exact already-closed match;
  - the signal behaviour while a stop is in flight, and the second Ctrl-C.
- **Verification:**
  - Windows full `go test ./...` with `SAKSI_DEMO_BIN`: ok.
  - WSL `-race` on the fault, resume, campaign, reset, preflight, ladder, internal and verify-only tests at `fa4f4f8`: ok, 69 s (`~/saksi-logs/w3-race3.log`).
  - CI: 8/8 pass.
