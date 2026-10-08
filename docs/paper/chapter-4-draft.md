# CHAPTER IV: RESULTS AND DISCUSSION

Draft of 2026-10-08, written against the manuscript's Chapter III and updated from the earlier draft
(`docs/paper/chapter-4-draft.docx`, `ch4-data.json`, main checkout) with every run completed up to 2026-10-08 07:00:
the desktop capstones and offline tiers (2026-10-02 to 10-04), the multi-position on-chain campaign on a second
machine, a Hetzner AX42 (2026-10-04 to 10-07), the optional desktop 483,000-voter runs (2026-10-07/08), and the
AX42 security pass (2026-10-07/08). Every change from the 2026-10-02 draft is listed in
`docs/paper/ch4-refresh-notes.md`.
Where the extracted manuscript text is older than the Week 4 consultation record, the Week 4 revisions are assumed:
Table B.1 lists six chaincode checks, the negative test catalogue has fourteen cases, the verifier checklist has
fourteen checks, reference [32] supports three rounds per capstone experiment, and the scaling-limit rule requires a
resource trace at the point of failure.

**Conventions used in this draft.**

- **Build.** Every study run reported here ran on Saksi and the campaign console at commit
  `4a38a54fe0223b58f28c53ec54e47fbeab222837` (`run.json` `git_head_saksi` and `git_head_console`), with the
  generator binary `saksi-demo` of SHA-256 `112fffa0124943a4...763c52`. Commit 4a38a54 contains the issuer-binding
  and selection-sum gates and descends from 1812139, the commit that made key generation random, so every run cited
  here is eligible for issuer-binding, selection-sum and secrecy claims. The AX42 built the same commit with the
  same compilers; its binaries differ in hash (`saksi-demo` `429868b6...bd29880`) only because they embed absolute
  build paths (`docs/desktop-runs/2026-10-04-ax42-setup.md`). The one exception to the single build is the
  reordering re-verification (A5), which used an auditor built from Saksi commit `640a7b2`, the head of PR #58. That
  pull request merged into Saksi `main` on 2026-10-08 as merge commit `37035f9`, whose tree is identical to
  `640a7b2`'s (tree `2291d6b`). The re-verification therefore ran the merged code, but on a build made after the
  study runs, which all ran at 4a38a54; it is labelled wherever it is cited. The console's own refusal of a 2-of-5
  decryption (Saksi PR #57, head `1181015`) merged the same day as `83c78bd`, also after the study runs.
- **Two environments.** "Desktop" is the WSL2 machine of Table 4.1; "AX42" is the native-Linux server added on
  2026-10-04 for the multi-position on-chain tiers and the security pass. Every AX42 election name carries `ax42`,
  and figures from the two machines are never pooled.
- **Evidence.** The balotachain evidence commits are:
  - `8739722`, branch `docs/ch4-study-2026-09-30`, PR #66: rows 2 to 4, the SP-10K security run, T3;
  - `f2d8921`: candidate-count check, MP-1K security run, SP-483K and its sweep and burst;
  - `5aef011` and `3f08f5a`: SP-1M;
  - `f9aa09b`: validation gate;
  - `475bdfb`, `3b87854`, `1640390`, `4f4a0d9`, `b5d2095` and `f8f5c34`: the SP-1.92M capstone;
  - `c72b334`, `845bc13`, `451607b` and `589382b`: the SP-3.5M capstone;
  - `bd30fb8`, `c86fb74`, `223cbd6` and `0a1129f`: the offline MP tiers (row 8);
  - `950ee60` and `072931a`: AX42 setup and validation ladder; `57847c1` to `1844fbe` (19 commits): the AX42
    MP on-chain tiers, evidence bundles 01 to 19;
  - `cb16a93`, `2ca95a1`, `d5c8779`, `1289267` and `51e067b`: the optional desktop SP-483K and MP-483K runs;
  - `82997d4`: the AX42 security pass (`docs/desktop-runs/ax42-security/`);
  - `docs/desktop-runs/ci-4a38a54/`: the Saksi CI log of commit 4a38a54 (GitHub Actions run 36567167973).

  All but the first are on branch `docs/ch4-night1-2026-10-01`. Each table names its source files beneath it.
- **Status tags.** Each claim carries one of three tags:
  - *[design intent]*: stated in the design, not implemented or not tested;
  - *[implemented]*: present in the code at 4a38a54, shown at most by unit tests;
  - *[demonstrated]*: observed in a study run on 4a38a54.
- **Placeholders.** A result not yet run is marked `[PENDING: tier, configuration]`; a statement whose evidence
  could not be found in the archive is marked `[TODO: ...]`. No pending value is estimated. The open placeholders
  are listed at the end of the chapter.

---

## Test Tiers and Environment

Table 4.1 records the two environments as executed, completing the fields that Table 3.12 left to be recorded at
execution. The desktop ran every single-position tier, the multi-position tiers to 50,000 voters, the offline tiers
and the 483,000-voter repeats. The AX42 was rented when the measured disk cost of the multi-position on-chain tiers
exceeded the desktop (Table 4.22). It ran those tiers and the security pass.

**Table 4.1. Benchmarking environments as executed.**

| Item | Desktop | AX42 (Hetzner) |
|---|---|---|
| Processor | AMD Ryzen 7 5700G, 8 cores, 16 threads | AMD Ryzen 7 PRO 8700GE, 8 cores, 16 threads |
| Memory | 31.9 GB on the host; 24 GB allotted to WSL2 (`docker_info.MemTotal` 25,199,009,792 bytes), swap off | 64 GB (61 GiB usable), swap off |
| Storage | Docker Desktop data disk (`docker_data.vhdx`, dynamically expanding) on the host's 931 GB data drive Q: (NVMe); LevelDB state database | 2 x 476.9 GB NVMe in RAID0 (`/dev/md2`, ext4, 928 GB), Docker root on it; no virtual disk; LevelDB state database |
| Operating system and container runtime | Windows 11 Pro 10.0.26200; WSL2 Ubuntu, kernel 6.18.33.2-microsoft-standard-WSL2; Docker server 29.7.2 | Ubuntu 24.04.5 LTS, kernel 6.8.0-139-generic, native; Docker Engine 29.8.2 |
| Blockchain platform | Hyperledger Fabric 2.5.15 test network, channel `saksi`, chaincode `saksi-bulletin`, single Raft orderer | same; identical Fabric image IDs; `fabric-samples` at the desktop's commit `134c582` |
| Orderer block configuration | BatchTimeout 2 s, MaxMessageCount 50, PreferredMaxBytes 2 MB, AbsoluteMaxBytes 99 MB | same, verified by preflight before every run (snapshot interval 256 MB) |
| Network topology | Two organizations with one peer each and one Raft orderer, all on one machine; a fresh network and empty ledger for every attempt (network reset) | same |
| Toolchain versions | Saksi and console at commit 4a38a54 in every study run; `saksi-demo` SHA-256 `112fffa0...763c52` | Saksi and console at 4a38a54; Go 1.23.4, Rust pinned to 1.98.1 as on the desktop; `saksi-demo` SHA-256 `429868b6...bd29880` |
| Container resource limits | None (`HostConfig.Memory` 0, `NanoCpus` 0 on every container); 16 vCPU visible to Docker | None; 16 threads |
| Load generator | Closed loop, 128 ballot records in flight, no send-rate cap (`send_rate` 0), except the rate sweep; verifier on 16 threads | same |
| Election parameters | 4 candidates per position (except the candidate-count check), 5 trustees, threshold 3, `realistic` selection profile | same, 3 positions |
| Capstone instrumentation | External 10 s resource sampler per run (`resources.csv`): per-container CPU, memory and block I/O; guest memory and load; Windows processor time, available memory, per-disk busy time and queue length; host free space; virtual-disk sizes | 10 s sampler: per-container CPU, memory and block I/O; `/proc/meminfo`, load; `iostat` for both NVMe and md2; host CPU from `/proc/stat` and the run's own CPU from its cgroups (non-run CPU = host minus run) |

Source: journal line 1 (`env`) of every run; `docs/desktop-runs/2026-09-30-mp-50k.md` section 1 (branch
`docs/ch4-study-2026-09-30`); `docs/desktop-runs/tools/controller.py` class `Sampler`;
`docs/desktop-runs/2026-10-04-ax42-setup.md`.

Table 4.2 gives the evaluation matrix of Table 3.5 as it was executed.

**Table 4.2. Evaluation matrix as executed.**

| Tier | Voters x positions | Mode | Warm-ups + measured | Failed measured runs | Standing campaign or runs | Evidence commit |
|---|---|---|---|---|---|---|
| SP-1K | 1,000 x 1 | on-chain | 2 + 10 | 0 | `campaign-20260929-174641-11` | `8739722` |
| MP-1K | 1,000 x 3 | on-chain | 2 + 10 | 0 | `campaign-20260929-180218-15` | `8739722` |
| SP-10K | 10,000 x 1 | on-chain | 2 + 10 | 0 | `campaign-20260929-182259-19` | `8739722` |
| MP-10K | 10,000 x 3 | on-chain | 2 + 10 | 0 | `campaign-20260929-191104-23` | `8739722` |
| SP-50K | 50,000 x 1 | on-chain | 2 + 5 | 0 | `campaign-20260929-195715-27` | `8739722` |
| MP-50K | 50,000 x 3 | on-chain | 2 + 5 | 0 | `campaign-20260929-201819-29` | `8739722` |
| SP-483K | 483,000 x 1 | on-chain | 1 + 3; then a 5-step rate sweep and a 144,900-ballot burst | 0 | `campaign-20260930-185730-11`; sweep and burst `campaign-20260930-205246-12` | `f2d8921` |
| SP-1M | 1,000,000 x 1 | on-chain | 0 + 3 | 0 | `campaign-20261001-035442-2` (supersedes `campaign-20260930-214456-14`, 2 of 3 failed when the host disk filled) | `5aef011`, `3f08f5a` |
| SP-1.92M (capstone) | 1,921,917 x 1 | on-chain | 1 + 3, each a single-run campaign on a freshly reset network | 0 lost ballots; m1 resumed after a power loss and flagged `failed` by the console (see Reliability) | warm-up `campaign-20261001-082938-2`; m1 `-102357-4`; m2 `-123440-2`; m3 `-142136-2` | `475bdfb`, `3b87854`, `1640390`, `4f4a0d9`, `b5d2095`, `f8f5c34` |
| SP-3.5M (capstone) | 3,524,078 x 1 | on-chain | 1 + 3, each a single-run campaign on a freshly reset network | 0 (one m2 attempt cut by a power loss during generation, before any ballot, discarded and rerun) | warm-up `campaign-20261002-100730-2`; m1 `-141421-2`; m2 `campaign-20261002-181841-2`; m3 `campaign-20261003-040006-2` | `c72b334`, `845bc13`, `451607b`, `589382b` |
| MP-483K | 483,000 x 3 | offline | 0 + 1 | 0 | `mp-483k-ch4-offline-20261003-095458-1` | `bd30fb8` |
| MP-1M | 1,000,000 x 3 | offline | 0 + 1 | 0 | `mp-1m-ch4-offline-20261003-101159-2` | `c86fb74` |
| MP-1.92M (capstone) | 1,921,917 x 3 | offline | 0 + 1 | 0 | `mp-1-92m-ch4-offline-20261003-140355-1` | `223cbd6` |
| MP-3.5M (capstone) | 3,524,078 x 3 | offline | 0 + 1 | 0 | `mp-3-5m-ch4-offline-20261003-150909-2` | `0a1129f` |
| MP-1K, AX42 | 1,000 x 3 | on-chain | 2 + 10 | 0 | `campaign-20261003-170017-3` | `57847c1` |
| MP-10K, AX42 | 10,000 x 3 | on-chain | 2 + 10 | 0 | `campaign-20261003-170718-5` | `96334da` |
| MP-50K, AX42 | 50,000 x 3 | on-chain | 2 + 5 | 0 | `campaign-20261003-172609-7` | `5c3b5fe` |
| MP-483K, AX42 | 483,000 x 3 | on-chain | 1 + 3, single-run campaigns, fresh network each | 0 | runs `mp-483k-ch4-ax42-{warmup,m1,m2,m3}-*-36` to `-39` | `2d75404`, `452e993`, `e673a9a`, `2238db9` |
| MP-1M, AX42 | 1,000,000 x 3 | on-chain | 1 + 3, as above | 0 | runs `mp-1m-ch4-ax42-*-40` to `-43` | `e811f77`, `3837703`, `f61b111`, `1b032e5` |
| MP-1.92M (capstone), AX42 | 1,921,917 x 3 | on-chain | 1 + 3, as above | 0 | runs `mp-1-92m-ch4-ax42-*-44` to `-47` | `15420c8`, `0436730`, `52bde03`, `7872c7e` |
| MP-3.5M (capstone), AX42 | 3,524,078 x 3 | on-chain | 1 + 3, as above | 0 | runs `mp-3-5m-ch4-ax42-*-48` to `-51` | `a34a21d`, `b4d58a6`, `afee8a5`, `1844fbe` |
| SP-483K fresh (optional) | 483,000 x 1 | on-chain | 0 + 1, fresh network | 0 | `sp-483k-ch4-fresh-20261007-153309-1` | `cb16a93` |
| MP-483K, desktop (optional) | 483,000 x 3 | on-chain | 1 + 3, fresh network each; the warm-up was interrupted by a power loss after its window and discarded | 0 measured | `campaign-20261007-161130-2` (warm-up); m1 `-183028-2`; m2 `-200149-2`; m3 `-213324-2` | `2ca95a1`, `d5c8779`, `1289267`, `51e067b` |
| Candidate-count check | 1,000 x 3, 10 and 28 candidates | on-chain | 2 + 5 each | 0 | `campaign-20260930-173157-4`, `campaign-20260930-175515-8` | `f2d8921` |
| Security runs (desktop) | SP-10K; MP-1K | on-chain | 1 each | 0 | `sp-10k-ch4-sec-20260929-183410-129`; `mp-1k-ch4-sec-20260930-185139-29` | `8739722`; `f2d8921` |
| Security pass (AX42) | throwaway 1,000 x 3 networks; MP-10K (D1); 50,000 x 3 (D2 to D5); MP-1M (D1-L) | on-chain and offline | 1 per test | 0 | `sec-d1-mp10k-20261007-082414-*-53`; `sec-d1l-mp1m-20261007-095807-*-58`; others in Table 4.7a | `82997d4` |
| T3 node restart | 10,000 x 1 | on-chain | 1 | 0 | `sp-10k-ch4-t3-20260929-183754-130` | `8739722` |
| Validation gate | 14 tiers, SP and MP | ground-truth only | 3 timed checks each | 0 | `*-ch4-gate-20261001-*`; AX42 ladder `ladder-20261003-165827-1` (4 runs, pass) | `f9aa09b`; `072931a` |

Source: `campaign.json` and `summary.csv` of each tier export under `docs/desktop-runs/`; plan
`docs/plans/2026-10-01-ch4-runs-and-chapter.md`; study log
`.superpowers/sdd/2026-09-14-study-grade-wizard/ch4-study-log.md` (sections "Capstone 2" and "AX42 (Hetzner)").

The repetition counts depart from Chapter III's ten measured repetitions after two warm-ups:
- The 50,000-voter tiers ran 2 + 5, and SP-483K ran 1 + 3.
- SP-1M ran 0 + 3, by the researchers' decision of 1 October that a start-up effect is negligible over an election
  of that length.
- The capstones follow the 1 + 3 protocol of Chapter III, supported by [32].
- The multi-position tiers from 483,000 voters up were run twice: offline on the desktop (0 + 1, generation and
  verification without the blockchain), and on-chain on the AX42 (1 + 3, each run on its own fresh network). The
  on-chain AX42 runs replace the "not attempted" rows of the 2026-10-02 draft.
- The AX42 also repeated MP-1K, MP-10K and MP-50K on its own network, so that its large tiers have small tiers on
  the same machine to be compared with.

These departures are recorded as manuscript amendments. A tier was rerun once from a fresh network when a measured
repetition was flagged for host contention, and the rerun stood whatever its flags. Superseded attempts are kept
with the evidence.

---

## Correctness of the Framework (Research Question 1)

Correctness was checked on every election, warm-ups included, because a warm-up is still a complete election. The
independent verifier audited each election twice, once over the console's local record and once over the ballots read
back from the ledger, and compared the two (`ledger_matches_local`).

### Accuracy

**Table 4.3. Accuracy: correctness per tier, all elections including warm-ups.**

| Tier | Elections audited | Contest rows (local + ledger) | Largest E | Every contest passes | Ledger matches local | Ballots dropped | Verifier verdict |
|---|---|---|---|---|---|---|---|
| SP-1K | 12 | 96 | 0 | Yes | Yes | 0 | pass |
| MP-1K | 12 | 288 | 0 | Yes | Yes | 0 | pass |
| SP-10K | 12 | 96 | 0 | Yes | Yes | 0 | pass |
| MP-10K | 12 | 288 | 0 | Yes | Yes | 0 | pass |
| SP-50K | 7 | 56 | 0 | Yes | Yes | 0 | pass |
| MP-50K | 7 | 168 | 0 | Yes | Yes | 0 | pass |
| SP-483K (1 + 3) | 4 | 32 | 0 | Yes | Yes | 0 | pass |
| SP-483K burst | 1 | 8 | 0 | Yes | Yes | 0 | pass |
| SP-483K sweep steps | 5 | 40 | 0 | local rows yes; ledger rows no (time-bounded windows by design) | No (bounded) | 0 | not an accuracy row |
| SP-1M | 3 | 24 | 0 | Yes | Yes | 0 | pass |
| SP-1.92M (1 + 3) | 4 | 32 | 0 | Yes | Yes | 0 | pass |
| SP-3.5M (1 + 3) | 4 | 32 | 0 | Yes | Yes | 0 | pass |
| MP-483K to MP-3.5M offline | 4 (one per tier) | 12 per election (local only: no ledger) | 0 | Yes | not applicable | 0 | pass |
| MP-1K, AX42 | 12 | 288 | 0 | Yes | Yes | 0 | pass |
| MP-10K, AX42 | 12 | 288 | 0 | Yes | Yes | 0 | pass |
| MP-50K, AX42 | 7 | 168 | 0 | Yes | Yes | 0 | pass |
| MP-483K, AX42 (1 + 3) | 4 | 96 | 0 | Yes | Yes | 0 | pass |
| MP-1M, AX42 (1 + 3) | 4 | 96 | 0 | Yes | Yes | 0 | pass |
| MP-1.92M, AX42 (1 + 3) | 4 | 96 | 0 | Yes | Yes | 0 | pass |
| MP-3.5M, AX42 (1 + 3) | 4 | 96 | 0 | Yes | Yes | 0 | pass |
| SP-483K fresh, desktop | 1 | 8 | 0 | Yes | Yes | 0 | pass |
| MP-483K, desktop (1 + 3) | 4 | 72 measured + 12 warm-up (local) | 0 | Yes | Yes (measured runs) | 0 | pass |
| MP-1K, 10 and 28 candidates | 14 | 60 and 84 per election | 0 | Yes | Yes | 0 | pass |
| SP-10K security run | 1 | 8 | 0 | Yes | Yes | 0 | pass |
| MP-1K security run | 1 | 24 | 0 | Yes | Yes | 0 | pass |
| AX42 security pass: D1 (MP-10K), D1-L (MP-1M), D4 (MP-50K, netem) | 3 | 24 each | 0 | Yes | Yes | 0 | pass |
| AX42 security pass: D3 (MP-50K, peer and orderer killed) | 1 | 12 | 0 | Yes | reconciled 150,000 of 150,000 | 0 after resume | pass |
| SP-10K T3 (peer restart) | 1 | 8 | 0 | Yes | Yes | 0 after resume | pass |

Source: `correctness.csv` and `journal.ndjson` (`stage.verify.end`, `run.end`) of every run; rows 1K to 50K from
branch `docs/ch4-study-2026-09-30` (`8739722`), the rest from `docs/ch4-night1-2026-10-01`; AX42 per-run tables in
`docs/desktop-runs/2026-10-04-ax42-mp-*.md`; security pass in `docs/desktop-runs/ax42-security/{D1,D1-L,D3,D4}/`.

**Table 4.4. Accuracy and integrity recording form (Appendix C): largest completed single- and multi-position tiers.**

| Configuration | Position | Candidate | Decrypted count | Ground-truth count | Absolute difference |
|---|---|---|---|---|---|
| SP-3.5M, m3 (desktop) | president | cand0 | 1,726,799 | 1,726,799 | 0 |
| SP-3.5M, m3 (desktop) | president | cand1 | 634,335 | 634,335 | 0 |
| SP-3.5M, m3 (desktop) | president | cand2 | 599,093 | 599,093 | 0 |
| SP-3.5M, m3 (desktop) | president | cand3 | 563,851 | 563,851 | 0 |
| MP-3.5M, m2 (AX42) | president | cand0 / cand1 / cand2 / cand3 | 1,726,799 / 634,335 / 599,093 / 563,851 | 1,726,799 / 634,335 / 599,093 / 563,851 | 0 |
| MP-3.5M, m2 (AX42) | vice-president | cand0 / cand1 / cand2 / cand3 | 1,709,179 / 657,827 / 604,967 / 552,105 | 1,709,179 / 657,827 / 604,967 / 552,105 | 0 |
| MP-3.5M, m2 (AX42) | senator | cand0 / cand1 / cand2 / cand3 | 1,691,559 / 681,321 / 610,840 / 540,358 | 1,691,559 / 681,321 / 610,840 / 540,358 | 0 |
| SP-1.92M, m3 (desktop) | president | cand0 / cand1 / cand2 / cand3 | 941,740 / 345,945 / 326,726 / 307,506 | 941,740 / 345,945 / 326,726 / 307,506 | 0 |

Source: `correctness.csv` (source = local) of runs `sp-3-5m-ch4-m3-20261003-040010-1` (`589382b`),
`mp-3-5m-ch4-ax42-m2-20261006-023716-50` (`afee8a5`) and `sp-1-92m-ch4-m3-20261001-142140-1` (`f8f5c34`). The counts
of a tier are identical in every election of that tier, on both machines and offline, because the population is
generated deterministically from the same parameters; the offline MP-3.5M run decoded the same twelve counts.

The announced tally equalled the ground truth, with E = 0, on every contest of every election, from 1,000 to
3,524,078 voters single-position on the desktop and from 1,000 to 3,524,078 voters multi-position on the AX42 and
offline *[demonstrated]*. The largest election, MP-3.5M on-chain, decrypted 10,572,234 ballot records into twelve exact
counts in each of its four runs. Correctness held as well at 10 and 28 candidates per position, under attack in
both desktop security runs and in the AX42 security pass (including during an MP-1M election), after a peer restart,
after a peer and orderer kill, under injected network delay and loss, and in the capstone repetition cut by a power
loss (SP-1.92M m1) once it was resumed. The tallies have a clear winner (1,726,799 against 634,335 at SP-3.5M) because
the `realistic` profile apportions a reserved share of the electorate down the candidate ranks (Appendix A ground
truth, below).

### Correctness Criteria

**Table 4.5. Research Question 1: results by criterion.**

| Criterion | Evidence | Result | Status |
|---|---|---|---|
| (a) Announced tally equals ground truth | E per contest over local and ledger records | Met at every tier: SP-1K to SP-3.5M (desktop), MP-1K to MP-3.5M (desktop to 50,000 voters, AX42 to 3,524,078, and offline 483,000 to 3,524,078) (Table 4.3) | demonstrated |
| (b) Invalid ballots rejected | Security runs: tampered proof, corrupted bytes, self-issued credential, overvote (live on-chain); altered key-generation commitment and partial-decryption proof (verifier, and committed live in the AX42 pass) | Met for every mounted attack: 8 of 8 refused or detected at the declared gate in each desktop security run, in D1 (MP-10K) and in D1-L (MP-1M, 3,000,000 records) | demonstrated |
| (c) Duplicate votes rejected | `reused-nullifier` submitted live mid-election; replay of committed ballots (D2) | Met: refused by the chaincode nullifier gate in all four attack-timeline runs, per position on the three-position elections; D2 replayed 10 committed ballots after a peer restart and all 10 were refused (`gate=nullifier`) | demonstrated |
| (d) All accepted ballots in the tally | Dropped ballots, stream completeness, ledger matches local; T3, D3 and capstone m1 reconciliation | Met: 0 dropped in every non-bounded run; T3 reconciled 10,000 of 10,000; D3 reconciled 150,000 of 150,000 after the peer and orderer were killed; SP-1.92M m1 reconciled 881,628 of 881,628 at the cut, then committed the remaining 1,040,289 | demonstrated |
| (e) Independently verifiable | Verifier over the ballots read back from the ledger; verifier on a separate machine (A6); one-byte edits of a published record (A4) | Met. The SP-3.5M m3 public record, copied from the desktop to the AX42 (input SHA-256 `49b89e62...` matching the desktop archive), was audited there in 1,073 s: overall pass, 8 of 8 contests identical to the desktop audit (aggregates and recovered points), E = 0. A one-byte edit of a ballot ciphertext or of a tally total in a published record failed the audit (A4) | demonstrated |
| (f) All proofs verify | Verifier overall verdict and failed checks | Met: `overall pass`, `failed_checks` empty, on every audited run | demonstrated |

Source: Tables 4.3, 4.7, 4.7a and 4.11; `negative-tests.csv` of both security runs and of D1 and D1-L;
`docs/desktop-runs/2026-09-30-sp-10k-t3.md` (`8739722`); `docs/desktop-runs/2026-10-01-sp-1.92m/m1/RESUMED.md`
(`1640390`); `docs/desktop-runs/ax42-security/A6/sp-3-5m-m3/{compare.txt,audit.rc}` and `A4/` (`82997d4`).

Criteria (a) to (f) were met wherever they were measured. Criterion (e), which the 2026-10-02 draft left open, is
closed by A6: the verifier, run on a second machine with a different processor and operating system from nothing but
a copied public record, reproduced every contest of the 3,524,078-voter election exactly. The separate machine ran the
same source commit (4a38a54) but its own build of the verifier, so the experiment shows that the result does not
depend on the original machine; it does not show independence from the Saksi codebase. Chapter III's reference to the
ElectionGuard test vectors [14] is narrower than it reads.
The vectors in the test suite check that the tally follows ElectionGuard's semantics. They do not establish conformance
with the ElectionGuard specification, and no conformance claim is made.

---

## Integrity, Privacy, and Security (Research Question 2)

The console mounted the attacks during a live election. It paused the election at four stages: after key
generation, halfway through the ballot window, after closing, and during the decryption ceremony. At each pause it
mounted the attacks defined for that stage, then resumed. Attacks in the ballot window were real submissions to the
chaincode. Attacks that cannot be expressed as one submission were mounted on a copy of the record and scored by the
verifier. Neither security run's throughput is used for Research Question 3.

A second security pass ran on the AX42 on 2026-10-07/08 (Table 4.7a), on the same build. It mounted the attacks that
the console cannot express as a single ballot submission directly against the chaincode, through the Fabric gateway
with saksi's own message types and the console's own mutation functions (`tamper_invoke`), so that a tampered
key-generation transcript or partial decryption could be committed and then audited. It also repeated the attack
timeline at MP-10K (D1) and during an MP-1M election (D1-L), stopped the orderer as well as a peer (D3), injected
network delay and loss (D4), captured traffic (D5), and scanned the server from outside (X1 to X3). No security run
or test feeds Research Question 3.

### Integrity: Testing Scenarios T1 to T8

**Table 4.6. Integrity: Table 3.8 "Actual result and verdict" for scenarios T1 to T8.**

| ID | Scenario | Actual result | Verdict | Status |
|---|---|---|---|---|
| T1 | Normal voting operations | Every election at every tier accepted all valid ballots, with E = 0, to SP-3.5M on the desktop and MP-3.5M on the AX42. Latency was recorded per tier (Table 4.14) | Pass at every tier | demonstrated |
| T2 | High-volume voter transactions | Rate sweep at SP-483K: offered 250, 400, 640, 1,024 and 1,638 ballots/s; committed 239.2, 388.5, 564.6, 610.9 and 595.7 TPS; plateau 610.9 TPS at an offered 1,024/s; 0 dropped in every step | Pass at SP-483K: plateau documented, no accepted ballot lost. One tier only | demonstrated |
| T3 | Network interruption and recovery | Planned: `peer0.org1` stopped for 20.3 s at 40 % of the SP-10K window; afterwards 10,000 of 10,000 ballots on chain, 0 missing, E = 0. D3 (AX42, 150,000 records): the sole endorsing peer stopped for 25.2 s at 40 % and the orderer stopped and restarted three times during the window; resumed with no reset, 150,000 of 150,000 reconciled, chain linked over blocks 6 to 3,045, E = 0. D4: an MP-50K election under 40 ms delay and 0.5 % loss on the Fabric bridge completed with 0 ballots lost, E = 0. Unplanned: host power losses during SP-1.92M m1 (resumed with 0 lost) and after the MP-483K desktop warm-up's window (Reliability) | Pass for a peer outage, an orderer outage, and a degraded network. With one orderer, recovery is by restart, not failover | demonstrated |
| T4 | Vote or election-return tampering | Live: a tampered proof and corrupted bytes were refused by the `cds` and `decode` gates. Committed live and then detected (AX42, B4): a key-generation transcript with one commitment altered was accepted by the chaincode and failed the verifier's `dkg.decode`. A3: a tally with one total changed and its signatures left intact was refused (`tally signature does not verify`). A4: a one-byte edit of a published ballot ciphertext or tally total failed the audit. B3: a legacy election created with no issuer key accepted a self-issued ballot on-chain, and the verifier failed it at `parameters.issuer_binding`. On a copy: a dropped ballot was caught by `stream.completeness` | Pass for every mounted input. A total that is wrong but correctly signed would need the trustee keys, and is not tested | demonstrated |
| T5 | Unauthorized access | Live: a self-issued credential was refused by the `issuer` gate and a reused nullifier by the `nullifier` gate. B2: a ballot submitted with a certificate from a CA outside the channel was refused by the peer's membership service (`creator org unknown`) before the chaincode. An invalid credential signature is covered by a chaincode unit test only. "Expired" credentials cannot occur: credentials carry no validity period | 100 % rejection of the mounted cases, each logged with its gate | demonstrated (mounted); implemented (signature) |
| T6 | Trustee validation and approval | A1 (AX42): a partial decryption with its Chaum-Pedersen response altered was committed on-chain, because the chaincode checks the proof for presence only, and the verifier then failed it at `decryption.cp_proof`. A2: `PublishTally` with 2 of 5 trustee signatures was refused (`tally has 2 valid trustee signatures, threshold is 3`). Three valid shares decrypted and signed the tally in every study run | Pass: committed then detected, as Table 3.8 expects; sub-threshold publication refused live on 4a38a54. The console's own 2-of-5 refusal was added by Saksi PR #57 (`1181015`), merged as `83c78bd` after the study runs, and was not exercised in a study run | demonstrated |
| T7 | Concurrent voting and result transmission | MP-1K security run: 3,000 records from 1,000 voters x 3 positions carried distinct per-position nullifiers and all were admitted; a copied nullifier was refused; every accepted ballot was counted exactly once (E = 0 on all 12 contests). D1 and D1-L repeated this at MP-10K and MP-1M. The verifier ran after close, not during submission | Pass for per-position enforcement. Concurrent verifier read not exercised | demonstrated |
| T8 | Peak election conditions | SP-483K burst: 144,900 ballots unthrottled, completed at 512.9 TPS, p99 549.9 ms, 0 dropped, E = 0. The largest configured tiers completed: SP-3.5M (3,524,078 records, desktop) and MP-3.5M (10,572,234 records, AX42), every run with 0 dropped and E = 0 | Pass, including the largest configured tiers | demonstrated |

Source: `negative-tests.csv` of `sp-10k-ch4-sec-20260929-183410-129` and `mp-1k-ch4-sec-20260930-185139-29`;
`docs/desktop-runs/2026-10-01-sp-483k.md` sections 4 and 5 (`f2d8921`); `docs/desktop-runs/2026-09-30-sp-10k-t3.md`;
`docs/desktop-runs/2026-10-01-sp-1.92m/m1/RESUMED.md`; `docs/desktop-runs/ax42-security/security-ax42-track-N.md` and
`security-ax42-track-O.md` (`82997d4`).

The system resisted every scenario it was exposed to under the stated threat model, and the table also shows what
was not tested. The two departures from Table 3.8 noted in the 2026-10-02 draft are now resolved on the study build:
- T6 expects the corrupted partial decryption to be committed on-chain and then detected. A1 did exactly that on
  4a38a54, replacing the citation of the 2026-09-15 trial on commit 7272837.
- T4 lists manipulated manifests. B3 mounted the nearest case the build allows, an election created without an issuer
  key, and the verifier caught it; a manifest edit of another field was not mounted.

The sub-threshold half of T6 is demonstrated at the chaincode by A2. The console's own refusal at 2 of 5 shares is
implemented and unit-tested in Saksi `83c78bd` (PR #57, merged 2026-10-08), a build later than the study's; it is
not part of 4a38a54 and was not exercised in a study run.

### Attack Scenarios in the Security Runs

**Table 4.7. Attack scenarios mounted during the security runs.**

| Scenario | Stage | Mount | Declared gate | Observed gate | SP-10K | MP-1K | D1, MP-10K (AX42) | D1-L, MP-1M (AX42) |
|---|---|---|---|---|---|---|---|---|
| tamper-dkg-transcript | dkg | simulated, verifier | dkg.decode | dkg.decode | PASS | PASS | PASS | PASS |
| tamper-ballot-proof | ballots | live on-chain | cds | cds | PASS | PASS | PASS | PASS |
| reused-nullifier | ballots | live on-chain | nullifier | nullifier | PASS | PASS | PASS | PASS |
| corrupted-ballot-bytes | ballots | live on-chain | decode | decode | PASS | PASS | PASS | PASS |
| self-issued-credential | ballots | live on-chain | issuer | issuer | PASS | PASS | PASS | PASS |
| overvote | ballots | live on-chain | selection | selection | PASS | PASS | PASS | PASS |
| dropped-ballot | close | simulated, verifier | stream.completeness | stream.completeness | PASS | PASS | PASS | PASS |
| reordered-ballots | close | not mounted | none | none | SKIPPED | SKIPPED | SKIPPED | SKIPPED |
| tamper-partial-decryption | ceremony | simulated, verifier | decryption.cp_proof | decryption.cp_proof | PASS | PASS | PASS | PASS |

Source: `negative-tests.csv` of both desktop security runs; `docs/desktop-runs/2026-09-30-sp-10k-security.md`
(`8739722`); `docs/desktop-runs/2026-10-01-mp-1k-security.md` (`f2d8921`); `docs/desktop-runs/ax42-security/D1/` and
`D1-L/` `negative-tests.csv` and `scenarios.json` (`82997d4`), runs `sec-d1-mp10k-20261007-082414-*-53` and
`sec-d1l-mp1m-20261007-095807-*-58`.

Eight scenarios passed and one was skipped in each run, a rejection rate of 8 of 8 per run *[demonstrated]*. D1-L
mounted the attacks halfway through the ballot window of a 1,000,000-voter, three-position election: the ballot
window committed 3,000,000 records with 0 dropped at 440 TPS, the five live attacks were refused at their gates, the
three simulated ones were caught, `ledger_audit` was ok and E = 0 on all 24 contest rows. The gates therefore hold
under load at scale, not only on small elections.
- **Live.** Five were live submissions, each refused by the chaincode with its own recorded reason: the
  validity-proof equation failed, the nullifier was already spent, the bytes could not be decoded, the credential's
  issuer was not the one bound to the election, and the selection proof did not match.
- **Verifier.** Three were caught by the verifier on a copy.
- **Skipped.** Reordering has no gate in either the chaincode or the stateless verifier of 4a38a54. The tally is an
  order-independent homomorphic sum, so a reordering cannot change the result, but on the study build it is not
  detected. The skip is therefore a documented gap, not a pass. The reordering check added afterwards (A5, below)
  does not change these four rows: it checks what the chain serves, not the console's own record, which is what the
  `reordered-ballots` scenario reorders.

The rate is one attempt per scenario per run, not a sampled rate. The issuer and selection gates exist from 4a38a54,
and every security run was on that build.

**Table 4.7a. AX42 security pass (2026-10-07/08, saksi 4a38a54): tests beyond the console's attack timeline.**

| ID | Test | Adversary | Observed | Verdict |
|---|---|---|---|---|
| B1 | A second organization calls `CreateElection` for an election id before the honest operator | Malicious channel member | The attacker's call committed; the honest call was refused (`election ... already exists`) | Limitation demonstrated: no caller authorization |
| B2 | `SubmitBallot` signed with a certificate from a CA outside the channel | External attacker | Refused at the peer's membership layer (`creator org unknown`), before the chaincode | Pass; closes catalogue case 10 |
| B3 | Election created with an empty issuer key, then a self-issued ballot | Malicious administrator | All three calls committed (the issuer gate is skipped for a legacy election); the verifier failed the record at `parameters.issuer_binding` | Pass: accepted on-chain, detected by the verifier |
| B4 | Key-generation transcript with one coefficient commitment altered | Malicious trustee | Committed (the chaincode checks shape and presence); the verifier failed it at `dkg.decode` | Pass: committed, then detected |
| A1 | Partial decryption with its Chaum-Pedersen response altered | Malicious trustee | Committed after close; the verifier failed it at `decryption.cp_proof` | Pass: committed, then detected |
| A2 | `PublishTally` with 2 of 5 trustee signatures | Malicious trustees | Refused: `tally has 2 valid trustee signatures, threshold is 3` | Pass; closes catalogue case 8 |
| A3 | `PublishTally` with one total changed (3 to 4), signatures kept | Ledger administrator | Refused: `tally signature from trustee "1" does not verify` | Pass, with a stated limit: the signatures bind the totals; a wrong total that is correctly signed needs the trustee keys and is not checked on-chain against the aggregate |
| A4 | One byte flipped in an exported public record (AX42 MP-1K run 5): a ballot ciphertext; a tally total | Ledger administrator | Ballot: audit fails at `ballot.cds_proof`. Total: audit fails at `tally.homomorphic_sum` (decode 172, published 173) and `tally.signatures` (0 of 5 valid) | Pass: detected |
| A5 | Reordering of the chain's read-back, with an auditor check `ledger.order` (Saksi `640a7b2`, PR #58, merged after the study as `37035f9` with an identical tree) | Bulletin-board node | All 47 archived AX42 MP on-chain runs (MP-1K x 12, MP-10K x 12, MP-50K x 7, and the 16 runs of MP-483K to MP-3.5M) re-verified: overall pass, `ledger.order` pass, sum of \|E\| 0. A copy of MP-1K run 5's ledger dump with records 1,001 and 1,002 swapped failed with `ledger.order` only | Pass on re-verified runs; limits below |
| A6 | Verifier on a second machine | (RQ1 e) | SP-3.5M m3 public record audited on the AX42 in 1,073 s: overall pass, 8 of 8 contests identical to the desktop audit | Pass; closes RQ1(e) |
| A7 | Linkage join of every public ballot field against the registration list, MP-3.5M m3 (AX42) | Privacy adversary | N = 3,524,078 voters, 10,572,234 ballots; 0 linkage hits; 10,572,234 distinct nullifiers, 0 collisions | Pass; bound 1/N = 2.84 x 10^-7 |
| D1 | Attack timeline, MP-10K | Voter, client | Table 4.7 | Pass |
| D1-L | Attack timeline during an MP-1M ballot window (3,000,000 records, 440 TPS) | Voter, client | Table 4.7; E = 0 on 24 contest rows | Pass |
| D2 | Replay of 10 committed ballots after a peer restart | Network | 10 of 10 refused, `gate=nullifier` (double vote); tally unchanged | Pass |
| D3 | Sole endorsing peer stopped 25.2 s at 40 % of the window; orderer stopped and restarted three times | Infrastructure | 15,050 committed at the fault; resume with no reset re-submitted 134,950; 150,000 of 150,000 reconciled, chain linked (blocks 6 to 3,045), E = 0 on 12 contests | Pass |
| D4 | 40 ms delay and 0.5 % loss on the Fabric bridge for a whole MP-50K window | Network | Completed: 150,000 committed, 0 dropped, E = 0 on 24 contest rows, at 52.0 TPS (p50 2,414.7 ms) against about 820 clean; ballot window 2,885.9 s (48.1 min) against about 3 min clean | Pass, with a large degradation |
| D5 | Packet capture of peer gRPC and of the console | Eavesdropper | Peer gRPC: 4,512 packets, no readable election term. Console: plain HTTP, requests and responses readable | Limitation demonstrated: plain-HTTP console |
| X1 | Full TCP scan of the server from outside | External attacker | Before: 22, 7050, 7051, 7053, 9051, 9443, 9444 and 9445 open (Fabric ports published on 0.0.0.0 by `docker-proxy`, no host firewall); console 8090 loopback-only. After a firewall (`fabric-firewall.service`, DOCKER-USER and INPUT drop, IPv4 and IPv6): a targeted IPv4 connect scan of the eight formerly open ports and 8090 found only 22 open, the rest filtered; the IPv6 scan found every probed port, 22 included, filtered | Found and fixed |
| X2 | TLS on peer and orderer gRPC | Network | TLS 1.3 (TLS_AES_128_GCM_SHA256); peer0.org1, peer0.org2 and the orderer verify against the channel TLS CAs | Pass |
| X3 | SSH configuration (`sshd -T`) | External attacker | Before: root key-only, but password authentication enabled for other accounts. After hardening: `passwordauthentication no`, password login refused. Separately, a connection flood from many hosting-provider addresses (2,059,936 connections closed before authentication over three days; 3,381 in ten minutes on 2026-10-07) overflowed sshd's default `MaxStartups` and dropped the researchers' own sessions. Raising `MaxStartups` to 100:30:300, setting `PerSourceMaxStartups` 10 and exempting the researchers' address from a per-source rate limit restored access; the flood itself continued (2,864 in the ten minutes before the record was taken), because the limit of 10 per minute per source sits just above each bot's rate | Found and fixed (password login); access restored, flood not stopped |

Source: `docs/desktop-runs/ax42-security/STATUS.md`, `security-ax42-track-N.md`, `security-ax42-track-O.md`, the
per-test folders `B1` to `X3`, `A5/report.md` and `A5/verdicts.tsv`, `D1-L/journal.ndjson` (`stage.ballots.end`) and
`D4/perf.csv` and `D4/journal.ndjson` (`82997d4`); plan `docs/plans/2026-10-04-ax42-security-tests.md`, section
"Paper impact". The X1 rescan after the fix is `X1-rescan/nmap-v4-targeted.txt` (`nmap -sT`, 2026-10-08) and
`X1-rescan/nmap-v6.txt`; `X1-rescan/nmap-v4-allports.txt` is empty because that full-range scan was stopped while it
saturated the link during the A6 upload. The SSH flood is recorded in `SSH-flood/ssh-flood-evidence.txt` (`sshd -T`
settings, iptables rules, counts of connections closed before authentication and their top sources).

Six rows change what the 2026-10-02 draft could claim. B2 and A2 close catalogue cases 10 and 8 live. B4 and A1 show
"committed, then detected" on the study build. A6 closes RQ1(e). A7 closes the privacy-linkage placeholder. Three rows
are limits rather than passes: B1 (no caller authorization), A3 (totals bound by signatures, not checked against the
aggregate on-chain) and D5 (plain-HTTP console). X1 and X3 were found on the rented server and fixed during the pass;
they are findings about how the test network was deployed, not about the protocol.

A5 qualifies the reordering gap rather than closing it. The auditor at `640a7b2` holds the chain's read-back to the
ledger's canonical nullifier order and to the published record (`ledger_digest`), so a bulletin-board node that serves
ballots reordered, dropped, duplicated or altered is detected *on re-verified runs only*. Three limits apply:
- Fabric's block (commit) order is not exposed by this read path and is not checked.
- The console's own record is compared as a sorted set, so the `reordered-ballots` scenario of Table 4.7 stays
  SKIPPED.
- The check is not in the study build. It merged into Saksi after the study runs (PR #58, merge commit `37035f9`,
  tree identical to `640a7b2`), and runs not re-verified with it report reordering as not checked.

### Tamper Trial

The tamper attacks of the study build are those of Table 4.7 and of Table 4.7a. In the four attack-timeline runs,
three tamper scenarios (`tamper-dkg-transcript`, `tamper-ballot-proof` and `tamper-partial-decryption`) were refused
or detected at their declared gate *[demonstrated]*. In the AX42 pass, a tampered key-generation transcript (B4) and
a tampered partial decryption (A1) were committed to the channel on 4a38a54, because the chaincode checks those two
artifacts for shape and presence only, and the verifier then flagged them (`dkg.decode`, `decryption.cp_proof`)
*[demonstrated]*. A tampered ballot proof is never committed: the chaincode refuses it at the `cds` gate.

An earlier tamper trial, run on 2026-09-15 on Saksi branch `feat/sample-chains` (commit 7272837, before the issuer
gate of 4a38a54), committed tampered artifacts to real channels (`sample-stuffing`, `sample-partial`). It is now
superseded by B4 and A1 and is cited as history only (source: `.superpowers/sdd/2026-09-14-study-grade-wizard/progress.md`,
entry of 2026-09-15).

### Negative Test Catalogue

**Table 4.8. Coverage of the fourteen-case negative test catalogue.**

| # | Case | Guarding gate or check | Exercised in the study runs (4a38a54) | Unit test (Saksi source at 4a38a54) | Status |
|---|---|---|---|---|---|
| 1 | Malformed ciphertext | decode (chaincode) | corrupted-ballot-bytes: PASS, live, all four attack-timeline runs | `TestSubmitBallotRejectsMalformedCiphertext` | demonstrated |
| 2 | Invalid or substituted validity proof | cds (chaincode) | tamper-ballot-proof: PASS, live, all four timeline runs | `TestSubmitBallotRejectsTamperedCDSProof` | demonstrated |
| 3 | Invalid or expired credential | credential signature (chaincode) | Not mounted. Credentials carry no validity period, so "expired" is not a reachable state | `TestSubmitBallotRejectsBadCredentialSignature` | implemented (invalid); design intent (expired) |
| 4 | Reused nullifier | nullifier (chaincode) | reused-nullifier: PASS, live, all four attack-timeline runs; D2 replay: 10 of 10 refused | `TestSubmitBallotRejectsDoubleVote` | demonstrated |
| 5 | Duplicate vote for the same position | nullifier (chaincode), per position | reused-nullifier on the three-position MP-1K, MP-10K (D1) and MP-1M (D1-L) elections: PASS, live | `TestSubmitBallotRejectsDoubleVote`; auditor `per_position_double_vote_is_caught` | demonstrated |
| 6 | Altered transaction | Fabric endorsement and signature checks | Not mounted. Transport is TLS 1.3 with certificates from the channel CAs (X2) | none named | design intent (platform) |
| 7 | Altered manifest | verifier (election parameters, issuer binding) | B3: an election created with no issuer key was accepted on-chain and failed by the verifier at `parameters.issuer_binding`. No edit of another manifest field was mounted | `TestCreateElectionValidatesTheIssuerKey`; auditor `malicious_admin_altering_a_contest_id_is_detected` | demonstrated (issuer key, verifier); implemented (other fields) |
| 8 | Decryption with fewer than three shares | tally signature threshold (chaincode); `decryption.threshold` (verifier) | A2: `PublishTally` with 2 of 5 signatures refused live (`threshold is 3`); every study ceremony published with 3 of 5 signers | `TestPublishTallyRejectsBelowThreshold`; from `83c78bd` (PR #57, merged after the study) `TestPublishAtTwoOfFiveIsRefusedWithReason` | demonstrated |
| 9 | Incorrect trustee decryption proof | `decryption.cp_proof` (verifier) | tamper-partial-decryption: PASS, simulated, all four timeline runs; A1: committed live, then failed by the verifier | chaincode checks presence only | demonstrated (verifier) |
| 10 | Submission from outside the channel membership | Fabric membership service | B2: refused at the peer's membership layer (`creator org unknown`), before the chaincode | none named | demonstrated (platform) |
| 11 | Credential not issued under the election's issuer key | issuer (chaincode) | self-issued-credential: PASS, live, all four timeline runs | `TestSubmitBallotIssuerBinding` | demonstrated |
| 12 | Overvote (a position's selections sum above one) | selection (chaincode) | overvote: PASS, live, all four timeline runs | `TestSubmitBallotSelectionProof` | demonstrated |
| 13 | Ballot record that names no position | shape (chaincode) | Not mounted | `TestSubmitBallotRefusesAnEmptyPositionOnAPositionedElection` | implemented |
| 14 | Corrupted ledger data | `stream.completeness` and chain walk (verifier) | dropped-ballot: PASS, simulated, all four timeline runs; chain walk PASS in T3 (204 linked blocks), SP-1.92M m1 and D3 (blocks 6 to 3,045); A4: one-byte edits of a published record detected | auditor `a_corrupt_ballot_line_fails_the_stream_audit` | demonstrated |

Source: manuscript, Security section; Saksi test names at 4a38a54
(`packages/saksi-bulletin/chaincode/*_test.go`, `packages/saksi-auditor/src/*.rs`) as listed in
`.superpowers/sdd/2026-09-14-study-grade-wizard/adviser-items-5-6.md`; security-run `negative-tests.csv`; Table 4.7a.

Eleven of the fourteen cases were exercised on the study build, each refused or detected at its guarding gate (cases
1, 2, 4, 5, 7, 8, 9, 10, 11, 12 and 14); case 7 only for the issuer key. Cases 3 and 13 are covered by named unit
tests (`TestSubmitBallotRejectsBadCredentialSignature`, `contract_test.go:707`;
`TestSubmitBallotRefusesAnEmptyPositionOnAPositionedElection`, `selection_test.go:192`, both at 4a38a54). Saksi's CI
ran on 4a38a54 itself (GitHub Actions run 36567167973, push to `main`, 2026-09-29, conclusion success): the chaincode
package passed `go test -race` on Ubuntu and macOS, and `cargo test --workspace` passed 270 tests with 0 failed and 0
ignored on both. (The A5 branch's workspace suite, 276 passed and 0 failed, ran at `640a7b2`.) Case 6 rests on Fabric
itself and was not exercised. The claim that every case "must be rejected by the specific gate that guards it" is therefore shown for
eleven cases, implemented for two, and assumed of the platform for one.

### The Verifier's Fourteen Checks

**Table 4.9. The fourteen verifier checks of Chapter III and their evidence.**

| # | Check (Chapter III) | Nearest auditor check identifiers at 4a38a54 | Positive result in the study runs | Negative case exercised | Status |
|---|---|---|---|---|---|
| 1 | Validity of every recorded transaction | `ballot.shape`, `parameters.shape`, `dkg.shape`, `decryption.shape`, `tally.shape` | No failure in any audited run | Corrupted bytes refused upstream by the chaincode | demonstrated (positive) |
| 2 | Issuer key present; each credential issued under it | `parameters.issuer_binding`, `ballot.issuer_binding` | No failure | Self-issued credential refused upstream (issuer gate, live); B3 election with no issuer key caught by `parameters.issuer_binding` | demonstrated |
| 3 | Validity of each credential signature | `ballot.credential` | No failure | Unit tests only | implemented |
| 4 | Nullifier uniqueness and derivation | `nullifier.unique` | No failure | Reused nullifier refused upstream (live) | demonstrated |
| 5 | Well-formedness of every ciphertext | `ballot.decode` | No failure | Corrupted bytes refused upstream (live) | demonstrated |
| 6 | Disjunctive validity proof of every slot | `ballot.cds_proof` | No failure | Tampered proof refused upstream (live); A4 one-byte ciphertext edit caught by the verifier | demonstrated |
| 7 | Selection-sum proof of every position | `ballot.selection_sum` | No failure | Overvote refused upstream (live) | demonstrated |
| 8 | Completeness of the committed stream | `stream.completeness` | No failure | dropped-ballot caught (simulated) | demonstrated |
| 9 | Homomorphic aggregate recomputed | `tally.homomorphic_sum`, `tally.aggregate` | No failure | A4: an edited tally total caught by `tally.homomorphic_sum` | demonstrated |
| 10 | Key-generation commitments are group elements | `dkg.decode` | No failure | tamper-dkg-transcript caught (simulated); B4 transcript committed live, then caught | demonstrated |
| 11 | Chaum-Pedersen decryption proof per trustee | `decryption.cp_proof` | No failure | tamper-partial-decryption caught (simulated); A1 partial committed live, then caught | demonstrated |
| 12 | At least three of five trustees contributed | `decryption.threshold` | No failure (3 of 5 in every run) | Unit tests; the chaincode's own threshold refused 2 of 5 live (A2) | implemented (verifier); demonstrated (chaincode) |
| 13 | Announced tally equals the decrypted aggregate | `tally.accuracy`, `tally.signatures` | No failure; E = 0 everywhere | A4: an edited total failed `tally.signatures` (0 of 5 valid); unit tests `wrong_tally_is_caught`, `tampered_tally_signature_is_caught` | demonstrated |
| 14 | Append-only consistency of the ledger | chain walk (`verify_only.chain`); `run.end` `ledger_audit`; `ledger.order` from `640a7b2` (merged as `37035f9`) only (A5) | `ledger_audit` "ok" on every run cited; chain walk PASS, linked, in T3, SP-1.92M m1 and D3; `ledger.order` pass on 47 re-verified AX42 runs | A5: a swapped ledger dump caught by `ledger.order` (build later than the study's) | demonstrated (positive); demonstrated on a later build (negative) |

Source: `journal.ndjson` `stage.verify.end` (`overall`, `failed_checks`) and `run.end` of every run; auditor check
identifiers from `git grep` over `packages/saksi-auditor/src` at 4a38a54; Table 4.7a. The mapping of identifiers to
the fourteen numbered checks is by name and was not taken from a published table.

The verifier passed every audited election with no failed check *[demonstrated]*. For checks 2, 6, 8, 9, 10, 11 and 13
the study also showed the negative direction: a fault was mounted, by the console or directly against the chaincode or
the published record, and the verifier caught it. For checks 4, 5 and 7 the chaincode refused the faulty input first,
so the verifier never received it. Checks 3 and 12 rest on unit tests for their verifier-side negative direction, and
check 14's negative direction rests on an auditor check merged after the study runs (`37035f9`).

### Adversary Coverage

**Table 4.10. Adversary coverage: each Table 3.9 class mapped to scenarios and catalogue entries.**

| Class | Scenarios and catalogue cases | Evidence level | Coverage | Untested part |
|---|---|---|---|---|
| Malicious voter | reused-nullifier, tamper-ballot-proof, corrupted-ballot-bytes, overvote, self-issued-credential; cases 1, 2, 4, 5, 11, 12 | Live in four timeline runs, to MP-1M | Strong | "Expired" credential (no expiry concept) |
| Compromised client | tamper-ballot-proof (substituted proof), corrupted-ballot-bytes; cases 1, 2, 3 | Live; credential misuse by unit test | Partial | A ciphertext altered to another valid point with the old proof; "client holds no key material" is a design claim with no test |
| Malicious trustees (up to two) | tamper-partial-decryption, tamper-dkg-transcript; B4, A1, A2; cases 8, 9 | Live on-chain: B4 and A1 committed then detected, A2 refused | Strong for the mounted cases | Collusion of three or more trustees is outside the threat model; the ceremony was simulated by one process |
| Network adversary | reused-nullifier (replay), D2, D4, D5, X2; case 4 | Live | Replay and degradation covered; peer transport encrypted | **Interception of the console: demonstrated readable** (plain HTTP, D5) |
| Ledger administrator or malicious bulletin-board node | dropped-ballot, reordered-ballots, A3, A4, A5; case 14 | Simulated drop; edited records detected (A4); reordering detected on re-verified runs at `640a7b2`, merged after the study as `37035f9` (A5) | Partial | No attack by an actual peer or orderer operator; reordering not detected on the study build; block order not checked; **front-running a transcript or partial: demonstrated possible** (B1, no caller authorization) |
| External attacker | self-issued-credential, B2, X1, X3; cases 10, 11 | Live | Covered | X1 and X3 found exposed Fabric ports and password SSH on the rented server, both fixed during the pass |
| Malicious administrator (text and Table 3.10; no Table 3.9 row) | B3; case 7 | Live on-chain, detected by the verifier | Partial | Manifest fields other than the issuer key not mounted; the class lacks a Table 3.9 row |
| Privacy adversary (text and Table 3.10) | A7 | Linkage join at MP-3.5M (10,572,234 ballots) | Covered for identity linkage | A voter's own ballots are linkable to each other pseudonymously (A7 note); timing analysis not run |

Source: `.superpowers/sdd/2026-09-14-study-grade-wizard/adviser-items-5-6.md`, item 5, which cites test files and
lines at 4a38a54; Tables 4.7, 4.7a and 4.8.

Every class named in the manuscript now has at least one test on the study build, and the AX42 pass removed most of
the gaps the 2026-10-02 draft listed:
- The malicious voter is covered strongly, by five live gates in single- and multi-position runs up to MP-1M.
- Submission from outside the membership service, sub-threshold publication and a committed tampered partial are now
  tested live.
- **Still no test** for an expired credential (not a reachable state) or for Fabric block-order tampering.
- Two attacks are shown to *succeed* and are reported as limits: front-running (B1) and reading the console's traffic
  (D5).
- The malicious-administrator class appears in the text and in Table 3.10 but has no Table 3.9 row, so the
  statement that every class has a row does not hold for it.

### Reliability

**Table 4.11. Reliability: commit success and ballot loss per tier, and recovery.**

| Tier or run | Measured runs | Failed runs (console) | Ballots committed per run | Dropped | Recovery event | Result |
|---|---|---|---|---|---|---|
| SP-1K to MP-50K | 50 | 0 | all | 0 | none | 100 % success |
| SP-483K (1 + 3, burst) | 3 + burst | 0 | 483,000; 144,900 | 0 | none | 100 % success |
| SP-1M (Night 2) | 3 | 0 | 1,000,000 | 0 | none | 100 % success |
| SP-1M (Night 1, superseded) | 3 | 2 | m1 1,000,000; m2 932,700 | m2 67,300 | host data drive full at 07:34; m3 found no peer | environment fault (Instrument Findings); excluded |
| SP-1.92M (1 + 3) | 3 | 1 (m1, flagged `failed` after its resume: reason `nothing_submitted`, no `perf.csv`) | 1,921,917 in every run (m1: 881,628 + 1,040,289) | 0 | m1: host power loss at 19:07, resumed on the surviving ledger | 0 ballots lost; m1 verify pass, E = 0 |
| SP-3.5M (1 + 3) | 3 | 0 | 3,524,078 | 0 | one earlier m2 attempt cut by a host power loss (Event 41 at 2026-10-03 02:12) during generation, before any ballot was submitted: discarded and rerun from a fresh reset | 100 % success |
| Offline MP-483K to MP-3.5M | 4 | 0 | not applicable (no ledger) | 0 | none | 100 % success |
| AX42 MP on-chain, MP-1K to MP-3.5M | 37 (10 + 10 + 5 + 4 x 3), plus 10 warm-ups | 0 of 47 runs | 3,000 to 10,572,234 | 0 | none: every run `failed` false, `resumed` false; no controller crash | 100 % success |
| SP-483K fresh and MP-483K, desktop (optional) | 1 + 3 | 0 measured | 483,000; 1,449,000 | 0 | MP-483K warm-up (2026-10-08): a host power loss (brownout) after its ballot window (1,449,000 committed, 0 dropped, window closed 01:04:21). Windows logged Kernel-Power Event 41 on reboot at 01:34:15 and Event 6008 dating the unexpected shutdown 00:35:44; the external sampler on the same host kept writing until 01:10:01, so the loss fell between 01:10:01 and 01:34:15 and the 6008 time is not used; the controller restarted at 01:36 and the run was verified on its surviving ledger (reconciled 1,449,000 of 1,449,000, chain linked over 25,139 blocks, verify pass); flagged `failed` (`nothing_submitted`) and discarded as a warm-up | 0 ballots lost |
| T3, SP-10K | 1 | 0 | 10,000 | 6,000 recorded as dropped by the closed loop at the stop, all resubmitted; 0 missing after resume | `peer0.org1` down 20.3 s at 40 % | 0 ballots lost, E = 0 |
| D3, MP-50K (AX42 security) | 1 | 0 | 150,000 | 134,950 recorded as dropped by the closed loop at the fault, all resubmitted; 0 missing after resume | sole endorsing peer down 25.2 s at 40 %; orderer stopped and restarted three times; resume with no reset | 0 ballots lost, E = 0, chain linked |
| D4, MP-50K under netem (AX42 security) | 1 | 0 | 150,000 | 0 | 40 ms delay, 0.5 % loss for the whole window | 0 ballots lost, E = 0 |

**T3 detail (SP-10K):** peer down 20.3 s; ready 1.1 s after restart. At the stop the chain held 3,893 ballots and the
driver counted 4,000 committed. The chain held 4,045 when the resume began. The resume submitted 5,955, committed
5,955, with 0 dropped and 0 replays. Reconcile: 10,000 of 10,000, 0 missing. Chain walk PASS over 204 linked blocks
(9,958 receipts sampled). E = 0 on 4 contests.

Source: `summary.csv` per tier; `docs/desktop-runs/2026-10-01-sp-1m-night1.md`; `docs/desktop-runs/2026-09-30-sp-10k-t3.md`;
`docs/desktop-runs/2026-10-01-sp-1.92m/m1/RESUMED.md` and its `journal.ndjson` (`run.end` `resumed: true`); study log
sections "Capstone 2" (02:12, 11:45) and "AX42 (Hetzner)" (queue complete 10-07 06:34);
`docs/desktop-runs/2026-10-07-483k-optional/mp-483k-warmup/` (`NOTE.md`, `resources.csv` sample gap 01:10:01 to
02:01:35, `journal.ndjson` `verify_only.*`); `docs/desktop-runs/ax42-security/power/kernel-power-2026-10-07-08.txt`
(Windows System log export);
`docs/desktop-runs/ax42-security/D3/evidence.txt`, `D4/perf.csv`.

No accepted ballot was lost in any standing run, on either machine, so the Table 3.7 reliability criterion (100 %
commit success, zero ballot loss after recovery) was met *[demonstrated]*. The desktop lost power several times
during the study, each a Kernel-Power Event 41 or a brownout with no clean shutdown. Each was handled by the resume
and discard policy fixed before the campaign: a cut during generation, before any ballot is on the chain, is
discarded and rerun from a fresh reset (SP-3.5M m2, 2026-10-03 02:12); a cut with ballots on the chain is resumed on
the surviving ledger (SP-1.92M m1); a cut with nothing running (2026-10-03 11:15) needs no action; and a warm-up hit
after its window is verified and then discarded (MP-483K, 2026-10-08). None lost a ballot. The same System-log export
also records two unclean shutdowns on 2026-10-07 (reboots at 00:30:48 and 02:16:20), when no study run was active:
the desktop controller's log has no entry between 2026-10-03 16:12 and 2026-10-07 23:03. The AX42 ran its 47
multi-position elections back to back, from 2026-10-04 00:58 to 2026-10-07 06:34, with no interruption. The console's failure flag on SP-1.92M m1 is a bookkeeping
outcome of the resume: the run has no single uninterrupted ballot window and so no `perf.csv`. All 1,921,917 ballots
committed and the verification passed, so m1 is reported as a correctness record and excluded from the throughput
statistics (runbook section 10.7). By the console's flag the capstone's failure rate is 1 of 3 measured runs; by
ballot loss it is 0. Two qualifications apply:
- The closed-loop load generator counts every ballot after a fault as dropped. T3's 6,000 is therefore the rest of
  the window, not the loss over a 20-second outage.
- D3 stopped the orderer deliberately, three times during one window, as well as the sole endorsing peer, and the
  election completed with no reset and nothing lost. With a single orderer this is recovery by restart, not crash
  tolerance by failover; the m1 power loss likewise restarted the orderer, which recovered as Raft leader at block
  17,640.

### Privacy

**Table 4.12. Privacy evaluation form.**

| Check | Method | Result | Status |
|---|---|---|---|
| Unlinkability | Linkage join of every voter-linked public field (nullifier, credential commitment, voter credential commitment) against the registration identifiers; success compared with 1/N (A7) | MP-3.5M m3 (AX42, `mp-3-5m-ch4-ax42-m3-20261006-123905-51`): N = 3,524,078 voters, 10,572,234 ballots; **0 linkage hits**; 10,572,234 distinct nullifiers, 0 collisions; residual bound 1/N = 2.84 x 10^-7 | demonstrated |
| Ballot secrecy | Inspection of the tally path in the run records | Held: each trustee submitted one partial decryption per contest (4 at SP-10K, 12 at MP-1K), on the aggregate ciphertext only; no ballot-level decryption occurs | demonstrated |
| Sub-threshold resistance | Decryption attempted with fewer than three shares | A2: `PublishTally` with 2 of 5 trustee signatures refused live on 4a38a54 (`threshold is 3`). The console refusal at 2 of 5 was merged after the study runs (PR #57, `83c78bd`); every study ceremony published with 3 of 5 | demonstrated (chaincode); implemented after the study build (console) |

Source: ceremony journal events of `sp-10k-ch4-sec-20260929-183410-129` and `mp-1k-ch4-sec-20260930-185139-29`;
saksi PR #57; `docs/desktop-runs/ax42-security/A7/a7-result.json` and `A2/` (`82997d4`).

Every run cited here is on 4a38a54, a descendant of 1812139, so the trustee key-generation polynomials were drawn at
random. The secrecy and linkage results therefore hold for these runs, which runs generated before 1812139 could not
support. Three limits bound them:
- The key-generation and registration ceremonies were simulated: one generator process produced every trustee share
  and every credential, so secrecy holds against every party except that process.
- A7 measures linkage to a *registered identity*. The credential commitment is stable per voter (exactly N distinct
  values over 3N ballots), so a voter's three position-ballots are linkable to each other under a pseudonym, though
  not to the voter.
- Linkage through timing or submission order was not analysed.

### Mapping to Philippine Electoral and Data Privacy Law

**Table 4.13. Simulated adversary classes, Philippine legal provisions, and observed outcomes.**

| Simulated adversary (threat) | Provision (Table 3.10) | Observed in this study |
|---|---|---|
| Malicious voter: double voting | BP 881, Sec. 261; penalties under Sec. 264 | Refused live by the nullifier gate in all four attack-timeline runs; replay of committed ballots refused (D2) |
| Malicious voter: malformed ballot | BP 881, Sec. 261(j); RA 9369, Sec. 35 | Refused live by the decode, CDS and selection gates |
| Sub-threshold trustees: corrupt decryption | RA 9369, Sec. 35(a) | Altered decryption proof committed and then detected by the verifier (A1); publication with 2 of 5 signatures refused (A2) |
| Malicious administrator: manipulate manifest | BP 881, Sec. 261(j); RA 9369, Sec. 35(a) | Election without an issuer key detected by the verifier (B3); altered key-generation commitment detected (B4); other manifest fields not mounted |
| Malicious bulletin-board node: drop or reorder | RA 9369, Sec. 35(a) | Drop detected; edited record detected (A4); reordering of the chain's read-back detected on re-verified runs by an auditor check merged after the study (A5, `37035f9`), not on the study build (no effect on the tally) |
| Network adversary: interception or replay | RA 9369, Sec. 35; RA 10173, Sec. 29 | Replay refused (D2); peer transport TLS 1.3 (X2); console traffic readable (plain HTTP, D5) |
| Privacy adversary: linkage or secrecy | RA 10173, Secs. 25, 28, 29 | Aggregate-only decryption held; 0 identity linkages over 3,524,078 voters (A7) |

Source: Table 3.10; Tables 4.7, 4.8 and 4.12. As in Chapter III, no claim of legal validity, compliance or
certification is made.

### Election Return Approval, Audit Trail and Limits

The threshold ceremony approved the decrypted tally in every run. Trustees 1, 2 and 3 of five submitted their
partial decryptions, and the tally was published with 3 signers at threshold 3. The chaincode checked the signatures
at publication. The verifier then established from the public record that the signed totals equal the decrypted
aggregate *[demonstrated]*. The ceremony was simulated, so trust separation between trustees was not exercised.

The audit trail was the ledger plus the per-run records: journal, performance export, correctness record,
negative-test record and, for the capstones, the resource trace. Every figure in this chapter was recomputed from
them.

The security results show resistance to the defined scenarios under the stated threat model. They are not a general
claim of security. Several limits were observed directly:
- the chaincode checks a key-generation transcript for shape only, and a partial-decryption proof for presence only,
  so both can be committed tampered and are caught only by the verifier (B4, A1);
- the chaincode performs no caller authorization, so any channel member can front-run `CreateElection` and lock out
  the honest operator (B1);
- the chaincode does not check published totals against the aggregate; it relies on the trustee signatures (A3);
- one machine hosted every node, on each of the two environments;
- the console served plain HTTP, readable to an eavesdropper on the host (D5);
- the test network as deployed on the rented server published the Fabric ports to the internet and allowed password
  SSH (X1, X3); both were fixed during the pass;
- the rented server drew a constant SSH connection flood (about 340 connections a minute closed before
  authentication) that overflowed sshd's default start-up limit and dropped the researchers' own sessions; raising the
  limit and exempting the researchers' address restored access, but the flood continued. It cannot log in, because
  password login is off (X3), so it is an availability nuisance, not an intrusion.

The implementation-level testing of Chapter III is covered at 4a38a54 by Saksi's CI (GitHub Actions run 36567167973,
push of 4a38a54 to `main`, 2026-09-29; log in `docs/desktop-runs/ci-4a38a54/`), every job of which concluded
success on Ubuntu and macOS:
- tests: `cargo test --workspace` 270 passed, 0 failed, 0 ignored; `go test -race ./...` passed for every Go package
  with tests, the chaincode and its four verifier packages included;
- static analysis: `cargo fmt --check`, `cargo clippy --workspace --all-targets -D warnings`, `gofmt`, `go vet` and
  `staticcheck`; no dedicated security-focused SAST tool (such as gosec or Semgrep) is configured;
- dependency scanning: `cargo audit` found no vulnerability in 127 Rust crate dependencies (one allowed warning,
  RUSTSEC-2026-0190, unsoundness in `anyhow`). `govulncheck` runs as an advisory step that cannot fail the build, and
  at 4a38a54 it reported the chaincode module affected by five vulnerabilities from two modules, all in transitive
  dependencies of the Fabric contract API: four in `google.golang.org/grpc` v1.59.0 and one in `golang.org/x/net`
  v0.17.0. The scan stopped at that module, so the client SDK and campaign modules were not scanned in this run.
  Three concern resource exhaustion or panics in the HTTP/2 transport (GO-2026-6443, GO-2026-6348, GO-2024-2687) and
  two concern gRPC authorization (GO-2026-4762, a `:path` check bypass; GO-2026-6061, the xDS RBAC engine and the
  HTTP/2 server); govulncheck traced each to code reachable from the chaincode's start-up. None was exercised in the
  study, and they are reported as a limit of the dependency set, fixed upstream in later gRPC and `x/net` releases.

---

## Performance (Research Question 3)

Throughput is committed ballot records per second over the submission window (committed TPS); latency is the
client-observed submit-to-commit time per record. Figures are medians over measured repetitions as `summary.csv`
computes them (the lower middle value when n is even; the AX42 controller's tier summaries report the true median, so
they read 830.4 and 835.6 where this chapter reads 830.1 and 835.4). Where each measured run was a single-run campaign
on its own network (the capstones and every AX42 tier from 483,000 voters), the median is taken per metric over the
three runs. SP-1.92M throughput comes from the uninterrupted measured runs m2 and m3, which are reported individually.
Desktop and AX42 figures are reported side by side and never pooled.

### Response Time

**Table 4.14. Response time: latency and throughput per tier, median over measured repetitions.**

| Tier | n | Committed TPS (min to max) | p50 ms | p95 ms | p99 ms | Driver ceiling TPS | Failure rate |
|---|---|---|---|---|---|---|---|
| SP-1K | 10 | 893.9 (741.1 to 944.4) | 143.9 | 180.0 | 227.9 | 862.5 | 0 |
| MP-1K | 10 | 924.6 (675.5 to 973.7) | 146.7 | 174.5 | 208.2 | 856.5 | 0 |
| SP-10K | 10 | 885.8 (853.9 to 955.9) | 146.0 | 206.2 | 252.7 | 872.5 | 0 |
| MP-10K | 10 | 789.3 (460.7 to 881.1) | 152.8 | 253.3 | 372.8 | 836.3 | 0 |
| SP-50K | 5 | 697.3 (613.7 to 735.0) | 163.0 | 277.7 | 417.2 | 785.2 | 0 |
| MP-50K | 5 | 570.3 (563.8 to 581.9) | 218.7 | 339.3 | 524.5 | 585.3 | 0 |
| SP-483K | 3 | 509.0 (450.2 to 533.2) | 246.3 | 446.9 | 537.6 | 519.8 | 0 |
| SP-1M | 3 | 574.5 (561.2 to 628.1) | 230.4 | 311.0 | 482.3 | 555.7 | 0 |
| SP-1.92M m2 | 1 | 633.3 | 182.6 | 283.8 | 460.4 | 701.0 | 0 |
| SP-1.92M m3 | 1 | 637.1 | 182.0 | 277.9 | 430.2 | 703.3 | 0 |
| SP-1.92M warm-up (not a statistic) | 1 | 632.0 | 183.7 | 276.6 | 437.8 | | |
| SP-3.5M (m1 to m3) | 3 | 586.4 (567.2 to 593.7) | 225.9 | 317.9 | 486.9 | 566.5 | 0 |
| SP-3.5M warm-up (not a statistic) | 1 | 515.7 | 200.6 | 345.9 | 514.1 | | |
| SP-483K burst (T8) | 1 | 512.9 | 232.2 | | 549.9 | | 0 |
| SP-483K fresh (optional, one run on a fresh network) | 1 | 583.3 | 194.8 | 338.5 | 489.8 | 657.2 | 0 |
| MP-483K, desktop (optional, m1 to m3) | 3 | 636.0 (613.3 to 636.2) | 180.7 | 282.1 | 421.4 | 708.4 | 0 |
| **AX42** MP-1K | 10 | 830.1 (814.6 to 835.5) | 170.0 | 191.5 | 208.0 | 752.2 | 0 |
| **AX42** MP-10K | 10 | 835.4 (784.5 to 839.4) | 169.8 | 191.4 | 209.1 | 753.2 | 0 |
| **AX42** MP-50K | 5 | 820.4 (819.8 to 822.1) | 172.6 | 194.0 | 212.1 | 741.7 | 0 |
| **AX42** MP-483K (m1 to m3) | 3 | 553.9 (553.9 to 557.7) | 208.3 | 299.8 | 327.4 | 614.4 | 0 |
| **AX42** MP-1M (m1 to m3) | 3 | 473.5 (466.7 to 499.5) | 293.0 | 345.9 | 376.2 | 436.9 | 0 |
| **AX42** MP-1.92M (m1 to m3) | 3 | 464.9 (456.7 to 513.4) | 287.6 | 359.8 | 390.4 | 445.0 | 0 |
| **AX42** MP-3.5M (m1 to m3) | 3 | 423.9 (421.0 to 429.2) | 319.0 | 401.6 | 448.9 | 401.2 | 0 |

Source: `summary.csv` of each tier export (rows 1K to 50K: `8739722`; SP-483K: `f2d8921`; SP-1M: `5aef011`; SP-1.92M:
`475bdfb`, `4f4a0d9`, `f8f5c34`; SP-3.5M: `docs/desktop-runs/2026-10-02-sp-3.5m/{warmup,m1,m2,m3}/summary.csv`;
optional 483K: `docs/desktop-runs/2026-10-07-483k-optional/`; AX42: `docs/desktop-runs/2026-10-04-ax42-mp-*`). Burst:
`sp-483k-ch4-20260930-213103-39`. AX42 warm-ups (not statistics): MP-483K 585.7, MP-1M 534.5, MP-1.92M 440.1, MP-3.5M
428.4 TPS.

Latency stayed in the low hundreds of milliseconds at every tier, on both machines *[demonstrated]*:
- on the desktop, p50 ran from 144 ms at SP-1K to 246 ms at SP-483K, and 182 to 226 ms at the capstones;
- on the AX42, p50 rose from 170 ms at MP-1K to 319 ms at MP-3.5M;
- p99 stayed between 208 and 538 ms on the desktop and between 208 and 449 ms on the AX42; under the T8 burst, p99
  was 549.9 ms.

On the desktop the latency does not grow with the electorate as such: it follows the ledger that had accumulated on
the network under the repetition (see Scalability). On the AX42, where every large-tier run had a fresh network, p50
does grow with the size of the run, from 208 ms at 1,449,000 records to 319 ms at 10,572,234. The AX42 p99 is lower
than the desktop's at comparable tiers and its spread is narrower, while its p50 is higher; the throughput comparison
of the two machines turns on that difference (Second Environment, below).

### Scalability

**Table 4.15. Scalability: throughput, per-record cryptographic cost and accumulated ledger per tier.**

| Tier | Committed TPS (median) | Proof generation CPU ms / record | In-process verification ms / record | Records on the network before the last measured run | Repetitions per network |
|---|---|---|---|---|---|
| MP-1K (4 candidates) | 924.6 | 1.614 | 0.176 | up to 33,000 | 12 per network |
| SP-483K | 509.0 | 1.601 | 0.172 | 1,449,000 before m3 | 4 per network |
| SP-1M | 574.5 | 1.605 | 0.174 | 2,000,000 before m3 | 3 per network |
| SP-1.92M (m2, m3) | 633.3, 637.1 | 1.556, 1.560 | 0.169, 0.169 | 0 (fresh network per run) | 1 per network |
| SP-3.5M (m1 to m3) | 586.4 | 1.593 (1.575 to 1.603) | 0.171 | 0 (fresh network per run) | 1 per network |
| SP-483K fresh | 583.3 | 1.835 | 0.198 | 0 | 1 |
| MP-483K, desktop | 636.0 | 1.591 (1.587 to 1.673) | 0.171 | 0 (fresh network per run) | 1 per network |
| MP-483K to MP-3.5M offline (desktop) | not applicable | 1.611, 1.615, 1.612, 1.625 | 0.171, 0.173, 0.174, 0.173 | no network | 1 |
| **AX42** MP-1K | 830.1 | 1.533 | 0.163 | up to 33,000 | 12 per network |
| **AX42** MP-10K | 835.4 | 1.554 | 0.164 | up to 330,000 | 12 per network |
| **AX42** MP-50K | 820.4 | 1.649 | 0.169 | up to 900,000 | 7 per network |
| **AX42** MP-483K | 553.9 | 1.575 | 0.171 | 0 (fresh network per run) | 1 per network |
| **AX42** MP-1M | 473.5 | 1.618 | 0.171 | 0 | 1 per network |
| **AX42** MP-1.92M | 464.9 | 1.633 | 0.171 | 0 | 1 per network |
| **AX42** MP-3.5M | 423.9 | 1.640 | 0.171 | 0 | 1 per network |

Source: `summary.csv` medians divided by records (`proof_gen_cpu_ms`, `proof_verify_inproc_ms`); the 1K figures from
`docs/desktop-runs/2026-10-01-night1.md` section 2; repetition layout from Table 4.2. SP-483K fresh is one run, and
its per-record proof cost is the highest recorded; its sampler logged one host CPU sample above 25 %.

**Figure 4.1. Committed throughput against election size, single- and multi-position, on-chain, by machine.**
`docs/paper/ch4-figures/fig-4-1-tps.png`

**Figure 4.2. p99 submit-to-commit latency against election size, on-chain, by machine.**
`docs/paper/ch4-figures/fig-4-2-p99.png`

Source for both: the medians of Table 4.14, recomputed by `docs/paper/ch4-data.py` from the `summary.csv` files named in
`ch4-data.json` (`tiers` and `figure_tiers`). Three series: desktop single-position (SP-1K to SP-3.5M), desktop
three-position (MP-1K to MP-50K and the optional MP-483K) and AX42 three-position (MP-1K to MP-3.5M); the machines are
never joined or pooled. The open marker is the single SP-483K run on a fresh network. Points from 483,000 voters up
on the AX42, and the desktop's SP-1.92M, SP-3.5M and MP-483K points, are single-run campaigns on fresh networks; the
desktop's smaller tiers and SP-483K and SP-1M shared one network across their repetitions (Table 4.15), so the
desktop lines join points measured under different ledger histories. The SP-1.92M point is the lower middle of m2 and
m3 per metric (633.3 TPS, p99 430.2 ms).

The per-record cryptographic cost was flat across a 3,500-fold range of election size *[demonstrated]*: 1.56 to 1.67
ms of CPU for proof generation on the desktop (1.53 to 1.65 on the AX42) and 0.16 to 0.18 ms for verification per
record, from 1,000 voters to 10,572,234 records, on-chain and offline. The one outlier is the single SP-483K fresh run
(1.84 and 0.20 ms). That is the linear part of the cost model, and it held on both machines.

On the desktop, throughput did not fall monotonically with election size. From 1,000 to 483,000 voters it fell from
about 900 to 509 TPS, but SP-1M reached a median of 574.5, the SP-1.92M runs 633 to 637 and the SP-3.5M runs 567 to
594. The ordering of these figures matches how much ledger was already on the network:
- At SP-483K and SP-1M the repetitions shared one network, and throughput fell repetition over repetition (533, 509,
  450 and 628, 574, 561 TPS).
- Each capstone repetition ran alone on a fresh network, and its throughput was close to SP-1M's first repetition on
  a fresh network (628.1).
- The optional SP-483K run on a fresh network (2026-10-07) committed 583.3 TPS against the 509.0 median of the
  accumulating network, 15 % more on the same machine, build and tier.

The fresh-network rerun removes most of the anomaly the 2026-10-02 draft could not explain, and supports ledger
accumulation as the main driver of the desktop decline. It does not isolate it: it is one run, on a different day,
and the SP-483K warm-up (the first run on its network, 527.1 TPS) still sits below it. The 9 to 28 % slowdown against
the earlier build (Performance Log Analysis) also remains unexplained.

On the AX42, with a fresh network for every large-tier run, throughput did fall with the size of the run: 830 to 820
TPS up to MP-50K, then 553.9 at MP-483K, 473.5 at MP-1M, 464.9 at MP-1.92M and 423.9 at MP-3.5M. The analysed runs
(MP-483K, MP-1M) show a fast phase at about 820 TPS followed by a lower plateau (Second Environment, below); if the
larger runs behave alike, the longer the run, the more of it is spent on the plateau. That reading is not verified
beyond MP-1M. The AX42 controller found no host bottleneck in any run: no memory, disk
utilization, queue or CPU saturation flag, and host CPU averaged 24 to 45 % of the 16 threads in every ballot window.
Under the Chapter III rule there is therefore no scaling limit to attribute, and no resource was exhausted at
10,572,234 records.

### Throughput: Saturation and Peak Burst

**Table 4.16. Throughput at saturation (T2) and under the peak burst (T8), SP-483K.**

| Step | Run | Offered /s | Concurrency | Committed | Committed TPS | p50 ms | p99 ms | Dropped |
|---|---|---|---|---|---|---|---|---|
| 1 | `sp-483k-ch4-20260930-205249-34` | 250 | 128 | 29,209 | 239.2 | 186.1 | 522.6 | 0 |
| 2 | `sp-483k-ch4-20260930-205931-35` | 400 | 214 | 47,418 | 388.5 | 167.6 | 622.7 | 0 |
| 3 | `sp-483k-ch4-20260930-210708-36` | 640 | 403 | 68,939 | 564.6 | 261.1 | 1,302.8 | 0 |
| **4 (plateau)** | `sp-483k-ch4-20260930-211446-37` | 1,024 | 1,339 | 74,632 | **610.9** | 2,025.2 | 3,523.3 | 0 |
| 5 | `sp-483k-ch4-20260930-212207-38` | 1,638.4 | 5,777 | 75,527 | 595.7 | 9,727.0 | 11,869.3 | 0 |
| Burst (T8) | `sp-483k-ch4-20260930-213103-39` | unthrottled, 144,900 ballots | 128 | 144,900 | 512.9 | 232.2 | 549.9 | 0 |

Source: `docs/desktop-runs/2026-10-01-sp-483k/sweep/summary.csv` (`plateau_tps` 610.928) and
`docs/desktop-runs/2026-10-01-sp-483k.md` sections 4 and 5 (`f2d8921`).

The sweep located a plateau of 610.9 TPS at SP-483K. Past the knee, latency became queueing: p99 rose from 1.3 s to
11.9 s, and no ballot was dropped *[demonstrated]*. The plateau is 20 % above the closed-loop median of the same tier.
The closed-loop figure is therefore a sustained rate for 128 records in flight and understates saturation by about
15 to 20 % at this scale. The burst committed a worst-case hour of Zamboanga City, 144,900 ballots sized as three times
the mean hourly arrival, in 282.5 s. Two limits apply:
- one sweep with 120 s steps;
- a peak-hour factor of 3 that is assumed, not measured.

The sweep was run at one tier only. Saturation at the capstones is not measured.

### Second Environment: Desktop Against AX42

At MP-483K the desktop committed 613-636 TPS against the AX42's 554-558 TPS, reversing the order seen at MP-50K
(desktop about 570, AX42 about 820), even though both ran the same build (saksi 4a38a54), preset, 128-record
closed-loop load and orderer batch parameters on a fresh network per run. The throughput traces show why: on both
machines a long window has a fast phase followed by a lower plateau that starts when the peer's disk writes per
record roughly double, and a 150,000-record MP-50K window fits inside the AX42's fast phase while the desktop, on that
night's uncompacted and heavily self-loaded host, fell to its plateau within the first minute of every repetition. In
the 483K runs, which were preceded on the desktop by a Docker disk compaction and relaunch, the desktop was about 15 %
faster in the fast phase, stayed in it about 1.6 times as long (340-420 s against 230 s), and was about 10 % faster
on the plateau. Because the driver keeps 128 records in flight, throughput equals concurrency divided by mean latency,
so the desktop's lower minimum and median latency outweigh the AX42's lower p99 latency (327-336 ms against 397-457
ms). The evidence does not identify the peer store behind the plateau or isolate the effect of CPU clock and power
limits, so these results compare two specific environments rather than ranking the hardware.

Two further observations are recorded, not explained. On the AX42 the fast phase shortened over successive runs (the
MP-483K warm-up left it at 480 s, m1 to m3 at 230 s, the MP-1M warm-up at 220 s and MP-1M m1 to m3 at about 40 s),
although every run had a fresh network; the AX42 never restarted Docker, and its RAID volume was first trimmed on
2026-10-05. The plateau is also the likeliest reading of the AX42's falling throughput across its large tiers
(Scalability), but the decile analysis covers the MP-483K runs and the MP-1M fast-phase timings only; the MP-1.92M
and MP-3.5M traces were not analysed.

Source: `.superpowers/sdd/2026-09-14-study-grade-wizard/desktop-vs-ax42-483k.md` (analysis of the existing evidence,
2026-10-08: `ballots.progress` and `sample` events of each run's `journal.ndjson`), sections 3 to 7.

### Stage Timers, Validation Gate and Threshold Decryption

**Table 4.17. Stage timers, median over measured repetitions; validation gate timed separately.**

| Tier | Validation gate s (standalone, median of 3) | Generation wall s | Generation CPU s | Proof generation CPU s | Verification s (16 threads) | Aggregate ms | Combine ms | Decode ms | Submission window s |
|---|---|---|---|---|---|---|---|---|---|
| SP-1K | 0.055 | 0.2 | 2.7 | 1.6 | 0.18 | 1 | 0 | 0 | 1.1 |
| MP-1K | 0.004 | 0.6 | 7.5 | 4.8 | 0.53 | 4 | 1 | 0 | 3.2 |
| SP-10K | 0.056 | 2.0 | 27.4 | 16.1 | 1.85 | 14 | 0 | 3 | 10.8 |
| MP-10K | 0.007 | 5.6 | 75.6 | 48.5 | 5.17 | 44 | 1 | 9 | 36.4 |
| SP-50K | 0.064 | 10.0 | 137.7 | 80.8 | 8.65 | 73 | 0 | 4 | 71.7 |
| MP-50K | 0.019 | 27.9 | 380.7 | 244.9 | 26.00 | 224 | 1 | 20 | 263.0 |
| SP-483K | 0.158 | 96.1 | 1,318.0 | 773.4 | 82.85 | 769 | 0 | 14 | 948.9 |
| SP-1M | 0.208 | 207.2 | 2,737.8 | 1,605.3 | 174.04 | 1,488 | 0 | 20 | 1,740.7 |
| SP-1.92M m2 | 0.481 | 427.9 | 5,101.9 | 2,990.9 | 325.29 | 2,967 | 0 | 29 | 3,034.9 |
| SP-1.92M m3 | 0.481 | 416.8 | 5,115.4 | 2,998.1 | 324.90 | 3,023 | 0 | 29 | 3,016.5 |
| SP-3.5M (m1 to m3) | 0.800 | 739.0 | 9,572.7 | 5,613.2 | 601.45 | 5,479 | 0 | 38 | 6,009.2 |
| MP-483K offline | 0.178 | 296.9 | 3,629.9 | 2,334.9 | 247.94 | 2,229 | 1 | 64 | not applicable |
| MP-1M offline | 0.309 | 622.4 | 7,535.8 | 4,846.4 | 518.22 | 4,591 | 1 | 91 | not applicable |
| MP-1.92M offline | 0.558 | 1,121.1 | 14,451.7 | 9,293.7 | 1,001.23 | 8,736 | 2 | 145 | not applicable |
| MP-3.5M offline | 0.848 | 2,108.7 | 26,709.1 | 17,179.3 | 1,833.77 | 16,249 | 1 | 168 | not applicable |
| **AX42** MP-483K | ladder pass | 252.8 | 3,526.5 | 2,282.7 | 247.06 | 2,759 | 1 | 61 | 2,615.9 |
| **AX42** MP-1M | ladder pass | 538.3 | 7,500.4 | 4,854.4 | 512.03 | 5,642 | 1 | 86 | 6,335.3 |
| **AX42** MP-1.92M | ladder pass | 1,044.8 | 14,544.8 | 9,416.9 | 985.52 | 11,134 | 1 | 115 | 12,400.9 |
| **AX42** MP-3.5M | ladder pass | 1,925.8 | 26,783.9 | 17,341.0 | 1,803.27 | 20,586 | 1 | 151 | 24,940.2 |

Source: `summary.csv` of each tier export; validation gate:
`docs/desktop-runs/2026-10-01-sp-1.92m/validation-gate-timing.md` and `.json` (`f9aa09b`); AX42 validation ladder
`docs/desktop-runs/2026-10-04-ax42-ladder/ladder.json` (4 runs, pass; not timed per tier). The offline tiers'
verification ran on the same 16 threads with no network.

**Table 4.18. Validation gate per tier (W3 #3): the seven-check, fail-closed data check, timed alone.**

| Tier | Voters (table rows) | Ballot records | Check s (median of 3) | Rows per second | Checks passing |
|---|---|---|---|---|---|
| SP-1K | 1,000 | 1,000 | 0.055 | 18,182 | 7 of 7 |
| SP-10K | 10,000 | 10,000 | 0.056 | 178,571 | 7 of 7 |
| SP-50K | 50,000 | 50,000 | 0.064 | 781,250 | 7 of 7 |
| SP-483K | 483,000 | 483,000 | 0.158 | 3,056,962 | 7 of 7 |
| SP-1M | 1,000,000 | 1,000,000 | 0.208 | 4,807,692 | 7 of 7 |
| SP-1.92M | 1,921,917 | 1,921,917 | 0.481 | 3,995,669 | 7 of 7 |
| SP-3.5M | 3,524,078 | 3,524,078 | 0.800 | 4,405,098 | 7 of 7 |
| MP-1K | 1,000 | 3,000 | 0.004 | 250,000 | 7 of 7 |
| MP-10K | 10,000 | 30,000 | 0.007 | 1,428,571 | 7 of 7 |
| MP-50K | 50,000 | 150,000 | 0.019 | 2,631,579 | 7 of 7 |
| MP-483K | 483,000 | 1,449,000 | 0.178 | 2,713,483 | 7 of 7 |
| MP-1M | 1,000,000 | 3,000,000 | 0.309 | 3,236,246 | 7 of 7 |
| MP-1.92M | 1,921,917 | 5,765,751 | 0.558 | 3,444,296 | 7 of 7 |
| MP-3.5M | 3,524,078 | 10,572,234 | 0.848 | 4,155,752 | 7 of 7 |

Source: `docs/desktop-runs/2026-10-01-sp-1.92m/validation-gate-timing.json` (`f9aa09b`), runs
`*-ch4-gate-20261001-101851-2` to `-102020-15`, ground-truth populations (no cryptography), checked three times each
between capstone runs on an idle network, seconds from the journal's `stage.check.end` `mono_ms`. Rows per second are
table rows (voters) per second.

The validation gate is a negligible cost against the cryptographic workload *[demonstrated]*:
- At SP-1.92M it took a median of 0.481 s, against 2,991 CPU-seconds of proof generation and 325 s of verification
  per repetition.
- It finished in under 0.85 s even at MP-3.5M (10,572,234 records), which confirms that its stream processing
  stays bounded at the largest population.

Inside the cryptographic runs, the same check stage recorded 0.30 to 2.53 s at SP-1.92M and 0.07 to 28.9 s at
SP-483K. These figures come from the journal's `stage.check.end` of each run, timed right after generation. The
spread is recorded, but its cause was not investigated, so the standalone timings are the figure reported for the
gate.

Threshold decryption was small in process at every tier: combine plus decode took at most 38 ms single-position
(SP-3.5M) and 169 ms multi-position (MP-3.5M offline, twelve contests). The aggregate grew linearly with the record
count, to 20.6 s for the 10,572,234 records of MP-3.5M on the AX42. The on-chain submission of partial decryptions dominated it. In the security runs each trustee submitted 4 partials in
8.2 s at SP-10K and 12 partials in 24.6 to 24.7 s at MP-1K. That is about 2.06 s per partial, close to the 2 s
batch timeout of the orderer, an explanation the study did not test.

### Resource Consumption

**Table 4.19. Peak CPU and memory per tier, median over measured repetitions (console sampler).**

| Tier | Peer CPU % | Orderer CPU % | Client CPU % | Peer memory MB | Orderer memory MB | Client memory MB |
|---|---|---|---|---|---|---|
| SP-1K, MP-1K | not sampled (window shorter than the 5 s sampler) | | | | | |
| SP-10K | 344.0 | 86.5 | 74.1 | 256.7 | 1,030.1 | 59.0 |
| MP-10K | 376.5 | 84.8 | 73.9 | 325.5 | 2,340.9 | 179.4 |
| SP-50K | 377.4 | 78.9 | 73.3 | 304.8 | 2,465.8 | 179.5 |
| MP-50K | 340.8 | 83.5 | 69.0 | 2,439.2 | 4,339.7 | 180.8 |
| SP-483K | 332.2 | 73.7 | 53.1 | 3,417.1 | 5,955.6 | 204.3 |
| SP-1M | 418.3 | 94.2 | 65.5 | 1,579.0 | 7,859.2 | 330.7 |
| SP-1.92M m2 | 413.7 | 81.3 | 67.5 | 707.9 | 8,343.6 | 419.1 |
| SP-1.92M m3 | 407.1 | 112.7 | 65.8 | 656.0 | 8,141.8 | 427.3 |
| SP-3.5M (m1 to m3) | 413.2 | 93.3 | 66.3 | 1,051.6 | 7,803.9 | 762.8 |
| MP-483K, desktop (m1 to m3) | 403.0 | 105.1 | 66.0 | 498.0 | 8,708.1 | 321.2 |
| **AX42** MP-10K | 210.9 | 52.0 | 41.4 | 298.7 | 615.5 | 59.2 |
| **AX42** MP-50K | 232.4 | 59.2 | 37.4 | 480.3 | 768.6 | 83.5 |
| **AX42** MP-483K | 226.6 | 60.5 | 33.6 | 570.9 | 813.2 | 521.8 |
| **AX42** MP-1M | 208.3 | 51.0 | 33.3 | 831.9 | 759.3 | 1,058.3 |
| **AX42** MP-1.92M | 206.0 | 54.1 | 33.6 | 1,290.2 | 949.6 | 1,958.0 |
| **AX42** MP-3.5M | 175.3 | 48.1 | 27.6 | 2,096.1 | 1,130.5 | 3,656.2 |

Source: `summary.csv` of each tier export (console sampler); for single-run tiers, the median of the three measured
runs. CPU is percent of one core, of 1,600 % available. The AX42 MP-1K window was too short to sample. On the AX42 the
orderer's memory stayed near 1 GB at every tier, against 5 to 9 GB on the desktop; the cause (Docker Desktop's VM
accounting against Docker Engine's cgroup accounting, or a real difference) was not investigated.

**Table 4.20. Capstone resource trace (10 s external sampler), SP-1.92M and SP-3.5M ballot windows, desktop.**

| Run | Ballot window (local) | Samples | Windows CPU max % (includes the WSL VM) | Contended samples (> 25 % excluding the VM) | peer0.org1 CPU % peak / mean | Orderer CPU % peak | Windows available memory min MB | WSL MemAvailable min GB | WSL load1 mean (of 16) | Disk busy mean % C: / Q: |
|---|---|---|---|---|---|---|---|---|---|---|
| warm-up | 16:41:56 to 17:32:41 | 304 | 87.3 | not VM-corrected (302 raw) | 400.2 / 261.4 | 94.5 | 40 | 21.8 | 16.9 | 23.4 / 47.5 |
| m1 (window includes the outage) | 18:38:48 to 19:50:35 | 364 | 89.1 | flagged: user at the machine (354 raw) | 400.0 / 252.0, one sample 1,506.1 at 19:02:29 | 118.7 | 227 | 21.6 | 14.0 | 130.4 / 49.4 |
| m2 | 20:45:44 to 21:36:19 | 303 | 85.3 | 0 (reclassified; preflight host CPU 2.8 %) | 404.1 / 262.8 | 85.0 | 594 | 21.8 | 15.6 | 15.9 / 49.2 |
| m3 | 22:32:51 to 23:23:49 | 303 | 81.0 | 0 (max 23.3 % excluding the VM) | 416.2 / 270.6 | 103.8 | 461 | 21.7 | 15.4 | 21.7 / 47.9 |
| SP-3.5M warm-up | 10-02 18:30:41 to 20:24:35 | 577 | 89.1 | 0 (max 17.4 %); overlapped a compression pass | 446.0 / 258.4 | 91.6 | 12 (1.6 at 21:04:52, after the window) | 21.4 | 16.9 | 836.7 / 109.7 |
| SP-3.5M m1 | 10-02 22:34:48 to 10-03 00:18:26 | 621 | 84.0 | 1 (max 30.3 %): minor spike, the run stands | 392.5 / 236.7 | 92.3 | 2,227 (998 at 00:38:18, after the window) | 21.4 | 15.3 | 3.4 / 82.8 |
| SP-3.5M m2 | 10-03 02:39:55 to 04:18:53 | 593 | 85.3 | 0 (max 12.9 %) | 420.9 / 259.5 | 90.2 | 2,730 (574 at 05:23:36, after the window) | 21.5 | 15.1 | 5.6 / 75.3 |
| SP-3.5M m3 | 10-03 12:17:41 to 13:57:51 | 600 | 81.3 | 0 (max 22.6 %) | 393.6 / 255.6 | 83.8 | 265 (at 13:37:01) | 21.4 | 15.2 | 11.0 / 72.5 |

Source: `resources.csv` and `resources-summary.txt` under `docs/desktop-runs/2026-10-01-sp-1.92m/<run>/` and
`2026-10-02-sp-3.5m/<run>/`; minima recomputed from `resources.csv` over each ballot window; `m2/NOTE.md` "Contention
(corrected 22:20)". Every Windows available-memory minimum is recomputed from `resources.csv` over the ballot window.
The controller's `bottleneck` line in each SP-3.5M `NOTE.md` (2, 998, 574 and 265 MB) is the minimum over the whole
trace, from reset to export: for the warm-up, m1 and m2 it fell after the window, during export and compression, at
the times shown in brackets; for m3 it fell inside the window. The SP-3.5M m1 contention rule was changed during the
capstone (from any sample above 25 % to more than 2 % of samples and at least six), before m1's result was used.

Across the tiers no single container used more than about a quarter of the 1,600 % of processor available. On the
desktop the peer peaked at 332 to 418 %, the orderer at 74 to 113 %. On the AX42 both peaked lower, the peer at 175 to
232 % and the orderer at 48 to 61 % (tier medians), while its non-run CPU never exceeded 5.2 % in any ballot window.

The capstone trace shows where the load went:
- The WSL guest's run queue sat near its 16 processors through the ballot window, with a mean load of 15.4 to 16.9.
  That figure includes the chaincode container, which peaked at 460 to 490 %.
- The guest never ran short of memory: at least 21.6 GB stayed available.
- Windows' own available memory fell to between 40 and 594 MB, because the WSL VM holds most of the 31.9 GB host.
- The orderer's memory grew with the ledger, to 8.1 to 8.3 GB at SP-1.92M.

The SP-3.5M trace repeats the pattern. The guest's run queue again sat at its 16 processors (mean 15.1 to 15.3 in the
measured runs), at least 21.4 GB of guest memory stayed available, and the data drive Q:, which holds the Docker
virtual disk, was busy 73 to 83 % of the window on average. Windows' own available memory fell to 265 MB in m3 and
stayed above 2.2 GB in m1 and m2 during the window; it fell lower after the window, during export (998 and 574 MB).
The SP-3.5M warm-up, which overlapped a background compression of earlier ballot files on the system drive, shows
what contention for that drive does: C: busy 837 % (summed over its queue), Windows memory down to 12 MB in the
window, and 515.7 TPS against 567 to 594 for the measured runs. The warm-up is discarded.

No resource was exhausted in any completed capstone run. Under the Chapter III rule there is therefore no scaling
limit to attribute at 3,524,078 voters on the desktop, or at 10,572,234 records on the AX42 (Scalability).

Network utilization is not reported. All containers shared one host, so the traffic never left the machine.

### Disk Consumption

**Table 4.21. Ledger size on disk (`du -sb` after each item).**

| Item | Ballot records on the network | peer0.org1 bytes | Orderer bytes | Peer bytes per record |
|---|---|---|---|---|
| MP-1K security | 3,000 | 39,610,500 | 156,573,468 | ~13,200 (setup overhead dominates) |
| MP-1K, 10 candidates (7 elections) | 21,000 | 439,655,321 | 789,804,807 | ~20,900 |
| MP-1K, 28 candidates (7 elections) | 21,000 | 984,940,185 | 1,593,866,795 | ~46,900 |
| SP-483K (measured, sweep, burst) | ~2,372,700 | 28,109,465,672 | 23,430,185,389 | ~11,850 |
| SP-1M (Night 2) | 3,000,000 | 35,483,116,738 | 29,132,099,100 | 11,828 |
| SP-1.92M warm-up | 1,921,917 | 22,903,711,701 | 19,184,885,715 | 11,917 |
| SP-1.92M m1 | 1,921,917 | 22,845,034,111 | 19,151,726,583 | 11,887 |
| SP-1.92M m2 | 1,921,917 | 22,839,034,598 | 19,070,735,690 | 11,884 |
| SP-1.92M m3 | 1,921,917 | 22,823,819,846 | 19,054,649,272 | 11,876 |
| SP-3.5M m1 / m2 / m3 | 3,524,078 | 41,798,752,107 / 41,813,320,324 / 41,811,890,212 | 34,082,780,983 / 34,097,231,319 / 34,096,955,505 | 11,861 / 11,865 / 11,865 |
| SP-483K fresh | 483,000 | 5,745,078,003 | 5,713,550,793 | 11,895 |
| MP-483K, desktop m2 | 1,449,000 | 17,318,244,014 | 14,699,220,218 | 11,952 |
| **AX42** MP-50K (7 elections, one network) | 1,050,000 | 12,480,862,968 | 11,061,193,155 | 11,887 |
| **AX42** MP-483K m2 | 1,449,000 | 17,282,676,226 | 14,922,072,692 | 11,927 |
| **AX42** MP-1M m2 | 3,000,000 | 35,741,459,967 | 29,347,941,378 | 11,914 |
| **AX42** MP-1.92M m2 | 5,765,751 | 68,871,405,835 | 55,679,522,845 | 11,945 |
| **AX42** MP-3.5M m2 | 10,572,234 | 126,189,443,279 | 101,082,301,433 | 11,936 |
| Rows 1K to 50K (desktop) | not measured (the per-run ledger column was not wired) | | | |

Source: `ledger-size.txt` of each item (`f2d8921`, `5aef011`, `475bdfb`, `3b87854`, `4f4a0d9`, `f8f5c34`;
`2026-10-02-sp-3.5m/`, `2026-10-07-483k-optional/`, `2026-10-04-ax42-mp-*/`). The other AX42 runs of each tier are
within 0.5 % of the m2 figures shown.

At four candidates the ledger costs 11.8 to 12.0 KB per ballot record on each peer, and the orderer about 9.6 to 10.3
KB at a million records and above *[demonstrated]*, on both machines and for single- and multi-position records
alike. The three copies of this test network together cost 33.4 to 34.2 KB per record from 483,000 voters up. The
per-record size grows with the candidate count: about 20.9 KB at 10 candidates and 46.9 KB at 28. The full MP-3.5M
election, the configuration the 2026-10-02 draft projected at about 356 GB, occupied 353.5 GB across the three copies.

On the desktop, the disk the host actually spent was about three times larger. Docker's virtual disk grows with every
block the guest writes for the first time after a compaction, including blocks rewritten by LevelDB compaction. The
measured growth, set out in Table 4.26, was 95 to 119 KB of host disk per record. The AX42 has no virtual disk: its
whole Docker root after an MP-3.5M run was 381.0 GB, 36.0 KB per record, close to the ledger itself.

### Capstone Outcome

**Table 4.22. Capstone outcome (primary finding).**

| Capstone | Configuration | Outcome | Evidence |
|---|---|---|---|
| 1,921,917 voters (three Zamboanga Peninsula provinces) | single-position, on-chain, desktop, 1 + 3 | **Completed.** Every election committed all ballots and decoded exactly (E = 0, verifier pass). m2 633.3 TPS and m3 637.1 TPS sustained, p99 460 and 430 ms, about 11.9 times the ten-hour arrival rate. m1 resumed after a host power loss, with no ballot lost; it is a correctness record only. No resource exhausted | Tables 4.3, 4.11, 4.14, 4.20 |
| 3,524,078 voters (full ZAMBASULTA) | single-position, on-chain, desktop, 1 + 3 | **Completed.** 3,524,078 ballots committed in every run, 0 dropped, E = 0, ledger matching local, verifier pass. Median 586.4 TPS (567.2 to 593.7), p99 486.9 ms, 6.0 times the arrival rate; about 1 h 40 min of ballot window per run. One m2 attempt cut by a power loss during generation was discarded and rerun. No resource exhausted | Tables 4.3, 4.11, 4.14, 4.20 |
| 1,921,917 voters | multi-position, offline, desktop, 0 + 1 | **Completed.** 5,765,751 records generated and verified, E = 0 on 12 contests, in 0.86 h | Tables 4.3, 4.17 |
| 3,524,078 voters | multi-position, offline, desktop, 0 + 1 | **Completed.** 10,572,234 records generated and verified, E = 0 on 12 contests, in 1.63 h | Tables 4.3, 4.17 |
| 1,921,917 voters | multi-position, on-chain, AX42, 1 + 3 | **Completed.** 5,765,751 records per run, 0 dropped, E = 0. Median 464.9 TPS (456.7 to 513.4), p99 390.4 ms, 2.9 times the arrival rate. No host bottleneck | Tables 4.3, 4.14 |
| 3,524,078 voters | multi-position, on-chain, AX42, 1 + 3 | **Completed.** 10,572,234 records per run, 0 dropped, E = 0, ledger matching local, verifier pass. Median 423.9 TPS (421.0 to 429.2), p99 448.9 ms, 1.4 times the arrival rate; about 6 h 55 min of ballot window and 9.8 h per run. 353.5 GB of ledger across the three copies. No host bottleneck | Tables 4.3, 4.14, 4.21 |

Every capstone was completed. At 3,524,078 voters, the full ZAMBASULTA electorate, the system committed every ballot,
decrypted an exact tally and was independently verified, single-position on the desktop and three-position on the
AX42, while sustaining 6.0 and 1.4 times the ten-hour election-day arrival rate *[demonstrated]*. The first capstone,
at 1,921,917 voters, sustained about 12 times the arrival rate single-position and 2.9 times multi-position.

The repetition cut by a power loss counts as a finding about recovery, not a scaling limit:
- Windows logged Kernel-Power Event 41 with no bugcheck and no power-button press, the second that day. The System
  log holds ten such events since 24 September.
- The resource trace up to the cut shows no exhaustion: in its last samples Windows had 3.3 to 3.5 GB available and
  the guest 22.2 GB.
- The cut is therefore attributed to the host's power supply, which is suspected. The trace cannot by itself rule
  out a hard hang.

The run then recovered on its own ledger, with nothing lost and nothing double-counted. The power events continued
during the second capstone (2026-10-03 02:12, during m2's generation, and 11:15, with nothing running) and once more
on 2026-10-08 (Reliability); none lost a ballot.

The 1.4-times margin of the on-chain MP-3.5M capstone is the smallest in the study. It is measured under a closed loop
of 128 records in flight on one machine that hosts every node, so it is a sustained rate for that load, not a
saturation figure (the SP-483K sweep found saturation about 20 % above the closed-loop median, Table 4.16). The
desktop could not hold this election: the measured per-record host-disk cost of its virtual disk exceeded its drive.
That is a statement about the desktop host, not a scaling limit of the system, and the AX42, with no virtual disk,
held it in 381 GB.

### Candidate-Count Check

**Table 4.23. Per-record cost against candidates per position, MP-1K (3,000 records per election).**

| Candidates | Campaign | Generation CPU ms | Proof generation CPU ms | Verification ms (16 threads) | Submission window ms | p50 latency ms | Committed TPS |
|---|---|---|---|---|---|---|---|
| 4 | `campaign-20260929-180218-15` | 2.51 | 1.61 | 0.176 | 1.08 | 146.7 | 924.6 |
| 10 | `campaign-20260930-173157-4` | 5.73 | 3.98 | 0.395 | 1.86 | 230.9 | 536.5 |
| 28 | `campaign-20260930-175515-8` | 15.26 | 10.99 | 1.084 | 3.37 | 455.5 | 297.2 |
| Fit (fixed + per candidate k) | | 0.40 + 0.531k | 0.06 + 0.390k (R² 0.99999) | 0.020 + 0.0380k (R² 0.99992) | 0.81 + 0.092k (R² 0.990) | 98.9 + 12.77k (R² 0.999) | R² 0.836 (linear) |

Source: `summary.csv` medians / 3,000 of the three campaigns (`8739722`, `f2d8921`);
`docs/desktop-runs/2026-10-01-night1.md` section 2.

**Figure 4.3. Per-record time against candidates per position, MP-1K, with least-squares lines.**
`docs/paper/ch4-figures/fig-4-3-candidates.png` (still holds: same three campaigns).

The cryptographic cost per record is linear in the candidate count over a sevenfold range, with near-zero intercepts
*[demonstrated]*. Each candidate slot carries one ciphertext and one disjunctive proof, at about 0.39 ms of
generation and 0.038 ms of verification. The submission window per record is linear with a large fixed part (0.81 ms
plus 0.092 ms per candidate), so throughput fell from 924.6 to 297.2 TPS while proof generation grew 6.8 times.

These figures come from three points, so they show a trend rather than a validated model. The 10- and 28-candidate
campaigns were flagged for host CPU (a browser was running), which affects their throughput more than their CPU
times. A Philippine ballot with more candidates per position will cost more per record, in close to linear
proportion, and commit fewer records per second.

### Election-Day Arrival Rate

**Table 4.24. Committed throughput against the ten-hour arrival rate.**

| Tier | Voters | Arrival, records/s | Committed TPS (median) | Margin |
|---|---|---|---|---|
| SP-1K | 1,000 | 0.03 | 893.9 | 32,181x |
| MP-1K | 1,000 | 0.08 | 924.6 | 11,095x |
| SP-10K | 10,000 | 0.28 | 885.8 | 3,189x |
| MP-10K | 10,000 | 0.83 | 789.3 | 947x |
| SP-50K | 50,000 | 1.39 | 697.3 | 502x |
| MP-50K | 50,000 | 4.17 | 570.3 | 137x |
| SP-483K | 483,000 | 13.42 | 509.0 (slowest 450.2) | 37.9x (33.6x) |
| SP-1M | 1,000,000 | 27.78 | 574.5 | 20.7x |
| SP-1.92M | 1,921,917 | 53.39 | 633.3 (m2), 637.1 (m3) | 11.9x |
| SP-3.5M | 3,524,078 | 97.89 | 586.4 (slowest 567.2) | 6.0x (5.8x) |
| SP-483K fresh (optional) | 483,000 | 13.42 | 583.3 | 43.5x |
| MP-483K, desktop (optional) | 483,000 | 40.25 | 636.0 | 15.8x |
| **AX42** MP-1K | 1,000 | 0.08 | 830.1 | 9,961x |
| **AX42** MP-10K | 10,000 | 0.83 | 835.4 | 1,002x |
| **AX42** MP-50K | 50,000 | 4.17 | 820.4 | 197x |
| **AX42** MP-483K | 483,000 | 40.25 | 553.9 | 13.8x |
| **AX42** MP-1M | 1,000,000 | 83.33 | 473.5 | 5.7x |
| **AX42** MP-1.92M | 1,921,917 | 160.16 | 464.9 (slowest 456.7) | 2.9x (2.9x) |
| **AX42** MP-3.5M | 3,524,078 | 293.67 | 423.9 (slowest 421.0) | 1.44x (1.43x) |

Source: arrival = voters x positions / 36,000 s (Chapter III; `run.end` `arrival_tps`); TPS from Table 4.14.

The console's own `scaling_limit` verdict reads "inconclusive" in closed loop by construction, including on every
run from SP-483K up on both machines. The measured TPS is therefore compared with the arrival rate directly. Every
tier sustained more than the rate a ten-hour election day would impose *[demonstrated]*: at least 6.0 times
single-position, and 1.44 times for the full-region three-position election, whose slowest run still committed 1.43
times the arrival rate. No tier meets Chapter III's scaling-limit rule. The margin narrows with the size of a
multi-position election because the arrival rate grows with voters times positions while the AX42's sustained rate
falls (Scalability); on this one-machine deployment, a three-position election much larger than ZAMBASULTA would
approach the arrival rate. That extrapolation is not measured.

### Predicted Against Measured

**Table 4.25. Predicted against measured, per tier: run time, throughput and arrival margin.**

| Tier | Predicted h/run (cost model, fitted at ef663d1) | Measured h/run (first to last journal line) | Error | Throughput assumed (fit: 1/s; CLAIMS) | Measured TPS | Margin predicted at ~1,000 TPS (CLAIMS) | Margin measured |
|---|---|---|---|---|---|---|---|
| SP-483K | 0.309 | 0.480 (0.458, 0.480, 0.490) | +55 % | 805; ~1,000 | 509.0 | 74.5x | 37.9x |
| SP-1M | 0.632 | 0.939 (0.858, 0.939, 0.965) | +49 % | 805; ~1,000 | 574.5 | 36.0x | 20.7x |
| SP-1.92M | 1.207 | 1.622 (m2), 1.599 (m3) | +34 %, +32 % | 805; ~1,000 | 633.3, 637.1 | 18.7x | 11.9x |
| SP-3.5M | 2.195 | 3.097 (3.077, 3.097, 3.109) | +41 % | 805; ~1,000 | 586.4 | 10.2x | 6.0x |
| MP-483K offline | 0.628 | 0.198 | -68 % | n/a | | | |
| MP-1M offline | 1.300 | 0.439 | -66 % | n/a | | | |
| MP-1.92M offline | 2.495 | 0.861 | -65 % | n/a | | | |
| MP-3.5M offline | 4.547 | 1.627 | -64 % | n/a | | | |
| MP-3.5M on-chain (AX42) | 6.572 (desktop fit) | 9.768 (9.689, 9.768, 9.807) | +49 % | 805; ~1,000 | 423.9 | 3.4x | 1.44x |

Source: `docs/desktop-runs/cost-model.md` section 3 (fitted on rows 2 to 4 at ef663d1; submit coefficient `s` 1.243
ms/record, that is 805 records/s); `docs/CLAIMS.md` RQ3 rows (~1,000 TPS; 10x and 3.4x margins); journals of each run
(first to last line). The MP-3.5M on-chain prediction was fitted on the desktop and the run is on the AX42, so its
error mixes model and machine.

**Table 4.26. Predicted against measured: disk.**

| Quantity | Predicted or planned | Measured | Source |
|---|---|---|---|
| Peer ledger per record, 4 candidates | 12,000 B (preflight projection) | 11,828 B (SP-1M); ~11,850 B (SP-483K); 11,876 to 11,917 B (SP-1.92M) | Table 4.21 |
| Ledger per million single-position ballots | 30 to 50 GB (Table 3.12) | 11.8 to 11.9 GB per peer copy; 33.4 to 33.7 GB across the three copies | Table 4.21 |
| Ledger across three copies per record | 34 KB (Night 2 budget); ~36 KB (Night 1 index) | 33.4 KB (SP-1M); 33.7 KB (SP-1.92M m3) | `ledger-size.txt` |
| Host disk growth per record | 34 KB (Night 2 budget, implicitly); 101 KB (SP-3.5M disk rule, 396 GB per run) | ~95 KB (SP-1M, at 2.0M records); ~101 KB (SP-1M, 3.0M records); 98.3, 118.8 and 110.3 KB (SP-1.92M warm-up, m2, m3); 111.7, 119.2, 109.3 and 102.4 KB (SP-3.5M warm-up, m1, m2, m3), each from a freshly compacted disk. The rule was raised to 120 KB per record after SP-3.5M m1 took about 419 GB of Q:. AX42 (no virtual disk): 36.0 KB (Docker root after MP-3.5M m2) | study log 13:32, 14:48, and "Capstone 2" 00:40; `NOTE.md` "Disk after" against the start lines; AX42 `ledger-size.txt` `docker-root` |
| Disk for MP-3.5M on-chain | 150 GB provisioned (Table 3.12); about 356 GB of ledger projected (2026-10-02 draft) | 353.5 GB of ledger across the three copies; Docker root 381.0 GB on the AX42 | Tables 4.21 and 4.22 |

The linear model held where it modelled work per record. Per-record cryptographic cost was constant from 1,000 voters
to 10,572,234 records (Table 4.15). Per-record cost was linear in the candidate count with R² of at least 0.9999
(Table 4.23). Ledger bytes per record were constant across tiers and machines and within 2 % of the preflight
projection, and the projected 356 GB for the MP-3.5M ledger came within 1 % of the measured 353.5 GB.

It did not hold in four places:
- **Throughput.** The model assumed about 805 records/s and CLAIMS about 1,000; the measured rates were 509 to 637 on
  the desktop and 424 to 554 on the AX42 from 483,000 voters up. This made every on-chain run 32 to 55 % longer than
  predicted (SP-3.5M +41 %, MP-3.5M +49 %) and roughly halved the predicted arrival margins.
- **Offline runs.** The model over-predicted the offline tiers by about a factor of three (-64 to -68 %); they finished
  in 0.20 to 1.63 h against 0.63 to 4.55 h predicted. The offline prediction was never a fit: `cost-model.md`
  derived it as single-point ratios from one MP-10K offline run (`offline-mp-10k-20260910-211140-1`), with no
  confidence interval, and stated that row 8 had no validation until a second offline tier ran. The four offline tiers
  now supply that validation, and it fails.
- **Build.** The study build ran slower than the build the model was fitted on (Table 4.28), so the error mixes model
  and build.
- **Host disk.** On the desktop it was not linear in the ledger. The virtual disk grew about three times faster than
  the data it held, and Table 3.12's 150 GB provision for the full-ZAMBASULTA multi-position run is far short of the
  353.5 GB that run measured on the AX42.

The "linear cost model" claim should therefore be stated for per-record computation and ledger size. Throughput and
host disk should be reported as measured.

### Cross-Study Comparison with [18]

**Table 4.27. Cross-study comparison (not a controlled experiment: different hardware and deployment).**

| System | Scale and workload | Throughput | Latency | Hardware |
|---|---|---|---|---|
| Galal, El Reheem and Guirguis [18] | 50,000 voters, single race of four candidates, Hyperledger Fabric | ~4.66 TPS | ~1.07 s per vote | Different from this study |
| BalotaChain SP-50K | 50,000 voters, one position, four candidates, Fabric 2.5.15 | 697.3 TPS (median) | p50 163 ms, p99 417 ms | Table 4.1 |
| BalotaChain SP-1M | 1,000,000 voters, one position | 574.5 TPS (median) | p50 230 ms, p99 482 ms | Table 4.1 |
| BalotaChain SP-1.92M | 1,921,917 voters, one position | 633.3 and 637.1 TPS (m2, m3) | p50 182 to 183 ms, p99 430 to 460 ms | Table 4.1 |
| BalotaChain SP-3.5M | 3,524,078 voters, one position | 586.4 TPS (median) | p50 226 ms, p99 487 ms | Table 4.1, desktop |
| BalotaChain MP-3.5M | 3,524,078 voters, three positions (10,572,234 records) | 423.9 TPS (median) | p50 319 ms, p99 449 ms | Table 4.1, AX42 |
| [18], beyond one million voters | projection | [PENDING: [18] beyond-one-million projection figure, quoted from the source] | | |
| Fabric 2.5 benchmark [24] | Fixed-asset workload, one million assets | ~3,000 TPS peak | | Different from this study |
| ElGamal homomorphic tally on Fabric [26] | Closest prior encrypted-tally evaluation | ~40 TPS peak | | Different from this study |

Source: manuscript, Performance section (pp. 60 to 61); Table 4.14.

This is a cross-study comparison, not a controlled experiment, because the hardware and deployment differ. At the
50,000-voter tier used for the direct comparison, BalotaChain committed 697.3 ballots per second against the
approximately 4.66 TPS of [18]. That is about 150 times as many, at a median latency of 163 ms against about 1.07 s
per vote. The figures also lie between the two reference points of Chapter III, above the approximately 40 TPS of
[26] and below the approximately 3,000 TPS of [24].

Three caveats apply:
- [18]'s per-vote time may not measure the same interval as submit-to-commit latency.
- BalotaChain's figures come from one machine that hosted every node and the load generator.
- The figures in this table are specific to the build: the study build ran 9 to 28 % slower than an earlier one
  (Table 4.28).

### Performance Log Analysis: Findings About the Instrument

The Performance log analysis experiment checks that the logs are consistent with the reported metrics. It found
five things that qualify the figures above.

**Table 4.28. Committed throughput on the study build against the earlier build ef663d1.**

| Tier | ef663d1 TPS | 4a38a54 TPS | Difference |
|---|---|---|---|
| SP-1K | 1,004.09 | 893.92 | -11.0 % |
| MP-1K | 1,011.79 | 924.61 | -8.6 % |
| SP-10K | 968.99 | 885.85 | -8.6 % |
| MP-10K | 954.69 | 789.35 | -17.3 % |
| SP-50K | 933.32 | 697.35 | -25.3 % |
| MP-50K | 793.02 | 570.29 | -28.1 % |

Source: `docs/desktop-runs/2026-09-12-rows2-4-parallel.md` section 7 (main); Table 4.14.

**Table 4.29. Measured repetitions with multi-second in-network stalls.**

| Tier | Campaign | Repetition | Committed TPS | p99 ms | Longest checkpoint gap s | Host CPU start / end % |
|---|---|---|---|---|---|---|
| MP-10K | `campaign-20260929-191104-23` (standing) | m6 | 460.672 | 2,903.0 | 10.6 | 13.7 / 1.9 |
| MP-10K | `campaign-20260929-191104-23` (standing) | m7 | 625.552 | 1,960.1 | 9.4 | 18.2 / 3.9 |
| SP-50K | `campaign-20260929-195715-27` (standing) | m3 | 613.702 | 1,785.0 | 4.8 | 2.9 / 5.8 |
| SP-50K | `campaign-20260929-193508-25` (superseded) | m2 | 642.827 | 698.0 | 6.3 | 2.4 / 11.0 |
| SP-50K | `campaign-20260929-193508-25` (superseded) | m3 | 590.038 | 2,005.0 | 7.8 | 4.4 / 8.6 |
| SP-483K | `campaign-20260930-185730-11` | m3 | 450.201 | 595.2 | 21.2 | 3.1 / 2.9 |

Source: `docs/desktop-runs/2026-09-30-ch4-study.md` section 2(c) (`8739722`); `docs/desktop-runs/2026-10-01-sp-483k.md`
section 3.

1. **The build difference.** The study build was 9 to 28 % slower than ef663d1 on the same six tiers and machine,
   and the gap widened with scale. The study did not isolate the cause, and this is a stated limitation: isolating it
   needs a new measured A/B run of both builds on one network, which the researchers deferred and which was not
   performed. The two sets of figures are not pooled.
2. **Throughput follows the accumulated ledger, and the host's state.** Throughput fell repetition over repetition
   wherever repetitions shared a desktop network (SP-483K, SP-1M), was highest on fresh networks (SP-1.92M; SP-1M m1),
   and a fresh-network SP-483K rerun committed 583.3 TPS against 509.0. On the AX42, by contrast, seven MP-50K
   repetitions on one network (1,050,000 records) stayed at 820 TPS, and a long run on a fresh network still fell to
   a plateau. The desktop's MP-50K night was also run on an uncompacted virtual disk under self-load. See Scalability
   and Second Environment.
3. **The contention rule counted the run's own load, twice.**
   - The guest load average flagged every repetition from 10,000 voters up, because it includes the run's own
     generation and audit. From Night 1 the rule used host CPU alone.
   - During the capstone, Windows' total processor time was found to include the WSL VM that runs the election, so
     every sample of an unloaded run read above 25 %.
   - The rule now subtracts the VM's processor time. Repetition 2 was reclassified as not contended, and repetition 3
     recorded none.
   - During the SP-3.5M capstone the rerun rule was changed once more, from any sample above 25 % to more than 2 %
     of the window's samples and at least six (one minute), because one 10 s spike cannot move a 100-minute window.
     SP-3.5M m1 (1 of 621 samples) stands under it. The AX42 used the same rule on its own non-run CPU and never
     triggered it.
   - "Contended" is cited as interference in this chapter only where a corrected host sample or the study log
     supports it.
4. **In-network stalls.** Six measured repetitions stalled for 4.8 to 21.2 s between progress checkpoints while host
   CPU was low (Table 4.29). The tail rose, and the median did not. The cause lies inside the Fabric and Docker stack
   and was not identified. From Night 1, peer and orderer logs are kept for every run, but they have not been
   analysed.
5. **The host environment can fail a run that the system would complete.** In Night 1 the host data drive filled
   during SP-1M:
   - Docker's virtual disk could not grow, so the guest took the disk offline.
   - SP-1M m2 lost its last 67,300 ballots, and m3 found no peer.
   - Nothing in the instrument checked the host drive: the preflight reads the run store, and the guest sees the
     virtual disk's nominal 1 TB.

   After this, each capstone repetition ran on a freshly reset network, preceded by a host-disk check and, when
   needed, a compaction. The superseded attempt is kept and excluded. During SP-3.5M the controller found a second
   drive at risk (C:, which holds the guest's own disk) and stopped before m3 rather than start it short of space;
   ballot files were then compressed losslessly (zstd, every file hash-checked before the original was removed) and
   archived. The multi-position on-chain tiers were moved to the AX42 for the same reason.

---

## Summary of Findings

**Table 4.30. Findings against the objectives.**

| Objective | Finding | Status |
|---|---|---|
| 1. Implement the framework and verify correct end-to-end operation across scales | E = 0, no ballot lost, ledger matching the local record, and a passing verifier on every election from 1,000 to 3,524,078 voters, single-position (desktop) and three-position (AX42 on-chain and desktop offline), warm-ups included; also under a peer restart, a peer and orderer kill, injected network loss and host power losses; the full-region record reproduced on a second machine | Met at every tier |
| 2. Evaluate integrity, privacy and security under the threat model | 8 of 8 mounted attacks refused or detected at the declared gate in each of four attack-timeline runs (5 live), to MP-1M; tampered transcript and partial committed then detected, sub-threshold publication and outside-membership submission refused live; 11 of 14 catalogue cases exercised; 0 identity linkages over 3,524,078 voters; limits demonstrated: no caller authorization (front-running), plain-HTTP console, totals bound by signatures only; reordering detected only by an auditor check merged after the study (`37035f9`); CI at 4a38a54 green (270 Rust tests, Go tests with the race detector, lint, `cargo audit`), with five advisory govulncheck findings in the chaincode's gRPC dependencies | Met for the mounted scenarios, with the stated limits |
| 3. Characterize performance and compare with a baseline on the same platform | Desktop: 509 to 925 TPS, p99 208 to 538 ms; plateau 610.9 TPS and burst completed at SP-483K; capstones at 633 to 637 (SP-1.92M) and 586.4 (SP-3.5M) TPS. AX42: 820 to 835 TPS to MP-50K, falling to 423.9 at MP-3.5M, p99 208 to 449 ms. No resource exhausted on either machine; every tier above the ten-hour arrival rate (MP-3.5M by 1.44 times); per-record crypto cost flat with scale and linear in candidates; validation gate under 1 s at every tier; about 150 times the throughput of [18] at 50,000 voters (cross-study) | Met at every tier, on two single-machine deployments |

The framework operated correctly at every tier, up to the full ZAMBASULTA electorate of 3,524,078 voters in both the
single- and the three-position election:
- every announced tally equalled the ground truth;
- every accepted ballot was counted;
- every proof verified;
- the result was reproduced from the ledger's own record, and on a second machine from the public record alone.

It refused or detected every mounted attack at the gate declared for it, within the coverage and limits of Tables
4.7a and 4.10. On single machines that hosted the whole network, throughput stayed above the ten-hour arrival rate at
every tier: at least 6.0 times single-position, and 1.44 times for the full-region three-position election, the
tightest margin in the study, with no resource exhausted.

---

## Appendix A Ground Truth (500 voters, 4 candidates, single position)

Re-verified on 2026-10-02 with the study build's generator (`saksi-demo` SHA-256 `112fffa0124943a4...`, saksi
`4a38a54`, WSL), using the plaintext-only path that writes the same population `gen` does:

```
saksi-demo gen-ground-truth --voters 500 --positions 1 --candidates 4 --distribution <profile> --out-dir <dir>
```

| Candidate | uniform | skewed | realistic |
|---|---|---|---|
| CAND_PRES_01 | 125 | 250 | **245** |
| CAND_PRES_02 | 125 | 84 | **90** |
| CAND_PRES_03 | 125 | 83 | **85** |
| CAND_PRES_04 | 125 | 83 | **80** |
| Total | 500 | 500 | 500 |

**Every Chapter IV run used `realistic`** (`run.json` `config.distribution`). The 250 / 84 / 83 / 83 currently in
Appendix A is still the correct output of the `skewed` profile. The tie-breaking change added `realistic` and left
the two original profiles unchanged, which a test pins (`fixtures.rs` `existing_profiles_are_untouched`). It is not
the distribution the study measured.

**The selection rule, in plain terms.**

- **Uniform.** Voter v chooses candidate (v + p) mod C for position p, so every candidate gets the same count.
- **Skewed.** Even-numbered voters choose the first candidate. Odd-numbered voters rotate over the others, so all
  the losing candidates end level.
- **Realistic.** This is the skewed rule with a reserved portion of the electorate held back and apportioned down
  the candidate ranks.
  - The reserved share is 10 % for the first position, 15 % for the second and 20 % for the third, repeating.
  - **The first floor:** the reserve is never smaller than C x (C + 1) voters, two votes per adjacent rank, so the
    spread between candidates cannot be finer than the rotation's own one-vote wobble.
  - The remaining voters vote by the skewed rule.
  - The reserve is shared out in proportion to C, C - 1, ..., 1 (4 : 3 : 2 : 1 for four candidates), and any integer
    remainder is dealt one vote at a time from the top rank down.
  - The reserved voters are taken out of the electorate, not added, so each voter still votes exactly once and every
    position's total equals the number of voters.
  - **The second floor:** if the first candidate does not lead after apportionment, one vote moves to it from the
    lowest-ranked candidate holding any. This guarantees a clear winner even in a very small electorate.
  - Voters are then placed into the candidate quotas through a permutation of the voter index (a golden-ratio stride
    made coprime to V). The counts are exact, and the ballot table reads as a mixed electorate rather than sorted
    runs.
  - All of this is integer arithmetic, so the result is the same on every machine.

**Worked example (V = 500, C = 4, first position).**
1. The reserve is max(50, 20) = 50, leaving 450 voters.
2. The skewed rule over 450 voters gives 225 / 75 / 75 / 75.
3. The reserve, split 4 : 3 : 2 : 1, adds 20 / 15 / 10 / 5.
4. The result is 245 / 90 / 85 / 80. The second floor does not trigger.

Three amendments follow for Appendix A:
- It should name three profiles, not two, and show `realistic` beside the existing table.
- The "pure arithmetic function" sentence should add the voter count V, because `realistic` apportions over the
  whole electorate and its stride depends on V.
- It should state that `realistic` was introduced in de79b0f and simplified in 3d8797e.

Source: `.superpowers/sdd/2026-09-14-study-grade-wizard/adviser-items-5-6.md`, item 6 (rule with `fixtures.rs` line
references at 4a38a54); counts re-run as above.

---

## Open Placeholders

Placeholders 1 to 11 and 13 to 16 are closed: SP-3.5M (1), the four offline MP tiers (2 to 5), RQ1(e) by A6 (6), the
privacy linkage join by A7 (7), the CI log at 4a38a54 (8, GitHub Actions run 36567167973), the sub-threshold
demonstration at the chaincode by A2 (9; the console's own 2-of-5 refusal merged after the study as `83c78bd`),
Figures 4.1 and 4.2 regenerated with both machines as separate series (10, 11), the ef663d1 A/B run restated as a
limitation (13), the SSH flood record (14), the Windows Kernel-Power record of 2026-10-08 (15), and reordering detection
on a merged build (16: PR #58 merged as `37035f9`, tree identical to `640a7b2`; the study runs remain at 4a38a54).
The open item is:

| # | Placeholder | Where | What closes it |
|---|---|---|---|
| 12 | [PENDING: [18] beyond-one-million projection figure, quoted from the source] | Table 4.27 | Quote [18]'s projected figure beyond one million voters, with page, from the reference itself; the reference is not in the repository, and the manuscript names the projection without giving its value |
