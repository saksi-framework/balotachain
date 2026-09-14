# W1: attack timeline, gate-matched verdicts, mount context

**Status:** DONE_WITH_CONCERNS (the concerns are listed below; none blocks merge)
**PR:** https://github.com/saksi-framework/saksi/pull/44 (branch `feat/attack-timeline`, base `main` adba922)
**Worktree:** `Q:/Code - LAPTOP/Code/projects/saksi-attack-timeline`

## Commits

| SHA | Message |
|---|---|
| 3400b7a | feat(chaincode): name the refusing gate in every submission rejection |
| 531a490 | feat(client-sdk): surface the endorsers' own words in a rejection |
| 9e8eccc | feat(auditor): report failed check ids in audit-stream --json |
| acdb9f5 | feat(campaign): attack timeline with gate-matched verdicts |
| e6cf93a | feat(wizard): attack panels at the real pause points |
| 6afe523 | docs: attack timeline, gate-matched verdicts, new CSV columns |
| 4c82209 | fix(campaign): reordered-ballots claims no gate, because none exists (review Important 1) |
| ebc24f0 | fix(campaign): an unstaged re-run never replaces a verdict mounted at a pause (Important 2) |
| 7bd7361 | fix(campaign): name the DKG and partial-decryption gaps as weaknesses (Important 3) |
| 39e0e7d | fix(campaign): review minors on the attack timeline and verdicts (Minors 4-9, 11) |
| 6fc771d | test(chaincode,campaign): pin live-attack gate order; document pause effects (Minors 10, 12) |
| e57f67a | fix(campaign): close the last reordering claims and three review items (fix round 2) |

## 1. True on-chain gate per scenario

I read the check order in `packages/saksi-bulletin/chaincode/contract.go`:

- **SubmitBallot**:
  1. decode (hex, protobuf)
  2. shape (version, election id, ciphertexts, nullifier present, presentation-proof length)
  3. credential signature
  4. election exists
  5. **election open**
  6. **nullifier unspent**
  7. position/count shape
  8. DKG published
  9. **CDS proof**
- **PublishDKGTranscript**: decode → shape → election exists → threshold and commitment-count consistency → not already published. There is **no validation of the commitment points**.
- **SubmitPartialDecryption**: decode → shape → CP proof **present** → election exists → closed → contest/trustee membership → not a duplicate. There is **no proof verification**.
- **Auditor findings**: I read the stable ids in `saksi-auditor` (`report.rs`, `dkg.rs`, `decryption.rs`, `lib.rs`) and its own tamper tests (`independent_verification.rs`).

| Scenario | Gate that should reject it | On-chain gate exists? | Live mount leaves no state? | Chosen mount |
|---|---|---|---|---|
| tamper-dkg-transcript | DKG integrity, auditor `dkg.decode` | **No** (shape and consistency only, no caller check) | **No**: accepted before the real transcript, it blocks it as `dkg-duplicate` and every ballot then fails to derive the election key | **Simulated** at the `dkg` pause; row says "on-chain: not checked (shape/presence only, no caller authorization); caught by the auditor" |
| tamper-ballot-proof | `cds` / `ballot.cds_proof` | Yes | Yes (endorsement refusal) | **Live, real election**, `ballots` pause, a tampered copy of the first unsent ballot |
| reused-nullifier | `nullifier` / `nullifier.unique` | Yes | Yes | **Live, real election**, `ballots` pause, the first unsent ballot carrying a committed ballot's nullifier |
| corrupted-ballot-bytes | `decode` / `ballot.decode` | Yes | Yes | **Live, real election**, `ballots` pause, the first unsent ballot with wire type 7 in its first tag |
| dropped-ballot | `stream.completeness` | No single-submission gate | n/a | **Simulated** at `close` |
| reordered-ballots | none: ordering is checked neither on-chain (no digest or ordering check) nor by the stateless auditor | **No** | n/a | **SKIPPED**, "no gate exists to test" |
| tamper-partial-decryption | `decryption.cp_proof` | **No** (proof presence only, no caller check) | **No**: accepted before the real partial, it blocks that trustee as `partial-duplicate` | **Simulated** at `ceremony`; row says "on-chain: not checked (shape/presence only, no caller authorization); caught by the auditor" |

A throwaway election was not needed. Every attack whose gate exists on-chain can be mounted against the real election and leaves nothing behind when refused. The others have no gate to test, so under the rule they are simulated and labelled.

**Mutations corrected (a verdict-honesty issue).**

- **tamper-partial-decryption** used `flipHexString` on the encoded partial. The last protobuf field is `contest_id`, so it rewrote the **contest id**, not the share or proof. Now it flips the CP proof response, matching the auditor's `tampered_chaum_pedersen_response_is_caught`.
- **corrupted-ballot-bytes** flipped the middle byte, which lands inside a CDS proof most of the time, so it duplicated tamper-ballot-proof. Now it sets the first tag's wire type to 7 (reserved), which fails in both Go and prost.
- **tamper-dkg-transcript** flipped the last hex nibble. **Correction (review):** I first wrote that this changed no `dkg.*` finding. That was wrong: the reviewer ran the old mutation on 12 fresh runs, and all 12 gave `dkg.decode`. The mutation now flips the low bit of trustee 0's constant term, the same mutation as the auditor's `tamper_dkg_transcript_detected`. A canonical ristretto encoding has that bit clear, so `dkg.decode` follows by construction rather than empirically. Old offline DKG verdicts are therefore not invalidated by the mutation change.

**Real-auditor evidence.** `TestScenariosRejectTheirMutations` ran with the rebuilt `saksi-demo`; `gate_observed` per scenario:

- tamper-ballot-proof: `ballot.cds_proof;decryption.cp_proof;decryption.threshold;tally.homomorphic_sum` (PASS)
- reused-nullifier: `ballot.cds_proof;ballot.credential;nullifier.unique;decryption.cp_proof;decryption.threshold;tally.homomorphic_sum` (PASS)
- dropped-ballot: `stream.completeness;…` (PASS)
- corrupted-ballot-bytes: `ballot.decode;…` (PASS)
- tamper-partial-decryption: `decryption.cp_proof` (PASS)
- tamper-dkg-transcript: `dkg.decode` (PASS)

A ballot-level mutation also breaks the aggregate, so the decryption and tally checks fail beside the declared one.

## 2. Gate-matched verdicts

- **Scenario schema**: `Scenario` gains `ChainGate`, `AuditGate`, `OnChainNote` and `MutateBallot` (a single-ballot mutation for the mid-submission mount). `LiveCapable()` is now `ChainGate != ""`.
- **`classifyLive`**: it reads the chaincode's `gate=<id>:` from `clientsdk.ErrorText(err)`, which includes the gRPC status details. The Fabric Gateway's own message is generic ("see attached details"); the chaincode text is only in the details. The existing path used `err.Error()`, which would probably never have shown the chaincode reason on a real network. That was unverified (the dev log says so), and I could not verify it here either. See concerns.
  - PASS = observed gate == declared gate.
  - INCONCLUSIVE = another gate (`actual` = `rejected by <gate>: <text>`) or no gate named.
  - FAIL = accepted.
- **`classifyAudit`**:
  - PASS = the declared check is in `failed_checks`.
  - INCONCLUSIVE = the audit failed on other checks, audit-stream produced no valid JSON, or the binary predates `failed_checks`.
  - FAIL = the audit passed the mutated copy.
- **Not mounted faithfully** is now INCONCLUSIVE (`not mounted: …`), not FAIL: copy error, mutation error, failed positive control, a mutation that changed nothing. FAIL is reserved for "a gate let it through".
- **Rejection rate**: `rejection()` counts PASS and FAIL only.
- **Scope**: this applies to the step-7 catalogue (`RunScenarios`), `/attack` (`RunStagedAttack`, mounted_stage `unstaged`, with chain status, tally presence, height and committed count read live) and the pauses.
- **Chaincode change**: stable `gate=<id>:` prefixes on SubmitBallot, PublishDKGTranscript and SubmitPartialDecryption rejections. The old text follows unchanged, and all chaincode tests use `Contains`. **Redeploy needed on the WSL network.**
- **Auditor change**: `audit-stream --json` gains `failed_checks [{check, detail}]`, deduplicated by id, with serde default. **saksi-demo must be rebuilt**; CI builds it from source.

## 3. Pause points

- **Config**: `ElectionConfig.AttackPlan *AttackPlan {stages, ballots_at, timeout_s}`.
  - `Validate` refuses it with `skip_attacks`, with `rep` set (a campaign), in groundtruth mode, with no or unknown or duplicate stages, with `ballots_at` outside [0,1), with a negative timeout, and with a ballots stage on fewer than 2 ballots.
  - `ballots_at` 0 means 0.5; `timeout_s` 0 means 300 s.
- **`timeline.go`** (new): the pause coordinator (`Executor.pauses`, `PauseStatus`, `DecidePause`), `pauseForAttacks`, `pausedWindow` and `joinWindows`, `mountBallotLive`, and `handlePause`. It is served at `/api/runs/<id>/pause` via one `case` line in `server.go`; the route is already admin under `/api/runs/`.
- **Where each stage pauses**:
  - `dkg`: `setupOnChain` after CreateElection.
  - `ballots`: inside `submitBallots`. It runs `runBench(ctx, at, …)` over [0,at). `bench.Run` returns only after every in-flight submit finished. Then it mounts, then runs [at,N) with `submit(at+k)`, offset progress and remaining `MaxDuration`. The results are joined by index and the window is the **sum of the halves**. Targets: the unsent ballot `at`, and the first committed ballot as the nullifier donor.
  - `close`: after CloseElection.
  - `ceremony`: `CeremonyPublish` before PublishTally, on-chain and offline.
  - Offline, `CeremonyStart` pauses dkg, ballots and close in order with simulated mounts and no ledger state.
- **Decisions**: `run` (one scenario, and the wait restarts), `run-all`, `skip`. On timeout the remaining attacks run and the lifecycle continues. A cancelled context resumes at once and the next step fails on it.
- **Journal**: `attack.pause {stage, election_status, ballots_committed, block_height, scenarios, live}`, `attack.result {scenario, verdict, gate_expected, gate_observed, live}`, `attack.resume {stage, reason, paused_ms}`.
- **No plan = unchanged**: `runBench` is a package var so a test can prove a no-plan run makes exactly one dispatcher call with n = N and unchanged options, reads no chain height, and stamps no `attack.*` event. Every pause call site is guarded by `AttackPlan.has(stage)` before any work, including the height read.
- **Perf marking**: `perf.csv` gains a final `security_run` column (`true` with a plan, empty otherwise), documented in `perfSchema` (`perf-schema.md`) and the runbook.

## 4. Mount context

`negative-tests.csv` appends `mounted_stage, election_status, ballots_committed, block_height, live, gate_expected, gate_observed`, and the summary row is padded. `ScenarioResult` gains `Mount MountContext`, `GateExpected` and `GateObserved`, which round-trip through `scenarios.json` (the reader in `mergeScenarioResults`). `ScenarioListing` exposes `chain_gate`, `audit_gate`, `gate_expected`, `gate_observed` and `mounted_stage`. The runbook's column description is updated. `live` duplicates `on_chain` because the brief listed it.

## 5. Wizard

Changes are limited to the setup attack block, the stage panels, the pause flow and step-7 verdict painting.

- **Setup**: a checkbox per stage, the during-ballots fraction and the wait. `config()` sends `attack_plan`, or null when attacks are skipped, the mode is groundtruth, or no stage is ticked.
- **Pause panels**: `watchPauses` polls `GET /api/runs/<id>/pause` every 700 ms while `/ceremony/start` or `/ceremony/publish` runs. The panel shows the mount state, the auto-continue time, "Run all attacks at this stage", "Skip this stage" and Run per attack. Passed stages render read-only; the old post-close Run buttons are gone.
- **Verdict display**: INCONCLUSIVE is an amber chip and a `?` rail dot. Every row shows expected and observed gates.
- **Bugs found in the browser check, both fixed**:
  - An in-flight poll repainted a stale pause (fixed with a generation counter).
  - The encrypt step's SSE handler, which stays open into the trustee step, stopped the ceremony watch on the publish "done" event (fixed by tracking which panel owns the watch).
- **Verified** through gstack's headless browser on an offline 6-voter run: all four pauses rendered, Run, Run all and Skip worked, the ceremony held the publish until decided, and there were no console errors. I also drove the HTTP API end to end offline with the real auditor: all 6 simulated scenarios PASS at their declared checks, with CSV and journal events as described.

## Tests

- **Chaincode**: the rejection tests now pin the gate ids, including a new undecodable-ballot case.
- **client-sdk**: `ErrorText` surfaces a `gateway.ErrorDetail` through `%w`.
- **Auditor**: the clean run has no `failed_checks`; the tampered run names `tally.accuracy` once.
- **Campaign (`timeline_test.go`)**:
  - `TestEveryScenarioIsJudgedByItsDeclaredGate`: per scenario, simulated and, when live-capable, live with the fake submitter. Declared gate → PASS, other gate → INCONCLUSIVE, accepted or clean → FAIL, and the submitted ballot carries the right mutation.
  - `TestSecurityRunPausesAtEachDeclaredMoment`: a fake gated ledger with the chaincode's check order. dkg sees only CreateElection. At the ballots pause exactly ballots 0..4 of 10 are committed, 5 were submitted, and the election is open. At close the election is closed and all 10 are committed. The live attacks PASS at cds, nullifier and decode. The journal pause order is correct, `window_ms` < the ballots `paused_ms` (300 ms sleep), and there are 10 commit latency rows.
  - `TestRunWithoutAnAttackPlanDispatchesExactlyAsBefore`.
  - `TestOfflineSecurityRunPausesAndHoldsThePublish`.
  - `TestUnattendedPauseRunsTheStageAndContinues`.
  - `TestValidateAttackPlan`.
  - `TestPauseIndexKeepsACastAndAnUncastBallot`.
  - `TestPauseAPI`.
- **Campaign (updated tests)**: live verdict tests (right, other and unidentified gate), `TestMountContextRoundTripsThroughTheAccumulatedState`, CSV header/row sentinel values for the new columns, the rejection rate excluding INCONCLUSIVE, the live-capable set, and the wizard function pins.
- **Commands run**:
  - `go vet` and `gofmt -l` clean in chaincode, client-sdk and campaign.
  - `go test ./... -count=1` passes in all three, with `SAKSI_DEMO_BIN` pointing at this worktree's rebuilt `target/release/saksi-demo.exe`.
  - `go test -race ./...` passes in WSL (copied to /tmp) for campaign and client-sdk.
  - `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings`, and `cargo test -p saksi-auditor --features demo` (107) pass.
- **CI**: all 8 checks green on PR #44 (Build, Lint, Security, Test on ubuntu and macos).

## Earlier on-chain verdicts to re-run

- **Re-run** all `on_chain=true` rows for tamper-ballot-proof, reused-nullifier and corrupted-ballot-bytes produced after `/ceremony/start` finished. They were refused by election-open, whatever `actual` said. Re-run as a security run with `attack_plan` including `ballots`, after the chaincode redeploy and the saksi-demo rebuild.
- **Discard, do not re-run live**: live tamper-dkg-transcript rows (refused as a duplicate transcript or at a structural check) and live tamper-partial-decryption rows. The latter's old mutation rewrote the contest id; it could have been accepted, or refused as a duplicate.
- **Re-run as well**: offline verdicts for tamper-partial-decryption and corrupted-ballot-bytes, because the mutation changed. Other offline verdicts are unaffected.


## Fix round 1 (review of PR #44)

**Important**

1. **reordered-ballots claims no gate.**
   - Expected: "no gate: ordering is not checked on-chain or by the stateless auditor". Actual (SKIPPED): "no gate exists to test".
   - The false digest comment, the wizard's step-7 note ("rejected at on-chain endorsement … fabric CI job"), and the claims in `7-attacks.md` and runbook §7 are corrected.
   - Test: `TestReorderedBallotsClaimsNoGate`.
2. **An unstaged result never replaces a staged verdict.**
   - `mergeScenarioResults` now returns `(merged, held, err)`. A fresh result with `Mount.Stage == unstaged` whose scenario already has a verdict mounted at a pause is held back, not upserted.
   - Both callers (`RunScenarios`, `saveScenarioResult`) pass `held` to `journalHeldBack`, which stamps `attack.rerun.unstaged {scenario, verdict, actual, live, gate_expected, gate_observed, kept_mounted_stage}` and publishes a note.
   - Unstaged still replaces unstaged, and staged still replaces staged.
   - Test: `TestUnstagedRerunNeverReplacesAStagedVerdict`.
3. **Notes and findings.**
   - Both notes now read "on-chain: not checked (shape/presence only, no caller authorization)", with "; caught by the auditor" appended on a PASS.
   - The findings are in the PR body, runbook, `7-attacks.md` and this report (concern 7).
   - Tests updated: `TestOnlyAttacksWithAnOnChainGateAreLiveCapable` and `TestSecurityRunPausesAtEachDeclaredMoment`.

**Minors**

4. **Window stopped before its pause point:** `pausedWindow` stamps `attack.resume {stage: ballots, reason: "not mounted: window stopped", paused_ms: 0}` when the first half stops early. Test: `TestWindowStoppedBeforeThePauseIsJournalledAsNotMounted`.
5. **/submit path ceremony pause:** I chose **pausing** `submitOnChain` between `submitPartials` and PublishTally.
   - It is smaller than refusing the stage, and refusing is not implementable, because a config does not say whether a run will go through `/submit` or the step-by-step ceremony.
   - Test: `TestSubmitPathPausesAtCeremonyBeforePublishTally`.
6. **Security-run finalisation:** `FinaliseInput.SecurityRun`, set from `c.AttackPlan != nil` in both Verify and the resume path, forces `scaling_limit: inconclusive`, leaves `sustained_tps` null, and stamps `security_run: true` in run.end. `sustained` itself is left as computed, as asked. perf.csv's `scaling_limit` follows. Test: `TestFinaliseSecurityRunHasNoScalingVerdict`.
7. **Audit overall:** exactly `"pass"` is FAIL, exactly `"fail"` goes to gate matching, and anything else is INCONCLUSIVE. Test: `TestAuditWithoutAVerdictIsInconclusive`.
8. **Catalogue summary:** "all scenarios upheld" only when the PASS count equals the non-SKIPPED rows; otherwise "N of M mounted scenario(s) rejected by their declared gate; the rest are INCONCLUSIVE". Test: `TestCatalogueSummaryClaimsAllUpheldOnlyWhenEveryMountedOnePassed`.
9. **Multiple endorsers:** `classifyLive` scans every `gate=<id>:` in the endorser text. PASS only when every id is the declared one; otherwise INCONCLUSIVE naming the first other id. `gate_observed` joins all distinct ids, and each reason is cut at the next endorser's message. Test: `TestLiveAttackNamingAnotherGateAnywhereIsInconclusive`.
10. **Chaincode gate order:** `TestLiveAttackMutationsMeetTheirDeclaredGateFirst` (adapted from the reviewer's repro, with assertions) checks, with a real credential and CDS proof:
    - reused-nullifier is refused at `nullifier`;
    - a ballot failing both nullifier and CDS is refused at `nullifier`;
    - the corrupted wire is refused at `decode`;
    - a tampered unsent ballot is refused at `cds`;
    - the same tamper after close is refused at `election-open`.

    `TestSubmitPartialDecryptionRejectsUnknownContestOrTrustee` now pins `gate=membership`. The campaign's fake gated ledger gains stand-in `shape` and `credential` gates in chaincode order, and `attackRun` ballots carry a marker signature; its comment points at the chaincode test as the real-crypto proof.
11. **Pause decisions are applied or refused, never dropped.**
    - `stagePause.closed` is set under the same mutex as the send. Accepting run-all or skip closes the stage.
    - On timeout, `closeIfIdle` closes the stage only if no decision is queued; a queued one is applied first.
    - A cancel closes the stage. A decision on a closed stage returns `errPauseEnded`, which is a 409.
    - Test: `TestDecisionsAfterTheStageClosesAreRefusedNotDropped`.
12. **Docs:** the runbook and perf-schema state that a simulated row mounted at a live pause describes the live election while its mutation acts on the generated run, and that the peak CPU/memory columns of a security run include the pause.
13. **Noted only (W2/W3):** W2's `jobs.running()` does not see single-election phases, so a campaign can start while a security run sits paused. It belongs with W3's busy guard.

**Additional notes**

- An offline `/run-all` with an attack plan never pauses, because offline Submit is a no-op and the ceremony is not called on that path. It is still marked `security_run`, which is conservative: it is excluded from RQ3.
- **Verification after the fix round:**
  - `gofmt` and `go vet` are clean.
  - `go test ./... -count=1` passes in chaincode, client-sdk and campaign, including `TestScenariosRejectTheirMutations` on the rebuilt saksi-demo (all offline scenarios PASS at their declared check).
  - `go test -race` passes in WSL for campaign, client-sdk and chaincode.
  - PR body updated.

## Fix round 2 (scoped re-review)

1. **I1 closed everywhere.** Stale "ordering enforced by the chaincode / at endorsement" claims fixed in `docs/wizard/deep-dive.md` (paragraph and table row, now "not checked (no gate)"), `docs/wizard/README.md` (guarantee table), `docs/wizard/7-attacks.md` (catalogue layer column and the close-stage line), `docs/research-election-console-desktop-session.md`, and `docs/onchain-explorer-handoff.md`. The grep of `docs/` and `web/` for digest / "ordering is enforced" / "at endorsement" / reorder left only the following, which I did not change:
   - true statements: CDS and ADR-0007 "at endorsement", and ADR-0006 lifecycle ordering, which is not about ballot order;
   - dated plans (2026-08-19 design and plan) and `development-log.md` history, which make no gate claim.
2. **Offline `/run-all` with an `attack_plan` returns 400**, pointing at the step-by-step ceremony (`handleRunAll`, not `Validate`). Test: `TestOfflineRunAllRefusesAnAttackPlan`. It also checks that the plan still validates, `/generate` accepts it, and `/run-all` without a plan is 202.
3. **`TestSubmitPathPausesAtCeremonyBeforePublishTally`** now writes two partial decryptions into the bundle. It asserts the last ledger call before the pause is `SubmitPartialDecryption` (both partials committed) and the first after it is `PublishTally`.
4. **No vacuous summary:** with `mounted == 0` the catalogue says "no scenario was mounted, so no security property was tested". The case (only `reordered-ballots`) is added to `TestCatalogueSummaryClaimsAllUpheldOnlyWhenEveryMountedOnePassed`.

**Verification:** full campaign suite green, including the demo-gated test on the rebuilt saksi-demo; `-race` green in WSL for campaign.

## Open items

- **Auditor adversary table (not changed here; a separate decision is with the user).** It claims "reorder detected by ledger digest" (`saksi-auditor/src/security_privacy.rs:18`, `:72-98`; `independent_verification.rs:100-115`), but `ledger::ledger_digest` is only called from tests: no verifier in production computes or checks it. This PR leaves those claims and tests alone.
- **Minor 13 (W2/W3):** a campaign can start while a security run sits paused.

## Concerns

1. **The gRPC-details path is unverified on real Fabric.** I did not touch the WSL network, so it is unconfirmed that Fabric 2.5's EndorseError carries the chaincode message only in `gateway.ErrorDetail`, and that `status.FromError` unwraps the client-sdk's wrapping. The unit test builds exactly that status shape. If the text never arrives, live rows come out INCONCLUSIVE ("unidentified gate"), never a false PASS. W6 is the real check.
2. **Redeploys are needed.**
   - The chaincode must be redeployed on the WSL network before live verdicts can PASS.
   - saksi-demo must be rebuilt, or every simulated verdict is INCONCLUSIVE.
   - The demo-gated test `TestScenariosRejectTheirMutations` now **fails** against the old binary at `saksi-instrument-gap/target/release`. Point `SAKSI_DEMO_BIN` at a binary built from this branch.
3. **Coordination with W2.** A config carrying `attack_plan` with `skip_attacks=true`, or with `rep` set, is refused by `Validate`. W2's campaign forcing `skip_attacks` must also drop `attack_plan`, or its repetitions will 400.
4. **A live ballot attack the chain accepted (a real FAIL)** leaves the tampered ballot committed. The real ballot `at` is then refused as a double vote when the window resumes, so the run ends failed with one drop. That is the correct loud outcome, but the run's throughput is then meaningless.
5. **One row per scenario, latest wins.** Re-running an attack in step 7 after a security run replaces the mid-submission verdict with an `unstaged` simulated one; `mounted_stage` shows which is recorded. Unchanged accumulation design.
6. **Scale.** A simulated mount copies the whole `ballots.ndjson` (existing `copyStream`), so security runs remain demo-scale. A resumed security run (after an interruption) does not pause again.
7. **Findings recorded for the thesis: two front-running denial-of-service paths** (corrected in review; the publisher is not a trusted party). The chaincode never calls `GetClientIdentity`, so any client with write access to the channel can get in first. Both are recorded in the PR body and the runbook's attack section. Caller authorization is **not** added in this PR; that is a separate decision.
   - **DKG transcript.** Right after `CreateElection`, an attacker publishes a transcript with a matching threshold and commitment count but a tampered commitment, and `PublishDKGTranscript` accepts it.
     - The real transcript is then refused as `gate=dkg-duplicate: a DKG transcript is already published for election …`.
     - With a non-canonical constant term, every `SubmitBallot` fails in `deriveElectionPublicKey`, with no gate id ("derive election public key: trustee commitment 0 constant term is not a canonical ristretto255 point").
     - With a substituted valid point, every honest ballot fails `gate=cds`.
   - **Partial decryption.** After `CloseElection`, an attacker submits any 32-byte share, with any proof attached, under trustee id X for contest C. It is stored under (election, C, X).
     - Trustee X's real share is then refused as `gate=partial-duplicate: trustee "X" already submitted a partial decryption for contest "C" …`.
     - The auditor rejects the planted share (`decryption.cp_proof`). Enough of these leave fewer than threshold valid shares, so no tally can be verified.
   - The same missing caller check lets any client squat an election id (`CreateElection`) or close an election early (`CloseElection`).
8. **WSL state.** The Ubuntu distro was stopped when I started; running the race tests started it. docker-desktop stayed stopped, and no Fabric, tmux or port-8090 resources were touched.
