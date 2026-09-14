# Admin console + console auth: end-to-end browser smoke (2026-09-14)

Task T3 of [`docs/plans/2026-09-14-admin-console-and-simple-auth.md`](../plans/2026-09-14-admin-console-and-simple-auth.md).
This is a validation run only. No product code was changed. It exercises the merged console
authentication (saksi PR #42) and the dynamic admin app with trustee sign-in (balotachain PR #56)
in a real headless browser, against a real console, in offline mode.

**Result:** all 11 scenario steps pass, and all 6 negative checks behave as specified. One exception:
the anonymous `?operator=1` sealed-view check cannot be observed offline (see N4). The run found
five defects: one Important, two Minor, and two Cosmetic. None of them is an authorization
bypass.

## Environment

| Item | Value |
|---|---|
| Host | Windows 11, Windows side only. WSL, its Fabric network, and port 8090 were not touched |
| saksi | `main` at `adba922` (merge of PR #42), in a fresh detached worktree |
| balotachain | `main` at `b27938e` (PR #56), in a fresh detached worktree |
| Console | `go build -o saksi-campaign.exe ./cmd/saksi-campaign` (go1.26.5) |
| saksi-demo | `saksi-instrument-gap/target/release/saksi-demo.exe` |
| Web apps | `corepack pnpm install`, then `@balotachain/ui`, `auditor`, `trustee`, and `admin` builds, assembled into `dist-web/{board,trustee,admin}` exactly as `tools/build-web.sh` does |
| Users file | Made with `saksi-campaign hash-password` (cost 12, password on stdin). Accounts: `admin` (admin), plus `trustee1`, `trustee2`, `trustee3` (trustee, `trustee_id` `1`, `2`, `3`). Passwords were random and kept outside the repo |
| Browser | playwright-core with Chromium 1234, headless, 1280×900 viewport, one browser context per actor |

The console command line (offline: no Fabric flags):

```
saksi-campaign serve --addr 127.0.0.1:8097 --runs <scratch>/runs \
  --web-dir <balotachain-smoke>/dist-web --auth-file <scratch>/users.json \
  --demo <saksi-instrument-gap>/target/release/saksi-demo.exe
```

The startup banner reported `auth on` and `on-chain (no driver configured — offline mode only)`.
Pre-checks:

- `GET /api/capabilities` returned `200 {"fabric":false,"peer":"localhost:7051","channel":"saksi"}`.
- `GET /api/me` returned `401 {"error":"login required"}`.

**Election under test:**

- Run: `smoke-100-20260914-104829-1`
- Name: "Smoke 100"
- Trustees: COMELEC, Civil Society Watch, University IT
- Threshold: 2
- Positions: 2 (President, Vice President)
- Candidates: 3
- Voters: 100
- Distribution: `realistic`
- Mode: `offline`
- Senate seats: 2 (left at the form default, which the brief did not specify)

## Scenario

Screenshots are in [`2026-09-14-admin-auth-smoke/`](2026-09-14-admin-auth-smoke/).

| Step | What was checked | Result | Screenshot(s) |
|---|---|---|---|
| 1 | `/admin/` shows sign-in. A wrong password shows the server's text. The admin login lands on Elections | **Pass.** The banner reads `invalid credentials`, verbatim from the 401 | `01a-admin-signin.png`, `01b-admin-wrong-password.png`, `01c-admin-elections.png` |
| 2 | Create "Smoke 100" (3 trustees, threshold 2, 2 positions, 3 candidates, 100 voters, realistic, offline). The run appears | **Pass.** `GET /runs` lists the run with exactly that config, and the Elections list shows it (`11b`) | `02a-election-form.png`, `02b-election-created.png` |
| 3 | Population shows the validation report and its counts | **Pass.** "All checks passed", 7 of 7 checks. Voters 100, ballot records 200, credential proofs 200, well-formedness proofs 600, partial decryptions 18. `GET /api/check` returns `pass=true voters=100 rows=100` | `03-population.png` |
| 4 | Run: start, see progress events, reach completion | **Pass.** The SSE lines "preparing the election bundle…" and "local ceremony ready — no ledger…" appear, then the "closed to new ballots" banner. The offline run at 100 voters had already finished when the 3 s progress capture was taken, so only the finished state is kept | `04b-run-complete.png` |
| 5 | Ceremony roster shows 0 of 2; copy the `/trustee/?run=` links | **Pass.** Three rows show Pending and "0 of 2 submitted", and Publish is disabled. Copy put `http://127.0.0.1:8097/trustee/?run=smoke-100-20260914-104829-1&trustee=1` on the clipboard, read back through `navigator.clipboard` | `05-ceremony-0-of-2.png` |
| 6a | Trustee 1 signs in at their own link (a separate context) | **Pass** | `06a-trustee1-signin.png`, `06b-trustee1-signed-in.png` |
| 6b | Trustee 1 opens trustee 2's link | **Pass, with observation O1.** The notice reads "This link is for trustee 2 (Civil Society Watch). You are signed in as trustee1, trustee 1 (COMELEC), so you can submit only COMELEC's share, not Civil Society Watch's." Before trustee 1 has submitted, the page still offers **their own** Submit button. After they submit, no submit control appears (`06g`) | `06c-trustee1-on-trustee2-link-before-submit.png`, `06g-trustee1-on-trustee2-link-after-submit.png` |
| 6c | Trustee 1 submits | **Pass.** Confirm dialog, then "Partial decryption submitted" | `06d-trustee1-confirm.png`, `06e-trustee1-submitted.png` |
| 6d | Trustee 2 signs in and submits (a third context) | **Pass.** "Threshold reached", 2 of 2 submitted | `06f-trustee2-submitted.png` |
| 6e | The admin session on the trustee page is read-only | **Pass.** "Signed in as admin, an administrator. Trustees submit their own shares, so this page is read-only for you." No submit control | `06h-admin-on-trustee-page.png` |
| 7 | Admin: threshold met, Publish enabled, publish succeeds | **Pass.** 2 of 2 submitted, "Threshold reached", Publish enabled. After publishing, "Next: verify results" becomes enabled | `07a-ceremony-threshold-met.png`, `07b-published.png` |
| 8 | Results: Verify, per-contest totals with E = 0, pass; board and trail links | **Pass.** Six contests, all with E = 0 and Pass, and an "E = 0 · PASS" chip. The board link (`/board/?run=…`) opens the published board. The trail link is not shown for offline runs, by design (PR #56), because `/api/trail` needs Fabric (see D3) | `08a-results.png` |
| 9 | `/board/?run=<id>` without login shows the result; verify a tracking code | **Pass.** Same page as the one reached from the admin link. The code `BC-D259-9708` comes from `ballots.csv` row 57 (vice-president, nullifier `d2599708…`). The board answers "Found — ballot BC-D259-9708 for Vice President is in this election's record and included in the count." | `09a-board-public.png`, `09b-board-tracking-code.png` |
| 10 | Negative checks (table below) | **Pass**, except that N4 cannot be observed offline | `10-trustee3-locked-out.png` (the lockout text in the trustee sign-in) |
| 11a | Sign out in admin | **Pass.** The sign-in screen returns, and `GET /api/me` is then `401` | `11a-signed-out.png` |
| 11b | Session ended elsewhere (`POST /api/logout` from the same cookie jar), then the next UI action | **Pass.** Clicking Open on the run makes an API call, gets 401, and returns to sign-in | `11b-signed-in-again.png`, `11c-next-call-sign-in.png` |

The browser console showed no `pageerror` in any context. Every console error is one of:

- an expected 401 from `/api/me` before sign-in;
- the expected pre-verification 404 on `correctness.csv`;
- the items listed under Defects;
- `favicon.ico` noise (C2).

## Negative checks (raw HTTP, curl, no `Origin` header)

| # | Request | Expected | Got |
|---|---|---|---|
| N1 | anonymous `POST /generate` | 401 | **401** `{"error":"login required"}` |
| N2 | trustee1 session `POST /generate` | 403 | **403** `{"error":"admin role required"}` |
| N3 | trustee3 session `POST /ceremony/submit` `{"trustee_id":"1"}` | 403 | **403** `{"error":"signed in as trustee \"3\": a trustee may submit only their own shares"}` |
| N4 | anonymous `GET /api/trail/<id>?operator=1` | sealed view | **Not observable offline.** `502 chain unreachable: read TLS cert: open : The system cannot find the file specified.` The handler dials Fabric before the seal gate, so an admin session gets the same 502. Nothing leaks, but the sealed/unsealed distinction needs an on-chain run |
| N5 | anonymous `GET /export/<id>/correctness.csv` | 401 | **401** `{"error":"login required"}` (control: an admin session gets 200) |
| N6 | trustee3: five wrong passwords, then the correct one | 429 + Retry-After, admin unaffected | Five times **401** `invalid credentials`, then **429** with `Retry-After: 30` and `{"error":"too many failed logins; try again shortly"}`. Admin's correct password during the lockout gets **204** |

Extra checks run at the same time:

| # | Request | Got |
|---|---|---|
| X1 | admin session `POST /ceremony/submit` `{"trustee_id":"1"}` | **403** `{"error":"only a trustee may submit trustee shares"}` |
| X2 | anonymous `POST /ceremony/publish` | **401** |
| X3 | anonymous `GET /events?run=<id>` | **401** |
| X4 | trustee1 session `GET /api/check/<id>` | **403** `admin role required` |
| X5 | `POST /api/login` with `Origin: http://evil.example` | **403** `cross-origin request rejected` |

## Defects

### D1 (Important): public board download links are dead with auth on

- **Where:** balotachain `apps/auditor` (footer) together with saksi's route table (`/export/` is admin-only).
- **Step:** 9, and a follow-up probe of the same page.
- **What happened:** anonymous visitors to `/board/?run=<id>` see these links, all of which point at `/export/<run>/<artifact>`:
  - "Download verification data";
  - a per-artifact link list (`election.csv`, `ballots.csv`, `correctness.csv`, `ground-truth-ballots.csv`, `ground-truth-summary.csv`, `perf.csv`, `perf-schema.md`, `header.json`, `ballots.ndjson`, `journal.ndjson`, `timings.json`, `gen-timings.json`, `run.json`, `ground-truth-check.json`).

  With `--auth-file` set, all 15 hrefs return `401 {"error":"login required"}`. The footer copy still says "Anyone can download the encrypted ballot record and independently re-run every check on their own machine — no trust in the operator required". The page also advertises ground-truth artifact names that the plan (§4.2) keeps admin-only.
- **Expected:** the public board should not offer downloads the public cannot fetch. There are two ways to get there, and choosing between them is a plan decision this smoke does not make:
  - the board hides or relabels the links when auth is on; or
  - the console exposes a public subset (for example the encrypted `ballots.*`, `header.json` and `election.csv`) and keeps ground truth admin-only.
- **Evidence:** `D1a-board-footer-links.png`, `D1b-board-export-link-anonymous.png`. Browser log:
  ```
  10:51:35.215Z [public-downloads] HTTP 401 GET http://127.0.0.1:8097/export/smoke-100-20260914-104829-1/election.csv
  10:51:35.217Z [public-downloads] console.error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
  ```

### D2 (Minor): trustee live stream never starts after signing in on the page

- **Where:** balotachain `apps/trustee/src/App.tsx`, the SSE effect at about line 1425, which depends only on `[runId]`.
- **Step:** 6a.
- **What happened:** the trustee app opens `EventSource('/events?run=')` on page load, before a session exists. `/events` is signed-in only, so it gets 401. EventSource does not reconnect after a non-200 response, and the effect does not re-run on sign-in, so the audit log's live lines stay empty for the rest of that page load. With the session cookie already present at load, the same page gets 200.
- **Expected:** subscribe once the session is known (add the auth state to the effect's dependencies).
- **Evidence:** a probe script that signed trustee1 in two ways:
  ```
  sign in on the page:            /events responses = [401]
  session cookie present at load: /events responses = [200]
  ```
  Browser log from step 6a:
  ```
  10:49:01.802Z [trustee1] HTTP 401 GET http://127.0.0.1:8097/api/me
  10:49:01.804Z [trustee1] HTTP 401 GET http://127.0.0.1:8097/events?run=smoke-100-20260914-104829-1
  ```
- **Impact:** a liveness cue only. The 4 s ceremony poll is the state of record, and the roster did update in `06e` and `06f`.

### D3 (Minor, pre-existing from PR #54, not auth): "Open verifier" on the board is broken for offline runs

- **Where:** balotachain `apps/auditor` footer, which uses `verifierUrl` → `/trail/<id>`.
- **Step:** 8/9 (probe).
- **What happened:** for an offline run the board still shows "Open verifier". The trail page then shows "Failed to load: request failed: 502", because `/api/trail` needs Fabric. The admin Results screen already hides its trail link for offline runs for this reason.
- **Expected:** hide the link, or explain it, when `mode` is offline.
- **Evidence:** `D2-open-verifier-offline.png`. Browser log:
  ```
  10:51:35.272Z [public-downloads] HTTP 502 GET http://127.0.0.1:8097/api/trail/smoke-100-20260914-104829-1
  ```

### C1 (Cosmetic): admin step tabs still truncate at 1280 px

- **Where:** balotachain `apps/admin`.
- **Steps:** 2–8.
- **What happened:** at a 1280×900 viewport the step tabs read "Populat…" and "Ceremo…". PR #56 removed the number prefix from the labels, but the tabs still truncate.
- **Expected:** full labels at a common desktop width.
- **Evidence:** `03-population.png`, `05-ceremony-0-of-2.png`.

### C2 (Cosmetic)

**Validation detail text** (saksi `check.go:221`, step 3):

- **What happened:** the detail reads "V-000001 through V-100".
- **Expected:** "V-000001 through V-000100"; the last id in `ground-truth-ballots.csv` is `V-000100`. The code concatenates `strconv.Itoa(rows)` without zero padding.
- **Evidence:** `03-population.png`.

**`favicon.ico` console noise** (saksi route table):

- **What happened:** every app page requests `/favicon.ico`. That path falls to the `/` catch-all, which is admin-only, so it logs a 401 for anonymous visitors and a 403 for trustees in the browser console. No functional effect.

## Observations (not defects)

- **O1:** a signed-in trustee on another trustee's link is still offered their own Submit button until they have submitted (step 6b). The notice states this, the button submits only the session's own share, and the server refuses cross-trustee shares (N3). PR #56 chose this design. The brief expected "no submit"; after the trustee has submitted, that holds (`06g`).
- **O2:** the unsealed trail view (N4) and the on-chain path in general were not exercised, because the plan keeps this smoke offline.
- **O3:** step 1's deliberate wrong admin password counted against the `(loopback, admin)` lockout key, and the successful login reset it, as the runbook describes.
- **O4:** the full-page screenshot of `06f` was retaken, scrolled to the top, because the sticky trustee header had painted mid-image in the first capture. The page itself was fine.
