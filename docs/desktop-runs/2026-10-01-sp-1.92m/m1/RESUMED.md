# SP-1.92M ch4 m1: resumed after a power cut

Status: **resumed** (power-cut policy, plan 2026-10-01). A correctness record; its whole-run TPS is not an RQ3 row (runbook §10.7, `run.end {resumed: true, sustained: false, scaling_limit: inconclusive}`). RQ3 for the tier comes from m2 and m3.

## What happened
- Run `sp-1-92m-ch4-m1-20261001-102400-16`, campaign `campaign-20261001-102357-4`. Ballot window opened 10:38:48Z; last journal line `ballots.progress done=881000` at 11:07:21Z (19:07:21 local).
- Windows Event 41 (Kernel-Power) at 19:07:45: BugcheckCode 0, PowerButtonTimestamp 0, LongPowerButtonPressDetected false, SleepInProgress 0, WHEABootErrorCount 0. Boot at 19:07:42. No WHEA-Logger events since 2026-09-24; no System events between 18:51:46 and the boot. Event 6008 names 18:37:50 as the previous shutdown, but that is Windows' periodic last-alive stamp: the journal proves the run was writing until 19:07:21.
- The same signature (Event 41, no bugcheck) occurred at 15:57 the same day. A PSU fault is suspected.
- Last sampler rows before the cut (19:06:49–19:07:09, `resources.csv`): Windows CPU 55–77 %, Windows available memory 3.3–3.5 GB, WSL MemAvailable 22.2 GB, WSL load1 13–17 of 16, peer0.org1 270–290 % CPU, orderer ~54 %, C: disk busy spiking (queue up to 13), Q: ~40 % busy. Over m1's pre-cut part (244 samples): Windows available memory min 1.48 GB, WSL MemAvailable min 21.9 GB; no memory exhaustion.
- **Attribution:** an abrupt loss of power or a hard reset without a bugcheck. Nothing in the evidence points to a software failure (no bugcheck, no OOM, no resource exhaustion in the last samples, no Windows errors before the cut). The evidence cannot by itself tell a PSU cut from a hard hang; the repeat within four hours under sustained load and the suspected PSU make a power-supply event the likely cause. To confirm after the PSU is replaced.

## Recovery (no network reset)
1. 19:11 `docker start` orderer, both peers, both chaincode containers. Peers resumed delivery and committed block 17640; the orderer re-elected itself Raft leader at block 17640.
2. 19:12 console restarted (`PT=8h ~/bringup5.sh`); up.sh: "Fabric network already running". Run `interrupted`, `resumable: true`.
3. 19:13 ledger check: both peers channel height 17641, identical current block hash. `verify-only` before the resume: `verify_only.reconcile` chain 881,628 = local 881,628, missing 1,040,289; `verify_only.chain` PASS (linked).
4. 19:16 `POST /api/runs/<run>/resume` → segment 1, pending 1,040,289. 19:50 ballots end: committed 1,040,289, dropped 0, replayed 0. `resume.close` ok.
5. 19:54 verify-only; 19:58 trustees 1–3 shares; 19:59 publish; 19:59–20:28 verify: **overall pass, no failed checks; E = 0 on every contest, local and ledger; `ledger_matches_local` true.**

## Throughput by segment (downtime excluded)
| Segment | Window | Committed | TPS | Source |
|---|---|---|---|---|
| 0 (cut) | 10:39:31Z–11:07:21Z (~1,670 s) | 881,628 (chain count) | ~528 | no `segment.end` (power cut): from `segment.start` to the last `ballots.progress`, committed count from `verify_only.reconcile` |
| 1 (resume) | 2,057.8 s | 1,040,289 | 505.5 (p50 247 ms) | journal `segment.end` |

## Contention
Flagged contended: the user was working at the PC (mpv, Lively) until about 19:45. The controller's raw count (354 samples > 25 %) includes the WSL VM running the run and cannot be VM-corrected after the fact (the vmmem counter was added at 22:20). Not redone: a resumed run is kept, not rerun.
