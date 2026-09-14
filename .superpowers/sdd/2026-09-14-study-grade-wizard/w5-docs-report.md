# W5 report: runbook §10 and study checklist

Status: DONE_WITH_CONCERNS (the docs are complete; the concerns are capabilities the study needs that do not exist).

- Worktree: `Q:/Code - LAPTOP/Code/projects/saksi-w5`, branch `docs/study-from-wizard` off saksi `origin/main` 0d9bdaf
- Commit: `de09ee0` docs: run the Chapter 4 study from the wizard (runbook §10, study checklist)
- PR: https://github.com/saksi-framework/saksi/pull/48 (CI was pending when this was written; Security passed)

## What was written

1. `docs/research-election-console-runbook.md`
   - New `## 10. Running the study from the wizard`, subsections 10.1 to 10.9 (brief items a to i).
   - The old `## 10. Troubleshooting` is now `## 11. Troubleshooting`. A grep across saksi (md, html, go, sh, yml) and balotachain docs found no cross-reference to it, so nothing else needed updating.
   - The only edits outside the new section are that one heading renumber. No API section was touched (W4b's territory). The runbook has no table of contents, so none was added.
   - The row 8 paragraph is wrapped in `<!-- W4b -->` … `<!-- /W4b -->`. It assumes W4b lifts the offline ceiling and adds disk and memory preflight rows, and uses no row labels, since those do not exist yet.
2. `docs/study-checklist.md` (91 lines): tick lists for once-per-study and per-session steps; a per-tier table with ☐ columns (Reset, Preflight green, Campaign done, No contended, Exported, Copied) for all 15 presets; a security-run table; T3 steps; during-run rules; after-study steps. It holds its own `<!-- W4b -->` marker on the row 8 footnote.
3. `wizard.html`: unchanged. Its links (`…runbook.md#10-running-the-study-from-the-wizard`, `docs/study-checklist.md`) already match.

## Anchor check

`gh api repos/saksi-framework/saksi/contents/docs/research-election-console-runbook.md?ref=docs/study-from-wizard -H "Accept: application/vnd.github.html"` renders `id="user-content-10-running-the-study-from-the-wizard"`, plus `101-the-machine` … `109-after-the-study` and `11-troubleshooting`. The checklist's relative link renders as `research-election-console-runbook.md#10-running-the-study-from-the-wizard`.

## Label verification

Every bold label in §10 was checked against `wizard.html` at 0d9bdaf. Checked: mode buttons, preset group, form fields, attack timeline labels, preflight row keys and chips, the ladder button and its done text, **Start anyway**, step buttons, pause-bar buttons, campaign view and campaigns list, Infrastructure panel fields and status strings, runs-list statuses, tags, actions and done notes, and the sign-in form. Preflight finding codes and messages were checked against `preflight.go`; declared gates against `scenarios.go`; the export file set against the §9 export row; run ids against `runstore.go` `slugify`. `cost_model.py` behaviour was checked against its `load_run` and skip rules (it needs a `run.end`, skips runs whose `rep.kind` is not `measured`, refuses mixed regimes).

The brief said "Run validation ladder"; the button is **Run the validation ladder**, and §10 uses the real label.

## Missing capabilities (listed in §10 as limits, not worked around)

1. **Row 5's sweep and the T8 burst have no wizard field.** `POST /api/campaigns` accepts `sweep`, `window_s` and `burst`, but `startCampaign` sends only `warmups` and `reps`. The run table has row 5 as "SP-483K, sweep", and CLAIMS.md needs the open-loop sweep to pin the plateau.
2. **The per-phase timeout blocks rows 7 and 9.** `serve --timeout` defaults to 60 min and bounds every dispatched phase (`server.go` `dispatch`, and the resume path). `tools/up.sh` execs the console with no way to change it. At cost-model rates (submit 1.243 ms/record, verify 0.828 ms/record), SP-3.5M needs about 73 min of ballot window, and MP-3.5M on-chain about 3.65 h of window and 2.43 h of verify. A cut window is resumable, since the bench driver marks it stopped and it is stamped `stage.ballots.interrupted`. A cut verify is not. Suggested fix: an `SAKSI_TIMEOUT` passthrough in `up.sh`, or a longer default.
3. **No wizard path to finish an existing election.** After Resume, `next2` (**To the trustees →**) is enabled only when `id === runID`. A resumed campaign repetition, or any run after a page reload, cannot reach its ceremony, publish and verify from the wizard. The classic console selects only runs that already have `correctness.csv` and has no ceremony. `/trustee/` needs `--web-dir`, which `up.sh` does not pass. §10.7 points to §9's API steps. Suggested fix: an "Open" or "Continue" action in the runs list.
4. **The export bundle does not feed `cost_model.py`.** The bundle has `journal-line1.json` only; `load_run` returns None without `journal.ndjson` holding `run.start` and `run.end`, and the fit needs `gen-timings.json` and `receipts.csv`. §10.9 refits from the WSL run store instead. **Plan W6's check "the export bundle loads in cost_model.py" will fail as specified**: either add those files to the bundle, or change W6 to point `--runs` at the run store.
5. **T3 order conflict.** Runbook §9, *Operator flow for a T3 run* (PR #46), orders verify-only (step 4) **before** resume (step 5), with the reason "After the resume that state is gone". `tools/t3-restart.sh` also never resumes. The wizard's T3 box, its resume "Done" note, plan §4 and this brief order it **after**. Both orders are accepted: `handleVerifyOnly` has no resumability check and `planResume` ignores `verify_only.reconcile`. The gap is still recorded after a resume by `segment.start {pending}` (computed from the chain) and by replay rows. §10.6 follows the wizard and notes the §9 difference in one line. A decision and a one-side edit are needed; I left §9 alone for W4b.
6. **`up.sh` omits `--fabric-peer-volume`.** The Disk preflight row therefore checks the run store's volume inside WSL, not Docker's ledger disk, and `ledger_bytes_delta` stays empty. This is already a known caveat in CLAIMS.md; §10.3 tells the operator to check the NVMe by hand.

## Judgment calls

- **Study tag in the election name** (for example `SP-1K w1`). Without it, `--match 'sp-*-2026*'` would also catch the `sp-1k-par-20260911…` runs from `ef663d1`, and `cost_model.py` would refuse the mixed regime. The name field stays editable after a preset, and the slug keeps the tag.
- **Rows 2–4 re-run on the study build.** The regime guard includes the saksi commit, so a study on a newer build cannot fit together with the 2026-09-12 CLI rows.
- **The refit writes to a new file** (`cost-model-<tag>.md`). The current `cost-model.md` holds the predictions for rows 5–9 committed before those rows ran, which CLAIMS.md calls the honesty check.
- **The Host row is treated as a gate for the study**, although it is `warn` severity in code. This follows the validation note's finding.
- **Personal details left out.** The fstab NFS server IP and the Windows username are not in the doc (the saksi repo is on GitHub).
- **Data sources.** `2026-09-12-validation.md` with the game finding exists only on balotachain `ci/audit-trail` (HEAD), not on `origin/main`, so it was read from the working tree. `cost-model.md` and `CLAIMS.md` are identical on both.

## Tests

`go test ./...` in `packages/saksi-campaign` (Windows, one full run) had one failure: `TestSingleRunLockReturns409`, "TempDir RemoveAll cleanup: … being used by another process". This is the known pre-existing cleanup race recorded in the validation notes. It passed on rerun (`go test -run 'TestSingleRunLockReturns409|TestWizard'`). This change is docs only.

## Self-review

Checked the diff for these three things. All three were fixed before the commit:
- step references: the T3 tab was "open to step 6", now step 7
- the Orderer batch row wording: the `Object.entries` output is alphabetical, so the doc now lists the required values instead of quoting their order
- the SP-3.5M timeout consequence: as a campaign repetition it cannot be finished from the wizard, so it now reads "single election walked through a resume, no RQ3 row"
