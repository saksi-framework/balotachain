# Chapter IV: the remaining runs and the chapter itself

Decided 2026-10-01. Evidence gap list: `.superpowers/sdd/2026-09-14-study-grade-wizard/ch4-gap.md`.
Every run below is on saksi `4a38a54`, the one study build: no rebuild, no code change.
Rows 2–4, the SP-10K security run and T3 are done (PR #66).

## Decisions
- **Night 1 run set** (~9.3 h). Nights 2–3 cover the rest.
- **Paper follows the runbook.** Repetition counts and the offline-only MP big tiers are an amendment to the paper, with the reason stated.
- **Chapter IV format:** a `.docx` in `docs/paper/`, in the style of Chapters I–III (Table 4.x numbering, figures as images). Pending runs are marked in place and filled in as they land.
- **The 9–28 % slowdown A/B stays deferred** until the user says so.

## Night 1 (tonight), strictly one run at a time
Tags `ch4-cand` for the candidate-count check, `ch4` for everything else. Each tier: network reset, preflight green (host CPU < 25 %), campaign or single run, export.

1. **Candidate-count check.** MP-1K at 10 and at 28 candidates per position, 2 warm-ups + 5 measured each, plus the existing MP-1K at 4 candidates. Compare the per-record timings (`perf.csv`) against the candidate count.
2. **MP-1K security run.** All stages, all nine scenarios. Closes T7 and per-position enforcement live.
3. **Row 5: SP-483K**, 1 warm-up + 3 measured, then the rate sweep and the peak burst.
   - Send rate, factor and step window follow runbook §10.4, so the top step exceeds the network's throughput and the sweep reaches a plateau (`plateau_tps`).
   - Burst size per runbook T8.
4. **Row 6: SP-1M**, 1 + 3.
5. **Row 7a: SP-1.92M**, 1 + 1 (capstone 1). Check the disk row first.

After each run:
- `du` the peer volume, to get the ledger size (disk consumption).
- Keep peer and orderer logs: `docker logs` to a file per run.

## Night 2
- **Row 7b: SP-3.5M**, 1 + 1 (capstone 2, ~5.4 h).
- **Row 8: the four offline MP tiers**, 0 + 1 each (~11 h). No network reset.

## Night 3
- **Row 9: MP-3.5M on-chain**, 0 + 1.
  - The console is restarted with `SAKSI_PHASE_TIMEOUT=10h`: the window is ~5.1 h at 570 TPS.
  - Check disk first: the ledger is ~127 GB.

## Small items (daytime, ~1.5 h)
- The verifier run on a separate machine from a copied public record (RQ1e).
- A CI/SAST and test-suite log at `4a38a54`.
- The privacy linkage join over a tier export (anonymity set = N).

## Chapter IV (after night 1; updated after nights 2–3)
Structure, following the paper's three RQs and Table 3.7:
- 4.1 Test tiers and environment: ladder, test suites, Table 3.12 as run.
- 4.2 RQ1 Correctness, criteria (a)–(f): E, rejection, duplicates, inclusion, independent verification, proofs. Appendix C accuracy form.
- 4.3 RQ2 Integrity, privacy and security:
  - the scenario table (Table 3.8 "Actual result");
  - adversary classes;
  - the 14 negative tests;
  - privacy (unlinkability, aggregate-only decryption, sub-threshold);
  - Table 3.10 legal mapping;
  - election-return approval;
  - audit trail;
  - limits.
- 4.4 RQ3 Performance:
  - latency p50/p95/p99 and throughput per tier;
  - scalability chart;
  - saturation (sweep) and burst;
  - stage timers;
  - threshold-decryption time;
  - resource consumption (CPU, memory, disk; network stated as a limit);
  - the candidate-count check;
  - arrival-rate margin in place of the `scaling_limit` flag;
  - the cost model and capstones;
  - comparison with [18], [24] and [26].
- 4.4b **Predicted vs measured** (requested by the user, 2026-10-01): one table per tier comparing what the linear models predicted with what the runs measured. Compute every value from the run files.
  - **Wall time per run:** the runbook / `cost-model.md` "Predicted h" (fitted at `ef663d1`) against the measured campaign duration.
  - **Throughput:** the ~1000 TPS the old fit assumed against the measured committed TPS (falls with scale).
  - **Disk:** the planning estimate of 12 KB per record (preflight), then 36 KB (ledger ×3), against the measured host growth of ~95 KB per record (VHDX growth after compaction, LevelDB rewrites).
  - **Candidate count:** the linear prediction against measured per-record times (R² ≥ 0.9999).
  - **Arrival-rate margin:** the predicted margin against the measured one per tier.

  Discuss where linear held (per-record crypto cost, records) and where it did not (TPS against ledger size, disk against records). This is evidence for the paper's "linear cost model" claim and its limits.
- 4.5 Instrument findings:
  - throughput falls with scale;
  - the contention rule counts self-load;
  - in-network stalls;
  - the build difference against the older fit.
- 4.6 Summary of findings against the objectives.

Every number is cited to its run file. Chapter III amendments that fall out go into the paper-changes doc:
- repetition counts and Table 3.5;
- the ElectionGuard overclaim;
- reference numbering defects;
- the CLAIMS throughput line.

## Adviser requirements (W2/W3, received 2026-10-01 14:40). These override earlier choices.
- **Capstones (SP-1.92M, SP-3.5M):** 1 discarded warm-up + 3 measured. Every run is labelled in its election name (`SP-1.92M ch4 warmup`, `SP-1.92M ch4 m1..m3`).
  - Disk: one rep costs ~95 KB of host disk per record on one network (1.92M ≈ 182 GB, 3.5M ≈ 333 GB). So **each rep runs as its own single-rep campaign on a freshly reset network, with the Docker VHDX compacted before it.**
  - Compaction runs through a one-time elevated scheduled task (`schtasks /RL HIGHEST`, created with one UAC click), so it needs no prompt overnight.
- **Other tiers keep their full count.** SP-1M ran 0 + 3: the warm-up was dropped by the user earlier. Flag it in the report.
- **Bottleneck evidence during capstones.** An external sampler runs throughout every capstone run, every 10 s:
  - `docker stats` CPU and memory per container;
  - container block I/O;
  - host memory (`/proc/meminfo` + Windows available memory);
  - host disk free on C:/Q: and the VHDX sizes;
  - Windows disk counters (% busy, queue length).
  - Output: `~/ch4/capstone/<run>/resources.csv`. It touches no measured code path.
  - Failures are attributed from that evidence: a hardware limit or a software defect, whichever it shows.
- **Validation-gate timing** (the seven-check, fail-closed data check before any cryptography): timed as its own stage per tier (1K → 3.5M, SP and MP). Run it as a standalone groundtruth-mode pass between measured runs, never during one. Report a table per tier.
- **After the runs, on a separate saksi branch, not merged during the campaign:**
  - the `/wizard` ceremony must show decryption visibly refused, with the reason, at 2 of 5 trustees, before the third unlocks it;
  - the adversary-coverage report;
  - the Appendix A ground-truth numbers.

## After everything else: one evening of extra checks (user decision 2026-10-02)
Run these on the study build, after SP-3.5M and the offline tiers, before merging PR #57.
1. **Controlled crash recovery (a stronger T3).**
   - At SP-50K, kill the Fabric containers (`docker kill` orderer and peers) mid-ballot-window at 3 random points, one trial each.
   - Each trial: restart the same containers (no reset), resume, verify-only, trustees and publish, verify.
   - Pass: E = 0, the ledger is consistent across peers, the chain walk passes.
   - In one trial, deliberately resubmit a sample of already-committed ballots during recovery. Pass: the nullifier gate rejects each one (`gate=nullifier`) and the tally is unchanged.
   - Needs a small driver step that replays N committed ballots from ballots.ndjson through the submit path. Build it in the run tooling, not in saksi.
   - Report as a controlled T3 result, with the duplicate-protection claim included.
2. **T6 on the study build:** a corrupted partial decryption submitted on-chain on 4a38a54. Record whether the chaincode commits it (shape check only) and whether the verifier catches it (`decryption.cp_proof`). Replaces the 7272837 history citation.
3. **SP-483K on a fresh network:** one measured run on a freshly reset and compacted network, to test whether throughput is driven by ledger build-up rather than voter count. Earlier SP-483K ran 509 TPS on an accumulating network; SP-1.92M ran 633–637 TPS on fresh ones.

4. **Reordering detection (parked, user decision 2026-10-03).**
   - Wire `ledger::ledger_digest` into the auditor as a real check: compare the order of the chain read-back (the ledger dump) with the order of the served stream. It has been test-only since PR #45, so reordering is currently "not detected".
   - Build it on its own saksi branch and merge it after the campaign.
   - Re-verify the archived runs (compressed ledger dumps in `Q:\thesis-archive`) with the new auditor, so no chain re-runs are needed.
   - Paper effect: reordering goes from SKIPPED to detected, for re-verified runs only.

Chapter IV wording for the unplanned cut, kept regardless:
> An unplanned host power loss interrupted one capstone repetition after 881,628 ballots. On restart the ledger was consistent across peers, the remaining ballots were submitted, and the completed election passed independent verification with E = 0, demonstrating recovery from a host-level crash at 1,921,917 voters. The recovery procedure belongs to the evaluation tooling; the properties shown are ledger durability and end-to-end verifiability of the recovered record.

## Power-cut policy (user decision, 2026-10-01)
- **Capstones (SP-1.92M, SP-3.5M) and any single long run: resume, do not redo.**
  1. Bring Docker/WSL back.
  2. `docker start` the existing orderer and peers. NO network reset: the ledger survives in the volumes.
  3. Restart the console.
  4. Then follow the phase that was cut:
     - **Generate:** rerun generate.
     - **Ballot window:** `POST /api/runs/<id>/resume`, then verify-only, then the trustees and publish, then verify, as T3 did.
     - **Verify:** rerun verify-only.
  - Report throughput from the uninterrupted segments only (journal `segment.*`; downtime excluded), flag the run as `resumed`, and state it in the tier note and in Chapter IV.
- **Multi-rep tiers (≤ 1M):** an interrupted rep is discarded and rerun from its reset, which is cheap relative to the tier.
- If the ledger volume is corrupt after the cut (peers fail to start, or the chain walk fails): only then reset and redo.

## Hard rules for the run agent
- No saksi or balotachain source changes.
- Never `wsl --shutdown`, never `up.sh down`, never kill the console.
- Relaunch Docker Desktop once after a crash and redo the interrupted run; a second crash means stop.
- A contended flag from guest load alone does not force a rerun; a host CPU sample above 25 % during the ballot window does, once.
- Log every step to `.superpowers/sdd/2026-09-14-study-grade-wizard/ch4-study-log.md` (append, section "Night 1, 2026-10-01").
