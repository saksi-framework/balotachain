#!/usr/bin/env python3
"""Chapter 4 study, Night 2 (2026-10-01/02). Reuses night1.py's tier/campaign/evidence.

Usage: night2.py all | STEP   (steps: sp1m sp192m)
Adds: a disk budget check before each reset (WSL runs disk on C:, Docker data disk on Q:)
and deletes each finished run's ballots.csv after the campaign is exported.
State ~/ch4/night2/state.json; stop file ~/ch4/night2/STOP.
"""
import json, os, subprocess, sys

sys.path.insert(0, os.path.expanduser("~/ch4"))
import drive as d  # noqa: E402
import night1 as n1  # noqa: E402

OUT = os.path.expanduser("~/ch4/night2")
for sub in ("exports", "logs"):
    os.makedirs(os.path.join(OUT, sub), exist_ok=True)
d.OUT, d.LOG, d.STATE = OUT, os.path.join(OUT, "drive.log"), os.path.join(OUT, "state.json")
n1.OUT = OUT
log = d.log

GB = 1e9
RUN_PEAK_B = 12.5e3      # per on-chain record: ballots.ndjson 3.9 KB + ledger dump 3.9 KB + ballots.csv 4.1 KB + small files
LEDGER_B = 34e3          # per record on Q:: peer 11.9 KB x 2 + orderer 9.9 KB (night 1, SP-483K)
FLOOR = 25 * GB          # Q: floor
C_FLOOR = 15 * GB        # C: floor (pagefile growth, not the run disk; user 12:36)
VHDX_START = 214485172224  # ubuntu ext4.vhdx at night start; may grow at most VHDX_GROW
VHDX_GROW = 2 * GB
UBUNTU_VHDX = r"C:\Users\User\AppData\Local\wsl\{57faff8d-2e04-40cc-9b2e-b5f27e165d0b}\ext4.vhdx"
PS = "/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe"
PLAN = {}  # set per step: records x reps


def host_disk():
    cmd = (f"(Get-Volume -DriveLetter C).SizeRemaining; (Get-Volume -DriveLetter Q).SizeRemaining; "
           f"(Get-Item '{UBUNTU_VHDX}').Length")
    r = subprocess.run([PS, "-NoProfile", "-Command", cmd], capture_output=True, text=True, timeout=120)
    c, q, vhdx = (int(x) for x in r.stdout.split())
    st = os.statvfs("/")
    used = (st.f_blocks - st.f_bfree) * st.f_frsize
    return c, q, vhdx, used, st.f_bavail * st.f_frsize


def budget(tag):
    c, q, vhdx, used, wsl_free = host_disk()
    rec = PLAN["records"]
    run_need = rec * RUN_PEAK_B
    run_room = max(vhdx - used, 0) + c - C_FLOOR
    led_need = rec * LEDGER_B
    led_room = q - FLOOR
    msg = (f"budget {tag}: C: free {c/GB:.1f} GB, Q: free {q/GB:.1f} GB, ubuntu vhdx {vhdx/GB:.1f} GB, "
           f"WSL used {used/GB:.1f} GB (df avail {wsl_free/GB:.1f}); run folders need {run_need/GB:.1f} GB "
           f"of room {run_room/GB:.1f}; ledger x3 needs {led_need/GB:.1f} GB of Q: room {led_room/GB:.1f}")
    log(msg)
    if c < C_FLOOR or q < FLOOR:
        raise d.Fail("host disk below floor (C: 15 GB, Q: 25 GB): " + msg)
    if vhdx - VHDX_START > VHDX_GROW:
        raise d.Fail(f"ubuntu vhdx grew {(vhdx - VHDX_START)/GB:.2f} GB since night start (> 2 GB): " + msg)
    if run_need > min(run_room, wsl_free) or led_need > led_room:
        raise d.Fail("disk budget does not fit: " + msg)


_reset = d.reset


def reset(voters, positions, tag):
    budget(tag)
    return _reset(voters, positions, tag)


d.reset = reset
_campaign = n1.campaign


def campaign(body, tag, poll=60):
    res = _campaign(body, tag, poll)
    for r in res[1].get("reps", []):
        p = os.path.join(d.RUNS, r["run_id"], "ballots.csv")
        if os.path.exists(p):
            sz = os.path.getsize(p)
            os.remove(p)
            log(f"deleted {p} ({sz} bytes)")
    return res


n1.campaign = campaign


def step(label, voters, reps):
    def go():
        PLAN["records"] = voters * reps
        return n1.tier(label, voters, 1, 0, reps)
    return go


STEPS = {"sp1m": step("SP-1M", 1000000, 3), "sp192m": step("SP-1.92M", 1921917, 1)}
ORDER = ["sp1m", "sp192m"]


def main():
    what = sys.argv[1]
    for st in (ORDER if what == "all" else [what]):
        if what == "all" and st in d.state().get("done", []):
            continue
        if os.path.exists(os.path.join(OUT, "STOP")):
            log(f"=== STOP file present: stopping cleanly before {st}")
            return
        log(f"=== STEP {st} begin")
        try:
            res = STEPS[st]()
        except Exception as e:  # noqa: BLE001
            log(f"=== STEP {st} FAILED: {type(e).__name__}: {e}")
            sys.exit(1)
        s = d.state()
        s.setdefault("done", []).append(st)
        s[st + "-result"] = res
        d.save("state.json", s)
        log(f"=== STEP {st} DONE {json.dumps(res)[:600]}")
    log("=== ALL DONE")


if __name__ == "__main__":
    main()
