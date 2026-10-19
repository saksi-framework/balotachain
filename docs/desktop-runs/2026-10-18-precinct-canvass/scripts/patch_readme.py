p = "gen_readme.py"
g = open(p, encoding="utf-8").read()

def rep(old, new):
    global g
    assert old in g, old[:60]
    g = g.replace(old, new, 1)

rep('w("## Clean canvass runs\\n")\n', '''w("## Clean canvass runs\\n")
w("> **Batch-timeout note.** The TPS and latency figures in these tables come from the driver's fixed concurrency 8 over blocks cut by the 2 s BatchTimeout "
  "(MaxMessageCount 50 is never reached): 8 / 2.029 s = 3.943, against `driver_ceiling_tps` 3.943 and committed 3.942. "
  "They measure the batch timeout, not the protocol, and must not be compared with the Chapter IV ladder.\\n")
''')

rep('''{p['audit']} | {p['close_block']} |")
    w("")
''', '''{p['audit']} | {p['close_block']} |")
    w("")
    w("Note: the window, TPS and latency columns are batch-timeout bound (concurrency 8, 2 s BatchTimeout; see the note above).\\n")
''')

rep('''w("- `tools/security/canvass/selftest.sh` against this `saksi-demo`: 11/11 file scenarios PASS.\\n")
''', '''w("- `tools/security/canvass/selftest.sh` against this `saksi-demo`: 11/11 file scenarios PASS.\\n")
w("### How to verify the build\\n")
w("`build-verification.txt` records what was checked on the desktop after the runs (fix round 1, 2026-10-18):\\n")
w("- `git -C ~/Code/saksi rev-parse HEAD` = `0cdc3350f4275936c8be560b67e04049257e16f9` (\\"Merge pull request #61 from saksi-framework/feat/precinct-canvass\\"), with a clean working tree;")
w("- `git -C ~/balotachain rev-parse 20d9860` = `20d9860bc4e890ef4486890a4bf8c8cdc5c28341`, the parent of the first evidence commit on this branch;")
w("- the four binaries re-hashed with `sha256sum` and diffed against `binary-sha256.txt`: identical. They were built at 03:14 (+08:00), before the first run, and not rebuilt.\\n")
w("To check independently: clone saksi, `git checkout 0cdc335` and build as in `scripts/build.sh` (go1.23.4 linux/amd64, rustup stable). Rust and Go builds are not bit-reproducible across toolchains, so the digests identify the binaries that produced this folder; they do not promise a rebuild matches.\\n")
''')

rep('w("## Deviations and environment fixes\\n")', '''IDX = {
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
w("## Scripts\\n")
w("The scripts that drove these runs, copied as run into `scripts/` (paths are the desktop's). m1 was run by `clean.sh m1` after `chain3.sh` stopped:\\n")
for f in sorted(os.listdir("scripts")):
    w(f"- `scripts/{f}`: {IDX.get(f, 'helper')}")
w("")
w("## Deviations and environment fixes\\n")''')

open(p, "w", encoding="utf-8").write(g)
print("patched")
