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
- `pre_tally_t20.sh` — T20 chain mount (driver `--attack-pre-tally-script`,
  saksi 4b9284d, run with `--attack-pre-tally-tolerate`).
- `run_all.sh` — drives the real console driver per scenario, then asserts.
  `--only <id>` runs one. Does not reset the network; prints the hygiene
  reminder.
- `selftest.sh` + `_sort_nullifier.py` — file-level self-test with no Fabric.
- `../tamper_invoke/` — Go tool reused for the chain mounts (`submit-raw`,
  `publish-tally`), with `--channel`/`--chaincode`/`--election` flags and
  env-driven fabric-samples paths (`SAKSI_FABRIC_SAMPLES`, `SAKSI_CHANNEL`,
  `SAKSI_CHAINCODE`, `SAKSI_PEER_ENDPOINT`, `SAKSI_TLS_CERT`, `SAKSI_ORG1_MSP`,
  `SAKSI_ORG2_MSP`). Build it with `../tamper_invoke/build.sh` and `SAKSI_REPO`
  (see How to run).

## Scenarios

Target precincts are the plan's (overridable with `CANVASS_TARGET` /
`CANVASS_SIBLING`, which the selftest does not use). Failing checks are from
the corrected Task 2 table (primary first). The `canvass.` prefix is dropped.

| ID | Mount | On-chain | Expected checks |
|----|-------|----------|-----------------|
| T9  | one aggregate byte flipped in return.json after signing (p03) | — | signature, completeness, precinct_recompute, national_sum |
| T10 | the accepted return delivered twice (p03 + p03-dup) | — | registry (duplicate) |
| T11 | a return for an unregistered precinct (p99), valid signature by a fresh key | — | registry (unknown) |
| T12 | p03's return relabelled to p04 and substituted for p04's | — | signature, completeness, precinct_recompute, national_sum |
| T13 | the return dropped on the path (p05) | — | completeness, national_sum |
| T14a | re-signed with the real key under a wrong election id (p03) | — | registry, completeness, national_sum |
| T14b | re-signed with the real key with a stale close reference (`CANVASS_T14=close`) | — | precinct_recompute |
| T15 | real key over a ledger copy with one ballot omitted (p06) | — | precinct_recompute, national_sum |
| T16 | doctored aggregate re-signed with the stolen real key (p07) | — | precinct_recompute, national_sum |
| T19 | a p03 ballot resubmitted onto p04 (`submit-raw --channel`) | **recorded** | none if refused; nullifier_unique, accuracy if committed |
| T20 | p03's tally published onto p04 (`publish-tally --channel`) | **recorded** | none if refused; accuracy (`tally.homomorphic_sum`) if committed |
| T21 | re-signed with another registered precinct's key (p03 with p04's key) | — | signature, completeness, national_sum |
| T24 | an accepted `national/returns/*.json` replaced after acceptance | — | signature, completeness, precinct_recompute, national_sum |

For T19 and T20 the expected verdict is a **pair**: the chain's actual response
(`[COMMIT]` or `[REFUSED] gate=...`, recorded verbatim to `tNN-onchain.txt`) and
the canvass. The replayed ballot and tally each carry **p03's** election id
inside the proto, so the call addresses p03's election (already closed and
tallied), not p04's. The recorded refusal will therefore name p03's closed
election (for example "election closed" or "already published"), not a p04
binding failure. The paper words it as **"refused by the election binding of
the target precinct"** and cites the gate text as recorded.

Verdict policy is strict set equality throughout. Refused on chain: PASS only
if **no** canvass check failed. Committed on chain: PASS only if the failed set
equals the full expected set. The `expected_checks` column of the CSV row
states which case applied. If `canvass-checks.csv` is missing (the driver
stopped before the canvass), the row is written with verdict **ERROR**.

T24 is run as the review's chosen mount (replace a file in `national/returns/`
after acceptance); the aggregate-record and partial variants are documented in
the Task 2 report.

## How to run

Self-test here (no network), with a release `saksi-demo`:

```
SAKSI_DEMO=/path/to/saksi-demo ./selftest.sh
```

It builds a `gen --precincts 7` fixture, fakes the ledger read-backs and
returns the way the Task 2 tests do, and runs every file scenario through the
real `audit-canvass` with the scenarios' real targets and siblings. Each
precinct's signed return is released only at its own hook (the driver's
order), and a scenario that never prints `[MOUNTED]` fails, so a target or
sibling wired backwards is caught.

Build `tamper_invoke` (needed for T19 and T20). `go.mod` keeps the AX42
`/root/Code/saksi` replace paths that the archived Chapter IV runs were built
with, so it stays unchanged. `build.sh` writes a gitignored `go.local.mod`
pointing at `SAKSI_REPO` (default: the `saksi` checkout next to balotachain)
and builds with `-modfile`:

```
SAKSI_REPO=/path/to/saksi ../tamper_invoke/build.sh     # VET=1 also runs go vet
```

Full runs (desktop), one scenario per network reset. Run from a **space-free
checkout path** (`C:\wt\...` or WSL): the driver splits each hook command on
whitespace, and `run_all.sh` refuses a path with a space.

```
tools/tier.sh <voters> <positions>          # reset + deploy (not done by run_all)
DRIVER=.../saksi-canvass-demo DEMO=.../saksi-demo \
FABRIC_TLS_CERT=... FABRIC_CERT=... FABRIC_KEY=... \
  ./run_all.sh --only T9
```

## What needs the desktop

- **T19, T20** need a live Fabric network, the deployed chaincode, the generated
  fabric-samples identities, and the built `tamper_invoke`. The on-chain
  response is recorded for the paper.
- **run_all.sh** runs the real driver (full 10-precinct lifecycle), so it is
  desktop-only. The file mutations and `assert_outcome.py` are what the selftest
  exercises here.
