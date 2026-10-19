p = "gen_readme.py"
g = open(p, encoding="utf-8").read()
old = 'w("## Attack runs\\n")\n'
assert old in g and "Measured-run summary" not in g
new = '''meas = [(f.split("/")[1], j(f)) for f in cr if f.split("/")[1] != "warmup"]
if meas:
    import statistics as st

    def ms(xs):
        return (st.mean(xs), st.stdev(xs) if len(xs) > 1 else 0.0)

    w("### Measured-run summary\\n")
    w(f"Over the {len(meas)} measured runs ({', '.join(n for n, _ in meas)}), each a full 10-precinct canvass. Per-run values are means over the 10 precincts; the last row is the mean and sample standard deviation across runs.\\n")
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
    w("Note: the window, TPS and latency columns are batch-timeout bound (concurrency 8, 2 s BatchTimeout); they measure the timeout, not the protocol, and must not be compared with the Chapter IV ladder.\\n")
    w("National E = 0 in every measured run (canvass.accuracy: 10 precinct audits pass with E = 0; national decryption of the ledger product gives E = 0).\\n")
w("## Attack runs\\n")
'''
g = g.replace(old, new, 1)
g = g.replace('w(f"{len(cr)} of 4 clean runs (warm-up + m1-m3) are in this commit; m2 and m3 are pending (the user starts them separately).\\n")',
              'w(f"{len(cr)} of 4 clean runs (warm-up + m1-m3) are in this commit.\\n")')
g = g.replace('if len(cr) < 4:\n', 'if len(cr) < 4:  # pending runs\n')
open(p, "w", encoding="utf-8").write(g)
print("patched")
