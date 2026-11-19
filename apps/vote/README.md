# apps/vote

Phone voter app for the live election demo. A browser app (Vite + React 18 +
`@balotachain/ui`) that the saksi-campaign console serves at `/vote/` in live
mode; `tools/build-web.sh` assembles it into `dist-web/vote`.

Flow: check in at the precinct (last name, first name, date of birth; the
declaration; the Electoral Board's approval at the presenter page; the
signature on the election-day list, or "I cannot sign"; saksi
`docs/live/voter-list-api.md`), get the voting credential (once per voter),
one ballot screen
per position, review, encrypt, optional Benaloh challenge (opens the ballot,
discards it, re-encrypts), submit (one ledger transaction per position), the
receipt (tracking code `BC-XXXX-XXXX`, transaction id, block), and a
tracking-code check against the public board.

## The client seam

The screens only talk to the `LiveClient` interface in `src/lib/live.ts`.

- `MockLiveClient` (`src/lib/mock.ts`): a practice election in memory,
  realistic delays, a practice list of three fictional voters (`MOCK_VOTERS`;
  the check-in form names them) whose Electoral Board approves by itself. It
  exists
  only in builds that can run it (`src/lib/client.ts`):
  - the dev server (`pnpm --filter vote dev`) honours `?mock=1`;
  - a build made with `VITE_LIVE_MOCK_SWITCH=1` honours `?mock=1`;
  - a build made with `VITE_LIVE_MOCK=1` always runs it.

  The default build (what `tools/build-web.sh` ships) ignores `?mock=1`, and
  the mock is not in its bundle; `build-web` refuses the flags and scans the
  output for the mock. While the mock (or the local test election) runs, every
  screen shows a "Practice election" banner. Browser checks that need the mock
  use a build made with `VITE_LIVE_MOCK_SWITCH=1` (`vite build --outDir`
  somewhere outside `dist-web`).

  Extra query options for demos and screenshots:
  `status=setup|open|closed|tallied`,
  `fail=checkin,election,enrol,encrypt,challenge,submit,lookup` (each fails once
  with a network error), `speed=0..1` (delay multiplier), `tamper=1` (the next
  encryption swaps a candidate, so the Benaloh check must fail).

- `RealLiveClient` (`src/lib/real.ts`), the default: the saksi WebAssembly
  module (`src/lib/voterCrypto.ts`) over `HttpTransport` (`src/lib/http.ts`),
  the console's live HTTP API (saksi `docs/live/http-api.md`, and
  `docs/live/voter-list-api.md` for the check-in and its HttpOnly
  `saksi_checkin` cookie, which the page never reads). It must be
  served by the console at `/vote/` (same origin; there is no CORS). The
  error table in `http.ts` maps every failed request to a `LiveError` kind.

What the phone remembers (the credential, receipts and "sent, no answer"
markers, per election; never a name or a date of birth) goes through
`src/lib/storage.ts`: IndexedDB, with an in-memory fallback when IndexedDB is
missing, fails to open, or does not commit a write. `persistent()` reports
whether everything written survives a reload; the Enrol screen only says
"Credential stored on this phone" when it does. The mock uses its own database
(`balotachain-vote-mock`), so mock runs never touch a real credential.

## Commands

```
pnpm --filter @balotachain/ui build   # the app imports its dist
pnpm --filter vote dev                # http://localhost:1430/vote/?mock=1
pnpm --filter vote test
pnpm --filter vote typecheck
pnpm --filter vote build
```
