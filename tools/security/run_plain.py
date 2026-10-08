#!/usr/bin/env python3
"""Drive a plain on-chain run via /run-all (no attacks) for D4 (netem) and D3 (crash).

POSTs /run-all mode=onchain (Generate -> Submit -> Verify). Submit runs the
fail-loud reconcile (committed == submitted, no drops); Verify writes
correctness.csv (E per contest). Polls status, then reports reconcile + E.
If the run ends still failed (e.g. an outage during D3), optionally resumes.

Usage: run_plain.py --voters N --label L --out DIR [--resume]
"""
import argparse, json, time, urllib.request, urllib.error, os, sys

BASE = "http://127.0.0.1:8090"
TRUSTEES = ["COMELEC", "Civil Society Watch", "University IT", "Academe Observer", "Bar Association"]


def req(method, path, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"err": str(e)[:200]}


def wait_ready(rid, settle=20):
    """After an induced outage, wait until the console is reachable again, then
    settle so the restarted peer's chaincode container is ready before resume."""
    for _ in range(80):
        code, _ = req("GET", "/api/runs/%s/status" % rid, timeout=20)
        if code == 200:
            break
        time.sleep(10)
    print("[%s] network reachable; settling %ds" % (time.strftime("%H:%M:%S"), settle), flush=True)
    time.sleep(settle)


def poll(rid, out, t0):
    seen_busy = False
    while True:
        time.sleep(15)
        code, st = req("GET", "/api/runs/%s/status" % rid)
        busy = bool(st.get("busy")) if isinstance(st, dict) else False
        if busy:
            seen_busy = True
        el = int(time.time() - t0)
        print("[%s] poll %ds busy=%s" % (time.strftime("%H:%M:%S"), el, busy), flush=True)
        if code == 200 and not busy and seen_busy:
            return
        if el > 10800:
            print("timeout", flush=True)
            return


def report(rid, out):
    rundir = "/root/.saksi/campaign/runs/%s" % rid
    for f in ("correctness.csv", "perf.csv", "journal.ndjson", "header.json"):
        src = os.path.join(rundir, f)
        if os.path.exists(src):
            os.system("cp %s %s/ 2>/dev/null" % (src, out))
    # reconcile + stage outcome from journal
    jp = os.path.join(rundir, "journal.ndjson")
    recon, stageerr, committed = [], [], None
    if os.path.exists(jp):
        for ln in open(jp):
            if "reconcile" in ln or "committed" in ln.lower() or "stage" in ln:
                pass
        os.system("grep -aE 'reconcile|stage.*end|submit.*end|segment.end|run.end|error' %s | tail -20 > %s/journal_tail.txt 2>/dev/null" % (jp, out))
    cpath = os.path.join(rundir, "correctness.csv")
    allE0 = None
    if os.path.exists(cpath):
        lines = open(cpath).read().splitlines()
        print("=== correctness.csv (first contests) ===", flush=True)
        for ln in lines[:6]:
            print(ln[:160], flush=True)
        # E column index
        hdr = lines[0].split(",") if lines else []
        try:
            ei = hdr.index("E"); pi = hdr.index("pass")
            es = [r.split(",")[ei] for r in lines[1:] if r]
            ps = [r.split(",")[pi] for r in lines[1:] if r]
            allE0 = all(e == "0" for e in es) and all(p == "true" for p in ps)
            print("E all zero and pass=true for %d contests: %s" % (len(es), allE0), flush=True)
        except Exception as e:
            print("E parse error: %s" % e, flush=True)
    print("run dir: %s" % rundir, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voters", type=int, required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--resume", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    cfg = {
        "name": a.label, "trustees": [{"name": t} for t in TRUSTEES], "threshold": 3,
        "positions": 3, "candidates": 4, "voters": a.voters, "distribution": "realistic",
        "senate_seats": 0, "concurrency": 128, "send_rate": 0, "skip_attacks": True,
        "mode": "onchain",
    }
    print("[%s] POST /run-all voters=%d label=%s" % (time.strftime("%H:%M:%S"), a.voters, a.label), flush=True)
    code, b = req("POST", "/run-all", cfg)
    if code not in (200, 202):
        print("run-all failed: %s %s" % (code, b), flush=True)
        sys.exit(1)
    rid = b.get("run_id")
    print("run_id=%s" % rid, flush=True)
    json.dump({"config": cfg, "post": b}, open("%s/run_post.json" % a.out, "w"), indent=2)
    t0 = time.time()
    poll(rid, a.out, t0)

    if a.resume:
        # If the run failed mid-way (D3 outage), resume then verify-only.
        code, st = req("GET", "/api/runs/%s/status" % rid)
        print("post-run status: %s" % st, flush=True)
        wait_ready(rid)
        print("[%s] POST resume" % time.strftime("%H:%M:%S"), flush=True)
        rc, rb = req("POST", "/api/runs/%s/resume" % rid, {})
        print("resume -> %s %s" % (rc, rb), flush=True)
        if rc in (200, 202):
            poll(rid, a.out, time.time())
        wait_ready(rid, settle=10)
        print("[%s] POST verify-only" % time.strftime("%H:%M:%S"), flush=True)
        rc, rb = req("POST", "/api/runs/%s/verify-only" % rid, {"run_id": rid})
        print("verify-only -> %s %s" % (rc, rb), flush=True)
        if rc in (200, 202):
            poll(rid, a.out, time.time())

    report(rid, a.out)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
