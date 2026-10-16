# National-canvass transmission attacks (size M)

Attack runners for the precinct-to-national smoke demonstration. Each scenario
is a full clean 10-precinct run on the one `saksi` channel, plus one mutation
applied **between "return built" and "canvass run"** (file scenarios) or **on
the channel** (chain scenarios). The national canvass (`saksi-demo
audit-canvass`) then detects it, naming the check. Size M is a verifier-side
posture: there is no on-chain refusal of returns, so every file attack is
"detected by the canvass verifier, check named" (T15/T16/T24 are "committed,
then detected", like B4/A1).

## Files

- `mutate_return.py` — one subcommand per file scenario; the driver's
  `--attack-script` hook. Mutates files only, prints `[MOUNTED] <id> <what>`.
- `assert_outcome.py` — reads `canvass-checks.csv`, judges a scenario against
  its expected failing-check set, appends a row to `negative-tests-canvass.csv`.
- `pre_close_t19.sh` — T19 chain mount (driver `--attack-pre-close-script`).
- `pre_tally_t20.sh` — T20 chain mount; needs a driver hook that does not exist
  yet (see **Driver change required**).
- `run_all.sh` — drives the real console driver per scenario, then asserts.
  `--only <id>` runs one. Does not reset the network; prints the hygiene
  reminder.
- `selftest.sh` + `_sort_nullifier.py` — file-level self-test with no Fabric.
- `../tamper_invoke/` — Go tool reused for the chain mounts (`submit-raw`,
  `publish-tally`), now with `--channel`/`--chaincode`/`--election` flags and
  env-driven fabric-samples paths (`SAKSI_FABRIC_SAMPLES`, `SAKSI_CHANNEL`,
  `SAKSI_CHAINCODE`, `SAKSI_PEER_ENDPOINT`, `SAKSI_TLS_CERT`, `SAKSI_ORG1_MSP`,
  `SAKSI_ORG2_MSP`).

## Scenarios

Target precincts are the plan's (overridable with `CANVASS_TARGET` /
`CANVASS_SIBLING`; the selftest uses p02/p01 on a 3-precinct fixture). Failing
checks are from the corrected Task 2 table (primary first). The `canvass.`
prefix is dropped below.

| ID | Mount | On-chain | Expected checks |
|----|-------|----------|-----------------|
| T9  | one aggregate byte flipped in return.json after signing (p03) | — | signature, completeness, precinct_recompute, national_sum |
| T10 | the accepted return delivered twice (p03 + p03-dup) | — | registry (duplicate) |
| T11 | a return for an unregistered precinct (p99), valid signature by a fresh key | — | registry (unknown) |
| T12 | a sibling return relabelled to this precinct and substituted (p04←p03) | — | signature, completeness, precinct_recompute, national_sum |
| T13 | the return dropped on the path (p05) | — | completeness, national_sum |
| T14a | re-signed with the real key under a wrong election id (p03) | — | registry, completeness, national_sum |
| T14b | re-signed with the real key with a stale close reference (`CANVASS_T14=close`) | — | precinct_recompute |
| T15 | real key over a ledger copy with one ballot omitted (p06) | — | precinct_recompute, national_sum |
| T16 | doctored aggregate re-signed with the stolen real key (p07) | — | precinct_recompute, national_sum |
| T19 | a p03 ballot resubmitted onto p04 (`submit-raw --channel`) | **recorded** | nullifier_unique (backstop) |
| T20 | p03's tally published onto p04 (`publish-tally --channel`) | **recorded** | accuracy / `tally.homomorphic_sum` (backstop) |
| T21 | re-signed with another registered precinct's key (p03 with p04's key) | — | signature, completeness, national_sum |
| T24 | an accepted `national/returns/*.json` replaced after acceptance | — | signature, completeness, precinct_recompute, national_sum |

For T19 and T20 the expected verdict is a **pair**: the chain's actual response
(`[COMMIT]` or `[REFUSED] gate=...`, recorded to `tNN-onchain.txt`) and the
canvass backstop. The Task 0/2 reviews predict the chaincode **refuses** both,
because the ballot's nullifier/presentation/CDS and the tally all bind the
precinct's election id. If refused, the row reads "refused on chain, canvass is
the backstop" and no canvass check needs to fire. If committed, the backstop
check must fire. `assert_outcome.py` accepts either consistent story.

T24 is run as the review's chosen mount (replace a file in `national/returns/`
after acceptance); the aggregate-record and partial variants are documented in
the Task 2 report.

## How to run

Self-test here (no network), with a release `saksi-demo`:

```
SAKSI_DEMO=/path/to/saksi-demo ./selftest.sh
```

It builds a `gen --precincts 3` fixture, fakes the ledger read-backs / returns
like the Task 2 tests, runs every file scenario through the real
`audit-canvass`, and asserts each PASS.

Full runs (desktop) — one scenario per network reset:

```
tools/tier.sh <voters> <positions>          # reset + deploy (not done by run_all)
DRIVER=.../saksi-canvass-demo DEMO=.../saksi-demo \
FABRIC_TLS_CERT=... FABRIC_CERT=... FABRIC_KEY=... \
  ./run_all.sh --only T9
```

## What needs the desktop

- **T19, T20** need a live Fabric network, the deployed chaincode, the generated
  fabric-samples identities, and the built `tamper_invoke`. Probe the on-chain
  response first; it is recorded for the paper.
- **run_all.sh** runs the real driver (full 10-precinct lifecycle), so it is
  desktop-only. The file mutations and `assert_outcome.py` are what the selftest
  exercises here.

## Driver change required (Task 4)

T20 needs a hook the Task 4 driver does not expose. Add to `precinctLifecycle`,
between `submitPartials` and the `PublishTally` step:

```
--attack-pre-tally-script   SAKSI_HOOK=pre-tally   args: <precinct dir> <election id>
```

with the same contract as the other hooks (run in every precinct; non-zero exit
stops the run). `pre_tally_t20.sh` is written against it. Until it lands, T20
cannot be wired in.
