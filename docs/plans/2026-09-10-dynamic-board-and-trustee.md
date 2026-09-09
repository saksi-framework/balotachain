# Dynamic bulletin board + trustee console, driven by the saksi-campaign API

**Date:** 2026-09-10
**Status:** PLAN — awaiting approval. Implementation branch will be `feat/dynamic-board-trustee`.
**Base branch:** `origin/ui/design-sync-2026-09` (PR #53, **still open** — verified
`gh pr view 53` → `"state":"OPEN","mergedAt":null`; `origin/main` is at `e5a4892`, which does not
contain the redesign).

---

## 1. Context

PR #53 rebuilt two apps pixel-faithfully from Claude Design mockups:

- `apps/auditor` — the public bulletin board.
- `apps/trustee` — the trustee console (threshold-decryption ceremony).

Both still get their data from Tauri `invoke` calls (`load_bulletin`, `verify_tracking_code`,
`submit_partial_decryption`, `submit_all_partial_decryptions`, `save_bulletin`) defined in each
app's `src-tauri/src/balota.rs` over `crates/bulletin-store`. Those commands do not exist in a
browser, so today the pages render the mockup's demo data (`src/mocks/results.ts`,
`src/mocks/trustee.ts`).

This plan replaces that data layer with the **saksi-campaign console HTTP API** — the Go server in
`../saksi/packages/saksi-campaign` — so a real election run in the console (offline or on-chain)
appears on the board, and a trustee can run the ceremony from the trustee console.

### Decisions already locked by the user

1. **Backend = saksi-campaign console API.** Not `crates/bulletin-gateway`, not
   `services/fabric-adapter`.
2. **Delivery = browser apps served by the console itself** at `/board` and `/trustee` (built
   bundles, same origin, so `server.go`'s `guard()` same-origin POST check keeps working). Dev mode
   uses a Vite proxy to the console. No Tauri.
3. **Tracking code = nullifier prefix.** `BC-XXXX-XXXX` from the first 8 hex chars of a ballot
   nullifier, looked up via `ListNullifiers` on-chain or the run's `ballots.csv` /
   `ballots.ndjson` nullifiers offline. Reveals nothing about the choice.

### What the console is (read before the mapping)

`saksi-campaign` is the Research Election Console (`docs/research-election-console-runbook.md` in
saksi). It configures an election (`ElectionConfig` in `config.go`), then runs it in phases over a
**run folder** store (`RunStore` in `runstore.go`, default `~/.saksi/campaign/runs/<run-id>`):

| Phase | Endpoint | What it writes into the run folder |
|---|---|---|
| Generate | `POST /generate` | `header.json`, `ballots.ndjson`, `ballots.csv`, `election.csv` |
| Check (ground-truth mode) | `GET /api/check/<run>` | `ground-truth-check.json` |
| Ceremony start | `POST /ceremony/start` | `bundle.json`, `ceremony.json` (+ `trail.json`/`receipts.csv` on-chain) |
| Ceremony submit | `POST /ceremony/submit` | updates `ceremony.json` (+ receipts on-chain) |
| Ceremony publish | `POST /ceremony/publish` | marks `ceremony.json` published (+ `PublishTally` on-chain) |
| Verify | `POST /verify` | `correctness.csv` |
| Scenarios / attacks | `POST /scenarios`, `POST /attack` | `scenarios.json`, `negative-tests.csv` |

**A run id IS an election id.** `Executor.Generate` passes `--election-id <runID>`, and
`handleTrailAPI` treats the path segment as both. Everywhere below, "run" and "election" are the
same identifier.

Two facts constrain the whole design and must not be papered over in the UI:

- **The published tally is the generator's seeded result**, not a recomputation from whichever
  shares were clicked (saksi `docs/wizard/5-trustees.md`, "One more honest scope note"). The
  ceremony gates *publication*; the independent auditor is what proves enough trustees contributed.
- **The t-of-n gate is enforced by the console, not the ledger.** The chaincode validates each
  partial decryption but does not count them before accepting `PublishTally` (`ceremony.go`
  header comment, ADR note in the wizard docs). Threshold integrity is a *verification-time*
  guarantee.

Both apps must carry that wording. Do not let a redesign imply otherwise.

---

## 2. What the console already serves

Read in full: `server.go`, `ceremony.go`, `trail.go`, `executor.go`, `csvexport.go`,
`scenarios.go`, `check.go`, `runstore.go`, `receipts.go`, `sse.go`, `config.go`,
`cmd/saksi-campaign/main.go`, `web/wizard.html`, `web/trail.html`.

### Routes (`NewServer` in `server.go`)

| Route | Handler | Notes |
|---|---|---|
| `GET /` | `handleIndex` | embedded `web/index.html`; 404s any other path (the `/` mux entry is the catch-all) |
| `POST /generate` `/submit` `/verify` `/scenarios` `/run-all` `/cancel` `/attack` | phase dispatch | each returns `202 {"run_id":…}` and runs async under the per-run busy lock (`dispatch`) |
| `GET /events?run=<id>` | `handleEvents` | SSE, `data: {"phase","level","msg"}` per `Event` (`sse.go`) |
| `GET /runs` | `handleRuns` | `[]runView` = `RunRecord{run_id, config, created_at}` + `artifacts []string` |
| `GET /export/<run>/<artifact>` | `handleExport` | allowlisted by `exportOrder` (`election.csv`, `ballots.csv`, `correctness.csv`, `negative-tests.csv`, `ground-truth-*.csv`, `perf.csv`, `header.json`, `ballots.ndjson`, `run.json`, `receipts.csv`, `ground-truth-check.json`, `trail.json`) |
| `GET /api/trail/<election>` | `handleTrailAPI` → `buildTrail` | `trailResponse{sealed,status,election_id,events,live,results}`; **dials Fabric — 502 "chain unreachable" when offline** |
| `GET /api/trail` | `handleTrailIndex` | `{chain bool, rows []trailIndexRow}`; also dials |
| `GET /trail/<id>` | `handleTrailPage` | embedded `web/trail.html` |
| `GET /wizard` | `handleWizard` | embedded `web/wizard.html` |
| `POST /ceremony/start` `/ceremony/submit` `/ceremony/publish` | ceremony | `submit` body `{run_id, trustee_id}`; `publish` returns **409** with the threshold message when `!state.Unlocked` |
| `GET /api/ceremony/<run>` | `handleCeremonyStatus` | `CeremonyState` |
| `GET /api/check/<run>` | `handleCheck` | `CheckReport` (ground-truth tables only) |
| `GET /api/scenarios/<run>` | `handleScenarioList` | `[]ScenarioListing` |
| `GET /api/capabilities` | `handleCapabilities` | `{fabric, peer, channel}` |

### Go structs the plan depends on

- `RunRecord{RunID, Config ElectionConfig, CreatedAt}` (`runstore.go`), `runView{RunRecord, Artifacts []string}` (`server.go`).
- `ElectionConfig{Name, Trustees []Trustee{Name}, Threshold, Positions, Candidates, Voters, Distribution, Mode, SenateSeats, SkipAttacks}` + `Seats(p int)` and `SenatePosition = 2` (`config.go`).
- `CeremonyState{Threshold, Trustees []CeremonyTrustee, Submitted, Unlocked, Published, OnChain, Ready}`, `CeremonyTrustee{ID "1".."n", Name, Submitted, Contests}` (`ceremony.go`).
- `StreamAudit{Overall "pass"|"fail", Contests []ContestCorrectness}`, `ContestCorrectness{Contest, GroundTruth, Decoded, E, Pass, PublishedTally, AggregateCiphertext, RecoveredPoint}` (`executor.go`).
- `TrailEvent{Event, Ref, Receipt clientsdk.Receipt{TxID, BlockNumber, BlockHash, DataHash, PreviousHash, Timestamp}}` (`receipts.go`).
- `trailResponse` / `liveProof{StatusNow, NullifierRows, TallyHex, ChainHeight, TipHash, Partial, PartialReason}` / `trailIndexRow{ElectionID, CreatedAt, Mode, Voters, OnChain, Status, Ballots, Tallied}` (`trail.go`).
- `Check{Name, Pass, Detail}` / `CheckReport` (`check.go`).
- `ScenarioListing{ID, Property, Layer, Action, Expected, Verdict, Actual, Stage, Live, WasLive}` / `ScenarioResult` (`scenarios.go`).
- `Event{Phase, Level, Msg}` / `Hub` (`sse.go`).
- `electionHeader{ElectionID, ElectionName, TrusteeNames, PartialDecryptions, GroundTruth, Positions, Candidates, N, Dkg, Tally, IssuerPk, BindingContext}` — the `header.json` subset (`csvexport.go`). Note `header.json` also carries `params` (hex `ElectionParameters`) and `voter_ids`, read by `cmd/dumpwire`.
- `onChainBundle{ElectionID, Params, DKG, Ballots, PartialDecryptions, Tally}` (`executor.go`).

### CSV columns (exact)

`writeCorrectnessCSV` (`executor.go`) — `correctness.csv`:
```
contest, ground_truth, decoded, E, pass, published_tally, recovered_point,
aggregate_ciphertext, dkg_sha256, tally_sha256, ballots_sha256
```

`writeElectionCSV` (`csvexport.go`) — `election.csv` (one data row):
```
election_id, election_name, trustees, threshold, positions, candidates, voters,
num_ballots, num_partial_decryptions, ground_truth_total, distribution, mode,
trustee_names, issuer_public_key, binding_context, dkg_sha256, tally_sha256, ballots_sha256
```

`writeBallotsCSV` (`csvexport.go`) — `ballots.csv`:
```
index, election_id, position_id, voter_credential_commitment, nullifier,
num_ciphertexts, num_wellformedness_proofs, ballot_sha256, ballot_json
```

`writeNegativeTestsCSV` (`scenarios.go`) — `negative-tests.csv`:
```
scenario, stage, layer, action, expected, actual, verdict, property, on_chain
```

`appendReceipt` (`receipts.go`) — `receipts.csv`:
```
event, ref, tx_id, block_number, block_hash, data_hash, previous_hash, timestamp
```

### Identifier conventions

- Contest id = `"<position>/cand<N>"`, N zero-based. `splitContestID` in `trail.go` splits it.
- Position ids come from the Rust generator's `ph_position_id`
  (`saksi-auditor/src/fixtures.rs`): `president`, `vice-president`, `senator`, then `position-<n>`.
- The wizard renders labels with `POS_LABEL`/`posLabel` and `candLabel` (`web/wizard.html:427-433`):
  `cand0 → "Candidate 1"` (1-based, matching the `CAND_PRES_01` ground-truth convention).
- Trustee ids are `"1".."n"` (`newCeremony`), aligned by position to `ElectionConfig.Trustees[i].Name`.
- The Senate (`SENATE_POSITION_ID = "senator"`, `SenatePosition = 2`) is the only multi-seat race;
  `ElectionConfig.Seats(p)` and `senate_seats` decide how counts are *read*, never how they are produced.

### The existing board logic already exists — in JavaScript

`web/wizard.html`'s `renderBoard(rows)` (lines ~849-900) already computes, from `correctness.csv`:
group by position, rank by `decoded` votes, seats (`senate_seats` capped at `cands.length - 1`),
the cut line after `seats` places, and a **contested/tie** state where the cut is not decided
("Ties are reported, not resolved" — saksi `docs/wizard/6-verify.md`). The new `/api/board`
endpoint is a **port of that function to Go**, so there is one implementation with one Go test
instead of a second copy in TypeScript. Do not re-derive the rule; port it.

---

## 3. Data-model mapping — bulletin board (`apps/auditor`)

Legend: **HAVE** = served today, **NEW** = needs the new `/api/board` endpoint (which reads the
artifact named), **DROP** = has no honest source and the element must change.

| Board element | Source today | Verdict |
|---|---|---|
| Election title | `RunRecord.Config.Name` via `GET /runs`; also `election.csv:election_name` / `header.json:election_name` | HAVE → surfaced by NEW |
| Election id | run id = election id | HAVE |
| Opened date | `RunRecord.CreatedAt` (`/runs`, `run.json`) | HAVE → NEW |
| Closed date | `trail.json` `TrailEvent{Event:"CloseElection"}.Receipt.Timestamp` (on-chain only) | NEW; **offline has no timestamp** — render nothing, never a fake |
| Tally published date | none today | **NEW field** `published_at` added to `ceremony.json` (see §4.4) |
| "Verified" banner | `correctness.csv` all rows `pass=true` (≡ `StreamAudit.Overall=="pass"`) | NEW |
| Pending-tally / sealed state | `ceremony.json` `Published` (`CeremonyState.Published`) | NEW (mirrors `buildTrail`'s seal, but without dialing the chain) |
| Per-race results: contest, candidate, votes | `correctness.csv` `contest` + `decoded` columns; fallback `decodeTally(header.tally, header.params)` (`trail.go`) | NEW |
| Race label ("President") | `posLabel` map, ported from `wizard.html:427` | NEW |
| Candidate label ("Candidate 3") | `candLabel`, ported from `wizard.html:433` | NEW |
| Seats per race | `ElectionConfig.Seats(p)` / `SenateSeats`, capped at `candidates-1` | NEW |
| Ranks | sort by `decoded` desc, then label — ported from `renderBoard` | NEW |
| "Elected" / "winner" tags + cut line | `renderBoard`'s cutoff + `contested` rule | NEW |
| Tie / "cut not decided" | same rule; **must be preserved** — `uniform` distributions genuinely tie | NEW |
| Vote share % | `votes / race total` | NEW |
| Integrity: total ballots | `header.json:n` (= voters × positions); also `election.csv:num_ballots` | NEW |
| Integrity: voters | `ElectionConfig.Voters` | NEW |
| Integrity: verified | `= n` when the audit passed, `0` otherwise, with the audit verdict alongside | NEW |
| Integrity: rejected | `scenarios.json` / `negative-tests.csv` — count of `Stage=="ballots"` rows with `Verdict=="PASS"` (tampered ballots the system refused) | NEW, **relabel**: "tampered ballots rejected (negative tests)". There is no spoiled-ballot concept in a synthetic run; `0` + a note when scenarios were never run |
| Integrity: turnout | 100% by construction — every generated voter casts a full ballot | NEW, with `turnout_note`; **do not invent a registered-voter denominator** |
| Crypto: tally proof verified | `correctness.csv` `pass` per contest + `E == 0` | NEW |
| Crypto: trustees participated N of M | `CeremonyState.Submitted` / `len(Trustees)` / `Threshold` | HAVE (`/api/ceremony/<run>`) → also folded into NEW |
| Crypto: tally fingerprint | `correctness.csv:tally_sha256` / `election.csv:tally_sha256` = `hexDigest(header.tally)` (SHA-256 of the wire `TallyResult`) | NEW. **Replaces** the client-side `resultsFingerprint()` in `apps/auditor/src/lib/tally.ts` — a real artifact digest beats a hash of our own JSON |
| Crypto: DKG + ballot-set fingerprints | `dkg_sha256`, `ballots_sha256` (same CSVs; `ballotsDigest` in `csvexport.go`) | NEW (bonus, cheap) |
| Crypto: issuer public key, binding context | `election.csv` / `header.json` `issuer_pk`, `binding_context` | NEW |
| Crypto: chain height + tip hash | `liveProof.ChainHeight` / `TipHash` (`led.ChainInfo()`) | NEW, on-chain only, best-effort (`partial` flag pattern from `buildTrail`) |
| Crypto: on-chain flag + lifecycle status | `reader.GetElection` ok + `GetElectionStatus`; `CountCommittedBallots` for the committed nullifier count | NEW, best-effort |
| Verifier check list (PASS/FAIL) | **not exposed today.** `audit-stream --json` emits only `StreamAudit{overall, contests}`; the auditor's real `AuditReport{overall, findings[]{check, severity, status, detail}}` (`saksi-auditor/src/report.rs`) is printed by `saksi-demo audit` but never serialized by `audit-stream` | NEW, **composed in Go** from artifacts that already exist (§4.1). `ponytail:` console-side summary, not the auditor's own findings; upgrade path is adding `findings` to `StreamAudit` in Rust + `--json` |
| Verify-your-vote (tracking code) | `ballots.csv:nullifier` (offline) / `ListNullifiers` (on-chain, `client-sdk/bulletin.go`) | NEW endpoint (§4.2) |
| Download verification data | `GET /export/<run>/<artifact>`, list from `runView.Artifacts` | HAVE — link straight to it |
| Open verifier | `GET /trail/<run>` (the console's own public trail page) when a chain is reachable; otherwise link the export set | HAVE |

### Board elements that must change

- **`apps/auditor/src/lib/tally.ts` `resultsFingerprint`/`canonicalResultsJson` become dead.** They
  exist to match `crates/bulletin-store::results_fingerprint` byte-for-byte; the console backend has
  no such fingerprint. **Neither is imported by `App.tsx` today** — `tally.ts` is used only for its
  `CandidateResult`/`RaceResult` types plus its own test. Keep the types, delete the two functions
  and `tally.test.ts`'s fingerprint cases. (Deletion over addition.)
- **Voters / credentials lists** (`Bulletin.voters`, `Bulletin.credentials`) have no console
  equivalent and must not be faked. `header.json` carries synthetic `voter_ids` only — off-wire
  generation metadata, deliberately not published. Any component reading them is removed.
- **Per-ballot ciphertext display** (`Ballot.ciphertext.{pad,data}`): available per ballot in
  `ballots.csv:ballot_json`, but that file is one row per ballot and can be 3.5M rows. Do not load
  it into the board. The tracking-code lookup streams it instead (§4.2).
- **Seats, ranks and ELECTED are currently faked on real data.** `tallyToRaces()` in `App.tsx`
  hardcodes `seatLabel: "1 seat"` and `pickLimit: 1` for every real race and never populates
  `rank`, so the multi-seat Senate path only ever renders from `RACES` in `src/mocks/results.ts`.
  `/api/board`'s `seats` / `rank` / `elected` / `contested` fields are what make the designed
  multi-seat card real — this is the main reason the ranking belongs server-side.

### Mock constants with no console source (must be removed, not re-pointed)

`apps/auditor/src/mocks/results.ts` exports six values `App.tsx` reads with **no real-data path at
all**. Their fate:

| Mock const | Fate |
|---|---|
| `BALLOTS_VERIFIED` (12611219) | → `integrity.verified` |
| `BALLOTS_REJECTED` (2321) | → `integrity.rejected`, **relabelled** (see the mapping table) |
| `TURNOUT` (71.4) | → `integrity.turnout_pct` + `turnout_note` |
| `TALLY_PUBLISHED_AT` | → `published_at` (§4.4) |
| `PRECINCTS` (38204) | **delete.** A synthetic run has no precincts. The "across N precincts" caption goes |
| `REGISTERED_VOTERS` (17665000) | **delete.** Replace the turnout caption with `of ${integrity.voters} generated voters` |

Also note `App.tsx` currently computes `verifiedPct = BALLOTS_VERIFIED / ballotsCast * 100` —
a mock numerator over a real denominator. That must not survive.

---

## 4. Data-model mapping — trustee console (`apps/trustee`)

| Trustee element | Source today | Verdict |
|---|---|---|
| Identity "you" | `?trustee=<id>` matched against `CeremonyState.Trustees[].ID` (`"1".."n"`); name from `CeremonyTrustee.Name` (which `newCeremony` takes from `ElectionConfig.Trustees[i].Name`) | HAVE + §5 |
| Quorum meter (k of t, n hold shares) | `CeremonyState.Submitted` / `Threshold` / `len(Trustees)` / `Unlocked` | HAVE `/api/ceremony/<run>` |
| Roster chips: Submitted | `CeremonyTrustee.Submitted` (on-chain, refreshed from the ledger by `refreshFromChain` via `GetPartialDecryption(eid, contest0, id)`) | HAVE |
| Roster chips: Pending | `!Submitted` | HAVE |
| Roster chips: **Offline** | **no source.** The console has no trustee liveness/presence concept — a trustee is a name in a config, not a connected client | **DROP the "Offline" chip**, or relabel the third state as "Ceremony not started" driven by `CeremonyState.Ready==false`. Do not fabricate presence |
| Submit partial decryption → confirm → done | `POST /ceremony/submit {run_id, trustee_id}` → `202`, then poll `/api/ceremony/<run>` until `Submitted` flips (the wizard does exactly this with a 700 ms re-poll + 4 s timer) | HAVE |
| Publish tally (if the console keeps the button) | `POST /ceremony/publish` — **409** below threshold, with the "needs N of M; K have contributed" message | HAVE |
| Aggregate fingerprint ("what is being decrypted") | `ballots_sha256` = `ballotsDigest(dir)`, available **before** publish. (`correctness.csv:aggregate_ciphertext` is per-contest but only exists *after* Verify, which runs after publish — too late for this panel) | NEW field on the extended ceremony response |
| Ballots aggregated | `header.json:n` | NEW field |
| Positions / contests | `ElectionConfig.Positions`; contest count from `ElectionParameters.contest_ids` in `header.json:params` or `bundle.json:params` | NEW field |
| Key-share card | `CeremonyTrustee.Contests` (partials this trustee owns, one per contest, grouped by decoding each `PartialDecryption.trustee_id` — `partialsByTrustee`), plus `dkg_sha256` and "holds 1 of n shares" | HAVE + NEW (`dkg_sha256`) |
| Key-share **material** | never exposed and never will be — shares live only inside `bundle.json` server-side | keep the card descriptive; say so on the page |
| Audit log timeline | on-chain: `trail.json` `[]TrailEvent` (event, ref, tx id, block number, timestamp). Offline: **nothing is timestamped today** | NEW: add timestamps to `ceremony.json` (§4.4) and serve a merged `events` list on the ceremony response |
| Live progress lines | `GET /events?run=<id>` SSE (`Event{phase,level,msg}`, phase `"ceremony"`) | HAVE |
| Status pill (local vs on-chain ceremony) | `CeremonyState.OnChain` — the wizard renders "on-chain ceremony" / "local ceremony" | HAVE |
| Threshold-gate wording | fixed copy; must mirror `refreshCeremony`'s `gateNote` (console-enforced gate, auditor-proven property) | copy task |
| Ceremony not started | `CeremonyState.Ready == false` → prompt "start the ceremony from the wizard" (or a Start button hitting `POST /ceremony/start`) | HAVE |

### Trustee elements that must change

- **`YOU_TRUSTEE_ID = "t03"` and `DEMO_SECRET_SHARE = 17` are module constants in `App.tsx`.**
  Both go. Identity becomes `?trustee=<id>` (§6), and **the secret share disappears entirely** —
  the console holds every trustee's shares server-side in the run's `bundle.json` and
  `CeremonySubmit` decodes them by `PartialDecryption.trustee_id` (`partialsByTrustee`). The client
  sends only `{run_id, trustee_id}`. That deletes a parameter, a fake scalar, and the whole
  `submit_partial_decryption` / `submit_all_partial_decryptions` distinction.
- **`deriveRoster()` cannot produce `"Offline"`** — it only ever emits `Submitted`/`Pending`. The
  chip's third state has no source in either backend. Drop it or repurpose it (§11 q3).
- **`THRESHOLD_REQUIRED = 3` is a mock const**, never `election.threshold`. It becomes
  `CeremonyState.Threshold`.
- **`YOU_ORDINAL = 2` (Roberto Lim) is inconsistent with `YOU_TRUSTEE_ID = "t03"`** in the current
  code. Both are replaced by the roster entry the `?trustee=` id resolves to.
- **`KeyShareCard()` takes no props and is 100% mock** (`KEY_SHARE_FINGERPRINT`,
  `KEY_SHARE_CEREMONY`, `YOU_NAME`, `YOU_ROLE`, `YOU_ORDINAL`, `TRUSTEE_TOTAL`). It needs props.
  `KEY_SHARE_FINGERPRINT` has no console equivalent — replace it with `dkg_sha256` (the DKG
  transcript digest, which is what the share was derived under) and relabel the row accordingly.
  `KEY_SHARE_CEREMONY` becomes `started_at` (§4.4).
- **Five components read mocks inline with no prop threading** — `TopBar`, `ThresholdCard`,
  `ActionCard`, `VerificationCard`, `KeyShareCard`. Each needs props added. This is most of the
  trustee-side diff.
- **`AGGREGATE_FINGERPRINT` and `POSITION_NAMES` in `VerificationCard`** become `ballots_sha256`
  and the run's real position ids, rendered through the same `posLabel` map the board uses.
- **`initialsOf(name)` lives in `src/mocks/trustee.ts`.** If the mocks file goes, move that one
  helper into `App.tsx` — do not keep a mocks module alive for it.

### 4.1 Live updates: SSE or polling?

**Both, as the console already does.**

- **Polling `/api/ceremony/<run>` every 4 s** is the state of record for the roster and quorum
  (`web/wizard.html` `startCeremony` sets `setInterval(refreshCeremony, 4000)`). It is the only
  thing that reflects the ledger (`refreshFromChain` reconnects per call) and it survives a page
  reload. Use it for the trustee roster and for the board's sealed→published flip.
- **SSE `/events?run=<id>`** is a fan-out of in-flight phase progress (`Hub.Publish`, non-blocking,
  **drops events for a slow subscriber**, and has no replay). Use it only to make the UI feel live —
  streaming log lines, showing a spinner — never as the source of truth for state.

`ponytail:` 4 s polling, same as the wizard; only move to an SSE-driven refresh if the poll is
measurably a problem.

### 4.2 Where the verifier check list comes from

Composed server-side in `/api/board`, reusing the existing `Check{Name,Pass,Detail}` type from
`check.go`, from artifacts that already exist:

| Check | Source |
|---|---|
| "Every contest decodes to the seeded ground truth (E = 0)" | `correctness.csv` `E` + `pass` |
| "The tally was published by the trustee ceremony" | `ceremony.json` `published` |
| "At least *t* of *n* trustees contributed" | `ceremony.json` `submitted >= threshold` |
| "Every tampered ballot was rejected" | `scenarios.json` — `Stage=="ballots"` rows, all `Verdict=="PASS"` |
| "The ballot set is fingerprinted" | `ballots_sha256` non-empty |
| "The election is committed to the ledger" (on-chain only) | `reader.GetElection(id)` succeeds; detail carries height + tip |
| "The published nullifier count matches the ballot count" (on-chain only) | `CountCommittedBallots` vs `header.json:n` |

Each check carries the honest detail string, and the panel is labelled as a **console-side summary
of the run's artifacts**, not the independent auditor's own findings list.

### 4.3 Tracking code semantics — read before implementing

A nullifier is **per voter per position** (`saksi-credentials/src/nullifier.rs`
`derive_nullifier(secret, election, position)`; `Ballot.position_id` on the wire). So a voter with
3 positions produces **3 nullifiers and 3 tracking codes** — one per ballot record, not one per
voter. The lookup response therefore names the position it belongs to, and the UI copy says
"your ballot record for President", not "your ballot".

Collision: 8 hex chars = 32 bits. At 10 000 ballots the birthday probability of any collision is
~1.2 × 10⁻⁵ — small, not zero. The endpoint returns **409 `ambiguous`** if more than one nullifier
shares the prefix rather than silently picking the first.

### 4.4 Small `ceremony.json` additions (saksi)

`CeremonyState`/`CeremonyTrustee` gain timestamps so the offline timeline and the board's
"tally published" date are real rather than inferred from file mtimes:

```go
type CeremonyTrustee struct {
    ...
    SubmittedAt *time.Time `json:"submitted_at,omitempty"`
}
type CeremonyState struct {
    ...
    StartedAt   *time.Time `json:"started_at,omitempty"`
    PublishedAt *time.Time `json:"published_at,omitempty"`
}
```

Set in `markSubmitted` / `markPublished` / `writeCeremony`. `readCeremony` already copies only
progress fields from the stored file onto a fresh config-derived roster — extend that copy to carry
the timestamps. ~10 lines.

---

## 5. New console endpoints (a separate saksi PR)

All in `packages/saksi-campaign`. Registered in `NewServer`'s mux. **All new read endpoints are
`GET`**, so `guard()`'s same-origin POST check is untouched, and `--allow-host` keeps working.

### 5.1 `GET /api/board/<run-or-election>` — new file `board.go`

Offline-first: reads the run folder and only *enriches* from the chain when
`s.fabric.Enabled()`. **It must never 502 when there is no network** — unlike
`handleTrailAPI`/`buildTrail`, which dial unconditionally and return
`502 "chain unreachable"`. That is precisely why the board cannot just reuse `/api/trail`.

```go
type boardResponse struct {
    ElectionID  string      `json:"election_id"`
    Name        string      `json:"name"`
    Mode        string      `json:"mode"`          // offline | onchain | groundtruth
    Distribution string     `json:"distribution"`
    OnChain     bool        `json:"on_chain"`      // committed to a reachable ledger
    Status      string      `json:"status,omitempty"` // chain lifecycle status, display only
    OpenedAt    time.Time   `json:"opened_at"`     // RunRecord.CreatedAt
    ClosedAt    *time.Time  `json:"closed_at,omitempty"`
    PublishedAt *time.Time  `json:"published_at,omitempty"`
    Sealed      bool        `json:"sealed"`        // !ceremony.published
    Verified    bool        `json:"verified"`      // correctness.csv all pass
    Contests    []BoardContest  `json:"contests,omitempty"`
    Integrity   BoardIntegrity  `json:"integrity"`
    Crypto      BoardCrypto     `json:"crypto"`
    Checks      []Check         `json:"checks"`
    Artifacts   []string        `json:"artifacts"` // same set /runs reports
    Partial     bool            `json:"partial,omitempty"`
    PartialReason string        `json:"partial_reason,omitempty"`
}

type BoardContest struct {
    ID         string           `json:"id"`     // "president"
    Label      string           `json:"label"`  // "President"
    Seats      int              `json:"seats"`
    TotalVotes uint64           `json:"total_votes"`
    Contested  bool             `json:"contested"` // cut not decided
    Candidates []BoardCandidate `json:"candidates"` // ranked
}
type BoardCandidate struct {
    ID      string  `json:"id"`    // "cand0"
    Label   string  `json:"label"` // "Candidate 1"
    Votes   uint64  `json:"votes"`
    Rank    int     `json:"rank"`
    Elected bool    `json:"elected"`
    Share   float64 `json:"share"` // percent
}
type BoardIntegrity struct {
    Voters, Positions, Candidates int    `json:"..."`
    BallotRecords  int    `json:"ballot_records"`
    Verified       int    `json:"verified"`
    Rejected       int    `json:"rejected"`
    RejectedNote   string `json:"rejected_note,omitempty"`
    TurnoutPct     float64 `json:"turnout_pct"`
    TurnoutNote    string  `json:"turnout_note"`
}
type BoardCrypto struct {
    TallyProofVerified bool   `json:"tally_proof_verified"`
    TrusteesSubmitted  int    `json:"trustees_submitted"`
    TrusteesTotal      int    `json:"trustees_total"`
    Threshold          int    `json:"threshold"`
    TallySHA256, DKGSHA256, BallotsSHA256 string `json:"..."`
    IssuerPublicKey, BindingContext       string `json:"..."`
    ChainHeight uint64 `json:"chain_height,omitempty"`
    TipHash     string `json:"tip_hash,omitempty"`
    CommittedNullifiers int `json:"committed_nullifiers,omitempty"`
}
```

Implementation notes:
- Reuse `s.record(runID)` (validates the id through `RunStore.Dir`'s traversal gate), `readJSON`,
  `runDigests`, `ballotsDigest`, `readTrailEvents`, `e.CeremonyStatus`, `readScenarioResults`,
  `ScenarioListings`.
- Results source order: `correctness.csv` `decoded` column (the value threshold decryption actually
  recovered) → fallback `decodeTally(header.tally, header.params)` when Verify has not run.
  `Contests` is omitted entirely while `Sealed`.
- Seats/rank/cut/contested: **port `renderBoard` from `web/wizard.html` to Go** as
  `rankContest(votes map[string]uint64, seats int) BoardContest`, unit-tested for the
  single-winner, multi-seat, exact-tie, and tie-at-the-cut cases.
- Chain enrichment is best-effort with the `partial`/`partial_reason` pattern `buildTrail` already
  uses.

### 5.2 `GET /api/verify-code/<run>/<code>` — in `board.go`

```go
type verifyCodeResponse struct {
    Found        bool   `json:"found"`
    TrackingCode string `json:"tracking_code"`
    BallotIndex  int    `json:"ballot_index"`
    PositionID   string `json:"position_id"`
    PositionLabel string `json:"position_label"`
    Nullifier    string `json:"nullifier"`
    BallotSHA256 string `json:"ballot_sha256"`
    RecordedAt   *time.Time `json:"recorded_at,omitempty"` // trail.json SubmitBallot receipt
    CommittedOnChain bool `json:"committed_on_chain"`
}
```
- Normalize the code: strip `BC-`/`-`, lowercase, require 8 hex chars (mirror the app's
  `TRACKING_CODE_RE = /^BC-[A-F0-9]{4}-[A-F0-9]{4}$/i`); `400` otherwise.
- Offline: stream `ballots.csv` with `encoding/csv` and match the `nullifier` column prefix. Return
  `index`, `position_id`, `ballot_sha256` from the same row. Streaming, not `ReadAll` — the file is
  one row per ballot and can be very large.
- On-chain (`fabric.Enabled()` and the election is committed): also page
  `BulletinClient.ListNullifiers(electionID, pageSize, bookmark)` to set `committed_on_chain`.
- `recorded_at` from `trail.json`'s `SubmitBallot` event whose `Ref == strconv.Itoa(index)`.
  Offline there is no ledger timestamp — leave it null and let the UI say so.
- More than one prefix match → `409 {"error":"ambiguous tracking code"}`. No match → `200
  {"found":false}` (a miss is a normal answer, not an error).

### 5.3 Static serving of `/board/*` and `/trustee/*`

New flag on `cmd/saksi-campaign/main.go`: `--web-dir` (env `SAKSI_WEB_DIR`), a directory containing
`board/` and `trustee/` subdirectories of built assets. In `NewServer`:

```go
if webDir != "" {
    mux.Handle("/board/",   http.StripPrefix("/board/",   http.FileServer(http.Dir(filepath.Join(webDir, "board")))))
    mux.Handle("/trustee/", http.StripPrefix("/trustee/", http.FileServer(http.Dir(filepath.Join(webDir, "trustee")))))
}
```
Plus a `/board` → `/board/` and `/trustee` → `/trustee/` redirect so the bare path works.
`http.FileServer` already serves `index.html` for the directory and already rejects traversal.
Both apps select the election with a **query parameter**, not a route, so **no SPA fallback handler
is needed** — skip it. Unset `--web-dir` simply means the routes are not registered (the console
behaves exactly as today).

### 5.4 Extend `GET /api/ceremony/<run>` (not a new route)

`handleCeremonyStatus` returns `CeremonyState` as-is today. Wrap it with the context the trustee
console needs so the page makes **one** request per poll:

```go
type ceremonyView struct {
    CeremonyState
    ElectionID string `json:"election_id"`
    Name       string `json:"name"`
    Mode       string `json:"mode"`
    Positions  int    `json:"positions"`
    Contests   int    `json:"contests"`
    BallotRecords int `json:"ballot_records"`
    BallotsSHA256 string `json:"ballots_sha256"`
    DKGSHA256     string `json:"dkg_sha256"`
    Events     []ceremonyEvent `json:"events"`
}
type ceremonyEvent struct {
    At    *time.Time `json:"at,omitempty"`
    Kind  string     `json:"kind"`   // ceremony_started | trustee_submitted | tally_published | chain
    Who   string     `json:"who,omitempty"`
    Text  string     `json:"text"`
    TxID  string     `json:"tx_id,omitempty"`
    Block uint64     `json:"block,omitempty"`
}
```

`Events` = `ceremony.json` timestamps (§4.4) merged with `trail.json`'s `[]TrailEvent` when
on-chain, sorted by time. Embedding `CeremonyState` keeps every existing field at the same JSON
path, so `web/wizard.html`'s `refreshCeremony` keeps working unchanged.

`ponytail:` one endpoint, one poll. Split it only if the ceremony log grows big enough to matter.

### 5.5 Go tests (one per change)

`board_test.go` — build a temp run folder with `httptest` (`testServer(t, …)` already exists in
`server_test.go`):
- `TestBoardOfflineRunNeedsNoChain` — no fabric configured → 200, `on_chain:false`, no 502.
- `TestBoardSealedUntilPublished` — `ceremony.json` unpublished → `sealed:true`, `contests` empty.
- `TestBoardRanksSeatsAndCut` — 3-seat senate → top 3 `elected`, cut after rank 3.
- `TestBoardReportsTieRatherThanInventingAWinner` — 5/5/5/5 → `contested:true`, nothing elected.
- `TestBoardChecksReflectArtifacts` — negative-tests + ceremony + correctness → expected `Check` set.
- `TestVerifyCodeFindsNullifierPrefix` / `…RejectsMalformed` / `…AmbiguousPrefix` / `…NotFound`.
- `TestWebDirServesBoardAndTrustee` (and that an unset `--web-dir` leaves the routes 404).
- `TestCeremonyViewEmbedsStateAndEvents` — existing `CeremonyState` fields still at the same paths.

---

## 6. Election/run selection and trustee identity

### Board (`apps/auditor`)

- `?run=<id>` (accept `?election=<id>` as an alias — `handleTrailAPI` already calls it an election id).
- No parameter → fetch `GET /runs`, drop `mode == "groundtruth"` rows (they have no ballots and no
  ceremony), take the first (`RunStore.List` already sorts newest-first), and rewrite the URL with
  `history.replaceState` so the view is linkable.
- A `<select>` picker in the header populated from the same `/runs` payload, labelled
  `config.name — created_at — mode`, with the tallied ones marked via `artifacts`
  containing `correctness.csv`.
- **Use `/runs`, not `/api/trail`, for the picker.** `handleTrailIndex` dials Fabric on every
  request (`s.trailIndex()` → `s.dial()`); `/runs` is pure filesystem and works offline. Offer
  `/api/trail` only behind an explicit "chain view" affordance.
- No runs at all → an empty state pointing at `/wizard`.

### Trustee console (`apps/trustee`)

- `?run=<id>` resolved exactly as above.
- `?trustee=<id>` where `<id>` is a `CeremonyTrustee.ID` (`"1".."n"`). Name resolved from the roster
  in the ceremony response.
- No `?trustee` → a "Who are you?" picker listing the roster; the choice writes `?trustee=` into the
  URL and `localStorage` (`balota.trustee.<runID>`) so a reload keeps it. Wrap the storage access in
  `try/catch` — a private window throws.
- An id not in the roster → an explicit error naming the valid ids, not a silent fallback to
  trustee 1.
- **Honest banner, required:** the console has no trustee authentication. `POST /ceremony/submit`
  takes a `trustee_id` and no credential, so anyone who can reach the page can submit any trustee's
  share. This is a research console on a loopback bind. Say it on the page. Do **not** add
  decorative auth.

---

## 7. Frontend changes

### 7.1 The seam is already in the right place

`apps/auditor/src/lib/bulletin.ts` and `apps/trustee/src/lib/bulletin.ts` are the *only* files that
import `@tauri-apps/api/core`. PR #53 did **not** touch them (`git diff --stat origin/main
origin/ui/design-sync-2026-09 -- apps/auditor apps/trustee` lists `App.tsx`, `components/*`,
`mocks/*` — no `lib/`). So the change is: **rewrite those two files as fetch clients** and adjust
`App.tsx` where a field has no console equivalent.

The presentational components stay untouched: `apps/auditor/src/components/{Chip,ResultBar,StatCard}.tsx`,
`apps/trustee/src/components/{Chip,ProgressBar}.tsx`, and everything imported from
`@balotachain/ui` (`tokens`, `Card`, `CopyButton`, `PrimaryButton`, `SecondaryButton`, `TextInput`,
`TextButton`, `TopBar`, and the icons). The PR already moved `Card` into the shared package, so
there is no per-app `Card.tsx` any more. All the churn is in the two `App.tsx` files — which is
where the mocks are read inline today.

### 7.2 Rewrite `lib/bulletin.ts` in place — keep the filename

**Keep the module path `./lib/bulletin`.** Both `App.test.tsx` files mock at that boundary
(`vi.mock("./lib/bulletin", …)`), so keeping the filename means those four tests survive the swap
untouched; only the two `lib/bulletin.test.ts` files (which mock `@tauri-apps/api/core` directly)
have to be rewritten. Creating a `console.ts` alongside would be one extra file and a churned
import in every test. Fewest files wins.

New content, per app:

```ts
const BASE = import.meta.env.VITE_CONSOLE_URL ?? "";   // "" in production = same origin

async function get<T>(path: string, signal?: AbortSignal): Promise<T> { … }

// auditor
export async function listRuns(): Promise<RunView[]>
export async function loadBoard(runId: string): Promise<Board>
export async function verifyTrackingCode(runId: string, code: string): Promise<VerifyCodeResult>

// trustee
export async function listRuns(): Promise<RunView[]>
export async function loadCeremony(runId: string): Promise<CeremonyView>
export async function submitPartialDecryption(runId: string, trusteeId: string): Promise<void>
export function subscribeEvents(runId: string, onEvent: (e: ConsoleEvent) => void): () => void
```

Deleted from the exports: `Bulletin`, `Election`, `Voter`, `Credential`, `Ballot`, `Ciphertext`,
`PartialDecryption`, `Tally`, `TrusteeEntry`, `Position`, `loadBulletin`, `saveBulletin`,
`submitAllPartialDecryptions`, `BallotVerification`. These mirror `crates/bulletin-store`'s schema,
which is no longer the backend. Note the two apps currently duplicate that whole type set verbatim
(only `CandidateResult.elected` optionality differs) — the rewrite ends the duplication by having
each app carry only the console types it actually renders. **Still one file per app, not a shared
workspace package** — two small, different files beat a package with two consumers.

`subscribeEvents` is `new EventSource(`${BASE}/events?run=${id}`)` — no library.

`submitPartialDecryption` POSTs `{run_id, trustee_id}` to `/ceremony/submit`; a `202` means
*accepted*, not *done*, so the caller re-polls `/api/ceremony/<run>` (700 ms, then the 4 s timer) —
the same handshake `web/wizard.html` uses. A `409` is surfaced verbatim (the console's threshold
message is already user-facing prose).

**Retire the Tauri fallback path.** `App.tsx` currently does `loadBulletin().catch(() => {})` and
falls back to mock mode when Tauri is absent — which is exactly why the pages look populated in a
browser today. That silent catch goes: a failed fetch becomes a visible error state.

### 7.3 State

Each app: `idle | loading | ready | empty | error`, plus the board's `sealed` (pending-tally) and
the trustee's `not-ready` (`CeremonyState.Ready === false`). No state library — `useState` +
`useEffect` with an `AbortController`, and a 4 s `setInterval` poll cleared on unmount.

### 7.4 Vite config

Current state: **neither app sets `base` or `build`** (so `outDir` defaults to `dist`, which
`tauri.conf.json`'s `frontendDist: "../dist"` relies on). Both set `clearScreen: false` and a Tauri
dev server block (`port: 1420`, `strictPort: true`, `host: process.env.TAURI_DEV_HOST || false`,
HMR on 1421, `watch.ignored: ["**/src-tauri/**"]`). The auditor keeps its **vitest config inside
`vite.config.ts`** (with `/// <reference types="vitest" />`); the trustee has a **separate
`vitest.config.ts`**. Leave that asymmetry alone — normalising it is churn.

Add to both:
```ts
base: "/board/",            // "/trustee/" in the trustee app
build: { outDir: "dist", emptyOutDir: true },
server: {
  proxy: Object.fromEntries(
    ["/api", "/ceremony", "/events", "/export", "/runs"].map((p) => [p, {
      target: process.env.VITE_CONSOLE_URL ?? "http://127.0.0.1:8090",
      changeOrigin: true,
      configure: (proxy) => proxy.on("proxyReq", (r) => r.removeHeader("origin")),
    }]),
  ),
},
```
**The `removeHeader("origin")` is load-bearing.** `guard()` in `server.go` rejects any POST whose
`Origin` host differs from `Host`. With `changeOrigin: true` Vite rewrites `Host` to the console but
forwards the browser's `Origin: http://localhost:5173`, so every `/ceremony/submit` would 403.
Stripping `Origin` puts the request in the "no browser Origin" branch the guard already allows
(same as `curl`). Production is same-origin, so nothing is weakened there.

SSE through the Vite proxy needs no extra config (`ws: false` is the default and `/events` is plain
HTTP), but the proxy must not buffer — set `selfHandleResponse: false` (default) and leave
compression off.

### 7.5 Build output the console serves

`tools/build-web.ps1` + `tools/build-web.sh` (matching the existing `tools/bootstrap.{sh,ps1}`
convention):
```
pnpm --filter @balotachain/ui build
pnpm --filter auditor build   # -> apps/auditor/dist
pnpm --filter trustee build   # -> apps/trustee/dist
mkdir -p dist-web/board dist-web/trustee
cp -r apps/auditor/dist/*  dist-web/board/
cp -r apps/trustee/dist/*  dist-web/trustee/
```
Run the console with `saksi-campaign serve --web-dir <balotachain>/dist-web`. `dist-web/` is
git-ignored. `ponytail:` a copy script, not a bundler plugin or a Go embed — the two repos ship
separately and the console already reads assets from disk in the `--web-dir` mode.

### 7.6 Tests

Existing suite (all `vitest run`, `happy-dom`, `globals: true`, `src/test/setup.ts` =
`@testing-library/jest-dom/vitest`):

| File | Fate |
|---|---|
| `apps/auditor/src/lib/bulletin.test.ts` | **rewrite** — mocks `@tauri-apps/api/core` today |
| `apps/trustee/src/lib/bulletin.test.ts` | **rewrite** — same, plus asserts `{trusteeId, secretShare, ballotIndex}` args that no longer exist |
| `apps/auditor/src/App.test.tsx` | **survives** — mocks `./lib/bulletin`; update the fixtures and the two function names |
| `apps/trustee/src/App.test.tsx` | **survives** — same; `submitAllPartialDecryptions("t03", 17)` becomes `submitPartialDecryption(runId, trusteeId)` |
| `apps/auditor/src/lib/tally.test.ts` | **trim** — delete the canonical-JSON + fingerprint cases with the functions |
| `apps/auditor/src/components/components.test.tsx` | **untouched** — pure component tests (`Card`, `CopyButton`, `Chip`, `ResultBar`, `StatCard`) |

- `vi.stubGlobal("fetch", vi.fn())` returning canned console JSON. **No msw** — it is a new
  dependency for what a handful of `vi.fn()` calls already cover, and the App-level tests already
  mock at the module boundary.
- Board: renders results from a board payload; shows the pending-tally state when `sealed`; shows
  the error state on a non-2xx (the current silent `.catch(() => {})` must not survive);
  tracking-code hit / miss / malformed / ambiguous; the multi-seat card renders `elected` + rank
  from the payload (today it can only come from mocks).
- Trustee: roster renders from a ceremony payload; quorum meter at k/t from `CeremonyState`;
  submit posts `{run_id, trustee_id}` and re-polls; a 409 surfaces the console's message verbatim;
  the "who are you" picker appears with no `?trustee`.
- `EventSource` is stubbed (`vi.stubGlobal("EventSource", class { close() {} })`) — happy-dom has
  none.
- Delete `src/mocks/results.ts` and `src/mocks/trustee.ts` once nothing imports them, moving
  `initialsOf` into the trustee `App.tsx`. They are demo data and will silently rot otherwise.

---

## 8. What stays out of scope

- **`apps/voter` (Flutter)** — untouched. It writes via the `balota-encrypt` CLI; the console has no
  ballot-casting endpoint and the write path needs chaincode-valid credentials (the known gap in
  `CLAUDE.md` §"Where we left off", item 3).
- **`apps/admin`** — untouched; the console's own `/wizard` is the election-lifecycle UI.
- **Tauri shells** — `apps/{auditor,trustee}/src-tauri/` stays in the tree and keeps compiling.
  Nothing in Rust depends on the TypeScript, so `load_bulletin`, `verify_tracking_code`,
  `save_bulletin`, `submit_partial_decryption` and `submit_all_partial_decryptions` in
  `src-tauri/src/balota.rs` simply become unreferenced. **Keep `@tauri-apps/api`,
  `@tauri-apps/plugin-opener`, `@tauri-apps/cli` and the `tauri` script in `package.json`** — the
  `base: "/board/"` change alone is enough to make `pnpm tauri dev` load a page that talks to a
  console that isn't there, so the shell is de facto retired either way; removing the deps is a
  separate deletion PR, not this one (§11 q10).
- **`crates/bulletin-gateway`, `crates/bulletin-store`, `services/fabric-adapter`** — untouched.
  Note there *is* already an HTTP contract for the balotachain schema (`BulletinSource::Http` →
  `GET/PUT {base}/bulletin`, served by both the axum gateway and the Go fabric-adapter). Decision 1
  deliberately does not use it: it carries no results-with-seats, no trustee ceremony, no negative
  tests and no run history, and the ceremony's `partial_decrypt` has no HTTP equivalent there at
  all. Those crates keep serving the voter / e2e path.
- **Chaincode changes** — the endorsement-time threshold check is a known, documented improvement
  and stays out.
- **`saksi-auditor` / `saksi-demo` Rust changes** — including exposing `AuditReport.findings` from
  `audit-stream --json`. Noted as the upgrade path for §4.2; not done now.
- **Authentication** of any kind.

---

## 9. Verification plan

**A. Console with a small offline election.**
```
# saksi repo
cargo build -p saksi-demo --release
cd packages/saksi-campaign && go build ./cmd/saksi-campaign
./saksi-campaign serve --demo ../../target/release/saksi-demo \
                       --web-dir <balotachain>/dist-web
```
Open `http://127.0.0.1:8090/wizard`, run: 20 voters × 3 positions × 4 candidates, 3-of-5 trustees,
`realistic` distribution (strictly decreasing counts, so races decide cleanly — `uniform` ties on
purpose), `senate_seats = 3`, mode `offline`. Stop after **Encrypt & record** (step 4), before the
ceremony.

**B. Board, pending.** `http://127.0.0.1:8090/board/?run=<id>` → pending-tally state, no results,
integrity stats present, trustees 0 of 3.

**C. Trustee, below threshold.** `/trustee/?run=<id>&trustee=2` → identity "you" = the config's
trustee 2, quorum 0 of 3, roster all pending. Submit → confirm → done; roster shows 1 of 3. Repeat
as `trustee=1`. Attempt publish at 2 of 3 → the console's **409** message is shown verbatim.

**D. Threshold + publish.** `trustee=3` submits → quorum meter fills, publish unlocks, publish
succeeds. Board (still open in another tab) flips from pending to results within one 4 s poll.

**E. Verify + verified banner.** Run step 6 (Verify) from the wizard → the board's "verified" banner
and the check list turn PASS, `E = 0` per contest, tally fingerprint = `tally_sha256`.

**F. Tracking code.** Take any nullifier's first 8 hex chars from
`http://127.0.0.1:8090/export/<run>/ballots.csv`, format as `BC-XXXX-XXXX`, paste into
verify-your-vote → found, with the position named. A wrong code → not found. A malformed code →
inline validation, no request.

**G. Ties are not resolved.** Re-run with `distribution = uniform`, 20 voters, 4 candidates → the
board says the cut is not decided and awards nothing.

**H. Ground-truth run.** A `groundtruth`-mode run is filtered out of the picker; hitting
`/board/?run=<gt-run>` shows an explicit "this run produced plaintext ground truth only" state
rather than an error.

**I. On-chain (optional, needs a live network).** Same flow in `onchain` mode → `on_chain: true`,
chain height + tip hash on the crypto panel, the trustee timeline carries tx ids and block numbers,
`committed_on_chain: true` on the tracking-code lookup.

**J. Automated.**
- `pnpm --filter @balotachain/ui build && pnpm typecheck && pnpm test && pnpm lint && pnpm format:check`
  (the four CI jobs in `.github/workflows/ci.yml`).
- `go test ./...` in `packages/saksi-campaign` (saksi PR).

---

## 10. Task list

Each task names its files and one verify step. Tasks 1-5 are the saksi PR; 6-13 are balotachain.

**Saksi PR — `feat(campaign): board + verify-code API and static web dir`**

1. **Ceremony timestamps.** `ceremony.go` — add `SubmittedAt`/`StartedAt`/`PublishedAt`, set them in
   `writeCeremony`/`markSubmitted`/`markPublished`, carry them through `readCeremony`'s
   progress-only copy.
   *Verify:* `go test ./...` (extend `ceremony_test.go` with a round-trip assertion).

2. **Contest ranking, ported from the wizard.** New `board.go` — `rankContest`, `posLabel`,
   `candLabel`, `seatsFor(config, position)`.
   *Verify:* new `board_test.go` covering single-winner, 3-seat senate, exact 4-way tie, and a tie
   at the cut. Assert the outputs match `web/wizard.html`'s `renderBoard` rules.

3. **`GET /api/board/<run>`.** `board.go` + one line in `NewServer`. Reads run.json, header.json,
   correctness.csv, ceremony.json, scenarios.json; composes `Checks`; chain enrichment guarded by
   `s.fabric.Enabled()` and best-effort.
   *Verify:* `TestBoardOfflineRunNeedsNoChain`, `TestBoardSealedUntilPublished`,
   `TestBoardChecksReflectArtifacts`.

4. **`GET /api/verify-code/<run>/<code>`.** `board.go`. Streaming `ballots.csv` scan; on-chain
   `ListNullifiers` page; ambiguity → 409.
   *Verify:* found / not-found / malformed / ambiguous tests.

5. **`--web-dir` static serving + extended ceremony view.** `server.go`
   (`/board/`, `/trustee/`, redirects, `ceremonyView` wrapping `CeremonyState`),
   `cmd/saksi-campaign/main.go` (`--web-dir`, env fallback, startup banner line),
   `docs/research-election-console-runbook.md` (a section on serving the two apps).
   *Verify:* `TestWebDirServesBoardAndTrustee`; `TestCeremonyViewEmbedsStateAndEvents`; manually,
   `/wizard`'s ceremony step still works unchanged.

**BalotaChain PR — branch `feat/dynamic-board-trustee`, based on `origin/ui/design-sync-2026-09`**

6. **Console client — auditor.** Rewrite `apps/auditor/src/lib/bulletin.ts` in place: drop the
   `@tauri-apps/api/core` import and the eleven `bulletin-store` types, add `listRuns`, `loadBoard`,
   `verifyTrackingCode` over `VITE_CONSOLE_URL`. Rewrite `apps/auditor/src/lib/bulletin.test.ts` to
   stub `fetch`.
   *Verify:* `pnpm --filter auditor typecheck && pnpm --filter auditor test`.

7. **Wire the board.** `apps/auditor/src/App.tsx` — delete `deriveTallyMode`/`tallyToRaces`/the
   `.catch(() => {})` mock fallback; run selection (`?run=`, `/runs` fallback, picker);
   loading/empty/error/sealed states; results (with real `seats`/`rank`/`elected`/`contested`),
   integrity, crypto and checks from the payload; delete the `PRECINCTS`/`REGISTERED_VOTERS`
   captions and the `verifiedPct` mock-over-real ratio; make the footer's two dead `href="#"` links
   real — "Download verification data" → `/export/<run>/<artifact>` (a list built from
   `board.artifacts`), "Open verifier" → `/trail/<run>`. Delete `src/mocks/results.ts`.
   *Verify:* `pnpm --filter auditor test`; manual steps B/D/E above.

8. **Verify-your-vote.** Same file — point `verifyTrackingCode` at the console; **tighten
   `TRACKING_CODE_RE` to `/^BC-[A-F0-9]{4}-[A-F0-9]{4}$/i`** (the code is a hex nullifier prefix, so
   `[A-Z0-9]` would accept codes that can never exist); add the ambiguous-prefix and
   position-named copy, and the "no ledger timestamp offline" case for a null `recorded_at`.
   *Verify:* the tracking-code tests; manual step F.

9. **Retire the dead fingerprint.** Delete `resultsFingerprint`/`canonicalResultsJson` from
   `apps/auditor/src/lib/tally.ts` and their cases from `tally.test.ts`; keep the
   `CandidateResult`/`RaceResult` types.
   *Verify:* `pnpm --filter auditor test && pnpm --filter auditor typecheck`.

10. **Console client — trustee.** Rewrite `apps/trustee/src/lib/bulletin.ts` in place:
    `listRuns`, `loadCeremony`, `submitPartialDecryption(runId, trusteeId)`, `subscribeEvents`.
    Rewrite `apps/trustee/src/lib/bulletin.test.ts`.
    *Verify:* `pnpm --filter trustee typecheck && pnpm --filter trustee test`.

11. **Wire the trustee console.** `apps/trustee/src/App.tsx` — delete `YOU_TRUSTEE_ID`,
    `DEMO_SECRET_SHARE` and `deriveRoster`'s fallback merge; add `?run=` + `?trustee=` + picker +
    `localStorage`; thread props into the five mock-reading components (`TopBar`, `ThresholdCard`,
    `ActionCard`, `VerificationCard`, `KeyShareCard`); quorum meter and threshold from
    `CeremonyState`; roster chips (resolve the "Offline" question); submit → confirm → done with the
    202 + re-poll handshake; 409 surfaced verbatim; what-is-being-decrypted from `ballots_sha256` /
    `ballot_records` / real position labels; key-share card from `dkg_sha256` + `started_at`;
    audit-log timeline from `events`; status pill from `on_chain`; and the three honest-scope notes
    (console-enforced threshold, seeded tally, no trustee auth). Move `initialsOf` out of
    `src/mocks/trustee.ts`, then delete that file.
    *Verify:* `pnpm --filter trustee test`; manual steps C/D.

12. **Vite config + build script.** `apps/{auditor,trustee}/vite.config.ts` (`base`, proxy with the
    `Origin` strip), `tools/build-web.{sh,ps1}`, `.gitignore` for `dist-web/`.
    *Verify:* `pnpm --filter auditor build && pnpm --filter trustee build`, then serve with
    `--web-dir` and load both pages — assets resolve under `/board/` and `/trustee/`.

13. **Docs + CI.** New `docs/updates/2026-09-10-dynamic-board-and-trustee.md`; update `CLAUDE.md`'s
    "Latest update" and "Where we left off"; note the saksi PR dependency. No new CI job — the
    existing lint/typecheck/test jobs cover both apps.
    *Verify:* `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.

Task 6-13 depend on the saksi PR being merged (or on running a locally built console from that
branch). Tasks 6-9 (board) and 10-11 (trustee) are independent of each other.

---

## 11. Open questions

1. **Merge order.** The saksi PR must land (or at least be buildable locally) before the balotachain
   apps have anything to talk to. Land saksi first, or develop against a local saksi branch and land
   both together?
2. **PR #53 base.** This work branches from the unmerged `ui/design-sync-2026-09`. Merge #53 to
   `main` first, or stack this PR on top of it?
3. **The "Offline" trustee chip.** The console has no presence concept. Drop the third chip, or
   relabel it "ceremony not started" (`CeremonyState.Ready === false`)? The mockup shows three
   states.
4. **"Rejected" on the integrity panel.** Mapping it to ballot-stage negative-test PASSes is the
   only honest source, but it is *attacks refused*, not *voters' ballots rejected*. Relabel the
   stat, or drop it and let the negative-tests table carry that evidence on its own?
5. **Turnout.** 100% by construction in every synthetic run. Show it with a note, or replace the
   tile with "ballot records / voters × positions"?
6. **Does the trustee console get a Publish button?** The wizard has one. Publishing is an
   election-administrator action, not a trustee one — but a standalone trustee console with no
   publish means the demo still needs the wizard open in another tab.
7. **Election "closes" date offline.** There is no close timestamp without a ledger. Render nothing,
   or add a `closed_at` to `ceremony.json` at `CeremonyStart` (which is where `CloseElection` runs
   on-chain)?
8. **`--web-dir` vs Go embed.** A copy script keeps the repos independent; embedding would make the
   console a single self-contained binary. The former is assumed here — confirm.
9. **Should `/wizard` switch to the new `/api/board`?** It would delete `renderBoard` from
   `wizard.html` and leave one implementation. Out of scope as written, but it is the reason for
   putting the ranking in Go.
10. **Do the Tauri shells get deleted?** With `base: "/board/"` and no `invoke` calls,
    `pnpm tauri dev` renders a page that cannot reach the console. Keeping `src-tauri/` and the
    three `@tauri-apps/*` deps costs nothing but is dead weight; deleting them (plus
    `crates/bulletin-store`'s auditor/trustee consumers) is a clean follow-up PR. Keep or cut?
11. **`TRACKING_CODE_RE` character class.** `origin/main` has `[A-F0-9]`; the redesign branch
    appears to have widened it to `[A-Z0-9]`. Task 8 tightens it back to hex — confirm that is not
    an intentional design change.
