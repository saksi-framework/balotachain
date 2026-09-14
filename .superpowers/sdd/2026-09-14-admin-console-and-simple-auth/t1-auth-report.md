# T1 report: console auth and the admin web mount (saksi)

- PR: https://github.com/saksi-framework/saksi/pull/42 (base `main`, head `feat/console-auth`)
- Worktree: `Q:/Code - LAPTOP/Code/projects/saksi-auth`, branched from `origin/main` 076b730
- Commits:
  - `20c4155 feat(campaign): optional console auth with route roles, serve the admin app`
  - `10e5186 docs(runbook): console authentication, roles and stated limits`

## What changed

| File | Change |
|---|---|
| `packages/saksi-campaign/auth.go` (new) | Users file loading and validation, `HashPassword`, `routeAccess` (the route → role table), `authorize` middleware, the in-memory session and lockout state, and the `/api/login`, `/api/logout` and `/api/me` handlers |
| `packages/saksi-campaign/auth_test.go` (new) | Every auth test (listed below) |
| `packages/saksi-campaign/server.go` | Adds `Server.auth` and `Server.routes`. The mux is now a `routeMux` (a ServeMux that records its patterns). Registers the three auth routes. The handler chain is `guard(authorize(mux))`. `mountWebDir` also serves `admin`. Share ownership is checked in `handleCeremonySubmit` |
| `packages/saksi-campaign/cmd/saksi-campaign/main.go` | New `--auth-file` flag (default from env `SAKSI_AUTH_FILE`), which calls `EnableAuth` and exits 1 with a clear message on error. New `hash-password` subcommand. Startup banner shows whether auth is on or off. Help text mentions `admin` |
| `packages/saksi-campaign/go.mod` | `golang.org/x/crypto v0.31.0` moves from indirect to direct. Nothing else changed |
| `packages/saksi-campaign/board_test.go` | `TestWebDirServesBoardAndTrustee` is renamed `TestWebDirServesBoardTrusteeAndAdmin` and its loop now includes `admin` |
| `docs/research-election-console-runbook.md` | New §4 "Authentication" subsection: `hash-password`, the users file, the flag, the role table and the stated limits. §5 no longer claims there is no login. §6b mentions the admin app |

## How auth stays off

`Server.auth` is nil unless `EnableAuth(path)` is called, and `main.go` calls it only when `--auth-file` or `SAKSI_AUTH_FILE` is set. While `auth` is nil, `authorize` calls `mux.ServeHTTP` directly, and the three auth handlers return `http.NotFound`, the same 404 those paths got from `handleIndex` before. No existing test needed a change to pass.

## Enforcement

`authorize` (in `auth.go`) is the single enforcement point:

1. Resolve the `saksi_session` cookie to a session and put it in the request context.
2. Look up `_, pattern := mux.Handler(r)`.
3. Apply `routeAccess[pattern].denial(sess)`.

The table is keyed by the ServeMux pattern, so it cannot disagree with the mux about which handler runs. The zero value of `access` is `accessAdmin`, so an unlisted pattern fails closed. The only per-handler check is share ownership in `handleCeremonySubmit`: once the body is decoded, the request gets `403` unless `sessionFrom(r).TrusteeID == body.trustee_id`. That check does nothing when auth is off, because the context then holds no session.

Role table (`routeAccess`):

| Role | Patterns |
|---|---|
| public | `/api/board/`, `/api/verify-code/`, `/trail/`, `/api/trail`, `/api/trail/`, `/api/capabilities`, `/api/ceremony/`, `/runs`, `/board/`, `/board`, `/trustee/`, `/trustee`, `/admin/`, `/admin`, `/api/login`, `/api/logout`, `/api/me` |
| signed in (trustee or admin) | `/ceremony/publish`, `/events` |
| trustee only | `/ceremony/submit` (an admin gets 403 "only a trustee may submit trustee shares") |
| admin | `/`, `/generate`, `/submit`, `/verify`, `/run-all`, `/cancel`, `/scenarios`, `/attack`, `/ceremony/start`, `/api/runs/`, `/api/check/`, `/api/scenarios/`, `/export/`, `/wizard` |

## Users file validation (`parseUsers`)

The file must be a JSON array, decoded with `DisallowUnknownFields`. Startup fails, naming the user by index and username, for:
- a file that is not a JSON array, or has unknown fields;
- an empty array ("nobody could log in");
- an empty username;
- a role other than `admin` or `trustee`;
- a trustee without `trustee_id`;
- an admin with `trustee_id`;
- a duplicate username;
- a `password_bcrypt` that `bcrypt.Cost` rejects.

`trustee_id` is a string: the wire id `"1"`..`"n"` that `partialsByTrustee` and `CeremonySubmit` use.

## Sessions and lockout

- **Token:** 32 bytes from `crypto/rand`, `base64.RawURLEncoding` (43 characters). Held in `map[token]session{Username, Role, TrusteeID, expires}` with a 12 h expiry. Every lookup, create and attempt prunes expired sessions and stale failure records. Tokens are never logged. The code carries a `ponytail:` note that state is in memory.
- **Cookie:** `saksi_session; Path=/; Max-Age=43200; HttpOnly; SameSite=Strict`, plus `Secure` when `r.TLS != nil`. Logout deletes the session and sets `Max-Age=-1`, which goes on the wire as `Max-Age=0`.
- **Login:** unknown user and wrong password return the same `401 {"error":"invalid credentials"}`. An unknown user is compared against `dummyHash`, a fixed, well-formed cost-12 bcrypt literal; a test asserts its cost.
- **Lockout:** a `failRecord` per remote IP (`net.SplitHostPort(r.RemoteAddr)`, no X-Forwarded-For), holding a count, a window start and `lockedUntil`.
  - `attempt(ip)` runs before the bcrypt compare. It refuses with 429 while the IP is locked, or while count ≥ 5 (which catches concurrent in-flight guesses). Otherwise it reserves a slot (`count++`). The window is 5 min.
  - `settle(ip, false)` locks the IP for 30 s once count reaches 5. `settle(ip, true)` gives back only its own reservation.
  - A success therefore never clears earlier failures, so a user with a valid account cannot reset the counter between guesses at another account. There is a test for this.
  - The 429 carries `Retry-After` in whole seconds.
- **`hash-password`:** `campaign.HashPassword(os.Stdin)` reads the first line, strips trailing `\r\n`, rejects an empty result, and runs `bcrypt.GenerateFromPassword` at cost 12. It writes a one-line hint to stderr.

## Tests (all in `auth_test.go` unless noted)

| Test | Covers |
|---|---|
| `TestRouteRolesWhenAuthOn` | Table-driven over the plan §4.2 rows (public, trustee or admin, trustee own shares, admin). Each route is probed as anonymous, trustee `t1` and `admin`, expecting allowed (anything but 401/403), `401 {"error":"login required"}` exactly, or 403 with a JSON reason. Bodies are empty, so no allowed POST starts a phase |
| `TestRouteAccessCoversEveryRoute` | Every pattern `NewServer` registers (with the web dir mounted) is in `routeAccess`, and `routeAccess` names no pattern that is not registered |
| `TestAuthOffLeavesEveryRouteOpen` | No auth: `/wizard` and `/` return 200; `/api/me` and `/api/login` return 404 |
| `TestLoginSetsSessionCookieAndMe` | Login returns 204. Cookie flags checked on the parsed cookie and in the raw `Set-Cookie`. Token is 43 characters. `/api/me` returns the trustee JSON with a cookie and 401 without |
| `TestLoginCookieIsSecureOverTLS` | `Secure` is set when `r.TLS` is set |
| `TestLoginFailuresLookTheSame` | Wrong password and unknown user give an identical 401 body and no cookie. The dummy hash is cost 12 |
| `TestLoginLocksOutAfterFiveFailures` | Five 401s, then 429 with `Retry-After: 30` even for the correct password. Another IP is unaffected. After 31 s (fake clock) login works. Insider interleaving still locks |
| `TestLogoutInvalidatesSession` | Logout returns 204 and clears the cookie. The old token then gets 401 on `/api/me` and `/wizard` |
| `TestExpiredSessionRejected` | Clock advanced past 12 h gives 401, and the session is pruned |
| `TestTrusteeCannotSubmitAnotherTrusteesShares` | `t1` submitting `"2"` gets 403 JSON. `admin` submitting `"1"` gets 403. `t1` submitting `"1"` passes the check |
| `TestUsersFileValidation` | A valid file loads. One subtest per rejection rule. A missing file fails and leaves auth off |
| `TestHashPasswordRoundTrips` | A CRLF-terminated line hashes at cost 12, verifies with bcrypt, and is accepted by `parseUsers` |
| `TestHashPasswordRejectsEmpty` | `""`, `"\n"` and `"\r\n"` are rejected |
| `TestWebDirServesBoardTrusteeAndAdmin` (`board_test.go`) | `/admin/` is served and `/admin?run=x` redirects with the query kept |

A mutation check confirmed the tests catch real breakage. With `/export/` flipped to public, the lock threshold disabled, and the ownership check removed, `TestRouteRolesWhenAuthOn`, `TestLoginLocksOutAfterFiveFailures` and `TestTrusteeCannotSubmitAnotherTrusteesShares` each failed. The code was then restored.

## Verification

- **Windows `packages/saksi-campaign`:** `go vet ./...` and `gofmt -l .` are clean. `SAKSI_DEMO_BIN=…/saksi-instrument-gap/target/release/saksi-demo.exe go test ./... -count=1` is ok (18 s), with no skipped tests in `-v`. `TestSingleRunLockReturns409` passed this time.
- **Windows `packages/saksi-bulletin/client-sdk`:** `go vet`, `gofmt` and `go test ./... -count=1` are all ok.
- **WSL Ubuntu (Go 1.25.1):** the modules were copied to `/tmp` (campaign, client-sdk, saksi-protocol/go, saksi-bulletin/network) and `go test -race -count=1 ./...` passed for both modules with no data races. The demo-gated tests skipped there because there is no Linux `saksi-demo`. The first race run failed only `TestCommittedConfigtxDeclaresAdoptedOrdererParameters`, because the network fixture had not been copied; after copying it the run was clean. The temp dir was removed afterwards. The WSL Fabric network, tmux sessions and port 8090 were not touched.
- **Live smoke** (built binary, `127.0.0.1:18777`, offline):
  - anonymous `/wizard` → 401 JSON;
  - `t1` login → 204 with the expected cookie flags;
  - `/api/me` → trustee JSON;
  - `t1` on `/wizard` → 403 "admin role required";
  - `t1` submitting trustee 2's shares → 403;
  - `/api/capabilities` → 200 without a session;
  - logout → 204, then `/api/me` → 401;
  - a users file with a trustee lacking `trustee_id` → exit 1 with `--auth-file …: user 1 ("a"): a trustee needs a trustee_id`;
  - `hash-password` with empty stdin → exit 1.
- **CI on PR #42:** all 8 checks green (Build, Lint, Security, Test on ubuntu-latest and macos-latest).

## Deviations from plan §4 and why

1. **The token is a map lookup, not a constant-time compare.** The brief allows this: the lookup is a hash-map probe, and no token bytes are compared in user code.
2. **The table is keyed by route pattern, not method plus pattern.** Every method on a route gets that route's role. Handlers already reject wrong methods (`decodeJSON` requires POST). Keying on the mux's own resolution avoids a second router that could drift. With auth on, an unknown path resolves to `/` and gets 401 or 403 instead of 404. That fails closed.
3. **With auth off, the auth routes return 404.** The plan does not say. This keeps "behaves exactly as today". **T2 note:** the apps can treat `GET /api/me` → 404 as "this console runs without auth".
4. **The bare-path redirects `/board`, `/trustee` and `/admin` are public**, like the static apps they redirect to.
5. **Lockout details the plan leaves open:** a 5-minute failure window, attempts reserved before the bcrypt compare (concurrency), successes not clearing failures (so an insider cannot reset the counter), and a `Retry-After` header on 429.
6. **`/api/logout` requires POST** (405 otherwise), matching the contract's method.
7. **The ownership check runs before the run is looked up**, so a trustee gets 403 without learning whether a run id exists.
8. **Extra users-file rejections:** empty username, empty array, unknown JSON fields. A typo such as `trusteeid` fails loudly instead of being silently dropped.
9. **`go mod tidy` also wants `github.com/hyperledger/fabric-protos-go-apiv2` promoted to direct.** That drift predates this work and was left alone to keep the diff scoped.

## Concerns for the reviewer

- **`GET /api/trail/<id>?operator=1` stays public (plan §4.2).** Its unsealed operator view is gated only by `isLoopback(r.RemoteAddr)`. With auth on and the console loopback-bound, any loopback caller, anonymous included, can read a sealed trail before the tally is published. SSH-tunnel users all arrive as loopback. Suggested follow-up: when auth is on, require an admin session for `operator=1`. That would be a second per-handler check, so it was not done without sign-off.
- **One lockout counter per IP.** Everyone behind loopback (T3's admin and both trustees in one browser, or every tunnel user) shares it, so five typos by anyone lock everyone out for 30 s. The runbook states this.
- **`/runs` is public (plan).** It exposes run configs: trustee names, voter counts, modes.
- **`hash-password` echoes the password** on an interactive terminal. The brief allows this, and the runbook says so.
- **`EnableAuth` must be called before serving.** It is not safe to toggle while serving, and `main.go` calls it before `ListenAndServe`.

---

# Fix round 1 (Opus security review: no bypass found; verdict Needs fixes)

Commits:
- `946c2bc fix(campaign): admin-only operator trail, per-username lockout, review minors`
- `3df0c6f docs(runbook): per-username lockout, operator trail, cookie port scope`

Both are pushed to `feat/console-auth`. CI on 3df0c6f is green, 8 of 8 checks.

## I1: operator trail needs admin

In `handleTrailAPI`, when `s.auth != nil`, `operator` also requires `sess != nil && sess.Role == RoleAdmin`. Anyone else silently gets the sealed view, with no 403. Behaviour with auth off is unchanged.

Test `TestTrailOperatorViewNeedsAdminWhenAuthOn` calls from loopback with `operator=1`:
- anonymous: sealed
- `t1`: sealed
- `admin`: unsealed

## I2: lockout keyed by (IP, username) with a per-IP cap

Data structure, in `authState` under `mu`:
- `ipFails map[string]*failRecord`: per remote IP, limit 50.
- `userFails map[failKey{ip, user}]*failRecord`: per (remote IP, submitted username string), limit 5.
- `failRecord{count, start, lockedUntil}` has two helpers:
  - `lapsed(now)`: the 5-minute window is over and no lock is in force.
  - `blocked(now, limit)`: the record is locked, or its reserved count has reached the limit.

`attempt(ip, user)`:
1. Prune stale records.
2. Check the IP record (create it or reset its window if needed). Refuse if blocked.
3. If `len(user) <= 256`, check the (IP, user) record the same way and refuse if blocked.
4. Reserve a slot on both records (`count++`) before bcrypt runs.

Because the IP check comes first, a capped address creates no new user records.

`settle(ip, user, success)`:
- **Failure:** lock (30 s, count reset) any record whose count has reached its limit.
- **Success:** decrement only this attempt's reservation on the IP record and delete the (IP, user) record.
- **Username over 256 bytes:** only the IP record is touched.

The key never depends on whether the user exists. Unknown names are counted, locked, and get the same 429 and `Retry-After`. The dummy compare is kept. `parseUsers` also caps usernames at 256 bytes, so an over-long name always takes the unknown-user path.

New tests:

| Test | Checks |
|---|---|
| `TestLoginLocksOutAfterFiveFailures` (reworked) | 8 concurrent guesses give exactly 5 × 401 and 3 × 429; while locked the correct password gets 429 with `Retry-After: 30`; a different IP is fine; after 31 s login works |
| `TestLoginLockoutIsPerUsername` | Five `t2` typos from loopback do not block the admin; `t2` itself gets 429 |
| `TestLoginLockoutTreatsUnknownUsersLikeKnownOnes` | For `admin` and `mallory`: identical 401 bodies, then identical 429 body and `Retry-After` |
| `TestLoginPerAddressCapTripsAt50` | 49 direct failures across 49 names, then one over-long name over HTTP (same 401, no record of its own); after that, `admin` and a fresh name both get 429; per-user records stay at 49; another IP is not capped |
| `TestLoginSuccessResetsOnlyItsOwnKey` | 4 × `t1` and 4 × `admin` failures, then a `t1` success: `t1`'s record is gone, the IP count stays 8, the next `admin` failure locks `admin`, and `t1` starts fresh. This also covers the insider-laundering case |

Runbook: the limits bullet now reads "Anyone on loopback (every tunnel user arrives as loopback) can lock one named account for 30 s with 5 guesses, or all of loopback with 50." The login paragraph describes both counters.

Interpretation to confirm: the 50 cap works like the 5 limit. Reaching 50 failures inside the 5-minute window locks the IP for 30 s, and the count resets when the lock is set. It does not refuse for the rest of the window. This matches the runbook wording "lock … all of loopback with 50" for 30 s.

## Minor 1: publish by a non-member trustee

In `handleCeremonyPublish`, after `CeremonyStatus`, a trustee session gets 403 JSON if its `TrusteeID` is not among `state.Trustees` IDs (`slices.ContainsFunc`). This runs before the threshold gate.

Test `TestPublishRefusesATrusteeOutsideTheElection`: `t9` on a 3-trustee run gets 403. `t1` and admin get the below-threshold 409.

## Minor 2: users-file hardening

`parseUsers` now also rejects:
- a trustee `trustee_id` that fails `^[1-9][0-9]*$`;
- a duplicate `trustee_id` across users (the error names the first owner);
- a username longer than 256 bytes;
- a bcrypt cost other than 12 (`hashPasswordCost`, the dummy hash's cost).

`TestUsersFileValidation` gained cases for cost 4, a duplicate trustee id, `"01"`, `"0"`, `"1a"` and a long username. The valid file now includes `trustee_id "10"`.

Test fixtures now use cost-12 hashes, computed once per binary (`sync.OnceValue`).

## Minor 3: routeMux

`routeMux{mux *http.ServeMux; patterns []string}` is now a named field, not embedded, and forwards `Handler` and `ServeHTTP`. A `mux.ServeMux.HandleFunc` bypass no longer compiles.

## Minor 4

A comment at `routeAccess` says public subtree handlers must never choose an action from the path suffix, because the mux matches the escaped path while the handler reads the decoded `r.URL.Path`.

## Minor 6

A runbook limits bullet says cookies are not isolated by port, so other services on 127.0.0.1 (for example the Vite dev server) receive `saksi_session`, while cross-port POSTs are still refused by `guard()`'s Origin check.

The runbook's users-file paragraph also lists the new rejection rules.

## Minor 5: skipped, as instructed

An `/events` SSE stream opened with a valid session keeps streaming after logout or session expiry, because the session is checked only when the request starts. Left as-is; it is a candidate follow-up (for example, re-check the session per event, or close streams on logout).

## Verification (fix round)

- **Mutation check:** each of these was applied and each test named failed (6 tests in all), then the code was restored:
  - I1 admin check removed → `TestTrailOperatorViewNeedsAdminWhenAuthOn`.
  - Minor 1 check neutralised → `TestPublishRefusesATrusteeOutsideTheElection`.
  - User key collapsed to `""` → `TestLoginLockoutIsPerUsername`, `TestLoginLockoutTreatsUnknownUsersLikeKnownOnes`, `TestLoginPerAddressCapTripsAt50`.
  - IP counter zeroed on success → `TestLoginSuccessResetsOnlyItsOwnKey`.
- **Windows:** `go vet ./...` and `gofmt -l .` are clean. `go test ./... -count=1` is ok in `saksi-campaign` (with `SAKSI_DEMO_BIN`) and in `client-sdk`. One full run took 42.8 s against 18 s earlier. The slowest tests were pre-existing ones and no auth test exceeded 1 s, so this looks like machine load rather than the new tests.
- **WSL `-race`:** both modules ok with no data races. The campaign module took 54 s against 17 s before. The auth tests account for about 37 s of that, because each cost-12 compare takes about 2.4 s under race. CI also runs `-race` and passed.
- **CI:** 8 of 8 green on `3df0c6f`.

---

# Fix round 2 (re-review: Ready to merge, three items folded in)

Commit `d7264a4 fix(campaign): one lockout key for every loopback address` is pushed. CI is 8/8 green on d7264a4.

1. **Every loopback source address shares one lockout key.** `remoteIP` now maps all of 127.0.0.0/8 and `::1` to the single key `"loopback"`. This closes a bypass where a local process could get a fresh budget for each loopback alias it used as its source address. The per-username records collapse across aliases in the same way.
   - New test `TestLoginLockoutTreatsEveryLoopbackAddressAsOne`:
     - A username locked from 127.0.0.1 also gets 429 from 127.0.0.2 and from `[::1]`.
     - The cap is shared: 5 HTTP failures plus 45 direct ones (keyed through `remoteIP` and spread across the three aliases) make `admin` get 429 from every alias.
   - Mutation check: reverting the loopback mapping makes this test fail.
   - `TestLoginPerAddressCapTripsAt50` now uses the non-loopback address 192.0.2.7, because its direct calls and its HTTP calls must share one key.
2. **`handleTrailAPI` doc comment** now says the unsealed view also requires an admin session when auth is on.
3. **`routeMux` comment** now says the named field prevents an unrecorded registration by accident only. Package code could still call `m.mux.HandleFunc` directly, and such a route would still default to admin-only.

Optional item taken: the three fixture hashes are hard-coded cost-12 constants and are no longer generated. As instructed, there is no lower-cost bcrypt seam. The login tests fail if a hash stops matching its password.

Verification:
- Windows: `go vet` and `gofmt` are clean. `go test ./... -count=1` passes for `saksi-campaign` (16.5 s, with `SAKSI_DEMO_BIN` set) and for `client-sdk`.
- WSL `-race`: `saksi-campaign` passes in 49.9 s with no data races.
