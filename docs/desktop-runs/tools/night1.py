#!/usr/bin/env python3
"""Chapter 4 study, Night 1 (2026-10-01). Reuses drive.py's API helpers.

Usage: night1.py all | STEP
Steps, strictly one at a time: cand10 cand28 mp1k-sec sp483k sp1m sp192m.
State in ~/ch4/night1/state.json so `all` resumes after the last finished step.
Stop file ~/ch4/night1/STOP: `all` stops cleanly before the next step.
"""
import json, os, subprocess, sys, time

sys.path.insert(0, os.path.expanduser("~/ch4"))
import drive as d  # noqa: E402

OUT = os.path.expanduser("~/ch4/night1")
os.makedirs(os.path.join(OUT, "exports"), exist_ok=True)
os.makedirs(os.path.join(OUT, "logs"), exist_ok=True)
d.OUT, d.LOG, d.STATE = OUT, os.path.join(OUT, "drive.log"), os.path.join(OUT, "state.json")
log, req, save, state, mark = d.log, d.req, d.save, d.state, d.mark
Fail = d.Fail

ORDER = ["cand10", "cand28", "mp1k-sec", "sp483k", "sp1m", "sp192m"]

# Row 5 sweep and burst (see the study log for the reasoning).
SWEEP_RATE, SWEEP_FACTOR, SWEEP_WINDOW_S = 250.0, 1.6, 120
BURST = 144900  # 483,000 / 10 h x 3 (peak hour at three times the mean hourly share)


def cfg(name, voters, positions, candidates=4, send_rate=0, skip=True, plan=None):
    c = d.cfg(name, voters, positions, skip=skip, plan=plan)
    c["candidates"], c["send_rate"] = candidates, send_rate
    return c


def preflight(voters, positions, candidates, tag, strict_rows=False):
    deadline = time.time() + 900
    while True:
        _, p = req("GET", f"/api/preflight?mode=onchain&voters={voters}&positions={positions}"
                          f"&candidates={candidates}&concurrency=128", timeout=30)
        h = p.get("host", {})
        codes = [w["code"] for w in p.get("warnings", [])]
        cpu = h.get("host_cpu_pct")
        ok = (not codes and p["fabric"].get("reachable") and p["ladder"].get("ok")
              and cpu is not None and cpu < 25)
        log(f"preflight {tag}: host_cpu {cpu} load1 {h.get('guest_load1')} warnings {codes} "
            f"disk free {p.get('disk', {}).get('free_bytes')} proj {p.get('disk', {}).get('projected_ledger_bytes')} "
            f"phase_timeout {p.get('phase_timeout')} -> {'green' if ok else 'not green'}")
        if strict_rows and any(c.startswith("disk_") or c.startswith("phase_timeout") for c in codes):
            save(f"{tag}-preflight-fail.json", p)
            raise Fail(f"preflight {tag}: disk or phase-timeout row not green: {codes}")
        if ok:
            save(f"{tag}-preflight.json", p)
            return p
        if time.time() > deadline:
            save(f"{tag}-preflight-fail.json", p)
            raise Fail(f"preflight {tag} not green after 15 min: {codes} host {cpu}")
        time.sleep(30)


def host_hot(r):
    return [(w, (r.get(w) or {}).get("host_cpu_pct")) for w in ("host_start", "host_end")
            if ((r.get(w) or {}).get("host_cpu_pct") or 0) > 25]


def guest_hot(r):
    return [(w, (r.get(w) or {}).get("guest_load1")) for w in ("host_start", "host_end")
            if ((r.get(w) or {}).get("guest_load1") or 0) > 4.0]


def campaign(body, tag, poll=60):
    code, b = req("POST", "/api/campaigns", body)
    if code != 202:
        raise Fail(f"campaign {tag}: {code} {b}")
    cid = b["campaign"]
    log(f"campaign {tag} started {cid} options { {k: v for k, v in body.items() if k != 'config'} }")
    while True:
        time.sleep(poll)
        _, c = req("GET", "/api/campaigns/" + cid)
        if c.get("status") != "running":
            break
    save(f"{tag}-campaign.json", c)
    meas = [r for r in c.get("reps", []) if r.get("kind") == "measured"]
    host = {r["run_id"]: host_hot(r) for r in meas if host_hot(r)}
    guest = {r["run_id"]: guest_hot(r) for r in meas if guest_hot(r)}
    failed = [r["run_id"] for r in c.get("reps", []) if r.get("failed")]
    log(f"campaign {cid} {c.get('status')} error={c.get('error')} measured {len(meas)} "
        f"host>25 {host} guest>4 (noted only) {list(guest)} failed {failed}")
    for r in c.get("reps", []):
        hs, he = r.get("host_start") or {}, r.get("host_end") or {}
        log(f"  {r['index']} {r['kind']} {r['run_id']} {r['status']} tps {r.get('committed_tps')} "
            f"p99 {r.get('latency_p99_ms')} failed {r.get('failed')} {r.get('fail_reason', '')} "
            f"host {hs.get('host_cpu_pct')}/{hs.get('guest_load1')} -> {he.get('host_cpu_pct')}/{he.get('guest_load1')}")
    if c.get("status") != "done":
        raise Fail(f"campaign {cid} ended {c.get('status')}: {c.get('error')}")
    d.export(cid)
    s = d.summary_line(cid)
    extra = {}
    try:
        with open(os.path.join(d.RUNS, "campaigns", cid, "summary.csv")) as f:
            for line in f:
                if line.startswith("plateau_tps,"):
                    extra["plateau_tps"] = line.split(",")[2]
    except OSError:
        pass
    log(f"summary {cid}: " + json.dumps({k: (x.get('median'), x.get('n')) for k, x in s.items()}) + f" {extra}")
    return cid, c, host, failed


def evidence(name):
    """Ledger size and peer/orderer logs for the network as it stands now."""
    dest = os.path.join(OUT, "logs", name)
    os.makedirs(dest, exist_ok=True)
    sh = (f"cd {dest} && for c in peer0.org1.example.com peer0.org2.example.com orderer.example.com; do "
          f"docker logs --timestamps $c > $c.log 2>&1; gzip -f $c.log; done; "
          f"for c in peer0.org1.example.com peer0.org2.example.com; do "
          f"echo $c $(docker exec $c du -sb /var/hyperledger/production); done; "
          f"echo orderer.example.com $(docker exec orderer.example.com du -sb /var/hyperledger/production/orderer); "
          f"docker exec peer0.org1.example.com du -sb /var/hyperledger/production/ledgersData 2>/dev/null; "
          f"docker exec peer0.org1.example.com df -B1 /var/hyperledger/production | tail -1; ls -l")
    r = subprocess.run(["bash", "-c", sh], capture_output=True, text=True, timeout=1800)
    with open(os.path.join(dest, "ledger-size.txt"), "w") as f:
        f.write(time.strftime("%Y-%m-%dT%H:%M:%S%z\n") + r.stdout + r.stderr)
    log(f"evidence {name}:\n{r.stdout}{r.stderr}")


def tier(label, voters, positions, warmups, reps, candidates=4, name=None, strict=False, after=None):
    """Reset -> preflight -> campaign -> export; rerun once from reset if a host CPU
    sample over 25 % falls on a measured repetition. `after` runs on the standing network."""
    name = name or f"{label} ch4"
    key = name.lower().replace(" ", "-")
    attempts = state().get(key + "-attempts", [])
    while True:
        tag = f"{key}-a{len(attempts) + 1}"
        job = d.reset(voters, positions, tag)
        preflight(voters, positions, candidates, tag, strict_rows=strict)
        body = {"config": cfg(name, voters, positions, candidates), "warmups": warmups, "reps": reps}
        cid, c, host, failed = campaign(body, tag)
        attempts.append({"campaign": cid, "reset": job, "host_contended": host, "failed": failed})
        mark(key + "-attempts", attempts)
        if host and len(attempts) == 1:
            evidence(f"{key}-superseded-{cid}")
            log(f"{name}: host CPU > 25 % on measured reps {list(host)} -> rerun once from reset")
            continue
        if host:
            log(f"{name}: host CPU > 25 % again on {list(host)}; rerun used, attempt stands flagged")
        res = {"campaign": cid, "attempts": attempts}
        if after:
            res.update(after(name))
        evidence(key)
        return res


def sweep_burst(name):
    preflight(483000, 1, 4, "sp-483k-ch4-sweep")
    body = {"config": cfg(name, 483000, 1, send_rate=SWEEP_RATE), "warmups": 0, "reps": 0,
            "sweep": SWEEP_FACTOR, "window_s": SWEEP_WINDOW_S, "burst": BURST}
    cid, c, host, failed = campaign(body, "sp-483k-ch4-sweep")
    return {"sweep_campaign": cid}


def mp1k_sec():
    job = d.reset(1000, 3, "mp-1k-ch4-sec")
    preflight(1000, 3, 4, "mp-1k-ch4-sec")
    plan = {"stages": ["dkg", "ballots", "close", "ceremony"], "ballots_at": 0.5, "timeout_s": 300}
    run = d.generate(cfg("MP-1K ch4 sec", 1000, 3, skip=False, plan=plan))
    mark("mp1k-sec-run", run)
    pauses = []
    d.phase("/ceremony/start", run, pauses=pauses)
    d.trustees_publish_verify(run, pauses)
    log(f"security pauses decided: {pauses}")
    d.dump(run, "negative-tests.csv")
    d.dump(run, "correctness.csv")
    for e in d.journal(run, ["run.end", "stage.verify.end"]):
        log(json.dumps(e)[:1500])
    evidence("mp-1k-ch4-sec")
    return {"run": run, "reset": job}


STEPS = {
    "cand10": lambda: tier("MP-1K", 1000, 3, 2, 5, candidates=10, name="MP-1K ch4-cand10"),
    "cand28": lambda: tier("MP-1K", 1000, 3, 2, 5, candidates=28, name="MP-1K ch4-cand28"),
    "mp1k-sec": mp1k_sec,
    "sp483k": lambda: tier("SP-483K", 483000, 1, 1, 3, after=sweep_burst),
    "sp1m": lambda: tier("SP-1M", 1000000, 1, 0, 3),
    "sp192m": lambda: tier("SP-1.92M", 1921917, 1, 0, 1, strict=True),
}


def main():
    what = sys.argv[1]
    steps = ORDER if what == "all" else [what]
    for st in steps:
        if what == "all" and st in state().get("done", []):
            continue
        if os.path.exists(os.path.join(OUT, "STOP")):
            log(f"=== STOP file present: stopping cleanly before {st}")
            return
        log(f"=== STEP {st} begin")
        try:
            res = STEPS[st]()
        except Exception as e:  # noqa: BLE001 - any failure stops the night for a look
            log(f"=== STEP {st} FAILED: {type(e).__name__}: {e}")
            sys.exit(1)
        s = state()
        s.setdefault("done", []).append(st)
        s[st + "-result"] = res
        save("state.json", s)
        log(f"=== STEP {st} DONE {json.dumps(res)[:600]}")
    log("=== ALL DONE")


if __name__ == "__main__":
    main()
