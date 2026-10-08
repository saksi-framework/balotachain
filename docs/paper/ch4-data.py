"""Refresh the run-derived numbers in ch4-data.json and redraw the Chapter IV figures.

Usage (from the repo root):  python docs/paper/ch4-data.py
Then:                        NODE_PATH="$(npm root -g)" node docs/paper/build-ch4.js

ch4-data.json holds two kinds of content:
  * hand-kept entries (sources, pending markers, figures quoted from tier notes, the
    paper's baselines), each with its own "source" string; this script never edits them;
  * "auto" blocks, recomputed here from the run files named in each entry's "source".
To add a night's results: put the campaign's zip (or run folder) path in that tier's
"source", drop its "pending" text, and re-run both commands.
"""
import csv
import io
import json
import os
import statistics
import subprocess
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(HERE, "ch4-data.json")
FIG = os.path.join(HERE, "ch4-figures")
ARRIVAL_WINDOW_S = 36000  # ten-hour voting window (paper, Performance section)


# ---------- loading a campaign or run folder as {relative path: bytes} ----------

def load_bundle(src):
    if "git" in src:
        raw = subprocess.run(
            ["git", "-C", REPO, "archive", "--format=zip", src["git"], src["path"]],
            check=True, capture_output=True).stdout
        zf = zipfile.ZipFile(io.BytesIO(raw))
        pre = src["path"].rstrip("/") + "/"
        return {n[len(pre):]: zf.read(n) for n in zf.namelist()
                if n.startswith(pre) and not n.endswith("/") and "/superseded/" not in "/" + n[len(pre):]}
    if "zip" in src:
        zf = zipfile.ZipFile(src["zip"])
        return {n: zf.read(n) for n in zf.namelist() if not n.endswith("/")}
    root = src["dir"]  # a single run folder: top-level files only (skips ledger/ and scenarios/)
    skip = ("ballots", "latencies", "receipts.csv", "ground-truth-ballots", "election.csv")
    return {f: open(os.path.join(root, f), "rb").read() for f in os.listdir(root)
            if os.path.isfile(os.path.join(root, f)) and f.endswith((".csv", ".json", ".ndjson"))
            and not f.startswith(skip)}


def text(b):
    return b.decode("utf-8", errors="replace")


def rows(b):
    return list(csv.DictReader(io.StringIO(text(b))))


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def journal(b):
    out = []
    for line in text(b).splitlines():
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def run_wall_s(events):
    from datetime import datetime
    ts = [datetime.fromisoformat(e["ts"].replace("Z", "+00:00")) for e in events if e.get("ts")]
    return (max(ts) - min(ts)).total_seconds() if ts else None


# ---------- campaign summary ----------

SUMMARY_KEYS = [
    "committed_tps", "driver_ceiling_tps", "latency_p50_ms", "latency_p95_ms", "latency_p99_ms",
    "gen_wall_ms", "gen_cpu_ms", "proof_gen_cpu_ms", "proof_verify_inproc_ms", "aggregate_inproc_ms",
    "combine_inproc_ms", "decrypt_inproc_ms", "submit_window_ms", "committed", "dropped",
    "peak_cpu_pct_peer", "peak_cpu_pct_orderer", "peak_cpu_pct_client",
    "peak_mem_mb_peer", "peak_mem_mb_orderer", "peak_mem_mb_client", "verify_threads",
    "runs_measured", "runs_failed", "failure_rate", "plateau_tps",
]


def campaign_auto(bundle, voters, positions):
    a = {}
    summ = {r["metric"]: r for r in rows(bundle["summary.csv"])} if "summary.csv" in bundle else {}
    for k in SUMMARY_KEYS:
        if k in summ:
            a[k] = {s: num(summ[k][s]) for s in ("min", "median", "mean", "p99", "stddev", "n")}
    camp = json.loads(bundle["campaign.json"]) if "campaign.json" in bundle else None
    run_ids = sorted({p.split("/")[0] for p in bundle if p.count("/") == 1 and p.endswith("/run.json")})
    measured = run_ids
    if camp:
        a["campaign"] = camp["id"]
        a["warmups"] = camp["options"].get("warmups")
        a["measured"] = camp["options"].get("reps")
        mreps = [r for r in camp["reps"] if r["kind"] == "measured"]
        measured = [r["run_id"] for r in mreps]
        host = guest = 0
        hmax = None
        for r in mreps:
            hs = [r.get(k) or {} for k in ("host_start", "host_end")]
            hc = [h.get("host_cpu_pct") for h in hs if h.get("host_cpu_pct") is not None]
            gl = [h.get("guest_load1") for h in hs if h.get("guest_load1") is not None]
            host += any(x > 25 for x in hc)
            guest += any(x > 4.0 for x in gl)
            if hc:
                hmax = max(hc + ([hmax] if hmax is not None else []))
        a["contended_host"], a["contended_guest"], a["host_cpu_max"] = host, guest, hmax
    # correctness over every repetition in the bundle, warm-ups included
    contests = ledger_rows = runs = 0
    emax, allpass, lml = 0, True, True
    dropped = 0
    for rid in run_ids:
        if f"{rid}/correctness.csv" not in bundle:
            continue
        runs += 1
        for r in rows(bundle[f"{rid}/correctness.csv"]):
            contests += 1
            emax = max(emax, int(r["E"]))
            allpass &= r["pass"] == "true"
            if r["source"] == "ledger":
                ledger_rows += 1
                lml &= r["ledger_matches_local"] == "true"
        for p in rows(bundle.get(f"{rid}/perf.csv", b"")):
            dropped += int(num(p.get("dropped")) or 0)
    a["correctness"] = {"runs": runs, "contest_rows": contests, "ledger_rows": ledger_rows,
                        "E_max": emax, "all_pass": allpass, "ledger_matches_local": lml,
                        "dropped_total": dropped}
    first = next((r for r in measured if f"{r}/correctness.csv" in bundle), None)
    if first:  # Appendix C accuracy form: first measured repetition, verifier over the local record
        a["accuracy_sample"] = {"run": first, "rows": [
            [r["contest"], int(r["ground_truth"]), int(r["decoded"]), int(r["E"])]
            for r in rows(bundle[f"{first}/correctness.csv"]) if r["source"] == "local"]}
    walls, verify_ok, sl = [], True, {}
    for rid in measured:
        if f"{rid}/journal.ndjson" in bundle:
            ev = journal(bundle[f"{rid}/journal.ndjson"])
            walls.append(run_wall_s(ev))
            for e in ev:
                if e.get("event") == "run.end":
                    k = str(e.get("scaling_limit"))
                    sl[k] = sl.get(k, 0) + 1
            ends = [e for e in ev if e.get("event") == "stage.verify.end"]
            verify_ok &= bool(ends) and ends[-1].get("overall") == "pass"
    walls = [w for w in walls if w]
    a["wall_h_per_run_median"] = statistics.median_low(walls) / 3600 if walls else None
    a["verify_overall_pass"] = verify_ok
    a["scaling_limit_counts"] = sl
    a["arrival_voters_per_s"] = voters / ARRIVAL_WINDOW_S
    a["arrival_records_per_s"] = voters * positions / ARRIVAL_WINDOW_S
    tps = a.get("committed_tps", {}).get("median")
    a["arrival_margin"] = tps / a["arrival_records_per_s"] if tps else None
    return a


# ---------- security run ----------

def security_auto(bundle, rid):
    key = next(p for p in bundle if p.endswith("negative-tests.csv"))
    pre = key[:-len("negative-tests.csv")]
    g = lambda f: bundle[pre + f]
    verdicts = []
    for r in rows(g("negative-tests.csv")):
        if r["scenario"] == "summary":
            summary = {"attempted": int(r["attempted"]), "rejected": int(r["rejected"]), "rate": r["rate"]}
            continue
        verdicts.append({k: r[k] for k in ("scenario", "stage", "verdict", "live", "gate_expected",
                                           "gate_observed", "election_status", "ballots_committed")})
    corr = rows(g("correctness.csv"))
    ev = journal(g("journal.ndjson"))
    trustee = [e["mono_ms"] for e in ev if e.get("event") == "stage.ceremony.trustee.end"]
    partials = [e.get("partials") for e in ev if e.get("event") == "stage.ceremony.trustee.start"]
    pub = [e for e in ev if e.get("event") == "stage.ceremony.publish.start"]
    end = [e for e in ev if e.get("event") == "run.end"][-1]
    ver = [e for e in ev if e.get("event") == "stage.verify.end"][-1]
    sm = json.loads(g("submit-metrics.json"))
    tm = json.loads(g("timings.json"))
    return {"run": rid, "verdicts": verdicts, "summary": summary,
            "contests": len({r["contest"] for r in corr}), "E_max": max(int(r["E"]) for r in corr),
            "all_pass": all(r["pass"] == "true" for r in corr),
            "ledger_matches_local": all(r["ledger_matches_local"] == "true" for r in corr if r["source"] == "ledger"),
            "committed": sm["committed"], "dropped": sm["dropped"],
            "trustee_submit_ms": trustee, "partials_per_trustee": partials[0] if partials else None,
            "publish_signers": pub[-1]["submitted"] if pub else None, "threshold": pub[-1]["threshold"] if pub else None,
            "verify": ver.get("overall"), "failed_checks": ver.get("failed_checks"),
            "ledger_audit": end.get("ledger_audit"), "verify_ballots_ms": tm.get("verify_ballots"),
            "verify_threads": tm.get("verify_threads")}


# ---------- candidate-count fit ----------

def linfit(xs, ys):
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    a = my - b * mx
    ss = sum((y - my) ** 2 for y in ys)
    r2 = 1 - sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys)) / ss if ss else 1.0
    return {"intercept": a, "slope": b, "r2": r2}


def candidates_auto(points):
    out = {"points": [], "fits": {}}
    for p in points:
        a = p["auto"]
        rec = a["committed"]["median"]
        out["points"].append({
            "candidates": p["candidates"], "campaign": a.get("campaign"),
            "gen_cpu_ms_per_record": a["gen_cpu_ms"]["median"] / rec,
            "proof_gen_cpu_ms_per_record": a["proof_gen_cpu_ms"]["median"] / rec,
            "verify_ms_per_record": a["proof_verify_inproc_ms"]["median"] / rec,
            "submit_ms_per_record": a["submit_window_ms"]["median"] / rec,
            "latency_p50_ms": a["latency_p50_ms"]["median"],
            "committed_tps": a["committed_tps"]["median"],
            "contended_host": a.get("contended_host")})
    xs = [p["candidates"] for p in out["points"]]
    for k in ("gen_cpu_ms_per_record", "proof_gen_cpu_ms_per_record", "verify_ms_per_record",
              "submit_ms_per_record", "latency_p50_ms"):
        out["fits"][k] = linfit(xs, [p[k] for p in out["points"]])
    return out


# ---------- figure points for tiers whose runs are separate single-run campaigns ----------

def figure_auto(paths):
    """Median per metric, the chapter's convention: one summary.csv -> its own median column;
    several (one per single-run campaign) -> lower middle of their medians (median_low)."""
    out = {}
    for k in ("committed_tps", "latency_p50_ms", "latency_p99_ms"):
        vals = [num({r["metric"]: r for r in rows(open(os.path.join(REPO, p), "rb").read())}[k]["median"])
                for p in paths]
        out[k] = statistics.median_low(vals)
    out["n_summaries"] = len(paths)
    return out


# ---------- figures ----------

def figures(d):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    os.makedirs(FIG, exist_ok=True)
    plt.rcParams.update({"font.family": "Arial", "font.size": 9, "axes.spines.top": False,
                         "axes.spines.right": False})
    # one series per (host, ballot shape); the two machines are never pooled
    series, extras = {}, []
    for t in d["tiers"]:
        a = t.get("auto")
        if a and t["mode"] == "onchain" and "committed_tps" in a:
            series.setdefault(("desktop", t["name"][:2]), []).append(
                (t["voters"], a["committed_tps"]["median"], a["latency_p99_ms"]["median"]))
    for f in d.get("figure_tiers", []):
        a = f["auto"]
        pt = (f["voters"], a["committed_tps"], a["latency_p99_ms"])
        if f.get("separate"):
            extras.append((f, pt))
        else:
            series.setdefault((f["host"], f["name"][:2]), []).append(pt)
    styles = {("desktop", "SP"): dict(marker="o", color="#1f4e79", label="Desktop, single-position"),
              ("desktop", "MP"): dict(marker="s", color="#b05a00", linestyle="--", label="Desktop, three-position"),
              ("ax42", "MP"): dict(marker="^", color="#4f7f3a", linestyle="-.", label="AX42, three-position")}
    for key, idx, ylab, fname in (("tps", 1, "Committed TPS (median)", "fig-4-1-tps.png"),
                                  ("p99", 2, "Latency p99, ms (median)", "fig-4-2-p99.png")):
        fig, ax = plt.subplots(figsize=(5.2, 2.9), dpi=200)
        for s, style in styles.items():
            pts = sorted(series.get(s, []))
            if pts:
                ax.plot([p[0] for p in pts], [p[idx] for p in pts], **style)
        for f, pt in extras:
            st = styles[(f["host"], f["name"][:2])]
            ax.plot([pt[0]], [pt[idx]], marker=st["marker"], color=st["color"], markerfacecolor="white",
                    linestyle="none", label=f["label"])
        ax.set_xscale("log")
        ax.set_xlabel("Voters per election (log scale)")
        ax.set_ylabel(ylab)
        ax.set_ylim(bottom=0)
        ax.grid(True, which="major", linewidth=0.4, alpha=0.5)
        ax.legend(frameon=False, fontsize=6.5)
        fig.tight_layout()
        fig.savefig(os.path.join(FIG, fname))
        plt.close(fig)
    c = d["candidates"]["auto"]
    fig, ax = plt.subplots(figsize=(5.2, 2.9), dpi=200)
    xs = [p["candidates"] for p in c["points"]]
    for k, lab, m, col in (("gen_cpu_ms_per_record", "Generation CPU (all threads)", "o", "#1f4e79"),
                           ("proof_gen_cpu_ms_per_record", "Proof generation CPU", "^", "#4f7f3a"),
                           ("submit_ms_per_record", "Submission window", "s", "#b05a00"),
                           ("verify_ms_per_record", "Verification (16 threads, wall)", "D", "#6b4c9a")):
        ax.plot(xs, [p[k] for p in c["points"]], marker=m, color=col, label=lab)
        f = c["fits"][k]
        ax.plot([0, max(xs)], [f["intercept"], f["intercept"] + f["slope"] * max(xs)], color=col, linewidth=0.6, linestyle=":")
    ax.set_xlabel("Candidates per position (MP-1K, 3 positions)")
    ax.set_ylabel("ms per ballot record")
    ax.set_xlim(0, max(xs) + 1)
    ax.set_ylim(bottom=0)
    ax.grid(True, linewidth=0.4, alpha=0.5)
    ax.legend(frameon=False, fontsize=7)
    fig.tight_layout()
    fig.savefig(os.path.join(FIG, "fig-4-3-candidates.png"))
    plt.close(fig)


def main():
    d = json.load(open(DATA, encoding="utf-8"))
    for t in d["tiers"]:
        if t.get("source"):
            t["auto"] = campaign_auto(load_bundle(t["source"]), t["voters"], t["positions"])
        else:
            t.pop("auto", None)
    pts = []
    for p in d["candidates"]["points"]:
        src = p["source"]
        if "tier" in src:
            auto = next(t["auto"] for t in d["tiers"] if t["name"] == src["tier"])
        else:
            auto = campaign_auto(load_bundle(src), 1000, 3)
        pts.append({"candidates": p["candidates"], "auto": auto})
    d["candidates"]["auto"] = candidates_auto(pts)
    for s in d["security_runs"]:
        if s.get("source"):
            s["auto"] = security_auto(load_bundle(s["source"]), s["run"])
    for f in d.get("figure_tiers", []):
        f["auto"] = figure_auto(f["summaries"])
    json.dump(d, open(DATA, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    figures(d)
    print("ok:", sum(1 for t in d["tiers"] if t.get("auto")), "tiers with data")


if __name__ == "__main__":
    main()
