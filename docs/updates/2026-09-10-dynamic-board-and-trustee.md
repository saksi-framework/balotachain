# Dynamic bulletin board + trustee console (2026-09-10)

`apps/auditor` and `apps/trustee` now run as **browser apps served by the
saksi-campaign console**, driven by real elections instead of the mockup's demo
data. Plan: [`docs/plans/2026-09-10-dynamic-board-and-trustee.md`](../plans/2026-09-10-dynamic-board-and-trustee.md).

## What changed

PR #53 rebuilt both apps pixel-faithfully from the Claude Design mockups, but
they still read their data through Tauri `invoke` calls (`load_bulletin`,
`verify_tracking_code`, `submit_partial_decryption`) that do not exist in a
browser — so every page rendered `src/mocks/*.ts`.

Both apps now fetch from the **saksi-campaign console** (the Go server in
`../saksi/packages/saksi-campaign`), which owns the run store, the election
lifecycle and the trustee ceremony:

| App | Served at | Reads | Writes |
|---|---|---|---|
| `apps/auditor` | `/board/?run=<id>` | `GET /api/board/<run>`, `GET /runs`, `GET /api/verify-code/<run>/<code>` | — |
| `apps/trustee` | `/trustee/?run=<id>&trustee=<n>` | `GET /api/ceremony/<run>`, `GET /runs`, `GET /events?run=` | `POST /ceremony/submit`, `POST /ceremony/publish` |

The console serves both bundles itself (`--web-dir`), so they are **same-origin
with the API** — which is what keeps its cross-origin POST guard protecting the
ceremony endpoints. No Tauri in the delivery path.

## Build and run

```bash
# balotachain
pnpm install
./tools/build-web.sh              # or tools\build-web.ps1
#   -> dist-web/board  and  dist-web/trustee

# saksi
cargo build -p saksi-demo --release
cd packages/saksi-campaign && go build ./cmd/saksi-campaign
./saksi-campaign serve --demo ../../target/release/saksi-demo \
                       --web-dir <balotachain>/dist-web
```

Then run an election at `http://127.0.0.1:8090/wizard` and open
`/board/?run=<id>` and `/trustee/?run=<id>&trustee=2`.

Dev mode: `pnpm --filter auditor dev` with a Vite proxy to the console
(`VITE_CONSOLE_URL`, default `http://127.0.0.1:8090`). The proxy **strips the
`Origin` header** — without that every ceremony POST would hit the console's
same-origin guard and 403.

## What the data now comes from

- **Results, seats, ranks, ELECTED tags** — `correctness.csv`'s `decoded`
  column, the value threshold decryption actually recovered. The ranking rule
  (seats, cut line, and the *tie is reported, not resolved* case) is ported into
  Go in `board.go`, so the wizard and the board cannot disagree. Before this the
  board hardcoded `seatLabel: "1 seat"` for every real race and never populated
  a rank — the multi-seat Senate card only ever rendered from mocks.
- **Tally fingerprint** — the run's `tally_sha256`, the digest of the wire
  `TallyResult`. The old client-side `resultsFingerprint()` hashed our own JSON
  against the `bulletin-store` schema, which is no longer the backend;
  `apps/auditor/src/lib/tally.ts` is deleted.
- **Trustee roster, quorum, key-share card, audit log** — the ceremony state and
  its new timestamps. The demo constants `YOU_TRUSTEE_ID = "t03"` and
  `DEMO_SECRET_SHARE = 17` are gone: the console holds every share server-side,
  so the client sends only `{run_id, trustee_id}`.

## Honest scope, carried into the UI

- The **threshold is enforced by the console, not the ledger** — the chaincode
  validates each partial decryption but does not count them before accepting
  `PublishTally`. Both apps say so.
- The **published tally is the election's seeded result**, not a recomputation
  from whichever shares were clicked. The ceremony gates *when* it becomes
  readable; the independent auditor is what proves enough trustees contributed.
- **No trustee authentication.** `POST /ceremony/submit` takes a `trustee_id` and
  no credential, so anyone who can open the page can act as any trustee. Stated
  on the key-share card rather than papered over with decorative auth.
- Three mockup elements had no honest source and changed rather than being
  faked: the roster's **"Offline"** chip became **"Not started"** (the console
  has no presence concept), **"Rejected"** became **"Tampered ballots refused"**
  (sourced from ballot-stage negative tests — a synthetic run has no spoiled
  ballots), and **turnout** carries a note that it is 100% by construction.
  `PRECINCTS` and `REGISTERED_VOTERS` were deleted outright.
- The **verifier check list** is the console's summary of the run's artifacts,
  not the auditor's own findings — `audit-stream --json` serializes only
  `{overall, contests}`, so `AuditReport.findings` never reaches the console.
  Surfacing them is a Rust change, deliberately not done here.
- A tracking code `BC-XXXX-XXXX` is the first eight hex characters of a ballot's
  **nullifier**, which is derived per voter **per position** — so a code names
  one ballot *record*, not a whole ballot, and the answer says which position.
  An ambiguous prefix is refused (409) rather than showing someone else's record.

## Depends on a saksi change

This needs saksi PR `feat/board-api` (`feat(campaign): board and verify-code
API, static web dir, ceremony events`): `GET /api/board/<run>`,
`GET /api/verify-code/<run>/<code>`, `--web-dir` static serving, the
`CeremonyView` wrapper (which embeds `CeremonyState`, so `/wizard` is
unaffected), and `started_at`/`closed_at`/`published_at`/`submitted_at` in
`ceremony.json`.

`GET /api/board` is deliberately **offline-first**: `/api/trail/<id>` dials
Fabric unconditionally and 502s without a network, so it cannot back a board for
an offline run.

## Out of scope

`apps/voter` (Flutter), `apps/admin`, `crates/bulletin-gateway`,
`crates/bulletin-store`, `services/fabric-adapter`, and the chaincode are all
untouched. **No Rust file changed in this PR**, and nothing in Rust depends on
the TypeScript, so the Tauri crates are unaffected — but with `base: "/board/"`
and no `invoke` calls they are no longer a working delivery path. Deleting them
(and the three `@tauri-apps/*` dependencies) is a separate decision.

`cargo check` on `apps/auditor/src-tauri` could not be run on the Windows dev
box used here: `windows-sys` and `parking_lot_core` fail with
`error calling dlltool 'dlltool.exe': program not found`. That is a pre-existing
toolchain gap in third-party crates, not something this change introduced, and
it is unverified rather than broken.
