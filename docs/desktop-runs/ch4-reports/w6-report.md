# W6 validation report — desktop, saksi 4a38a54

Date: 2026-09-29 (13:39–14:02 UTC). Machine: the study desktop (Windows 11 host, Fabric 2.5 in WSL2
Ubuntu via Docker Desktop). Build: saksi `4a38a54` (WSL checkout `~/Code/saksi`, `git status` clean
before and after). Console: tmux `console`, `http://127.0.0.1:8090`, on-chain enabled, phase
timeout 5h, auth off; alive and `./tools/up.sh status` green at the end.

Items ran strictly one at a time. Preflight host CPU before each measured run: 24.1 % (wizard
campaign; under the 25 % gate, marginal), 9.0 % (CLI repeat), 20.8 % (security run), 5.6 % (T3).
No campaign repetition was contended (every host sample 3.4–21.7 %).

Evidence lives in WSL: `~/w6/` (logs, job JSON, export, cost-model output) and the run folders under
`~/.saksi/campaign/runs/`. Driver scripts: the session scratchpad (`drive.py`, `s*.sh`); none are in
either repo.

| # | Item | Verdict |
|---|---|---|
| 1 | `go test -race` fault / resume / campaign tests | **PASS** |
| 2 | Live network reset ends done with `chain_height` | **PASS** |
| 3 | Validation ladder, preflight ladder row ok on 4a38a54 | **PASS** |
| 4 | Wizard SP-1K campaign vs CLI `--repeat`, medians within 5 % | **FAIL** (8.8 % TPS, 6.6 % p99) |
| 5 | On-chain security run, full attack timeline | **PASS** (8 PASS, `reordered-ballots` SKIPPED as designed) |
| 6a | T3 fault: `window_conn_ready` within 3 min, refusals behave | **PASS** |
| 6b | Cancel during `down_s` restores the peer | **PASS** (phase cancel; console Ctrl-C not exercised, see below) |
| 6c | Second `CloseElection` through the real gateway says "is already closed" | **PASS** |
| 7 | Campaign export bundle loads in `cost_model.py` | **PASS, with the known gap confirmed** |

## 1. `go test -race` — PASS

`packages/saksi-campaign`, WSL, go1.23.4, `CGO_ENABLED=1`, `SAKSI_DEMO_BIN=~/Code/saksi/target/release/saksi-demo`.
Selected: every `Test*` in `fault_test.go`, `executor_resume_test.go`, `campaign_test.go`, plus any
test named `*Resume*`, `*Fault*` or `*Campaign*` elsewhere in the package — 61 tests.
`go test -race -count=1 -run '^(...)$' -v .` → exit 0, **61 PASS, 0 FAIL, 0 SKIP, no `DATA RACE`**, 60 s.
Log: `~/w6/item1-race.log`; test list: `~/w6/tests.txt`.

## 2. Live network reset — PASS

`POST /api/network/reset {"voters":1000,"positions":1,"confirm":"RESET"}` from 127.0.0.1 (inside WSL)
→ `202 {"job":"network-reset-20260929-134144-1"}` → job `done`, `exit_code 0`, `timed_out false`,
`duration_ms 92201`, **`chain_height 6`**; log ends "console reads the new network: channel height 6";
`network-resets.log` records `end: exit 0 after 1m32s: ok`. Evidence: `~/w6/item2-reset-job.json`.
A second reset (before the CLI repeat, item 4) also ended done: `network-reset-20260929-134942-4`,
`chain_height 6`, 90.9 s.

## 3. Validation ladder — PASS

`POST /api/ladder` → job `ladder-20260929-134328-2` `done` in 10 s; tiers 1 / 10 / 100 / 1000 voters
all PASS (`validation-ladder-20260929-134328-1`, `-134331-2`, `-134333-3`, `-134335-4`).
`~/.saksi/campaign/runs/ladder.json`: `commit 4a38a54fe0223b58f28c53ec54e47fbeab222837`.
Preflight afterwards: `ladder {ok: true, ladder_commit: 4a38a54…, console_commit: 4a38a54…}`, no
warnings. (Before: `ok false`, ladder_commit `851ef86…`.) Evidence: `~/w6/item3-ladder-job.json`.

## 4. Wizard SP-1K campaign vs CLI `--repeat` — FAIL on the 5 % criterion

Config (the SP-1K preset as `wizard.html` `applyPreset` + `config()` build it): 1000 voters × 1
position, 4 candidates, 5 paper trustees, t = 3, `realistic`, senate 0, 128 in flight, send rate 0,
on-chain, attacks skipped; 2 warm-ups + 10 measured.

- **Wizard campaign** (`POST /api/campaigns`, election name `SP-1K w6`): `campaign-20260929-134439-3`,
  **done**, 13:44:39–13:49:16, run folders `sp-1k-w6-20260929-134442-5` … `-134856-16`, 0 failed,
  none contended. Ran on a fresh ledger (reset in item 2, then the offline ladder).
  Summary: `~/.saksi/campaign/runs/campaigns/campaign-20260929-134439-3/summary.csv`.
- **CLI repeat** (after a network reset, so it also started on an empty ledger, as runbook §9/§10.4
  require per tier): `target/saksi-campaign --repeat --config ~/w6/item4-cli-config.json --warmups 2
  --reps 10 --base-url http://127.0.0.1:8090 --out ~/w6/item4-cli-summary.csv`, election name
  `SP-1K w6cli` (different tag so the refit glob `*-w6-*` keeps only the wizard campaign), exit 0,
  runs `sp-1k-w6cli-20260929-135142-17` … `-135437-28`, 0 failed.

| Median (measured, n = 10) | Wizard | CLI | CLI vs wizard |
|---|---|---|---|
| `committed_tps` | 899.947 | 979.050 | **+8.8 %** |
| `latency_p99_ms` | 232.812 | 217.388 | **−6.6 %** |
| `latency_p50_ms` | 144.011 | 134.995 | −6.3 % |
| `driver_ceiling_tps` | 887.100 | 947.364 | +6.8 % |
| `committed_tps` stddev | 69.5 (CV 7.7 %) | 62.8 (CV 6.4 %) | |
| `runs_failed` | 0 | 0 | |

Neither median is within 5 %. Both samples are noisy (TPS stddev ≈ 65–70 on a ~900–980 median), and
the wizard campaign had 3 of 10 measured reps below 820 TPS (767, 777, 811) against 1 of 10 for the CLI
(777), so a 5 % gate is tighter than the run-to-run spread at 1K. Per-rep wall time also differs:
~23 s per wizard repetition vs ~15.5 s per CLI repetition — the campaign takes a Windows host CPU sample
(`powershell.exe Get-Counter`, ~3.7 s) before generate and after verify for every repetition; I did not
verify whether any of that overlaps the ballot window, so treat it as a hypothesis, not a cause. The
wizard campaign's preflight host sample was 24.1 % (just under the gate) against 9.0 % for the CLI.
Suggested next step: repeat the pair (wizard then CLI, reset before each, host < 10 %), and if the gap
holds, check whether the per-repetition host sampling overlaps the submit window.

## 5. On-chain security run, full attack timeline — PASS

Run `sp-1k-w6-sec-20260929-135521-29` (`SP-1K w6 sec`, same SP-1K config, on-chain, attacks on,
plan stages `dkg, ballots, close, ceremony`, pause at 50 %, 300 s per stage; every pause decided with
**Run all attacks at this stage** through `POST /api/runs/<id>/pause {"action":"run-all"}`).
Lifecycle: check pass → encrypt with pauses → 3 trustees → publish (ceremony pause) → verify
`overall pass`; every contest **E = 0**, `ledger_matches_local true` (local and ledger rows);
`run.end` `security_run: true`, `failed: false`.

| Scenario | Stage (mount) | Gate expected | Gate observed | Verdict | Refusal |
|---|---|---|---|---|---|
| `tamper-dkg-transcript` | dkg (election open, 0 ballots, h 319) | `dkg.decode` | `dkg.decode` | PASS | auditor: trustee 1 coefficient_commitments[0] is not a valid ristretto point (on-chain: shape only) |
| `tamper-ballot-proof` | ballots (open, 500 committed, h 330) | `cds` | `cds` | PASS | chaincode: CDS branch 0 verification equation failed |
| `reused-nullifier` | ballots | `nullifier` | `nullifier` | PASS | chaincode: nullifier already spent (double vote) |
| `corrupted-ballot-bytes` | ballots | `decode` | `decode` | PASS | chaincode: proto: cannot parse invalid wire-format data |
| `self-issued-credential` | ballots | `issuer` | `issuer` | PASS | chaincode: credential issuer key is not the issuer bound to the election |
| `overvote` | ballots | `selection` | `selection` | PASS | chaincode: selection proof challenge does not match Fiat-Shamir transcript |
| `dropped-ballot` | close (closed, 1000, h 341) | `stream.completeness` | `stream.completeness` (+ cp_proof, threshold, homomorphic_sum) | PASS | auditor: audited 999 of 1000 ballot lines |
| `reordered-ballots` | close | none | — | SKIPPED | no gate exists to test (expected; report as a gap) |
| `tamper-partial-decryption` | ceremony (closed, 1000, h 353) | `decryption.cp_proof` | `decryption.cp_proof` | PASS | auditor: Chaum-Pedersen failed (on-chain: presence only) |

All five during-ballots attacks were real submissions refused by their declared chaincode gate.
Evidence: `~/.saksi/campaign/runs/sp-1k-w6-sec-20260929-135521-29/negative-tests.csv`, `journal.ndjson`
(`attack.*`), `correctness.csv`; driver log `~/w6/item5-drive.log`.

## 6. Live checks

### 6a. T3 fault — PASS

Run `sp-1k-w6-t3-20260929-135755-30` (`SP-1K w6 t3`, on-chain, attacks skipped, closed loop).

Fault-route refusals (all as documented):
- `confirm:"restart"` → 400 "confirm must be exactly \"RESTART\"…"
- `at:1.5` → 400 "at must be between 0 and 1, exclusive"
- `down_s:200` → 400 "down_s must be between 5 and 120 seconds"
- campaign repetition `sp-1k-w6-20260929-134529-7` → 409 "a campaign repetition, a measurement: it never carries a fault"
- attack-plan run `sp-1k-w6-sec-…-29` → 409 "this run has an attack plan…"
- valid arm `{at 0.5, down_s 30}` → 200 `{at_index 500, ballots 1000, container peer0.org1.example.com}`

While the peer was down (checked after `fault.start`, before `fault.peer_ready`):
- `POST /generate` (another run) → 409 "…peer-restart fault has the Fabric peer stopped or recovering: wait for its fault.peer_ready"
- `POST /api/ladder` → 409 naming the busy run
- preflight → `fabric_unreachable`, `run_busy`; `docker ps`: peer0.org1 `Exited (0)`

Journal: `fault.window {at_index 500}` → `fault.start {ballots_committed 391, block_height 364, stop_ms 657, ok}`
→ `stage.ballots.interrupted {committed 500, dropped 500, fault peer-restart}` → `fault.end {down_ms 30238, ok}`
→ **`fault.peer_ready {wait_ms 1048, window_conn_ready true, ok true}`** 16 s after the restart
(well inside 3 min) → `stage.ceremony.end {ok false, "500 of 1000 ballots did not commit"}`.
Resume → `202 {remaining 500}`, `segment.start {pending 468}`, segment `committed 468, dropped 0`,
`resume.close {ok true}`. Verify-only → `verify_only.reconcile {chain_count 1000, expected 1000,
missing 0, reconciled true}`, `verify_only.chain {PASS, linked}`. Trustees ×3, publish, verify:
`overall pass`, every contest **E = 0**, `ledger_matches_local true`, `run.end {resumed true,
sustained false, security_run true, failed false}`. Output: scratchpad `s6a.out`.

### 6b. Cancel during `down_s` restores the peer — PASS (phase cancel)

Run `sp-1k-w6-t3cancel-20260929-135959-32`, fault `{at 0.5, down_s 60}`. 5 s after `fault.start`
(peer `Exited (0) 5 seconds ago`) → `POST /cancel` → 200. Journal: `fault.end {down_ms 5645, ok true}`
at the cancel (the 60 s outage was cut short and the peer started), `fault.peer_ready {wait_ms 1045,
window_conn_ready true, ok true}`; `docker ps`: peer0.org1 `Up`. Resume (`pending 434`, close ok),
verify-only reconciled 1000/1000, ceremony and verify: `failed false`, `ledger_matches_local true`.

Not exercised: **Ctrl-C of the console process** during `down_s` (runbook §9 "If the console stops
during a fault"). It would stop the console in tmux `console`, which this task's rules forbid; the
phase-cancel path above is what was tested. The console-exit restore still needs one manual check by
the operator (arm a fault, Ctrl-C in tmux during `down_s`, look for "started peer0.org1.example.com
again", then `./tools/up.sh status` and restart the console).

### 6c. Second `CloseElection` through the real gateway — PASS

Election `sp-1k-w6-sec-20260929-135521-29` (closed by its own run; one `CloseElection` receipt).
A small out-of-tree Go program (`~/w6/closecheck/`, module `replace` onto the checkout's
`client-sdk`, no repo file touched) called `clientsdk.Connect` + `Bulletin.CloseElection` through the
Fabric Gateway on `localhost:7051` and printed `clientsdk.ErrorText(err)`:

```
status before: closed
CloseElection err: close election: rpc error: code = Aborted desc = failed to endorse transaction, see attached details for more info; chaincode response 500, election "sp-1k-w6-sec-20260929-135521-29" is already closed
contains exact phrase: true
```

That is the exact wording `executor.go` matches for `resume.close {already_closed}`. (The stock
`saksi-console` menu prints only the gRPC summary, "failed to endorse transaction, see attached
details", because its `report` does not use `ErrorText`; the console proper does.) Evidence:
`~/w6/item6c-second-close.log`.

## 7. Export bundle into `cost_model.py` — PASS, known gap confirmed

`GET /api/campaigns/campaign-20260929-134439-3/export` → 200, 128,599 bytes, 124 entries: per run
`run.json, perf.csv, perf-schema.md, correctness.csv, ground-truth-check.json, timings.json,
journal.ndjson, gen-timings.json, journal-line1.json, receipts-lifecycle.csv` (MANIFEST: only
`negative-tests.csv` missing, expected for a campaign), plus `summary.csv`, `campaign.json`,
`preflight.json`, `MANIFEST.txt`. Unzipped to `~/w6/export/bundle/`.

`python3 cost_model.py --runs ~/w6/export/bundle --match '*-w6-*' --fit-concurrency 128` (a copy of
balotachain's `docs/desktop-runs/cost_model.py`, unmodified, output to `~/w6/`) → exit 0,
**10 runs used**, on-chain `g 0.2125`, `s 1.139`, `v_audit 0.193`, `v_dump 0.8498` ms/record,
`c0 13010 ms`; SP-1K predicted 0.0043 h vs actual 0.0042 h (−2.6 %). The same fit from the WSL run
store (`--runs ~/.saksi/campaign/runs --match 'sp-1k-w6-2*'`) is **byte-identical** apart from the
paths.

What fails: `cost_model.py` reads `receipts.csv` only (line 249) and never `receipts-lifecycle.csv`,
so from the bundle every run's `tau` is `None`. The fit filters runs with falsy `tau` and prints the
same "`tau = 0`: … receipts share blocks" text either way, so a bundle fit silently drops `L(p)`. At
SP-1K this makes no difference (the run-store fit also has `tau = 0`), but on a regime where lifecycle
receipts do not share blocks the bundle would under-predict with no warning. Fix belongs in
`cost_model.py` (fall back to `receipts-lifecycle.csv`); not changed here, per instructions.
Outputs: `~/w6/cost-model-w6-bundle.md`, `~/w6/cost-model-w6-runstore.md`, `~/w6/item7-*.log`.

## State left behind

- Network: up, channel `saksi`, holding the CLI repeat's 12 elections plus the security and two T3
  elections (reset `network-reset-20260929-134942-4` was the last). The wizard campaign's elections
  went with that reset; its export (`~/w6/export/campaign-20260929-134439-3.zip`) and run folders are
  kept.
- Peer0.org1 up; console up; no job or phase running.
- No saksi or balotachain source file modified. This report is the only file written in either repo.

## Item 4 follow-up (2026-09-29, 14:02–14:15 UTC)

### A. Does the per-repetition host sample overlap the ballot window? — No

Code path (read only): `internal.go` `RoundTrip` calls `sampleHost()` synchronously *before* serving a
repetition's `/generate`, and `campaign.go` `endRep` calls it when the driver fetches `/export/` after
verify. `HostSample.At` is stamped at the start of the sample, so a sample covers about
`[at, at + 3.7 s]` (5 s timeout). The driver waits for both calls, so neither can run during that
repetition's phases.

Measured: I compared `host_start.at` and `host_end.at` in `campaign.json` with each run's
`stage.ballots.start` and `stage.ballots.end` in `journal.ndjson`. The journal timestamps have
one-second resolution, so I widened the window end by 1 s and treated each sample as 5 s long.

| Campaign | Reps | Overlap | Gap, end of start sample → window opens | Gap, window closes → end sample |
|---|---|---|---|---|
| `campaign-20260929-134439-3` (w6) | 12 (2 + 10) | **none** | 2.5–3.7 s | 8.8–9.9 s |
| `campaign-20260929-141043-7` (w6b) | 12 (2 + 10) | **none** | 2.4–3.3 s | 8.9–10.0 s |

No overlap in any repetition, so this is not an instrument bug. The samples do explain why each
wizard repetition takes longer in wall time (about 23 s against about 15.5 s for the CLI): about 7 s
of sampling, all outside the ballot window. Script: scratchpad `overlap.py`.

### B. Reversed pair — CLI first, then wizard

- **B1 CLI** `SP-1K w6cli2`: network reset `network-reset-20260929-140405-5` (done,
  `chain_height 6`), host 5.9 %, then the same `--repeat` 2 + 10. Exit 0, runs
  `sp-1k-w6cli2-20260929-140540-33` … `-140835-44`, 0 failed. Summary: `~/w6/itemB-cli2-summary.csv`.
- **B2 wizard** `SP-1K w6b`: network reset `network-reset-20260929-140855-6` (done,
  `chain_height 6`), then the host check. Its first sample was 7.6 % but carried a guest
  `host_load` warning (load left over from the reset); the next, 13 s later, was 8.5 % with no
  warnings. Campaign `campaign-20260929-141043-7` finished **done** with 0 failed.
  Two measured repetitions sampled a busy host at start: rep 1 at 28.9 % and rep 8 at 37.3 %.
  Both are over the 25 % line, so they are "contended". Their end samples were 19.4 % and 20.7 %,
  and their TPS (907, 928) was not low. Leaving them out moves the medians only slightly
  (TPS 916.6, p99 231.8). The cause of the spikes is unknown: my driver only polled
  `GET /api/campaigns/<id>` every 5 s.

| Median, n = 10 | Pair 1: wizard w6 | Pair 1: CLI w6cli | Pair 2: CLI w6cli2 | Pair 2: wizard w6b |
|---|---|---|---|---|
| order in pair | 1st | 2nd | 1st | 2nd |
| `committed_tps` | 899.947 | 979.050 | 899.880 | 916.115 |
| `latency_p99_ms` | 232.812 | 217.388 | 235.251 | 229.998 |
| `latency_p50_ms` | 144.011 | 134.995 | 150.513 | 144.546 |
| TPS stddev | 69.5 | 62.8 | 92.9 | 61.3 |

- **Pair 2, wizard compared with CLI:** TPS **+1.8 %**, p99 **−2.2 %**. Both are within 5 %: **PASS**.
- **Across both pairs:** three of the four medians fall within 1.8 % of each other on TPS
  (899.9–916.1) and 2.3 % on p99 (230.0–235.3). The outlier is the first CLI run (979.1 TPS,
  217.4 ms). The two wizard campaigns agree with each other (TPS +1.8 %, p99 −1.2 %), and so do the
  two CLI runs apart from that outlier. So the console path adds no systematic gap. Pair 1's 8.8 %
  was one high CLI sample within rep-to-rep noise, which has a coefficient of variation of about
  7–10 % at 1K.
- **Order and ledger effect:** in both pairs the second campaign had the higher TPS (+8.8 %, then
  +1.8 %), and every campaign started after its own reset. The sign is consistent but there are only
  two pairs and the effect is inside the noise, so it is not established. If the thesis needs a tight
  bound, run another pair or report medians with their spread instead of a single 5 % gate.

**Item 4 verdict, revised:** the reversed pair is **within 5 %** (TPS 1.8 %, p99 2.2 %). The pair 1
miss was noise, not an instrument difference. Both medians are single samples with about 7 %
spread, and w6b has two contended repetitions.
