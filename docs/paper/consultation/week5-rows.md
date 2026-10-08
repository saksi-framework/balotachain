# Thesis Consultation Record, Week 5: row text

Text for `docs/weekly-reports/Thesis_Consultation_Record_Week5.docx` (main checkout). The record has three bands with
four, three and three rows; the tables below keep that numbering (1 to 10). The Comments and Suggestions column is
left for the adviser. Row 8 is already filled in the record and is reproduced unchanged.

Written 2026-10-02 from the run artifacts on balotachain branch `docs/ch4-night1-2026-10-01` (pushed to `f8f5c34`
before this commit), the study log and the capstone controller's log and state. Every study run named here ran on
saksi and console `4a38a54fe0223b58f28c53ec54e47fbeab222837` (`run.json` `git_head_saksi`, all 49 exported runs of
2026-10-01). Sources per row are in the evidence list at the end.

## CAPSTONE EXECUTION

| No. | Ref. | What Was Done |
|---|---|---|
| 1 | Run | The first capstone tier had to be executed under the protocol fixed for the capstones, one discarded warm-up and three measured repetitions, with resource evidence able to attribute any failure. The single-position tier of 1,921,917 voters was completed on Saksi commit 4a38a54 between 16:29 on 1 October and 00:00 on 2 October 2026: one warm-up and three measured repetitions, each a separate election on a freshly reset network. All four elections committed all 1,921,917 ballots with none dropped, the independent verifier returned an overall pass with no failed check, the tally error E was 0 on every contest in both the local and the ledger audit, and the ledger matched the local record. The warm-up sustained 632.0 committed transactions per second. Measured repetitions 2 and 3 sustained 633.3 and 637.1 transactions per second, with p99 latency of 460 and 430 ms, ballot windows of 3,035 and 3,017 s, and whole runs of 1.62 and 1.60 hours. Repetition 1 was cut by a loss of power at 19:07 after 881,628 ballots had committed. It was resumed on the surviving ledger without a reset, committed the remaining 1,040,289 ballots at 505.5 per second with none dropped or replayed, and passed verification with E = 0; it is reported as a correctness record, and its throughput is excluded. Each election left 22.8 GB of ledger on each peer and 19.1 GB on the orderer, about 11.9 KB per ballot record per peer. A resource trace was recorded every 10 seconds for every run (W2 #6). In the ballot windows the busiest peer peaked at 400 to 416 percent of one core, apart from one isolated sample of 1,506 percent in repetition 1 at 19:02, and the orderer at 85 to 119 percent of the 1,600 percent available, the guest's load average stayed near its 16 processors (mean 15.4 to 16.9), its available memory never fell below 21.6 GB, and Windows' available memory fell to between 40 and 594 MB. The power loss was logged as Kernel-Power Event 41 with no bugcheck and no power-button press, the second that day and one of ten such events since 24 September. The trace shows no exhausted resource and the system logs no error before the cut, so it is attributed to the host's power supply, which is suspected and scheduled for replacement, and not to the system under test. |
| 2 | Run | The full ZAMBASULTA single-position tier of 3,524,078 voters was not started. It is scheduled for the weekend, after the power supply is replaced, under the same protocol of one warm-up and three measured repetitions on a freshly reset network each. Its preparatory evidence is in place: the validation gate passed all seven checks on the full 3,524,078-voter population in a median of 0.800 s, and the disk rule of the capstone controller requires 396 GB free on the host data drive per repetition, against 435.4 to 435.6 GB measured free after each compaction on 1 October. |
| 3 | Run | The multi-position tier of 1,921,917 voters (5,765,751 ballot records) was not started. It is planned as one offline run, through generation and verification without the blockchain, as part of the four offline multi-position tiers (run-table row 8). The on-chain multi-position runs at 483,000 to 1,921,917 voters listed in Table 3.5 are not attempted, a departure recorded as a manuscript amendment. The validation gate passed all seven checks on this population in a median of 0.558 s. |
| 4 | Run | The multi-position tier of 3,524,078 voters (10,572,234 ballot records) was not started offline and was not attempted on-chain. The offline run is planned with the other row 8 tiers. The on-chain run was not attempted because its disk requirement exceeds the machine: the single-position capstone measured 11.9 KB of ledger per ballot record on each peer, 33.7 KB across the two peers and the orderer, and 98 to 119 KB of host-disk growth per record in the Docker virtual disk. At 10,572,234 records that is about 356 GB of ledger and more than 1 TB of host disk, against a 931 GB data drive and the 150 GB provisioned in Table 3.12. These figures are measured per-record costs from single-position runs, not a result for this tier. The validation gate passed all seven checks on this population in a median of 0.848 s. |

## CHANGES TO THE EVALUATION RUN

| No. | Ref. | What Was Done |
|---|---|---|
| 5 | Code side | A failed capstone must be attributed to a measured bottleneck, and the console's two host samples per repetition could not show which resource was exhausted at a given moment. An external sampler was added to the capstone controller, outside every measured code path. Every 10 seconds it records per container the processor, memory and block input and output; the guest's memory and load; Windows processor time, available memory, and per-disk busy time and queue length; the free space on both host drives; and the size of both virtual disks. The output is one resource file per run, summarized over the ballot window after the run. The contention rule was corrected twice. Before the night runs, the guest load average was excluded, because at 10,000 voters and above it measures the run's own generation and audit. During the capstone, Windows' total processor time was found to include the virtual machine running the election itself, so every sample of an unloaded run read above 25 percent and repetition 2 was queued for a needless rerun. The rule now subtracts the virtual machine's processor time before applying the 25 percent threshold, with a self-test. Repetition 2 was kept, and repetition 3 recorded no contended sample (maximum 23.3 percent). Repetition 1 keeps its contended flag: the user was working at the machine, and its samples predate the new counter. |
| 6 | Code side | The capstone protocol could not run as a single campaign on the available disk. Docker's virtual disk grew by about 95 to 101 KB of host disk per ballot record, three times the ledger it holds, and a network reset does not shrink it. In the first night the host drive filled during the one-million-voter tier, and two of its three repetitions failed. Each capstone repetition was therefore run as its own single-repetition campaign on a freshly reset network, preceded by a disk check that requires the record count times 101 KB plus 40 GB free. When the check fell short, the controller wiped the ledger and compacted the virtual disk through a scheduled task approved once in advance, so no prompt was needed during the night. The two compactions on 1 October brought the virtual disk from 232.3 and 242.7 GB down to 13.2 and 13.3 GB. Every run was labelled in its election name (SP-1.92M ch4 warmup, m1, m2, m3), so that each stored record identifies its repetition. The validation-gate timing pass was placed between the warm-up and repetition 1, on an idle network, so that it never ran inside a measured window. |
| 7 | Code side | Two power losses on 1 October showed that a capstone can be cut hours into its ballot window, and that rerunning from a reset would discard valid work. A resume policy was adopted for the capstones. The containers are restarted on the surviving ledger without a reset, and the ledger is checked: both peers at the same height and block hash, and the chain walk linked. The run is then resumed for only the ballots the chain lacks and verified as normal. Throughput is reported per uninterrupted segment, and the run is flagged as resumed. Tiers of one million voters and below discard and rerun an interrupted repetition instead. The policy was applied once, to capstone repetition 1. The records were also made to fit the disk while staying complete. After its export, each run's 4.06 GB plain ballot table was deleted, and the ballot stream it duplicates was kept. Before the second night this freed 65.47 GB across 507 run folders, and a further 19.93 GB came from ballot streams of builds older than the study build. Peer and orderer logs are kept on the machine. Every run's export, note, resource trace and ledger size were committed to two evidence branches, both pushed, and the run tooling was committed alongside them. |

## FOLLOW-UP ON WEEK 3 CONSULTATION COMMENTS

| No. | Ref. | What Was Done |
|---|---|---|
| 8 | Paper side (Ch. III) | The validation gate was mentioned without its design or its cost. It is now described as fail-closed with seven checks and stream processing, and its running time is reported as a stage separate from the cryptographic workload. |
| 9 | Code side | Hiding the tally and disabling publication below the quorum showed a locked control, not the system refusing a decryption, which is what the Week 3 comment asked to be highlighted. Below the threshold the ceremony control now reads "Attempt decryption" and remains active. Pressing it sends the real publication request, which the server refuses. The refusal is shown in a persistent panel recording the time, the share count and the threshold of each attempt: "Decryption refused: 2 of 5 shares recorded, the threshold is 3. The tally cannot be decrypted until a third trustee submits." On an on-chain election the panel adds that nothing was sent to the ledger and that the chaincode refuses a sub-threshold tally as well. After the third share the control becomes "Publish tally" and publication proceeds. The server already refused such a request; its refusal message was unified into one shared text. Two tests were added: one confirms that a publication at two of five shares is refused with the reason and nothing is published, and one checks the page. The trustee-ceremony guide and the runbook were updated. The work is commit 1181015 on Saksi branch feat/wizard-subthreshold-refusal, in draft pull request #57. It merges only after the capstone campaign, so that every study run stays on commit 4a38a54, and it has not yet been shown live on the study build. |
| 10 | Code side | The validation time had to be measured apart from the cryptographic workload, as the Week 3 comment advised. The seven-check gate was run alone, three times per tier, on plaintext ground-truth populations at all fourteen tiers from 1,000 to 3,524,078 voters in both configurations, between capstone runs on an idle network. Every check passed at every tier. The median time rose from 0.055 s at 1,000 voters to 0.208 s at 1,000,000, 0.481 s at 1,921,917 and 0.800 s at 3,524,078 in the single-position configuration. In the multi-position configuration it rose from 0.004 s at 1,000 voters to 0.309 s at 1,000,000 and 0.848 s at 3,524,078 voters, or 10,572,234 ballot records. For comparison, one single-position repetition at 1,921,917 voters spent about 2,991 s of processor time on proof generation and 325 s on proof verification. Inside the cryptographic runs, the same check stage took between 0.30 and 2.53 s at 1,921,917 voters and between 0.07 and 28.9 s at 483,000. That spread was recorded but its cause was not investigated. |

## Evidence

Paths are relative to the balotachain repository. "n2" is branch `docs/ch4-night1-2026-10-01` (pushed); "study log"
is `.superpowers/sdd/2026-09-14-study-grade-wizard/ch4-study-log.md` (main checkout, untracked). Capstone runs are
under `docs/desktop-runs/2026-10-01-sp-1.92m/<label>/` on n2.

**Row 1.**
- Warm-up `sp-1-92m-ch4-warmup-20261001-082942-1`, campaign `campaign-20261001-082938-2`: `warmup/NOTE.md`,
  `summary.csv`, `ledger-size.txt`, `resources.csv`, `resources-summary.txt`; commit `475bdfb`.
- m1 `sp-1-92m-ch4-m1-20261001-102400-16`, campaign `campaign-20261001-102357-4`: `m1/NOTE.md`, `m1/RESUMED.md`
  (segments, Event 41 detail, recovery steps), `correctness.csv`, `journal.ndjson` (`stage.verify.end` overall pass;
  `run.end` `resumed: true`, `failed: true`, reason `nothing_submitted`), `resources.csv` (rows 19:06:49 to 19:07:09
  before the cut); commits `3b87854`, `1640390`.
- m2 `sp-1-92m-ch4-m2-20261001-123444-1`, campaign `campaign-20261001-123440-2`: `m2/summary.csv` (committed_tps
  633.278, p99 460.389, submit_window_ms 3,034,872), `m2/NOTE.md` (contention correction); commits `4f4a0d9`,
  `b5d2095`.
- m3 `sp-1-92m-ch4-m3-20261001-142140-1`, campaign `campaign-20261001-142136-2`: `m3/summary.csv` (637.125, p99
  430.245, 3,016,548 ms), `m3/NOTE.md`; commit `f8f5c34`.
- Run hours: first to last journal timestamp (m2 12:34:44Z to 14:12:02Z, 1.62 h; m3 14:21:40Z to 15:57:35Z, 1.60 h).
- Ledger: `ledger-size.txt` per run (peer0.org1 22,823,819,846 to 22,903,711,701 B; orderer 19,054,649,272 to
  19,184,885,715 B).
- Resource figures: `resources-summary.txt` per run (peer0.org1 window peak 400.2 / 404.1 / 416.2 %, orderer 94.5 /
  85.0 / 103.8 % for warm-up, m2, m3; m1 orderer 118.7 %, peer0.org1 400.0 % except one sample of 1,506.1 % at
  19:02:29 in `m1/resources.csv`; wsl.load1 window mean 16.9 / 15.6 / 15.4; Windows available memory minimum 40 /
  594 / 461 MB, m1 227 MB; WSL MemAvailable minimum 21,603,028 kB, m1).
- Power events: Windows System log, Kernel-Power Event 41, queried 2026-10-02. Ten events with BugcheckCode 0 since
  2026-09-24: 09-24 00:39, 09-25 20:32, 09-28 19:18 and 19:22, 09-29 19:13 and 21:31, 09-30 08:59 and 18:15,
  10-01 15:57 and 19:07.
- Study log, section "Capstones, 2026-10-01", entries 15:57 to 00:00; controller log
  `C:\Users\User\ch4-capstone\controller.log` and `state.json` (final queue record at 00:00).

**Row 2.** Gate run `sp-3-5m-ch4-gate-20261001-101929-8` (`2026-10-01-sp-1.92m/validation-gate-timing.md`, commit
`f9aa09b`). Disk rule: `docs/desktop-runs/tools/controller.py` `ensure_room()` (`PER_RECORD` 101e3 B, `MARGIN` 40 GB):
3,524,078 x 101 KB + 40 GB = 396 GB. Q: free after compaction: study log 20:34, 22:20, 22:21 (435.6, 435.6, 435.4 GB).
Scope decision (SP-3.5M to the weekend after the PSU): study log 15:57.

**Row 3.** Gate run `mp-1-92m-ch4-gate-20261001-102013-14` (commit `f9aa09b`). Row 8 plan and the Table 3.5 departure:
`docs/plans/2026-10-01-ch4-runs-and-chapter.md` (main, untracked), "Night 2" and "Decisions".

**Row 4.** Gate run `mp-3-5m-ch4-gate-20261001-102020-15`. Per-record ledger: m3 `ledger-size.txt` (22,823,819,846 +
22,825,060,222 + 19,054,649,272 B over 1,921,917 records = 33.7 KB). Host growth per record: `NOTE.md` "Disk after"
against the controller's start lines in the study log (warm-up 14.2 to 203.2 GB, 98.3 KB; m2 14.4 to 242.7 GB, 118.8
KB; m3 14.5 to 226.5 GB, 110.3 KB). Q: drive size: study log 08:00 (Night 1, "0 GB free of 931"). Table 3.12 figure:
manuscript, p. 62.

**Row 5.** `docs/desktop-runs/tools/controller.py`: class `Sampler` (10 s, `typeperf` counters including
`\Process(vmmem*)\% Processor Time`), `resources_summary()` (VM-corrected count), `selftest`. Correction: study log
22:20; `m2/NOTE.md` "Contention (corrected 22:20)" (commit `b5d2095`); m3 `NOTE.md` (0 contended, max 23.3 %). Guest
load exclusion: study log, Night 1 preamble ("Contention rule tonight"). Brave limiter used during the capstone
(user's browser kept on 2 of 16 logical processors): `docs/desktop-runs/tools/brave-limit.ps1`.

**Row 6.** Disk failure of Night 1: study log 07:50 to 08:05; `docs/desktop-runs/2026-10-01-night1.md` section 0;
`docs/desktop-runs/2026-10-01-sp-1m-night1.md`. Per-record host growth: study log 13:32 (95 KB) and 14:48 (101 KB).
Single-rep campaigns, disk check and compaction: `controller.py` `QUEUE`, `ensure_room()`, `compact()`;
`docs/desktop-runs/tools/saksi-compact.ps1` (scheduled task `SaksiCompactDocker`); compactions in the study log 20:32
and 22:17. Labels: `controller.py` `label_name()`; `run.json` `config.name` of each run. Gate pass between warm-up and
m1: study log 18:18 to 18:21.

**Row 7.** Policy: `docs/plans/2026-10-01-ch4-runs-and-chapter.md` "Power-cut policy"; application: `m1/RESUMED.md`,
`controller.py` `recover()`, study log 19:07 to 20:28. Archiving: `docs/desktop-runs/tools/step0.sh` and study log
11:49 (65.47 GB, 507 folders; 19.93 GB, 292 folders); `controller.py` `finish()` (ballots.csv deleted after export);
`docs/desktop-runs/tools/night2.py` (same rule for SP-1M). Branches: `docs/ch4-study-2026-09-30` (`8739722`, PR #66)
and `docs/ch4-night1-2026-10-01` (`f2d8921` to `f8f5c34`). Tooling: `docs/desktop-runs/tools/` (this commit).

**Row 9.** Requirement: `docs/plans/2026-10-01-ch4-runs-and-chapter.md`, "Adviser requirements", last item. Saksi
commit `1181015` ("feat(wizard): show the server refusing decryption below the threshold"), a descendant of `4a38a54`
on branch `feat/wizard-subthreshold-refusal`; draft PR https://github.com/saksi-framework/saksi/pull/57 (open, not
merged; checked 2026-10-02). Tests `TestPublishAtTwoOfFiveIsRefusedWithReason` and
`TestWizardCeremonyShowsSubthresholdRefusal`; gofmt and vet clean, `go test ./...` passing in
`packages/saksi-campaign` (as reported by the implementing agent; not re-run here). Chaincode refusal:
`TestPublishTallyRejectsBelowThreshold`. Docs: `docs/wizard/5-trustees.md`, runbook `/ceremony/publish` row. Status:
implemented on a branch, demonstrated in tests, not merged and not shown live on the study build.

**Row 10.** `docs/desktop-runs/2026-10-01-sp-1.92m/validation-gate-timing.md` and `.json` (commit `f9aa09b`), produced
by `controller.py` `gate()`: `GET /api/check/<run>` three times per tier, seconds from the journal's
`stage.check.end` `mono_ms`, 7 checks per pass. Crypto-stage figures: m3 and m2 `summary.csv` (`proof_gen_cpu_ms`
2,998,106 and 2,990,880; `proof_verify_inproc_ms` 324,904 and 325,294). In-run check stage: `stage.check.end`
`mono_ms` in the journals of the SP-1.92M runs (304, 317, 1,579, 2,532 ms) and the SP-483K campaign (74 to 28,905 ms;
`docs/desktop-runs/2026-10-01-sp-483k/`).
