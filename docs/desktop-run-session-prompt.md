# Desktop session prompt — instrument-gap run table, rows 1–2

The measurement runs happen on the **Fabric desktop** (Linux, Docker, reached
over SSH), not on this laptop. This is the paste-ready first message for a
Claude Code session on that box: **row 1** (`tools/up.sh` + ladder — the gate)
and **row 2** (SP-1K and MP-1K on-chain), stopping at the measure-first gate,
where SP-1K's real `committed_tps` re-plans rows 4–9.

Two things otherwise waste the session, so the prompt names them: the clone path
must contain **no spaces** (`fabric-samples` breaks on a space and the error
points nowhere near the cause), and **Docker must be running** before `up.sh`.

## Paste this as the first message

````
You are running the instrument-gap measurement rows 1-2 on this desktop. Work
through the steps in order and stop where the prompt says stop. Read the
sources before acting; do not guess a flag.

Sources of truth (read them, in this order):
  saksi/docs/research-election-console-runbook.md   sections 4, 8, 9
  saksi/docs/plans/2026-09-10-instrument-gap-execution.md   Global Constraints
  saksi/tools/up.sh, tools/ladder.sh, tools/tier.sh   headers = the contract
  balotachain/docs/manuscript-amendments.md   section 7 + the reps table

STEP 1 — code and toolchains

Clone saksi main at 51c7f19 (PR #36 merged) into a path with NO SPACES, and
balotachain beside it:

```bash
mkdir -p ~/Code && cd ~/Code
git clone https://github.com/saksi-framework/saksi.git
git clone https://github.com/saksi-framework/balotachain.git
cd ~/Code/saksi && git checkout 51c7f19 && git log --oneline -1
cd ~/Code/balotachain && git checkout ci/audit-trail && git log --oneline -1
```

Build both binaries and prove the checkout is green before anything is
measured on it:

```bash
cd ~/Code/saksi
cargo build -p saksi-demo --release          # -> target/release/saksi-demo
(cd packages/saksi-campaign && go build -o saksi-campaign ./cmd/saksi-campaign)
cargo test --workspace 2>&1 | tail -20
for m in packages/saksi-campaign packages/saksi-bulletin/client-sdk \
         packages/saksi-bulletin/chaincode packages/saksi-protocol/go; do
  (cd "$m" && echo "== $m" && go test ./... 2>&1 | tail -5)
done
```

If any suite is red, STOP and report. A measurement taken on a red build is not
a measurement.

STEP 2 — row 1: Fabric up, chaincode deployed, ladder green

`tools/up.sh` does the whole bring-up: preflight, install Fabric 2.5.15 if
missing (first run pulls ~1GB of images), `network.sh all` (channel `saksi` +
deployCC), resolve the Org1MSP User1 identity, build both binaries, then exec
the console in the FOREGROUND with the Fabric flags set. Ctrl-C leaves the
network up; `./tools/up.sh down` stops Fabric too.

```bash
cd ~/Code/saksi
docker info >/dev/null && echo docker-ok
./tools/up.sh                 # foreground; leave it running in its own shell
```

In a second shell, verify it is genuinely on-chain — do not assume:

```bash
cd ~/Code/saksi && ./tools/up.sh status
curl -s http://127.0.0.1:8090/api/capabilities    # must show "fabric":true
```

Then run the ladder against the RUNNING console. It is a gate, not a
convenience: `handleGenerate` refuses voters > 1000 in offline and onchain mode
unless `ladder.json`'s commit matches the console's own git head.

```bash
cd ~/Code/saksi
./tools/ladder.sh --base-url http://127.0.0.1:8090 --runs ~/.saksi/campaign/runs
cat ~/.saksi/campaign/runs/ladder.json
git -C ~/Code/saksi rev-parse HEAD        # must equal ladder.json's "commit"
```

Confirm the commit matches and every ladder tier passed with E = 0. If it does
not match, the gate is closed and rows above 1,000 voters cannot run — report
that rather than editing ladder.json.

STEP 3 — row 2: SP-1K then MP-1K, on-chain

The console started by `up.sh` is the on-chain-wired one. Restart it via
`tools/up.sh`, which resolves and passes the identity paths itself (the
`signcerts` / `keystore` lookup in `up.sh`'s `resolve_identity`) — do not hand-
assemble the `--fabric-*` flags of runbook section 4.

Reset the ledger before each tier so `ledger_bytes_delta` and the commit
latencies measure that tier, not the accumulated state of the one before it.
`tier.sh` tears the network down and brings it back up on a fresh channel with
the chaincode redeployed. The console's gRPC connection is process-lifetime, so
a console that was running across a `tier.sh` is holding a dead connection:
**restart it after every `tier.sh`, before the `--repeat` run.**

```bash
cd ~/Code/saksi
./tools/tier.sh 1000 1        # before SP-1K   (projects 1000 x 1 x 12KB)
```

Write the two configs. Trustees and threshold are the paper configuration
(5 trustees, threshold 3):

```bash
cat > ~/sp-1k.json <<'JSON'
{
  "name": "SP-1K",
  "trustees": [{"name":"COMELEC"},{"name":"Civil Society Watch"},
               {"name":"University IT"},{"name":"Academe Observer"},
               {"name":"Bar Association"}],
  "threshold": 3,
  "positions": 1,
  "candidates": 4,
  "voters": 1000,
  "distribution": "realistic",
  "mode": "onchain"
}
JSON
sed -e 's/"SP-1K"/"MP-1K"/' -e 's/"positions": 1/"positions": 3/' \
    ~/sp-1k.json > ~/mp-1k.json
```

SP-1K FIRST — its TPS is what re-plans rows 4-9 — then reset and run MP-1K:

```bash
# in the console's shell, after the SP-1K tier.sh above:
cd ~/Code/saksi && ./tools/up.sh          # fresh console on the fresh network
# then, in the second shell:
cd ~/Code/saksi
./tools/up.sh status                      # "fabric":true before measuring
./target/saksi-campaign --repeat --config ~/sp-1k.json --warmups 2 --reps 10 \
  --base-url http://127.0.0.1:8090 --out ~/Code/saksi/sp-1k-summary.csv

./tools/tier.sh 1000 3                    # before MP-1K
# Ctrl-C the console, restart it, and confirm it is live again:
cd ~/Code/saksi && ./tools/up.sh          # console shell
./tools/up.sh status                      # second shell: "fabric":true
./target/saksi-campaign --repeat --config ~/mp-1k.json --warmups 2 --reps 10 \
  --base-url http://127.0.0.1:8090 --out ~/Code/saksi/mp-1k-summary.csv
```

`summary.csv` is written across the MEASURED repetitions only; a failed run is
excluded from every throughput and latency statistic and counted in
`runs_failed` / `failure_rate` instead. Do not average around a failure — the
failure rate is the result.

STEP 4 — read the numbers and write the results note

Read these five fields for SP-1K. They do NOT all live in the same file:

  committed_tps          perf.csv (per run) / sp-1k-summary.csv (median etc.)
  sustained              perf.csv, and the run.end journal event
  scaling_limit          perf.csv (true | false | inconclusive)
  fail_reason            perf.csv, same string as run.end's `reason`
  ledger_matches_local   correctness.csv, NOT perf.csv (the source=ledger row)

Read `driver_ceiling_tps` beside `committed_tps`: if committed came within 20%
of the harness ceiling, the driver was the limit and `scaling_limit` reads
`inconclusive`. Say so; do not quote it as a system limit.

Write the note in the balotachain repo, on its current branch, as
`docs/desktop-runs/<YYYY-MM-DD>-row2.md`, containing:

  1. Build identity: saksi commit, console commit from run.json, Fabric
     version, and journal.ndjson line 1 (the environment snapshot).
  2. SP-1K: the five fields above, plus warm-ups discarded, runs_measured,
     runs_failed, failure_rate, and driver_ceiling_tps.
  3. MP-1K: the same block.
  4. Recomputed hours for rows 4-9 at the MEASURED TPS. One ballot record is
     submitted per voter per position, so:
       submissions = voters x positions
       hours       = submissions / committed_tps / 3600
     Compute a row per tier and state the measured TPS the estimate uses:
       row 4  SP-50K, MP-50K        (2 warm-ups + 5 reps)
       row 5  SP-483K, sweep        (1 + 3)
       row 6  SP-1M                 (1 + 3)
       row 7  SP-1.92M, SP-3.5M     (1 + 1 each, checkpointed)
       row 8  MP-483K .. MP-3.5M offline, chunked generator (1 each)
       row 9  MP-3.5M on-chain      (1, checkpointed)
     If the number puts a tier beyond the days left, say which rows drop from
     the bottom. Do not silently reshape the table.
  5. Anything the instrument refused, quoted verbatim (ladder gate, disk guard,
     offline ceiling), with the file it came from.

Then fill the SP-1K and MP-1K rows of the executed-reps table in
`docs/manuscript-amendments.md` section 3, and the SP-1K throughput figure in
section 7, from `summary.csv` only — every cell currently reads
`TODO(fill from summary.csv)` and must be replaced with a measured value or
left as the TODO. Never write a number that no artifact produced.

STEP 5 — stop

Stop here and report back. Rows 3-9 are NOT scheduled in this session: the
measure-first gate exists so the schedule is recomputed from SP-1K's real
number before any multi-hour tier is spent.

FALLBACK — if Fabric does not come up

If `tools/up.sh` does not bring the network up within this session, do not work
around it and do not fall back silently. Record in the results note: the exact
error, `./tools/up.sh status` output, `docker ps -a`, and the relevant
`docker logs` lines. Then run rows offline per the plan's OV-5 fallback:
`"mode": "offline"` in both configs (offline is capped at
`OfflineVoterCeiling` = 10,000 voters, so 1K tiers are fine), and mark the
on-chain columns "not evaluated on-chain (network unavailable)" in the note so
the manuscript text can be taken from it verbatim.

ARTIFACTS TO COPY BACK

  - every run folder created under --runs (~/.saksi/campaign/runs) for both
    tiers, WHOLE (run.json, header.json, perf.csv, perf-schema.md,
    correctness.csv, latencies.csv, timings.json, gen-timings.json,
    receipts.csv, trail.ndjson, negative-tests.csv, ground-truth-check.json)
  - ~/.saksi/campaign/runs/ladder.json
  - line 1 of each run's journal.ndjson: `head -n1 <run>/journal.ndjson`
  - sp-1k-summary.csv and mp-1k-summary.csv

STOP CONDITIONS — stop and ask, do not proceed

  1. A destructive action (deleting run folders, `network.sh down` on a
     network holding results not yet copied back, resetting a checkout).
  2. A security-sensitive action (binding the console off loopback, moving
     keys or MSP material, anything that exposes the no-login server).
  3. A push or merge to a shared branch.
  4. A plan so broken that every path forward is a guess.
````

## Notes for whoever pastes this

- `up.sh` runs the console with `exec`, so it holds the shell. Use a second SSH
  session (or tmux) for the ladder and the `--repeat` driver.
- The console has **no login** — anyone who can reach the address can drive it.
  Keep the loopback bind and use `ssh -L 8090:127.0.0.1:8090 <user>@<desktop>`
  to view the wizard from the laptop, rather than binding `0.0.0.0`.
- The candidate count (4) and `realistic` distribution above match the ladder
  and the Appendix A profile. If the paper's SP/MP tiers are defined with a
  different candidate count, fix both configs before the runs start — the tier
  label in the paper has to mean what was executed.
