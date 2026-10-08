# Desktop vs AX42 at MP-483K: why the desktop was faster

Analysis only, from existing evidence. No new runs. Written 2026-10-08.

Sources:
- Desktop MP-483K: `balotachain-n2/docs/desktop-runs/2026-10-07-483k-optional/mp-483k-{warmup,m1,m2,m3}/`
  (perf.csv, summary.csv, journal.ndjson, resources.csv) and `C:\Users\User\ch4-capstone\controller.log`.
- AX42 MP-483K and MP-50K / MP-1M: `balotachain-n2/docs/desktop-runs/2026-10-04-ax42-mp-{483k,50k,1m}/`,
  `/root/ch4-ax42/controller.log` on the server.
- Desktop MP-50K (2026-09-30, attempt 1, runs `mp-50k-ch4-20260929-*-169..175`): journals in WSL
  `~/.saksi/campaign/runs/`, campaign config from `~/ch4/exports/campaign-20260929-201819-29.zip`,
  narrative in `ch4-study-log.md` lines 129-133.
- Throughput-over-time numbers below come from the `ballots.progress` events (one per 1,000 records) and
  the per-container `sample` events in each run's `journal.ndjson`.

## 1. Like-for-like check

| Item | Desktop MP-483K (2026-10-07/08) | AX42 MP-483K (2026-10-03/04) |
|---|---|---|
| saksi / console commit | 4a38a54 | 4a38a54 |
| saksi-demo binary sha256 | 112fffa0... (own build) | 429868b6... (own build) |
| Go (console) | go1.23.4 | go1.23.4 |
| Preset | 3 positions x 4 candidates, 5 trustees t=3, `realistic` | same |
| Load | closed loop, concurrency 128, send_rate 0 | same |
| Orderer batch | 50 msgs / 2 s / 2 MB, snapshot 256 MB | same |
| Protocol | 1 warm-up + 3 measured, each on its own fresh network | same |
| Before each run | network wipe, **Docker VHDX compaction (≈15 GB) and Docker Desktop relaunch**, then reset | network reset only; Docker never restarted |
| CPU | AMD Ryzen 7 5700G (Zen 3, 8C/16T, 65 W), Windows "High performance" plan | AMD Ryzen 7 PRO 8700GE (Zen 4, 8C/16T, 35 W), amd-pstate-epp, EPP `performance` (read 2026-10-08) |
| Memory | WSL VM 24 GB (host 32 GB), swap 0 | 64 GB, swap 0 |
| Storage | ext4 in a VHDX on the NVMe (Q:) | ext4 on 2 x NVMe RAID0 (md2), no `discard`; first fstrim ran 2026-10-05 00:58, after all MP runs, and trimmed 657.8 GiB |
| Docker / kernel | Docker Desktop 29.7.2, WSL2 kernel 6.18 | Docker Engine 29.8.2, Ubuntu kernel 6.8 |
| Contention (rerun rule) | m1/m2/m3: 1 of 236, 0 of 228, 0 of 229 samples over 25 % host-minus-VM: runs stand | 0 of 260-262 non-run CPU: runs stand |

Same build, preset, concurrency and batch parameters. The differences are the hardware, the
virtualization layer, and the per-run host preparation (the desktop compacted and relaunched Docker
before every run; the AX42 did not).

## 2. Headline numbers (perf.csv)

| Run | committed TPS | driver ceiling | min | p50 | mean | p95 | p99 | stddev (ms) |
|---|---|---|---|---|---|---|---|---|
| Desktop m1 | 613.3 | 671.9 | 72.8 | 190.5 | 208.6 | 301.8 | 456.9 | 67.5 |
| Desktop m2 | 636.2 | 711.8 | 73.5 | 179.8 | 201.1 | 281.3 | 421.4 | 65.4 |
| Desktop m3 | 636.0 | 708.4 | 79.8 | 180.7 | 201.1 | 282.1 | 396.5 | 62.7 |
| AX42 m1 | 557.7 | 617.1 | 100.2 | 207.4 | 229.4 | 297.6 | 326.9 | 54.9 |
| AX42 m2 | 553.9 | 614.4 | 103.0 | 208.3 | 231.0 | 299.8 | 327.4 | 55.5 |
| AX42 m3 | 553.9 | 594.9 | 103.5 | 215.1 | 231.0 | 302.3 | 335.8 | 56.1 |

**TPS is set by mean latency, not p99.** The driver is closed-loop with 128 records in flight, so by
Little's law committed TPS = 128 / mean latency: 128 / 0.2011 s = 636.6 (desktop m2, measured 636.2);
128 / 0.2294 s = 558.0 (AX42 m1, measured 557.7). The desktop has a lower floor (min 73-80 vs
100-103 ms), a lower median and a lower mean, and a heavier tail (stddev 63-67 vs 55-56 ms, p99 397-457
vs 327-336 ms). The tail is a few percent of records and barely moves the mean, so the AX42's better
p99 does not buy throughput. The AX42 is not hitting the driver ceiling either (557.7 vs 617.1; the
ceiling is 128 / median, which moves with the network's latency, not a fixed driver limit).

Neither host is CPU-saturated in the ballot window: AX42 host CPU mean 32.4 % (max 47.1 %), load1
mean 11.5 of 16; desktop WSL VM mean ≈ 825 % of 1,600 %, WSL load1 mean 15.4 of 16. AX42 md2
`w_await` stays at 0.2-0.4 ms and `%util` ≈ 58 % for the whole window.

## 3. What the time series shows: two regimes, desktop faster in both

Every 483K run on both machines has a **fast phase** at the start of the window and then a **sharp
drop to a flat plateau** that lasts the rest of the window. TPS per tenth of the run's records:

| Run | deciles 1-10 (TPS) |
|---|---|
| AX42 m1 | 820, 621, 535, 532, 531, 529, 528, 529, 527, 526 |
| AX42 m2 | 817, 618, 533, 528, 527, 525, 525, 524, 524, 523 |
| AX42 m3 | 820, 621, 534, 533, 530, 528, 528, 527, 501, 524 |
| Desktop m1 | 924, 818, 634, 578, 575, 582, 571, 553, 549, 539 |
| Desktop m2 | 938, 862, 680, 560, 590, 596, 593, 584, 587, 568 |
| Desktop m3 | 813, 868, 662, 591, 599, 588, 586, 580, 572, 565 |

| | Desktop m1 / m2 / m3 | AX42 m1 / m2 / m3 |
|---|---|---|
| Fast-phase rate (first full minute) | ≈ 930-950 (m3 started lower) | ≈ 820 |
| Drop occurs at | 340 / 370 / 420 s (≈ 295-351K records, 20-24 % of the run) | 230 s each (≈ 187K records, 13 %) |
| Plateau (50-95 % of the window) | 558 / 587 / 578 | 528 / 524 / 520 |

So the desktop wins 483K for two measured reasons, in roughly equal parts:

1. **A higher rate in both regimes**: about 15 % higher in the fast phase (≈ 940 vs 820) and about
   10 % higher on the plateau (≈ 575 vs 524).
2. **A longer fast phase**: the desktop stays fast for 20-24 % of the records, the AX42 for 13 %.

At the drop the peer's disk writes per record roughly double on both machines while the orderer's stay
flat (docker block-out counters from the journal samples):

| | peer0.org1 KB written per record, before -> after the drop | orderer KB/record |
|---|---|---|
| AX42 m1 | ≈ 157-163 -> ≈ 310-330 | ≈ 37 throughout |
| Desktop m2 | ≈ 79-94 -> ≈ 135-150 | ≈ 18.5 throughout |

(The AX42 counters run at exactly 2x the desktop's for the orderer, whose writes are just the blocks,
so the AX42's cgroup block counter almost certainly counts each write twice on md RAID0. Compare the
ratios, not the absolute bytes: peer/orderer goes from ≈ 4.2 to ≈ 8.5 on the AX42 and from ≈ 4.3 to
≈ 7.4 on the desktop.) AX42 host `wkB/s` on md2 is about the same before and after the drop
(183 -> 189 MB/s) while TPS falls 808 -> 533, so each record costs more disk work after the drop.
On the desktop the extra writes start at ≈ 180 s but TPS holds until ≈ 400 s; in the same minutes
Windows available memory falls to ≈ 2.2 GB and Q: % disk time climbs from ≈ 11 % to ≈ 48 %.

## 4. Why MP-50K went the other way

MP-50K is 150,000 records per rep, about 180 s at 820 TPS: **shorter than the AX42's fast phase**.
All seven AX42 MP-50K reps (one network, 1.05M records cumulatively) stayed in the fast regime the
whole window (deciles 805-842; tier median 820.4). The desktop's MP-50K (2026-09-30, same commit
4a38a54, same preset, c = 128, same 50/2 s batch) left the fast regime 20-50 s into **every** rep
(≈ 17-33K records) and spent the rest at ≈ 530-600, giving the 570.3 median. Its fast phase that night
was also slower (≈ 600-710 in the first minute vs ≈ 940 on 2026-10-07).

That desktop night is not like for like with the desktop 483K runs: all nine tiers ran back to back
on one Docker VHDX with no compaction or Docker relaunch (the VHDX reached 217 GB and filled Q: the
next night), guest self-load was 8-14 on every MP-50K rep (wizard rule flagged 5 of 5), and the host
had Brave and mpv open. The same desktop at the same tier on an older build and a quieter host did
793 TPS (2026-09-12, ef663d1, `2026-09-12-rows2-4-parallel.md`). It is also not true that the AX42
was faster at all small tiers: desktop MP-1K that night was 924.6 (AX42 ≈ 830) and MP-10K 789.3
(AX42 ≈ 835).

## 5. Most likely explanation

- The comparison is dominated by **which regime each run spends its records in**. Both machines
  have a fast regime and a slower plateau with the same build, preset and batch parameters; the
  plateau begins when the peer's disk writes per record roughly double.
- **AX42 > desktop at MP-50K**: the AX42's 150K-record window fits inside its fast phase; the
  desktop that night dropped to its plateau within 20-50 s of every rep, on a host carrying a large
  uncompacted VHDX and heavy self-load.
- **Desktop > AX42 at MP-483K**: the 483K window is mostly plateau on both, and with a freshly
  compacted VHDX and relaunched Docker before every run the desktop (a) ran ≈ 15 % faster in the
  fast phase, (b) stayed in it about 1.6x as long, and (c) ran ≈ 10 % faster on the plateau.
- Per-record latency is lower on the desktop throughout (min 73 vs 100 ms), which is what sets
  closed-loop TPS. A plausible reading is per-core speed on the serial parts of endorsement and
  commit (65 W 5700G vs 35 W 8700GE), plus Windows host caching of VHDX writes delaying and softening
  the plateau. Neither is directly measured.

Also observed, not explained: on the AX42 the fast phase shortened over successive runs
(483K warm-up drop at 480 s, m1-m3 at 230 s, 1M warm-up 220 s, 1M m1-m3 about 40 s) although every run
had a fresh network; the AX42 never restarted Docker and ran untrimmed until 2026-10-05. The
desktop's compaction + relaunch before every run kept its drop at 340-420 s.

## 6. What the data cannot show

- **Which store produces the extra peer writes.** No peer logs were kept for these runs (block commit
  timings `state_validation` / `block_and_pvtdata_commit` / `state_commit`), and there is no `du` of
  the state, history and block stores over time. A LevelDB compaction backlog fits the write-per-record
  doubling but is not demonstrated.
- **CPU frequency.** Neither sampler recorded clocks or package power, so the 35 W vs 65 W effect is
  inferred, not measured. The AX42's EPP was read today, not during the runs.
- **Whether the VHDX path honours fsync like bare ext4.** The desktop's lower latency could partly be
  the Hyper-V/Windows cache acknowledging writes earlier. Not measured.
- **Why the desktop's 2026-09-30 fast phase was so short.** The night had several confounders
  (VHDX size, self-load, desktop apps) and no per-run compaction; the data cannot separate them.
- **Statistical weight.** n = 3 measured runs per machine at 483K; spreads are tight (desktop
  613-636, AX42 554-558) but the desktop m1 vs m2/m3 gap (≈ 23 TPS) is larger than the AX42's.

## 7. Paragraph for Chapter IV

At MP-483K the desktop committed 613-636 TPS against the AX42's 554-558 TPS, reversing the order seen
at MP-50K (desktop ≈ 570, AX42 ≈ 820), even though both ran the same build (saksi 4a38a54), preset,
128-record closed-loop load and orderer batch parameters on a fresh network per run. The throughput
traces show why: on both machines a long window has a fast phase followed by a lower plateau that
starts when the peer's disk writes per record roughly double, and a 150,000-record MP-50K window fits
inside the AX42's fast phase while the desktop, on that night's uncompacted and heavily self-loaded
host, fell to its plateau within the first minute of every repetition. In the 483K runs, which were
preceded on the desktop by a Docker disk compaction and relaunch, the desktop was about 15 % faster in
the fast phase, stayed in it about 1.6 times as long (340-420 s against 230 s), and was about 10 %
faster on the plateau. Because the driver keeps 128 records in flight, throughput equals concurrency
divided by mean latency, so the desktop's lower minimum and median latency outweigh the AX42's lower
p99 latency (327-336 ms against 397-457 ms). The evidence does not identify the peer store behind the
plateau or isolate the effect of CPU clock and power limits, so these results compare two specific
environments rather than ranking the hardware.
