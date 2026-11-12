"""Build README.md for the precinct-canvass evidence folder from the files in it.

usage: python3 gen_readme.py <evidence dir> <DEVIATIONS.md>
"""
import csv, glob, json, os, sys

E, DEV = sys.argv[1], os.path.abspath(sys.argv[2])
os.chdir(E)
out = []
w = out.append


def j(p):
    with open(p) as f:
        return json.load(f)


def checks(p):
    with open(p) as f:
        return list(csv.DictReader(f))


w("# Precinct-to-national canvass runs (desktop, 2026-10-18)\n")
w("Later build (Appendix E), desktop only, never pooled with AX42. Every Chapter IV number stays on saksi `4a38a54`; "
  "these runs are a separate, later build. The A-additive outputs are **a re-analysis of the archived record** "
  "of SP-3.5M m3 and MP-3.5M offline, not precinct runs.\n")
w("## Machine and build\n")
w("- The Table 3.12 desktop: Ryzen 7 5700G, 32 GB, Windows 11 Pro 26200; WSL2 Ubuntu (16 vCPU, 23 GB visible, swap 0); Docker Desktop engine 29.7.2; Fabric 2.5.15 test-network (2 peers, 1 Raft orderer); channel `saksi`; chaincode `saksi-bulletin`.")
w("- Orderer parameters: the adopted saksi configtx (BatchTimeout 2 s, MaxMessageCount 50, PreferredMaxBytes 2 MB, SnapshotIntervalSize 256 MB), installed by `network.sh` on every reset.")
w("- saksi `0cdc335` (merge of #61) in `~/Code/saksi`; balotachain `20d9860` cloned to `~/balotachain`.")
w("- Binary digests (sha256), from `binary-sha256.txt`:\n")
for line in open("binary-sha256.txt"):
    h, p = line.split()
    w(f"  - `{os.path.basename(p)}`: `{h}`")
w("")
w("- `tools/security/canvass/selftest.sh` against this `saksi-demo`: 11/11 file scenarios PASS.\n")
w("### How to verify the build\n")
w("`build-verification.txt` records what was checked on the desktop after the runs (fix round 1, 2026-10-18):\n")
w("- `git -C ~/Code/saksi rev-parse HEAD` = `0cdc3350f4275936c8be560b67e04049257e16f9` (\"Merge pull request #61 from saksi-framework/feat/precinct-canvass\"), with a clean working tree;")
w("- `git -C ~/balotachain rev-parse 20d9860` = `20d9860bc4e890ef4486890a4bf8c8cdc5c28341`, the parent of the first evidence commit on this branch;")
w("- the four binaries re-hashed with `sha256sum` and diffed against `binary-sha256.txt`: identical. They were built at 03:14 (+08:00), before the first run, and not rebuilt.\n")
w("To check independently: clone saksi, `git checkout 0cdc335` and build as in `scripts/build.sh` (go1.23.4 linux/amd64, rustup stable). Rust and Go builds are not bit-reproducible across toolchains, so the digests identify the binaries that produced this folder; they do not promise a rebuild matches.\n")

w("## Procedure\n")
w("- One `tools/tier.sh 10000 3` reset (network down, fresh channel, chaincode redeployed) before every run: the smoke run, each probe, each attack and each clean run. The reset log is `logs/resets.txt` (local times, +08:00; `started` fields in the JSON are UTC).")
w("- Smoke run before anything else: 2 precincts x 20 voters x 3 positions, 60 records each, all seven checks pass.")
w("- Precinct ballot window: the console's closed-loop submitter at its default concurrency 8 (`saksi-canvass-demo` at 0cdc335 has no concurrency flag). With MaxMessageCount 50 above 8 in-flight ballots, every block is cut by the 2 s BatchTimeout, so per-precinct TPS (about 3.9) and latency (about 2.04 s) measure the batch timeout, not the protocol.")
w("- Generation: `saksi-demo gen --stream <dir> --precincts 10 --voters V --positions 3 --candidates 4 --trustees 5 --threshold 3 --distribution realistic`; driver `saksi-canvass-demo --distribution realistic` with the Org1 User1 identity. `--fabric-peer-volume` was not set (the Docker Desktop volume is not visible from the Ubuntu distro), so `ledger_bytes_delta` is null.")
w("- Attack runs: `tools/security/canvass/run_all.sh --only <id>` with `VOTERS=1000` (10 precincts x 100 voters x 3 positions = 300 records per precinct). Clean runs: the plan size, `--voters 10000` (1,000 voters and 3,000 records per precinct).")
w("- Ledger dumps (`ledger/ballots.ndjson`) are not committed; their sha256 is in each run's `ledger-sha256.txt`. `authority.key` is never copied.\n")

cr = [f for f in (f"clean/{r}/canvass-run.json" for r in ("warmup", "m1", "m2", "m3")) if os.path.exists(f)]
w("## Clean canvass runs\n")
w("> **Batch-timeout note.** The TPS and latency figures in these tables come from the driver's fixed concurrency 8 over blocks cut by the 2 s BatchTimeout "
  "(MaxMessageCount 50 is never reached): 8 / 2.029 s = 3.943, against `driver_ceiling_tps` 3.943 and committed 3.942. "
  "They measure the batch timeout, not the protocol, and must not be compared with the Chapter IV ladder.\n")
if len(cr) < 4:  # pending runs
    w(f"{len(cr)} of 4 clean runs (warm-up + m1-m3) are in this commit.\n")
for f in cr:
    run = f.split("/")[1]
    r = j(f)
    w(f"### {run} ({'warm-up, not measured' if run == 'warmup' else 'measured'})\n")
    w(f"Started {r['started']} (UTC); driver total {r['total_ms']/1000:.1f} s; national canvass {r['canvass_ms']} ms; exit {r['exit_code']}; canvass pass: {r['canvass_pass']}.\n")
    w("| precinct | records / verified | window s | committed TPS | p50 ms | p95 ms | p99 ms | precinct window s | close to return s | audit | close block |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    for p in r["precincts"]:
        m = p.get("submit_metrics") or {}
        w(f"| {p['precinct_id']} | {p['records']} / {p['verified']} | {m.get('window_ms', 0)/1000:.1f} | {m.get('committed_tps', 0):.3f} | "
          f"{m.get('latency_p50_ms', 0):.1f} | {m.get('latency_p95_ms', 0):.1f} | {m.get('latency_p99_ms', 0):.1f} | "
          f"{p['precinct_window_ms']/1000:.1f} | {p['close_to_return_ms']/1000:.1f} | {p['audit']} | {p['close_block']} |")
    w("")
    w("Note: the window, TPS and latency columns are batch-timeout bound (concurrency 8, 2 s BatchTimeout; see the note above).\n")
    w("| check | verdict | reason |\n|---|---|---|")
    for c in checks(f"clean/{run}/canvass-checks.csv"):
        w(f"| {c['check']} | {c['verdict']} | {c['reason']} |")
    w("")

meas = [(f.split("/")[1], j(f)) for f in cr if f.split("/")[1] != "warmup"]
if meas:
    import statistics as st

    def ms(xs):
        return (st.mean(xs), st.stdev(xs) if len(xs) > 1 else 0.0)

    w("### Measured-run summary\n")
    w(f"Over the {len(meas)} measured runs ({', '.join(n for n, _ in meas)}), each a full 10-precinct canvass. Per-run values are means over the 10 precincts; the last row is the mean and sample standard deviation across runs.\n")
    w("| run | canvass pass | driver total s | national canvass ms | window s | TPS | p50 ms | p95 ms | p99 ms (max) | precinct window s | close to return s |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    cols = {k: [] for k in ("tot", "can", "win", "tps", "p50", "p95", "p99", "pw", "cr")}
    for n, r in meas:
        P = r["precincts"]
        M = [x["submit_metrics"] for x in P]
        v = dict(tot=r["total_ms"] / 1000, can=r["canvass_ms"], win=st.mean(m["window_ms"] for m in M) / 1000,
                 tps=st.mean(m["committed_tps"] for m in M), p50=st.mean(m["latency_p50_ms"] for m in M),
                 p95=st.mean(m["latency_p95_ms"] for m in M), p99=max(m["latency_p99_ms"] for m in M),
                 pw=st.mean(x["precinct_window_ms"] for x in P) / 1000, cr=st.mean(x["close_to_return_ms"] for x in P) / 1000)
        for k in cols:
            cols[k].append(v[k])
        w(f"| {n} | {r['canvass_pass']} | {v['tot']:.1f} | {v['can']} | {v['win']:.1f} | {v['tps']:.3f} | {v['p50']:.1f} | {v['p95']:.1f} | {v['p99']:.1f} | {v['pw']:.1f} | {v['cr']:.1f} |")
    f2 = {k: ms(c) for k, c in cols.items()}
    w(f"| mean ± sd | | {f2['tot'][0]:.1f} ± {f2['tot'][1]:.1f} | {f2['can'][0]:.0f} ± {f2['can'][1]:.0f} | {f2['win'][0]:.1f} ± {f2['win'][1]:.1f} | "
      f"{f2['tps'][0]:.3f} ± {f2['tps'][1]:.3f} | {f2['p50'][0]:.1f} ± {f2['p50'][1]:.1f} | {f2['p95'][0]:.1f} ± {f2['p95'][1]:.1f} | "
      f"{f2['p99'][0]:.1f} ± {f2['p99'][1]:.1f} | {f2['pw'][0]:.1f} ± {f2['pw'][1]:.1f} | {f2['cr'][0]:.1f} ± {f2['cr'][1]:.1f} |")
    w("")
    w("Note: the window, TPS and latency columns are batch-timeout bound (concurrency 8, 2 s BatchTimeout); they measure the timeout, not the protocol, and must not be compared with the Chapter IV ladder.\n")
    w("National E = 0 in every measured run (canvass.accuracy: 10 precinct audits pass with E = 0; national decryption of the ledger product gives E = 0).\n")
w("## Attack runs\n")
rows = list(csv.DictReader(open("negative-tests-canvass.csv")))


def lab(s):
    return "T24b (run as T24)" if s == "T24" else s


w("Verdict = strict set equality against the corrected Task 2 table (`docs/plans/precinct-m-reports/task2-review.md`). T24 here is the T24b mount (an accepted `national/returns/*.json` replaced after acceptance; the tool names it T24). T15, T16 and T24b are committed, then detected: the precinct ledger is untouched, so `canvass.accuracy` stays green.\n")
w("| scenario | mount | expected failing checks | failed checks | on chain | verdict |\n|---|---|---|---|---|---|")
for r in rows:
    oc = "refused (verbatim below)" if r["onchain"] else "n/a"
    w(f"| {lab(r['scenario'])} | {r['mount']} | {r['expected_checks']} | {r['failed_checks'] or 'none'} | {oc} | {r['verdict']} |")
w("")
w("### Chain responses (verbatim)\n")
for s in ("T19", "T20"):
    t = open(f"attacks/{s}/{s.lower()}-onchain.txt").read().strip()
    w(f"- **{s}**: `{t}`")
w("")
w("T19 resubmits a committed precinct-03 ballot while precinct-04 is open. The ballot carries p03's election id, and p03 is closed, so the chaincode's election-open gate refuses it. "
  "T20 publishes precinct-03's tally while precinct-04 sits between its partial decryptions and PublishTally. The tally carries p03's election id and p03 already has a tally, so it is refused. "
  "In both runs p04's own tally then published and the canvass passed all seven checks. Paper wording: refused by the election binding of the target precinct.\n")
w("### Failing-check reasons per scenario\n")
for r in rows:
    s = r["scenario"]
    fails = [c for c in checks(f"attacks/{s}/canvass-checks.csv") if c["verdict"] != "pass"]
    if fails:
        w(f"- **{lab(s)}**: " + "; ".join(f"`{c['check']}`: {c['reason']}" for c in fails))
w("")
w("| scenario | started (UTC) | driver total s | canvass ms |\n|---|---|---|---|")
for r in rows:
    k = j(f"attacks/{r['scenario']}/canvass-run.json")
    w(f"| {lab(r['scenario'])} | {k['started']} | {k['total_ms']/1000:.1f} | {k['canvass_ms']} |")
w("")

w("## A-additive re-analysis of the archived record\n")
w("`saksi-demo precinct-aggregate <scratch copy> --precinct-size 1000 --ground-truth <run>/ground-truth-ballots.csv --correctness <run>/correctness.csv`, with `SAKSI_AUDIT_THREADS=16`, on a decompressed scratch copy under `~/scratch-precinct/` (deleted afterwards). Inputs are the Q: archive copies in `Q:\\thesis-archive\\runs\\<run>\\`. The decompressed `ballots.ndjson` sha256 matched the archived `ballots.ndjson.sha256` for both runs before the fold.\n")
w("| archived run | precincts | voters | records | contests | checks yes / total | overall | per-precinct E | decompress s | precinct-aggregate wall s (upper bound) |\n|---|---|---|---|---|---|---|---|---|---|")
for d in sorted(glob.glob("a-additive/*/")):
    name = d.split("/")[1]
    s = j(d + "summary.json")
    wt = {}
    for tok in open(d + "walltime.txt").read().split():
        if "=" in tok:
            k, v = tok.split("=", 1)
            wt[k] = v
    yes = sum(1 for c in s["checks"] if c["pass"])
    w(f"| {name} | {s['precincts']} | {s['voters']:,} | {s['records']:,} | {s['contests']} | {yes} / {len(s['checks'])} | {'pass' if s['pass'] else 'FAIL'} | {s['per_precinct_e']} | {wt.get('decompress_s')} | {float(wt.get('aggregate_wall_s', 0)):.0f} |")
w("")
w("For every contest, four checks pass. `combine.product`: the sum of the 3,525 precinct aggregates equals the region aggregate. `combine.audit_fold`: it equals the auditor's own fold. `combine.correctness_csv`: it equals the committed `aggregate_ciphertext` in the archived `correctness.csv`. `combine.ground_truth`: the sum of per-precinct ground truths equals the region's. Per-precinct E is unavailable by design, because the key and trustee shares no longer exist. "
  "Both wall times are upper bounds: the SP-3.5M fold overlapped the T19 attack run, and the MP-3.5M fold partly overlapped a network reset attempt and an aborted, unmeasured warm-up.\n")

IDX = {
    "env.sh": "PATH for the WSL toolchain",
    "runenv.sh": "driver, demo, identity and Fabric paths",
    "build.sh": "step 1: build, selftest, binary digests",
    "reset.sh": "one tier.sh reset, retried up to 3 times",
    "smoke.sh": "2-precinct smoke canvass",
    "attacks.sh": "reset, then run_all.sh --only, per scenario",
    "clean.sh": "reset, gen, clean canvass, per run",
    "aadd.sh": "A-additive: decompress, sha256 check, precinct-aggregate, delete scratch",
    "chain.sh": "first orchestration (T20 reset failed; superseded)",
    "chain2.sh": "second orchestration (stopped to reorder)",
    "chain3.sh": "T20 and the 11 file attacks, then the clean warm-up",
    "waitfor.sh": "wait helper",
    "q3.sh": "clean-run summary printer",
    "q4.sh": "clean-run table printer",
    "collect.sh": "copies the evidence into this folder",
    "gen_readme.py": "builds this README",
    "patch_readme.py": "fix round 1 edits to gen_readme.py",
    "DEVIATIONS.md": "source of the deviations section",
}
w("## Scripts\n")
w("The scripts that drove these runs, copied as run into `scripts/` (paths are the desktop's). m1 was run by `clean.sh m1` after `chain3.sh` stopped:\n")
for f in sorted(os.listdir("scripts")):
    w(f"- `scripts/{f}`: {IDX.get(f, 'helper')}")
w("")
w("## Deviations and environment fixes\n")
for line in open(DEV):
    w(line.rstrip("\n"))
open("README.md", "w").write("\n".join(out) + "\n")
print("README.md written,", len(out), "lines")
