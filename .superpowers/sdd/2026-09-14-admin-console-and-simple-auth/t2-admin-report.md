# T2 report: dynamic admin console with sign-in, and trustee login (balotachain)

**Status:** DONE_WITH_CONCERNS (the concerns are follow-ups, not blockers).
**Branch:** `feat/admin-console`, off `origin/main` 34b1a92. Worktree: `balotachain-admin`.
**PR:** https://github.com/saksi-framework/balotachain/pull/56. CI: all 13 jobs pass; the Fabric job is skipped on PRs.

## Commits

- `7fdc7d9 feat(admin): drive the admin console from the saksi console API, with sign-in`
- `8b81a97 feat(trustee): sign in, and take the trustee identity from the session`

## Files

| File | Change |
|---|---|
| `apps/admin/src/lib/bulletin.ts` | Rewritten in place as the fetch client, following #54. Adds `ApiError(status, message)`, where the message is the console's text: plain `http.Error` prose, or the auth routes' `{"error"}`. Functions: `getMe` (404 → `null`, meaning auth off), `login`, `logout`, `listRuns`, `getCapabilities`, `generateElection`, `checkPopulation`, `runStatus`, `loadElectionSummary` (election.csv), `startCeremony`, `loadCeremony`, `publishTally`, `verifyRun`, `loadCorrectness` (correctness.csv), `subscribeEvents`, `parseCsv` (RFC 4180, because Go csv.Writer quotes names that contain commas), and `boardUrl`/`trailUrl`/`trusteeUrl`. Each type cites the Go struct it mirrors. |
| `apps/admin/src/lib/election.ts` (new) | Pure model: the form, `toElectionConfig` (numbers as numbers), `validateConfig` (mirrors `ElectionConfig.Validate` word for word), `reduceProgress` (SSE reducer: filters by phase, counts ledger commits, terminal states stick, keeps 50 lines), position and contest labels (mirror `ph_position_id` and `posLabel`/`candLabel`), and `stepFor` (where to reopen a run). |
| `apps/admin/src/App.tsx` | Sign-in, Elections list, and a 5-step wizard. The mockup's components and tokens are kept, and its voter-roll table is generalised into `Table`. |
| `apps/admin/src/App.test.tsx`, `lib/bulletin.test.ts`, `lib/election.test.ts` | Rewritten or new. The `vi.mock("./lib/bulletin")` boundary is kept, as in #54. |
| `apps/admin/src/mocks/defaults.ts` | Deleted. |
| `apps/admin/vite.config.ts` | `base: "/admin/"`, `build.outDir: dist`, and the console proxy with `Origin` stripped. Prefixes: `/api /runs /export /events /generate /verify /ceremony /board /trustee /trail`. |
| `apps/admin/README.md` | Replaces the stale Tauri/credential-issuance text with the screen → route table. |
| `tools/build-web.sh`, `tools/build-web.ps1` | Also build `admin` into `dist-web/admin`. |
| `apps/trustee/src/lib/bulletin.ts` | Adds `ApiError` with status, JSON `{"error"}` extraction, `Session`, `getMe` (404 → null), `login` and `logout`. GET error text keeps #54's "`path` returned N: …" format. |
| `apps/trustee/src/App.tsx` | Auth state and a `Login` card. The acting id is `session.trustee_id` when signed in, otherwise `?trustee=` as before. Shows a notice when the link is for another trustee, a read-only view for admins, and a Sign out button. localStorage recall and the picker apply only with auth off. The key-share note depends on the session. A 401 from any call returns to login. |
| `apps/trustee/src/App.test.tsx`, `lib/bulletin.test.ts` | `getMe`/`login`/`logout` are mocked, with `getMe` → `null` by default, so all 13 original tests pass unchanged. Adds 8 auth tests and 5 client tests. |

## Screen → route map as built

| Screen | Routes |
|---|---|
| Sign in | `GET /api/me`, `POST /api/login`, `POST /api/logout` |
| Elections | `GET /runs` (ground-truth runs hidden; status comes from `artifacts`), `GET /api/capabilities` (the On-chain option is disabled unless `fabric`) |
| 1 Election | `POST /generate` |
| 2 Population | `/events` (generate), `GET /api/runs/<id>/status` until not busy, then `GET /api/check/<id>` and `GET /export/<id>/election.csv`. Next is blocked unless `report.pass`. |
| 3 Run | `/events` (ceremony), `POST /ceremony/start`, then poll `GET /api/ceremony/<id>` for `ready` and `GET /api/runs/<id>/status` to detect a run that stopped short |
| 4 Ceremony | `GET /api/ceremony/<id>` every 4 s until published, `POST /ceremony/publish` (enabled at `unlocked`), and a copyable `/trustee/?run=<id>&trustee=<n>` link per trustee |
| 5 Results | `GET /export/<id>/correctness.csv` (a 404 means "Run verification"), `POST /verify`, `/events` (verify), poll status until not busy, reload. Shows `source=local` rows, overall PASS, the `ledger_matches_local` line (on-chain only), `tally_sha256`, the board link, and the trail link (on-chain only). |

## D1 (Population step): where the numbers come from

- `CheckReport` (check.go): `checks`, `pass`, `voters`, `rows`, `distribution`, `positions`, `candidates`, `ground_truth_ballots_sha256`. Confirmed: the Rust generator writes the ground-truth CSVs on every run, not only in ground-truth mode (csvexport.go comment), so `/api/check` works for offline and on-chain runs. The live smoke run passed all 7 checks.
- `election.csv` (`writeElectionCSV`):
  - `voters`: shown as voter credentials, one per voter
  - `num_ballots`: ballot records, and credential presentation proofs (one per record, per the `Ballot` proto)
  - `num_partial_decryptions`
  - `issuer_public_key`
  - `ballots_sha256`
- Well-formedness proofs = `num_ballots × candidates`. This is derived from the proto (one CDS proof per candidate ciphertext) and labelled as such in the UI. The alternative, downloading `ballots.csv` to sum `num_wellformedness_proofs`, would mean pulling about 100 MB at 10K voters.
- Credentials are never issued from the UI, and a banner says so.

## Deviation from plan §5 (stop condition applied)

**Run = `POST /ceremony/start`, not `POST /submit`.** On the real console:
- `Executor.Submit` in offline mode only publishes "offline mode: nothing submitted on-chain".
- In on-chain mode, `submitOnChain` runs `setupOnChain`, then all partials, then `PublishTally`. That bypasses the trustee ceremony, and the later `CeremonyStart` would re-send `CreateElection` for an election that already exists.

The console's own `web/wizard.html` never calls `/submit`. Its "encrypt + record" step is `/ceremony/start`, which runs the lifecycle prefix through `CloseElection` and stops for the trustees. The screen follows the real API. The admin client has no `/submit` function.

A smaller point: plan §5 lists only `GET /api/check/<run>` for Population. Generation is asynchronous (202), so the step also polls `GET /api/runs/<id>/status` (admin route in T1's table) before reading, and reads election.csv for the counts.

## How login degrades with auth off

Both apps call `GET /api/me` on load:
- `404` → auth off. The saksi console on main answers from the `handleIndex` catch-all, and T1's report confirms that with auth off the auth handlers return `http.NotFound`, pinned by `TestAuthOffLeavesEveryRouteOpen`.
  - Admin: no login screen; the header says "Console authentication is off"; the footer says anyone who can reach the console can administer.
  - Trustee: exactly #54's behaviour, with the picker and the no-auth notice.
- `401` → login.
- Session → signed in.
- In the admin app, a trustee session gets "needs an administrator account" and no admin calls are made.

Verified live: `/api/me` → 404 on saksi main.

## Verification

- Local, the same commands CI runs:
  - `pnpm lint`: clean
  - `pnpm format:check`: clean
  - `pnpm -r typecheck`: 4/4
  - `pnpm -r test`: admin 54 (App 15, client 21, model 18), trustee 32 (App 21, client 11), auditor 28 unchanged
  - `pnpm -r build`: 3/3. The `dist/index.html` asset paths are `/admin/assets/…`.
- TDD: the model test was run red (missing module) before `election.ts`. The trustee "no 'Not you?' on the login screen" assertion was confirmed red by temporarily reverting the fix. The client and App were written with their tests, not strictly test-first.
- **Real console, live:**
  - Built `saksi-campaign` from a `git archive` of saksi `origin/main` (076b730) into the scratchpad. Ran it offline on `127.0.0.1:8097` with its own `--runs` dir, using the existing `saksi-demo.exe`. Port 8090, the WSL network, and the main balotachain and saksi checkouts were not touched.
  - A throwaway vitest file (node environment, not committed) drove this client module through `getMe(404→null)`, `capabilities`, a `generate` 400 (text verbatim), `generate`, `status`, `check`, `election.csv` (quoted name "Smoke, Test" parsed), `runs`, `ceremony/start`, `ready`, `publish` (409 verbatim: "the tally needs 2 of 3 trustees; 0 have contributed so far"), submit ×2, `publish`, pre-verify `correctness.csv` (404), `verify`, and `loadCorrectness` (12 rows, all pass). Every shape matched.
  - Playwright-core with the cached Chromium drove the built admin bundle, served by a scratch static + proxy server that stands in for `--web-dir`: New election (40 voters, 3-of-5) → Population "All checks passed" → Encrypt and record (SSE lines streamed) → Ceremony (3 submits via API → "Threshold reached") → Publish → Run verification → "E = 0 · PASS" → list shows "Verified". Browser console errors were only the expected 404s.
  - Login screens for both apps were checked against a faked `/api/me` and `/api/login` 401.
  - The screenshots exposed two bugs, both fixed before committing. Step labels "1 Election" duplicated the badge number and truncated at 5 steps; they are now "Election" and so on. The trustee TopBar showed "Not you?" on the login screen; it now has a regression test.
- Screenshots are in the scratchpad (`scratchpad/pw/*.png`) and are not attached to the PR, because gh cannot upload images.

## Concerns / follow-ups

1. **Dev-proxy env var clash (inherited from #54, all three apps).** `VITE_CONSOLE_URL` is read by `vite.config.ts` as the proxy target and by `lib/bulletin.ts` as `BASE` (import.meta.env). Setting it therefore makes the browser call the console cross-origin, which is blocked by CORS and, with auth on, sends no cookie. The documented dev flow works only when it is unset (default `:8090`). Fix: a non-`VITE_` variable (e.g. `CONSOLE_URL`) for the proxy target in all three configs, plus the #54 update doc. This PR did not touch auditor or trustee configs, to stay in scope.
2. **SSE on an expired session.** `EventSource` cannot see a 401 (T1 makes `/events` signed-in only). The stream just stops, and the next poll or POST's 401 is what returns the app to login. In the Population and Run steps the polls hit admin routes (`/api/runs/…/status`), so a 401 surfaces within 1.5 s.
3. **Ground-truth mode** is neither offered in the wizard nor listed, because it has no ceremony. Researchers still have `/wizard`.
4. **The on-chain path was not exercised live.** The ledger-commit count parses the `lifecycle` step message ("… committed: block N") and "N ballots committed in …" (executor.go). The `ledger_matches_local` line is covered only by the parser test. T3 is offline by plan.
5. **The admin trail link** is shown only for on-chain runs, because `/api/trail` dials Fabric and 502s offline.
6. **`/admin/` is not served by saksi main** until T1 merges (T1 adds `admin` to `mountWebDir`).
