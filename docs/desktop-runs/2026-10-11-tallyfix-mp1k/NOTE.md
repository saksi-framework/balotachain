# Tally-fix demonstration election (MP-1K, on-chain)

One on-chain election on the merged saksi build that publishes the threshold-decrypted totals
(saksi PR #60, merge commit `624afce`). See `docs/paper/review/TALLY-FIX.md` in the main
checkout for what the PR changed.

## Run

- **Run id:** `mp-1k-tallyfix-demo-20261009-174309-1`
- **Build:** saksi `624afcef35e1ce9ee76de150eb070f91766a8842` (detached checkout in WSL
  `~/Code/saksi`). `saksi-demo` rebuilt with `cargo build -p saksi-demo --release` and the
  console with `go build` (and again by `tools/up.sh`). `run.json` and the first line of
  `journal.ndjson` both record `git_head_saksi` = `git_head_console` = `624afce…`.
- **Network:** fresh Hyperledger Fabric 2.5.15 test network on the desktop (WSL2 + Docker
  Desktop): `tools/up.sh down`, then `tools/up.sh` (via `~/bringup5.sh`, phase timeout 5h),
  channel `saksi`. Console on `127.0.0.1:8090`, on-chain mode on, auth off.
- **Config (the MP-1K study preset):** 1,000 voters, 3 positions x 4 candidates, 5 trustees,
  threshold 3, realistic distribution, 128 in flight, mode onchain.
- **Steps (console HTTP API, the same calls as the wizard; `drive.log`):** `/generate`,
  `/ceremony/start` (CreateElection, PublishDKGTranscript, 3,000 ballot records, CloseElection),
  `/ceremony/submit` for trustees 1, 2 and 3 (12 partial decryptions each), `/ceremony/publish`,
  `/verify`.

## Timestamps (UTC, 2026-10-09; 2026-10-10 local, UTC+8)

| Step | Time |
|---|---|
| generate | 17:43:09 |
| CreateElection (block 6) | 17:43:14 |
| PublishDKGTranscript (block 7) | 17:43:16 |
| 3,000 ballots committed, 0 dropped (877 TPS) | 17:43:18 to 17:43:21 |
| CloseElection (block 68) | 17:43:22 |
| trustee 1, 2, 3 partial decryptions (blocks 69 to 104) | 17:43:29 to 17:44:44 |
| **PublishTally (block 105)** | **17:44:45** |
| verify end, overall pass | 17:44:53 |

PublishTally receipt (`receipts-lifecycle.csv`): tx `20bb4164a7781d5a96aadbf0ae1463265e3d4bebdc28e630c85408c62c3c68d4`,
block 105, block hash `dca02b8440ef5f29e821e6a36d7352820a1d50b0299ce6f58fe396fb5e725eac`.

## Checks

**(a) Published = decrypted = ground truth, all 12 contests, E = 0.** `summary.csv` (derived from
`audit-ledger.json`) and `correctness.csv` (the console's own export, local and ledger rows):

| Contest | cand0 | cand1 | cand2 | cand3 |
|---|---|---|---|---|
| president | 490 | 180 | 170 | 160 |
| vice-president | 485 | 186 | 172 | 157 |
| senator | 480 | 193 | 173 | 154 |

For every contest the ground truth, the published tally read back from the ledger
(`published_tally`) and the verifier's threshold decryption (`decoded`) are equal, E = 0,
`ledger_matches_local = true`. `audit-ledger.txt` (`saksi-demo audit-stream <run>/ledger`, the
copy the console dumped from Fabric) and `audit-local.txt` (the run folder) both end
`AUDIT-STREAM: PASS`. An independent decode of the PublishTally record's protobuf
(`tallycheck.py`) gives the same 12 numbers:
`[490, 180, 170, 160, 485, 186, 172, 157, 480, 193, 173, 154]`.

**(b) Trustee signatures verify (`tally.signatures`).** The auditor's streaming path always runs
`verify_tally_signatures` (strict: missing, unknown, duplicate or invalid signatures, or fewer
than the threshold, fail). `audit-ledger.json` has `"failed_checks": []`. The published tally
on the ledger carries 3 signatures (trustees 1, 2, 3, the ones who submitted); the generator
bundle carries all 5. Negative control (`audit-negative-control-signature.json`): the same
ledger copy with one byte of trustee 1's signature flipped fails with
`tally.signatures: trustee 1: signature does not verify over the published totals; only 2 valid
signature(s), below the threshold of 3`. So the check is live on this run's data and passes on
the untampered copy.

**(c) Build commit.** `run.json` `commit` and the journal's environment line:
`git_head_saksi` = `git_head_console` = `624afcef35e1ce9ee76de150eb070f91766a8842`.

**New behaviour (totals come from the recombined partial decryptions).** The console's
generate phase runs `saksi-demo gen --stream`, whose header tally is built at
`packages/saksi-auditor/src/stream.rs:369`:

```rust
let partial_decryptions = build_partial_decryptions(&pro, &aggregate);
// The published totals are what the trustees' shares decrypt to; a
// mismatch with the seeded counts fails the run instead of publishing.
let tally = build_tally(&pro, &aggregate, partial_decryptions.clone(), &counts, lines as u64)?;
```

`build_tally` verifies the partial decryptions, Lagrange-combines `t` shares per contest,
decodes, and signs those totals; it errors (and the run writes no header) if they differ from
the ground truth. The code path emits no log line of its own, so the evidence is that this run's
generate stage succeeded on this build and the PR's tests pass on the same checkout
(`pr60-tests.txt`, `cargo test --release -p saksi-auditor --lib decrypted_tally`):
`published_totals_are_the_decrypted_totals_and_equal_ground_truth`,
`a_tampered_partial_decryption_fails_generation`,
`decrypted_totals_that_differ_from_ground_truth_fail_generation`: 3 passed, 1 ignored (timing).

## Files

| File | What |
|---|---|
| `run.json` | config and build commit |
| `journal.ndjson` | stage events, environment line with `git_head_*` |
| `correctness.csv` | console export: per contest, local and ledger rows |
| `summary.csv` | per contest: ground truth, published (ledger), decoded, E |
| `perf.csv`, `timings.json`, `submit-metrics.json` | performance row and verifier timings |
| `receipts-lifecycle.csv` | every non-ballot receipt: CreateElection, PublishDKGTranscript, CloseElection, 36 SubmitPartialDecryption, PublishTally (the run's `receipts.csv` minus its 3,000 SubmitBallot rows; CreateElection and PublishDKGTranscript appear twice there, as in the original) |
| `ceremony.json` | trustee submissions and times |
| `ground-truth-summary.csv`, `ground-truth-check.json` | seeded counts and the population gate |
| `audit-ledger.json` / `.txt`, `audit-local.txt` | `saksi-demo audit-stream` on the ledger copy and the run folder |
| `audit-negative-control-signature.json` | the tampered-signature control |
| `pr60-tests.txt` | PR #60 tests on `624afce` |
| `tallycheck.py` | decodes the published tally record and builds the tampered copy |
| `drive.log` | the API calls and their times |

Not copied: `ballots.ndjson`/`ballots.csv` (~24 MB) and the full `receipts.csv`; they stay in
the run folder `~/.saksi/campaign/runs/mp-1k-tallyfix-demo-20261009-174309-1` in WSL.
