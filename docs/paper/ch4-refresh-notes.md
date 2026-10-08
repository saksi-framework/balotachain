# Chapter IV refresh, 2026-10-08: changes and open items

Refresh of `docs/paper/chapter-4-draft.md` from the 2026-10-02 draft to every result available on 2026-10-08.
The `.docx` was not edited. Structure, voice and table numbering are kept; one new table, **Table 4.7a** (AX42
security pass), is inserted with a letter suffix so that Tables 4.8 to 4.30 keep their numbers. Renumber in the
`.docx` if the panel's format forbids suffixes.

## Sources used

- Desktop SP-3.5M capstone: `docs/desktop-runs/2026-10-02-sp-3.5m/{warmup,m1,m2,m3}/` (`summary.csv`,
  `correctness.csv`, `journal.ndjson`, `resources.csv`, `NOTE.md`, `ledger-size.txt`).
- Desktop offline MP tiers: `docs/desktop-runs/2026-10-03-offline-mp/`.
- AX42 MP on-chain, bundles 01 to 19: `docs/desktop-runs/2026-10-04-ax42-mp-*` and `2026-10-04-ax42-setup.md`,
  `2026-10-04-ax42-ladder/`.
- Desktop optional runs: `docs/desktop-runs/2026-10-07-483k-optional/`.
- Desktop vs AX42: `.superpowers/sdd/2026-09-14-study-grade-wizard/desktop-vs-ax42-483k.md` (its section 7 paragraph
  is used verbatim; its limits kept).
- Security pass: `docs/desktop-runs/ax42-security/` (STATUS.md, track N and O reports, per-test folders, A5 report and
  `verdicts.tsv`); plan `docs/plans/2026-10-04-ax42-security-tests.md` (Paper impact).
- Study log: `.superpowers/sdd/2026-09-14-study-grade-wizard/ch4-study-log.md`, sections "Capstone 2" and "AX42".
- `desktop-483k-optional.md` was named in the brief but does not exist; the optional runs were read from their
  evidence folders and the study log instead.

Medians follow the draft's convention (`summary.csv`, lower middle for even n; per-metric median over m1 to m3 for
single-run campaigns). For AX42 MP-1K and MP-10K this gives 830.1 and 835.4 TPS, where the controller's tier
summaries (true medians) read 830.4 and 835.6; the chapter says so.

## Changes, section by section

- Header and conventions: date 2026-10-08; second environment; AX42 binary hash; A5's unmerged build `640a7b2`
  flagged as the single exception to the single-build rule; evidence commits for every new run; `[TODO: ...]`
  convention added.
- Table 4.1: second column for the AX42 (hardware, OS, Docker Engine, sampler).
- Table 4.2: SP-3.5M, offline MP-483K to MP-3.5M, AX42 MP-1K to MP-3.5M, SP-483K fresh, desktop MP-483K, the AX42
  security pass and the AX42 validation ladder; the two "not attempted" MP on-chain rows removed. Repetition text
  updated.
- Table 4.3: rows for every new tier and for D1, D1-L, D3 and D4 (security runs, correctness only).
- Table 4.4: SP-3.5M m3 and AX42 MP-3.5M m2 counts replace MP-50K; SP-1.92M kept in one row. Text now covers 1,000 to
  3,524,078 voters on both SP and MP.
- Table 4.5: (a) met at every tier; (b), (c), (d) extended with D1, D1-L, D2, D3; (e) closed by A6 (and A4), with the
  limit that the second machine ran its own build of the same source commit.
- RQ2 introduction: the AX42 pass described; no security run feeds RQ3.
- Table 4.6: T1 and T8 to the largest tiers; T3 adds D3 (orderer and peer kill) and D4 (netem); T4 adds B4, A3, A4, B3;
  T5 adds B2; T6 now "committed then detected" (A1) and sub-threshold refused live (A2). The two departures from
  Table 3.8 are marked resolved.
- Table 4.7: D1 and D1-L columns; D1-L at-scale paragraph (3,000,000 records, 0 dropped, 440 TPS from
  `stage.ballots.end`: 3,000,000 / 6,814.061 s). Reordering paragraph notes A5 does not change the SKIPPED rows.
- New Table 4.7a: B1 to B4, A1 to A7, D1 to D5, X1 to X3, with the A5 limits (block order not checked; the console's
  record compared as a sorted set; unmerged build; re-verified runs only).
- Tamper Trial: B4 and A1 replace the 7272837 trial, which is kept as history.
- Table 4.8: cases 7, 8 and 10 now exercised (B3, A2, B2); 9 and 14 strengthened (A1, A4, D3); 11 of 14 exercised.
- Table 4.9: negative direction added for checks 2, 6, 9, 10, 11, 12 (chaincode), 13, 14 (unmerged build).
- Table 4.10: every class updated; front-running (B1) and console interception (D5) now *demonstrated* limits.
- Table 4.11: SP-3.5M, offline, AX42 (47 runs, 0 failed, 0 resumed), optional desktop runs with the 2026-10-08
  warm-up interruption, D3, D4; text on the power-loss policy (2026-10-03 02:12 and 11:15, 2026-10-08); orderer
  qualification rewritten for D3.
- Table 4.12: unlinkability filled from A7 (0 hits, N = 3,524,078, bound 2.84 x 10^-7), with the pseudonymous
  cross-position linkage note; sub-threshold from A2. Secrecy claims cite 4a38a54 runs only (after 1812139).
- Table 4.13 and Limits: updated with B1, A3, D5, X1, X3.
- Performance introduction: median conventions and the no-pooling rule.
- Table 4.14: SP-3.5M, SP-483K fresh, desktop MP-483K, AX42 MP-1K to MP-3.5M; latency text for both machines.
- Table 4.15 and Scalability text: new rows; flat per-record cost to 10,572,234 records; SP-483K fresh (583.3 vs 509.0)
  supports the accumulation explanation without isolating it; AX42 decline explained by the fast-phase/plateau
  pattern; no host bottleneck on the AX42.
- New subsection "Second Environment: Desktop Against AX42" (no new table), with the desktop-vs-AX42 paragraph
  verbatim and its stated limits.
- Table 4.17: SP-3.5M, offline and AX42 stage timers; decryption text updated.
- Table 4.19: SP-3.5M, desktop MP-483K, AX42 rows; note on the AX42 orderer's ~1 GB memory (cause not investigated).
- Table 4.20: SP-3.5M warm-up and m1 to m3 rows and text.
- Table 4.21: SP-3.5M, optional runs, AX42 tiers; MP-3.5M ledger 353.5 GB measured against the 356 GB projection;
  AX42 Docker root 36.0 KB per record.
- Table 4.22: every capstone completed (SP-3.5M desktop; MP-1.92M and MP-3.5M offline and AX42 on-chain); 1.44x margin
  discussed.
- Table 4.24: new tiers; text now "at least 6.0 times single-position, 1.44 times MP-3.5M".
- Table 4.25: SP-3.5M (+41 %), offline (-64 to -68 %), MP-3.5M on-chain on the AX42 (+49 %, desktop-fitted model).
- Table 4.26: SP-3.5M host-disk growth (102 to 119 KB per record), the 120 KB rule, AX42 36.0 KB; MP-3.5M disk measured.
- Model text: four failures (offline prediction added; it was a one-observation ratio, per `cost-model.md`).
- Table 4.27: SP-3.5M and MP-3.5M rows.
- Performance Log Analysis: findings 2, 3 and 5 extended.
- Table 4.30 and closing text rewritten for the completed study.
- Open Placeholders: 1 to 7 and 9 closed; 14 to 16 added.

## Remaining TODOs and placeholders (status after the 2026-10-08 close-out)

1. CI/test-suite log at 4a38a54: **closed.** Saksi's GitHub Actions run 36567167973 is the `push` of 4a38a54 itself to
   `main` (2026-09-29, the #55/#56 merge), every job success on Ubuntu and macOS. Log and summary in
   `docs/desktop-runs/ci-4a38a54/` (`SUMMARY.txt`, `gha-run-36567167973.log`). Counts cited: `cargo test --workspace`
   270 passed, 0 failed, 0 ignored (both OSes); `go test -race ./...` ok for 9 packages with tests (chaincode and its
   cdsverify, credverify, selectionverify, sigverify packages included); clippy `-D warnings`, gofmt, go vet,
   staticcheck clean; `cargo audit` 0 vulnerabilities in 127 crates (1 allowed warning, RUSTSEC-2026-0190). Found and
   reported: the advisory (`continue-on-error`) govulncheck step reported the chaincode module affected by 5
   vulnerabilities (4 in grpc v1.59.0, 1 in x/net v0.17.0) and stopped there, so the client-sdk and campaign modules
   were not scanned. No dedicated SAST tool (gosec, Semgrep) is configured; the chapter says so. The AX42 fresh-clone
   run was not needed and not made.
2. Figures 4.1 and 4.2: **closed.** Regenerated by `ch4-data.py` (new `figure_tiers` block in `ch4-data.json`, new
   `figure_auto()`; one series per machine and ballot shape, AX42 never pooled with the desktop; SP-483K fresh drawn
   as an open marker). Every plotted point equals Table 4.14. Figure 4.3 is unchanged (same three campaigns; the PNG
   is byte-identical after the rerun). `build-ch4.js` was not rerun: it builds the older `.docx` text, which this
   refresh does not edit.
3. `[PENDING: [18] beyond-one-million projection figure ...]` (Table 4.27): **still open.** This is a value to quote
   from reference [18], not a plot. [18] is not in the repository, and the manuscript PDFs
   (`docs/BalotaChain_Main_Paper_1.pdf`; the main checkout's `docs/paper/BalotaChain_Final_Paper.pdf`) name "the
   beyond-one-million projection of [18]" in Table 3.5 without giving its value. Needs the paper itself.
4. A/B of ef663d1 against 4a38a54: **reworded as a limitation** (Performance Log Analysis, finding 1). It needs a new
   measured A/B run of both builds on one network; not run, by instruction; reason given: deferred by the researchers.
5. SSH flood: **closed** from `ax42-security/SSH-flood/ssh-flood-evidence.txt`, with its honest reading: access was
   restored (MaxStartups 100:30:300, PerSourceMaxStartups 10, home-IP exemption ahead of a 10/min per-source
   hashlimit); the flood was not stopped (2,864 pre-auth closes in the 10 min before the record vs 3,381 in the 10 min
   of 2026-10-07 23:10 to 23:20); password login is off, so it cannot log in. Table 4.7a X3 verdict now reads "Found
   and fixed (password login); access restored, flood not stopped"; the Limits list has its own bullet. The "3,381"
   line is labelled "per-minute rate, 23:10-23:20" in the file but is a 10-minute count (the file's own reading says
   ~340/min); the chapter uses it as a 10-minute count.
6. Kernel-Power 2026-10-08: **closed** from `ax42-security/power/kernel-power-2026-10-07-08.txt`, with one correction.
   Event 41 on reboot 01:34:15; Event 6008 dates the unexpected shutdown 00:35:44. That 6008 time conflicts with the
   run evidence: the warm-up's ballot window ended normally at 01:04:21 (`stage.ballots.end`, not stopped) and the
   Windows-host sampler kept writing to 01:10:01 (`resources.csv` gap 01:10:01 to 02:01:35). The chapter therefore
   places the loss between 01:10:01 and 01:34:15 and does not use the 6008 time. The same export shows two more
   unclean shutdowns on 2026-10-07 (reboots 00:30:48 and 02:16:20); the desktop controller log has no entry between
   2026-10-03 16:12 and 2026-10-07 23:03, so no study run was active; the chapter mentions them in the Reliability text.
   Note: the file sits under `ax42-security/power/` but records the desktop (BAN-PC).
7. Reordering detection (A5): **cited as merged.** PR #58 head `640a7b2` merged 2026-10-08 04:11 UTC as merge commit
   `37035f9` (parents 4a38a54 and 640a7b2; tree `2291d6b` identical to 640a7b2's). Wording now "merged after the
   study"; the re-verification still ran on the `640a7b2` build and the study runs on 4a38a54.
8. Console 2-of-5 refusal (T6): **cited as merged.** PR #57 head `1181015` merged as `83c78bd` (2026-10-08). Still not
   in the study build and not exercised in a study run; Table 4.12 status "implemented after the study build".

## Discrepancies found in the evidence (resolved 2026-10-08 from the raw files)

- **SP-3.5M Windows available-memory minimum: resolved.** The controller's `NOTE.md` bottleneck line (2, 998, 574, 265
  MB) is the minimum over the whole `resources.csv` trace (reset to export), not the ballot window. Recomputed:
  warm-up window min 12.2 MB (trace min 1.56 MB at 21:04:52, after the window ended 20:24:35); m1 window 2,227 MB
  (trace 998 at 00:38:18, after 00:18:26); m2 window 2,730 MB (trace 574 at 05:23:36, after 04:18:53); m3 265 MB at
  13:37:01, inside the window. Table 4.20 now gives the window minima (as its SP-1.92M rows already did) with the
  post-window trace minima in brackets; the SP-3.5M paragraph below it was corrected ("hundreds of megabytes" held
  only for m3).
- **D4 duration: resolved, 48 min is right.** `D4/journal.ndjson`: `stage.ballots.start` 08:34:31Z,
  `stage.ballots.end` 09:22:36Z, `window_ms` 2,885,906 (48.1 min), 150,000 committed, 0 dropped; `perf.csv` 51.977 TPS.
  Track N's "~12 min" is wrong. "~3 min clean" holds (150,000 / ~820 TPS = ~183 s). Table 4.7a D4 now states the
  48.1 min window.
- D3 and D4 "SP-50K" in track N: unchanged, the chapter's MP-50K naming stands (150,000 records, 50,000 x 3).
- D1-L 6,000,000 decoded votes: unchanged (local + ledger rows, 3,000,000 each).
- **A5 33 vs 47: resolved, 47.** `A5/verdicts.tsv` holds 47 run rows (MP-1K 12, MP-10K 12, MP-50K 7, MP-483K, MP-1M,
  MP-1.92M and MP-3.5M 4 each, warm-ups included) plus `BATCH-DONE 00:40:00` and `BATCH2-DONE 05:51:42` markers;
  all 47 are `overall=pass`, `sumE=0`, `ledger.order=pass`. `A5/report.md`'s "33" predates batch 2. The chapter
  already used 47.
- **X1 IPv4 rescan: resolved.** `X1-rescan/nmap-v4-targeted.txt` (nmap 7.80 `-sT -Pn`, 2026-10-08 11:33): 22 open;
  7050, 7051, 7053, 9051, 9443, 9444, 9445 and 8090 filtered. `nmap-v4-allports.txt` is empty because that full-range
  scan was stopped (it saturated the link during the A6 upload). `nmap-v6.txt` shows every probed port, 22 included,
  filtered. Table 4.7a X1 and its source paragraph now cite the targeted file instead of `STATUS.md`.

## Evidence added after the refresh (orchestrator, 2026-10-08)
- **SSH bot flood:** `docs/desktop-runs/ax42-security/SSH-flood/ssh-flood-evidence.txt` (counts, sources, sshd and
  iptables settings, and a reading). Honest wording: access restored by MaxStartups + home-IP exemption; the flood
  itself continues (per-source limit sits just above each bot's rate); password login is off, so it cannot log in.
- **X1 IPv4 rescan:** `X1-rescan/nmap-v4-targeted.txt` (nmap -sT, all 8 formerly open ports filtered, 22 open).
  The empty `nmap-v4-allports.txt` is the full-range scan that was stopped (it was saturating the link during the
  A6 upload); the targeted scan plus the laptop IPv6 connect test are the after-fix evidence.
- **2026-10-08 power loss:** `power/kernel-power-2026-10-07-08.txt`: unexpected shutdown at 00:35:44, Kernel-Power 41
  on reboot at 01:34:15 (cooperative brownout). Also a Kernel-Power 41 at 2026-10-07 02:16:20.
- **A5 count:** 47 is current (`A5/verdicts.tsv`, batch 1 = 33 runs, batch 2 = 14 runs, finished 05:51:42); the
  A5 report's "33" predates batch 2.
