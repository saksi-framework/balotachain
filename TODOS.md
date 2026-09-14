# TODOS

## Chaincode

### Verify partial-decryption Chaum-Pedersen proofs at endorsement

**What:** `SubmitPartialDecryption` in `saksi/packages/saksi-bulletin/chaincode/contract.go` verifies each trustee's Chaum-Pedersen proof on-chain instead of only checking that a proof is present.

**Why:** Closes the last "chaincode validates shape, not proof" gap. Today the auditor verifies partial-decryption proofs off-chain; the chaincode rejects only a missing proof. Table 3.11 of the manuscript reads stronger when every trustee artifact on the ledger is cryptographically checked at endorsement.

**Context:** The instrument-gap plan (2026-09) adds a `sigverify` package to the chaincode with a ristretto255 Schnorr verifier and a Merlin transcript byte-identical to Rust, plus verification-key derivation from the DKG `coefficient_commitments`. Chaum-Pedersen is the same primitive over two bases, so the port is mostly a second transcript label and a golden vector written by a Rust test (pattern: `credverify_test.go` `loadVector` reading `saksi-protocol/test-vectors/*.hex`). Start from `sigverify.VerifySchnorr` and the auditor's `decryption.rs` CP check for the exact transcript framing.

**Effort:** M
**Priority:** P2
**Depends on:** `sigverify` landed and green; every item in the 2026-09 instrument-gap plan implemented and hard-tested first (user decision 2026-09-09).

## Harness

### Record Fabric-side phase timings from the peer's Prometheus metrics

**What:** During an on-chain run, scrape peer0's operations endpoint (`/metrics`, port 9443 in fabric-samples) and record the `endorser_proposal_duration`, `ledger_block_commit_time`, and `broadcast_validate_duration` histograms into `journal.ndjson`; summarise them into Appendix C phase columns.

**Why:** The manuscript's per-phase Fabric columns (endorse / validate / commit) are not observable from the client, so the 2026-09 plan deletes them. The peer measures those phases itself. Scraping them makes the columns real instead of absent.

**Context:** The sampler goroutine in `saksi/packages/saksi-campaign/journal.go` already polls `docker stats` every 5 s; add one HTTP GET to the operations endpoint on the same tick and parse the Prometheus text format (histogram buckets, not per-ballot values). The operations endpoint must be enabled in the test-network peer config (`tools/up.sh`, `docker/README.md` own it); unverified on this network. Report bucketed distributions, not percentiles, and say so in `perf-schema.md`.

**Effort:** S
**Priority:** P3
**Depends on:** Journal + sampler landed; a live network; the chaincode partial-decryption verification TODO above implemented and hard-tested first (user decision 2026-09-09).

## Completed

### Driver concurrency and orderer batch parameters for the on-chain run table

**What:** Two knobs decide whether the console or Fabric is the throughput ceiling. (1) Raise the console's `concurrency` (per run config, `ElectionConfig.Concurrency`, default 8 in `saksi/packages/saksi-campaign/config.go`) until `committed_tps < 0.8 × driver_ceiling_tps`, i.e. until Fabric, not the driver, is the limit; probe 32 / 64 / 128 / 256 with one measured rep each at SP-1K and pick the lowest that clears the rule. (2) Optionally tune the orderer's `BatchTimeout` (2 s in fabric-samples `test-network/configtx/configtx.yaml`) and `MaxMessageCount` (10) to production-like values (for example 500 ms / 500) and declare the change in Table 3.12; that needs a channel regeneration, which `tools/tier.sh` already does per tier.

**Why:** The first SP-1K run on the Ryzen desktop (2026-09-11, saksi `302d569`) committed at 3.9 TPS with p50 latency 2037 ms ± 5 ms and peer CPU at 5.7 %: with 8 ballots in flight a 10-message block never fills, so every block waits the full 2 s `BatchTimeout`. The instrument reported it honestly (`driver_ceiling_tps` 3.93, `scaling_limit` inconclusive), but at that rate MP-3.5M alone is ~750 hours. Every on-chain row above 1K depends on this being set right first.

**Context:** The plan's sweep already sizes concurrency from the previous step's p99 (`repeat.go`, Little's law + headroom); fixed-tier `--repeat` runs use the config's value and need the same care. Record the chosen concurrency and, if changed, the orderer parameters in `docs/desktop-runs/<date>-row2.md` and in the manuscript's environment table so the reported TPS is attributable.

**Effort:** S (concurrency probe) / M (orderer retune + Table 3.12 text)
**Priority:** P1 — blocks rows 3–9 of the run table
**Depends on:** Row 1 ladder green (done 2026-09-11); a live network.

### Batch the post-window lifecycle transactions and the ledger-dump reads

**What:** (1) After the ballot window, the console submits CloseElection, one `SubmitPartialDecryption` per trustee × contest × candidate, and `PublishTally` strictly one after another; each lands alone in a block and waits the orderer's full `BatchTimeout` (2 s). Submit the partial decryptions concurrently (they are independent transactions) or carry all of one trustee's partials in one transaction, so the tail costs one or two blocks instead of 20–60. (2) The on-chain Verify dumps the ledger with one `GetBallot` query per nullifier (~2 ms each through the gateway); add a paged `GetBallots(nullifiers[])` evaluate to the chaincode and use it from `ledger_dump.go`.

**Why:** Measured on the Ryzen desktop 2026-09-11 (saksi `302d569`, c = 96): the lifecycle tail is a fixed 45 s per SP run and 127 s per MP run regardless of voters, which is 2–5 min of every small-tier repetition (12 reps per tier); Verify is ~4.9 ms/ballot, of which the per-nullifier dump is roughly half — at MP-3.5M that dump alone is hours. Neither is a measured quantity the paper reports, so both are pure overhead on the run table.

**Context:** Lifecycle steps are `lifecycleStep` calls in `saksi/packages/saksi-campaign/executor.go` (`submitOnChain`/`lifecycle`); the chaincode's `SubmitPartialDecryption` is per (contest, trustee) in `contract.go`; the dump is `dumpLedgerBallots` in `ledger_dump.go` over `ListNullifiers` + `GetBallot`. Concurrent partial submission needs no chaincode change; the batch read does (new evaluate-only function, no state writes, plus a client-sdk method and a fakeLedger stub).

**Effort:** S (concurrent partials) / M (batched `GetBallots` end to end)
**Priority:** P2 — shortens every run but changes no reported number
**Depends on:** Nothing; can land any time between run-table rows (redeploy chaincode with `tools/tier.sh`).

### Split the Vite dev-proxy target from the browser client base URL

**What:** `apps/{admin,auditor,trustee}/vite.config.ts` read `VITE_CONSOLE_URL` as the dev-server proxy target, while each app's `src/lib/bulletin.ts` reads the same name through `import.meta.env` as the browser-side API base. Rename the proxy target to a non-`VITE_` variable (e.g. `CONSOLE_URL`) in all three configs and document both.

**Why:** Setting the variable to point the dev proxy at another console also makes the browser call that console cross-origin directly, which CORS blocks and which, with console auth on, drops the session cookie. Inherited from PR #54 and extended by PR #56; the default (unset) flow is unaffected.

**Effort:** S
**Priority:** P3
**Depends on:** PR #56 merged.

### Caller authorization in the chaincode (front-running denial of service)

**What:** The saksi chaincode never calls `GetClientIdentity`. Bind `PublishDKGTranscript` to the election's declared DKG publisher (or the admin MSP identity that created the election) and `SubmitPartialDecryption` to the MSP identity registered for that trustee.

**Why:** Found by the 2026-09-14 review of saksi PR #44. Any channel client can publish a tampered DKG transcript right after CreateElection. The real transcript is then refused as `dkg-duplicate`, and every ballot fails at `deriveElectionPublicKey`. Any client can also front-run a trustee's partial decryption, which blocks the real share as `partial-duplicate`. The auditor still catches the tampering (integrity holds), but availability does not. Chapter 4 must state it as a limitation until fixed.

**Context:** Requires recording an identity per role at CreateElection (trustee MSP identities in the election parameters), identity checks in two chaincode functions, a redeploy, and the console submitting with the right identity per trustee. Changes the ceremony trust model the thesis describes, so needs a maintainer decision and likely an ADR.

**Effort:** M
**Priority:** P1 for the thesis limitations text; P2 to implement
**Depends on:** saksi PR #44 merged.

### Reordering claim: "detected by ledger digest" has no verifier behind it

**What:** Decide between (a) wiring an ordering/digest check into the independent verifier (e.g. the auditor compares a published ledger digest over the ballot sequence), or (b) correcting saksi-auditor's adversary table and tests to state that ballot reordering is not detected.

**Why:** The 2026-09-14 review of saksi PR #44 found that `security_privacy.rs:18` and `:72-98`, and `independent_verification.rs:100-115`, say a reorder is "detected by ledger digest". But `ledger::ledger_digest` (`ledger.rs:19`) is only called from tests, and no verifier runs it. The chaincode has no ordering gate either, and PR #44's `reordered-ballots` scenario now says so. Thesis text or tables built on the adversary table would overstate the verifier.

**Context:** Homomorphic tallying is order-independent, so reordering does not change the result. The question is whether the thesis claims ordering integrity as a property at all. If not, (b) is a text change; if so, (a) needs a published digest the verifier can recompute.

**Effort:** S for (b), M for (a)
**Priority:** P1 for the thesis text
**Depends on:** none
