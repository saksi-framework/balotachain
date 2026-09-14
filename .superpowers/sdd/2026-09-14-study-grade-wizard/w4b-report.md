# W4b report — saksi PR #49 (fix/study-followups, 06da80b)

Completed in the controller session after the W4b subagent was stopped at the user's request (it had committed items 1 and 2).

Study follow-ups found while writing the study-from-wizard docs (#48) and reviewing the infrastructure work (#46). One commit per item.

## 1. A failed submit or ceremony-start stage fails the run (`6ccb6e5`)
An on-chain run whose Fabric connect failed in Submit was recorded `failed:false` with an empty TPS: Verify, a separate phase, audited the local ballots cleanly and had no record of the failed stage, so campaign repetitions and `--repeat` counted it as a measurement.
- Submit and CeremonyStart now stamp `stage.submit.end` / `stage.ceremony.end` with `ok` and the error. Every way those stages fail ends `run.end` and `perf.csv` as `stage_error: submit|ceremony: <reason>`.
- A later successful start, or a resume that closes the election, supersedes the failure.
- An on-chain run that expected ballots and put none on the chain fails as `nothing_submitted`. Offline runs are exempt.

## 2. The 10,000-voter offline cap is replaced by disk and memory guards (`30e7d01`)
`OfflineVoterCeiling` predated the streaming generator and auditor, and it kept row 8 (MP-483K to MP-3.5M offline) out of the wizard.
- `Validate` keeps one sanity bound: 3,524,078 voters × 3 positions, checked by division so it cannot overflow.
- **Disk:** the run folder is projected at 1,848 + 1,402 × candidates bytes per ballot record, measured from whole console runs, and checked against free space on the runs volume.
- **Memory:** the auditor is projected at 32 MiB + 150 bytes per record, from its measured peak, and checked against `MemAvailable`. The figure is null on Windows.
- Preflight blocks with `disk_short` / `memory_short` and warns above 80 % with `disk_tight` / `memory_tight`. `/generate` refuses the same runs. An offline campaign's disk check counts every run folder it keeps.
- The wizard and the docs are updated.
- A real 20,000-voter offline run through the console's API passes (`TestOfflineRunAboveTheOldCapCompletes`, E = 0).

## 3. Resume refuses synchronously: no change
`handleResume` already decides with `planResume` and the bundle check before it dispatches anything. It answers `409` with the reason, and `executor_resume_test.go` covers it.

## 4. Public verification files: `GET /api/board/<run>/files/<name>` (`8aa6873`)
- **Allowlist (exact match):** `header.json`, `ballots.ndjson`, `receipts.csv`, `trail.ndjson` / `trail.json`, `ledger/header.json`, `ledger/ballots.ndjson`.
- **New board field:** `files` lists which of these the run holds.
- **409 until the tally is published.** `header.json` carries the tally and the partial decryptions from generation onwards.
- **Both headers are served with `ground_truth` and `voter_ids` emptied.** The copy is streamed token by token, because at the largest tier `voter_ids` alone is hundreds of megabytes.
- **`correctness.csv` stays admin-only**, because its `ground_truth` and `E` columns are the seeded totals.
- **Checked by hand on a 1,000-voter run:** `audit-stream` on the public copy fails only `tally.accuracy` ("ground truth has 0 entries … accuracy check skipped"). Every contest's `decoded` equals its `published_tally`.
- **Tests:** sealed, the header projection, the ledger files, the refused names, traversal attempts, and the auth role table.

## 5. Voter id range and favicon (`04924b7`)
- The gate message is now "V-000001 through V-000100" (was "… through V-100").
- `/favicon.ico` answers 204 and is public. Before, it fell through to the admin-only `/` and logged a 401 on every public board load.

## 6. `--phase-timeout` (`0d1d696`)
- **Flag:** `serve --phase-timeout`, env `SAKSI_PHASE_TIMEOUT`, default 60m. `--timeout` stays as an alias. The console prints the value at start-up, and `tools/up.sh` passes the env var through.
- **Journal line 1** records `phase_timeout_s`.
- **Preflight** reports `phase_timeout {seconds, longest_phase, estimated_s}`, using per-record costs from the desktop cost-model refit:

  | Phase | ms per record |
  |---|---|
  | Generate | 0.18 |
  | Submit | 1.24 |
  | Verify, on-chain | 0.83 |
  | Verify, offline | 0.16 |

- **Findings:** `phase_timeout_short` blocks and cannot be forced. `phase_timeout_tight` warns above 75 %. Both name the flag and suggest a timeout that fits. At the default, SP-3.5M on-chain (about 73 minutes of submission) is blocked.

## 7. The export zip carries what `cost_model.py` reads (`8320f91`)
- Each run adds `journal.ndjson` and `gen-timings.json`.
- It also adds `receipts-lifecycle.csv`: `receipts.csv` streamed without its `SubmitBallot` rows. A partial last row left by a crash is dropped, and `MANIFEST.txt` says so.
- The runbook's export row is updated.

## 8. Runbook §9 T3 order (`06da80b`)
- The order is now Resume → Verify-only → Verify, matching the wizard and the plan.
- Verify-only is also valid before the resume, since neither route checks for the other. The fault's gap is still recorded from the chain as `segment.start {pending}` and as replay rows.
- Only §9 is touched; §10 belongs to #48.

## Checks
- **Windows:** `go vet ./...` and `gofmt -l` are clean, and `go test ./... -count=1` passes with `SAKSI_DEMO_BIN` set to a release `saksi-demo`.
- **WSL:** `go test -race -count=1 .` passes (Go 1.25.1, from a clean `git archive` of HEAD).

## Follow-ups and notes
- balotachain board: point download links at `/api/board/<run>/files/<name>` using the board response's `files` field.
- Public `audit-stream` cannot score accuracy (no ground truth); a public-verifier mode that skips `tally.accuracy` instead of failing it would be a Rust change (saksi-auditor `audit_stream_dir_full`). Not built.
- `/run-all` runs generate, submit and verify under ONE phase timeout; preflight estimates per phase (the wizard and campaigns use per-phase routes).
- WSL `~/.profile` line 28 has an unquoted PATH export containing `(x86)` that breaks `bash -l`; left untouched (user file). Ran the -race script without a login shell.
