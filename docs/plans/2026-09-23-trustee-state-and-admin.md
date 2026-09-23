# Trustee submit state bug, and the admin console against its spec

Approved analysis: `C:\Users\User\.claude\plans\hazy-beaming-willow.md` (session plan, 2026-09-23).
Spec for the admin console: `docs/plans/2026-09-14-admin-console-and-simple-auth.md` §5.

## Problem

`POST /ceremony/submit` returns 202 and the console then commits one `SubmitPartialDecryption` per contest in the background, about 2 s each on-chain. `GET /api/ceremony/<run>` has no in-progress state, so every UI shows the trustee as not submitted until the last contest lands, and offers the Submit button again. A second click is refused 409 "a phase is already running on this run", and the page keeps showing the button.

Related faults:
- a background failure is visible only on the SSE stream;
- a retry after a partial failure is refused `partial-duplicate` at contest 0 forever;
- on-chain, `refreshFromChain` counts a trustee as submitted from its FIRST contest alone;
- `ready` turns true when `bundle.json` exists, which is before the election is closed on-chain.

## Global Constraints

Exact JSON contract between the saksi console and the balotachain apps. Both sides use these names verbatim.

- `GET /api/ceremony/<run>`: each `trustees[i]` gains
  - `submitting` (bool, always present): true while this trustee's `/ceremony/submit` phase is running;
  - `submit_error` (string, omitempty): the error text of this trustee's last submit phase if it failed, cleared when a later submit for that trustee starts or succeeds.
- The top level of that same body gains `busy` (string, omitempty): the trustee id whose submit phase is running now; empty when none.
- `ready` becomes true only when the bundle exists **and** `closed_at` is set. `closed_at` is stamped when CeremonyStart finishes: after CloseElection on-chain, and after the local setup offline.
- `POST /ceremony/submit` for a trustee whose submit is already running returns **409** with body text exactly `trustee <id>'s shares are already being recorded`.
  - Other busy cases keep the existing text `a phase is already running on this run`.
- `GET /runs` rows gain:
  - `audit_overall` (string, omitempty): `"pass"` or `"fail"`, the latest completed Verify's overall verdict; absent if never verified;
  - `audit_failed_checks` (string array, omitempty): that Verify's failed check ids.
- Idempotent resubmit: before each contest's `SubmitPartialDecryption`, read the chain's partial for (election, contest, trustee).
  - Same bytes as the bundle's: skip the contest.
  - Different bytes: fail the phase with the text `a different share is already recorded for contest <contest_id> (trustee <id>)`.
  - Absent: submit.
- On-chain `refreshFromChain` marks a trustee submitted only when every contest's partial is on chain with the bundle's bytes. Trustees already marked submitted locally are not probed.
- UI wording:
  - in-flight: `Recording your share…` (trustee app) / `Recording…` (wizard, admin chip);
  - another trustee in flight: `Another trustee's share is being recorded; this unlocks when it finishes.`;
  - retry button: `Try again`.
- Trustee app poll interval: 4000 ms normally, 1500 ms while `busy` is non-empty or the page has just sent a submit.
- saksi work: branch `fix/ceremony-submit-state` off saksi `main` (dca7776). balotachain work: branch `fix/trustee-admin-state` off balotachain `main` (b03d4ba).
- Commit trailers:
  - `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_015q5U4NJTtwkhtHs9CyapZG`

| Task | Repo | model | where | reviewer model |
|---|---|---|---|---|
| 1 | saksi | executor (Opus) | worktree: other repo, own PR | reviewer (Sonnet) |
| 2 | saksi | executor (Opus) | same saksi worktree as Task 1 | reviewer (Sonnet) |
| 3 | balotachain | executor (Opus) | worktree: own PR | reviewer (Sonnet) |
| 4 | balotachain | executor (Opus) | same balotachain worktree as Task 3 | reviewer (Sonnet) |
| 5 | balotachain | executor (Opus) | same balotachain worktree | reviewer (Sonnet) |

## Task 1: Console ceremony state (saksi `packages/saksi-campaign`)

Implement the server side of the Global Constraints.

1. `Executor` tracks, under a mutex:
   - in-flight submits per run (which trustee);
   - the last submit error per run and trustee.

   `CeremonySubmit` sets in-flight at start; a `defer` clears it and records or clears the error.
2. Types and routes:
   - `CeremonyTrustee` gets `Submitting` and `SubmitError`;
   - `CeremonyState` gets `Busy`, filled in `CeremonyStatus`;
   - `handleCeremonySubmit` answers the new 409 for a trustee already in flight, before `dispatch`.
3. Idempotent resubmit in the on-chain loop of `CeremonySubmit`:
   - decode each pd for its contest id (as `partialsByTrustee` does);
   - use `conn.Bulletin.GetPartialDecryption`;
   - apply the skip / fail / submit rule;
   - a skipped contest writes no receipt, and is published as `SubmitPartialDecryption <ref> already on chain (skipped)`.
4. `refreshFromChain`: all-contests rule, bytes compared with the bundle's; locally submitted trustees skipped.
5. `ready` requires `ClosedAt != nil` in `CeremonyStatus`. Check every other reader of `Ready` (board.go, ceremonyview.go, trail, wizard `refreshCeremony` / `openRun`) still behaves correctly; fix any that meant "bundle exists".
6. `GET /runs`: add `audit_overall` and `audit_failed_checks`.
   - Stamp `failed_checks` (ids) into the journal's `stage.verify.end` beside `overall`.
   - `fillState` reads the latest `stage.verify.end` that has `overall`.
7. Tests, written first and each seen failing on `main` before the fix:
   - a fake ledger whose `SubmitWithReceipt` blocks: `CeremonyStatus` mid-submit shows `submitting` and `busy`, and a second POST gets the new 409 text;
   - a failure at contest 3, then a retry, finishes with no `partial-duplicate` and skips contests 0 to 3;
   - a different share at contest 0 fails with the new text;
   - `refreshFromChain` with only the first contest on chain, or first-contest bytes that differ, does not mark submitted;
   - `ready` stays false between `bundle.json` and CloseElection;
   - `submit_error` is set after a failed phase and cleared by a successful retry;
   - `/runs` carries `audit_overall` / `audit_failed_checks` after a verify.
8. Verify with `gofmt -l .` (clean), `go vet ./...`, and `go test ./...` with `SAKSI_DEMO_BIN` pointed at a freshly built `cargo build --release -p saksi-demo`. Update `docs/research-election-console-runbook.md` where it documents `/api/ceremony` or `/runs` fields, if it does.

## Task 2: Wizard step 4 (saksi `packages/saksi-campaign/web/wizard.html`)

In `refreshCeremony`:
- a card whose trustee has `submitting` renders a disabled `Recording…` button;
- a card with `submit_error` shows the error text and a `Try again` button;
- when `st.busy` is another trustee, the other not-submitted cards render disabled with the wait text.

In the click handler, a 409 does not restore "Submit share": it re-polls.

`btnPublish` stays disabled while `st.busy` is set.

Keep `web_test.go` passing and add a check that the wizard handles `submitting`, `submit_error` and `busy`, in the file's existing style (it greps functions and pins behaviour). Run `go test ./...` again.

## Task 3: Trustee app (balotachain `apps/trustee`)

- `lib/bulletin.ts` types: `CeremonyTrustee.submitting?: boolean`, `submit_error?: string`; `Ceremony.busy?: string`.
- `App.tsx` `ActionCard` is driven by server state:
  - `you.submitted` → the existing success panel;
  - `you.submitting`, or the page's local `sent` phase until the next poll → an in-flight panel with `Recording your share…` and no Submit button;
  - `you.submit_error` → the error plus `Try again`, which goes straight to the confirm step;
  - `ceremony.busy` set and not you → a disabled Submit button with the wait text.
- Remove the optimistic `phase = "submitted"`: success is shown only from `you.submitted`.
- A 409 from submit re-polls and stays in the in-flight or wait state; other errors show as today.
- Poll at 1500 ms while `busy` is non-empty or right after a submit, and at 4000 ms otherwise.
- Tests in `App.test.tsx`, each failing before the change:
  - `submitting: true` → no Submit button, in-flight text shown;
  - after confirm, the button does not come back while the mocked poll still says not submitted;
  - `submit_error` → `Try again` present, and it re-submits;
  - `busy: "2"` for trustee 1 → disabled with the wait text;
  - a 409 on submit → no error banner with a live button, and it re-polls.
- Run `pnpm --filter trustee test`, `typecheck` and `lint`.

## Task 4: Admin ceremony and run state (balotachain `apps/admin`)

Audit items A1, A2, A3, A12 (see the approved analysis):
- `lib/bulletin.ts` `RunView` gains `busy`, `status`, `reason?`, `resumable`, `was_interrupted`, `paused_stage?`, `audit_overall?` and `audit_failed_checks?`. `Ceremony` and its trustees gain the Global Constraints fields.
- `lib/election.ts` `stepFor` / `runState` map:
  - `failed` → red "Failed" with the reason;
  - `interrupted` / `close-pending` → amber "Interrupted" with a **Resume** action (`POST /api/runs/<id>/resume`, new client function), as the wizard does;
  - `busy` → reopen at the step of the running phase, its action disabled;
  - bundle present but `ready` false → the Run step "recording on-chain…", never Ceremony.
- Run step (App.tsx ~1255-1311): "closed" only when `ready` (now meaning closed). Fix the wrong comment.
- Ceremony step roster:
  - `submitting` → `Recording…` chip;
  - `submit_error` → the error under the row;
  - Publish disabled while `busy`.
- Tests: `stepFor` for busy, failed, interrupted, close-pending and bundle-not-closed; the list chip for each; Resume calls the route; roster `Recording…`; Publish disabled while busy.
- Run `pnpm --filter admin test`, `typecheck` and `lint`.

## Task 5: Admin actions and results (balotachain `apps/admin`)

Audit items A4 to A11, A14 and A16:
- **A4.** Publish stays `Publishing…` until a poll says `published`, or the run is no longer busy without being published. Then show the phase error from `usePhaseEvents(runId, "ceremony")`.
- **A5.** Set the Start and Verify guards before the `await`.
- **A10.** The step error clears on the next successful poll.
- **A6.** `validateConfig`'s offline voter limit mirrors saksi `config.go` Validate (the `OfflineRecordCeiling` rule divided by positions), with its message word for word; update `election.test.ts`.
- **A7.** Results: the verdict is `audit_overall` when present; FAIL lists `audit_failed_checks`; an empty row set reads "Not verified yet", not FAIL.
- **A8.** The list chip "Verified" only when `audit_overall === "pass"`; "Audit failed" when `"fail"`.
- **A9.** A missing correctness.csv after a verify that ended in error shows the SSE error, not the raw 404.
- **A11.** The Run step retries a failed first `loadCeremony` on its interval.
- **A16.** A Retry button on the "Could not reach the election console" screen.
- **A14.** Split `VITE_CONSOLE_URL`:
  - `VITE_CONSOLE_PROXY` is the Vite dev proxy target;
  - `VITE_CONSOLE_URL` stays the client base, default `""`.

  The copied trustee link uses `window.location.origin + path` only when the base is empty, and the base otherwise. Update `vite.config.ts` and any README line that names the variable.
- Tests for each: a double click sends one POST; a publish that gets 202 then fails shows the error; Results for pass, fail with checks, and empty; the chip verdicts; the offline-limit validation; retry after an unreachable console.
- Run `pnpm -r test`, `typecheck`, `lint` and `sh tools/build-web.sh`.
