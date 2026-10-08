#!/usr/bin/env python3
"""Drive a console SECURITY RUN with the full attack timeline (D1, D1-L).

POSTs a single on-chain run via /run-all whose config carries an attack_plan
(the /api/campaigns path force-strips attack_plan on every repetition, so a
security run must go through /run-all, not a campaign). A short timeout_s makes
each paused lifecycle stage auto-mount all its attacks unattended. Live-capable
attacks (ballot stage) are submitted to the live ledger and must be refused at
their declared chain gate; the rest are simulated and must be caught by their
declared auditor check. Then it reads the per-scenario verdicts, the
attack.result journal events, and correctness.csv (E).

Usage: run_attack_timeline.py --voters N --label L --out DIR [--timeout-s S] [--ballots-at F]
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voters", type=int, required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--timeout-s", type=float, default=3.0)
    ap.add_argument("--ballots-at", type=float, default=0.5)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    cfg = {
        "name": a.label, "trustees": [{"name": t} for t in TRUSTEES], "threshold": 3,
        "positions": 3, "candidates": 4, "voters": a.voters, "distribution": "realistic",
        "senate_seats": 0, "concurrency": 128, "send_rate": 0, "skip_attacks": False,
        "mode": "onchain",
        "attack_plan": {"stages": ["dkg", "ballots", "close", "ceremony"],
                        "ballots_at": a.ballots_at, "timeout_s": a.timeout_s},
    }
    print("[%s] POST /run-all voters=%d label=%s" % (time.strftime("%H:%M:%S"), a.voters, a.label), flush=True)
    code, b = req("POST", "/run-all", cfg)
    if code not in (200, 202):
        print("run-all POST failed: %s %s" % (code, b), flush=True)
        sys.exit(1)
    rid = b.get("run_id")
    print("run_id=%s" % rid, flush=True)
    json.dump({"config": cfg, "post_response": b}, open("%s/run_post.json" % a.out, "w"), indent=2)

    t0 = time.time()
    seen_busy = False
    while True:
        time.sleep(15)
        code, st = req("GET", "/api/runs/%s/status" % rid)
        busy = bool(st.get("busy")) if isinstance(st, dict) else False
        if busy:
            seen_busy = True
        el = int(time.time() - t0)
        print("[%s] poll %ds busy=%s %s" % (time.strftime("%H:%M:%S"), el, busy, st if code != 200 else ""), flush=True)
        if code == 200 and not busy and seen_busy:
            break
        if el > 10800:
            print("timeout waiting for run", flush=True)
            break

    code, scn = req("GET", "/api/scenarios/%s" % rid)
    json.dump(scn, open("%s/scenarios.json" % a.out, "w"), indent=2)
    print("=== scenario verdicts ===", flush=True)
    rows = scn if isinstance(scn, list) else scn.get("scenarios", [])
    for s in rows:
        print("  %-28s verdict=%-13s was_live=%s expected=%s observed=%s" % (
            s.get("id"), s.get("verdict"), s.get("was_live"),
            s.get("gate_expected"), s.get("gate_observed")), flush=True)
    rundir = "/root/.saksi/campaign/runs/%s" % rid
    for f in ("negative-tests.csv", "journal.ndjson", "correctness.csv", "perf.csv", "header.json"):
        src = os.path.join(rundir, f)
        if os.path.exists(src):
            os.system("cp %s %s/ 2>/dev/null" % (src, a.out))
    os.system("grep -a attack. %s/journal.ndjson > %s/attack_events.ndjson 2>/dev/null" % (rundir, a.out))
    cpath = os.path.join(rundir, "correctness.csv")
    if os.path.exists(cpath):
        print("=== correctness.csv ===", flush=True)
        print(open(cpath).read()[:2000], flush=True)
    print("run dir: %s" % rundir, flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
