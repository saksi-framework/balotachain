#!/usr/bin/env python3
"""D3: crash the (sole-endorser) peer AND the orderer during an on-chain ballot
window, restart with no reset, resume (fill the dropped ballots), verify; the
decrypted tally must reproduce ground truth (E=0) with no accepted ballot lost.

Flow (reliable, uses the console's own fault mechanism so the interruption is
recorded and the run is resumable):
  1. /generate onchain -> run created + ballots generated
  2. arm a peer-restart fault (console stops peer0.org1 mid-window, 25s)  [peer leg]
  3. /submit (the ballot window; the armed fault fires on its own)
  4. 3 external orderer stop/start cycles during the window                [orderer leg, new]
  5. /resume -> re-submit the dropped ballots (no reset)
  6. /verify-only -> reconcile chain vs committed, recompute tally -> E
The orderer-kill cycles are the extension to the console's T3 peer-restart drill.
"""
import json, time, os, sys, subprocess, urllib.request, urllib.error

BASE = "http://127.0.0.1:8090"
TRUSTEES = ["COMELEC", "Civil Society Watch", "University IT", "Academe Observer", "Bar Association"]
OUT = "/root/ch4-ax42/security/D3"
VOTERS = int(sys.argv[1]) if len(sys.argv) > 1 else 50000
ALL = ["orderer.example.com", "peer0.org1.example.com", "peer0.org2.example.com"]


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


def docker(action, names):
    subprocess.run(["docker", action] + names, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def log(m):
    print("[%s] %s" % (time.strftime("%H:%M:%S"), m), flush=True)


def busy(rid):
    code, st = req("GET", "/api/runs/%s/status" % rid, timeout=20)
    return code != 200 or bool(st.get("busy"))


def wait_idle(rid, cap):
    t = time.time()
    while busy(rid) and time.time() - t < cap:
        time.sleep(10)


def journal_has(rid, needle):
    jp = "/root/.saksi/campaign/runs/%s/journal.ndjson" % rid
    try:
        return needle in open(jp).read()
    except Exception:
        return False


def wait_net_ready(settle):
    for _ in range(120):
        if req("GET", "/api/campaigns", timeout=15)[0] == 200:
            break
        time.sleep(5)
    time.sleep(settle)


def main():
    os.makedirs(OUT, exist_ok=True)
    cfg = {"name": "d3-crash-%s" % time.strftime("%H%M%S"),
           "trustees": [{"name": t} for t in TRUSTEES], "threshold": 3, "positions": 3,
           "candidates": 4, "voters": VOTERS, "distribution": "realistic", "senate_seats": 0,
           "concurrency": 128, "send_rate": 0, "skip_attacks": True, "mode": "onchain"}

    log("POST /generate voters=%d" % VOTERS)
    code, b = req("POST", "/generate", cfg)
    if code not in (200, 202):
        log("generate failed: %s %s" % (code, b)); sys.exit(1)
    rid = b.get("run_id")
    log("run_id=%s" % rid)
    json.dump({"config": cfg, "post": b}, open("%s/run_post.json" % OUT, "w"), indent=2)
    wait_idle(rid, 1800)  # generation done

    log("arm peer-restart fault at=0.4 down_s=25")
    rc, rb = req("POST", "/api/runs/%s/fault" % rid, {"kind": "peer-restart", "at": 0.4, "down_s": 25, "confirm": "RESTART"})
    log("fault arm -> %s %s" % (rc, str(rb)[:160]))

    log("POST /submit (ballot window)")
    rc, rb = req("POST", "/submit", {"run_id": rid})
    log("submit -> %s %s" % (rc, str(rb)[:120]))

    # wait window open
    t0 = time.time()
    while not journal_has(rid, '"stage.ballots.start"') and busy(rid) and time.time() - t0 < 1200:
        time.sleep(4)
    log("ballot window open; starting orderer-kill cycles")

    # 3 external orderer stop/start cycles during the window (orderer leg).
    for n in range(1, 4):
        if not busy(rid):
            log("run idle before orderer cycle %d" % n); break
        log("orderer cycle %d: stop orderer.example.com" % n)
        docker("stop", ["orderer.example.com"])
        time.sleep(10)
        docker("start", ["orderer.example.com"])
        log("orderer cycle %d: started" % n)
        time.sleep(30)
    docker("start", ALL)

    # wait for the submit goroutine to finish (window interrupted by the fault)
    log("waiting for submit/window to settle")
    wait_idle(rid, 2400)
    log("post-window status: %s" % req("GET", "/api/runs/%s/status" % rid)[1])
    log("journal interrupted stamped: %s" % journal_has(rid, '"stage.ballots.interrupted"'))

    # resume: fill the dropped ballots, no reset
    wait_net_ready(20)
    for attempt in range(10):
        rc, rb = req("POST", "/api/runs/%s/resume" % rid, {})
        log("resume attempt %d -> %s %s" % (attempt, rc, str(rb)[:160]))
        if rc in (200, 202):
            break
        time.sleep(20)
    wait_idle(rid, 3600)

    # verify-only: reconcile + recompute tally/E
    wait_net_ready(10)
    rc, rb = req("POST", "/api/runs/%s/verify-only" % rid, {"run_id": rid})
    log("verify-only -> %s %s" % (rc, str(rb)[:160]))
    wait_idle(rid, 1800)

    rundir = "/root/.saksi/campaign/runs/%s" % rid
    for f in ("correctness.csv", "perf.csv", "journal.ndjson", "header.json"):
        src = os.path.join(rundir, f)
        if os.path.exists(src):
            os.system("cp %s %s/ 2>/dev/null" % (src, OUT))
    os.system("grep -aE 'fault|interrupt|resume|drop|reconcile|ballots.(start|end)|run.end' %s/journal.ndjson | tail -40 > %s/journal_tail.txt 2>/dev/null" % (rundir, OUT))
    cpath = os.path.join(rundir, "correctness.csv")
    if os.path.exists(cpath):
        lines = open(cpath).read().splitlines()
        print("=== correctness.csv ===", flush=True)
        for ln in lines[:6]:
            print(ln[:150], flush=True)
        hdr = lines[0].split(",")
        try:
            ei, pi, gi, di = hdr.index("E"), hdr.index("pass"), hdr.index("ground_truth"), hdr.index("decoded")
            es = [r.split(",") for r in lines[1:] if r]
            allok = all(c[ei] == "0" and c[pi] == "true" for c in es)
            gt = sum(int(c[gi]) for c in es); dec = sum(int(c[di]) for c in es)
            print("E=0 & pass for all %d contests: %s | sum ground_truth=%d decoded=%d" % (len(es), allok, gt, dec), flush=True)
        except Exception as e:
            print("parse err: %s" % e, flush=True)
    else:
        print("no correctness.csv produced", flush=True)
    print("run dir: %s" % rundir, flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
