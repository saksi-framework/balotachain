#!/usr/bin/env python3
"""Predictive cost model for the instrument-gap run table (rows 2-9).

Fits the per-stage costs of a campaign run from the run artifacts that already
exist, predicts wall time for every tier in the plan's run table, and puts the
ACTUAL beside the prediction for every tier that has been run.

    T_run(n, p) = n*p*(g + s + v) + L(p) + c0

Python 3 standard library only: no numpy, no scipy. Least squares is solved by
the normal equations; Student-t critical values come from a small hard-coded
two-sided 95 % table.

The runs tree (default: the WSL2 tree over the 9p share from Windows; pass
`--runs` inside WSL) holds every regime ever measured -- default and b50-t2s
orderer parameters, several saksi builds. A regime is (verify_threads,
orderer_batch, saksi commit); if one cost class spans more than one, the script
refuses to fit and names them. `--match GLOB` (repeatable) keeps only run
folders whose name matches one of the globs; it is also the only way to split
two orderer configurations run on one commit while `orderer_batch` is not yet
recorded in the journal. The rows 2-4 b50-t2s refit, inside WSL:

    python3 cost_model.py --runs /home/user/.saksi/campaign/runs \
        --runs /home/user/.saksi/campaign/runs-offline \
        --match 'sp-*-b50-*' --match 'mp-*-b50-*' --match 'offline-*' \
        --fit-concurrency 128 --out cost-model.md

The output is deterministic: it carries no wall-clock timestamp, so rerunning it
after new runs land produces a diff only where the numbers actually moved.
"""

import argparse
import csv
import datetime
import fnmatch
import json
import math
import os
import shlex
import statistics
import sys

# --------------------------------------------------------------------------
# Defaults
# --------------------------------------------------------------------------

# The campaign writes here inside WSL2 Ubuntu. From Windows the same tree is
# reachable over the 9p share; both UNC spellings work (\\wsl$\ and
# \\wsl.localhost\), the latter is the documented one.
_WSL_UNC = "\\\\wsl.localhost\\Ubuntu\\home\\user\\.saksi\\campaign"
DEFAULT_RUN_DIRS = [_WSL_UNC + "\\runs", _WSL_UNC + "\\runs-offline"]

# The plan's run table, rows 2-9. reps = warm-ups + measured, because machine
# time pays for both. `kind` selects which fitted coefficient set applies.
#   row, label, voters, positions, reps, kind
TIERS = [
    (2, "SP-1K",         1_000,     1, 2 + 10, "onchain"),
    (2, "MP-1K",         1_000,     3, 2 + 10, "onchain"),
    (3, "SP-10K",       10_000,     1, 2 + 10, "onchain"),
    (3, "MP-10K",       10_000,     3, 2 + 10, "onchain"),
    (4, "SP-50K",       50_000,     1, 2 + 5,  "onchain"),
    (4, "MP-50K",       50_000,     3, 2 + 5,  "onchain"),
    (5, "SP-483K",     483_000,     1, 1 + 3,  "onchain"),
    (6, "SP-1M",     1_000_000,     1, 1 + 3,  "onchain"),
    (7, "SP-1.92M",  1_920_000,     1, 1 + 1,  "onchain"),
    (7, "SP-3.5M",   3_500_000,     1, 1 + 1,  "onchain"),
    (8, "MP-483K offline",   483_000, 3, 1, "offline"),
    (8, "MP-1M offline",   1_000_000, 3, 1, "offline"),
    (8, "MP-1.92M offline", 1_920_000, 3, 1, "offline"),
    (8, "MP-3.5M offline", 3_500_000, 3, 1, "offline"),
    (9, "MP-3.5M on-chain", 3_500_000, 3, 1, "onchain"),
]

# Run-id prefixes that are tuning probes / gate runs, not run-table reps.
PROBE_PREFIXES = ("probe", "validation-ladder", "warmcheck")

# The concurrency sweep chose 96 for row 2 and 192 for row 3. Anything below
# this floor (the superseded c=8 reps, the low probes) is a different regime for
# `s` and is excluded entirely.
MIN_CONCURRENCY = 96

# `s` is a function of the driver concurrency, so the fit is taken at ONE
# concurrency. Runs at any other concurrency still supply ACTUALs -- they are
# then an out-of-sample test of the fit rather than part of it.
FIT_CONCURRENCY = (96,)

# --------------------------------------------------------------------------
# Statistics (stdlib only)
# --------------------------------------------------------------------------

# Two-sided 95 % Student-t critical values. For a df not in the table we take
# the largest tabulated df <= the real one, which overstates t and so widens the
# interval: conservative, never optimistic.
T95 = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365,
    8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145,
    15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
    21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056,
    27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042, 40: 2.021, 50: 2.009,
    60: 2.000, 80: 1.990, 100: 1.984, 120: 1.980,
}


def t_crit(df):
    """Two-sided 95 % t critical value for `df` degrees of freedom."""
    if df <= 0:
        return None
    if df in T95:
        return T95[df]
    if df > 120:
        return 1.960
    return T95[max(k for k in T95 if k <= df)]


class Fit:
    """A single fitted coefficient: point estimate, 95 % half-width, df."""

    def __init__(self, name, unit, beta, half, df, n, sources):
        self.name, self.unit = name, unit
        self.beta, self.half, self.df, self.n = beta, half, df, n
        self.sources = sources

    def __str__(self):
        if self.half is None:
            return "%.4g %s (no CI, %d point%s)" % (
                self.beta, self.unit, self.n, "" if self.n == 1 else "s")
        return "%.4g +/- %.4g %s (95 %%, df=%d, n=%d)" % (
            self.beta, self.half, self.unit, self.df, self.n)


def ols_through_origin(name, unit, pairs):
    """y = beta*x by least squares with no intercept (the intercept is c0).

    Normal equation for the one-parameter model: beta = sum(xy) / sum(x^2).
    Var(beta) = sigma^2 / sum(x^2) with sigma^2 = RSS / (n - 1).
    `pairs` is a list of (x, y, run_id).
    """
    n = len(pairs)
    if n == 0:
        return Fit(name, unit, float("nan"), None, 0, 0, [])
    sxx = sum(x * x for x, _, _ in pairs)
    sxy = sum(x * y for x, y, _ in pairs)
    beta = sxy / sxx if sxx else float("nan")
    ids = [rid for _, _, rid in pairs]
    if n < 2:
        return Fit(name, unit, beta, None, 0, n, ids)
    rss = sum((y - beta * x) ** 2 for x, y, _ in pairs)
    df = n - 1
    var = (rss / df) / sxx
    return Fit(name, unit, beta, t_crit(df) * math.sqrt(var), df, n, ids)


def mean_ci(name, unit, vals, ids=None):
    """Mean of `vals` with a 95 % t interval on the mean."""
    n = len(vals)
    if n == 0:
        return Fit(name, unit, float("nan"), None, 0, 0, [])
    m = statistics.fmean(vals)
    if n < 2:
        return Fit(name, unit, m, None, 0, n, ids or [])
    sd = statistics.stdev(vals)
    df = n - 1
    return Fit(name, unit, m, t_crit(df) * sd / math.sqrt(n), df, n, ids or [])


# --------------------------------------------------------------------------
# Artifact loading
# --------------------------------------------------------------------------

def _json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _ts(s):
    return datetime.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")


def _f(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def load_run(path):
    """Read one run folder into a flat dict, or None if it is not usable.

    A run is usable when it has run.json, a perf.csv row, and a `run.end`
    journal event (which is what makes a folder complete rather than in-flight
    while another executor is still writing it).
    """
    rid = os.path.basename(path.rstrip("\\/"))
    try:
        rj = _json(os.path.join(path, "run.json"))
        cfg = rj["config"]
    except (OSError, KeyError, ValueError):
        return None
    commit = rj.get("commit")
    if isinstance(commit, dict):
        commit = commit.get("git_head_saksi") or commit.get("git_head_console")

    events = []
    try:
        with open(os.path.join(path, "journal.ndjson"), encoding="utf-8",
                  errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except ValueError:
                        pass
    except OSError:
        return None

    by = {}
    for e in events:
        by.setdefault(e.get("event"), []).append(e)
    if "run.start" not in by or "run.end" not in by:
        return None

    perf = None
    try:
        with open(os.path.join(path, "perf.csv"), encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        perf = rows[0] if rows else None
    except OSError:
        pass
    if perf is None:
        return None

    def stage_ms(name):
        return sum(e.get("mono_ms", 0) for e in by.get("stage.%s.end" % name, []))

    timings = {}
    tp = os.path.join(path, "timings.json")
    if os.path.exists(tp):
        timings = _json(tp)
    gen = {}
    gp = os.path.join(path, "gen-timings.json")
    if os.path.exists(gp):
        gen = _json(gp)

    # tau: the orderer's per-transaction cost for the lifecycle. Lifecycle rows
    # are every receipt that is not a SubmitBallot; the median consecutive gap
    # discards the one gap that spans the whole ballot window.
    life, tau = [], None
    rp = os.path.join(path, "receipts.csv")
    if os.path.exists(rp):
        with open(rp, encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                if row.get("event") != "SubmitBallot":
                    life.append(_ts(row["timestamp"]))
    if len(life) > 2:
        gaps = [(life[i + 1] - life[i]).total_seconds() for i in range(len(life) - 1)]
        tau = statistics.median(gaps)

    records = cfg["voters"] * cfg["positions"]
    window_ms = _f(perf.get("submit_window_ms"))
    verify_total = stage_ms("verify")
    audit_ms = sum(_f(timings.get(k)) or 0.0
                   for k in ("verify_ballots", "aggregate", "combine", "decode"))

    # Two independent axes decide what a run costs, and `mode` alone settles
    # neither: `mode: offline` against a Fabric-wired console still transacts
    # (row2.md §8) AND drops one of the two audit passes. Such a hybrid belongs
    # to neither coefficient set -- it has a submission window like an on-chain
    # run but a `v_dump` near zero like an offline one -- so it is classified
    # "other" and left out of both fits.
    mode = cfg.get("mode")
    transacts = window_ms is not None
    if mode == "onchain" and transacts:
        klass = "onchain"
    elif mode == "offline" and not transacts:
        klass = "offline"
    else:
        klass = "other"

    return {
        "id": rid,
        "path": path,
        "mode": mode,
        "klass": klass,
        "voters": cfg["voters"],
        "positions": cfg["positions"],
        "candidates": cfg["candidates"],
        "trustees": len(cfg.get("trustees", [])),
        "concurrency": cfg.get("concurrency"),
        "rep_kind": cfg.get("rep", {}).get("kind"),
        "records": records,
        "onchain": klass == "onchain",
        "wall_ms": (_ts(by["run.end"][0]["ts"]) - _ts(by["run.start"][0]["ts"]))
        .total_seconds() * 1000.0,
        "gen_wall_ms": _f(gen.get("wall_ms")),
        "submit_window_ms": window_ms,
        "committed_tps": _f(perf.get("committed_tps")),
        "verify_ms": verify_total,
        "verify_audit_ms": audit_ms,
        "verify_dump_ms": verify_total - audit_ms,
        "lifecycle_tx": len(life),
        "tau_s": tau,
        "failed": str(perf.get("failed", "")).lower() == "true"
        or bool(by["run.end"][0].get("failed")),
        "ceremony_ms": stage_ms("ceremony"),
        # The regime a run was measured in. Coefficients are never pooled
        # across regimes (see mixed_regimes): the audit term changes with the
        # auditor's thread count, and every term can change with the orderer
        # configuration or the saksi build. Absent verify_threads = the serial
        # auditor = 1; absent orderer_batch = not recorded (runs predate it).
        "verify_threads": int(_f(timings.get("verify_threads"))
                              or _f(perf.get("verify_threads")) or 1),
        "orderer_batch": (json.dumps(by["env"][0]["orderer_batch"], sort_keys=True)
                          if by.get("env") and "orderer_batch" in by["env"][0] else None),
        "commit": commit,
    }


def regime(r):
    return (r["verify_threads"], r["orderer_batch"], r["commit"])


def mixed_regimes(runs):
    """[(class, sorted regimes)] for every cost class whose runs span >1 regime.

    A regime is (verify_threads, orderer_batch, saksi commit). Pooling runs
    from two regimes into one coefficient would fit neither -- the parallel
    auditor alone divides v_audit by ~8 -- so main() refuses instead of fitting.
    """
    by = {}
    for r in runs:
        by.setdefault(r["klass"], set()).add(regime(r))
    return [(k, sorted(v, key=str)) for k, v in sorted(by.items()) if len(v) > 1]


def collect(run_dirs, include_probes=False, min_concurrency=MIN_CONCURRENCY, match=None):
    """Load every run folder under `run_dirs`; return (kept, skipped).

    `match`, when given, is a list of globs: folders whose name matches none of
    them are not read at all (and not listed as skipped -- they are another
    regime, not a defect).
    """
    kept, skipped = [], []
    for root in run_dirs:
        if not os.path.isdir(root):
            skipped.append((root, "run dir not present"))
            continue
        for name in sorted(os.listdir(root)):
            path = os.path.join(root, name)
            if not os.path.isdir(path):
                continue
            if match and not any(fnmatch.fnmatch(name, g) for g in match):
                continue
            r = load_run(path)
            if r is None:
                skipped.append((name, "incomplete (no run.end / perf row) - "
                                      "in flight or interrupted"))
                continue
            if r["failed"]:
                skipped.append((name, "failed run"))
            elif r["rep_kind"] != "measured":
                skipped.append((name, "rep kind = %s" % r["rep_kind"]))
            elif not include_probes and name.startswith(PROBE_PREFIXES):
                skipped.append((name, "tuning probe / gate run"))
            elif r["klass"] == "other":
                skipped.append((name, "mode=%s but %stransacting (Fabric-wired "
                                      "offline / ground truth: neither cost class)"
                                % (r["mode"], "" if r["submit_window_ms"] is not None
                                   else "non-")))
            elif r["onchain"] and (r["concurrency"] or 0) < min_concurrency:
                skipped.append((name, "concurrency %s < %d (superseded regime)"
                                % (r["concurrency"], min_concurrency)))
            else:
                kept.append(r)
    return kept, skipped


# --------------------------------------------------------------------------
# The fit
# --------------------------------------------------------------------------

class Model:
    def __init__(self, runs, tau_s, g, s, va, vd, c0, stalled):
        self.runs, self.tau_s = runs, tau_s
        self.g, self.s, self.va, self.vd, self.c0 = g, s, va, vd, c0
        self.stalled = stalled

    @property
    def per_record_ms(self):
        return self.g.beta + self.s.beta + self.va.beta + self.vd.beta

    def lifecycle_ms(self, positions, trustees=5, candidates=4):
        if self.tau_s is None:
            return 0.0
        return self.tau_s * 1000.0 * (4 + trustees * positions * candidates)

    def predict_ms(self, voters, positions):
        m = voters * positions
        return m * self.per_record_ms + self.lifecycle_ms(positions) + self.c0.beta

    def moe_ms(self, voters, positions):
        """First-order propagation of the coefficient 95 % half-widths.

        T = m*(g+s+va+vd) + L + c0, so dT/dg = m and dT/dc0 = 1; treating the
        coefficient errors as independent,
            MoE(T) = sqrt( (m*dg)^2 + (m*ds)^2 + (m*dva)^2 + (m*dvd)^2 + dc0^2 )
        L is treated as exact (tau is the median of gaps that are the orderer's
        configured BatchTimeout, not a noisy measurement).
        """
        m = voters * positions
        terms = []
        for f in (self.g, self.s, self.va, self.vd):
            terms.append((m * (f.half or 0.0)) ** 2)
        terms.append((self.c0.half or 0.0) ** 2)
        return math.sqrt(sum(terms))


def fit(runs, onchain, fit_concurrency=FIT_CONCURRENCY):
    """Fit the model over the measured runs of one class (on-chain / offline).

    On-chain, only runs at a concurrency in `fit_concurrency` enter the fit
    (`None` = all of them); `s` is not concurrency-independent, so pooling two
    tuned settings would fit neither.
    """
    pool = [r for r in runs if r["onchain"] == onchain]
    if onchain and fit_concurrency:
        pool = [r for r in pool if r["concurrency"] in fit_concurrency]
    taus = [r["tau_s"] for r in pool if r["tau_s"]]
    tau = statistics.median(taus) if (onchain and taus) else None

    g = ols_through_origin("g", "ms/record",
                           [(r["records"], r["gen_wall_ms"], r["id"])
                            for r in pool if r["gen_wall_ms"] is not None])
    if onchain:
        s = ols_through_origin("s", "ms/record",
                               [(r["records"], r["submit_window_ms"], r["id"])
                                for r in pool])
    else:
        s = Fit("s", "ms/record", 0.0, 0.0, 0, 0, [])
    va = ols_through_origin("v_audit", "ms/record",
                            [(r["records"], r["verify_audit_ms"], r["id"])
                             for r in pool])
    vd = ols_through_origin("v_dump", "ms/record",
                            [(r["records"], r["verify_dump_ms"], r["id"])
                             for r in pool])

    per_rec = g.beta + s.beta + va.beta + vd.beta
    resid, ids = [], []
    for r in pool:
        lif = (tau * 1000.0 * (4 + r["trustees"] * r["positions"] * r["candidates"])
               if tau else 0.0)
        resid.append(r["wall_ms"] - r["records"] * per_rec - lif)
        ids.append(r["id"])
    c0 = mean_ci("c0", "ms", resid, ids)

    # Runs whose submission window ran far below their tier's median: the
    # multi-second-stall reps. Flagged, never dropped. Detected over every
    # measured on-chain run, not just the fitted ones, so held-out tiers still
    # get their stalls reported.
    stalled = []
    if onchain:
        by_tier = {}
        for r in [x for x in runs if x["onchain"]]:
            by_tier.setdefault((r["voters"], r["positions"]), []).append(r)
        for tier, rs in by_tier.items():
            med = statistics.median([x["committed_tps"] or 0 for x in rs])
            for r in rs:
                if med and (r["committed_tps"] or 0) < 0.5 * med:
                    stalled.append(r)
    return Model(pool, tau, g, s, va, vd, c0, stalled)


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

H = 3_600_000.0  # ms per hour


def _hours(ms):
    return ms / H


def actuals(runs, voters, positions, onchain):
    return [r for r in runs
            if r["voters"] == voters and r["positions"] == positions
            and r["onchain"] == onchain]


def regime_line(rs):
    v, ob, c = regime(rs[0])
    return ("Regime -- shared by every run of this class, because the script refuses "
            "to pool across regimes: `verify_threads` = %d%s, `orderer_batch` = %s, "
            "saksi commit `%s`." % (v, " (serial auditor)" if v == 1 else "",
                                     ("`%s`" % ob) if ob else "not recorded", c))


def render(on, off, runs, skipped, run_dirs, fit_concurrency, invocation=None):
    out = []
    w = out.append

    w("# Cost model for the instrument-gap run table")
    w("")
    w("Generated by `cost_model.py` from the run artifacts. Rerun it after any "
      "new tier lands and it refits; the output carries no timestamp, so the "
      "diff shows only numbers that moved.")
    w("")
    w("Run tree read: " + ", ".join("`%s`" % d for d in run_dirs) + ".")
    w("")
    if invocation:
        w("This file was generated by: `%s`" % invocation)
        w("")

    # ---- (a) the model -------------------------------------------------
    w("## 1. The model")
    w("")
    w("```")
    w("T_run(n, p) = n*p*(g + s + v) + L(p) + c0            [milliseconds]")
    w("")
    w("  n     voters in the tier")
    w("  p     positions on the ballot (SP = 1, MP = 3)")
    w("  n*p   ballot records -- the unit every per-ballot term is charged per")
    w("  g     generate cost, ms/record   = gen-timings.json wall_ms / (n*p)")
    w("  s     submit cost, ms/record     = perf.csv submit_window_ms / (n*p)")
    w("                                   = 1000 / committed_tps   (on-chain only; 0 offline)")
    w("  v     verify cost, ms/record     = v_audit + v_dump")
    w("    v_audit  in-process audit      = timings.json (verify_ballots + aggregate")
    w("                                     + combine + decode) / (n*p)")
    w("    v_dump   ledger dump + 2nd pass = (stage.verify duration - the above) / (n*p)")
    w("  L(p)  fixed on-chain lifecycle   = tau * (4 + trustees * p * candidates)")
    w("        the 4 are CreateElection, PublishDKGTranscript, CloseElection, PublishTally;")
    w("        the rest are one SubmitPartialDecryption per (trustee, position, candidate).")
    w("        Before saksi PR #38 each was alone in its own block and waited out the")
    w("        orderer's BatchTimeout. Since #38 the partials go out concurrently and")
    w("        share blocks, the median receipt gap (tau) is 0, L drops out, and the")
    w("        lifecycle's few remaining BatchTimeout waits are inside c0.")
    w("        L = 0 offline.")
    w("  c0    residual fixed overhead: check, bundle, receipt fetch, ceremony,")
    w("        per-run bookkeeping -- whatever the four per-record terms and L do not explain.")
    w("```")
    w("")
    w("The measured `T_run` on the left-hand side is `run.end` minus `run.start` "
      "from `journal.ndjson`. Those timestamps are second-resolution, so every "
      "measured wall time carries about +/- 1 s of quantisation -- under 2 % of a "
      "58 s SP-1K rep and negligible above that, but it is why `c0` cannot be "
      "pinned tighter than it is. The per-stage timers (`mono_ms`) are "
      "millisecond-resolution, so the four per-record coefficients do not "
      "inherit that error.")
    w("")
    w("Fitting. Each per-record coefficient is a one-parameter least-squares fit "
      "through the origin on its own stage measurement -- the stage timers make "
      "the terms separately observable, so they are not collinear. By the normal "
      "equation for `y = beta*x`:")
    w("")
    w("```")
    w("beta    = sum(x_i * y_i) / sum(x_i^2)          x_i = records, y_i = that stage's ms")
    w("Var(b)  = sigma^2 / sum(x_i^2),  sigma^2 = RSS / (k - 1),  RSS = sum (y_i - b*x_i)^2")
    w("95 % CI = beta +/- t(0.975, k-1) * sqrt(Var(b))")
    w("```")
    w("")
    w("`tau` is the median gap between consecutive lifecycle receipts in "
      "`receipts.csv` (the median discards the one gap that spans the ballot "
      "window). `c0` is then the mean of the per-run residuals")
    w("`c0_i = T_i - records_i*(g+s+v) - L(p_i)`, with the ordinary "
      "`mean +/- t(0.975, k-1) * sd / sqrt(k)` interval; that interval ignores "
      "the covariance with the four fitted slopes, which is the one place this "
      "is a first-order account rather than a full joint fit.")
    w("")
    w("Prediction margin of error, first-order propagation with the coefficient "
      "errors taken as independent (`m = n*p`):")
    w("")
    w("```")
    w("MoE(T) = sqrt( (m*dg)^2 + (m*ds)^2 + (m*dv_audit)^2 + (m*dv_dump)^2 + (dc0)^2 )")
    w("```")
    w("")
    w("`t(0.975, df)` comes from a hard-coded two-sided table in the script; for "
      "a df not tabulated it takes the largest tabulated df below it, which "
      "overstates `t` and widens the interval.")
    w("")

    # ---- (b) coefficients ----------------------------------------------
    w("## 2. Fitted coefficients")
    w("")
    w("### On-chain")
    w("")
    if not on.runs:
        w("No measured on-chain runs found.")
    else:
        w("Fitted at driver concurrency **%s**. Measured runs at any other "
          "concurrency are held out: they supply ACTUALs in sections 3 and 4 "
          "and so test the fit out of sample, but they do not shape it." % (
              ", ".join(str(c) for c in fit_concurrency) if fit_concurrency
              else "all concurrencies pooled"))
        w("")
        w(regime_line(on.runs))
        w("")
        w("| Symbol | Estimate | 95 % CI | df | runs | Source column |")
        w("|---|---|---|---|---|---|")
        for f, src in ((on.g, "`gen-timings.json` `wall_ms`"),
                       (on.s, "`perf.csv` `submit_window_ms`"),
                       (on.va, "`timings.json` sum"),
                       (on.vd, "`stage.verify` minus `timings.json` sum")):
            w("| `%s` | %.4g ms/record | %s | %s | %d | %s |" % (
                f.name, f.beta,
                ("+/- %.4g" % f.half) if f.half is not None else "n/a",
                f.df or "n/a", f.n, src))
        w("| `c0` | %.4g ms | %s | %s | %d | residual of `run.end - run.start` |" % (
            on.c0.beta,
            ("+/- %.4g" % on.c0.half) if on.c0.half is not None else "n/a",
            on.c0.df or "n/a", on.c0.n))
        w("")
        w("`v = v_audit + v_dump = %.4g ms/record`; the four per-record terms sum "
          "to **%.4g ms/record**." % (on.va.beta + on.vd.beta, on.per_record_ms))
        w("")
        if on.tau_s:
            w("`tau = %.2f s` (median lifecycle receipt gap over %d run%s), so "
              "`L(1) = %.0f s` for SP and `L(3) = %.0f s` for MP at 5 trustees "
              "and 4 candidates." % (
                  on.tau_s, len([r for r in on.runs if r["tau_s"]]),
                  "" if len(on.runs) == 1 else "s",
                  on.lifecycle_ms(1) / 1000.0, on.lifecycle_ms(3) / 1000.0))
            w("")
        elif on.runs:
            w("`tau = 0`: the fitted runs' lifecycle receipts share blocks (the "
              "partial decryptions go out concurrently since saksi PR #38), so "
              "the median receipt gap is 0 and `L(p) = 0`. The lifecycle's "
              "remaining `BatchTimeout` waits are part of `c0`.")
            w("")
        w("Fitted from these runs:")
        w("")
        tiers = {}
        for r in on.runs:
            tiers.setdefault((r["voters"], r["positions"]), []).append(r)
        for (v, p), rs in sorted(tiers.items()):
            w("- **%s voters, %s**, c=%s, %d measured rep%s: `%s` ... `%s`" % (
                "{:,}".format(v),
                "1 position" if p == 1 else "%d positions" % p,
                rs[0]["concurrency"], len(rs),
                "" if len(rs) == 1 else "s", rs[0]["id"], rs[-1]["id"]))
        w("")
        by_c = {}
        for r in runs:
            if r["onchain"]:
                by_c.setdefault(r["concurrency"], []).append(r)
        if len(by_c) > 1:
            w("**`s` is not one number across the tuned settings actually used.** "
              "Submission cost per concurrency, over every measured run at that "
              "setting:")
            w("")
            w("| Concurrency | Runs | `s` (ms/record) | In the fit? |")
            w("|---|---|---|---|")
            for c, rs in sorted(by_c.items()):
                f = ols_through_origin("s", "ms/record",
                                       [(r["records"], r["submit_window_ms"], r["id"])
                                        for r in rs])
                w("| %s | %d | %s | %s |" % (
                    c, len(rs), f,
                    "yes" if (not fit_concurrency or c in fit_concurrency) else "held out"))
            w("")
        if on.stalled:
            w("**Stalls.** %d measured on-chain rep%s committed at under half "
              "%s tier's median TPS: the multi-second submission stalls. They "
              "are real machine time and they are not rare, so they are never "
              "dropped -- a prediction that assumed them away would under-call "
              "the campaign. Stalled reps: %s." % (
                  len(on.stalled), "" if len(on.stalled) == 1 else "s",
                  "its" if len(on.stalled) == 1 else "their",
                  ", ".join("`%s` (%.0f TPS vs tier median)" %
                            (r["id"], r["committed_tps"]) for r in on.stalled)))
            w("")
            in_fit = [r for r in on.stalled if r in on.runs]
            if in_fit:
                alt = ols_through_origin(
                    "s", "ms/record",
                    [(r["records"], r["submit_window_ms"], r["id"])
                     for r in on.runs if r not in on.stalled])
                w("%d of them are inside the fit; excluding them would give "
                  "`s = %s` instead of `%s`." % (len(in_fit), alt, on.s))
            else:
                w("None of them is inside the fit -- every stall so far is at a "
                  "held-out concurrency, which is part of why the held-out error "
                  "in section 4 is what it is.")
            w("")
    w("### Offline")
    w("")
    if not off.runs:
        w("No measured offline runs found. Row 8 cannot be predicted.")
    else:
        w("Offline sets `s = 0` and `L = 0`: no submission window, no lifecycle "
          "transactions. **%d offline run%s available**, so %s." % (
              len(off.runs), "" if len(off.runs) == 1 else "s",
              "there are no degrees of freedom left and no confidence interval "
              "can be computed -- these are single-point ratios, not a fit"
              if len(off.runs) < 2 else
              "the intervals below rest on very few points"))
        w("")
        w(regime_line(off.runs))
        w("")
        w("| Symbol | Estimate | 95 % CI | df | runs |")
        w("|---|---|---|---|---|")
        for f in (off.g, off.va, off.vd):
            w("| `%s` | %.4g ms/record | %s | %s | %d |" % (
                f.name, f.beta,
                ("+/- %.4g" % f.half) if f.half is not None else "n/a",
                f.df or "n/a", f.n))
        w("| `c0` | %.4g ms | %s | %s | %d |" % (
            off.c0.beta,
            ("+/- %.4g" % off.c0.half) if off.c0.half is not None else "n/a",
            off.c0.df or "n/a", off.c0.n))
        w("")
        w("From: " + ", ".join("`%s`" % r["id"] for r in off.runs) + ".")
        w("")
        w("Because there is no CI, every offline prediction below carries "
          "`MoE = n/a`. A second true-offline run at another tier would turn "
          "these ratios into a fit with a real interval; until then row 8's "
          "hours are a point estimate on one observation.")
        w("")

    # ---- (c) prediction table -------------------------------------------
    w("## 3. Predictions, rows 2-9")
    w("")
    w("| Row | Tier | p | Ballot records | Reps | Predicted h/run | +/- MoE | "
      "Predicted h, all reps | Actual h/run (median) | Error % |")
    w("|---|---|---|---|---|---|---|---|---|---|")
    for row, label, voters, p, reps, kind in TIERS:
        m = on if kind == "onchain" else off
        if not m.runs:
            w("| %d | %s | %d | %s | %d | no fit | - | - | - | - |" % (
                row, label, p, "{:,}".format(voters * p), reps))
            continue
        pred = m.predict_ms(voters, p)
        moe = m.moe_ms(voters, p)
        act = actuals(runs, voters, p, kind == "onchain")
        if act:
            med = statistics.median([r["wall_ms"] for r in act])
            a_txt = "%.4f (%d rep%s)" % (_hours(med), len(act),
                                         "" if len(act) == 1 else "s")
            e_txt = "%+.1f %%" % ((med - pred) / pred * 100.0)
        else:
            a_txt, e_txt = "not run yet", "-"
        w("| %d | %s | %d | %s | %d | %.4f | %s | %.3f | %s | %s |" % (
            row, label, p, "{:,}".format(voters * p), reps,
            _hours(pred),
            ("%.4f" % _hours(moe)) if moe else "n/a",
            _hours(pred) * reps, a_txt, e_txt))
    w("")
    total = 0.0
    for row, label, voters, p, reps, kind in TIERS:
        m = on if kind == "onchain" else off
        if m.runs and row >= 4:
            total += _hours(m.predict_ms(voters, p)) * reps
    w("Rows 4-9 predicted total: **%.1f h** of machine time (row 5's rate sweep "
      "excluded -- it is time-bounded by `steps x window`, not a function of the "
      "tier)." % total)
    w("")

    # ---- (d) in-sample check --------------------------------------------
    w("## 4. In-sample check")
    w("")
    w("Every tier that has measured reps, predicted against them. Rows marked "
      "**fitted** are in-sample: the coefficients were derived from these runs, "
      "so their error is a floor, not evidence the model extrapolates. Rows "
      "marked **held out** were not in the fit and are the real test. Median and "
      "mean are both over the measured reps; the mean carries its own `t` "
      "interval.")
    w("")
    w("| Tier | Class | In fit | Reps | Predicted h/run | Actual median h | "
      "Error % (median) | Actual mean h +/- 95 % | Error % (mean) |")
    w("|---|---|---|---|---|---|---|---|---|")
    seen = set()
    for r in sorted(runs, key=lambda r: (not r["onchain"], r["voters"], r["positions"])):
        key = (r["voters"], r["positions"], r["onchain"])
        if key in seen:
            continue
        seen.add(key)
        m = on if r["onchain"] else off
        if not m.runs:
            continue
        rs = actuals(runs, r["voters"], r["positions"], r["onchain"])
        pred = m.predict_ms(r["voters"], r["positions"])
        med = statistics.median([x["wall_ms"] for x in rs])
        mf = mean_ci("mean", "ms", [x["wall_ms"] for x in rs])
        infit = "fitted" if any(x["id"] in
                                set(m.g.sources) | set(m.va.sources) for x in rs) else "held out"
        w("| %s voters, %s | %s | %s | %d | %.4f | %.4f | %+.1f %% | %.4f%s | %+.1f %% |" % (
            "{:,}".format(r["voters"]),
            "SP" if r["positions"] == 1 else "%d positions" % r["positions"],
            "on-chain" if r["onchain"] else "offline", infit, len(rs),
            _hours(pred), _hours(med), (med - pred) / pred * 100.0,
            _hours(mf.beta),
            (" +/- %.4f" % _hours(mf.half)) if mf.half is not None else "",
            (mf.beta - pred) / pred * 100.0))
    w("")
    if off.runs and len(off.runs) == 1:
        w("The offline row's 0.0 % error is arithmetic, not evidence: with one "
          "run in the class, `c0` is whatever the run's residual happens to be, "
          "so the model reproduces it exactly by construction. Row 8's hours "
          "have no validation behind them until a second true-offline tier runs.")
        w("")

    # ---- (e) how to read -------------------------------------------------
    w("## 5. How to read this")
    w("")
    w("The model is a per-record cost plus two fixed costs, and it is only as "
      "portable as the settings it was measured under. `s` is the submission "
      "cost **at driver concurrency %s on the orderer parameters those runs were "
      "made under** (the desktop-runs note for them records the parameters); "
      "`tau`, where it is measurable, is the orderer's `BatchTimeout`. Retune the "
      "driver concurrency, change an orderer parameter, or change how the "
      "console batches its ledger reads or lifecycle transactions, and `s`, "
      "`v_dump`, `L` or `c0` move -- the fit is then stale and the script must "
      "be rerun. `--match` pins a fit to one regime's run folders. It is "
      "written to be rerun: it reads whatever complete, measured, non-failed "
      "runs exist and refits from scratch." % (
          "/".join(sorted({str(r["concurrency"]) for r in on.runs})) if on.runs else "n/a"))
    w("")
    w("That concurrency dependence is why the fit is taken at one setting and "
      "other settings are held out. To pool every setting instead, rerun with "
      "`--fit-concurrency all`; to fit at another setting, "
      "`--fit-concurrency <c>`. Either changes what `s` means and both should "
      "be read next to the per-concurrency table in section 2.")
    w("")
    w("**One regime per fit, or no fit.** A run's regime is its auditor thread "
      "count (`verify_threads` in `timings.json` or `perf.csv`; absent = 1, the "
      "serial auditor), its orderer configuration (`orderer_batch` in "
      "`journal.ndjson` line 1; absent = not recorded) and its saksi commit "
      "(`run.json`). If the runs of one cost class span more than one regime the "
      "script **refuses to fit** and exits naming the regimes it found, rather "
      "than fitting per group: every coefficient -- not only `v_audit` -- can move "
      "between regimes, and `v_dump` is derived as the verify stage minus the "
      "audit, so it inherits any shift in `v_audit`. Pick one regime per class "
      "with `--match`. When the parallel auditor (`verify_threads` > 1) is "
      "deployed, `v_audit` and with it `v_dump` must be refitted on runs from "
      "that build; the chain-side terms (`s`, the lifecycle) do not depend on "
      "the auditor.")
    w("")
    w("Excluded from the fit by construction: warm-up reps (`rep.kind` is not "
      "`measured`), failed runs, in-flight folders with no `run.end`, the "
      "concurrency-tuning probes and the validation ladder, and the superseded "
      "concurrency-8 reps (any on-chain run below c=%d). Pass "
      "`--include-probes` to fold the probes in, or `--min-concurrency 0` to "
      "fold the c=8 regime in -- both change what `s` means." % MIN_CONCURRENCY)
    w("")
    w("`mode` in `run.json` does not by itself decide the cost class. A run with "
      "`mode: offline` against a Fabric-wired console still transacts, and it "
      "also drops one of the two audit passes -- so it has an on-chain `s` and "
      "an offline `v_dump` and belongs to neither set. The script requires both "
      "axes to agree: on-chain means `mode: onchain` **and** a "
      "`submit_window_ms` in `perf.csv`; offline means `mode: offline` **and** "
      "no submission window. Anything else is listed in section 6 and left out "
      "of both fits.")
    w("")
    w("**What the MoE does and does not cover.** It is the propagated 95 % "
      "uncertainty of the four fitted coefficients and `c0`, nothing else. It "
      "assumes the tier being predicted behaves like the tiers that were fitted. "
      "It does not cover a regime change -- a different driver concurrency, a "
      "submission rate that collapses at a larger tier, a stalling window -- and "
      "the held-out rows in section 4 show that when the regime does move, the "
      "real error is an order of magnitude larger than the MoE. Read the MoE as "
      "\"how well are the coefficients pinned down\", and the held-out error as "
      "\"how far does this model travel\". For a tier that has not been run, the "
      "second is the one that matters.")
    w("")
    w("### Hardware, and what a faster box would actually change")
    w("")
    w("Every number here was measured on one machine: **AMD Ryzen 7 5700G "
      "(8 cores / 16 threads), Fabric inside WSL2 Ubuntu with 16 vCPU** and the "
      "RAM WSL allots (15 GB for the row-2 default-parameter runs on SATA-backed "
      "Docker storage, 24 GB from the move to NVMe on), Docker Desktop, Fabric "
      "2.5.15 test-network. The terms do not all scale with the same resource:")
    w("")
    w("- **Scales with CPU cores / single-core speed:** `g` (credential issue, "
      "ElGamal encrypt, CDS prove -- the generator is thread-parallel, "
      "`gen_cpu_ms` runs several times `wall_ms`) and `v_audit` (in-process "
      "proof and credential verification). More or faster cores cut these "
      "roughly in proportion.")
    w("- **Scales with the Fabric pipeline, not with cores:** `s` (endorse -> "
      "order -> commit, bounded by orderer batching and by how many in-flight "
      "submissions the driver holds) and `v_dump` (the ledger dump's "
      "`GetBallot` / `GetBallots` queries against the peer). A faster CPU moves "
      "these only as far as the peer and orderer processes were CPU-starved.")
    w("- **Scales with neither:** `L(p)` (or, when `tau = 0`, the lifecycle part "
      "of `c0`): the orderer waiting out its `BatchTimeout` on lifecycle blocks "
      "that never fill. It is the same on any hardware and is reduced only by "
      "changing `BatchTimeout` or by putting fewer such blocks on the chain.")
    w("")
    w("So \"a faster machine makes the campaign N times quicker\" is wrong as a "
      "blanket claim. At the small tiers the fixed per-run cost dominates and a faster box changes "
      "almost nothing; at the large tiers the split between the CPU-bound and "
      "the Fabric-bound terms in the coefficient table above is the honest "
      "scope for any such claim.")
    w("")

    # ---- provenance -------------------------------------------------------
    w("## 6. What was read, and what was skipped")
    w("")
    w("%d run folder%s used. Skipped:" % (len(runs), "" if len(runs) == 1 else "s"))
    w("")
    reasons = {}
    for name, why in skipped:
        reasons.setdefault(why, []).append(name)
    for why, names in sorted(reasons.items()):
        w("- **%s** (%d): %s" % (why, len(names), ", ".join("`%s`" % n for n in names)))
    w("")
    return "\n".join(out) + "\n"


# --------------------------------------------------------------------------

def selfcheck():
    """Assert the arithmetic on data whose answer is known by hand."""
    # Exact fit: y = 3x through the origin, zero residual, zero-width CI.
    f = ols_through_origin("b", "u", [(1.0, 3.0, "a"), (2.0, 6.0, "b"), (4.0, 12.0, "c")])
    assert abs(f.beta - 3.0) < 1e-12, f.beta
    assert f.half < 1e-9 and f.df == 2, (f.half, f.df)
    # Least squares, not a mean of ratios: beta = sum(xy)/sum(x^2)
    # = (1*4 + 2*4) / (1 + 4) = 2.4, whereas the mean ratio would be 3.0.
    f = ols_through_origin("b", "u", [(1.0, 4.0, "a"), (2.0, 4.0, "b")])
    assert abs(f.beta - 2.4) < 1e-12, f.beta
    # t table: exact hit, conservative fallback (takes the smaller df, larger t),
    # and the normal limit above the table.
    assert t_crit(10) == 2.228 and t_crit(35) == T95[30] and t_crit(500) == 1.960
    assert t_crit(0) is None
    # mean CI: n=2, values 10 and 20 -> mean 15, sd 7.0711, half = 12.706*sd/sqrt(2)
    m = mean_ci("m", "u", [10.0, 20.0])
    assert abs(m.beta - 15.0) < 1e-12
    assert abs(m.half - 12.706 * statistics.stdev([10.0, 20.0]) / math.sqrt(2)) < 1e-9
    # Model arithmetic: 1000 records at 1 ms each + tau*(4+5*1*4) + c0.
    g = Fit("g", "ms/record", 1.0, 0.1, 1, 2, [])
    z = Fit("z", "ms/record", 0.0, 0.0, 1, 2, [])
    c0 = Fit("c0", "ms", 500.0, 50.0, 1, 2, [])
    mo = Model([], 2.0, g, z, z, z, c0, [])
    assert mo.lifecycle_ms(1) == 48000.0 and mo.lifecycle_ms(3) == 128000.0
    assert mo.predict_ms(1000, 1) == 1000 * 1.0 + 48000.0 + 500.0
    # MoE = sqrt((1000*0.1)^2 + 0 + 0 + 0 + 50^2)
    assert abs(mo.moe_ms(1000, 1) - math.hypot(100.0, 50.0)) < 1e-9
    # Regime guard: same class + different thread count (or commit) is mixed;
    # the same regime in two classes is not.
    base = {"klass": "onchain", "verify_threads": 1, "orderer_batch": None, "commit": "a"}
    assert mixed_regimes([base, dict(base)]) == []
    assert mixed_regimes([base, dict(base, klass="offline", commit="b")]) == []
    assert [k for k, _ in mixed_regimes([base, dict(base, verify_threads=8)])] == ["onchain"]
    assert [k for k, _ in mixed_regimes([base, dict(base, commit="b")])] == ["onchain"]
    print("selfcheck ok")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--runs", action="append", metavar="PATH",
                    help="campaign runs directory; repeatable. Default: the WSL2 "
                         "tree at %s{,-offline}" % (_WSL_UNC + "\\runs"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                  "cost-model.md"),
                    help="Markdown file to write (default: cost-model.md beside this script)")
    ap.add_argument("--tiers-from-plan", action="store_true",
                    help="use the plan's run table (rows 2-9). This is the default "
                         "and the only table; the flag exists so the intent is "
                         "explicit on the command line.")
    ap.add_argument("--include-probes", action="store_true",
                    help="fold the concurrency probes and validation ladder into the fit")
    ap.add_argument("--min-concurrency", type=int, default=MIN_CONCURRENCY,
                    help="drop on-chain runs below this driver concurrency "
                         "(default %d; 0 keeps the superseded c=8 reps)" % MIN_CONCURRENCY)
    ap.add_argument("--fit-concurrency", default=",".join(str(c) for c in FIT_CONCURRENCY),
                    help="comma-separated driver concurrencies whose runs shape the "
                         "fit, or `all` to pool them (default %s). Runs at other "
                         "concurrencies still supply actuals and so test the fit out "
                         "of sample." % ",".join(str(c) for c in FIT_CONCURRENCY))
    ap.add_argument("--match", action="append", metavar="GLOB",
                    help="read only run folders whose name matches this glob; "
                         "repeatable (a folder matching any one is read). Pins the "
                         "fit to one regime, e.g. --match 'sp-*-b50-*'")
    ap.add_argument("--selfcheck", action="store_true",
                    help="run the arithmetic self-check and exit (touches no artifacts)")
    if argv is None:
        argv = sys.argv[1:]
    args = ap.parse_args(argv)

    if args.selfcheck:
        return selfcheck()

    if args.fit_concurrency.strip().lower() in ("all", "", "0"):
        fit_conc = None
    else:
        fit_conc = tuple(int(c) for c in args.fit_concurrency.split(","))

    run_dirs = args.runs or DEFAULT_RUN_DIRS
    runs, skipped = collect(run_dirs, args.include_probes, args.min_concurrency, args.match)
    if not runs:
        sys.stderr.write(
            "no usable runs under %s\n"
            "Pass --runs explicitly; from Windows the WSL tree is\n"
            "  %s\n"
            "and under WSL it is /home/user/.saksi/campaign/runs\n"
            % (", ".join(run_dirs), DEFAULT_RUN_DIRS[0]))
        return 1

    mixed = mixed_regimes(runs)
    if mixed:
        sys.stderr.write("refusing to fit: runs of one cost class span more than one "
                         "regime (verify_threads, orderer_batch, saksi commit), and a "
                         "coefficient pooled across regimes fits none of them.\n")
        for klass, regs in mixed:
            for v, ob, c in regs:
                n = sum(1 for r in runs if r["klass"] == klass and regime(r) == (v, ob, c))
                sys.stderr.write("  %-8s verify_threads=%s orderer_batch=%s commit=%s  (%d runs)\n"
                                 % (klass, v, ob or "not recorded", c, n))
        sys.stderr.write("Select one regime per class with --match GLOB (repeatable).\n")
        return 2

    on = fit(runs, onchain=True, fit_concurrency=fit_conc)
    off = fit(runs, onchain=False)

    # --out is dropped from the recorded invocation: it names this file.
    shown, skip_next = [], False
    for a in argv:
        if skip_next:
            skip_next = False
        elif a == "--out":
            skip_next = True
        elif not a.startswith("--out="):
            shown.append(a)
    invocation = "python3 cost_model.py " + " ".join(shlex.quote(a) for a in shown)
    md = render(on, off, runs, skipped, run_dirs, fit_conc, invocation)
    with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(md)

    print("runs used: %d (%d on-chain, %d offline)" % (
        len(runs), len(on.runs), len(off.runs)))
    for f in (on.g, on.s, on.va, on.vd, on.c0):
        print("  on-chain %-8s %s" % (f.name, f))
    if on.tau_s:
        print("  on-chain tau      %.2f s -> L(1)=%.0f s L(3)=%.0f s" % (
            on.tau_s, on.lifecycle_ms(1) / 1000, on.lifecycle_ms(3) / 1000))
    for f in (off.g, off.va, off.vd, off.c0):
        print("  offline  %-8s %s" % (f.name, f))
    print()
    print("%-22s %12s %10s %12s %9s" % ("tier", "pred h/run", "+/- MoE", "actual h", "err %"))
    for row, label, voters, p, reps, kind in TIERS:
        m = on if kind == "onchain" else off
        if not m.runs:
            continue
        pred = m.predict_ms(voters, p)
        act = actuals(runs, voters, p, kind == "onchain")
        if act:
            med = statistics.median([r["wall_ms"] for r in act])
            a, e = "%.4f" % _hours(med), "%+.1f" % ((med - pred) / pred * 100)
        else:
            a, e = "-", "-"
        print("%-22s %12.4f %10s %12s %9s" % (
            label, _hours(pred),
            "%.4f" % _hours(m.moe_ms(voters, p)) if m.moe_ms(voters, p) else "n/a", a, e))
    print("\nwrote %s" % args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
