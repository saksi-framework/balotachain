#!/usr/bin/env python3
"""Chapter 4 study driver (ch4). Talks to the console API only; one step at a time.

Usage: drive.py tier LABEL | security | t3 | all
State in ~/ch4/state.json so `all` resumes after the last finished step.
"""
import json, os, subprocess, sys, time, urllib.request, urllib.error

BASE = "http://127.0.0.1:8090"
HOME = os.path.expanduser("~")
OUT = os.path.join(HOME, "ch4")
RUNS = os.path.join(HOME, ".saksi/campaign/runs")
os.makedirs(os.path.join(OUT, "exports"), exist_ok=True)
LOG = os.path.join(OUT, "drive.log")
STATE = os.path.join(OUT, "state.json")
POLL = 30

TIERS = {  # label: voters, positions, warmups, reps
    "SP-1K": (1000, 1, 2, 10), "MP-1K": (1000, 3, 2, 10),
    "SP-10K": (10000, 1, 2, 10), "MP-10K": (10000, 3, 2, 10),
    "SP-50K": (50000, 1, 2, 5), "MP-50K": (50000, 3, 2, 5),
}
ORDER = ["SP-1K", "MP-1K", "SP-10K", "security", "t3", "peer", "MP-10K", "SP-50K", "MP-50K"]
TRUSTEES = ["COMELEC", "Civil Society Watch", "University IT", "Academe Observer", "Bar Association"]


class Fail(Exception):
    pass


def log(msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def req(method, path, body=None, timeout=60, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            b = resp.read()
            code = resp.status
    except urllib.error.HTTPError as e:
        b, code = e.read(), e.code
    if raw:
        return code, b
    try:
        return code, json.loads(b)
    except ValueError:
        return code, b.decode(errors="replace")


def save(name, obj):
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(obj, f, indent=2)


def state():
    try:
        return json.load(open(STATE))
    except (OSError, ValueError):
        return {}


def mark(key, val):
    s = state()
    s[key] = val
    save("state.json", s)


def cfg(name, voters, positions, skip=True, plan=None):
    return {"name": name, "trustees": [{"name": t} for t in TRUSTEES], "threshold": 3,
            "positions": positions, "candidates": 4, "voters": voters, "distribution": "realistic",
            "senate_seats": 0, "concurrency": 128, "send_rate": 0, "skip_attacks": skip,
            "mode": "onchain", "attack_plan": plan}


def reset(voters, positions, tag):
    code, b = req("POST", "/api/network/reset", {"voters": voters, "positions": positions, "confirm": "RESET"})
    if code != 202:
        raise Fail(f"reset {voters}x{positions}: {code} {b}")
    job = b["job"]
    log(f"reset {voters}x{positions} started {job}")
    while True:
        time.sleep(POLL)
        _, j = req("GET", "/api/jobs/" + job)
        if j.get("status") not in ("queued", "running"):
            break
    save(f"{tag}-reset-job.json", j)
    res = j.get("result") or {}
    if j.get("status") != "done" or not res.get("chain_height"):
        raise Fail(f"reset {job} {j.get('status')} {j.get('error')} {res}")
    log(f"reset {job} done chain_height {res.get('chain_height')} {res.get('duration_ms')} ms")
    return job


def preflight(voters, positions, tag):
    deadline = time.time() + 600
    while True:
        _, p = req("GET", f"/api/preflight?mode=onchain&voters={voters}&positions={positions}&candidates=4&concurrency=128", timeout=30)
        h = p.get("host", {})
        codes = [w["code"] for w in p.get("warnings", [])]
        cpu = h.get("host_cpu_pct")
        ok = (not codes and p["fabric"].get("reachable") and p["ladder"].get("ok")
              and cpu is not None and cpu < 25)
        log(f"preflight {tag}: host_cpu {cpu} load1 {h.get('guest_load1')} warnings {codes} -> {'green' if ok else 'not green'}")
        if ok:
            save(f"{tag}-preflight.json", p)
            return p
        if time.time() > deadline:
            save(f"{tag}-preflight-fail.json", p)
            raise Fail(f"preflight {tag} not green after 10 min: {codes} host {cpu}")
        time.sleep(POLL)


def contended(h, cpus=16):
    if not h:
        return False
    c, l = h.get("host_cpu_pct"), h.get("guest_load1")
    return (c is not None and c > 25) or (l is not None and l > 0.25 * cpus)


def campaign(label, voters, positions, warmups, reps, tag):
    body = {"config": cfg(f"{label} ch4", voters, positions), "warmups": warmups, "reps": reps}
    code, b = req("POST", "/api/campaigns", body)
    if code != 202:
        raise Fail(f"campaign {label}: {code} {b}")
    cid = b["campaign"]
    log(f"campaign {label} started {cid}")
    while True:
        time.sleep(60)
        _, c = req("GET", "/api/campaigns/" + cid)
        if c.get("status") != "running":
            break
    save(f"{tag}-campaign.json", c)
    meas = [r for r in c.get("reps", []) if r.get("kind") == "measured"]
    cont = [r["run_id"] for r in meas if contended(r.get("host_start")) or contended(r.get("host_end"))]
    failed = [r["run_id"] for r in meas if r.get("failed")]
    log(f"campaign {cid} {c.get('status')} error={c.get('error')} measured {len(meas)} contended {len(cont)} {cont} failed {len(failed)} {failed}")
    for r in c.get("reps", []):
        hs, he = r.get("host_start") or {}, r.get("host_end") or {}
        log(f"  {r['index']} {r['kind']} {r['run_id']} {r['status']} tps {r.get('committed_tps')} p99 {r.get('latency_p99_ms')} "
            f"failed {r.get('failed')} {r.get('fail_reason','')} host {hs.get('host_cpu_pct')}/{hs.get('guest_load1')} -> {he.get('host_cpu_pct')}/{he.get('guest_load1')}")
    return cid, c, cont, failed


def export(cid):
    code, b = req("GET", f"/api/campaigns/{cid}/export", timeout=600, raw=True)
    if code != 200:
        raise Fail(f"export {cid}: {code} {b[:300]}")
    path = os.path.join(OUT, "exports", cid + ".zip")
    with open(path, "wb") as f:
        f.write(b)
    log(f"export {cid} -> {path} ({len(b)} bytes)")
    return path


def summary_line(cid):
    rows = {}
    with open(os.path.join(RUNS, "campaigns", cid, "summary.csv")) as f:
        hdr = f.readline().strip().split(",")
        for line in f:
            v = line.strip().split(",")
            rows[v[0]] = dict(zip(hdr, v))
    keys = ["committed_tps", "latency_p50_ms", "latency_p99_ms", "driver_ceiling_tps", "runs_failed", "failure_rate"]
    return {k: rows.get(k, {}) for k in keys}


def tier(label):
    v, p, w, r = TIERS[label]
    tag = label.lower()
    attempts = state().get(tag + "-attempts", [])
    while True:
        reset(v, p, tag + f"-a{len(attempts)+1}")
        preflight(v, p, tag + f"-a{len(attempts)+1}")
        cid, c, cont, failed = campaign(label, v, p, w, r, tag + f"-a{len(attempts)+1}")
        if c.get("status") != "done":
            raise Fail(f"campaign {cid} ended {c.get('status')}: {c.get('error')}")
        export(cid)
        s = summary_line(cid)
        log(f"summary {cid}: " + json.dumps({k: (x.get('median'), x.get('n')) for k, x in s.items()}))
        attempts.append({"campaign": cid, "contended": cont, "failed": failed})
        mark(tag + "-attempts", attempts)
        if len(cont) > 2 and len(attempts) == 1:
            log(f"{label}: {len(cont)} contended measured reps > 2 -> rerun once from reset")
            continue
        return cid


def wait_idle(run, what, pauses=None):
    while True:
        time.sleep(POLL if pauses is None else 10)
        if pauses is not None:
            _, ps = req("GET", f"/api/runs/{run}/pause")
            if isinstance(ps, dict) and ps.get("paused"):
                log(f"paused at {ps.get('stage')} scenarios {ps.get('scenarios')} mount {ps.get('mount')}")
                code, b = req("POST", f"/api/runs/{run}/pause", {"action": "run-all"})
                log(f"run-all -> {code}")
                pauses.append(ps.get("stage"))
                continue
        _, st = req("GET", f"/api/runs/{run}/status")
        if not st.get("busy"):
            log(f"idle after {what}")
            return


def phase(path, run, extra=None, pauses=None):
    body = {"run_id": run}
    body.update(extra or {})
    code, b = req("POST", path, body)
    log(f"{path} {extra or ''} -> {code} {str(b)[:200]}")
    if code != 202:
        raise Fail(f"{path} {run}: {code} {b}")
    wait_idle(run, path, pauses)


def generate(conf):
    code, b = req("POST", "/generate", conf)
    if code != 202:
        raise Fail(f"generate: {code} {b}")
    run = b["run_id"]
    log(f"generate -> {run}")
    wait_idle(run, "generate")
    code, chk = req("GET", "/api/check/" + run, timeout=300)
    log(f"check -> {code} pass {chk.get('pass') if isinstance(chk, dict) else chk}")
    if code != 200 or not chk.get("pass"):
        raise Fail(f"check {run}: {code} {chk}")
    return run


def trustees_publish_verify(run, pauses=None):
    _, st = req("GET", "/api/ceremony/" + run)
    for t in st["trustees"][:3]:
        phase("/ceremony/submit", run, {"trustee_id": t["id"]})
    phase("/ceremony/publish", run, pauses=pauses)
    phase("/verify", run)


def journal(run, prefixes):
    out = []
    with open(os.path.join(RUNS, run, "journal.ndjson")) as f:
        for line in f:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if any(str(e.get("event", "")).startswith(p) for p in prefixes):
                out.append(e)
    return out


def dump(run, name):
    p = os.path.join(RUNS, run, name)
    if os.path.exists(p):
        log(f"--- {name}\n" + open(p).read())


def security():
    preflight(10000, 1, "security")
    plan = {"stages": ["dkg", "ballots", "close", "ceremony"], "ballots_at": 0.5, "timeout_s": 300}
    run = generate(cfg("SP-10K ch4 sec", 10000, 1, skip=False, plan=plan))
    mark("security-run", run)
    pauses = []
    phase("/ceremony/start", run, pauses=pauses)
    trustees_publish_verify(run, pauses)
    log(f"security pauses decided: {pauses}")
    dump(run, "negative-tests.csv")
    dump(run, "correctness.csv")
    for e in journal(run, ["run.end", "stage.verify.end"]):
        log(json.dumps(e)[:1500])
    return run


def t3():
    preflight(10000, 1, "t3")
    run = generate(cfg("SP-10K ch4 t3", 10000, 1))
    mark("t3-run", run)
    code, b = req("POST", f"/api/runs/{run}/fault", {"kind": "peer-restart", "at": 0.4, "down_s": 20, "confirm": "RESTART"})
    log(f"fault arm -> {code} {b}")
    if code != 200:
        raise Fail(f"fault arm {run}: {code} {b}")
    code, b = req("POST", "/ceremony/start", {"run_id": run})
    log(f"/ceremony/start -> {code} {b}")
    wait_idle(run, "ceremony/start (fault)")
    for i in range(3):
        code, b = req("POST", f"/api/runs/{run}/resume")
        log(f"resume #{i+1} -> {code} {b}")
        if code != 202:
            break
        wait_idle(run, "resume")
        _, runs = req("GET", "/runs")
        me = next((x for x in runs if x.get("run_id") == run or x.get("id") == run), {}) if isinstance(runs, list) else {}
        log(f"after resume: status {me.get('status')} resumable {me.get('resumable')} pending {me.get('resume_pending')}")
        if me.get("status") not in ("interrupted", "close-pending") and not me.get("resumable"):
            break
    phase(f"/api/runs/{run}/verify-only", run)
    trustees_publish_verify(run)
    for e in journal(run, ["fault.", "stage.ballots.interrupted", "segment.start", "resume.close",
                           "verify_only.", "stage.verify.end", "run.end"]):
        log(json.dumps(e)[:1500])
    dump(run, "correctness.csv")
    return run


def peer():
    r = subprocess.run(["bash", "-c", "cd ~/Code/saksi && ./tools/up.sh status; docker ps --format '{{.Names}} {{.Status}}' | grep -E 'peer0|orderer'"],
                       capture_output=True, text=True)
    log("peer check:\n" + r.stdout + r.stderr)
    if "peer0.org1.example.com Up" not in r.stdout:
        raise Fail("peer0.org1 not up after T3")


def run_step(step):
    if step in TIERS:
        return tier(step)
    return {"security": security, "t3": t3, "peer": peer}[step]()


def main():
    what = sys.argv[1]
    steps = ORDER if what == "all" else [sys.argv[2] if what == "tier" else what]
    for st in steps:
        if what == "all" and st in state().get("done", []):
            continue
        log(f"=== STEP {st} begin")
        try:
            res = run_step(st)
        except Exception as e:  # noqa: BLE001 - any failure stops the study for a human look
            log(f"=== STEP {st} FAILED: {type(e).__name__}: {e}")
            sys.exit(1)
        s = state()
        s.setdefault("done", []).append(st)
        s[st + "-result"] = res
        save("state.json", s)
        log(f"=== STEP {st} DONE {res}")
    log("=== ALL DONE")


if __name__ == "__main__":
    main()
