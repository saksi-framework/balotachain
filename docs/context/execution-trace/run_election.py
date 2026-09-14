"""Drive one offline election through the scratch console, the way the wizard does."""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8199"


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw.strip().startswith(b"{") or raw.strip().startswith(b"[") else raw.decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def idle(run_id):
    while True:
        st, s = call("GET", f"/api/runs/{run_id}/status")
        if st == 200 and not s["busy"]:
            return
        time.sleep(0.5)


cfg = {
    "name": "Halalan E2E",
    "trustees": [{"name": "COMELEC"}, {"name": "Civil Society Watch"}, {"name": "University IT"}],
    "threshold": 2, "positions": 3, "candidates": 12, "senate_seats": 3,
    "voters": 1000, "distribution": "realistic", "mode": "offline", "skip_attacks": True,
}
st, r = call("POST", "/generate", cfg)
print("generate", st, r)
run = r["run_id"]
idle(run)
st, chk = call("GET", f"/api/check/{run}")
print("check", st, chk["pass"], [c["name"] for c in chk["checks"] if not c["pass"]])
json.dump(chk, open(f"check-{run}.json", "w"), indent=1)

print("ceremony/start", call("POST", "/ceremony/start", {"run_id": run}))
idle(run)
st, cer = call("GET", f"/api/ceremony/{run}")
ids = [t["id"] for t in cer["trustees"]]
print("trustees", ids, "threshold", cer["threshold"])
# Publish refused below threshold: record the status codes for the page.
gates = {}
st, _ = call("POST", "/ceremony/publish", {"run_id": run}); gates["0"] = st
for i, tid in enumerate(ids[:2], 1):
    print("submit", tid, call("POST", "/ceremony/submit", {"run_id": run, "trustee_id": tid})[0])
    idle(run)
    if i == 1:
        st, _ = call("POST", "/ceremony/publish", {"run_id": run}); gates["1"] = st
st, _ = call("POST", "/ceremony/publish", {"run_id": run}); gates["2"] = st
idle(run)
print("publish gate codes", gates)
print("verify", call("POST", "/verify", {"run_id": run})[0])
idle(run)
st, sc = call("GET", f"/api/scenarios/{run}")
names = [s["id"] for s in (sc if isinstance(sc, list) else sc.get("scenarios", []))]
print("scenarios", names)
print("run scenarios", call("POST", "/scenarios", {"run_id": run, "list": names})[0])
idle(run)
json.dump({"run": run, "publish_gate_codes": gates}, open("run.json", "w"))
print("RUN", run)
