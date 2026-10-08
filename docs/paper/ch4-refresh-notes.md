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

## Remaining TODOs and placeholders

1. `[PENDING: test-suite and CI/SAST log at 4a38a54]` (Tables 4.8, 4.30; Limits). The A5 workspace suite (276
   passed) ran at `640a7b2`, not 4a38a54.
2. `[PENDING: Figure 4.1 ...]` and `[PENDING: Figure 4.2 ...]`: regenerate with SP-483K to SP-3.5M and the AX42 tiers
   as separate series.
3. `[PENDING: [18] beyond-one-million projection figure ...]` (Table 4.27).
4. `[PENDING: A/B of ef663d1 against 4a38a54 ...]` (deferred by the researchers).
5. `[TODO: evidence for the SSH bot-flood mitigation]`: the brief reports it, but no file under
   `docs/desktop-runs/ax42-security/` records it. The claim is in the text with this marker.
6. `[TODO: Windows Kernel-Power event record for 2026-10-08]`: the archive shows the controller restart at 01:36 and
   the verify-only recovery, not the power event itself.
7. Reordering detection rests on unmerged saksi PR #58 (`640a7b2`); replace with the merge commit when it merges.
8. T6 console-level 2-of-5 refusal still rests on unmerged saksi PR #57 (`1181015`); the chaincode refusal is shown (A2).

## Discrepancies found in the evidence (not resolved; the chapter states the choice made)

- SP-3.5M Windows available-memory minimum: the controller's `NOTE.md` bottleneck line (2, 998, 574, 265 MB for the
  warm-up and m1 to m3) differs from a minimum recomputed from `resources.csv` over the same window (12, 2,227, 2,730,
  265 MB). Table 4.20 uses the controller line and says so.
- D4 duration: track N says "~12 min window vs ~3 min clean"; `D4/perf.csv` gives `submit_window_ms` 2,885,906
  (48 min) and 52.0 TPS. The chapter uses `perf.csv`.
- D3 and D4 are called "SP-50K network" in track N, but both ran 150,000 records at 50,000 voters x 3 positions
  (12 contests, 24 contest rows); the chapter calls them MP-50K.
- D1-L `correctness.csv` sums to 6,000,000 decoded votes (24 rows: local and ledger, 3,000,000 each); the chapter
  reports 3,000,000 records and 24 contest rows.
- A5 `report.md` table lists 33 re-verified runs; `verdicts.tsv` (after the second batch) lists all 47 AX42 MP runs,
  every one `overall=pass`, `ledger.order=pass`, sum E 0. The chapter uses 47.
- X1 rescan: `X1-rescan/nmap-v4-allports.txt` is empty and `nmap-v6.txt` shows every probed port, including 22,
  filtered. "Only 22 open" after the fix rests on the `STATUS.md` orchestrator line.

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
