# Chapter 4 study log — desktop, saksi 4a38a54

Study tag `ch4`. The run order and rules come from the controller's brief (2026-09-30).

## Log

- **2026-09-30 01:35 local (17:35Z Sep 29).** Pre-start checks before step 1 (SP-1K reset).
  - Console: tmux `console` alive and `http://127.0.0.1:8090` answering. Preflight ladder
    `ok: true`, ladder_commit = console_commit = `4a38a54…`. Host CPU 10.0 %.
  - **Fabric is down.** Preflight `fabric.reachable: false` (`dial tcp 127.0.0.1:7051: connect:
    connection refused`, block `fabric_unreachable`).
  - `./tools/up.sh status`: "docker NOT running", "Fabric network down", console up with on-chain
    enabled. In Ubuntu, `docker` is not found ("activate the WSL integration in Docker Desktop").
  - `wsl -l -v`: `docker-desktop` distro **Stopped**. On the Windows host there is **no Docker
    Desktop process** at all (`Get-Process *docker*` empty). Host last booted 2026-09-29 21:31;
    the last network reset ended OK at 14:10Z (22:10 local); W6 ended with the network up, so
    Docker Desktop stopped some time after that.
  - **Stopped here, per the hard rules**: the network is not up, so the console restart path does
    not apply, and starting or restarting Docker Desktop is outside what this task may do. No
    reset, campaign, security run or T3 was started. Nothing was written under
    `docs/desktop-runs/`. No saksi or balotachain source touched.

## Summary

Not run. Blocked before the first tier: Docker Desktop is not running on the host, so the
Fabric network is down (`fabric_unreachable`).

To resume: start Docker Desktop, wait until `wsl -d Ubuntu -e docker info` answers, then in WSL
`cd ~/Code/saksi && ./tools/up.sh status`. If the network does not come back on its own, the
first tier's network reset (`POST /api/network/reset`, `tools/tier.sh 1000 1`) brings up a fresh
network; the console may need a restart in tmux `console` with the W6 PATH (`~/bringup4.sh`) if
its Fabric connection does not recover. Then rerun this task from step 1.

## Resumed after unblock

- **2026-09-30 01:37.** Coordinator restarted Docker Desktop. `up.sh status` all green; preflight
  fabric reachable, host 18.2 %, no warnings. New allowance recorded: one Docker Desktop relaunch
  (then docker start the three containers, redo the tier from reset, discard its runs); a second
  crash stops the study.
- **01:38.** Driver `~/ch4/drive.py` (WSL; copy in the session scratchpad) started in its own tmux
  session `ch4`: steps SP-1K, MP-1K, SP-10K, security, t3, peer check, MP-10K, SP-50K, MP-50K.
  Polling 30 s (60 s during campaigns; 10 s only during the security run's attack pauses).
  Detailed log `~/ch4/drive.log`; job/campaign JSON and export zips under `~/ch4/`.
  SP-1K reset `network-reset-20260929-173804-8` started.
- **01:40–01:45 SP-1K attempt 1.** Reset `network-reset-20260929-173804-8` done (height 6, 91 s);
  preflight green (host 9.0 %). Campaign `campaign-20260929-174007-9` done, 10 measured, 0 failed,
  median TPS 910.6, p99 235.1 ms. **3 contended** (wizard rule, start or end sample): rep 1 end
  guest load1 4.38 > 4.0, rep 2 start load1 4.38, rep 6 start host 26.6 %. Exported
  (`~/ch4/exports/campaign-20260929-174007-9.zip`). More than 2 → rerun once from reset.
- **01:46 SP-1K attempt 2.** Reset `network-reset-20260929-174507-10` done (89 s); preflight green
  (host 5.3 %, load1 3.65). Campaign `campaign-20260929-174641-11` started.
- **01:51 SP-1K attempt 2 done.** `campaign-20260929-174641-11` done, 10 measured, 0 failed, median
  TPS 893.9, p99 227.9 ms. **3 contended again** (rep 2 end host 27.4 %, rep 9 end host 27.6 %,
  rep 10 end load1 4.32). Tier rerun only once per the brief, so this attempt stands as the tier's
  record, flagged. Exported. Both attempts kept in `~/ch4/exports/`.
- **01:52 host noise.** A 5 s process sample on Windows: Docker Desktop UI ~1.3 cores, Brave
  (several processes) ~1.2 cores, `mpv` (a video player) running. None started by me; not touched.
  This is the likely source of the 20–33 % host spikes.
- **01:51 MP-1K.** Reset `network-reset-20260929-175141-12` started.
- **01:53–02:00 MP-1K attempt 1.** Reset done (91 s); preflight green (host 16.1 %). Campaign
  `campaign-20260929-175344-13` done, 10 measured, 0 failed, median TPS 885.1, p99 217.1 ms.
  **4 contended**: three only on guest load1 (4.07–4.53 against the 4.0 line, the run's own
  auditor load carried into the next sample), one on host CPU (rep 9 start 29.5 %). Exported.
  Rerun once from reset (started 02:00).
- **02:02–02:09 MP-1K attempt 2.** Reset `network-reset-20260929-180044-14` done (88 s); preflight
  green (host 4.3 %). Campaign `campaign-20260929-180218-15` done, 10 measured, 0 failed, median
  TPS 924.6, p99 208.2 ms. **5 contended** (host 27.5, 27.8, 30.1 %; guest load1 5.72, 5.27, 4.84).
  Rerun used; this attempt stands, flagged. Exported.
- **02:09 SP-10K** started (reset 10000 × 1).
- **02:10–02:20 SP-10K attempt 1.** Reset `network-reset-20260929-180918-16` done (89 s); preflight
  green (host 5.7 %). Campaign `campaign-20260929-181051-17` done, 10 measured, 0 failed, median
  TPS 849.2, p99 273.8 ms. **10 of 10 contended**, but on host CPU only one sample is over 25 %
  (rep 7 end, 27.1 %); every other flag is guest load1 6.4–9.5 against the 4.0 line. At 10K the
  guest's 1-minute load average is the run's own generate/verify work (16 auditor threads), sampled
  seconds after it, so the guest-load half of the wizard's rule flags every repetition from this
  tier up. Observation for the morning: the rule cannot tell self-load from outside load at ≥ 10K.
  Exported. Rerun once from reset (02:20) as briefed; expect the same flags.
- **02:22–02:33 SP-10K attempt 2.** Reset `network-reset-20260929-182052-18` done (88 s); first
  preflight amber (`host_load`, load1 4.94 after the reset), green 34 s later (host 4.4 %). Campaign
  `campaign-20260929-182259-19` done, 10 measured, 0 failed, median TPS 885.8, p99 252.7 ms.
  Wizard rule: 10 of 10 contended, **all on guest load1 (7.1–9.3, self-load); host CPU never over
  25 %** (max 24.6 %). Attempt stands. Exported.
- **02:33 Security run** (SP-10K network) started; waiting on preflight `host_load` to settle.
- **02:34–02:38 Security run** `sp-10k-ch4-sec-20260929-183410-129` (`SP-10K ch4 sec`, stages dkg,
  ballots, close, ceremony; pause at 50 %; every pause decided "run all"). Preflight green after
  ~70 s (`host_load` settling). Verify `overall pass`, all 4 contests **E = 0** (local and ledger
  rows), `ledger_matches_local true`, `run.end {security_run true, failed false}`.
  Verdicts: 8 PASS, 1 SKIPPED — tamper-dkg-transcript (dkg.decode), tamper-ballot-proof (cds),
  reused-nullifier (nullifier), corrupted-ballot-bytes (decode), self-issued-credential (issuer),
  overvote (selection), dropped-ballot (stream.completeness), tamper-partial-decryption
  (decryption.cp_proof) all PASS at their declared gate; reordered-ballots SKIPPED (no gate).
  Five ballots-stage attacks were live submissions at 5000 committed, height 2580.
- **02:38 T3** started: `sp-10k-ch4-t3-20260929-183754-130`, fault at 0.4, down 20 s, closed loop.
- **02:38–02:43 T3** `sp-10k-ch4-t3-20260929-183754-130` (`SP-10K ch4 t3`, on-chain, no attacks,
  closed loop; fault `{at 0.4, down_s 20}` → at_index 4000 of 10000). Journal: `fault.start`
  {ballots_committed 3893, height 2774, stop 731 ms, ok} → `stage.ballots.interrupted` {committed
  4000, dropped 6000} → `fault.end` {down 20255 ms, ok} → `fault.peer_ready` {wait 1054 ms,
  window_conn_ready true, ok}. Resume → 202 {remaining 6000}; `segment.start {pending 5955}` (45 of
  the 6000 "dropped" had landed); `resume.close {ok, already_closed false}`. Verify-only:
  `verify_only.reconcile` {chain_count 10000, expected 10000, missing 0, reconciled true},
  `verify_only.chain` {PASS, linked, 204 blocks}. Trustees 1–3, publish, verify `overall pass`:
  all 4 contests **E = 0** (local and ledger), `ledger_matches_local true`, `run.end {resumed
  true, sustained false, security_run true, failed false}`.
- **02:43 Peer check.** `up.sh status` green; peer0.org1 Up, peer0.org2 Up, orderer Up.
- **02:43 MP-10K.** Reset `network-reset-20260929-184254-20` started.
- **02:45–03:09 MP-10K attempt 1.** Reset `network-reset-20260929-184254-20` done (91 s); preflight
  green (host 9.7 %). Campaign `campaign-20260929-184458-21` done, 10 measured, 0 failed, median
  TPS 704.7, p99 411.1 ms. 10 of 10 contended by the wizard rule; **3 on host CPU** (29.7, 26.6,
  27.3 %), the rest guest load (self-load, 5.3–10.1). TPS falls across the campaign (808 → ~630–
  720 by reps 4–10) as the ledger grows on one network (12 × 30,000 records). Exported. Rerun once
  from reset (03:09).
- **03:11–03:33 MP-10K attempt 2.** Reset `network-reset-20260929-190901-22` done (91 s); preflight
  green (host 5.2 %). Campaign `campaign-20260929-191104-23` done, 10 measured, 0 failed, median
  TPS 789.3, p99 372.8 ms. Wizard rule 10 of 10 contended, **all guest load (self-load 6.7–9.5);
  host CPU never over 25 %** (max 19.8 %). Attempt stands. Note: reps 6 and 7 had p99 2903 and
  1960 ms (TPS 461, 626) with host CPU low — a stall inside the network, not host contention.
  Exported.
- **03:33 SP-50K.** Reset `network-reset-20260929-193304-24` started.
- **03:35–03:55 SP-50K attempt 1.** Reset `network-reset-20260929-193304-24` done (91 s); preflight
  green (host 1.3 %). Campaign `campaign-20260929-193508-25` done, 5 measured, 0 failed, median
  TPS 658.7, p99 420.8 ms. 5 of 5 contended, **all guest load (self-load 6.6–9.5); host CPU never
  over 25 %** (max 18.7 %). Rep 3 p99 2005 ms (stall, host 4–9 %). Exported. Rerun once (03:55)
  per the brief's rule.
- **03:57–04:16 SP-50K attempt 2.** Reset `network-reset-20260929-195508-26` done; first preflight
  amber (`host_load` 5.04), green 33 s later (host 6.9 %). Campaign `campaign-20260929-195715-27`
  done, 5 measured, 0 failed, median TPS 697.3, p99 417.2 ms. 5 of 5 contended by the wizard
  rule: guest load 7.2–10.1 on all; **host CPU once over 25 %** (rep 5 end, 25.5 %). Rep 3 p99
  1785 ms (stall, host 3–6 %). Attempt stands. Exported.
- **04:16 MP-50K.** Reset `network-reset-20260929-201616-28` started.
- **04:18–05:15 MP-50K attempt 1.** Reset `network-reset-20260929-201616-28` done (91 s); preflight
  green (host 1.9 %). Campaign `campaign-20260929-201819-29` done, 5 measured, 0 failed, median
  TPS 570.3, p99 524.5 ms (tight: TPS 564–582). 5 of 5 contended, **all guest load (self-load
  8.2–13.9); host CPU never over 25 %** (max 21.2 %). Exported. Rerun once (05:15) per the rule.

## Night 1, 2026-10-01

Plan: `docs/plans/2026-10-01-ch4-runs-and-chapter.md` "Night 1". saksi `4a38a54` in WSL `~/Code/saksi`;
console in tmux `console` (on-chain, 5h phase timeout, auth off). Driver `~/ch4/night1.py` (WSL; copy in the
session scratchpad): imports `~/ch4/drive.py` for the API calls, polling, reset and export, and adds
candidate counts, the row-5 sweep and burst, the MP-1K security run, and after each item the ledger size
(`du -sb` of `/var/hyperledger/production` in both peers and the orderer) plus gzipped `docker logs
--timestamps` of both peers and the orderer, to `~/ch4/night1/logs/<item>/`. Runs in tmux `n1`; detailed
log `~/ch4/night1/drive.log`; job/campaign JSON under `~/ch4/night1/`, export zips under
`~/ch4/night1/exports/`. A `~/ch4/night1/STOP` file stops it cleanly between items.

Contention rule tonight: rerun an item once from reset only if a measured repetition's host CPU sample
(`host_start` or `host_end`) is over 25 %; guest load1 > 4.0 flags are noted as self-load and never rerun.

Row-5 choices, made before the run:
- **Two campaigns on the same network.** The campaign's `config.send_rate` is both the sweep's first
  step and the rate cap of every warm-up and measured repetition (`Repeat` passes one `Config` to
  both). Setting it as runbook §10.4 says would run the 1 + 3 repetitions open-loop at the start rate,
  not closed-loop like rows 2–4. So: campaign A = 1 warm-up + 3 measured, `send_rate` 0; then, on the
  same network, campaign B = 0 + 0 with the sweep and the burst (the order `Repeat` itself uses:
  measured, sweep, burst).
- **Send rate 250 /s, factor 1.6, step window 120 s**: steps offer 250, 400, 640, 1,024, 1,638, …/s.
  Rows 2–4 committed 570–925 TPS, falling with scale, so SP-483K should saturate near 500–650. The first
  two steps sit under that (they should climb), step 3 is at or just over it, and step 4 (1,024) is over
  900 and over the network's throughput, so the sweep ends by step 4 or 5 on a committed-TPS fall (or a
  drop), which is the plateau. 120 s is the driver default: at 1,024 /s a step offers ~123K ballots, under
  the 483K the step's election holds, and each step costs a 483K generate, so a longer window buys little.
- **Burst 144,900 voters** (T8, "sized from the tier's real-world analog"): Zamboanga City, 483,058
  voters over a 10-hour window, is 48,300 per hour on average; the worst-case hour is taken as three times
  that (30 % of the electorate in one hour), sent unthrottled as one election.

- **01:19.** Pre-start: console answering, preflight (1.92M x 1) Fabric reachable, ladder ok on
  `4a38a54`, host CPU 17.9 %, no warnings; phase timeout 18,000 s against an estimated 2,383 s for the
  1.92M ballot window; Docker data disk 930 GB free (peer volume), runs volume 892 GB free.
- **01:21.** Driver started (`night1.py all`). cand10: reset `network-reset-20260930-172114-1` (1000 x 3).
- **01:23–01:29 cand10 attempt 1.** Reset `network-reset-20260930-172114-1` done (height 6, 102 s). First
  preflight amber (`host_cpu` 33.0 %), green 34 s later (host 19.5 %). Campaign
  `campaign-20260930-172352-2` done, 5 measured, 0 failed, median TPS 579.2, p99 460.2 ms. **Host CPU over
  25 % on two measured reps** (m1 end 25.5 %, m2 end 39.0 %); guest load1 > 4.0 on four (self-load, noted).
  Exported; ledger size and logs saved (`logs/mp-1k-ch4-cand10-superseded-…`: peer 439.5 MB). Rerun once
  from reset (01:29).
- **01:25 host noise.** 5 s process sample on Windows: Brave ~1.9 cores across two processes, Explorer 0.35,
  Docker Desktop ~0.45, `mpv` running. Not started by the study; not touched.
- **01:30–01:38 cand10 attempt 2.** Reset `network-reset-20260930-172953-3` done (92 s); preflight green
  (host 7.2 %). Campaign `campaign-20260930-173157-4` done, 5 measured, 0 failed, median TPS 536.5, p99
  488.8 ms. Host CPU over 25 % again on three measured reps (m1 start 26.0, m2 start 28.2, m3 end 25.1 %);
  guest load on three (self-load). Rerun used; **attempt 2 stands, flagged**. Exported; evidence
  `logs/mp-1k-ch4-cand10/`.
- **01:38 cand28** started (reset 1000 x 3).
- **01:38–01:52 cand28 attempt 1.** Reset done; campaign `campaign-20260930-174002-6` done, 5 measured,
  0 failed. Host CPU over 25 % on two measured reps (m3 end 38.1 %, m5 start 25.3 %). Exported. The driver
  started the rerun at once: reset `network-reset-20260930-175204-7` done 01:54 (97 s), preflight amber
  twice on `host_cpu` (32.8, 26.1 %), green at 01:55 (21.7 %); campaign `campaign-20260930-175515-8`
  (attempt 2) started 01:55.
- **~01:57 HOLD (user request via the coordinator).** The user is using Brave on this PC (~1.9 cores of host
  CPU spikes). After cand28 finishes and exports, no next item starts until the coordinator says "resume".
  Done: `touch ~/ch4/night1/STOP`; the driver checks it before each item and exits cleanly, so it stops
  after cand28's evidence step. Console and network left as they are. cand28's rerun was **already spent**:
  attempt 2 had started at 01:55, before the hold arrived, and a measurement in progress is not killed.
  On "resume": `rm ~/ch4/night1/STOP`, then `tmux new -d -s n1 'bash ~/ch4/go1.sh; bash'` (`all` skips the
  items `state.json` marks done).
- **01:55–02:07 cand28 attempt 2.** Campaign `campaign-20260930-175515-8` done, 5 measured, 0 failed,
  median TPS 297.2, p99 664.2 ms. Host CPU over 25 % on two measured reps' start samples (m1 28.6 %,
  m2 31.9 %, Brave still running); guest load on one. Rerun spent; **attempt 2 stands, flagged**. Exported;
  evidence `logs/mp-1k-ch4-cand28/` (peer 984.9 MB).
- **02:07 Driver stopped cleanly on the STOP file**, before mp1k-sec. Console and network untouched (the
  network holds cand28 attempt 2's 7 elections). Waiting for "resume".
- **02:49 Resume** (coordinator: the user closed Brave and everything else). STOP removed, driver restarted in
  tmux `n1` (`night1.py all`). mp1k-sec: reset `network-reset-20260930-184935-9` (1000 x 3) started.
- **02:53 Change (user decision via the coordinator):** SP-1M runs 0 warm-ups + 3 measured, SP-1.92M 0 + 1;
  SP-483K stays 1 + 3 with its sweep and burst. Reason: "no warm-up at 1M+; a start-up effect is negligible
  over an election that long; user decision 2026-10-01 to shorten night 1". Applied by editing `night1.py`
  (the running process keeps its old table), and a STOP file so the running driver exits after mp1k-sec;
  it is then restarted at once on the edited file. Another agent drafts Chapter IV in parallel (reads and
  writes text only).
- **02:49–02:55 MP-1K security run** `mp-1k-ch4-sec-20260930-185139-29` (`MP-1K ch4 sec`, 1000 x 3, stages
  dkg, ballots, close, ceremony; pause at 50 %; every pause "run all"). Reset `network-reset-20260930-184935-9`
  done (92 s); preflight green (host 6.1 %). Verdicts: **8 PASS, 1 SKIPPED** (reordered-ballots, no gate);
  the five ballots-stage attacks were live submissions at 1,500 committed records, height 38, each refused
  by its declared chaincode gate (cds, nullifier, decode, issuer, selection); dkg.decode, stream.completeness
  and decryption.cp_proof by the auditor. All 12 contests (3 positions x 4) **E = 0**, local and ledger rows;
  `run.end {failed false, ledger_matches_local true, security_run true}`. Evidence `logs/mp-1k-ch4-sec/`.
- **02:55 Driver restarted on the edited file** (exited on STOP after mp1k-sec, as planned). sp483k: reset
  `network-reset-20260930-185522-10` (483000 x 1) started.
- **02:56–02:57 SP-483K attempt 1.** Reset `network-reset-20260930-185522-10` done (height 6, 86 s). First
  preflight amber (`host_load` 4.39 after the reset), green 33 s later (host 22.4 %, load1 2.51; projected
  ledger 5.8 GB; phase estimate 599 s of 18,000). Campaign `campaign-20260930-185730-11` (1 + 3, closed loop)
  started 02:57.
- **03:00 (meanwhile)** Evidence for cand10, cand28 and the MP-1K security run copied into a worktree
  `../balotachain-n1` on branch `docs/ch4-night1-2026-10-01` (off main), with their notes drafted there.
- **03:26 Host memory.** Claude Code reaped my background waiter shell for low host memory: Windows free
  1.7 of 31.9 GB, `vmmemWSL` 20.7 GB (WSL cap 24 GB, `swap=0`; inside WSL 21 GB is page cache, 21 GB
  "available"). Not the study's processes failing: the driver and the campaign kept running. `drop_caches`
  needs sudo (not available unattended), so nothing was changed; waiting now uses short foreground polls.
- **02:57–04:51 SP-483K measured campaign** `campaign-20260930-185730-11` done, 3 measured, 0 failed. Warm-up
  527.1 TPS; measured 533.2, 509.0, 450.2 (median 509.0), p99 522.8 / 537.6 / 595.2 ms; ~27 min per
  repetition. **No host sample over 25 %** (max 9.9 %); guest load1 9.8–12.6 on every sample (self-load,
  noted). TPS falls rep over rep as the ledger grows (4 x 483K on one network). Exported. No rerun needed.
  Sweep + burst campaign next on the same network.
- **04:52–05:31 SP-483K sweep** (`campaign-20260930-205246-12`, preflight green 04:52 after two `host_load`
  ambers from the measured campaign's own load). Steps, offered → committed, 0 dropped each:
  250 → 239.2; 400 → 388.5; 640 → 564.6; **1,024 → 610.9**; 1,638 → 595.7 (fell: stop). Plateau = step 4,
  **610.9 TPS**; the top step (1,638 /s) and the plateau step (1,024 /s) both exceed 900. ~8 min per step.
  Burst (144,900 voters, unthrottled) started 05:31 as `sp-483k-ch4-20260930-213103-39`.
- **05:31–05:40 SP-483K burst** `sp-483k-ch4-20260930-213103-39`: 144,900 ballots unthrottled, completed,
  **512.9 TPS, p99 549.9 ms**, 0 failed. Sweep+burst campaign `campaign-20260930-205246-12` done, 0 failed,
  `plateau_tps` 610.928 in `summary.csv`. Sweep p99 climbed with the offered rate: 523 ms, 623 ms, 1.30 s,
  3.52 s, 11.87 s (queueing past saturation). Exported. No host sample over 25 % (max 7.9 %).
- **05:42 SP-483K evidence** `logs/sp-483k-ch4/`: peer0.org1 **28,109,465,672 bytes** (~2.37M records on
  the network: 4 x 483K + ~288K sweep + 144,900 burst, ~11.9 KB/record), orderer 23,430,185,389 bytes.
  The peer log alone is 326 MB gzipped, too large for git: logs from 483K up stay in WSL, and only
  `ledger-size.txt` goes into the repo.
- **05:42 SP-1M** (0 + 3). Reset `network-reset-20260930-214252-13` (1000000 x 1) started.
- **05:43–05:45 SP-1M.** Reset `network-reset-20260930-214252-13` done; preflight green (host 3.7 %, load1
  3.28; projected ledger 12.0 GB per run; phase estimate 1,240 s of 18,000). Campaign
  `campaign-20260930-214456-14` (0 + 3) started 05:44.
- **05:45 (meanwhile)** SP-483K evidence copied (measured export at the tier root, sweep+burst export under
  `sweep/`, `ledger-size.txt` only) and its note written.
- **06:50 SP-1M m1 done**: 428.3 TPS (ballot window 2,335 s; generate 325 s; ~65 min per repetition incl.
  verify). Host samples 21.2 % / 9.2 % (under the line). m2 started. Index and notes drafted meanwhile.
- **07:50 SP-1M m2 FAILED** (`sp-1m-ch4-20260930-224736-41`, 22:47–23:38Z): `stage_error: submit: 67300 of
  1000000 ballots did not commit`. Every ballot from index 932,679 to 999,999 is a `drop` in
  `latencies.csv`, each after ~10.65 s; before that, 932,700 committed at 412.8 TPS. The progress
  checkpoints show a 12.7 s gap at 932,000 → 933,000 (23:34:33Z), then the rest of the window drained as
  failures (the closed-loop drain seen in T3). 18,654 `receipts.missing` journal events; `ledger.dump`
  skipped, `ledger_audit` "not run". Host samples 6.5 % / 18.8 % (not contention). Counted in the
  campaign's failure rate, excluded from its TPS/latency stats. The contention rule does not cover this,
  so no rerun. A `docker logs --since` scan I started to look at the peer at 23:34Z was stopped after
  ~2 min so as not to load the running m3; the logs saved after the item will be read offline instead.
- **07:55** STOP set so the driver halts after SP-1M: before the SP-1.92M reset destroys this network, I
  will resume m2 (submits only what the chain lacks, then closes) and run verify-only, to record whether the
  67,300 were lost or only unconfirmed. Then the driver is restarted for SP-1.92M.
- **07:57 SP-1M campaign `campaign-20260930-214456-14` ended `done` with 2 of 3 measured FAILED.** m1
  428.3 TPS (good); m2 67,300 dropped (above); m3 `sp-1m-ch4-20260930-233845-42` failed at once:
  `CreateElection: … dial tcp 127.0.0.1:7051: connect: connection refused` (peer down). summary.csv n = 1,
  failure_rate 0.667. Exported (the export reads run folders, not Docker).
- **08:00 ROOT CAUSE: the host disk Q: is full.** WSL kernel log, 07:34:05–07:34:15 local
  (uptime 23,045–23,055 s): `hv_storvsc … cmd 0x2a status: scsi 0x2` write failures, then
  `sd 0:0:0:2: Device offlined - not ready after error recovery`, `I/O error, dev sdc … (WRITE)`,
  `EXT4-fs (sdc): failed to convert unwritten extents … potential data loss`, then SIGBUS (signal 7) in
  `peer`, `chaincode` and `containerd-shim`. `sdc` is Docker's data disk, which holds the Fabric volumes:
  `C:\Users\User\AppData\Local\Docker\wsl\disk` is a junction to `Q:\DockerDesktop\DockerDesktopWSL\disk`,
  and `docker_data.vhdx` there is now **216.8 GB**. `Get-Volume`: **Q: 0 GB free of 931**; C: 19 GB free
  (Ubuntu's `ext4.vhdx`, 199.7 GB, is on C:). The dynamically expanding VHDX could not grow, so its writes
  failed and the guest offlined the disk mid-window. That is the m2 drop at 932,679 (07:34:33) and the
  dead peer for m3. Docker's API now answers 500 (`docker ps`, `docker logs`); Docker Desktop's Windows
  processes are still up. Physical disks report Healthy.
  My error: I read the peer volume's free space from inside the guest (`df` on sdc: 930 GB, the VHDX's
  *virtual* size) and the preflight Disk row (the runs volume), not the host drive that backs the VHDX.
  Q: had about 122 GB free at the start; SP-483K alone put ~80 GB on the three Fabric volumes (two peers
  and the orderer each keep a copy).
- **08:05 STOPPED, per the hard rules** (a Docker failure that a relaunch cannot fix: Docker Desktop would
  restart into the same full disk). Not done: the SP-1M redo, the m2 resume/verify-only, row 7a SP-1.92M,
  and SP-1M's peer and orderer logs (the evidence step hung on `docker logs` and was killed; the saved
  files hold only the 500 error). Driver killed (it was between items, hung in that evidence step);
  `~/ch4/night1/STOP` left in place. Console still answering (200). Docker not relaunched, nothing deleted.
  Needs the user: free space on Q: (and compact `docker_data.vhdx`, which is about 217 GB, mostly
  ledger now discarded by any reset), then relaunch Docker Desktop and check `up.sh status` before any
  more on-chain runs. SP-1.92M alone needs ~23 GB x 3 volumes ≈ 70 GB of real host space; SP-3.5M
  ~127 GB x 3.
- **08:10–08:40 Evidence and notes.** Exports unzipped and checked against their zips (every entry present,
  sizes equal) for cand10, cand28 (with their superseded attempts), the MP-1K security run, SP-483K
  (+ `sweep/`) and SP-1M. Notes: `2026-10-01-mp-1k-cand10.md`, `-mp-1k-cand28.md`,
  `-mp-1k-security.md`, `-sp-483k.md`, `-sp-1m.md`, and the index `2026-10-01-night1.md` (candidate-count
  table and fits: proof-gen R² 0.99999, proof-verify 0.99992, aggregate 0.99989, TPS 0.836). Peer and
  orderer logs are not committed (they stay in `~/ch4/night1/logs/`); `ledger-size.txt` is. Because Q: is
  full, the work was moved off it: the `../balotachain-n1` worktree was removed (it freed ~40 MB), and the
  commit was made in a shared clone on C: (session scratchpad `bc-n1`), then fetched into balotachain as
  branch **`docs/ch4-night1-2026-10-01` = `f2d8921`** (458 files, ~1.2 MB of objects). The main checkout
  stays on `main`, untouched. Not pushed.
- **Night 1 summary.** Done: cand10, cand28, MP-1K security, SP-483K + sweep + burst, and SP-1M m1. Not done:
  SP-1M m2/m3 (disk), SP-1.92M. Docker is down (API 500, Fabric data VHDX offlined); the console is up.
  Needs the user before anything else on-chain: free Q:, compact `docker_data.vhdx`, relaunch Docker
  Desktop, `./tools/up.sh status`, then the SP-1M redo and SP-1.92M (`rm ~/ch4/night1/STOP`; the driver's
  `state.json` already marks sp1m as not done).

## Night 2, 2026-10-01/02

Run agent, unattended. Scope (user, via the coordinator, 11:52): steps 0, 1, 2a (SP-1M redo, 0 + 3) and 2b
(SP-1.92M, 0 + 1) only, then the evidence work for those two. SP-3.5M, row 8 and row 9 run another night.
Console and network stay up after SP-1.92M. Driver `~/ch4/night2.py` (WSL; copy in the session scratchpad
`n2/`): imports `night1.py` for tier/campaign/evidence and adds (a) a disk budget check before each reset
and (b) deletion of each finished run's `ballots.csv` after its campaign is exported. Tmux `n2`, log
`~/ch4/night2/drive.log`, state `~/ch4/night2/state.json`, stop file `~/ch4/night2/STOP`, evidence
`~/ch4/night2/logs/<item>/`.

Disk budget rule (per reset): run-folder peak = records x 12.5 KB (ballots.ndjson 3.9 KB + the `ledger/`
dump 3.9 KB + ballots.csv 4.1 KB + small files; the user's "3.9 KB plus small files" left out the on-chain
ledger dump, measured 3.93 GB on SP-1M m1). Room = (Ubuntu ext4.vhdx size - WSL used) + C: free - 25 GB,
because the vhdx (on C:) only grows once its freed blocks are used up. Ledger on Q: = records x 34 KB
(night 1: peer 11.9 KB x 2 + orderer 9.9 KB) against Q: free - 25 GB. Stop if either fails or C:/Q: < 25 GB.

- **11:49 Step 0.** `~/ch4/night2/step0.sh`. Deleted `ballots.csv` from 507 run folders (65.47 GB; kept in
  `sp-10k-ch4-sec-20260929-183410-129`, `mp-1k-ch4-sec-20260930-185139-29`, `sp-10k-ch4-t3-20260929-183754-130`)
  and `ballots.ndjson` from the 292 run folders whose `run.json` `git_head_saksi` is not 4a38a54 (19.93 GB;
  builds 076b730 56, 302d569 43, 3cb07fc 50, 851ef86 6, cf9fd2a 71, ef663d1 66; all dated 2026-09-10..14).
  `df /` used 212.31 GB -> 126.91 GB (**85.4 GB freed** inside the Ubuntu disk). The ext4.vhdx on C: stays
  214.5 GB (not sparse), so ~87.5 GB of its blocks are now free for reuse. Host: C: 32.1 GB free, Q: 436.0 GB.
- **11:50–11:52 Bring-up.** `docker info` answered (29.7.2; Fabric containers gone, Supabase kept, exited).
  `~/bringup5.sh` (bringup4 style, PowerShell on PATH, `SAKSI_PHASE_TIMEOUT=5h`): `up.sh` created the
  network, deployed the chaincode and served the console on :8090 (`up-night2-1150.log`). Preflight
  (1M x 1) green: no warnings, Fabric reachable, ladder ok, host CPU 2.7 %; phase estimate 1,240 s of 18,000.
- **11:53 Driver started** (`night2.py all`). Budget sp1m: run folders need 37.5 GB of 94.7 GB room;
  ledger x3 needs 102.0 GB of 411.0 GB Q: room. Reset `network-reset-20261001-035309-1` (1000000 x 1).
- **11:53–11:54 SP-1M reset** `network-reset-20261001-035309-1` done (height 6, 83 s). Preflight green at
  11:54 (host 4.8 %, load1 1.87, no warnings; phase estimate 1,240 s of 18,000). Campaign
  **`campaign-20261001-035442-2`** (0 + 3) started 11:54. Evidence worktree `../balotachain-n2` on branch
  `docs/ch4-night1-2026-10-01` (Q: has room). A waiter polls the driver log every 90 s and host C:/Q:
  free every ~15 min (`~/ch4/night2/hostdisk.log`).
- **12:09 C: below 25 GB (22.8 GB) during SP-1M m1.** Not the run disk: the Ubuntu `ext4.vhdx` stayed at
  214.49 GB (not sparse; m1's generate reused freed blocks). A whole-C: scan for large files written in the
  last 45 min found only `C:\pagefile.sys`, now 12.37 GB (system-managed; host memory is tight: WSL holds
  ~23 GB, mostly page cache). The pagefile grew ~9 GB; Windows does not shrink it before a reboot.
  Docker's data VHDX on Q: went 13.7 -> 54.3 GB (guest fs used 34.6 GB: the VHDX grows faster than the
  data after a compaction); Q: 395.6 GB free. Per the stop rule, the run in progress continues and no
  further run starts while C: < 25 GB: `night2.py`'s budget check runs before the SP-1.92M reset and
  stops the driver there, leaving the network up.
- **12:37 Watcher handover; budget rule changed (user, 12:36).** C: at 22.8 GB is pagefile growth, not
  the run disk, so `night2.py`'s check now passes when C: >= 15 GB, Q: >= 25 GB and the Ubuntu ext4.vhdx has
  grown no more than 2 GB over its night-start size (214,485,172,224 B); the run-folder room uses the 15 GB
  C: floor. The running driver loaded the old rule, so it will still stop at the SP-1.92M check;
  `~/ch4/night2/restart.sh` (tmux `n2r`) waits for that exact stop after `STEP sp1m DONE` and relaunches
  `night2.py all` in tmux `n2b`, which skips sp1m via `state.json`. Any other ending is not relaunched.
- **12:49 SP-1M m1 done.** `sp-1m-ch4-20261001-035446-1`: 628.1 TPS, p99 391.2 ms; host CPU 18.4 % at
  start, 2.0 % at end. m2 `sp-1m-ch4-20261001-044622-2` started 12:46 (host 3.3 %).
- **12:59 SP-1M m1 done** (`sp-1m-ch4-20261001-035446-1`): 628.1 TPS, p99 391.2 ms, host 18.4 % / 2.0 %.
- **~12:3x** Claude Code reaped my background waiter for low host memory (as in night 1); polling is now
  foreground, ~9 min per poll. The driver and campaign are unaffected.
- **13:32 Q: 247.4 GB free (from 436.0 at 11:50).** Docker's data VHDX is **202.65 GB** while the guest fs
  inside it holds 84.7 GB: after the compaction, the VHDX grows with every block ext4 writes for the first
  time, and the peers' and orderer's LevelDB compactions keep writing new blocks, so the VHDX grows ~2.4x
  faster than the data. Measured: 13.7 -> 202.65 GB = **~189 GB of host Q: for ~2.0M records on chain**
  (m1 + m2's 1M, m2 now in verify), **≈ 95 KB of host disk per ballot record**, not the 34 KB of ledger the
  budget assumed. m3 adds ~1M records -> ~95 GB more, so Q: should end SP-1M near 150 GB free (above the
  25 GB floor). SP-1.92M on a reset network would need ~1.92M x 95 KB ≈ 182 GB of new VHDX growth (a reset
  frees blocks in the guest, but nothing guarantees the guest reuses them before touching fresh ones),
  which does not fit in ~150 - 25 GB. Together with C: < 25 GB (pagefile), **SP-1.92M will not start
  tonight**: `~/ch4/night2/STOP` set at 13:3x so the driver exits cleanly after SP-1M's evidence step, before
  any reset. Network and console stay up. Needs a VHDX compaction (elevated diskpart) before SP-1.92M.
- **13:27 SP-1M m2** ballot window done: 1,000,000 committed, window 1,740.7 s, 574.5 TPS (segment); verify
  running.
- **12:52 Plan change (user, via the coordinator).** Disk compaction approved for about 14:45, so
  SP-1.92M does not start from the driver: `~/ch4/night2/STOP` created (the driver checks it before each
  step) and the restarter (tmux `n2r`) removed. After SP-1M's export and evidence, the main session
  compacts the disk and starts SP-1.92M itself. The edited budget rule stays in `night2.py` for that start.
- **14:38 SP-1M m2 done, m3 running.** m2 `sp-1m-ch4-20261001-044622-2`: 574.5 TPS, p99 482.3 ms (host
  3.3 % / 5.2 %). m3 `sp-1m-ch4-20261001-054253-3` started 13:42 (host 4.9 %).
- **14:41 SP-1M done.** `campaign-20261001-035442-2` `done`, 3 measured, 0 failed, no host sample > 25 %.
  m3 `sp-1m-ch4-20261001-054253-3`: 561.2 TPS, p99 508.9 ms. Median **574.466 TPS**, p50 230.4 ms,
  **p99 482.31 ms**; E = 0 and `ledger_matches_local` true on every row of all three runs. Exported 14:41
  (`~/ch4/night2/exports/`); the three `ballots.csv` (4.06 GB each) deleted, `ballots.ndjson` kept.
- **14:42–14:49 SP-1M evidence.** `du -sb` (3.0M records): peer0.org1 35,483,116,738 B (**11.83 KB per
  record**), peer0.org2 35,480,530,091, orderer 29,132,099,100 (9.71 KB); docker logs in
  `~/ch4/night2/logs/sp-1m-ch4/`. Driver: `STEP sp1m DONE`, then stopped at the STOP file before sp192m.
- **14:50 Host disk.** C: 22.4 GB free, Ubuntu vhdx unchanged (214,485,172,224 B); **Q: 132.7 GB free**
  (436.0 at 11:53: ~303 GB used on Q: for 100.1 GB of ledger).
- **14:51 SP-1M evidence committed** in `../balotachain-n2` (branch `docs/ch4-night1-2026-10-01`, `5aef011`,
  not pushed): `docs/desktop-runs/2026-10-01-sp-1m{.md,/}`; Night 1's attempt moved to
  `2026-10-01-sp-1m-night1{.md,/}` and marked superseded; `2026-10-01-night1.md` updated. Handing back to
  the main session for the Q: compaction and SP-1.92M. Console and network left up; Docker/WSL untouched.
- **14:15–14:29 Q: during m3's ballot window** fell ~3.5 GB/min (154.6 -> 133.7 GB), then held at ~133 GB
  once m3 went to verify.
- **14:41 SP-1M campaign `campaign-20261001-035442-2` done**, 3 measured, 0 failed, no host sample over
  25 % (max 18.4 %); guest load1 8.5–10 on every sample (self-load, noted). m1 628.118 / m2 574.466 /
  m3 561.198 TPS; p99 391.2 / 482.3 / 508.9 ms; **median 574.466 TPS, p50 230.4, p99 482.3 ms**; E = 0 on
  every row. Exported (`~/ch4/night2/exports/campaign-20261001-035442-2.zip`, 166,661 B); the three
  `ballots.csv` (4.06 GB each) deleted after the export; `ballots.ndjson` kept.
- **14:48 SP-1M evidence** `~/ch4/night2/logs/sp-1m-ch4/`: peer0.org1 35,483,116,738 B, peer0.org2
  35,480,530,091 B, orderer 29,132,099,100 B for 3.0M records (11.83 / 9.71 KB per record; 100.1 GB for the
  three copies). Logs gz: peer0.org1 412 MB, orderer 100 MB, peer0.org2 6 MB. Host after: Q: 132.7 GB free,
  Docker VHDX **317.24 GB** (13.7 GB at 11:50: **303.5 GB of VHDX growth for 3.0M records, ≈ 101 KB per
  record, 3.0x the live ledger**); C: 22.4 GB, Ubuntu ext4.vhdx unchanged 214.49 GB; WSL `/` used 152.1 GB.
- **14:48 Driver exited cleanly on STOP before sp192m** (no reset; the network holds SP-1M's 3M records).
  Console (tmux `console`) and network up; tmux `n2` idle. A parallel writer had already copied the SP-1M
  export into `../balotachain-n2/docs/desktop-runs/2026-10-01-sp-1m/` and written its note (14:50–14:52),
  so I did not touch those files. To run SP-1.92M after the compaction: `rm ~/ch4/night2/STOP`, then
  `tmux new -d -s n2 'bash ~/ch4/go2.sh; bash'` (`state.json` marks sp1m done). Note the budget constant
  `LEDGER_B` (34 KB) understates VHDX growth (~101 KB/record measured): right after a compaction, SP-1.92M
  needs ~195 GB of Q:.

## Capstones, 2026-10-01 →

- **15:57 Host rebooted** (power loss suspected: PSU). Scope changed by the user: **capstone 1 (SP-1.92M) only**, then stop; SP-3.5M and the offline MP tiers move to the weekend after the PSU is replaced.
- **16:1x Schedule change (user, via the coordinator):** the 18:30–01:30 rule is dropped. Capstone 1 runs back to back: warm-up, the validation-gate timings, then m1, m2, m3 (compaction and reset between them). Only stop: `C:\Users\User\ch4-capstone\STOP` (a warm-up is cancelled, a measured run finishes first, then the queue holds) or a message. Rerun rule unchanged: a Windows `\Processor(_Total)\% Processor Time` sample > 25 % inside a measured ballot window reruns that run once. Brave limiter restarted 16:10 (pid in `%TEMP%\brave-limit.pid`).
- **16:3x Controller** `C:\Users\User\ch4-capstone\controller.py` (Windows Python, survives `wsl --shutdown`; state `state.json`, log `controller.log` in that folder). It waits for the WSL backup tar to finish, then per run: compaction via `SaksiCompactDocker` only when Q: free < records x 101 KB + 40 GB (after a reset wipes the old ledger, so the compaction can free it), Docker, `docker start` of the Fabric containers, `PT=8h ~/bringup5.sh`, reset, preflight green, a 10 s resource sampler (docker stats CPU/mem/BlockIO, WSL meminfo/loadavg, one long-lived `typeperf` for Windows CPU, available memory, per-disk % disk time and queue length; C:/Q: free and both VHDX sizes) to `~/ch4/capstone/<label>/resources.csv`, a single-rep campaign (0 + 1), export, `du` + docker logs, `ballots.csv` deleted, evidence copied and committed in `balotachain-n2`. Recovery follows the power-cut policy (containers started, no reset, resume / verify-only / ceremony / verify); a third crash stops it.
- **16:25** backup finished: tar 0.0 GB, no tar process
- **16:25** disk check: need 234.1 GB on Q: (records 1921917 x 101 KB + 40 GB); C: 36.1 GB free, Q: 436.1 GB free, docker vhdx 13.9 GB, ubuntu vhdx 214.49 GB
- **16:28** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-1626.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **16:29** reset (warmup) network-reset-20261001-082804-1 done, chain height 6, 81329 ms
- **16:29** preflight warmup green: host CPU 4.9 %, load1 0.83, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 2383.17708}
- **16:29** SP-1.92M ch4 warmup: campaign campaign-20261001-082938-2 started (C: 36.1 GB free, Q: 435.8 GB free, docker vhdx 14.2 GB, ubuntu vhdx 214.49 GB)
- **18:16** SP-1.92M ch4 warmup: campaign campaign-20261001-082938-2 done error=None run sp-1-92m-ch4-warmup-20261001-082942-1 tps 632.015 p99 437.781 failed False  resumed False
- **18:16** warmup: resources: ballot window: 2026-10-01 16:41:56 to 2026-10-01 17:32:41 | host CPU samples in window: 304, max 87.3 %, over 25 %: 302 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 471 %, peer0.org1.example.com 400 %, peer0.org2.example.com 177 % | bottleneck: Windows available memory fell to 40 MB; WSL load1 mean 16.9 of 16 CPUs in the ballot window
- **18:16** export campaign-20261001-082938-2 -> http 200 rc 0
- **18:18** warmup: ledger du: peer0.org1.example.com 22903711701 /var/hyperledger/production | peer0.org2.example.com 22904439282 /var/hyperledger/production | orderer.example.com 19184885715 /var/hyperledger/production/orderer | /dev/sde       1081101176832 82506706944 943602114560   9% /var/hyperledger/production | 
- **18:18** gate SP-1K: 1000 rows, check [0.115, 0.053, 0.055] s (median 0.055), 18,182 rows/s, 7 checks pass
- **18:19** gate SP-10K: 10000 rows, check [0.048, 0.058, 0.056] s (median 0.056), 178,571 rows/s, 7 checks pass
- **18:19** gate SP-50K: 50000 rows, check [0.064, 0.062, 0.066] s (median 0.064), 781,250 rows/s, 7 checks pass
- **18:19** gate SP-483K: 483000 rows, check [0.196, 0.14, 0.158] s (median 0.158), 3,056,962 rows/s, 7 checks pass
- **18:19** gate SP-1M: 1000000 rows, check [0.209, 0.208, 0.205] s (median 0.208), 4,807,692 rows/s, 7 checks pass
- **18:19** gate SP-1.92M: 1921917 rows, check [0.705, 0.475, 0.481] s (median 0.481), 3,995,669 rows/s, 7 checks pass
- **18:19** gate SP-3.5M: 3524078 rows, check [0.875, 0.8, 0.705] s (median 0.800), 4,405,098 rows/s, 7 checks pass
- **18:19** gate MP-1K: 1000 rows, check [0.033, 0.004, 0.002] s (median 0.004), 250,000 rows/s, 7 checks pass
- **18:19** gate MP-10K: 10000 rows, check [0.007, 0.01, 0.007] s (median 0.007), 1,428,571 rows/s, 7 checks pass
- **18:19** gate MP-50K: 50000 rows, check [0.165, 0.016, 0.019] s (median 0.019), 2,631,579 rows/s, 7 checks pass
- **18:20** gate MP-483K: 483000 rows, check [0.235, 0.176, 0.178] s (median 0.178), 2,713,483 rows/s, 7 checks pass
- **18:20** gate MP-1M: 1000000 rows, check [0.301, 0.314, 0.309] s (median 0.309), 3,236,246 rows/s, 7 checks pass
- **18:20** gate MP-1.92M: 1921917 rows, check [0.558, 0.654, 0.503] s (median 0.558), 3,444,296 rows/s, 7 checks pass
- **18:21** gate MP-3.5M: 3524078 rows, check [0.897, 0.843, 0.848] s (median 0.848), 4,155,752 rows/s, 7 checks pass
- **18:21** gate timings done:
| Tier | Voters (table rows) | Ballot records | Check s (median of 3) | Rows per second | Run |
|---|---|---|---|---|---|
| SP-1K | 1,000 | 1,000 | 0.055 | 18,182 | `sp-1k-ch4-gate-20261001-101851-2` |
| SP-10K | 10,000 | 10,000 | 0.056 | 178,571 | `sp-10k-ch4-gate-20261001-101857-3` |
| SP-50K | 50,000 | 50,000 | 0.064 | 781,250 | `sp-50k-ch4-gate-20261001-101903-4` |
| SP-483K | 483,000 | 483,000 | 0.158 | 3,056,962 | `sp-483k-ch4-gate-20261001-101909-5` |
| SP-1M | 1,000,000 | 1,000,000 | 0.208 | 4,807,692 | `sp-1m-ch4-gate-20261001-101915-6` |
| SP-1.92M | 1,921,917 | 1,921,917 | 0.481 | 3,995,669 | `sp-1-92m-ch4-gate-20261001-101921-7` |
| SP-3.5M | 3,524,078 | 3,524,078 | 0.800 | 4,405,098 | `sp-3-5m-ch4-gate-20261001-101929-8` |
| MP-1K | 1,000 | 3,000 | 0.004 | 250,000 | `mp-1k-ch4-gate-20261001-101942-9` |
| MP-10K | 10,000 | 30,000 | 0.007 | 1,428,571 | `mp-10k-ch4-gate-20261001-101948-10` |
| MP-50K | 50,000 | 150,000 | 0.019 | 2,631,579 | `mp-50k-ch4-gate-20261001-101954-11` |
| MP-483K | 483,000 | 1,449,000 | 0.178 | 2,713,483 | `mp-483k-ch4-gate-20261001-102000-12` |
| MP-1M | 1,000,000 | 3,000,000 | 0.309 | 3,236,246 | `mp-1m-ch4-gate-20261001-102006-13` |
| MP-1.92M | 1,921,917 | 5,765,751 | 0.558 | 3,444,296 | `mp-1-92m-ch4-gate-20261001-102013-14` |
| MP-3.5M | 3,524,078 | 10,572,234 | 0.848 | 4,155,752 | `mp-3-5m-ch4-gate-20261001-102020-15` |
- **18:21** disk check: need 234.1 GB on Q: (records 1921917 x 101 KB + 40 GB); C: 26.5 GB free, Q: 246.7 GB free, docker vhdx 203.2 GB, ubuntu vhdx 214.49 GB
- **18:23** reset (m1) network-reset-20261001-102119-3 done, chain height 6, 149764 ms
- **18:23** preflight m1 green: host CPU 16.1 %, load1 2.16, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 2383.17708}
- **18:23** SP-1.92M ch4 m1: campaign campaign-20261001-102357-4 started (C: 26.2 GB free, Q: 246.7 GB free, docker vhdx 203.2 GB, ubuntu vhdx 214.49 GB)
- **19:07 Power lost (second cut today).** m1 (`campaign-20261001-102357-4`, run `sp-1-92m-ch4-m1-20261001-102400-16`) was in its ballot window; last journal line `ballots.progress` done=881000 at 11:07:21Z (19:07:21 local). Host back 19:07:42; Docker Desktop relaunched by the main session; controller task `Ch4Capstone` stopped. Recovery agent follows the power-cut policy: resume, no reset.
- **19:11** `docker start` orderer, both peers, both chaincode containers: all Up. Peer logs: delivery resumed at block 17640 and committed it; orderer re-elected itself Raft leader at block 17640. No ledger errors.
- **19:12** console restarted (`PT=8h ~/bringup5.sh`, tmux `console`, PowerShell dir on PATH): up.sh reported "Fabric network already running (channel saksi)" — no network rebuilt. Campaign reads `interrupted` ("the console stopped while this campaign was running"); run reads `interrupted`, `resumable: true`; preflight fabric reachable.
- **19:13 Ledger intact.** Both peers report channel `saksi` height 17641 with the same current block hash (`0LVmstV0…`). `POST /api/runs/<m1>/verify-only` before the resume (allowed by runbook §10.6, records the chain as the cut left it): `verify_only.reconcile` chain_count 881,628 = committed_local 881,628, reconciled true, missing 1,040,289; `verify_only.chain` PASS, linked. No reset needed.
- **19:15** Controller task `Ch4Capstone` restarted. State backed up to `state.before-recovery.json`; `rerun_used.m1 = true` set, because a resumed run is not redone (power-cut policy) and the host-CPU rerun rule must not turn m1 into a redo. The controller's `recover()` now runs resume → verify-only → three trustee shares → publish → verify, then export, and continues to m2 and m3 (each: reset, compaction if Q: is short, preflight, single-rep campaign).
- **19:15** backup finished: tar 0.0 GB, no tar process
- **19:15** recovering m1 (campaign campaign-20261001-102357-4, run sp-1-92m-ch4-m1-20261001-102400-16)
- **19:15** resume #1 sp-1-92m-ch4-m1-20261001-102400-16 -> 202 {'segment': 1, 'remaining': 1040917}
- **19:43** main session: C: at 19.1 GB (pagefile 16.2 GB + hiberfil 12.8 GB on C:). Freed space inside the Ubuntu disk so m2/m3 run folders do not grow the vhdx: deleted ballots.ndjson/csv of night 1's invalid SP-1M attempt (3 runs, superseded) and of the discarded SP-1.92M warm-up.
- **19:54** verify-only sp-1-92m-ch4-m1-20261001-102400-16 -> 202 {'run_id': 'sp-1-92m-ch4-m1-20261001-102400-16'}
- **19:59** verify sp-1-92m-ch4-m1-20261001-102400-16 -> 202 {'run_id': 'sp-1-92m-ch4-m1-20261001-102400-16'}
- **20:28** SP-1.92M ch4 m1: campaign campaign-20261001-102357-4 interrupted error=the console stopped while this campaign was running run sp-1-92m-ch4-m1-20261001-102400-16 tps None p99 None failed True no perf.csv resumed True
- **20:28** m1: resources: ballot window: 2026-10-01 18:38:48 to 2026-10-01 19:50:35 | host CPU samples in window: 364, max 89.1 %, over 25 %: 354 | top container CPU peaks in window: peer0.org1.example.com 1506 %, dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 460 %, peer0.org2.example.com 426 % | bottleneck: Windows available memory fell to 227 MB; win.PhysicalDisk(0 C:)\% Disk Time mean 130 % busy in the ballot window
- **20:28** export campaign-20261001-102357-4 -> http 200 rc 0
- **20:28** m1: ledger du: peer0.org1.example.com 22845034111 /var/hyperledger/production | peer0.org2.example.com 22846292058 /var/hyperledger/production | orderer.example.com 19151726583 /var/hyperledger/production/orderer | /dev/sde       1081101176832 82402213888 943706607616   9% /var/hyperledger/production | 
- **20:28** m1: host CPU > 25 % again; rerun used, the run stands flagged
- **20:28** disk check: need 234.1 GB on Q: (records 1921917 x 101 KB + 40 GB); C: 43.4 GB free, Q: 217.7 GB free, docker vhdx 232.3 GB, ubuntu vhdx 214.49 GB
- **20:31** reset (pre-compaction wipe) network-reset-20261001-122902-1 done, chain height 6, 107855 ms
- **20:31** compaction task start (C: 45.7 GB free, Q: 217.7 GB free, docker vhdx 232.3 GB, ubuntu vhdx 214.49 GB)
- **20:32** compaction done: 2026-10-01T20:31:10 start; vhdx 216.3 GB; Q free 202.8 GB | 2026-10-01T20:31:41 done; vhdx 13.2 GB; Q free 405.8 GB | 2026-10-01T20:31:41 docker relaunched
- **20:33** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-2032.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **20:34** reset (m2) network-reset-20261001-123306-1 done, chain height 6, 84007 ms
- **20:34** preflight m2 green: host CPU 2.8 %, load1 3.49, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 2383.17708}
- **20:34** SP-1.92M ch4 m2: campaign campaign-20261001-123440-2 started (C: 45.6 GB free, Q: 435.6 GB free, docker vhdx 14.4 GB, ubuntu vhdx 214.49 GB)
- **22:12** SP-1.92M ch4 m2: campaign campaign-20261001-123440-2 done error=None run sp-1-92m-ch4-m2-20261001-123444-1 tps 633.278 p99 460.389 failed False  resumed False
- **22:12** m2: resources: ballot window: 2026-10-01 20:45:44 to 2026-10-01 21:36:19 | host CPU samples in window: 303, max 85.3 %, over 25 %: 302 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 487 %, peer0.org1.example.com 404 %, peer0.org2.example.com 178 % | bottleneck: Windows available memory fell to 594 MB; WSL load1 mean 15.6 of 16 CPUs in the ballot window
- **22:12** export campaign-20261001-123440-2 -> http 200 rc 0
- **22:14** m2: ledger du: peer0.org1.example.com 22839034598 /var/hyperledger/production | peer0.org2.example.com 22840108955 /var/hyperledger/production | orderer.example.com 19070735690 /var/hyperledger/production/orderer | /dev/sdc       1081101176832 82461999104 943646822400   9% /var/hyperledger/production | 
- **22:14** m2: 302 host CPU samples > 25 % in the ballot window: rerunning once as m2-rerun
- **22:14** disk check: need 234.1 GB on Q: (records 1921917 x 101 KB + 40 GB); C: 45.5 GB free, Q: 207.3 GB free, docker vhdx 242.7 GB, ubuntu vhdx 214.49 GB
- **22:16** reset (pre-compaction wipe) network-reset-20261001-141444-3 done, chain height 6, 91038 ms
- **22:16** compaction task start (C: 45.5 GB free, Q: 207.3 GB free, docker vhdx 242.7 GB, ubuntu vhdx 214.49 GB)
- **22:17** compaction done: 2026-10-01T22:16:16 start; vhdx 226 GB; Q free 193 GB | 2026-10-01T22:16:49 done; vhdx 13.3 GB; Q free 405.7 GB | 2026-10-01T22:16:49 docker relaunched
- **22:20 Contention rule fixed (coordinator).** The controller flagged m2 with 302 host-CPU samples > 25 % and queued `m2-rerun`. That count was false: Windows `\Processor(_Total)` includes the WSL VM (vmmemWSL) running the run itself (the warm-up showed 302 too; preflight host CPU before m2 was 2.8 %). Controller stopped during the wait after the compaction (no run had started), `m2-rerun` cancelled, **m2 stands** (not contended). New rule in `controller.py`: the sampler also records `\Process(vmmem*)\% Processor Time`; a sample is contended only if host CPU minus vmmemWSL/CPUs > 25 % (selftest added). m1 keeps its contended flag (user activity, mpv and Lively open until ~19:45); its 354 raw samples cannot be VM-corrected after the fact. State backed up to `state.before-m2-fix.json`. Next and last run: m3 (`SP-1.92M ch4 m3`), then stop.
- **m1 resumed, finished 20:28.** Segment 0 (cut): 881,628 committed in ~1,670 s, ~528 TPS (no `segment.end`; derived). Segment 1 (resume): 1,040,289 committed, 0 dropped, 505.5 TPS, p50 247 ms. Verify pass, E = 0 on every contest (local and ledger), `ledger_matches_local` true. Cut attributed to a power event (Event 41, no bugcheck, no power button, no WHEA; second today; PSU suspected); note `docs/desktop-runs/2026-10-01-sp-1.92m/m1/RESUMED.md` (n2 `1640390`, pushed).
- **m2 done 22:12:** 633.3 TPS, p99 460 ms, not contended (corrected). Pushed with the correction.
- **22:20** backup finished: tar 0.0 GB, no tar process
- **22:20** disk check: need 234.1 GB on Q: (records 1921917 x 101 KB + 40 GB); C: 45.5 GB free, Q: 435.6 GB free, docker vhdx 14.3 GB, ubuntu vhdx 214.49 GB
- **22:21** reset (m3) network-reset-20261001-142002-1 done, chain height 6, 82470 ms
- **22:21** preflight m3 green: host CPU 2.4 %, load1 2.59, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 2383.17708}
- **22:21** SP-1.92M ch4 m3: campaign campaign-20261001-142136-2 started (C: 45.5 GB free, Q: 435.4 GB free, docker vhdx 14.5 GB, ubuntu vhdx 214.49 GB)
- **23:57** SP-1.92M ch4 m3: campaign campaign-20261001-142136-2 done error=None run sp-1-92m-ch4-m3-20261001-142140-1 tps 637.125 p99 430.245 failed False  resumed False
- **23:57** m3: resources: ballot window: 2026-10-01 22:32:51 to 2026-10-01 23:23:49 | host CPU samples in window: 303, max 81.0 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 303 samples, max 23.3 %, over 25 % (contended): 0 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 490 %, peer0.org1.example.com 416 %, peer0.org2.example.com 195 %
- **23:57** export campaign-20261001-142136-2 -> http 200 rc 0
- **00:00** m3: ledger du: peer0.org1.example.com 22823819846 /var/hyperledger/production | peer0.org2.example.com 22825060222 /var/hyperledger/production | orderer.example.com 19054649272 /var/hyperledger/production/orderer | /dev/sdc       1081101176832 82549452800 943559368704   9% /var/hyperledger/production | 
- **00:00** capstone 1 queue complete: [{"label": "warmup", "run": "sp-1-92m-ch4-warmup-20261001-082942-1", "tps": 632.015, "p99": 437.781, "hot_samples": 302, "resumed": false}, {"label": "m1", "run": "sp-1-92m-ch4-m1-20261001-102400-16", "tps": null, "p99": null, "hot_samples": 354, "resumed": true}, {"label": "m2", "run": "sp-1-92m-ch4-m2-20261001-123444-1", "tps": 633.278, "p99": 460.389, "hot_samples": 0, "resumed": false}, {"label": "m3", "run": "sp-1-92m-ch4-m3-20261001-142140-1", "tps": 637.125, "p99": 430.245, "hot_samples": 0, "resumed": false}]

## Capstone 2, 2026-10-02 →

- **18:00** PC rebooted cleanly 17:53. Docker Desktop and the Brave limiter started. Disk: C: 42.9 GB free, Q: 208.1 GB free, docker vhdx 210.9 GB (SP-1.92M m3 ledger), Ubuntu ext4.vhdx 214.5 GB with 197.8 GB used inside (16.6 GB slack).
- **18:02 Controller reconfigured for capstone 2** (backups: `controller.capstone1.py`, `state.capstone1.json`; capstone-1 results kept in `state.json` under `capstone1`). Queue: `SP-3.5M ch4 warmup`, `m1`, `m2`, `m3` (3,524,078 x 1, onchain, everything else as SP-1.92M), then row 8 offline `MP-483K`, `MP-1M`, `MP-1.92M`, `MP-3.5M ch4 offline` (0 + 1, no reset). Every SP-3.5M run: wipe reset, compaction task, bring-up, Q: check (need 395.9 GB; fallback 15 GB margin = 370.9 GB, logged; else stop), fresh reset, preflight (no warnings, phase timeout 8h), sampler on. Rerun rule: host CPU minus vmmemWSL/CPUs > 25 % in the window, once. Warm-up: both `ballots.ndjson` copies deleted after verify + export; every run's `ballots.csv` deleted after export. Evidence to `docs/desktop-runs/2026-10-02-sp-3.5m/` and `2026-10-03-offline-mp/` in the n2 worktree, committed and pushed per run.
- **18:02 C: budget finding.** An onchain run writes THREE big files in the Ubuntu disk, not two: `ballots.ndjson` (3,919 B/record), the verify ledger dump `ledger/ballots.ndjson` (same size, not byte-identical), and `ballots.csv` (4,072 B/record). SP-3.5M ≈ 43 GB per run at peak, ~27.6 GB kept per measured run. Room now ≈ 44.6 GB (C: above its 15 GB floor + 16.6 GB vhdx slack): warm-up and m1 fit; m2 does not unless space is freed. The controller checks this before every run and stops before a run that does not fit (and cancels mid-run if C: < 8 GB).
- **18:03** controller start (pid 6272)
- **18:03** C: check sp35-warmup: run writes ~43.2 GB inside the Ubuntu disk (3524078 records); room 47.7 GB (C: above 15 GB + 16.6 GB ext4.vhdx slack); C: 46.1 GB free, Q: 223.5 GB free, docker vhdx 226.5 GB, ubuntu vhdx 214.49 GB
- **18:03** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-1803.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **18:04** reset (pre-compaction wipe) network-reset-20261002-100317-1 done, chain height 6, 84996 ms
- **18:04** compaction task start (C: 46.1 GB free, Q: 223.4 GB free, docker vhdx 226.5 GB, ubuntu vhdx 214.49 GB)
- **18:05** compaction done: 2026-10-02T18:04:49 start; vhdx 211 GB; Q free 208.1 GB | 2026-10-02T18:05:22 done; vhdx 13.5 GB; Q free 405.5 GB | 2026-10-02T18:05:22 docker relaunched
- **18:05** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-1805.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **18:05** disk check: need 395.9 GB on Q: (records 3524078 x 101 KB + 40 GB); C: 46.1 GB free, Q: 435.4 GB free, docker vhdx 14.6 GB, ubuntu vhdx 214.49 GB
- **18:07** reset (sp35-warmup) network-reset-20261002-100555-1 done, chain height 6, 84096 ms
- **18:07** preflight sp35-warmup green: host CPU 2.2 %, load1 2.43, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 4369.856719999}, no warnings
- **18:07** SP-3.5M ch4 warmup: campaign campaign-20261002-100730-2 started (C: 46.0 GB free, Q: 435.2 GB free, docker vhdx 14.7 GB, ubuntu vhdx 214.49 GB)
- **18:07** Warm-up `SP-3.5M ch4 warmup` started: wipe reset 18:04, compaction 18:04–18:05 (docker vhdx 211 → 13.5 GB, Q: 435.4 GB free ≥ 395.9 GB need, full 40 GB margin), fresh reset 18:07, preflight green (host CPU 2.2 %, phase timeout 8h, estimate 4,370 s for ballot submission, no warnings). Campaign `campaign-20261002-100730-2`, run `sp-3-5m-ch4-warmup-20261002-100733-1`.
- **18:30** Generate took 22.4 min (ballots.ndjson 13.8 GB and ballots.csv 14.4 GB are written at generate). Ballot window opened 18:30:41. First 3.7 min: 206,000 submitted, ~928 ballots/s by the progress counter (committed TPS comes at the end).
- **18:39** controller start (pid 17104)
- **18:39** recovering sp35-warmup (campaign campaign-20261002-100730-2, run sp-3-5m-ch4-warmup-20261002-100733-1)
- **18:40 Coordinator decision on C: (lossless compression, keep every ballot file).** No ndjson or ledger dump is deleted any more (the warm-up deletion is removed). zstd 1.5.7 installed in Ubuntu (`apt-get install zstd` as WSL root, no prompt). New `~/ch4/zpack.sh`: per file, sha256 of the original into `<file>.sha256`, `zstd -T2 -6`, `zstd -t`, then a full decompress-and-hash check against the sidecar; only then the original is removed. Run as `nice -n 19 ionice -c3`.
  - Measured ratio: `sp-483k-ch4-20260930-212207-38/ballots.ndjson` 1,889,979,000 → 926,930,516 B (0.4904; ciphertext-heavy), 2 min 13 s, 0.96 GB freed.
  - 18:38 background pass started over the other 26 ndjson files ≥ 1 GB from earlier runs (~102.8 GB; SP-1.92M warm-up ledger dump, m1/m2/m3, SP-1M, SP-483K; the running warm-up excluded). Log `~/ch4/zpack-2026-10-02.log`. Expected ~2 h, ~52 GB freed. The warm-up is discarded, so this is not a measured window.
  - Controller patched (backup `controller.before-zstd.py`): after each run's export and csv deletion, `zpack.sh` on its `ballots.ndjson` and `ledger/ballots.ndjson`, before the next run's compaction/reset. The room check still uses the uncompressed peak (ndjson + csv are written at generate, the ledger dump at verify); it now also logs what each run keeps after zstd (ratio 0.4904). Evidence notes carry the zstd + sha256 restore line.
  - 18:39 controller restarted to load the patch (pid 6272 and its typeperf stopped; new pid 17104). It took the recovery path: the campaign was still running, so it simply resumed polling; not a resume of the run (`resumed` stays false). Sampler gap 18:39:14–18:40:01 in the warm-up's resources.csv.
- **18:40–18:55 Warm-up throughput vs the compression pass** (progress counter; warm-up is discarded, recorded as evidence only):
  - 18:30:41–18:34:23, no compression: ~914 ballots/s.
  - 18:38–18:42, compression running: 462,000 at 583 s (avg 792/s), then a ~90 s near-stall 18:40:24–18:41:53 (6,000 in 88 s) while the controller restarted; one `wsl` call from Windows failed with `HCS_E_CONNECTION_TIMEOUT` at 18:41. WSL load1 16.3.
  - 18:44–18:49, compression paused (SIGSTOP): 591/s. 18:49–18:54, resumed: 406/s.
  - So `nice`/`ionice -c3` do not isolate it: ionice is ignored on the WSL virtual disk, and the zstd + sha256 work shares the VM with the submitter. Compression therefore never overlaps a measured run's window or verify; the controller runs it only between runs (in `finish`, before the next compaction). Old-file pass left running through the warm-up (discarded) so its ~52 GB of slack is there before the warm-up's verify writes the 13.8 GB ledger dump.
  - My own mistake at 18:42: `pkill -STOP -f zpack.sh` also matched (and stopped) the `bash -c` that ran it; killed at 18:49 and zpack continued. No run state touched.
- **19:55 Old-file compression pass done.** 27 files (every ndjson ≥ 1 GB from earlier runs), 102,777,760,065 → 50,354,523,978 B (ratio 0.4899), every one sha256-recorded, `zstd -t` and decompress-hash checked before the original was removed; 0 failures. Freed 53.4 GB inside the Ubuntu disk (ext4 used 172.9 GB in a 231.5 GB vhdx, so 58.7 GB slack). Room now ≈ 72.9 GB (C: 29.2 GB free).
  - Forecast with zstd: before m1 ≈ 88 GB; each SP-3.5M measured run peaks ~43 GB and keeps ~13.5 GB, so m1–m3 fit (≈ 47 GB left after m3). Offline then: MP-483K (peak ~12 GB) and MP-1M (~25 GB) fit; MP-1.92M (~48 GB) and MP-3.5M (~88 GB) likely do not. The controller will stop before the first one that does not fit and log the measured need.
- **19:57** Warm-up at 2,724,000 of 3,524,078 (~520/s over the last 20 min).
- **20:24** Warm-up ballot window closed: 3,524,078 committed, 0 dropped, 515.7 TPS (segment 0), p50 200.6 ms, window 6,833 s (1 h 54 min); the compression pass overlapped 18:38–19:55. Verify and ceremony next.
- **20:58** controller start (pid 2804)
- **20:58** recovering sp35-warmup (campaign campaign-20261002-100730-2, run sp-3-5m-ch4-warmup-20261002-100733-1)
- **20:50 User decision (via coordinator): archive the compressed ballot files to Q: for the offline tiers.** New `~/ch4/zarchive.sh`: each `*.ndjson.zst` (+ its original's `.sha256`) is copied to `/mnt/q/thesis-archive/runs/<run>/...` (same layout), the copy's sha256 compared with the source `.zst`, and only then the source removed; `ARCHIVED.txt` in the run folder records each move (Windows path, bytes, zst sha256, sidecar). Tested on a dummy run folder (pack, archive, restore-and-hash from Q: matched; dummy removed).
  - Controller patched (backup `controller.before-archive.py`): new queue step `archive` after `sp35-m3`: wipe reset, the final Docker compaction, bring-up, then archive every run's `.zst` to Q:. Offline runs: after export, csv deleted, ndjson compressed, then that run's `.zst` archived before the next run. Archiving runs only between runs. Run folders stay on the Ubuntu disk (the offline I/O path is unchanged). Evidence notes name the Q: archive.
  - 20:56–20:58 controller restarted to load it (pid 2804; first `schtasks /run` was ignored while the killed instance still counted as running). Warm-up in verify, still the recovery/poll path, not a resume; sampler gap 20:56–20:58.
- **21:41** SP-3.5M ch4 warmup: campaign campaign-20261002-100730-2 done error=None run sp-3-5m-ch4-warmup-20261002-100733-1 tps 515.733 p99 514.138 failed False  resumed False
- **21:41** controller died: Traceback (most recent call last):
  File "C:\Users\User\ch4-capstone\controller.py", line 1023, in <module>
    main()
  File "C:\Users\User\ch4-capstone\controller.py", line 962, in main
    res = do_run(label, measured)
          ^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\User\ch4-capstone\controller.py", line 622, in do_run
    return recover(cur, measured)
           ^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\User\ch4-capstone\controller.py", line 710, in recover
    return finish(cur, c, measured)
           ^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\User\ch4-capstone\controller.py", line 779, in finish
    summary, hot = resources_summary(os.path.join(d, "resources.csv"), win)
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\User\ch4-capstone\controller.py", line 545, in resources_summary
    lines.append(f"{k:60s} {max(allv):14.1f} {statistics.mean(wv) if wv else float('nan'):14.1f} "
                            ^^^^^^^^^
ValueError: max() iterable argument is empty

- **21:46** controller start (pid 7252)
- **21:46** recovering sp35-warmup (campaign campaign-20261002-100730-2, run sp-3-5m-ch4-warmup-20261002-100733-1)
- **21:46** verify-only sp-3-5m-ch4-warmup-20261002-100733-1 -> 202 {'run_id': 'sp-3-5m-ch4-warmup-20261002-100733-1'}
- **21:50 (run agent)** Controller pid 2804 died at 21:41:30 in `finish` → `resources_summary` (`max()` of an empty metric series) after the warm-up campaign finished (verify pass 21:40:59, `ledger_matches_local` true, sustained 515.7 TPS). A restart at 21:46:50 (pid 7252, with `controller.py` edited 21:46:49 and `state.before-warmup-fix.json` saved: not by the run agent) took the old recovery branch: the campaign was already `done`, so it fell through to `verify-only` (202, 21:46:58, now re-verifying the warm-up). pid 7252 was no longer running at 21:49; an orphaned typeperf (pid 20412) remains. The run agent stopped touching the controller and handed this to the coordinator to avoid two actors on it. Warm-up export, csv deletion, zstd and evidence are not yet done.
- **21:50** controller start (pid 16484)
- **21:50** C: check sp35-m1: run writes ~43.2 GB inside the Ubuntu disk (3524078 records); room 54.0 GB (C: above 15 GB + 43.6 GB ext4.vhdx slack); C: 25.4 GB free, Q: 41.7 GB free, docker vhdx 408.2 GB, ubuntu vhdx 231.53 GB
- **21:50** C: sp35-m1 keeps ~13.5 GB after csv deletion and zstd (ratio 0.4904)
- **21:50** STOPPED at sp35-m1: reset (pre-compaction wipe): 409 {'busy': ['sp-3-5m-ch4-warmup-20261002-100733-1'], 'error': 'a phase is running on [sp-3-5m-ch4-warmup-20261002-100733-1]: a network-reset would share the network with it; let it finish or cancel it first'}
- **22:02** controller start (pid 7036)
- **22:02** recovering sp35-warmup (campaign campaign-20261002-100730-2, run sp-3-5m-ch4-warmup-20261002-100733-1)
- **22:03** sp35-warmup: campaign already done; post-run steps only
- **22:03** SP-3.5M ch4 warmup: campaign campaign-20261002-100730-2 done error=None run sp-3-5m-ch4-warmup-20261002-100733-1 tps 515.733 p99 514.138 failed False  resumed False
- **22:03** sp35-warmup: resources: ballot window: 2026-10-02 18:30:41 to 2026-10-02 20:24:35 | host CPU samples in window: 577, max 89.1 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 577 samples, max 17.4 %, over 25 % (contended): 0 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 458 %, peer0.org1.example.com 446 %, peer0.org2.example.com 215 %
- **22:03** export campaign-20261002-100730-2 -> http 200 rc 0
- **22:00 Run agent owns the controller again** (the 21:46 edits and restarts were the main session's: `resources_summary` skips empty series; pid 16484 then STOPPED at sp35-m1 because the reset got 409 while the redundant warm-up verify-only was busy; `/cancel` returned 200 but did not stop it).
  - 21:51–22:02 console restarted to end the redundant verify-only (it had only reconciled, `verify_only.reconcile` 3,524,078/3,524,078, missing 0; the ledger dump `ledger/ballots.ndjson` was untouched, still the 21:15 file). First `bringup5` attempt hit "tmux: server exited unexpectedly"; second came up 22:02 with phase timeout 8h, network kept (no reset). The orphaned typeperf (pid 20412) killed.
  - Controller patched (backup `controller.before-recover-fix.py`): `recover()` now goes straight to the post-run steps when the campaign is already `done` (waits for the run to be idle; no resume, no re-verify). The warm-up's zstd is deferred until after m1's post-run steps (room for m1 holds without it: 54 GB before the warm-up csv is deleted, need 43.2 GB), to start m1 sooner.
  - State (backup `state.before-warmup-finish.json`): the manual warm-up result entry removed and `current` restored so the controller runs the warm-up's post-run steps (export, csv deletion, evidence, commit+push) itself. `resumed` set back to false: the warm-up was never resumed, only re-verified by mistake. 22:02:46 controller started (pid 7036).
- **22:09** sp35-warmup: ledger du: peer0.org1.example.com 41944503091 /var/hyperledger/production | peer0.org2.example.com 41944827597 /var/hyperledger/production | orderer.example.com 34334542591 /var/hyperledger/production/orderer | /dev/sdc       1081101176832 140284190720 885824630784  14% /var/hyperledger/production | 
- **22:09** deleted sp-3-5m-ch4-warmup-20261002-100733-1/ballots.csv (14373603188 bytes)
- **22:09** sp-3-5m-ch4-warmup-20261002-100733-1: zstd of its ndjson deferred to after the next run (start m1 sooner)
- **22:09** push docs/ch4-night1-2026-10-01 -> rc 0 
- **22:09** C: check sp35-m1: run writes ~43.2 GB inside the Ubuntu disk (3524078 records); room 71.4 GB (C: above 15 GB + 57.3 GB ext4.vhdx slack); C: 29.0 GB free, Q: 41.7 GB free, docker vhdx 408.2 GB, ubuntu vhdx 231.53 GB
- **22:09** C: sp35-m1 keeps ~13.5 GB after csv deletion and zstd (ratio 0.4904)
- **22:11** reset (pre-compaction wipe) network-reset-20261002-140936-1 done, chain height 6, 105157 ms
- **22:11** compaction task start (C: 29.0 GB free, Q: 41.7 GB free, docker vhdx 408.2 GB, ubuntu vhdx 231.53 GB)
- **22:12** compaction done: 2026-10-02T22:11:39 start; vhdx 380.2 GB; Q free 38.8 GB | 2026-10-02T22:12:10 done; vhdx 13.6 GB; Q free 405.4 GB | 2026-10-02T22:12:10 docker relaunched
- **22:12** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-2212.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **22:12** disk check: need 395.9 GB on Q: (records 3524078 x 101 KB + 40 GB); C: 29.0 GB free, Q: 435.3 GB free, docker vhdx 14.7 GB, ubuntu vhdx 231.53 GB
- **22:14** reset (sp35-m1) network-reset-20261002-141246-1 done, chain height 6, 82137 ms
- **22:14** preflight sp35-m1 green: host CPU 0.0 %, load1 3.36, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 4369.856719999}, no warnings
- **22:14** SP-3.5M ch4 m1: campaign campaign-20261002-141421-2 started (C: 29.0 GB free, Q: 435.1 GB free, docker vhdx 14.9 GB, ubuntu vhdx 231.53 GB)
- **22:34** m1 (`sp-3-5m-ch4-m1-20261002-141424-1`, campaign `campaign-20261002-141421-2`): warm-up post-run steps done 22:09 (export, csv 14.4 GB deleted, evidence committed and pushed, zstd deferred); wipe reset, compaction (380 → 13.6 GB vhdx, Q: 435.3 GB free, full 40 GB margin), fresh reset, preflight green (host CPU 0.0 %, 8h, no warnings). Generate 19.7 min; ballot window opened 22:34:48.
- **00:40 Q: estimate for SP-3.5M corrected (coordinator).** m1 took ~419 GB of Q: (435 → ~16 GB free during verify, still draining ~5 GB/h), above the 101 KB/record estimate. New rule: 120 KB/record + 10 GB margin = 432.9 GB per SP-3.5M run (backup `controller.before-q-estimate.py`). The user freed ~77 GB on Q: (93–94 GB free at 00:38), so after compaction Q: should be ~510 GB. Applied between runs: STOP file set at 00:39 so the controller holds after m1's post-run steps; then it is restarted on the new code and STOP removed (m1 itself is not disturbed; it is in verify).
- **01:20** SP-3.5M ch4 m1: campaign campaign-20261002-141421-2 done error=None run sp-3-5m-ch4-m1-20261002-141424-1 tps 567.176 p99 521.768 failed False  resumed False
- **01:20** sp35-m1: resources: ballot window: 2026-10-02 22:34:48 to 2026-10-03 00:18:26 | host CPU samples in window: 621, max 84.0 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 621 samples, max 30.3 %, over 25 % (contended): 1 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 502 %, peer0.org1.example.com 393 %, peer0.org2.example.com 166 %
- **01:20** export campaign-20261002-141421-2 -> http 200 rc 0
- **01:24** sp35-m1: ledger du: peer0.org1.example.com 41798752107 /var/hyperledger/production | peer0.org2.example.com 41797405324 /var/hyperledger/production | orderer.example.com 34082780983 /var/hyperledger/production/orderer | /dev/sdd       1081101176832 139855843328 886252978176  14% /var/hyperledger/production | 
- **01:24** deleted sp-3-5m-ch4-m1-20261002-141424-1/ballots.csv (14345410564 bytes)
- **01:20 m1 done:** `SP-3.5M ch4 m1` campaign `campaign-20261002-141421-2`, run `sp-3-5m-ch4-m1-20261002-141424-1`: 567.2 TPS, p99 521.8 ms, not failed, not resumed. Ballot window 22:34:48–00:18:26. Host CPU minus the WSL VM: 621 samples, max 30.3 %, 1 sample over 25 %. Export 200, csv (14.3 GB) deleted; zstd of m1 + the deferred warm-up ndjson running (between runs).
- **01:38 Rerun rule changed (coordinator).** Old rule: any host-only sample > 25 % in the ballot window → rerun once (~3.8 h at SP-3.5M). m1's single 10 s spike (1 of 621) cannot materially move a 1 h 44 m window's throughput. New rule (`contended()` in `controller.py`, selftest updated; backup `controller.before-rerun-rule.py`): rerun only if hot samples > 2 % of the window's samples AND ≥ 6 (≥ 1 minute of contention); otherwise the run stands, flagged "minor host spike, n of N samples". Applies to m1, m2, m3. The running controller still has the old rule in memory, but STOP (set 00:39) holds it before the next step, so no rerun campaign can start; at the hold the state is corrected (any `rerun_label`/`rerun_used` for sp35-m1 removed, m1 marked done) and the controller restarted on the new code, which also carries the 120 KB/record Q: estimate.
- **01:50** sp-3-5m-ch4-m1-20261002-141424-1: ndjson stored zstd-compressed (sha256 sidecars): 4a9f63c12c821bae20dd043da6788d3e7f557d0162a15cee1e57f55d725d1bb9 | ok /home/user/.saksi/campaign/runs/sp-3-5m-ch4-m1-20261002-141424-1/ledger/ballots.ndjson 13803813526 -> 6756392962 ratio 0.4895 sha256 5ddf3a9d0f3c5fef6340275868ffe8e05bcbdbc9e59f6da4b4e241133626546d | ok /home/user/.saksi/campaign/runs/sp-3-5m-ch4-warmup-20261002-100733-1/ballots.ndjson 13832006150 -> 6764946914 ratio 0.4891 sha256 271bad179024ea36605a6819f324f2bcbf4f5eb09c169f694a7dec7c2413cdb4 | ok /home/user/.saksi/campaign/runs/sp-3-5m-ch4-warmup-20261002-100733-1/ledger/ballots.ndjson 13832006150 -> 6757854740 ratio 0.4886 sha256 a0663625e33dbbe51e0e2c8c7aed002b52c61a4dcd51463ad04b1cc217a14cb5 | freed 28228926095 bytes
- **01:50** push docs/ch4-night1-2026-10-01 -> rc 0 
- **01:50** sp35-m1: 1 host CPU samples > 25 % in the ballot window: rerunning once as sp35-m1-rerun
- **01:50** STOP file present: holding before the next step
- **01:50** controller start (pid 11356)
- **01:50** C: check sp35-m2: run writes ~43.2 GB inside the Ubuntu disk (3524078 records); room 69.8 GB (C: above 15 GB + 55.9 GB ext4.vhdx slack); C: 28.9 GB free, Q: 98.2 GB free, docker vhdx 434.8 GB, ubuntu vhdx 231.53 GB
- **01:50** C: sp35-m2 keeps ~13.5 GB after csv deletion and zstd (ratio 0.4904)
- **01:50** Controller held at 01:50:12 (the old code had set `sp35-m1-rerun`); stopped, state corrected (backup `state.before-m1-stands.json`: rerun_label/rerun_used for sp35-m1 removed, sp35-m1 in done, m1 result flagged 'minor host spike, 1 of 621 samples'), STOP removed, controller restarted 01:50:52 (pid 11356) on the new code; next run sp35-m2 (wipe, compaction, Q: need 432.9 GB). m1 + warm-up ndjson compressed 01:24–01:50 (m1 ledger dump 13.80 → 6.76 GB, ratio 0.4895).
- **01:52** reset (pre-compaction wipe) network-reset-20261002-175059-3 done, chain height 6, 86110 ms
- **01:52** compaction task start (C: 28.9 GB free, Q: 98.2 GB free, docker vhdx 434.8 GB, ubuntu vhdx 231.53 GB)
- **01:53** compaction done: 2026-10-03T01:52:29 start; vhdx 405 GB; Q free 91.4 GB | 2026-10-03T01:52:59 done; vhdx 13.8 GB; Q free 482.6 GB | 2026-10-03T01:52:59 docker relaunched
- **01:53** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-0153.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **01:53** disk check: need 432.9 GB on Q: (records 3524078 x 120 KB + 10 GB); C: 28.9 GB free, Q: 518.2 GB free, docker vhdx 14.8 GB, ubuntu vhdx 231.53 GB
- **01:55** reset (sp35-m2) network-reset-20261002-175337-1 done, chain height 6, 81955 ms
- **01:55** preflight sp35-m2 green: host CPU 1.9 %, load1 2.87, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 4369.856719999}, no warnings
- **01:55** SP-3.5M ch4 m2: campaign campaign-20261002-175512-2 started (C: 28.9 GB free, Q: 517.9 GB free, docker vhdx 15.1 GB, ubuntu vhdx 231.53 GB)
- **02:16** controller start (pid 16672)
- **02:16** C: check sp35-m2: run writes ~43.2 GB inside the Ubuntu disk (3524078 records); room 44.1 GB (C: above 15 GB + 32.3 GB ext4.vhdx slack); C: 26.8 GB free, Q: 517.9 GB free, docker vhdx 15.0 GB, ubuntu vhdx 231.53 GB
- **02:16** C: sp35-m2 keeps ~13.5 GB after csv deletion and zstd (ratio 0.4904)
- **02:16** disk check: Q: 517.9 GB free >= need 432.9 GB and docker vhdx 15.0 GB: compaction not needed
- **02:17** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-0217.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **02:12 Power outage (third host power event; Week 2 #6 evidence).** Event 41 (Kernel-Power, rebooted without a clean shutdown) at 2026-10-03 02:12:17; Event 6008 says the unexpected shutdown was at 01:53:21 (inconsistent with the controller log, which runs to 01:56:12, so the 6008 time is unreliable); event log service restarted 02:12:32. The main session relaunched Docker Desktop and the Brave limiter.
  - Cut `SP-3.5M ch4 m2` attempt: campaign `campaign-20261002-175512-2`, run `sp-3-5m-ch4-m2-20261002-175515-1`, last journal event `stage.generate.start` 17:55:15Z: cut during generate, no ballots submitted, nothing on chain. Per the plan: **power cut during generate, discarded**; recorded under `abandoned` in `state.json` (backup `state.before-m2-powercut.json`), `current` cleared, `rerun_used` untouched (not a contention rerun). Its partial generate files stay in its run folder; its sampler file moved to `sp35-m2-abandoned-powercut/`.
  - Controller patched (backup `controller.before-skip-compact.py`): compaction is skipped when Q: already holds the need and the Docker VHDX is small (Q: 482.4 GB free ≥ 432.9 GB). Controller started ~02:20 for a fresh m2: bring-up (8h), wipe reset is in `do_run`'s fresh reset, preflight, `SP-3.5M ch4 m2`.
- **02:18** reset (sp35-m2) network-reset-20261002-181707-1 done, chain height 6, 85687 ms
- **02:18** preflight sp35-m2 green: host CPU 0.8 %, load1 3.64, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 4369.856719999}, no warnings
- **02:18** SP-3.5M ch4 m2: campaign campaign-20261002-181841-2 started (C: 26.8 GB free, Q: 517.9 GB free, docker vhdx 15.1 GB, ubuntu vhdx 231.53 GB)
- **02:39** Fresh m2 (`sp-3-5m-ch4-m2-20261002-181845-1`, campaign `campaign-20261002-181841-2`): reset 02:18, preflight green (host CPU 0.8 %, 8h, no warnings), no compaction needed (Q: 517.9 GB free after the reset). Generate 20.5 min; ballot window opened 02:39:55; first ~2.3 min ~929 ballots/s by the progress counter.
- **05:24** SP-3.5M ch4 m2: campaign campaign-20261002-181841-2 done error=None run sp-3-5m-ch4-m2-20261002-181845-1 tps 593.688 p99 486.087 failed False  resumed False
- **05:24** sp35-m2: resources: ballot window: 2026-10-03 02:39:55 to 2026-10-03 04:18:53 | host CPU samples in window: 593, max 85.3 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 593 samples, max 12.9 %, over 25 % (contended): 0 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 494 %, peer0.org1.example.com 421 %, peer0.org2.example.com 201 %
- **05:24** export campaign-20261002-181841-2 -> http 200 rc 0
- **05:31** sp35-m2: ledger du: peer0.org1.example.com 41813320324 /var/hyperledger/production | peer0.org2.example.com 41811049801 /var/hyperledger/production | orderer.example.com 34097231319 /var/hyperledger/production/orderer | /dev/sdd       1081101176832 140100042752 886008778752  14% /var/hyperledger/production | 
- **05:31** deleted sp-3-5m-ch4-m2-20261002-181845-1/ballots.csv (14345410564 bytes)
- **06:05** sp-3-5m-ch4-m2-20261002-181845-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/sp-3-5m-ch4-m2-20261002-181845-1/ballots.ndjson 13803813526 -> 6763427700 ratio 0.4900 sha256 29d0319e7d2515834376483f4fbb75a167c777e774f308f440dc73f9bb636744 | ok /home/user/.saksi/campaign/runs/sp-3-5m-ch4-m2-20261002-181845-1/ledger/ballots.ndjson 13803813526 -> 6756295447 ratio 0.4895 sha256 7e28c5ff10982c9f6d17e0020e501f1cc57ca73141a017ae4ed8d19bbd6213fc | freed 14087903905 bytes
- **06:05** push docs/ch4-night1-2026-10-01 -> rc 0 
- **06:05** STOPPED at sp35-m3: C: free 13.7 GB < 15 GB
- **07:55 main session:** controller STOPPED 06:05 at sp35-m3 (C: 13.7 GB < 15). Ubuntu vhdx 231.9 GB with 201 GB used inside; m3 peaks ~43 GB inside. Fix: archive the pre-SP-3.5M .zst files (48 GB) to Q: with zarchive.sh, fstrim, then compact BOTH the Docker and the Ubuntu VHDX via SaksiCompactDocker, then restart the controller at sp35-m3.
- **08:51 main session (user: defer m3, prepare a clean resume):** archived 48 GB of pre-SP-3.5M .zst to Q: (zarchive.sh, all sha-verified); fstrim Ubuntu; compacted the Ubuntu VHDX 231.9 -> 153.4 GB (C: 12.8 -> 91.2 GB); removed m2's Fabric containers and compose ledger volumes (~118 GB), fstrim docker-desktop disk, compacted Docker VHDX 372.7 -> 13.9 GB (Q: 434.7 GB). Controller held by STOP; next queue item sp35-m3 on a fresh network.
- **11:45 main session:** power cut at 11:15 (Event 41, nothing running). Pre-resume checks: Q: 443.5 GB (need 432.9), C: 92.0 GB, docker vhdx 13.9 GB, ubuntu vhdx 153.5 GB, build 4a38a54, no Fabric containers or ledger volumes left. STOP removed; controller restarted for sp35-m3 (user: resume).
- **11:45** controller start (pid 3868)
- **11:45** C: check sp35-m3: run writes ~43.2 GB inside the Ubuntu disk (3524078 records); room 85.0 GB (C: above 15 GB + 1.3 GB ext4.vhdx slack); C: 98.8 GB free, Q: 476.2 GB free, docker vhdx 14.9 GB, ubuntu vhdx 164.77 GB
- **11:45** C: sp35-m3 keeps ~13.5 GB after csv deletion and zstd (ratio 0.4904)
- **11:45** disk check: Q: 476.2 GB free >= need 432.9 GB and docker vhdx 14.9 GB: compaction not needed
- **11:55** bringup5 (PT=8h) rc 0: er: could not create channel group: could not create orderer group: cannot marshal metadata for orderer type etcdraft: cannot load client cert for consenter orderer.example.com:7050: open /home/user/Code/fabric-samples/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt: no such file or directory
+ res=1
[0;31mFailed to generate channel configuration transaction...[0m

  [31m✗ network bring-up failed. Try: ./tools/up.sh down, then retry.[0m
- **11:57 main session:** 11:55 bring-up failed (configtxgen: cannot load client cert for consenter). Cause: root-owned ordererOrganizations left half-removed by the 08:43 up.sh down while Docker was not ready. Removed stale crypto material as root, then a clean up.sh down (0 Fabric containers, 0 compose volumes). Restarting the controller for sp35-m3.
- **11:57** controller start (pid 14580)
- **11:57** C: check sp35-m3: run writes ~43.2 GB inside the Ubuntu disk (3524078 records); room 85.0 GB (C: above 15 GB + 1.3 GB ext4.vhdx slack); C: 98.8 GB free, Q: 476.2 GB free, docker vhdx 14.9 GB, ubuntu vhdx 164.77 GB
- **11:57** C: sp35-m3 keeps ~13.5 GB after csv deletion and zstd (ratio 0.4904)
- **11:57** disk check: Q: 476.2 GB free >= need 432.9 GB and docker vhdx 14.9 GB: compaction not needed
- **11:58** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-1157.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **12:00** reset (sp35-m3) network-reset-20261003-035832-1 done, chain height 6, 84016 ms
- **12:00** preflight sp35-m3 green: host CPU 2.0 %, load1 3.07, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 4369.856719999}, no warnings
- **12:00** SP-3.5M ch4 m3: campaign campaign-20261003-040006-2 started (C: 98.7 GB free, Q: 475.9 GB free, docker vhdx 15.3 GB, ubuntu vhdx 164.80 GB)
- **15:07** SP-3.5M ch4 m3: campaign campaign-20261003-040006-2 done error=None run sp-3-5m-ch4-m3-20261003-040010-1 tps 586.447 p99 486.86 failed False  resumed False
- **15:07** sp35-m3: resources: ballot window: 2026-10-03 12:17:41 to 2026-10-03 13:57:51 | host CPU samples in window: 600, max 81.3 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 600 samples, max 22.6 %, over 25 % (contended): 0 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 484 %, peer0.org1.example.com 394 %, peer0.org2.example.com 164 %
- **15:07** export campaign-20261003-040006-2 -> http 200 rc 0
- **15:11** sp35-m3: ledger du: peer0.org1.example.com 41811890212 /var/hyperledger/production | peer0.org2.example.com 41811376517 /var/hyperledger/production | orderer.example.com 34096955505 /var/hyperledger/production/orderer | /dev/sde       1081101176832 140232765440 885876056064  14% /var/hyperledger/production | 
- **15:11** deleted sp-3-5m-ch4-m3-20261003-040010-1/ballots.csv (14345410564 bytes)
- **15:24** sp-3-5m-ch4-m3-20261003-040010-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/sp-3-5m-ch4-m3-20261003-040010-1/ballots.ndjson 13803813526 -> 6763428919 ratio 0.4900 sha256 49b89e62af653bd4a7fc98b432f967bad298d33320c20dea3e4d3fe1e695ca02 | ok /home/user/.saksi/campaign/runs/sp-3-5m-ch4-m3-20261003-040010-1/ledger/ballots.ndjson 13803813526 -> 6756331133 ratio 0.4895 sha256 89c42fd3f523a0840c9dee2ddd99a47fb6582a0a9d797b6d5137fe8aa1c8ddd5 | freed 14087867000 bytes
- **15:24** push docs/ch4-night1-2026-10-01 -> rc 0 
- **15:26** reset (post-capstone wipe) network-reset-20261003-072442-3 done, chain height 6, 90571 ms
- **15:26** compaction task start (C: 49.5 GB free, Q: 114.8 GB free, docker vhdx 376.3 GB, ubuntu vhdx 212.98 GB)
- **15:27** compaction done: 2026-10-03T15:26:43 start; vhdx 350.4 GB; Q free 107 GB | 2026-10-03T15:27:09 done; vhdx 14.1 GB; Q free 443.3 GB | 2026-10-03T15:27:09 docker relaunched
- **15:37** bringup5 (PT=8h) rc 0: s=1
+ peer channel join -b ./channel-artifacts/saksi.block
+ res=1
[34m2026-10-03 15:27:59.761 PST 0001 INFO[0m [channelCmd] [34;1mInitCmdFactory[0m -> Endorser and orderer connections initialized
Error: proposal failed (err: bad proposal response 500: cannot create ledger from genesis block: ledger [saksi] already exists with state [ACTIVE])
[0;31mAfter 5 attempts, peer0.org1 has failed to join channel 'saksi' [0m

  [31m✗ network bring-up failed. Try: ./tools/up.sh down, then retry.[0m
- **15:47** CRASH #1 during archive: console not reachable after bringup
- **15:47** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-1547.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **15:49** reset (post-capstone wipe) network-reset-20261003-074752-1 done, chain height 6, 83935 ms
- **15:49** compaction task start (C: 49.5 GB free, Q: 475.7 GB free, docker vhdx 15.4 GB, ubuntu vhdx 212.98 GB)
- **15:49** compaction done: 2026-10-03T15:49:23 start; vhdx 14.3 GB; Q free 443 GB | 2026-10-03T15:49:46 done; vhdx 14.2 GB; Q free 443.2 GB | 2026-10-03T15:49:46 docker relaunched
- **16:00** bringup5 (PT=8h) rc 0: s=1
+ peer channel join -b ./channel-artifacts/saksi.block
+ res=1
[34m2026-10-03 15:50:33.074 PST 0001 INFO[0m [channelCmd] [34;1mInitCmdFactory[0m -> Endorser and orderer connections initialized
Error: proposal failed (err: bad proposal response 500: cannot create ledger from genesis block: ledger [saksi] already exists with state [ACTIVE])
[0;31mAfter 5 attempts, peer0.org1 has failed to join channel 'saksi' [0m

  [31m✗ network bring-up failed. Try: ./tools/up.sh down, then retry.[0m
- **16:10** CRASH #2 during archive: console not reachable after bringup
- **16:10** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-1610.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **16:11** reset (post-capstone wipe) network-reset-20261003-081024-1 done, chain height 6, 83791 ms
- **16:11** compaction task start (C: 49.4 GB free, Q: 475.6 GB free, docker vhdx 15.5 GB, ubuntu vhdx 212.98 GB)
- **16:12** compaction done: 2026-10-03T16:11:55 start; vhdx 14.5 GB; Q free 442.9 GB | 2026-10-03T16:12:18 done; vhdx 14.2 GB; Q free 443.2 GB | 2026-10-03T16:12:18 docker relaunched
- **16:22** bringup5 (PT=8h) rc 0: s=1
+ peer channel join -b ./channel-artifacts/saksi.block
+ res=1
[34m2026-10-03 16:13:06.447 PST 0001 INFO[0m [channelCmd] [34;1mInitCmdFactory[0m -> Endorser and orderer connections initialized
Error: proposal failed (err: bad proposal response 500: cannot create ledger from genesis block: ledger [saksi] already exists with state [ACTIVE])
[0;31mAfter 5 attempts, peer0.org1 has failed to join channel 'saksi' [0m

  [31m✗ network bring-up failed. Try: ./tools/up.sh down, then retry.[0m
- **16:32** CRASH #3 during archive: console not reachable after bringup
- **16:32** third crash: stopping the campaign
- **17:37 main session:** the archive step failed 3x (15:37-16:32), not a hardware crash: after the post-capstone wipe and compaction, bringup() restarted the old peers and up.sh then tried to create channel saksi on top of the existing ledger ('ledger [saksi] already exists'). Fixed by a clean up.sh down plus removal of stale crypto, the archive run by hand (zarchive.sh, all runs), and state set to archive done, crashes 0. STOP held until the archive finishes; then the controller restarts for the offline tiers on a freshly built network.
- **17:53** controller start (pid 17456)
- **17:53** C: check off-mp-483k: run writes ~12.1 GB inside the Ubuntu disk (1449000 records); room 122.3 GB (C: above 15 GB + 88.0 GB ext4.vhdx slack); C: 49.3 GB free, Q: 421.7 GB free, docker vhdx 15.3 GB, ubuntu vhdx 212.98 GB
- **17:53** C: off-mp-483k keeps ~2.8 GB after csv deletion and zstd (ratio 0.4904)
- **17:54** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-1753.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **17:54** preflight off-mp-483k green: host CPU 3.0 %, load1 2.2, phase_timeout {'seconds': 28800, 'longest_phase': 'generate', 'estimated_s': 260.82}, no warnings
- **17:54** MP-483K ch4 offline: campaign campaign-20261003-095455-1 started (C: 49.3 GB free, Q: 421.4 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB)
- **18:07** MP-483K ch4 offline: campaign campaign-20261003-095455-1 done error=None run mp-483k-ch4-offline-20261003-095458-1 tps None p99 None failed False  resumed False
- **18:07** off-mp-483k: resources: ballot window: 2026-10-03 17:54:58 to 2026-10-03 18:06:49 | host CPU samples in window: 62, max 94.8 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 62 samples, max 14.5 %, over 25 % (contended): 0 | top container CPU peaks in window: peer0.org1.example.com 2 %, peer0.org2.example.com 2 %, orderer.example.com 1 %
- **18:07** export campaign-20261003-095455-1 -> http 200 rc 0
- **18:07** off-mp-483k: ledger du: offline run: no ledger
- **18:07** deleted mp-483k-ch4-offline-20261003-095458-1/ballots.csv (5915156026 bytes)
- **18:08** mp-483k-ch4-offline-20261003-095458-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-483k-ch4-offline-20261003-095458-1/ballots.ndjson 5693121000 -> 2681094067 ratio 0.4709 sha256 265edbbbbe3f34089ad5c07e0ec0f0d435bd2d034e9d7152f3541cad04f84aba | skip (absent) /home/user/.saksi/campaign/runs/mp-483k-ch4-offline-20261003-095458-1/ledger/ballots.ndjson | freed 3012026933 bytes
- **18:09** archive to Q:\thesis-archive\runs (mp-483k-ch4-offline-20261003-095458-1): 1 files, archived 2681094067 bytes, failures none rc 0 ; C: 49.3 GB free, Q: 418.8 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **18:09** push docs/ch4-night1-2026-10-01 -> rc 0 
- **18:09** STOP file present: holding before the next step
- **18:11** STOP file removed: continuing
- **18:11** C: check off-mp-1m: run writes ~25.0 GB inside the Ubuntu disk (3000000 records); room 122.2 GB (C: above 15 GB + 87.9 GB ext4.vhdx slack); C: 49.3 GB free, Q: 418.8 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **18:11** C: off-mp-1m keeps ~5.8 GB after csv deletion and zstd (ratio 0.4904)
- **18:11** preflight off-mp-1m green: host CPU 2.9 %, load1 0.21, phase_timeout {'seconds': 28800, 'longest_phase': 'generate', 'estimated_s': 540}, no warnings
- **18:11** MP-1M ch4 offline: campaign campaign-20261003-101155-2 started (C: 49.3 GB free, Q: 418.8 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB)
- **18:38** MP-1M ch4 offline: campaign campaign-20261003-101155-2 done error=None run mp-1m-ch4-offline-20261003-101159-2 tps None p99 None failed False  resumed False
- **18:38** off-mp-1m: resources: ballot window: 2026-10-03 18:11:59 to 2026-10-03 18:38:19 | host CPU samples in window: 0, max nan % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 0 samples, max nan %, over 25 % (contended): 0 | top container CPU peaks in window: peer0.org1.example.com 3 %, peer0.org2.example.com 2 %, orderer.example.com 0 %
- **18:38** export campaign-20261003-101155-2 -> http 200 rc 0
- **18:38** off-mp-1m: ledger du: offline run: no ledger
- **18:38** deleted mp-1m-ch4-offline-20261003-101159-2/ballots.csv (12235889026 bytes)
- **18:41** mp-1m-ch4-offline-20261003-101159-2: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-1m-ch4-offline-20261003-101159-2/ballots.ndjson 11775000000 -> 5550676398 ratio 0.4714 sha256 71e09a2aec3a7441f0b9b80deba23ebcadc46a726fa72319756845dfab2992ee | skip (absent) /home/user/.saksi/campaign/runs/mp-1m-ch4-offline-20261003-101159-2/ledger/ballots.ndjson | freed 6224323602 bytes
- **18:43** archive to Q:\thesis-archive\runs (mp-1m-ch4-offline-20261003-101159-2): 1 files, archived 5550676398 bytes, failures none rc 0 ; C: 49.3 GB free, Q: 413.2 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **18:43** push docs/ch4-night1-2026-10-01 -> rc 0 
- **18:43** STOP file present: holding before the next step
- **22:03** controller start (pid 15892)
- **22:03** C: check off-mp-1.92m: run writes ~48.1 GB inside the Ubuntu disk (5765751 records); room 121.1 GB (C: above 15 GB + 87.8 GB ext4.vhdx slack); C: 48.3 GB free, Q: 413.2 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **22:03** C: off-mp-1.92m keeps ~11.1 GB after csv deletion and zstd (ratio 0.4904)
- **22:03** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-2203.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **22:03** preflight off-mp-1.92m green: host CPU 3.7 %, load1 0.48, phase_timeout {'seconds': 28800, 'longest_phase': 'generate', 'estimated_s': 1037.835179999}, no warnings
- **22:03** MP-1.92M ch4 offline: campaign campaign-20261003-140351-1 started (C: 48.3 GB free, Q: 413.2 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB)
- **22:56** MP-1.92M ch4 offline: campaign campaign-20261003-140351-1 done error=None run mp-1-92m-ch4-offline-20261003-140355-1 tps None p99 None failed False  resumed False
- **22:56** off-mp-1.92m: resources: ballot window: 2026-10-03 22:03:55 to 2026-10-03 22:55:36 | host CPU samples in window: 0, max nan % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 0 samples, max nan %, over 25 % (contended): 0 | top container CPU peaks in window: peer0.org2.example.com 4 %, peer0.org1.example.com 2 %, orderer.example.com 1 %
- **22:56** export campaign-20261003-140351-1 -> http 200 rc 0
- **22:56** off-mp-1.92m: ledger du: offline run: no ledger
- **22:56** deleted mp-1-92m-ch4-offline-20261003-140355-1/ballots.csv (23551981861 bytes)
- **23:05** mp-1-92m-ch4-offline-20261003-140355-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-1-92m-ch4-offline-20261003-140355-1/ballots.ndjson 22665167181 -> 10668726297 ratio 0.4707 sha256 3b7185c2ca6882e68e6851d60730fb4c1a5f099cae8ed7dbb5854702e285a25b | skip (absent) /home/user/.saksi/campaign/runs/mp-1-92m-ch4-offline-20261003-140355-1/ledger/ballots.ndjson | freed 11996440884 bytes
- **23:08** archive to Q:\thesis-archive\runs (mp-1-92m-ch4-offline-20261003-140355-1): 1 files, archived 10668726297 bytes, failures none rc 0 ; C: 48.1 GB free, Q: 402.6 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **23:08** push docs/ch4-night1-2026-10-01 -> rc 0 
- **23:08** C: check off-mp-3.5m: run writes ~88.2 GB inside the Ubuntu disk (10572234 records); room 120.7 GB (C: above 15 GB + 87.6 GB ext4.vhdx slack); C: 48.1 GB free, Q: 402.6 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **23:08** C: off-mp-3.5m keeps ~20.3 GB after csv deletion and zstd (ratio 0.4904)
- **23:09** preflight off-mp-3.5m green: host CPU 12.7 %, load1 1, phase_timeout {'seconds': 28800, 'longest_phase': 'generate', 'estimated_s': 1903.00212}, no warnings
- **23:09** MP-3.5M ch4 offline: campaign campaign-20261003-150905-2 started (C: 48.1 GB free, Q: 402.6 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB)
- **00:46** MP-3.5M ch4 offline: campaign campaign-20261003-150905-2 done error=None run mp-3-5m-ch4-offline-20261003-150909-2 tps None p99 None failed False  resumed False
- **00:46** off-mp-3.5m: resources: ballot window: 2026-10-03 23:09:10 to 2026-10-04 00:46:48 | host CPU samples in window: 563, max 97.3 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 563 samples, max 32.4 %, over 25 % (contended): 1 | top container CPU peaks in window: peer0.org1.example.com 49 %, orderer.example.com 6 %, peer0.org2.example.com 4 %
- **00:46** export campaign-20261003-150905-2 -> http 200 rc 0
- **00:46** off-mp-3.5m: ledger du: offline run: no ledger
- **00:47** deleted mp-3-5m-ch4-offline-20261003-150909-2/ballots.csv (43165892682 bytes)

## AX42 (Hetzner), 2026-10-04 →

- **10-04 00:58** controller start (pid 26523)
- **10-04 00:58** validation ladder job ladder-20261003-165827-1 started
- **10-04 00:58** ladder ladder-20261003-165827-1 done : {"commit": "4a38a54fe0223b58f28c53ec54e47fbeab222837", "ran_at": "2026-10-03T16:58:36.613851899Z", "runs": ["validation-ladder-20261003-165827-1", "validation-ladder-20261003-165829-2", "validation-ladder-20261003-165831-3", "validation-ladder-20261003-165833-4"]}
- **10-04 00:58** disk check mp1k: 3,000 records x 12 run(s) x 45 KB x 1.15 + 20 GB = 21.9 GB needed; / (md2) 936.2 GB free of 996 GB
- **10-04 01:00** reset (mp1k) network-reset-20261003-165857-2 done, chain height 6, 64396 ms
- **10-04 01:00** preflight mp1k green: host CPU 0.5 % (/proc/stat, 5 s), load1 2.16, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 3.7199999999999998}, no warnings
- **10-04 01:00** MP-1K ch4 ax42: campaign campaign-20261003-170017-3 started (2 + 10; / (md2) 936.1 GB free of 996 GB)
- **01:04** mp-3-5m-ch4-offline-20261003-150909-2: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-3-5m-ch4-offline-20261003-150909-2/ballots.ndjson 41538307386 -> 19561974141 ratio 0.4709 sha256 1b8e5b0a377b554ea9b2e501d3b616e1463f30f0f311f5a79afd2a03d5ade814 | skip (absent) /home/user/.saksi/campaign/runs/mp-3-5m-ch4-offline-20261003-150909-2/ledger/ballots.ndjson | freed 21976333245 bytes
- **01:10** archive to Q:\thesis-archive\runs (mp-3-5m-ch4-offline-20261003-150909-2): 1 files, archived 19561974141 bytes, failures none rc 0 ; C: 48.3 GB free, Q: 383.0 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **01:10** push docs/ch4-night1-2026-10-01 -> rc 0 
- **01:10** off-mp-3.5m: minor host spike, 1 of 563 samples > 25 % (host minus WSL VM); below the rerun rule (> 2 % and >= 6); the run stands
- **01:10** capstone 2 queue complete: [{"label": "sp35-warmup", "run": "sp-3-5m-ch4-warmup-20261002-100733-1", "tps": 515.733, "p99": 514.138, "hot_samples": 0, "resumed": false}, {"label": "sp35-m1", "run": "sp-3-5m-ch4-m1-20261002-141424-1", "tps": 567.176, "p99": 521.768, "hot_samples": 1, "resumed": false}, {"label": "sp35-m2", "run": "sp-3-5m-ch4-m2-20261002-181845-1", "tps": 593.688, "p99": 486.087, "hot_samples": 0, "resumed": false}, {"label": "sp35-m3", "run": "sp-3-5m-ch4-m3-20261003-040010-1", "tps": 586.447, "p99": 486.86, "hot_samples": 0, "resumed": false}, {"label": "off-mp-483k", "run": "mp-483k-ch4-offline-20261003-095458-1", "tps": null, "p99": null, "hot_samples": 0, "resumed": false}, {"label": "off-mp-1m", "run": "mp-1m-ch4-offline-20261003-101159-2", "tps": null, "p99": null, "hot_samples": 0, "resumed": false}, {"label": "off-mp-1.92m", "run": "mp-1-92m-ch4-offline-20261003-140355-1", "tps": null, "p99": null, "hot_samples": 0, "resumed": false}, {"label": "off-mp-3.5m", "run": "mp-3-5m-ch4-offline-20261003-150909-2", "tps": null, "p99": null, "hot_samples": 1, "resumed": false}]
- **10-04 01:01** mp1k: mp-1k-ch4-ax42-20261003-170017-5 ballot window open since 2026-10-04 01:00:22; first throughput 3000 records in 3532 ms -> ~849 records/s
- **10-04 01:01** controller start (pid 40923)
- **10-04 01:01** recovering mp1k (campaign campaign-20261003-170017-3, runs ['mp-1k-ch4-ax42-20261003-170017-5', 'mp-1k-ch4-ax42-20261003-170041-6', 'mp-1k-ch4-ax42-20261003-170105-7'])
- **10-04 01:02** mp1k: mp-1k-ch4-ax42-20261003-170017-5 ballot window open since 2026-10-04 01:00:22; first throughput 3000 records in 3532 ms -> ~849 records/s
- **10-04 01:05** MP-1K ch4 ax42: campaign campaign-20261003-170017-3 done error=None runs 12 resumed False: warmup mp-1k-ch4-ax42-20261003-170017-5 tps 829.902 p99 198.968 failed False ; warmup mp-1k-ch4-ax42-20261003-170041-6 tps 841.349 p99 194.282 failed False ; measured mp-1k-ch4-ax42-20261003-170105-7 tps 831.033 p99 208.014 failed False ; measured mp-1k-ch4-ax42-20261003-170129-8 tps 830.074 p99 189.245 failed False ; measured mp-1k-ch4-ax42-20261003-170153-9 tps 814.558 p99 218.574 failed False ; measured mp-1k-ch4-ax42-20261003-170217-10 tps 835.495 p99 226.361 failed False ; measured mp-1k-ch4-ax42-20261003-170241-11 tps 833.213 p99 199.068 failed False ; measured mp-1k-ch4-ax42-20261003-170305-12 tps 827.354 p99 208.567 failed False ; measured mp-1k-ch4-ax42-20261003-170329-13 tps 832.09 p99 197.62 failed False ; measured mp-1k-ch4-ax42-20261003-170353-14 tps 825.849 p99 218.183 failed False ; measured mp-1k-ch4-ax42-20261003-170417-15 tps 830.753 p99 193.332 failed False ; measured mp-1k-ch4-ax42-20261003-170441-16 tps 820.477 p99 221.614 failed False 
- **10-04 01:05** mp1k: resources: ballot window(s): 2026-10-04 01:00:22 to 2026-10-04 01:00:26; 2026-10-04 01:00:46 to 2026-10-04 01:00:49; 2026-10-04 01:01:10 to 2026-10-04 01:01:14; 2026-10-04 01:01:34 to 2026-10-04 01:01:38; 2026-10-04 01:01:58 to 2026-10-04 01:02:02; 2026-10-04 01:02:22 to 2026-10-04 01:02:26; 2026-10-04 01:02:46 to 2026-10-04 01:02:50; 2026-10-04 01:03:10 to 2026-10-04 01:03:14; 2026-10-04 01:03:34 to 2026-10-04 01:03:38; 2026-10-04 01:03:59 to 2026-10-04 01:04:02; 2026-10-04 01:04:23 to 2026-10-04 01:04:26; 2026-10-04 01:04:47 to 2026-10-04 01:04:50 | host CPU (/proc/stat) samples in window: 5, mean 24.3 %, max 28.4 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 5 samples, max 0.3 %, over 25 % (contended): 0 | load1 in window: mean 2.97, max 3.58 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 361 %, peer0.org1.example.com 193 %, peer0.org2.example.com 60 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 01:05** export campaign-20261003-170017-3 -> 200 (158387 bytes)
- **10-04 01:05** mp1k: ledger du: peer0.org1.example.com 435404774 /var/hyperledger/production | peer0.org2.example.com 435404789 /var/hyperledger/production | orderer.example.com 791886419 /var/hyperledger/production/orderer | volume compose_orderer.example.com 791837267 | volume compose_peer0.org1.example.com 435310566 | volume compose_peer0.org2.example.com 435310581 | docker-root 2546135593	/var/lib/docker | /dev/md2       995623145472 10906165248 934066671616   2% / | 
- **10-04 01:05** mp1k: ndjson stored zstd-compressed (sha256 sidecars): allots.ndjson 11763000 -> 5706423 ratio 0.4851 sha256 1aa79090d313570d762be86fe09066ecb24a8315c4f35a1471ae31894123e8d8 | ok /root/.saksi/campaign/runs/mp-1k-ch4-ax42-20261003-170417-15/ballots.ndjson 11763000 -> 5544713 ratio 0.4714 sha256 291fc510ed161956900dce8a1d153a8d9dcf177123a49880b40dd8cef8376d65 | ok /root/.saksi/campaign/runs/mp-1k-ch4-ax42-20261003-170417-15/ledger/ballots.ndjson 11763000 -> 5706643 ratio 0.4851 sha256 8c984df5483afb67ade81831fcc4aef4862cee1103a1d3882c41b4d560ba90da | ok /root/.saksi/campaign/runs/mp-1k-ch4-ax42-20261003-170441-16/ballots.ndjson 11763000 -> 5544795 ratio 0.4714 sha256 a15a9cc500abf76089d1c915badd3bf6aa94490a18557ce694d3645129db693f | ok /root/.saksi/campaign/runs/mp-1k-ch4-ax42-20261003-170441-16/ledger/ballots.ndjson 11763000 -> 5706950 ratio 0.4852 sha256 36d6b94f719d936e458b4d6760c9819df40ee24bb39f2092ee634c79572bb3d2 | freed 147218857 bytes
- **10-04 01:05** MP-1K tier summary: Measured committed_tps: median 830.4, mean 828.1, min 814.6, max 835.5 (n = 10). p99 ms: median 208.3, max 226.4.
- **10-04 01:05** mp1k: evidence ready in /root/ax42/outbox/01-mp1k for the desktop pull
- **10-04 01:05** disk check mp10k: 30,000 records x 12 run(s) x 45 KB x 1.15 + 20 GB = 38.6 GB needed; / (md2) 934.4 GB free of 996 GB
- **10-04 01:07** reset (mp10k) network-reset-20261003-170558-4 done, chain height 6, 62764 ms
- **10-04 01:07** preflight mp10k green: host CPU 0.4 % (/proc/stat, 5 s), load1 1.99, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 37.2}, no warnings
- **10-04 01:07** MP-10K ch4 ax42: campaign campaign-20261003-170718-5 started (2 + 10; / (md2) 935.9 GB free of 996 GB)
- **10-04 01:08** mp10k: mp-10k-ch4-ax42-20261003-170718-17 ballot window open since 2026-10-04 01:07:29; first throughput 30000 records in 35699 ms -> ~840 records/s
- **10-04 01:24** MP-10K ch4 ax42: campaign campaign-20261003-170718-5 done error=None runs 12 resumed False: warmup mp-10k-ch4-ax42-20261003-170718-17 tps 838.449 p99 213.233 failed False ; warmup mp-10k-ch4-ax42-20261003-170840-18 tps 835.351 p99 214.056 failed False ; measured mp-10k-ch4-ax42-20261003-171002-19 tps 836.423 p99 206.019 failed False ; measured mp-10k-ch4-ax42-20261003-171124-20 tps 838.217 p99 207.466 failed False ; measured mp-10k-ch4-ax42-20261003-171246-21 tps 839.374 p99 210.811 failed False ; measured mp-10k-ch4-ax42-20261003-171408-22 tps 834.102 p99 210.754 failed False ; measured mp-10k-ch4-ax42-20261003-171529-23 tps 835.78 p99 210.65 failed False ; measured mp-10k-ch4-ax42-20261003-171651-24 tps 835.372 p99 207.758 failed False ; measured mp-10k-ch4-ax42-20261003-171812-25 tps 836.057 p99 209.077 failed False ; measured mp-10k-ch4-ax42-20261003-171934-26 tps 831.69 p99 213.668 failed False ; measured mp-10k-ch4-ax42-20261003-172056-27 tps 830.766 p99 205.528 failed False ; measured mp-10k-ch4-ax42-20261003-172217-28 tps 784.523 p99 254.759 failed False 
- **10-04 01:24** mp10k: resources: ballot window(s): 2026-10-04 01:07:29 to 2026-10-04 01:08:05; 2026-10-04 01:08:51 to 2026-10-04 01:09:27; 2026-10-04 01:10:13 to 2026-10-04 01:10:49; 2026-10-04 01:11:35 to 2026-10-04 01:12:11; 2026-10-04 01:12:57 to 2026-10-04 01:13:33; 2026-10-04 01:14:19 to 2026-10-04 01:14:55; 2026-10-04 01:15:41 to 2026-10-04 01:16:16; 2026-10-04 01:17:02 to 2026-10-04 01:17:38; 2026-10-04 01:18:24 to 2026-10-04 01:19:00; 2026-10-04 01:19:45 to 2026-10-04 01:20:21; 2026-10-04 01:21:07 to 2026-10-04 01:21:43; 2026-10-04 01:22:29 to 2026-10-04 01:23:07 | host CPU (/proc/stat) samples in window: 45, mean 42.1 %, max 50.6 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 45 samples, max 0.7 %, over 25 % (contended): 0 | load1 in window: mean 9.01, max 15.42 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 383 %, peer0.org1.example.com 225 %, peer0.org2.example.com 89 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 01:24** export campaign-20261003-170718-5 -> 200 (172728 bytes)
- **10-04 01:24** mp10k: ledger du: peer0.org1.example.com 4281907969 /var/hyperledger/production | peer0.org2.example.com 4282172623 /var/hyperledger/production | orderer.example.com 4493069369 /var/hyperledger/production/orderer | volume compose_orderer.example.com 4493020217 | volume compose_peer0.org1.example.com 4281801473 | volume compose_peer0.org2.example.com 4282066127 | docker-root 14758072679	/var/lib/docker | /dev/md2       995623145472 27408171008 917564665856   3% / | 
- **10-04 01:24** mp10k: ndjson stored zstd-compressed (sha256 sidecars): 17690000 -> 57531866 ratio 0.4888 sha256 e8a9322d6b677030802f18bd6028ded9e009f912a2d92c722bc0c40d1a5ed4e2 | ok /root/.saksi/campaign/runs/mp-10k-ch4-ax42-20261003-172056-27/ballots.ndjson 117690000 -> 55499117 ratio 0.4716 sha256 3db69b9b62bac53277f33bf954946cb1fd4ee979ae20e539e92557c57af3d7d9 | ok /root/.saksi/campaign/runs/mp-10k-ch4-ax42-20261003-172056-27/ledger/ballots.ndjson 117690000 -> 57529438 ratio 0.4888 sha256 68923f1272cf84a26e400bae621dac176932d0313cf85ce0fe3692273d5ceab9 | ok /root/.saksi/campaign/runs/mp-10k-ch4-ax42-20261003-172217-28/ballots.ndjson 117690000 -> 55500351 ratio 0.4716 sha256 60cb9b9f2fb602d897f20a5709ec83d8fe6984744d2c6b90432456cafbb8453b | ok /root/.saksi/campaign/runs/mp-10k-ch4-ax42-20261003-172217-28/ledger/ballots.ndjson 117690000 -> 57532256 ratio 0.4888 sha256 0d6ec1edd2ac80769c40def4e592a166803d4faa5c62c554f355580be04c6788 | freed 1468194582 bytes
- **10-04 01:24** MP-10K tier summary: Measured committed_tps: median 835.6, mean 830.2, min 784.5, max 839.4 (n = 10). p99 ms: median 209.9, max 254.8.
- **10-04 01:24** mp10k: evidence ready in /root/ax42/outbox/02-mp10k for the desktop pull
- **10-04 01:24** disk check mp50k: 150,000 records x 7 run(s) x 45 KB x 1.15 + 20 GB = 74.3 GB needed; / (md2) 920.5 GB free of 996 GB
- **10-04 01:26** reset (mp50k) network-reset-20261003-172449-6 done, chain height 6, 64706 ms
- **10-04 01:26** preflight mp50k green: host CPU 0.4 % (/proc/stat, 5 s), load1 2.37, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 186}, no warnings
- **10-04 01:26** MP-50K ch4 ax42: campaign campaign-20261003-172609-7 started (2 + 5; / (md2) 934.3 GB free of 996 GB)
- **10-04 01:28** mp50k: mp-50k-ch4-ax42-20261003-172609-29 ballot window open since 2026-10-04 01:26:48; first throughput 68000 records in 81532 ms -> ~834 records/s
- **10-04 02:06** MP-50K ch4 ax42: campaign campaign-20261003-172609-7 done error=None runs 7 resumed False: warmup mp-50k-ch4-ax42-20261003-172609-29 tps 823.973 p99 233.433 failed False ; warmup mp-50k-ch4-ax42-20261003-173147-30 tps 807.595 p99 242.455 failed False ; measured mp-50k-ch4-ax42-20261003-173729-31 tps 822.09 p99 217.455 failed False ; measured mp-50k-ch4-ax42-20261003-174311-32 tps 820.678 p99 211.402 failed False ; measured mp-50k-ch4-ax42-20261003-174852-33 tps 819.753 p99 212.114 failed False ; measured mp-50k-ch4-ax42-20261003-175434-34 tps 820.427 p99 211.932 failed False ; measured mp-50k-ch4-ax42-20261003-180015-35 tps 820.003 p99 215.192 failed False 
- **10-04 02:06** mp50k: resources: ballot window(s): 2026-10-04 01:26:48 to 2026-10-04 01:29:50; 2026-10-04 01:32:25 to 2026-10-04 01:35:31; 2026-10-04 01:38:09 to 2026-10-04 01:41:12; 2026-10-04 01:43:50 to 2026-10-04 01:46:53; 2026-10-04 01:49:32 to 2026-10-04 01:52:35; 2026-10-04 01:55:14 to 2026-10-04 01:58:17; 2026-10-04 02:00:55 to 2026-10-04 02:03:58 | host CPU (/proc/stat) samples in window: 130, mean 44.7 %, max 48.7 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 130 samples, max 0.8 %, over 25 % (contended): 0 | load1 in window: mean 12.94, max 19.82 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 387 %, peer0.org1.example.com 256 %, peer0.org2.example.com 104 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 02:06** export campaign-20261003-172609-7 -> 200 (133596 bytes)
- **10-04 02:06** mp50k: ledger du: peer0.org1.example.com 12480862968 /var/hyperledger/production | peer0.org2.example.com 12480324657 /var/hyperledger/production | orderer.example.com 11061193155 /var/hyperledger/production/orderer | volume compose_orderer.example.com 11061144003 | volume compose_peer0.org1.example.com 12480735992 | volume compose_peer0.org2.example.com 12480197681 | docker-root 39465928034	/var/lib/docker | /dev/md2       995623145472 62415503360 882557333504   7% / | 
- **10-04 02:07** mp50k: ndjson stored zstd-compressed (sha256 sidecars): 000 -> 287825893 ratio 0.4891 sha256 ea97eddf3a420fca64cbbe70187af0aee269fec925b612fc05093c82be426054 | ok /root/.saksi/campaign/runs/mp-50k-ch4-ax42-20261003-175434-34/ballots.ndjson 588450000 -> 277517098 ratio 0.4716 sha256 30923484e00ce030fa71282f790db378c59128d99898424a36dfba3ea81ea831 | ok /root/.saksi/campaign/runs/mp-50k-ch4-ax42-20261003-175434-34/ledger/ballots.ndjson 588450000 -> 287821189 ratio 0.4891 sha256 f95dd5a3470c113c1476b69739c5e779267228838aa9486d3a522b600da5f42f | ok /root/.saksi/campaign/runs/mp-50k-ch4-ax42-20261003-180015-35/ballots.ndjson 588450000 -> 277522132 ratio 0.4716 sha256 ab25ffecedeece90bd9fa2cd27c36403902bdb62bbaed8c5010a204e82af0508 | ok /root/.saksi/campaign/runs/mp-50k-ch4-ax42-20261003-180015-35/ledger/ballots.ndjson 588450000 -> 287826724 ratio 0.4891 sha256 244f5ff5c7eb59911b49b8654c14afee061b9f40fca73c3dfdc418ea445cd68b | freed 4280881184 bytes
- **10-04 02:07** MP-50K tier summary: Measured committed_tps: median 820.4, mean 820.6, min 819.8, max 822.1 (n = 5). p99 ms: median 212.1, max 217.5.
- **10-04 02:07** mp50k: evidence ready in /root/ax42/outbox/03-mp50k for the desktop pull
- **10-04 02:07** disk check mp483k-warmup: 1,449,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 95.0 GB needed; / (md2) 891.2 GB free of 996 GB
- **10-04 02:08** reset (mp483k-warmup) network-reset-20261003-180731-8 done, chain height 6, 68388 ms
- **10-04 02:08** preflight mp483k-warmup green: host CPU 0.4 % (/proc/stat, 5 s), load1 2.84, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **10-04 02:08** MP-483K ch4 ax42 warmup: campaign campaign-20261003-180851-9 started (0 + 1; / (md2) 929.7 GB free of 996 GB)
- **10-04 02:15** mp483k-warmup: mp-483k-ch4-ax42-warmup-20261003-180851-36 ballot window open since 2026-10-04 02:14:32; first throughput 65000 records in 78784 ms -> ~825 records/s
- **10-04 03:13** MP-483K ch4 ax42 warmup: campaign campaign-20261003-180851-9 done error=None runs 1 resumed False: measured mp-483k-ch4-ax42-warmup-20261003-180851-36 tps 585.736 p99 321.554 failed False 
- **10-04 03:13** mp483k-warmup: resources: ballot window(s): 2026-10-04 02:14:32 to 2026-10-04 02:55:46 | host CPU (/proc/stat) samples in window: 248, mean 34.3 %, max 48.1 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 248 samples, max 0.8 %, over 25 % (contended): 0 | load1 in window: mean 11.79, max 20.70 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 368 %, peer0.org1.example.com 304 %, peer0.org2.example.com 165 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 03:13** export campaign-20261003-180851-9 -> 200 (79457 bytes)
- **10-04 03:14** mp483k-warmup: ledger du: peer0.org1.example.com 17346319652 /var/hyperledger/production | peer0.org2.example.com 17345393612 /var/hyperledger/production | orderer.example.com 14726897439 /var/hyperledger/production/orderer | volume compose_orderer.example.com 14726840095 | volume compose_peer0.org1.example.com 17346155812 | volume compose_peer0.org2.example.com 17345233868 | docker-root 53869601831	/var/lib/docker | /dev/md2       995623145472 86538924032 858433912832  10% / | 
- **10-04 03:14** deleted mp-483k-ch4-ax42-warmup-20261003-180851-36/ballots.csv (6019484026 bytes)
- **10-04 03:15** mp483k-warmup: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-warmup-20261003-180851-36/ballots.ndjson 5707611000 -> 2681718021 ratio 0.4698 sha256 6c969768d7479361e1628e02b986730dd70b3f2473387370f814e01227160dc4 | ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-warmup-20261003-180851-36/ledger/ballots.ndjson 5707611000 -> 2781092223 ratio 0.4873 sha256 ffb10441fd22262746141d40fc54e1ec1b179f29cc3a30c7b630c9ba64ac4fee | freed 5952411756 bytes
- **10-04 03:15** mp483k-warmup: evidence ready in /root/ax42/outbox/04-mp483k-warmup for the desktop pull
- **10-04 03:15** disk check mp483k-m1: 1,449,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 95.0 GB needed; / (md2) 870.4 GB free of 996 GB
- **10-04 03:16** reset (mp483k-m1) network-reset-20261003-191541-10 done, chain height 6, 69061 ms
- **10-04 03:17** preflight mp483k-m1 green: host CPU 0.5 % (/proc/stat, 5 s), load1 2.59, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **10-04 03:17** MP-483K ch4 ax42 m1: campaign campaign-20261003-191701-11 started (0 + 1; / (md2) 923.3 GB free of 996 GB)
- **10-04 03:24** mp483k-m1: mp-483k-ch4-ax42-m1-20261003-191701-37 ballot window open since 2026-10-04 03:22:38; first throughput 68000 records in 82854 ms -> ~821 records/s
- **10-04 04:24** MP-483K ch4 ax42 m1: campaign campaign-20261003-191701-11 done error=None runs 1 resumed False: measured mp-483k-ch4-ax42-m1-20261003-191701-37 tps 557.666 p99 326.92 failed False 
- **10-04 04:24** mp483k-m1: resources: ballot window(s): 2026-10-04 03:22:38 to 2026-10-04 04:05:57 | host CPU (/proc/stat) samples in window: 260, mean 32.4 %, max 47.1 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 260 samples, max 0.7 %, over 25 % (contended): 0 | load1 in window: mean 11.46, max 20.11 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 364 %, peer0.org1.example.com 221 %, peer0.org2.example.com 105 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 04:24** export campaign-20261003-191701-11 -> 200 (81792 bytes)
- **10-04 04:24** mp483k-m1: ledger du: peer0.org1.example.com 17282443796 /var/hyperledger/production | peer0.org2.example.com 17283768726 /var/hyperledger/production | orderer.example.com 14922077027 /var/hyperledger/production/orderer | volume compose_orderer.example.com 14922019683 | volume compose_peer0.org1.example.com 17282279956 | volume compose_peer0.org2.example.com 17283608982 | docker-root 53939293079	/var/lib/docker | /dev/md2       995623145472 92932784128 852040052736  10% / | 
- **10-04 04:24** deleted mp-483k-ch4-ax42-m1-20261003-191701-37/ballots.csv (6007892026 bytes)
- **10-04 04:25** mp483k-m1: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-m1-20261003-191701-37/ballots.ndjson 5696019000 -> 2681189085 ratio 0.4707 sha256 4faa9a8c95aff386f7ca648bd07148f067a47c99b5dddf3a3d8cd05448f9d2af | ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-m1-20261003-191701-37/ledger/ballots.ndjson 5696019000 -> 2780506977 ratio 0.4881 sha256 66096d76300889b88e8042494808d5036f9282398aa764eb34f5f3b7c7ac4eb4 | freed 5930341938 bytes
- **10-04 04:25** mp483k-m1: evidence ready in /root/ax42/outbox/05-mp483k-m1 for the desktop pull
- **10-04 04:25** disk check mp483k-m2: 1,449,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 95.0 GB needed; / (md2) 864.0 GB free of 996 GB
- **10-04 04:27** reset (mp483k-m2) network-reset-20261003-202551-12 done, chain height 6, 67942 ms
- **10-04 04:27** preflight mp483k-m2 green: host CPU 0.5 % (/proc/stat, 5 s), load1 3.23, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **10-04 04:27** MP-483K ch4 ax42 m2: campaign campaign-20261003-202711-13 started (0 + 1; / (md2) 916.9 GB free of 996 GB)
- **10-04 04:34** mp483k-m2: mp-483k-ch4-ax42-m2-20261003-202711-38 ballot window open since 2026-10-04 04:32:48; first throughput 68000 records in 82895 ms -> ~820 records/s
- **10-04 05:34** MP-483K ch4 ax42 m2: campaign campaign-20261003-202711-13 done error=None runs 1 resumed False: measured mp-483k-ch4-ax42-m2-20261003-202711-38 tps 553.92 p99 327.414 failed False 
- **10-04 05:34** mp483k-m2: resources: ballot window(s): 2026-10-04 04:32:48 to 2026-10-04 05:16:24 | host CPU (/proc/stat) samples in window: 262, mean 32.8 %, max 47.9 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 262 samples, max 0.7 %, over 25 % (contended): 0 | load1 in window: mean 12.07, max 16.91 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 364 %, peer0.org1.example.com 245 %, peer0.org2.example.com 112 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 05:34** export campaign-20261003-202711-13 -> 200 (81978 bytes)
- **10-04 05:35** mp483k-m2: ledger du: peer0.org1.example.com 17282676226 /var/hyperledger/production | peer0.org2.example.com 17283830627 /var/hyperledger/production | orderer.example.com 14922072692 /var/hyperledger/production/orderer | volume compose_orderer.example.com 14922015348 | volume compose_peer0.org1.example.com 17282520578 | volume compose_peer0.org2.example.com 17283666787 | docker-root 53939617009	/var/lib/docker | /dev/md2       995623145472 99298037760 845674799104  11% / | 
- **10-04 05:35** deleted mp-483k-ch4-ax42-m2-20261003-202711-38/ballots.csv (6007892026 bytes)
- **10-04 05:35** mp483k-m2: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-m2-20261003-202711-38/ballots.ndjson 5696019000 -> 2681190034 ratio 0.4707 sha256 be2142958c21117a0cab146d7b505d82ca8bbff28464605f7f550e1e34cf4164 | ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-m2-20261003-202711-38/ledger/ballots.ndjson 5696019000 -> 2780519254 ratio 0.4882 sha256 e13e2dadfdd06fbb6e04bb78ce7cc811af276996e1fec0e4da15d417e07eae87 | freed 5930328712 bytes
- **10-04 05:36** mp483k-m2: evidence ready in /root/ax42/outbox/06-mp483k-m2 for the desktop pull
- **10-04 05:36** disk check mp483k-m3: 1,449,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 95.0 GB needed; / (md2) 857.6 GB free of 996 GB
- **10-04 05:37** reset (mp483k-m3) network-reset-20261003-213602-14 done, chain height 6, 67842 ms
- **10-04 05:37** preflight mp483k-m3 green: host CPU 0.4 % (/proc/stat, 5 s), load1 3.35, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **10-04 05:37** MP-483K ch4 ax42 m3: campaign campaign-20261003-213722-15 started (0 + 1; / (md2) 910.6 GB free of 996 GB)
- **10-04 05:44** mp483k-m3: mp-483k-ch4-ax42-m3-20261003-213722-39 ballot window open since 2026-10-04 05:43:00; first throughput 67000 records in 81397 ms -> ~823 records/s
- **10-04 06:21** controller start (pid 304224)
- **10-04 06:21** recovering mp483k-m3 (campaign campaign-20261003-213722-15, runs ['mp-483k-ch4-ax42-m3-20261003-213722-39'])
- **10-04 06:22** mp483k-m3: mp-483k-ch4-ax42-m3-20261003-213722-39 ballot window open since 2026-10-04 05:43:00; first throughput 1314000 records in 2358388 ms -> ~557 records/s
- **10-04 06:44** MP-483K ch4 ax42 m3: campaign campaign-20261003-213722-15 done error=None runs 1 resumed False: measured mp-483k-ch4-ax42-m3-20261003-213722-39 tps 553.899 p99 335.799 failed False 
- **10-04 06:44** mp483k-m3: resources: ballot window(s): 2026-10-04 05:43:00 to 2026-10-04 06:26:36 | host CPU (/proc/stat) samples in window: 261, mean 32.3 %, max 46.9 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 261 samples, max 5.2 %, over 25 % (contended): 0 | load1 in window: mean 12.21, max 18.76 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 378 %, peer0.org1.example.com 217 %, peer0.org2.example.com 113 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 06:44** export campaign-20261003-213722-15 -> 200 (81923 bytes)
- **10-04 06:45** mp483k-m3: ledger du: peer0.org1.example.com 17288936576 /var/hyperledger/production | peer0.org2.example.com 17289243649 /var/hyperledger/production | orderer.example.com 14928335284 /var/hyperledger/production/orderer | volume compose_orderer.example.com 14928277940 | volume compose_peer0.org1.example.com 17288772736 | volume compose_peer0.org2.example.com 17289075713 | docker-root 53957526209	/var/lib/docker | /dev/md2       995623145472 105849315328 839123521536  12% / | 
- **10-04 06:45** deleted mp-483k-ch4-ax42-m3-20261003-213722-39/ballots.csv (6007892026 bytes)
- **10-04 06:46** mp483k-m3: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-m3-20261003-213722-39/ballots.ndjson 5696019000 -> 2681160702 ratio 0.4707 sha256 fc2d9fbf297c511134f7b5d3472b5b08ece2d9474eb57abab7f65192cb4272d5 | ok /root/.saksi/campaign/runs/mp-483k-ch4-ax42-m3-20261003-213722-39/ledger/ballots.ndjson 5696019000 -> 2780470748 ratio 0.4881 sha256 607d675cf9449ea6408e04ff7a285550ebfe3eaa884f8b0174e8769931f4766c | freed 5930406550 bytes
- **10-04 06:46** MP-483K tier summary: Measured committed_tps: median 553.9, mean 555.2, min 553.9, max 557.7 (n = 3). p99 ms: median 327.4, max 335.8.
- **10-04 06:46** mp483k-m3: evidence ready in /root/ax42/outbox/07-mp483k-m3 for the desktop pull
- **10-04 06:46** disk check mp1m-warmup: 3,000,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 175.2 GB needed; / (md2) 851.1 GB free of 996 GB
- **10-04 06:47** reset (mp1m-warmup) network-reset-20261003-224610-16 done, chain height 6, 68064 ms
- **10-04 06:47** preflight mp1m-warmup green: host CPU 0.4 % (/proc/stat, 5 s), load1 2.14, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 3720}, no warnings
- **10-04 06:47** MP-1M ch4 ax42 warmup: campaign campaign-20261003-224730-17 started (0 + 1; / (md2) 904.0 GB free of 996 GB)
- **10-04 07:00** mp1m-warmup: mp-1m-ch4-ax42-warmup-20261003-224730-40 ballot window open since 2026-10-04 06:59:15; first throughput 61000 records in 74286 ms -> ~821 records/s
- **10-04 09:09** MP-1M ch4 ax42 warmup: campaign campaign-20261003-224730-17 done error=None runs 1 resumed False: measured mp-1m-ch4-ax42-warmup-20261003-224730-40 tps 534.547 p99 332.789 failed False 
- **10-04 09:09** mp1m-warmup: resources: ballot window(s): 2026-10-04 06:59:15 to 2026-10-04 08:32:48 | host CPU (/proc/stat) samples in window: 561, mean 31.9 %, max 47.4 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 561 samples, max 0.8 %, over 25 % (contended): 0 | load1 in window: mean 11.71, max 19.00 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 364 %, peer0.org1.example.com 227 %, peer0.org2.example.com 110 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 09:09** export campaign-20261003-224730-17 -> 200 (154860 bytes)
- **10-04 09:11** mp1m-warmup: ledger du: peer0.org1.example.com 35843579322 /var/hyperledger/production | peer0.org2.example.com 35843089111 /var/hyperledger/production | orderer.example.com 29575588202 /var/hyperledger/production/orderer | volume compose_orderer.example.com 29575522666 | volume compose_peer0.org1.example.com 35843329466 | volume compose_peer0.org2.example.com 35842839255 | docker-root 109634457480	/var/lib/docker | /dev/md2       995623145472 187472203776 757500633088  20% / | 
- **10-04 09:11** deleted mp-1m-ch4-ax42-warmup-20261003-224730-40/ballots.csv (12451889026 bytes)
- **10-04 09:13** mp1m-warmup: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-warmup-20261003-224730-40/ballots.ndjson 11805000000 -> 5551357226 ratio 0.4703 sha256 8d660952a764504b044134cc0ff85decd6dbaff4b6c00eb3bc4a7c399af8bacd | ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-warmup-20261003-224730-40/ledger/ballots.ndjson 11805000000 -> 5756650301 ratio 0.4876 sha256 1b1ae8d1c75bfac5395c851735bb3445191897e0dbfa55dcb2d77acb0f199df1 | freed 12301992473 bytes
- **10-04 09:13** mp1m-warmup: evidence ready in /root/ax42/outbox/08-mp1m-warmup for the desktop pull
- **10-04 09:13** disk check mp1m-m1: 3,000,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 175.2 GB needed; / (md2) 782.2 GB free of 996 GB
- **10-04 09:14** reset (mp1m-m1) network-reset-20261004-011321-18 done, chain height 6, 68635 ms
- **10-04 09:14** preflight mp1m-m1 green: host CPU 0.5 % (/proc/stat, 5 s), load1 2.97, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 3720}, no warnings
- **10-04 09:14** MP-1M ch4 ax42 m1: campaign campaign-20261004-011441-19 started (0 + 1; / (md2) 890.9 GB free of 996 GB)
- **10-04 09:27** mp1m-m1: mp-1m-ch4-ax42-m1-20261004-011441-41 ballot window open since 2026-10-04 09:26:26; first throughput 53000 records in 75174 ms -> ~705 records/s
- **10-04 11:42** MP-1M ch4 ax42 m1: campaign campaign-20261004-011441-19 done error=None runs 1 resumed False: measured mp-1m-ch4-ax42-m1-20261004-011441-41 tps 499.525 p99 357.875 failed False 
- **10-04 11:42** mp1m-m1: resources: ballot window(s): 2026-10-04 09:26:26 to 2026-10-04 11:06:32 | host CPU (/proc/stat) samples in window: 601, mean 29.7 %, max 44.6 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 601 samples, max 0.6 %, over 25 % (contended): 0 | load1 in window: mean 11.43, max 18.27 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 361 %, peer0.org1.example.com 208 %, peer0.org2.example.com 105 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 11:42** export campaign-20261004-011441-19 -> 200 (162068 bytes)
- **10-04 11:44** mp1m-m1: ledger du: peer0.org1.example.com 35741280462 /var/hyperledger/production | peer0.org2.example.com 35740038354 /var/hyperledger/production | orderer.example.com 29347941957 /var/hyperledger/production/orderer | volume compose_orderer.example.com 29347876421 | volume compose_peer0.org1.example.com 35741034702 | volume compose_peer0.org2.example.com 35739796690 | docker-root 109201612039	/var/lib/docker | /dev/md2       995623145472 200095473664 744877363200  22% / | 
- **10-04 11:44** deleted mp-1m-ch4-ax42-m1-20261004-011441-41/ballots.csv (12427889026 bytes)
- **10-04 11:46** mp1m-m1: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-m1-20261004-011441-41/ballots.ndjson 11781000000 -> 5550869484 ratio 0.4712 sha256 3b46155a5fe0b4ffdb2358223c9a53ab9668f3fd3225a2b744f1da0c14f01dee | ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-m1-20261004-011441-41/ledger/ballots.ndjson 11781000000 -> 5756170248 ratio 0.4886 sha256 92065dde3bc8d0605a763df986904a7a3ed8e661558cda8f473b8874c205f2fe | freed 12254960268 bytes
- **10-04 11:46** mp1m-m1: evidence ready in /root/ax42/outbox/09-mp1m-m1 for the desktop pull
- **10-04 11:46** disk check mp1m-m2: 3,000,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 175.2 GB needed; / (md2) 769.6 GB free of 996 GB
- **10-04 11:47** reset (mp1m-m2) network-reset-20261004-034630-20 done, chain height 6, 66391 ms
- **10-04 11:47** preflight mp1m-m2 green: host CPU 0.5 % (/proc/stat, 5 s), load1 1.98, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 3720}, no warnings
- **10-04 11:47** MP-1M ch4 ax42 m2: campaign campaign-20261004-034750-21 started (0 + 1; / (md2) 877.8 GB free of 996 GB)
- **10-04 12:00** mp1m-m2: mp-1m-ch4-ax42-m2-20261004-034750-42 ballot window open since 2026-10-04 11:59:34; first throughput 53000 records in 75542 ms -> ~702 records/s
- **10-04 14:21** MP-1M ch4 ax42 m2: campaign campaign-20261004-034750-21 done error=None runs 1 resumed False: measured mp-1m-ch4-ax42-m2-20261004-034750-42 tps 473.534 p99 376.199 failed False 
- **10-04 14:21** mp1m-m2: resources: ballot window(s): 2026-10-04 11:59:34 to 2026-10-04 13:45:10 | host CPU (/proc/stat) samples in window: 633, mean 28.0 %, max 44.2 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 633 samples, max 0.5 %, over 25 % (contended): 0 | load1 in window: mean 10.72, max 16.87 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 362 %, peer0.org1.example.com 212 %, peer0.org2.example.com 90 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 14:21** export campaign-20261004-034750-21 -> 200 (167076 bytes)
- **10-04 14:23** mp1m-m2: ledger du: peer0.org1.example.com 35741459967 /var/hyperledger/production | peer0.org2.example.com 35740105735 /var/hyperledger/production | orderer.example.com 29347941378 /var/hyperledger/production/orderer | volume compose_orderer.example.com 29347875842 | volume compose_peer0.org1.example.com 35741206015 | volume compose_peer0.org2.example.com 35739872263 | docker-root 109201955029	/var/lib/docker | /dev/md2       995623145472 213211254784 731761582080  23% / | 
- **10-04 14:23** deleted mp-1m-ch4-ax42-m2-20261004-034750-42/ballots.csv (12427889026 bytes)
- **10-04 14:25** mp1m-m2: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-m2-20261004-034750-42/ballots.ndjson 11781000000 -> 5550848383 ratio 0.4712 sha256 b67f7dcf3cf2348ac22d1b9e1b4a79fcf4e8128986d15fb866d1cdc7c0f179d6 | ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-m2-20261004-034750-42/ledger/ballots.ndjson 11781000000 -> 5756165333 ratio 0.4886 sha256 46d22c0fd1343b41d56a4c3564920b3e5567b9647790d589088b1d57d1ca6558 | freed 12254986284 bytes
- **10-04 14:25** mp1m-m2: evidence ready in /root/ax42/outbox/10-mp1m-m2 for the desktop pull
- **10-04 14:25** disk check mp1m-m3: 3,000,000 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 175.2 GB needed; / (md2) 756.4 GB free of 996 GB
- **10-04 14:26** reset (mp1m-m3) network-reset-20261004-062537-22 done, chain height 6, 65555 ms
- **10-04 14:26** preflight mp1m-m3 green: host CPU 0.5 % (/proc/stat, 5 s), load1 3.48, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 3720}, no warnings
- **10-04 14:26** MP-1M ch4 ax42 m3: campaign campaign-20261004-062657-23 started (0 + 1; / (md2) 864.7 GB free of 996 GB)
- **10-04 14:39** mp1m-m3: mp-1m-ch4-ax42-m3-20261004-062657-43 ballot window open since 2026-10-04 14:38:43; first throughput 53000 records in 73975 ms -> ~716 records/s
- **10-04 17:02** MP-1M ch4 ax42 m3: campaign campaign-20261004-062657-23 done error=None runs 1 resumed False: measured mp-1m-ch4-ax42-m3-20261004-062657-43 tps 466.675 p99 383.759 failed False 
- **10-04 17:02** mp1m-m3: resources: ballot window(s): 2026-10-04 14:38:43 to 2026-10-04 16:25:52 | host CPU (/proc/stat) samples in window: 643, mean 27.7 %, max 44.5 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 643 samples, max 0.6 %, over 25 % (contended): 0 | load1 in window: mean 10.42, max 15.75 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 360 %, peer0.org1.example.com 196 %, peer0.org2.example.com 89 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 17:02** export campaign-20261004-062657-23 -> 200 (168089 bytes)
- **10-04 17:03** mp1m-m3: ledger du: peer0.org1.example.com 35741452260 /var/hyperledger/production | peer0.org2.example.com 35740145477 /var/hyperledger/production | orderer.example.com 29347947069 /var/hyperledger/production/orderer | volume compose_orderer.example.com 29347881533 | volume compose_peer0.org1.example.com 35741202404 | volume compose_peer0.org2.example.com 35739895621 | docker-root 109201867565	/var/lib/docker | /dev/md2       995623145472 226322829312 718650007552  24% / | 
- **10-04 17:03** deleted mp-1m-ch4-ax42-m3-20261004-062657-43/ballots.csv (12427889026 bytes)
- **10-04 17:05** mp1m-m3: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-m3-20261004-062657-43/ballots.ndjson 11781000000 -> 5550887574 ratio 0.4712 sha256 deb19ecfcdad37641cb4d772b44a7675e6341e84f20437dc996533aab94d93ec | ok /root/.saksi/campaign/runs/mp-1m-ch4-ax42-m3-20261004-062657-43/ledger/ballots.ndjson 11781000000 -> 5756180795 ratio 0.4886 sha256 3f5326e3eff0ec9f5ae54a3d8b300095f47fcf09561e570e6651ddb7ad3bb4cc | freed 12254931631 bytes
- **10-04 17:05** MP-1M tier summary: Measured committed_tps: median 473.5, mean 479.9, min 466.7, max 499.5 (n = 3). p99 ms: median 376.2, max 383.8.
- **10-04 17:05** mp1m-m3: evidence ready in /root/ax42/outbox/11-mp1m-m3 for the desktop pull
- **10-04 17:05** disk check mp1.92m-warmup: 5,765,751 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 318.4 GB needed; / (md2) 743.3 GB free of 996 GB
- **10-04 17:07** reset (mp1.92m-warmup) network-reset-20261004-090547-24 done, chain height 6, 66891 ms
- **10-04 17:07** preflight mp1.92m-warmup green: host CPU 0.4 % (/proc/stat, 5 s), load1 2.34, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 7149.53124}, no warnings
- **10-04 17:07** MP-1.92M ch4 ax42 warmup: campaign campaign-20261004-090707-25 started (0 + 1; / (md2) 851.6 GB free of 996 GB)
- **10-04 17:31** mp1.92m-warmup: mp-1-92m-ch4-ax42-warmup-20261004-090707-44 ballot window open since 2026-10-04 17:29:53; first throughput 53000 records in 73601 ms -> ~720 records/s
- **10-04 22:18** MP-1.92M ch4 ax42 warmup: campaign campaign-20261004-090707-25 done error=None runs 1 resumed False: measured mp-1-92m-ch4-ax42-warmup-20261004-090707-44 tps 440.096 p99 422.182 failed False 
- **10-04 22:18** mp1.92m-warmup: resources: ballot window(s): 2026-10-04 17:29:53 to 2026-10-04 21:08:15 | host CPU (/proc/stat) samples in window: 1310, mean 25.9 %, max 43.4 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 1310 samples, max 0.8 %, over 25 % (contended): 0 | load1 in window: mean 10.63, max 16.60 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 365 %, peer0.org1.example.com 186 %, peer0.org2.example.com 103 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-04 22:18** export campaign-20261004-090707-25 -> 200 (311727 bytes)
- **10-04 22:21** mp1.92m-warmup: ledger du: peer0.org1.example.com 69112691712 /var/hyperledger/production | peer0.org2.example.com 69107542957 /var/hyperledger/production | orderer.example.com 55994679639 /var/hyperledger/production/orderer | volume compose_orderer.example.com 55994597719 | volume compose_peer0.org1.example.com 69112323072 | volume compose_peer0.org2.example.com 69107170221 | docker-root 209592781685	/var/lib/docker | /dev/md2       995623145472 374880022528 570092814336  40% / | 
- **10-04 22:21** deleted mp-1-92m-ch4-ax42-warmup-20261004-090707-44/ballots.csv (23967115933 bytes)
- **10-04 22:25** mp1.92m-warmup: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-warmup-20261004-090707-44/ballots.ndjson 22722824691 -> 10670459415 ratio 0.4696 sha256 b22a9fb8750e2ef46ad53728cf37185c335225dc87257fc0c3d02593f1021f31 | ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-warmup-20261004-090707-44/ledger/ballots.ndjson 22722824691 -> 11064659879 ratio 0.4869 sha256 3773123088ab5cb3f6fc179e66895deee4014146a28c6a7074399af714353e26 | freed 23710530088 bytes
- **10-04 22:25** mp1.92m-warmup: evidence ready in /root/ax42/outbox/12-mp1.92m-warmup for the desktop pull
- **10-04 22:25** disk check mp1.92m-m1: 5,765,751 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 318.4 GB needed; / (md2) 617.8 GB free of 996 GB
- **10-04 22:26** reset (mp1.92m-m1) network-reset-20261004-142534-26 done, chain height 6, 69561 ms
- **10-04 22:26** preflight mp1.92m-m1 green: host CPU 0.5 % (/proc/stat, 5 s), load1 2.63, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 7149.53124}, no warnings
- **10-04 22:26** MP-1.92M ch4 ax42 m1: campaign campaign-20261004-142654-27 started (0 + 1; / (md2) 826.4 GB free of 996 GB)
- **10-04 22:50** mp1.92m-m1: mp-1-92m-ch4-ax42-m1-20261004-142654-45 ballot window open since 2026-10-04 22:49:40; first throughput 49000 records in 72928 ms -> ~672 records/s
- **10-05 03:27** MP-1.92M ch4 ax42 m1: campaign campaign-20261004-142654-27 done error=None runs 1 resumed False: measured mp-1-92m-ch4-ax42-m1-20261004-142654-45 tps 464.944 p99 413.1 failed False 
- **10-05 03:27** mp1.92m-m1: resources: ballot window(s): 2026-10-04 22:49:40 to 2026-10-05 02:16:22 | host CPU (/proc/stat) samples in window: 1240, mean 27.4 %, max 43.7 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 1240 samples, max 0.6 %, over 25 % (contended): 0 | load1 in window: mean 10.73, max 17.54 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 359 %, peer0.org1.example.com 195 %, peer0.org2.example.com 116 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-05 03:27** export campaign-20261004-142654-27 -> 200 (303041 bytes)
- **10-05 03:30** mp1.92m-m1: ledger du: peer0.org1.example.com 68893500610 /var/hyperledger/production | peer0.org2.example.com 68889927853 /var/hyperledger/production | orderer.example.com 55510135774 /var/hyperledger/production/orderer | volume compose_orderer.example.com 55510053854 | volume compose_peer0.org1.example.com 68893131970 | volume compose_peer0.org2.example.com 68889559213 | docker-root 208671390423	/var/lib/docker | /dev/md2       995623145472 398977884160 545994952704  43% / | 
- **10-05 03:30** deleted mp-1-92m-ch4-ax42-m1-20261004-142654-45/ballots.csv (23920989925 bytes)
- **10-05 03:34** mp1.92m-m1: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-m1-20261004-142654-45/ballots.ndjson 22676698683 -> 10668962995 ratio 0.4705 sha256 84cb4fe4cecd76599bee2433ea4f1d7420bd26bc330d9a2d3f1585c34627c773 | ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-m1-20261004-142654-45/ledger/ballots.ndjson 22676698683 -> 11062888712 ratio 0.4879 sha256 2529d15c050ab60c4a890a24c78a33e8484ce936606823044d2389ec216a7f8a | freed 23621545659 bytes
- **10-05 03:34** mp1.92m-m1: evidence ready in /root/ax42/outbox/13-mp1.92m-m1 for the desktop pull
- **10-05 03:34** disk check mp1.92m-m2: 5,765,751 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 318.4 GB needed; / (md2) 593.5 GB free of 996 GB
- **10-05 03:35** reset (mp1.92m-m2) network-reset-20261004-193422-28 done, chain height 6, 65351 ms
- **10-05 03:35** preflight mp1.92m-m2 green: host CPU 0.4 % (/proc/stat, 5 s), load1 1.6, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 7149.53124}, no warnings
- **10-05 03:35** MP-1.92M ch4 ax42 m2: campaign campaign-20261004-193542-29 started (0 + 1; / (md2) 801.3 GB free of 996 GB)
- **10-05 03:59** mp1.92m-m2: mp-1-92m-ch4-ax42-m2-20261004-193542-46 ballot window open since 2026-10-05 03:58:24; first throughput 64000 records in 78189 ms -> ~819 records/s
- **10-05 08:15** MP-1.92M ch4 ax42 m2: campaign campaign-20261004-193542-29 done error=None runs 1 resumed False: measured mp-1-92m-ch4-ax42-m2-20261004-193542-46 tps 513.371 p99 346.931 failed False 
- **10-05 08:15** mp1.92m-m2: resources: ballot window(s): 2026-10-05 03:58:24 to 2026-10-05 07:05:36 | host CPU (/proc/stat) samples in window: 1123, mean 30.7 %, max 47.0 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 1123 samples, max 1.4 %, over 25 % (contended): 0 | load1 in window: mean 11.55, max 18.92 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 364 %, peer0.org1.example.com 223 %, peer0.org2.example.com 117 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-05 08:15** export campaign-20261004-193542-29 -> 200 (279706 bytes)
- **10-05 08:19** mp1.92m-m2: ledger du: peer0.org1.example.com 68871405835 /var/hyperledger/production | peer0.org2.example.com 68866968139 /var/hyperledger/production | orderer.example.com 55679522845 /var/hyperledger/production/orderer | volume compose_orderer.example.com 55679440925 | volume compose_peer0.org1.example.com 68871029003 | volume compose_peer0.org2.example.com 68866587211 | docker-root 208795395300	/var/lib/docker | /dev/md2       995623145472 424247844864 520724992000  45% / | 
- **10-05 08:19** deleted mp-1-92m-ch4-ax42-m2-20261004-193542-46/ballots.csv (23920989925 bytes)
- **10-05 08:22** mp1.92m-m2: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-m2-20261004-193542-46/ballots.ndjson 22676698683 -> 10668892201 ratio 0.4705 sha256 8a88e70143f91c8deee4b673723495e8a1a580b9d90022608b5a4b265ef61451 | ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-m2-20261004-193542-46/ledger/ballots.ndjson 22676698683 -> 11062828373 ratio 0.4879 sha256 1b5fa16f9bfdfebb1d2ad88f26db48efc3f7380f364cf1f8a74c611273865d8a | freed 23621676792 bytes
- **10-05 08:23** mp1.92m-m2: evidence ready in /root/ax42/outbox/14-mp1.92m-m2 for the desktop pull
- **10-05 08:23** disk check mp1.92m-m3: 5,765,751 records x 1 run(s) x 45 KB x 1.15 + 20 GB = 318.4 GB needed; / (md2) 568.3 GB free of 996 GB
- **10-05 08:24** reset (mp1.92m-m3) network-reset-20261005-002308-30 done, chain height 6, 67094 ms
- **10-05 08:24** preflight mp1.92m-m3 green: host CPU 0.5 % (/proc/stat, 5 s), load1 1.71, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 7149.53124}, no warnings
- **10-05 08:24** MP-1.92M ch4 ax42 m3: campaign campaign-20261005-002428-31 started (0 + 1; / (md2) 776.1 GB free of 996 GB)
- **10-05 08:48** mp1.92m-m3: mp-1-92m-ch4-ax42-m3-20261005-002428-47 ballot window open since 2026-10-05 08:47:07; first throughput 54000 records in 79671 ms -> ~678 records/s
- **10-05 11:25** controller start (pid 1417848)
- **10-05 11:25** recovering mp1.92m-m3 (campaign campaign-20261005-002428-31, runs ['mp-1-92m-ch4-ax42-m3-20261005-002428-47'])
- **10-05 11:26** mp1.92m-m3: mp-1-92m-ch4-ax42-m3-20261005-002428-47 ballot window open since 2026-10-05 08:47:07; first throughput 4423000 records in 9573488 ms -> ~462 records/s
- **10-05 13:27** MP-1.92M ch4 ax42 m3: campaign campaign-20261005-002428-31 done error=None runs 1 resumed False: measured mp-1-92m-ch4-ax42-m3-20261005-002428-47 tps 456.659 p99 390.415 failed False 
- **10-05 13:27** mp1.92m-m3: resources: ballot window(s): 2026-10-05 08:47:07 to 2026-10-05 12:17:35 | host CPU (/proc/stat) samples in window: 1263, mean 27.4 %, max 44.7 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 1263 samples, max 0.8 %, over 25 % (contended): 0 | load1 in window: mean 10.81, max 16.23 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 364 %, peer0.org1.example.com 199 %, peer0.org2.example.com 91 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-05 13:27** export campaign-20261005-002428-31 -> 200 (302206 bytes)
- **10-05 13:30** mp1.92m-m3: ledger du: peer0.org1.example.com 68870402851 /var/hyperledger/production | peer0.org2.example.com 68866631754 /var/hyperledger/production | orderer.example.com 55679986041 /var/hyperledger/production/orderer | volume compose_orderer.example.com 55679904121 | volume compose_peer0.org1.example.com 68870017827 | volume compose_peer0.org2.example.com 68866267210 | docker-root 208794522154	/var/lib/docker | /dev/md2       995623145472 449406578688 495566258176  48% / | 
- **10-05 13:31** deleted mp-1-92m-ch4-ax42-m3-20261005-002428-47/ballots.csv (23920989925 bytes)
- **10-05 13:34** mp1.92m-m3: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-m3-20261005-002428-47/ballots.ndjson 22676698683 -> 10668993184 ratio 0.4705 sha256 bb1e854e693fd1c05137de98f5d70fb1a3b8657fc26f6bf0c08d9a9fc85546c6 | ok /root/.saksi/campaign/runs/mp-1-92m-ch4-ax42-m3-20261005-002428-47/ledger/ballots.ndjson 22676698683 -> 11062908446 ratio 0.4879 sha256 5e83d026e11f3bfbb48aefe6e64c8388a132e551f0781b160f51aa0a39402829 | freed 23621495736 bytes
- **10-05 13:35** MP-1.92M tier summary: Measured committed_tps: median 464.9, mean 478.3, min 456.7, max 513.4 (n = 3). p99 ms: median 390.4, max 413.1.
- **10-05 13:35** mp1.92m-m3: evidence ready in /root/ax42/outbox/15-mp1.92m-m3 for the desktop pull
- **10-05 13:35** disk check mp3.5m-warmup: 10,572,234 records x 1 run(s) x 45 KB x 1.0 + 20 GB = 495.8 GB needed; / (md2) 543.1 GB free of 996 GB
- **10-05 13:36** reset (mp3.5m-warmup) network-reset-20261005-053505-32 done, chain height 6, 67882 ms
- **10-05 13:37** preflight mp3.5m-warmup green: host CPU 0.4 % (/proc/stat, 5 s), load1 2.27, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 13109.57016}, no warnings
- **10-05 13:37** MP-3.5M ch4 ax42 warmup: campaign campaign-20261005-053700-33 started (0 + 1; / (md2) 750.9 GB free of 996 GB)
- **10-05 14:21** mp3.5m-warmup: mp-3-5m-ch4-ax42-warmup-20261005-053700-48 ballot window open since 2026-10-05 14:19:17; first throughput 57000 records in 101238 ms -> ~563 records/s
- **10-05 23:19** MP-3.5M ch4 ax42 warmup: campaign campaign-20261005-053700-33 done error=None runs 1 resumed False: measured mp-3-5m-ch4-ax42-warmup-20261005-053700-48 tps 428.428 p99 441.492 failed False 
- **10-05 23:19** mp3.5m-warmup: resources: ballot window(s): 2026-10-05 14:19:17 to 2026-10-05 21:10:36 | host CPU (/proc/stat) samples in window: 2468, mean 25.5 %, max 33.7 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 2468 samples, max 0.6 %, over 25 % (contended): 0 | load1 in window: mean 10.56, max 17.09 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 277 %, peer0.org1.example.com 181 %, peer0.org2.example.com 101 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-05 23:19** export campaign-20261005-053700-33 -> 200 (546491 bytes)
- **10-05 23:25** mp3.5m-warmup: ledger du: peer0.org1.example.com 126598020379 /var/hyperledger/production | peer0.org2.example.com 126585171613 /var/hyperledger/production | orderer.example.com 101531871974 /var/hyperledger/production/orderer | volume compose_orderer.example.com 101531773670 | volume compose_peer0.org1.example.com 126597426459 | volume compose_peer0.org2.example.com 126584610461 | docker-root 382275304244	/var/lib/docker | /dev/md2       995623145472 708823052288 236149784576  76% / | 
- **10-05 23:25** deleted mp-3-5m-ch4-ax42-warmup-20261005-053700-48/ballots.csv (43927093530 bytes)
- **10-05 23:32** mp3.5m-warmup: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-warmup-20261005-053700-48/ballots.ndjson 41644029726 -> 19566504562 ratio 0.4699 sha256 37bc04575214073c7f8a704955bc2fe94d1dd7ea9954ace82a48b6cfb9fe93f1 | ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-warmup-20261005-053700-48/ledger/ballots.ndjson 41644029726 -> 20287998193 ratio 0.4872 sha256 0a0b9b9e550f3776425894e1229caaef01f5468e823c10ac585456d20253a6fd | freed 43433556697 bytes
- **10-05 23:33** mp3.5m-warmup: evidence ready in /root/ax42/outbox/16-mp3.5m-warmup for the desktop pull
- **10-05 23:33** disk check mp3.5m-m1: 10,572,234 records x 1 run(s) x 45 KB x 1.0 + 20 GB = 495.8 GB needed; / (md2) 323.5 GB free of 996 GB
- **10-05 23:33** STOPPED at mp3.5m-m1: disk: 323.5 GB free < 495.8 GB needed for mp3.5m-m1
- **10-06 00:32** controller start (pid 1863554)
- **10-06 00:32** disk check mp3.5m-m1: 354.7 GB in Fabric volumes counted free (the reset wipes them)
- **10-06 00:32** disk check mp3.5m-m1: 10,572,234 records x 1 run(s) x 45 KB x 1.0 + 20 GB = 495.8 GB needed; / (md2) 323.5 GB free of 996 GB
- **10-06 00:33** reset (mp3.5m-m1) network-reset-20261005-163217-34 done, chain height 6, 66523 ms
- **10-06 00:33** preflight mp3.5m-m1 green: host CPU 0.5 % (/proc/stat, 5 s), load1 1.69, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 13109.57016}, no warnings
- **10-06 00:33** MP-3.5M ch4 ax42 m1: campaign campaign-20261005-163337-35 started (0 + 1; / (md2) 704.8 GB free of 996 GB)
- **10-06 01:16** mp3.5m-m1: mp-3-5m-ch4-ax42-m1-20261005-163337-49 ballot window open since 2026-10-06 01:15:05; first throughput 60000 records in 91762 ms -> ~654 records/s
- **10-06 10:22** MP-3.5M ch4 ax42 m1: campaign campaign-20261005-163337-35 done error=None runs 1 resumed False: measured mp-3-5m-ch4-ax42-m1-20261005-163337-49 tps 421.029 p99 457.115 failed False 
- **10-06 10:22** mp3.5m-m1: resources: ballot window(s): 2026-10-06 01:15:05 to 2026-10-06 08:13:38 | host CPU (/proc/stat) samples in window: 2512, mean 25.9 %, max 45.2 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 2512 samples, max 2.6 %, over 25 % (contended): 0 | load1 in window: mean 10.65, max 18.37 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 367 %, peer0.org1.example.com 210 %, peer0.org2.example.com 96 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-06 10:22** export campaign-20261005-163337-35 -> 200 (550887 bytes)
- **10-06 10:28** mp3.5m-m1: ledger du: peer0.org1.example.com 126189567481 /var/hyperledger/production | peer0.org2.example.com 126179878685 /var/hyperledger/production | orderer.example.com 101082316599 /var/hyperledger/production/orderer | volume compose_orderer.example.com 101082218295 | volume compose_peer0.org1.example.com 126188998137 | volume compose_peer0.org2.example.com 126179305245 | docker-root 381011269115	/var/lib/docker | /dev/md2       995623145472 753464778752 191508058112  80% / | 
- **10-06 10:28** deleted mp-3-5m-ch4-ax42-m1-20261005-163337-49/ballots.csv (43842515658 bytes)
- **10-06 10:35** mp3.5m-m1: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-m1-20261005-163337-49/ballots.ndjson 41559451854 -> 19562506908 ratio 0.4707 sha256 32318203023531ec64542b0ec4b05f9c8635190bb2fafba8603a8ab54aff5634 | ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-m1-20261005-163337-49/ledger/ballots.ndjson 41559451854 -> 20283620205 ratio 0.4881 sha256 d58eae5020dc0386d59217b6ffab327e2cc237615a021a292dbfb388636c8ab5 | freed 43272776595 bytes
- **10-06 10:35** mp3.5m-m1: evidence ready in /root/ax42/outbox/17-mp3.5m-m1 for the desktop pull
- **10-06 10:35** disk check mp3.5m-m2: 353.5 GB in Fabric volumes counted free (the reset wipes them)
- **10-06 10:35** disk check mp3.5m-m2: 10,572,234 records x 1 run(s) x 45 KB x 1.0 + 20 GB = 495.8 GB needed; / (md2) 278.6 GB free of 996 GB
- **10-06 10:37** reset (mp3.5m-m2) network-reset-20261006-023556-36 done, chain height 6, 65906 ms
- **10-06 10:37** preflight mp3.5m-m2 green: host CPU 0.5 % (/proc/stat, 5 s), load1 2.84, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 13109.57016}, no warnings
- **10-06 10:37** MP-3.5M ch4 ax42 m2: campaign campaign-20261006-023716-37 started (0 + 1; / (md2) 658.7 GB free of 996 GB)
- **10-06 11:21** mp3.5m-m2: mp-3-5m-ch4-ax42-m2-20261006-023716-50 ballot window open since 2026-10-06 11:19:31; first throughput 59000 records in 103995 ms -> ~567 records/s
- **10-06 20:23** MP-3.5M ch4 ax42 m2: campaign campaign-20261006-023716-37 done error=None runs 1 resumed False: measured mp-3-5m-ch4-ax42-m2-20261006-023716-50 tps 423.904 p99 448.935 failed False 
- **10-06 20:24** mp3.5m-m2: resources: ballot window(s): 2026-10-06 11:19:31 to 2026-10-06 18:15:14 | host CPU (/proc/stat) samples in window: 2494, mean 25.5 %, max 33.8 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 2494 samples, max 1.0 %, over 25 % (contended): 0 | load1 in window: mean 10.84, max 16.59 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 279 %, peer0.org1.example.com 162 %, peer0.org2.example.com 91 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-06 20:24** export campaign-20261006-023716-37 -> 200 (550487 bytes)
- **10-06 20:29** mp3.5m-m2: ledger du: peer0.org1.example.com 126189443279 /var/hyperledger/production | peer0.org2.example.com 126178471486 /var/hyperledger/production | orderer.example.com 101082301433 /var/hyperledger/production/orderer | volume compose_orderer.example.com 101082203129 | volume compose_peer0.org1.example.com 126188873935 | volume compose_peer0.org2.example.com 126177898046 | docker-root 381009936171	/var/lib/docker | /dev/md2       995623145472 799550033920 145422802944  85% / | 
- **10-06 20:29** deleted mp-3-5m-ch4-ax42-m2-20261006-023716-50/ballots.csv (43842515658 bytes)
- **10-06 20:37** mp3.5m-m2: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-m2-20261006-023716-50/ballots.ndjson 41559451854 -> 19562413617 ratio 0.4707 sha256 3bc146c9ac921266bc6a5759d7133de52f597279e432d07efa3be8bb4e6c7cab | ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-m2-20261006-023716-50/ledger/ballots.ndjson 41559451854 -> 20283554143 ratio 0.4881 sha256 167d7b14543cf8bfb2a803f89ef99432e32c64a07be78cb655fbb1359651371e | freed 43272935948 bytes
- **10-06 20:37** mp3.5m-m2: evidence ready in /root/ax42/outbox/18-mp3.5m-m2 for the desktop pull
- **10-06 20:37** disk check mp3.5m-m3: 353.4 GB in Fabric volumes counted free (the reset wipes them)
- **10-06 20:37** disk check mp3.5m-m3: 10,572,234 records x 1 run(s) x 45 KB x 1.0 + 20 GB = 495.8 GB needed; / (md2) 232.5 GB free of 996 GB
- **10-06 20:39** reset (mp3.5m-m3) network-reset-20261006-123745-38 done, chain height 6, 70054 ms
- **10-06 20:39** preflight mp3.5m-m3 green: host CPU 0.4 % (/proc/stat, 5 s), load1 2.21, orderer 50/2s/2 MB/268435456 saksi_configtx saksi, phase_timeout {'seconds': 43200, 'longest_phase': 'ballot submission', 'estimated_s': 13109.57016}, no warnings
- **10-06 20:39** MP-3.5M ch4 ax42 m3: campaign campaign-20261006-123905-39 started (0 + 1; / (md2) 612.6 GB free of 996 GB)
- **10-06 21:23** mp3.5m-m3: mp-3-5m-ch4-ax42-m3-20261006-123905-51 ballot window open since 2026-10-06 21:21:17; first throughput 56000 records in 107716 ms -> ~520 records/s
- **10-07 06:20** MP-3.5M ch4 ax42 m3: campaign campaign-20261006-123905-39 done error=None runs 1 resumed False: measured mp-3-5m-ch4-ax42-m3-20261006-123905-51 tps 429.242 p99 434.845 failed False 
- **10-07 06:20** mp3.5m-m3: resources: ballot window(s): 2026-10-06 21:21:17 to 2026-10-07 04:11:49 | host CPU (/proc/stat) samples in window: 2463, mean 26.1 %, max 30.6 % | non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): 2463 samples, max 4.3 %, over 25 % (contended): 0 | load1 in window: mean 10.74, max 17.35 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 238 %, peer0.org1.example.com 165 %, peer0.org2.example.com 88 % | bottleneck: none evident from host evidence (no memory, disk-util, queue or CPU saturation flag)
- **10-07 06:20** export campaign-20261006-123905-39 -> 200 (542169 bytes)
- **10-07 06:26** mp3.5m-m3: ledger du: peer0.org1.example.com 126189893537 /var/hyperledger/production | peer0.org2.example.com 126179949219 /var/hyperledger/production | orderer.example.com 101082309860 /var/hyperledger/production/orderer | volume compose_orderer.example.com 101082211556 | volume compose_peer0.org1.example.com 126189316001 | volume compose_peer0.org2.example.com 126179379875 | docker-root 381011738990	/var/lib/docker | /dev/md2       995623145472 845653860352 99318976512  90% / | 
- **10-07 06:26** deleted mp-3-5m-ch4-ax42-m3-20261006-123905-51/ballots.csv (43842515658 bytes)
- **10-07 06:33** mp3.5m-m3: ndjson stored zstd-compressed (sha256 sidecars): ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-m3-20261006-123905-51/ballots.ndjson 41559451854 -> 19562562731 ratio 0.4707 sha256 beb0385c506ab7928c65d9eacf90351bb862fabf53a7ebc0358bbf936692195f | ok /root/.saksi/campaign/runs/mp-3-5m-ch4-ax42-m3-20261006-123905-51/ledger/ballots.ndjson 41559451854 -> 20283709645 ratio 0.4881 sha256 cde6c60be4e8a109f600c50b6f930d523caa87f88b5dfea4976a7a5693b2d0cc | freed 43272631332 bytes
- **10-07 06:34** MP-3.5M tier summary: Measured committed_tps: median 423.9, mean 424.7, min 421.0, max 429.2 (n = 3). p99 ms: median 448.9, max 457.1.
- **10-07 06:34** mp3.5m-m3: evidence ready in /root/ax42/outbox/19-mp3.5m-m3 for the desktop pull
- **10-07 06:34** AX42 queue complete: [{"label": "mp1k", "runs": [["mp-1k-ch4-ax42-20261003-170017-5", 829.902, 198.968, 0], ["mp-1k-ch4-ax42-20261003-170041-6", 841.349, 194.282, 0], ["mp-1k-ch4-ax42-20261003-170105-7", 831.033, 208.014, 0], ["mp-1k-ch4-ax42-20261003-170129-8", 830.074, 189.245, 0], ["mp-1k-ch4-ax42-20261003-170153-9", 814.558, 218.574, 0], ["mp-1k-ch4-ax42-20261003-170217-10", 835.495, 226.361, 0], ["mp-1k-ch4-ax42-20261003-170241-11", 833.213, 199.068, 0], ["mp-1k-ch4-ax42-20261003-170305-12", 827.354, 208.567, 0], ["mp-1k-ch4-ax42-20261003-170329-13", 832.09, 197.62, 0], ["mp-1k-ch4-ax42-20261003-170353-14", 825.849, 218.183, 0], ["mp-1k-ch4-ax42-20261003-170417-15", 830.753, 193.332, 0], ["mp-1k-ch4-ax42-20261003-170441-16", 820.477, 221.614, 0]]}, {"label": "mp10k", "runs": [["mp-10k-ch4-ax42-20261003-170718-17", 838.449, 213.233, 0], ["mp-10k-ch4-ax42-20261003-170840-18", 835.351, 214.056, 0], ["mp-10k-ch4-ax42-20261003-171002-19", 836.423, 206.019, 0], ["mp-10k-ch4-ax42-20261003-171124-20", 838.217, 207.466, 0], ["mp-10k-ch4-ax42-20261003-171246-21", 839.374, 210.811, 0], ["mp-10k-ch4-ax42-20261003-171408-22", 834.102, 210.754, 0], ["mp-10k-ch4-ax42-20261003-171529-23", 835.78, 210.65, 0], ["mp-10k-ch4-ax42-20261003-171651-24", 835.372, 207.758, 0], ["mp-10k-ch4-ax42-20261003-171812-25", 836.057, 209.077, 0], ["mp-10k-ch4-ax42-20261003-171934-26", 831.69, 213.668, 0], ["mp-10k-ch4-ax42-20261003-172056-27", 830.766, 205.528, 0], ["mp-10k-ch4-ax42-20261003-172217-28", 784.523, 254.759, 0]]}, {"label": "mp50k", "runs": [["mp-50k-ch4-ax42-20261003-172609-29", 823.973, 233.433, 0], ["mp-50k-ch4-ax42-20261003-173147-30", 807.595, 242.455, 0], ["mp-50k-ch4-ax42-20261003-173729-31", 822.09, 217.455, 0], ["mp-50k-ch4-ax42-20261003-174311-32", 820.678, 211.402, 0], ["mp-50k-ch4-ax42-20261003-174852-33", 819.753, 212.114, 0], ["mp-50k-ch4-ax42-20261003-175434-34", 820.427, 211.932, 0], ["mp-50k-ch4-ax42-20261003-180015-35", 820.003, 215.192, 0]]}, {"label": "mp483k-warmup", "runs": [["mp-483k-ch4-ax42-warmup-20261003-180851-36", 585.736, 321.554, 0]]}, {"label": "mp483k-m1", "runs": [["mp-483k-ch4-ax42-m1-20261003-191701-37", 557.666, 326.92, 0]]}, {"label": "mp483k-m2", "runs": [["mp-483k-ch4-ax42-m2-20261003-202711-38", 553.92, 327.414, 0]]}, {"label": "mp483k-m3", "runs": [["mp-483k-ch4-ax42-m3-20261003-213722-39", 553.899, 335.799, 0]]}, {"label": "mp1m-warmup", "runs": [["mp-1m-ch4-ax42-warmup-20261003-224730-40", 534.547, 332.789, 0]]}, {"label": "mp1m-m1", "runs": [["mp-1m-ch4-ax42-m1-20261004-011441-41", 499.525, 357.875, 0]]}, {"label": "mp1m-m2", "runs": [["mp-1m-ch4-ax42-m2-20261004-034750-42", 473.534, 376.199, 0]]}, {"label": "mp1m-m3", "runs": [["mp-1m-ch4-ax42-m3-20261004-062657-43", 466.675, 383.759, 0]]}, {"label": "mp1.92m-warmup", "runs": [["mp-1-92m-ch4-ax42-warmup-20261004-090707-44", 440.096, 422.182, 0]]}, {"label": "mp1.92m-m1", "runs": [["mp-1-92m-ch4-ax42-m1-20261004-142654-45", 464.944, 413.1, 0]]}, {"label": "mp1.92m-m2", "runs": [["mp-1-92m-
- **23:03** controller start (pid 27604)
- **23:03** C: check sp483k-fresh: run writes ~5.9 GB inside the Ubuntu disk (483000 records); room 117.8 GB (C: above 15 GB + 87.1 GB ext4.vhdx slack); C: 45.6 GB free, Q: 382.2 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **23:03** C: sp483k-fresh keeps ~1.9 GB after csv deletion and zstd (ratio 0.4904)
- **23:03** disk check: Q: 382.2 GB free >= need 68.0 GB and docker vhdx 15.6 GB: compaction not needed
- **23:03** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-2303.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **23:05** reset (sp483k-fresh) network-reset-20261007-150331-1 done, chain height 6, 88718 ms
- **23:05** sp483k-fresh: waiting for C:\Users\User\ch4-capstone\A6-UPLOAD-DONE (upload in progress) before the run starts
- **23:33** sp483k-fresh: A6-UPLOAD-DONE present: starting
- **23:33** preflight sp483k-fresh green: host CPU 18.3 %, load1 0.27, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 598.92}, no warnings
- **23:33** SP-483K ch4 fresh: campaign campaign-20261007-153305-2 started (C: 45.1 GB free, Q: 382.2 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB)
- **00:03** SP-483K ch4 fresh: campaign campaign-20261007-153305-2 done error=None run sp-483k-ch4-fresh-20261007-153309-1 tps 583.315 p99 489.759 failed False  resumed False
- **00:03** sp483k-fresh: resources: ballot window: 2026-10-07 23:38:21 to 2026-10-07 23:52:09 | host CPU samples in window: 83, max 89.1 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 83 samples, max 30.9 %, over 25 % (contended): 1 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 454 %, peer0.org1.example.com 388 %, peer0.org2.example.com 156 %
- **00:03** export campaign-20261007-153305-2 -> http 200 rc 0
- **00:04** sp483k-fresh: ledger du: peer0.org1.example.com 5745078003 /var/hyperledger/production | peer0.org2.example.com 5745071774 /var/hyperledger/production | orderer.example.com 5713550793 /var/hyperledger/production/orderer | /dev/sde       1081101176832 32341463040 993767358464   4% /var/hyperledger/production | 
- **00:04** deleted sp-483k-ch4-fresh-20261007-153309-1/ballots.csv (1968597026 bytes)
- **00:05** sp-483k-ch4-fresh-20261007-153309-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/sp-483k-ch4-fresh-20261007-153309-1/ballots.ndjson 1894809000 -> 927139632 ratio 0.4893 sha256 6bd9bd38ec7ca00c16c01880af4324cc96e16d715993e3acd6ebdeeba15306b7 | ok /home/user/.saksi/campaign/runs/sp-483k-ch4-fresh-20261007-153309-1/ledger/ballots.ndjson 1894809000 -> 926343026 ratio 0.4889 sha256 a5a033a18a1d33d3f199e8016cfeb1eae89192139e38e03c883b3e1100e6f48a | freed 1936135342 bytes
- **00:06** archive to Q:\thesis-archive\runs (sp-483k-ch4-fresh-20261007-153309-1): 2 files, archived 1853482658 bytes, failures none rc 0 ; C: 33.2 GB free, Q: 316.4 GB free, docker vhdx 79.6 GB, ubuntu vhdx 212.98 GB
- **00:06** push docs/ch4-night1-2026-10-01 -> rc 0 
- **00:06** sp483k-fresh: minor host spike, 1 of 83 samples > 25 % (host minus WSL VM); below the rerun rule (> 2 % and >= 6); the run stands
- **00:06** C: check mp483k-warmup: run writes ~17.8 GB inside the Ubuntu disk (1449000 records); room 105.3 GB (C: above 15 GB + 87.1 GB ext4.vhdx slack); C: 33.2 GB free, Q: 316.4 GB free, docker vhdx 79.6 GB, ubuntu vhdx 212.98 GB
- **00:06** C: mp483k-warmup keeps ~5.6 GB after csv deletion and zstd (ratio 0.4904)
- **00:08** reset (pre-compaction wipe) network-reset-20261007-160618-3 done, chain height 6, 100392 ms
- **00:08** compaction task start (C: 46.7 GB free, Q: 316.4 GB free, docker vhdx 79.6 GB, ubuntu vhdx 212.98 GB)
- **00:08** compaction done: 2026-10-08T00:08:20 start; vhdx 74.1 GB; Q free 294.6 GB | 2026-10-08T00:08:46 done; vhdx 14.5 GB; Q free 354.3 GB | 2026-10-08T00:08:47 docker relaunched
- **00:09** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-0009.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **00:09** disk check: need 183.9 GB on Q: (records 1449000 x 120 KB + 10 GB); C: 46.7 GB free, Q: 380.4 GB free, docker vhdx 15.6 GB, ubuntu vhdx 212.98 GB
- **00:11** reset (mp483k-warmup) network-reset-20261007-160925-1 done, chain height 6, 90884 ms
- **00:11** preflight mp483k-warmup green: host CPU 8.7 %, load1 1.91, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **00:11** MP-483K ch4 desktop warmup: campaign campaign-20261007-161130-2 started (C: 46.7 GB free, Q: 380.2 GB free, docker vhdx 15.8 GB, ubuntu vhdx 212.98 GB)
- **01:36** controller start (pid 7148)
- **01:36** recovering mp483k-warmup (campaign campaign-20261007-161130-2, run mp-483k-ch4-desktop-warmup-20261007-161133-1)
- **02:01** bringup5 (PT=8h) rc 0: s=1
+ peer channel join -b ./channel-artifacts/saksi.block
+ res=1
[34m2026-10-08 01:51:52.750 PST 0001 INFO[0m [channelCmd] [34;1mInitCmdFactory[0m -> Endorser and orderer connections initialized
Error: proposal failed (err: bad proposal response 500: cannot create ledger from genesis block: ledger [saksi] already exists with state [ACTIVE])
[0;31mAfter 5 attempts, peer0.org1 has failed to join channel 'saksi' [0m

  [31m✗ network bring-up failed. Try: ./tools/up.sh down, then retry.[0m
- **02:01** resume #1 mp-483k-ch4-desktop-warmup-20261007-161133-1 -> 409 this run's ballot window is not interrupted: there is nothing to resume

- **02:01** verify-only mp-483k-ch4-desktop-warmup-20261007-161133-1 -> 202 {'run_id': 'mp-483k-ch4-desktop-warmup-20261007-161133-1'}
- **02:04** verify mp-483k-ch4-desktop-warmup-20261007-161133-1 -> 202 {'run_id': 'mp-483k-ch4-desktop-warmup-20261007-161133-1'}
- **02:21** MP-483K ch4 desktop warmup: campaign campaign-20261007-161130-2 interrupted error=the console stopped while this campaign was running run mp-483k-ch4-desktop-warmup-20261007-161133-1 tps None p99 None failed True no perf.csv resumed True
- **02:21** mp483k-warmup: resources: ballot window: 2026-10-08 00:19:28 to 2026-10-08 01:04:21 | host CPU samples in window: 269, max 93.3 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 269 samples, max 43.9 %, over 25 % (contended): 86 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 444 %, peer0.org1.example.com 408 %, peer0.org2.example.com 176 %
- **02:21** export campaign-20261007-161130-2 -> http 200 rc 0
- **02:23** mp483k-warmup: ledger du: peer0.org1.example.com 17343526802 /var/hyperledger/production | peer0.org2.example.com 17337788674 /var/hyperledger/production | orderer.example.com 14758184721 /var/hyperledger/production/orderer | /dev/sdc       1081101176832 67174232064 958934589440   7% /var/hyperledger/production | 
- **02:23** deleted mp-483k-ch4-desktop-warmup-20261007-161133-1/ballots.csv (5935442026 bytes)
- **02:24** mp-483k-ch4-desktop-warmup-20261007-161133-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-warmup-20261007-161133-1/ballots.ndjson 5713407000 -> 2681705974 ratio 0.4694 sha256 d2c68cdfdaeb68b422e7616d559b14269e39de030095be92394ecaa96e9f86b7 | skip (absent) /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-warmup-20261007-161133-1/ledger/ballots.ndjson | freed 3031701026 bytes
- **02:25** archive to Q:\thesis-archive\runs (mp-483k-ch4-desktop-warmup-20261007-161133-1): 1 files, archived 2681705974 bytes, failures none rc 0 ; C: 47.0 GB free, Q: 214.3 GB free, docker vhdx 179.0 GB, ubuntu vhdx 212.98 GB
- **02:25** push docs/ch4-night1-2026-10-01 -> rc 0 
- **02:25** C: check mp483k-m1: run writes ~17.8 GB inside the Ubuntu disk (1449000 records); room 118.4 GB (C: above 15 GB + 86.4 GB ext4.vhdx slack); C: 47.0 GB free, Q: 214.3 GB free, docker vhdx 179.0 GB, ubuntu vhdx 212.98 GB
- **02:25** C: mp483k-m1 keeps ~5.6 GB after csv deletion and zstd (ratio 0.4904)
- **02:27** reset (pre-compaction wipe) network-reset-20261007-182540-1 done, chain height 6, 104504 ms
- **02:27** compaction task start (C: 47.0 GB free, Q: 214.3 GB free, docker vhdx 179.0 GB, ubuntu vhdx 212.98 GB)
- **02:28** compaction done: 2026-10-08T02:27:42 start; vhdx 166.7 GB; Q free 199.6 GB | 2026-10-08T02:28:18 done; vhdx 14.6 GB; Q free 351.7 GB | 2026-10-08T02:28:18 docker relaunched
- **02:28** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-0228.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **02:28** disk check: need 183.9 GB on Q: (records 1449000 x 120 KB + 10 GB); C: 47.0 GB free, Q: 377.6 GB free, docker vhdx 15.7 GB, ubuntu vhdx 212.98 GB
- **02:30** reset (mp483k-m1) network-reset-20261007-182854-1 done, chain height 6, 85452 ms
- **02:30** preflight mp483k-m1 green: host CPU 6.2 %, load1 1.96, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **02:30** MP-483K ch4 desktop m1: campaign campaign-20261007-183028-2 started (C: 46.9 GB free, Q: 377.3 GB free, docker vhdx 16.0 GB, ubuntu vhdx 212.98 GB)
- **03:48** MP-483K ch4 desktop m1: campaign campaign-20261007-183028-2 done error=None run mp-483k-ch4-desktop-m1-20261007-183031-1 tps 613.272 p99 456.895 failed False  resumed False
- **03:48** mp483k-m1: resources: ballot window: 2026-10-08 02:39:13 to 2026-10-08 03:18:36 | host CPU samples in window: 236, max 86.4 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 236 samples, max 26.4 %, over 25 % (contended): 1 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 465 %, peer0.org1.example.com 411 %, peer0.org2.example.com 159 %
- **03:48** export campaign-20261007-183028-2 -> http 200 rc 0
- **03:51** mp483k-m1: ledger du: peer0.org1.example.com 17318104890 /var/hyperledger/production | peer0.org2.example.com 17319745136 /var/hyperledger/production | orderer.example.com 14699222845 /var/hyperledger/production/orderer | /dev/sdc       1081101176832 67192643584 958916177920   7% /var/hyperledger/production | 
- **03:51** deleted mp-483k-ch4-desktop-m1-20261007-183031-1/ballots.csv (5923850026 bytes)
- **03:55** mp-483k-ch4-desktop-m1-20261007-183031-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-m1-20261007-183031-1/ballots.ndjson 5701815000 -> 2681316694 ratio 0.4703 sha256 f1f3dc0f160f4e06529690278ffbd58fed3feac468072a9030d60e8bfd9402cf | ok /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-m1-20261007-183031-1/ledger/ballots.ndjson 5701815000 -> 2780646981 ratio 0.4877 sha256 7854efd460bd805a517d41a18c4bc63a142c5373416feb7b88a25072ed827528 | freed 5941666325 bytes
- **03:56** archive to Q:\thesis-archive\runs (mp-483k-ch4-desktop-m1-20261007-183031-1): 2 files, archived 5461963675 bytes, failures none rc 0 ; C: 46.7 GB free, Q: 191.9 GB free, docker vhdx 195.9 GB, ubuntu vhdx 212.98 GB
- **03:56** push docs/ch4-night1-2026-10-01 -> rc 0 
- **03:56** mp483k-m1: minor host spike, 1 of 236 samples > 25 % (host minus WSL VM); below the rerun rule (> 2 % and >= 6); the run stands
- **03:56** C: check mp483k-m2: run writes ~17.8 GB inside the Ubuntu disk (1449000 records); room 117.2 GB (C: above 15 GB + 85.6 GB ext4.vhdx slack); C: 46.7 GB free, Q: 191.9 GB free, docker vhdx 195.9 GB, ubuntu vhdx 212.98 GB
- **03:56** C: mp483k-m2 keeps ~5.6 GB after csv deletion and zstd (ratio 0.4904)
- **03:59** reset (pre-compaction wipe) network-reset-20261007-195705-3 done, chain height 6, 98953 ms
- **03:59** compaction task start (C: 46.7 GB free, Q: 191.9 GB free, docker vhdx 195.9 GB, ubuntu vhdx 212.98 GB)
- **04:00** compaction done: 2026-10-08T03:59:08 start; vhdx 182.5 GB; Q free 178.7 GB | 2026-10-08T03:59:39 done; vhdx 14.8 GB; Q free 346.4 GB | 2026-10-08T03:59:39 docker relaunched
- **04:00** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-0400.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **04:00** disk check: need 183.9 GB on Q: (records 1449000 x 120 KB + 10 GB); C: 46.7 GB free, Q: 371.9 GB free, docker vhdx 15.9 GB, ubuntu vhdx 212.98 GB
- **04:01** reset (mp483k-m2) network-reset-20261007-200014-1 done, chain height 6, 82795 ms
- **04:01** preflight mp483k-m2 green: host CPU 4.2 %, load1 1.39, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **04:01** MP-483K ch4 desktop m2: campaign campaign-20261007-200149-2 started (C: 46.7 GB free, Q: 371.7 GB free, docker vhdx 16.1 GB, ubuntu vhdx 212.98 GB)
- **05:18** MP-483K ch4 desktop m2: campaign campaign-20261007-200149-2 done error=None run mp-483k-ch4-desktop-m2-20261007-200152-1 tps 636.236 p99 421.419 failed False  resumed False
- **05:18** mp483k-m2: resources: ballot window: 2026-10-08 04:09:12 to 2026-10-08 04:47:09 | host CPU samples in window: 228, max 81.3 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 228 samples, max 8.0 %, over 25 % (contended): 0 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 464 %, peer0.org1.example.com 408 %, peer0.org2.example.com 196 %
- **05:18** export campaign-20261007-200149-2 -> http 200 rc 0
- **05:21** mp483k-m2: ledger du: peer0.org1.example.com 17318244014 /var/hyperledger/production | peer0.org2.example.com 17319807964 /var/hyperledger/production | orderer.example.com 14699220218 /var/hyperledger/production/orderer | /dev/sdc       1081101176832 67326902272 958781919232   7% /var/hyperledger/production | 
- **05:21** deleted mp-483k-ch4-desktop-m2-20261007-200152-1/ballots.csv (5923850026 bytes)
- **05:27** mp-483k-ch4-desktop-m2-20261007-200152-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-m2-20261007-200152-1/ballots.ndjson 5701815000 -> 2681284430 ratio 0.4703 sha256 dbed5e1ca4b0589a32b88364859a51fb37b120e624f560ec0d4fe2807a26b0ad | ok /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-m2-20261007-200152-1/ledger/ballots.ndjson 5701815000 -> 2780625665 ratio 0.4877 sha256 c9ff073734cdf0050fe958b21838a85416840308ce08317bf31bf64fce136f11 | freed 5941719905 bytes
- **05:29** archive to Q:\thesis-archive\runs (mp-483k-ch4-desktop-m2-20261007-200152-1): 2 files, archived 5461910095 bytes, failures none rc 0 ; C: 42.4 GB free, Q: 214.5 GB free, docker vhdx 167.8 GB, ubuntu vhdx 212.98 GB
- **05:29** push docs/ch4-night1-2026-10-01 -> rc 0 
- **05:29** C: check mp483k-m3: run writes ~17.8 GB inside the Ubuntu disk (1449000 records); room 112.1 GB (C: above 15 GB + 84.7 GB ext4.vhdx slack); C: 42.4 GB free, Q: 214.5 GB free, docker vhdx 167.8 GB, ubuntu vhdx 212.98 GB
- **05:29** C: mp483k-m3 keeps ~5.6 GB after csv deletion and zstd (ratio 0.4904)
- **05:30** reset (pre-compaction wipe) network-reset-20261007-212929-3 done, chain height 6, 87826 ms
- **05:30** compaction task start (C: 42.4 GB free, Q: 214.5 GB free, docker vhdx 167.8 GB, ubuntu vhdx 212.98 GB)
- **05:31** compaction done: 2026-10-08T05:31:00 start; vhdx 156.3 GB; Q free 199.8 GB | 2026-10-08T05:31:25 done; vhdx 14.9 GB; Q free 341.2 GB | 2026-10-08T05:31:25 docker relaunched
- **05:31** bringup5 (PT=8h) rc 0: powershell.exe
LOG /home/user/saksi-logs/up-night2-0531.log
  runs     /home/user/.saksi/campaign/runs

  [2mCtrl-C stops the console and leaves the network up.[0m
  [2mRun "./tools/up.sh down" to stop Fabric too.[0m

Research Election Console
  serving   http://127.0.0.1:8090
  runs      /home/user/.saksi/campaign/runs
  phase timeout 8h0m0s
  saksi-demo /home/user/Code/saksi/target/release/saksi-demo
  auth      off (no --auth-file)
  on-chain  fabric gateway localhost:7051 (channel saksi)
- **05:31** disk check: need 183.9 GB on Q: (records 1449000 x 120 KB + 10 GB); C: 42.4 GB free, Q: 366.3 GB free, docker vhdx 16.0 GB, ubuntu vhdx 212.98 GB
- **05:33** reset (mp483k-m3) network-reset-20261007-213150-1 done, chain height 6, 82731 ms
- **05:33** preflight mp483k-m3 green: host CPU 2.7 %, load1 1.02, phase_timeout {'seconds': 28800, 'longest_phase': 'ballot submission', 'estimated_s': 1796.76}, no warnings
- **05:33** MP-483K ch4 desktop m3: campaign campaign-20261007-213324-2 started (C: 42.4 GB free, Q: 366.1 GB free, docker vhdx 16.3 GB, ubuntu vhdx 212.98 GB)
- **06:46** MP-483K ch4 desktop m3: campaign campaign-20261007-213324-2 done error=None run mp-483k-ch4-desktop-m3-20261007-213328-1 tps 635.967 p99 396.534 failed False  resumed False
- **06:46** mp483k-m3: resources: ballot window: 2026-10-08 05:41:43 to 2026-10-08 06:20:08 | host CPU samples in window: 229, max 82.0 % (includes the WSL VM) | host CPU minus the WSL VM (vmmemWSL / CPUs): 229 samples, max 10.1 %, over 25 % (contended): 0 | top container CPU peaks in window: dev-peer0.org1.example.com-saksi-bulletin_1.0-ee3fe73bad456e43adfc5ba27d9e5a60983b69e8496140308fb21061ecb2ff85 515 %, peer0.org1.example.com 389 %, peer0.org2.example.com 178 %
- **06:46** export campaign-20261007-213324-2 -> http 200 rc 0
- **06:47** mp483k-m3: ledger du: peer0.org1.example.com 17330366120 /var/hyperledger/production | peer0.org2.example.com 17331876478 /var/hyperledger/production | orderer.example.com 14711523909 /var/hyperledger/production/orderer | /dev/sdd       1081101176832 67497963520 958610857984   7% /var/hyperledger/production | 
- **06:47** deleted mp-483k-ch4-desktop-m3-20261007-213328-1/ballots.csv (5923850026 bytes)
- **06:53** mp-483k-ch4-desktop-m3-20261007-213328-1: ndjson stored zstd-compressed (sha256 sidecars): ok /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-m3-20261007-213328-1/ballots.ndjson 5701815000 -> 2681268415 ratio 0.4702 sha256 19fb4799a53b80083ab5b87736a2e50c3dd3fcd129ba8f5d306b1816abb3a494 | ok /home/user/.saksi/campaign/runs/mp-483k-ch4-desktop-m3-20261007-213328-1/ledger/ballots.ndjson 5701815000 -> 2780620745 ratio 0.4877 sha256 83529308bfcb4f8af1e1325bd62b43b108718200ee9ed01b1b302a273168f5bb | freed 5941740840 bytes
- **06:54** archive to Q:\thesis-archive\runs (mp-483k-ch4-desktop-m3-20261007-213328-1): 2 files, archived 5461889160 bytes, failures none rc 0 ; C: 42.3 GB free, Q: 209.4 GB free, docker vhdx 167.5 GB, ubuntu vhdx 212.98 GB
- **06:54** push docs/ch4-night1-2026-10-01 -> rc 0 
- **06:54** queue complete: [{"label": "sp483k-fresh", "run": "sp-483k-ch4-fresh-20261007-153309-1", "tps": 583.315, "p99": 489.759, "hot_samples": 1, "resumed": false}, {"label": "mp483k-warmup", "run": "mp-483k-ch4-desktop-warmup-20261007-161133-1", "tps": null, "p99": null, "hot_samples": 86, "resumed": true}, {"label": "mp483k-m1", "run": "mp-483k-ch4-desktop-m1-20261007-183031-1", "tps": 613.272, "p99": 456.895, "hot_samples": 1, "resumed": false}, {"label": "mp483k-m2", "run": "mp-483k-ch4-desktop-m2-20261007-200152-1", "tps": 636.236, "p99": 421.419, "hot_samples": 0, "resumed": false}, {"label": "mp483k-m3", "run": "mp-483k-ch4-desktop-m3-20261007-213328-1", "tps": 635.967, "p99": 396.534, "hot_samples": 0, "resumed": false}]
