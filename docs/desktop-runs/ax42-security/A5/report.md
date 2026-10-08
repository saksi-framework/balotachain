# A5: ledger reordering detection (T3.9): report

Date: 2026-10-07/08. Plan refs: `docs/plans/2026-10-01-ch4-runs-and-chapter.md` item 4;
`docs/plans/2026-10-04-ax42-security-tests.md` row A5.

## Outcome

- saksi branch `security/reorder-detection` off 4a38a54, one commit `640a7b2`
  (`feat(auditor): detect ledger reordering via ledger_digest`). Draft PR:
  https://github.com/saksi-framework/saksi/pull/58 (not merged; main untouched).
  The AX42 clone `/root/saksi-a5` holds the same tree as commit `5fbb5f5`
  (tree `2291d6b5`, identical; only the committer timestamp differs).
- New auditor check `ledger.order` in `audit-stream`. All 33 archived MP on-chain runs that were
  re-verified pass, `ledger.order` included, with E = 0. A reordered copy of mp-1k fails with only
  `ledger.order`.

## A finding that shaped the design

The ledger dump is NOT in commit order. `dumpLedgerBallots` (saksi-campaign `ledger_dump.go`)
walks `ListNullifiers`, which is `GetStateByPartialCompositeKeyWithPagination` over the
chaincode's nullifier index. That index is a world-state composite key, so the chain serves
ballots in ascending nullifier order and in no other. The console's `<run>/ballots.ndjson` is in
submission order. On mp-1k the two files hold the byte-identical set of lines (sorted diff equal)
in a different order (first difference at line 1). So a literal "ledger_digest(chain dump) ==
ledger_digest(served stream)" would fail every honest run, and Fabric's block order is not
reachable through this read path at all.

## Design (auditor only; no wire, chaincode or campaign change)

`saksi-auditor/src/ledger.rs`, `check_ledger_order(served_dir, ledger_dir)`, run by
`audit_stream_dir` whenever `<run>/ledger/ballots.ndjson` exists:

1. Stream the chain read-back. Each record's nullifier must be strictly above the previous one,
   which is the chain's canonical order. A violation fails with the record number, e.g.
   "chain read-back record 1002 is out of the chain's nullifier order (not above record 1001)".
   This also catches a duplicated record.
2. `ledger_digest` of the read-back, in the order served, must equal `ledger_digest` of the
   console's record (`<run>/ballots.ndjson`) sorted into the chain's order. A dropped, added or
   altered record (position id, nullifier, credential commitment, any ciphertext) fails here.

Other points:
- `ledger_digest` now chains per-ballot 32-byte leaves (domain tags bumped to v2), so the served
  side keeps one (nullifier, leaf) pair per record for the sort instead of whole ballots. Memory is
  about 100 bytes per record; the 3.5M run (10.57M records) peaked around 1.3 GB RSS. This is
  marked with a `ponytail:` comment, with an external sort as the upgrade if a tier outgrows it.
- A folder with no ledger dump gets no `ledger.order` finding. Offline runs, the in-memory
  `audit()`, and the existing stream/in-memory parity tests are therefore unchanged.
- `StreamAudit` gains an optional `ledger_order` field ("pass: ..." / "fail: ...", with the
  digest), so a passing run shows the check ran. Go's `json.Unmarshal` ignores the new field.
- The console's Verify already dumps `ledger/` before `audit-stream <run>`, so new on-chain runs
  get the check with no Go change. The ledger directory's own audit
  (`audit-stream <run>/ledger`) has no nested dump and is unchanged. Verify now reads the served
  stream and the dump once more each for the check.
- Stale comments that said no verifier runs `ledger_digest` were updated (`ledger.rs`,
  `independent_verification.rs`, `security_privacy.rs`). The two in-memory "a reorder passes the
  stateless audit" tests are still true and still pass.

What it does NOT claim:
- The console's own `ballots.ndjson` is compared as a sorted set. Reordering that file alone (the
  campaign's `reordered-ballots` scenario) is therefore still not an ordering violation; that
  scenario stays unmounted with no gate. The claim is about what the chain serves.
- Fabric block (commit) order is not exposed by the read-back and is not checked.
- The check needs the ledger dump. Runs without one (offline runs, or a chain unreachable at
  Verify) remain "reordering not checked".

## Tests

- New unit tests (`ledger::tests::order_check`): a clean dump in chain order passes; swapped,
  dropped, duplicated and altered-ciphertext dumps each fail. The fixture asserts the served order
  is not already the chain order, so the clean case exercises the sort.
- New integration test `demo::tests::audit_stream_dir_checks_the_ledger_dump_order`: full
  `audit-stream` on a generated folder passes with a canonical dump (and reports
  `ledger_order: pass`), then fails with exactly `["ledger.order"]` after a swap, with E = 0 on
  every contest.
- `cargo test -p saksi-auditor --features demo`: 126 passed. Without `demo`: 77 passed.
- `cargo test --workspace` (AX42 clone): 276 passed, 0 failed.
- `cargo clippy -p saksi-auditor --all-targets -- -D warnings`, with and without `demo`: clean.
  `cargo fmt --check`: clean.

## Re-verification of archived runs (AX42)

Binary: `/root/ch4-ax42/security/A5/a5-auditor`, a release build of the branch, renamed so other
agents' `pgrep -f saksi-demo` watchers do not see it. Driver: `reverify.sh <run>`. It symlinks
`header.json` and `ledger/header.json`, serves `ballots.ndjson` and `ledger/ballots.ndjson` as
FIFOs fed by `zstd -dc` (nothing is decompressed to disk), and runs `audit-stream --json` with
`SAKSI_AUDIT_THREADS=8` under `nice 10`. The full audit ran (every crypto check plus
`ledger.order`), not only the new check. Raw JSON per run is in
`/root/ch4-ax42/security/A5/results/`; the table is in `verdicts.tsv`.

| Runs | Records each | Verdict | Failed checks | Sum abs(E) | ledger.order | Audit time |
|---|---|---|---|---|---|---|
| mp-1k x12 (runs 5-16) | 3,000 | pass | none | 0 | pass | 1-2 s |
| mp-10k x12 (runs 17-28) | 30,000 | pass | none | 0 | pass | 9-14 s |
| mp-50k x7 (runs 29-35) | 150,000 | pass | none | 0 | pass | 67-72 s |
| mp-483k m1 (run 37) | 1,449,000 | pass | none | 0 | pass | 574 s |
| mp-3.5m m3 (run 51) | 10,572,234 | pass | none | 0 | pass | 2,770 s |

Digests:
- mp-1k run 5: `ledger_digest bc5f8f74c29f323afcfe6d707a5a609eaf6da6cdb9c6a74891fefccd4749d970`
- mp-483k m1: `da17cbb4bef1d94f126fdc62df7e4ead81651601eae1e728d43e1cd02f0af3ef`
- mp-3.5m m3: `7a71a1e0eac3ffd00d02e35a09a21a021bcecb6cac10c8a1a747b22369a00787`

Not re-verified, for time: mp-483k warmup/m2/m3, mp-1m x4, mp-1.92m x4, mp-3.5m warmup/m1/m2.
All of them have ledger dumps, and `batch.sh` covers them by adding their globs (about 10 minutes
per 483k run and 46 minutes per 3.5M run at 8 threads).

## Reordered copy fails

`reordered-fixture/ledger-ballots-swap-1001-1002.ndjson.zst` is mp-1k run 5's ledger dump with
records 1001 and 1002 swapped (all 3,000 lines kept). It was re-verified with the same driver
(`verdicts-reorder.tsv`):

```
mp-1k-r5-REORDERED  overall=fail  failed=['ledger.order']  sumE=0  contests=12
ledger.order=fail: chain read-back record 1002 is out of the chain's nullifier order (not above
record 1001): the ledger dump was reordered or duplicated
```

Every crypto check still passes and E = 0, because the tally is order-independent; the order
check is the only gate that sees the swap. The untouched dump of the same run passes.

## Paper wording

> Ballot reordering by a bulletin-board node is detected on re-verified runs only, at saksi
> 640a7b2 (PR #58, branch security/reorder-detection): the auditor's `ledger.order` check holds
> the chain's read-back to the ledger's canonical nullifier order and to the published record
> (`ledger_digest`). Runs not re-verified with that build report reordering as not checked.
> Fabric block order is not exposed by the read path and is not claimed.

Replace "640a7b2" with the merge commit once PR #58 merges after the campaign.

## Housekeeping

- Study checkout `/root/Code/saksi`, saksi-console.service, and Docker/Fabric: untouched.
- Desktop: worktree `C:/wt/saksi-a5` on `security/reorder-detection`; the main saksi checkout is
  untouched.
- Server artifacts in `/root/ch4-ax42/security/A5/`: `reverify.sh`, `batch.sh`, `a5-auditor`,
  `results/`, `verdicts.tsv`, `verdicts-reorder.tsv`, `reordered-fixture/`,
  `workspace-tests.log`, and the patch.
