# Admin console + simple auth: make the client side dynamic end to end

Date: 2026-09-14. Status: **approved 2026-09-14** — D1: read-only Population step; D2: docs PR from `ci/audit-trail` opened. PR #54 squash-merged (34b1a92). Repos: `saksi` (console
API + auth) and `balotachain` (browser apps). Builds on saksi PR #35 (board API,
`--web-dir`, merged) and balotachain PR #54 (dynamic board + trustee, open, CI green).

## 1. Is the admin interface the only missing piece?

For the **operator → trustees → public board** flow: yes, plus login. For **real
people casting their own ballots**: no. That is a separate, larger gap.

| App | Today | Missing for a dynamic demo |
|---|---|---|
| `apps/auditor` (public bulletin board) | Dynamic, served at `/board/?run=`, reads `/api/board`, `/api/verify-code` | Nothing, once PR #54 merges |
| `apps/trustee` (trustee console) | Dynamic, served at `/trustee/?run=&trustee=n`, submits `/ceremony/submit`, `/ceremony/publish` | Login: today anyone can act as any trustee by changing `?trustee=` |
| `apps/admin` (superadmin) | **Static mockup.** `App.tsx` imports `./mocks/defaults`; no API calls | Everything: create election, drive the lifecycle, open the ceremony, publish, verify, results; login |
| `apps/voter` (Flutter) | Writes through the `balota-encrypt` CLI into the file store / `bulletin-gateway` stub, with stub credentials | A live voting path: voter roll, per-voter credential issuance, client-side encryption under the election key, a ballot submission endpoint to the chain. **Out of scope here** |
| Console auth | **None.** Loopback bind, Host allowlist, same-origin POST guard (`guard()` in `server.go`) | Sessions + roles on the write routes |

The reason the voter gap is separate: the console is a research harness. An election
is a *run* created by `POST /generate`, and the console generates the whole voter
population and every ballot itself (`saksi-demo gen --stream`). There is no API for a
human voter to register, receive a credential, or submit a ballot. Building that is
"live-election mode" — weeks, not days — and touches the Flutter app, new saksi
endpoints and the credential issuance flow.

## 2. Scope of this plan

In: merge PR #54; simple auth in the console; a dynamic admin app with login; trustee
login bound to trustee identity; an end-to-end browser smoke test; a refreshed
function-mapping artifact.

Out: live voter casting (voter roll, credential issuance, voter app submission),
TLS, multi-user management UI, persistent sessions, password reset.

## 3. Decisions

Defaults taken (conventional, stated so they can be overridden):

- **Auth is off unless configured.** `--auth-file <path>` (env `SAKSI_AUTH_FILE`)
  turns it on. Without it the console behaves exactly as today, so `--repeat`, the
  ladder, `tools/*.sh` and every existing test keep working unchanged.
- **Users live in a file**, one JSON object per user: `username`, `role`
  (`admin` | `trustee`), `trustee_id` (trustees only), `password_bcrypt`. A
  `saksi-campaign hash-password` subcommand prints a hash. `golang.org/x/crypto` is
  already an indirect dependency; bcrypt comes from it.
- **A trustee's identity comes from the session**, not the URL. A trustee can submit
  only their own shares; `?trustee=` stays for display only.
- **Sessions are in memory.** A console restart logs everyone out. Marked with a
  `ponytail:` comment; a persistent store is future work.

Needing the user (asked alongside this plan):

- **D1. Admin steps 2–3 ("Voter roll", "Credentials").** The mockup has them; the
  console has no voter-roll or credential API. Recommended: turn them into a
  read-only **Population** step (voter count, distribution, the validation gate's
  report from `GET /api/check/<run>`, credential and proof counts from the run's
  artifacts). Alternatives: hide them, or build live-election mode now.
- **D2. When to land `ci/audit-trail` on `main`.** 15 commits of thesis docs
  (manuscript amendments, desktop runs, CLAIMS.md, cost model) exist only on that
  branch; PR #52 merged before them.

## 4. Console API contract (saksi)

### 4.1 New routes

| Route | Body / response | Notes |
|---|---|---|
| `POST /api/login` | `{"username","password"}` → `204` + `Set-Cookie: saksi_session=…; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200` (`Secure` when served over TLS) | `401 {"error":"invalid credentials"}` for any failure, same text and similar timing for unknown user and wrong password. Five failures from one remote address → `429` for 30 s |
| `POST /api/logout` | → `204`, cookie cleared, session deleted | |
| `GET /api/me` | → `{"username","role","trustee_id"?}` or `401` | The apps call this on load |

Session token: 32 random bytes, base64url. Stored server-side as
`token → {username, role, trustee_id, expires}`; compare with constant time.
Existing `guard()` (Host allowlist + same-origin POST) stays in front of everything;
the auth check runs after it.

### 4.2 Route roles (only enforced when `--auth-file` is set)

| Role | Routes |
|---|---|
| **public** | `GET /api/board/`, `GET /api/verify-code/`, `GET /trail/`, `GET /api/trail`, `GET /api/trail/`, `GET /api/capabilities`, `GET /api/ceremony/` (status), `GET /runs`, static `/board/`, `/trustee/`, `/admin/`, `POST /api/login`, `POST /api/logout`, `GET /api/me` |
| **trustee or admin** | `POST /ceremony/publish`, `GET /events` |
| **trustee (own shares only)** | `POST /ceremony/submit` — `403` unless the body's trustee id equals the session's `trustee_id`; admins may not submit a trustee's shares |
| **admin** | `POST /generate`, `/submit`, `/verify`, `/run-all`, `/cancel`, `/scenarios`, `/attack`, `/ceremony/start`, `/api/runs/` actions, `GET /api/check/`, `GET /api/scenarios/`, `GET /export/`, `GET /wizard`, `GET /` (the research console page) |

No session → `401 {"error":"login required"}`. Wrong role → `403 {"error":"…"}`.
`/export/` is admin-only because run exports include the seeded ground truth.

### 4.3 Static hosting

`mountWebDir` gains `admin`, so `<web-dir>/admin` is served at `/admin/`.

### 4.4 Tests (Go)

Auth off: every existing test passes untouched. Auth on: each role table row has a
table-driven test for allowed / 401 / 403; login success, wrong password, unknown
user, lockout after five failures; logout invalidates; expired session rejected;
trustee submitting another trustee's shares → 403; cookie flags asserted;
`hash-password` round-trips with bcrypt.

## 5. Admin app (balotachain `apps/admin`)

Same pattern as PR #54: rewrite `src/lib/bulletin.ts` in place as a fetch client,
delete `src/mocks/defaults.ts` usage, build to `<web-dir>/admin`, Vite dev proxy to
the console. Keep the Claude Design visual language from PR #53.

| Screen | Calls | Behaviour |
|---|---|---|
| Login | `POST /api/login`, `GET /api/me` | Redirects to Elections when a session exists; shows `401` text as-is |
| Elections | `GET /runs`, `GET /api/capabilities` | List with status per run; "New election"; on-chain mode only offered when `fabric:true` |
| 1 Election | `POST /generate` with `ElectionConfig` (`name`, `trustees[].name`, `threshold`, `positions`, `candidates`, `senate_seats`, `voters`, `distribution`, `mode`) | Server `400` text (validation, ladder gate, disk guard) shown verbatim under the form |
| 2 Population (per D1) | `GET /api/check/<run>` | Validation-gate report, voter count, distribution |
| 3 Run | `POST /submit`, `GET /events?run=` (SSE) | Live stage progress; on-chain receipts count |
| 4 Ceremony | `POST /ceremony/start`, `GET /api/ceremony/<run>` | Trustee roster with submitted/not, threshold meter, copyable `/trustee/?run=` link; Publish button enabled at threshold → `POST /ceremony/publish` |
| 5 Results | `POST /verify`, `GET /export/<run>/correctness.csv`, links to `/board/?run=` and `/trail/<run>` | Per-contest totals, `E`, pass/fail, ledger match |

Trustee app change (same PR): a login screen, `GET /api/me` on load, trustee id from
the session, a clear message when a trustee opens another trustee's link.

Tests (Vitest): the fetch client per route; form → `ElectionConfig` mapping;
`401` → login redirect; `403` message; the SSE progress reducer; `App.test.tsx`
module mocks kept working as in PR #54.

## 6. Tasks

| # | Task | Repo / where | Model | Reviewer | Depends |
|---|---|---|---|---|---|
| T0 | Merge PR #54 (dynamic board + trustee) | balotachain `main` | — | already green | user go |
| T1 | Console auth (§4) + `admin` web mount | saksi, worktree `saksi-auth` | executor (Opus) | final-reviewer (Opus), security focus | — |
| T2 | Admin app dynamic + login; trustee login (§5) | balotachain, worktree off `main` after T0 | executor (Opus) | reviewer (Sonnet) | T0; contract §4 (can start before T1 merges, against fetch mocks) |
| T3 | End-to-end browser smoke: console on Windows, **offline** mode, a separate port, `--auth-file` + `--web-dir`; admin creates a 100-voter election, submits, starts the ceremony; two trustees log in and submit; admin publishes and verifies; the board shows the result and a tracking code verifies. Screenshots per step | both | executor (Opus) | controller reads screenshots | T1, T2 merged |
| T4 | Refresh the "Saksi Execution Trace" artifact to current `main` (it predates saksi #35–#41) and add a "Client apps → API → Go functions" section with the auth layer and the admin/trustee/board screen map from §4–§5 | writes HTML file; controller publishes to the same URL | executor (Opus) | controller | T1, T2 merged (so the mapped code is real) |
| T5 | PR `ci/audit-trail` → `main` for the 15 docs commits (per D2) | balotachain | controller | — | user go |

Parallel lanes: T1 and T2 touch different repos and run at the same time. T3 and T4
wait for both. The WSL 10K validation run is unaffected: T3 uses offline mode on the
Windows side and never touches the WSL network or port 8090.

## 7. Risks and stated limits

- Auth is demo-grade: file-based users, in-memory sessions, no TLS termination, no
  audit log of logins. State this wherever the admin console is shown. The console
  stays loopback-bound by default.
- Admin steps 2–3 intentionally do not issue real voter credentials (D1). The
  thesis's voter-side claims still come from the harness, not from the admin UI.
- `/events` becoming trustee-or-admin means the public board cannot subscribe to
  progress; it already polls `/api/board`, so nothing breaks.
