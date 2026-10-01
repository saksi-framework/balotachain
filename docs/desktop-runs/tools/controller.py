"""Chapter 4 capstone 1 controller (SP-1.92M: warm-up, gate timings, m1, m2, m3).

Runs on Windows (pythonw) so it survives `wsl --shutdown`. Talks to the saksi console
through `wsl -e curl` (the reset route answers loopback only). State and log live
beside this file; STOP in this folder holds the queue (a warm-up is cancelled, a
measured run finishes first).

Usage: pythonw controller.py            run / resume the queue
       python controller.py selftest    parser checks
"""
import csv, json, os, re, shutil, statistics, subprocess, sys, threading, time, zipfile
from datetime import datetime, timezone

HERE = r"C:\Users\User\ch4-capstone"
STATE = os.path.join(HERE, "state.json")
LOG = os.path.join(HERE, "controller.log")
STOP = os.path.join(HERE, "STOP")
STUDY_LOG = r"Q:\Code - LAPTOP\Code\projects\balotachain\.superpowers\sdd\2026-09-14-study-grade-wizard\ch4-study-log.md"
REPO = r"Q:\Code - LAPTOP\Code\projects\balotachain-n2"
EVID = os.path.join(REPO, "docs", "desktop-runs", "2026-10-01-sp-1.92m")
COMPACT_LOG = r"C:\Users\User\saksi-compact.log"
DOCKER_VHDX = r"Q:\DockerDesktop\DockerDesktopWSL\disk\docker_data.vhdx"
UBUNTU_VHDX = r"C:\Users\User\AppData\Local\wsl\{57faff8d-2e04-40cc-9b2e-b5f27e165d0b}\ext4.vhdx"
UBUNTU_VHDX_START = 214485172224
DOCKER_EXE = r"C:\Users\User\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
WSL_HOME_UNC = r"\\wsl.localhost\Ubuntu\home\user"
RUNS_UNC = WSL_HOME_UNC + r"\.saksi\campaign\runs"
BASE = "http://127.0.0.1:8090"
NOWIN = 0x08000000  # CREATE_NO_WINDOW: pythonw must not flash consoles at the user
GB = 1e9
PER_RECORD = 101e3  # host Q: bytes per on-chain record (SP-1M, study log 14:48)
MARGIN = 40 * GB

VOTERS, POSITIONS = 1921917, 1
TRUSTEES = ["COMELEC", "Civil Society Watch", "University IT", "Academe Observer", "Bar Association"]
QUEUE = ["warmup", "gate", "m1", "m2", "m3"]
GATE_TIERS = [(p, v) for p in ("SP", "MP") for v in
              (1000, 10000, 50000, 483000, 1000000, 1921917, 3524078)]
TIER_NAME = {1000: "1K", 10000: "10K", 50000: "50K", 483000: "483K", 1000000: "1M",
             1921917: "1.92M", 3524078: "3.5M"}


class Fail(Exception):
    pass


class Crash(Exception):
    pass


# ---------------------------------------------------------------- plumbing
def now():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def log(msg, study=False):
    line = f"{now()} {msg}"
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    if study:
        with open(STUDY_LOG, "a", encoding="utf-8") as f:
            f.write(f"- **{time.strftime('%H:%M')}** {msg}\n")


def state():
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save(s):
    tmp = STATE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(s, f, indent=2)
    os.replace(tmp, STATE)


def mark(**kw):
    s = state()
    s.update(kw)
    save(s)


def run(args, timeout=120, input=None):
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=input,
                           creationflags=NOWIN, encoding="utf-8", errors="replace")
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    except OSError as e:
        return 127, "", str(e)


def wsl(cmd, timeout=120, input=None):
    return run(["wsl", "-d", "Ubuntu", "-e", "bash", "-c", cmd], timeout, input)


def req(method, path, body=None, timeout=60):
    cmd = f"curl -s -m {timeout} -X {method} -w '\\n%{{http_code}}' '{BASE}{path}'"
    if body is not None:
        cmd += " -H 'Content-Type: application/json' --data-binary @-"
    rc, out, err = wsl(cmd, timeout + 30, json.dumps(body) if body is not None else None)
    if rc != 0 or "\n" not in out:
        return 0, f"curl rc {rc} {err[:200]}"
    text, code = out.rsplit("\n", 1)
    try:
        code = int(code)
    except ValueError:
        return 0, out[:200]
    try:
        return code, json.loads(text)
    except ValueError:
        return code, text


def console_up():
    code, _ = req("GET", "/api/campaigns", timeout=20)
    return code == 200


def docker_up():
    return run(["docker", "info", "--format", "{{.ServerVersion}}"], 60)[0] == 0


def disk():
    c = shutil.disk_usage("C:\\").free
    q = shutil.disk_usage("Q:\\").free
    dv = os.path.getsize(DOCKER_VHDX) if os.path.exists(DOCKER_VHDX) else 0
    uv = os.path.getsize(UBUNTU_VHDX)
    return c, q, dv, uv


def disk_guard():
    c, q, dv, uv = disk()
    if c < 15 * GB:
        raise Fail(f"C: free {c/GB:.1f} GB < 15 GB")
    if uv - UBUNTU_VHDX_START > 2 * GB and c < 25 * GB:
        raise Fail(f"Ubuntu vhdx grew {(uv-UBUNTU_VHDX_START)/GB:.2f} GB with C: at {c/GB:.1f} GB")


def disk_line():
    c, q, dv, uv = disk()
    return f"C: {c/GB:.1f} GB free, Q: {q/GB:.1f} GB free, docker vhdx {dv/GB:.1f} GB, ubuntu vhdx {uv/GB:.2f} GB"


# ---------------------------------------------------------------- bring-up
def wait_backup():
    last = -1
    while True:
        rc, out, _ = wsl("pgrep -x tar >/dev/null && echo busy; stat -c %s /mnt/q/thesis-backup/wsl-thesis-data-2026-10-01.tar 2>/dev/null")
        busy = "busy" in out
        size = int(out.split()[-1]) if out.split() and out.split()[-1].isdigit() else 0
        if not busy and size == last:
            log(f"backup finished: tar {size/GB:.1f} GB, no tar process", study=True)
            return
        if busy or size != last:
            last = size
        time.sleep(120)


def compact():
    start = os.path.getsize(COMPACT_LOG) if os.path.exists(COMPACT_LOG) else 0
    log(f"compaction task start ({disk_line()})", study=True)
    rc, out, err = run(["schtasks", "/run", "/tn", "SaksiCompactDocker"], 60)
    if rc != 0:
        raise Fail(f"schtasks /run failed: {out} {err}")
    deadline = time.time() + 3600
    while time.time() < deadline:
        time.sleep(30)
        with open(COMPACT_LOG, encoding="utf-8", errors="replace") as f:
            f.seek(start)
            new = f.read()
        if "docker relaunched" in new:
            log("compaction done: " + " | ".join(l for l in new.splitlines() if l.startswith("20"))[-400:], study=True)
            return
    raise Fail("compaction task did not report 'docker relaunched' within 1 h")


def wait_docker(limit=900):
    t = time.time()
    while time.time() - t < limit:
        if docker_up():
            return True
        time.sleep(15)
    return False


FABRIC = re.compile(r"(example\.com|^dev-peer|saksi)")


def start_fabric():
    rc, out, _ = run(["docker", "ps", "-a", "--format", "{{.Names}}"], 60)
    names = [n for n in out.split() if FABRIC.search(n)]
    if names:
        rc, o, e = run(["docker", "start"] + names, 300)
        log(f"docker start {names} -> rc {rc} {e.strip()[:200]}")


def bringup():
    """Docker, Fabric, console (tmux `console`, SAKSI_PHASE_TIMEOUT=8h, PowerShell on PATH)."""
    if not wait_docker():
        raise Crash("docker not up after 15 min")
    start_fabric()
    if console_up():
        return
    for _ in range(40):  # up.sh must see the running peers, or it builds a fresh network
        if wsl("docker ps >/dev/null", 60)[0] == 0:
            break
        time.sleep(15)
    else:
        raise Crash("docker not usable inside WSL")
    rc, out, err = wsl("PT=8h bash ~/bringup5.sh", 900)
    log(f"bringup5 (PT=8h) rc {rc}: {out.strip()[-500:]}", study=True)
    for _ in range(40):
        if console_up():
            return
        time.sleep(15)
    raise Crash("console not reachable after bringup")


def ensure_room(records):
    need = records * PER_RECORD + MARGIN
    c, q, dv, uv = disk()
    log(f"disk check: need {need/GB:.1f} GB on Q: (records {records} x 101 KB + 40 GB); {disk_line()}", study=True)
    if q >= need:
        return
    # A compaction only frees what the guest has freed: wipe the old ledger first.
    if docker_up() and console_up():
        reset(VOTERS, POSITIONS, "pre-compaction wipe")
    compact()
    bringup()
    c, q, dv, uv = disk()
    if q < need:
        raise Fail(f"Q: {q/GB:.1f} GB free after compaction, need {need/GB:.1f} GB")


# ---------------------------------------------------------------- console API
def reset(voters, positions, why):
    code, b = req("POST", "/api/network/reset", {"voters": voters, "positions": positions, "confirm": "RESET"})
    if code != 202:
        raise Fail(f"reset ({why}): {code} {b}")
    job = b["job"]
    while True:
        time.sleep(30)
        _, j = req("GET", "/api/jobs/" + job)
        if isinstance(j, dict) and j.get("status") not in ("queued", "running"):
            break
    res = j.get("result") or {}
    if j.get("status") != "done" or not res.get("chain_height"):
        raise Fail(f"reset {job} {j.get('status')} {j.get('error')} {res}")
    log(f"reset ({why}) {job} done, chain height {res.get('chain_height')}, {res.get('duration_ms')} ms", study=True)
    return job


def preflight(tag):
    t0 = time.time()
    while True:
        code, p = req("GET", f"/api/preflight?mode=onchain&voters={VOTERS}&positions={POSITIONS}"
                             f"&candidates=4&concurrency=128", timeout=60)
        if code == 200 and isinstance(p, dict):
            h = p.get("host", {})
            codes = [w["code"] for w in p.get("warnings", [])]
            cpu = h.get("host_cpu_pct")
            ok = (not codes and p["fabric"].get("reachable") and p["ladder"].get("ok")
                  and cpu is not None and cpu < 25)
            if ok:
                log(f"preflight {tag} green: host CPU {cpu:.1f} %, load1 {h.get('guest_load1')}, "
                    f"phase_timeout {p.get('phase_timeout')}", study=True)
                return p
            if any(c.startswith("disk_") or c.startswith("phase_timeout") for c in codes) or \
                    (codes and time.time() - t0 > 900):
                raise Fail(f"preflight {tag}: {codes}")
            if int(time.time() - t0) % 300 < 30:
                log(f"preflight {tag} not green yet: host CPU {cpu} warnings {codes}")
        time.sleep(30)


def cfg(name):
    return {"name": name, "trustees": [{"name": t} for t in TRUSTEES], "threshold": 3,
            "positions": POSITIONS, "candidates": 4, "voters": VOTERS, "distribution": "realistic",
            "senate_seats": 0, "concurrency": 128, "send_rate": 0, "skip_attacks": True,
            "mode": "onchain", "attack_plan": None}


def wait_idle(run_id, poll=20):
    while True:
        time.sleep(poll)
        code, st = req("GET", f"/api/runs/{run_id}/status")
        if code == 200 and isinstance(st, dict) and not st.get("busy"):
            return


def journal(run_id):
    out = []
    try:
        with open(os.path.join(RUNS_UNC, run_id, "journal.ndjson"), encoding="utf-8") as f:
            for line in f:
                try:
                    out.append(json.loads(line))
                except ValueError:
                    pass
    except OSError:
        pass
    return out


def ts(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()


# ---------------------------------------------------------------- sampler
class Sampler:
    """Every 10 s: docker stats, WSL meminfo/loadavg, Windows counters (one long-lived
    typeperf, the same PDH counters Get-Counter reads), C:/Q: free and both VHDX sizes.
    Long format rows: unix_ts,iso,metric,value."""

    COUNTERS = [r"\Processor(_Total)\% Processor Time", r"\Memory\Available MBytes",
                r"\PhysicalDisk(*)\% Disk Time", r"\PhysicalDisk(*)\Current Disk Queue Length",
                r"\Process(vmmem*)\% Processor Time"]  # the WSL VM running the run itself

    def __init__(self, path):
        self.path, self.stop_ev, self.latest = path, threading.Event(), {}
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.tp = subprocess.Popen(["typeperf"] + self.COUNTERS + ["-si", "10"], stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL, text=True, creationflags=NOWIN)
        threading.Thread(target=self._typeperf, daemon=True).start()
        self.t = threading.Thread(target=self._loop, daemon=True)
        self.t.start()

    def _typeperf(self):
        hdr = None
        for line in self.tp.stdout:
            row = next(csv.reader([line.strip()]), [])
            if len(row) < 2:
                continue
            if hdr is None:
                hdr = row
                continue
            vals = {}
            for h, v in zip(hdr[1:], row[1:]):
                try:
                    vals["win." + h.split("\\", 3)[-1].replace(",", ";")] = float(v)
                except ValueError:
                    pass
            self.latest = vals

    def _loop(self):
        new = not os.path.exists(self.path)
        with open(self.path, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if new:
                w.writerow(["unix_ts", "iso", "metric", "value"])
            while not self.stop_ev.is_set():
                t0 = time.time()
                try:
                    rows = sample()
                    rows.update(self.latest)
                except Exception as e:  # noqa: BLE001 - a bad sample must not end the sampler
                    rows = {"sampler.error": str(e)[:100]}
                iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(t0))
                for k, v in rows.items():
                    w.writerow([f"{t0:.0f}", iso, k, v])
                f.flush()
                self.stop_ev.wait(max(1, 10 - (time.time() - t0)))

    def stop(self):
        self.stop_ev.set()
        self.t.join(30)
        self.tp.kill()


UNITS = {"B": 1, "kB": 1e3, "KB": 1e3, "MB": 1e6, "GB": 1e9, "TB": 1e12,
         "KiB": 1024, "MiB": 1024 ** 2, "GiB": 1024 ** 3, "TiB": 1024 ** 4}


def to_bytes(s):
    m = re.match(r"\s*([\d.]+)\s*([A-Za-z]*)", s)
    return float(m.group(1)) * UNITS.get(m.group(2) or "B", 1) if m else 0.0


def parse_docker_stats(out):
    rows = {}
    for line in out.splitlines():
        p = line.split("|")
        if len(p) != 4:
            continue
        n = p[0]
        rows[f"docker.{n}.cpu_pct"] = float(p[1].rstrip("%") or 0)
        rows[f"docker.{n}.mem_bytes"] = to_bytes(p[2].split("/")[0])
        r, w = (p[3].split("/") + ["0"])[:2]
        rows[f"docker.{n}.blk_read_bytes"] = to_bytes(r)
        rows[f"docker.{n}.blk_write_bytes"] = to_bytes(w)
    return rows


def parse_meminfo(out):
    rows, lines = {}, out.strip().splitlines()
    for line in lines:
        k, _, v = line.partition(":")
        if k in ("MemTotal", "MemAvailable", "SwapTotal", "SwapFree", "Dirty"):
            rows[f"wsl.{k}_kb"] = int(v.split()[0])
    if lines and ":" not in lines[-1]:
        la = lines[-1].split()
        rows["wsl.load1"], rows["wsl.load5"] = float(la[0]), float(la[1])
    return rows


def sample():
    rows = {}
    rc, out, _ = run(["docker", "stats", "--no-stream", "--format",
                      "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.BlockIO}}"], 30)
    if rc == 0:
        rows.update(parse_docker_stats(out))
    rc, out, _ = wsl("cat /proc/meminfo /proc/loadavg", 30)
    if rc == 0:
        rows.update(parse_meminfo(out))
    c, q, dv, uv = disk()
    rows.update({"host.c_free_bytes": c, "host.q_free_bytes": q,
                 "host.docker_vhdx_bytes": dv, "host.ubuntu_vhdx_bytes": uv})
    return rows


def load_resources(path):
    data = {}
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            try:
                data.setdefault(r["metric"], []).append((float(r["unix_ts"]), float(r["value"])))
            except ValueError:
                pass
    return data


def resources_summary(path, win):
    """Peaks over the whole run and means/peaks inside the ballot window; a bottleneck
    is named only when the evidence shows one."""
    data = load_resources(path)
    lines, flags = [], []

    def inwin(vals):
        return [v for t, v in vals if win and win[0] <= t <= win[1]]

    lines.append(f"{'metric':60s} {'run peak':>14s} {'window mean':>14s} {'window peak':>14s}")
    for k in sorted(data):
        if k.endswith("blk_read_bytes") or k.endswith("blk_write_bytes"):
            continue
        allv = [v for _, v in data[k]]
        wv = inwin(data[k])
        lines.append(f"{k:60s} {max(allv):14.1f} {statistics.mean(wv) if wv else float('nan'):14.1f} "
                     f"{max(wv) if wv else float('nan'):14.1f}")
    for k in sorted(data):
        if k.endswith("blk_write_bytes") or k.endswith("blk_read_bytes"):
            v = data[k]
            lines.append(f"{k:60s} total {(v[-1][1]-v[0][1])/GB:.2f} GB over the run (cumulative counter)")
    cpu = inwin(data.get(r"win.Processor(_Total)\% Processor Time", []))
    # Contention = host CPU NOT spent by the WSL VM (which runs the measured run itself).
    # vmmem's process counter is per-core percent, so it is normalised by the CPU count.
    vm = {t: v / (os.cpu_count() or 16) for k, vals in data.items()
          if k.startswith("win.Process(vmmem") for t, v in vals}
    host_only = [(v - vm[t]) for t, v in data.get(r"win.Processor(_Total)\% Processor Time", [])
                 if win and win[0] <= t <= win[1] and t in vm]
    hot = [v for v in host_only if v > 25]
    mem = data.get(r"win.Memory\Available MBytes", [])
    if mem and min(v for _, v in mem) < 2048:
        flags.append(f"Windows available memory fell to {min(v for _, v in mem):.0f} MB")
    wa = data.get("wsl.MemAvailable_kb", [])
    if wa and min(v for _, v in wa) < 2e6:
        flags.append(f"WSL MemAvailable fell to {min(v for _, v in wa)/1e6:.2f} GB")
    for k, v in data.items():
        if "Disk Time" in k and "_Total" not in k:
            wv = inwin(v)
            if wv and statistics.mean(wv) > 80:
                flags.append(f"{k} mean {statistics.mean(wv):.0f} % busy in the ballot window")
        if "Queue Length" in k and "_Total" not in k:
            wv = inwin(v)
            if wv and statistics.mean(wv) > 2:
                flags.append(f"{k} mean queue {statistics.mean(wv):.1f} in the ballot window")
    l1 = inwin(data.get("wsl.load1", []))
    if l1 and statistics.mean(l1) > 14:
        flags.append(f"WSL load1 mean {statistics.mean(l1):.1f} of 16 CPUs in the ballot window")
    peers = {k: max(inwin(v) or [0]) for k, v in data.items() if k.startswith("docker.") and k.endswith("cpu_pct")}
    top = sorted(peers.items(), key=lambda x: -x[1])[:3]
    head = [f"ballot window: {fmt_ts(win[0]) if win else '?'} to {fmt_ts(win[1]) if win else '?'}",
            f"host CPU samples in window: {len(cpu)}, max {max(cpu) if cpu else float('nan'):.1f} % (includes the WSL VM)",
            f"host CPU minus the WSL VM (vmmemWSL / CPUs): {len(host_only)} samples, max "
            f"{max(host_only) if host_only else float('nan'):.1f} %, over 25 % (contended): {len(hot)}",
            "top container CPU peaks in window: " + ", ".join(f"{k[7:-8]} {v:.0f} %" for k, v in top),
            "bottleneck: " + ("; ".join(flags) if flags else "none evident from host evidence (no memory, disk-busy, queue or CPU saturation flag)")]
    return "\n".join(head) + "\n\n" + "\n".join(lines) + "\n", hot


def fmt_ts(t):
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t))


# ---------------------------------------------------------------- one run
def label_name(label):
    return f"SP-1.92M ch4 {label.replace('-', ' ')}"


def wsl_dir(label):
    return f"/home/user/ch4/capstone/{label}"


def win_dir(label):
    return os.path.join(HERE, label)


def stop_requested():
    return os.path.exists(STOP)


def hold():
    if not stop_requested():
        return
    log("STOP file present: holding before the next step", study=True)
    while stop_requested():
        time.sleep(60)
    log("STOP file removed: continuing", study=True)


def do_run(label, measured):
    s = state()
    cur = s.get("current")
    if cur and cur.get("label") == label and cur.get("cid"):
        return recover(cur, measured)
    disk_guard()
    ensure_room(VOTERS)
    bringup()
    job = reset(VOTERS, POSITIONS, label)
    pf = preflight(label)
    os.makedirs(win_dir(label), exist_ok=True)
    wsl(f"mkdir -p {wsl_dir(label)}")
    with open(os.path.join(win_dir(label), "preflight.json"), "w") as f:
        json.dump(pf, f, indent=2)
    sampler = Sampler(os.path.join(win_dir(label), "resources.csv"))
    try:
        code, b = req("POST", "/api/campaigns", {"config": cfg(label_name(label)), "warmups": 0, "reps": 1})
        if code != 202:
            raise Fail(f"campaign {label}: {code} {b}")
        cid = b["campaign"]
        cur = {"label": label, "cid": cid, "reset": job, "started": time.time(), "resumed": False}
        mark(current=cur)
        log(f"{label_name(label)}: campaign {cid} started ({disk_line()})", study=True)
        c = poll_campaign(cur, measured)
    finally:
        sampler.stop()
    return finish(cur, c, measured)


def poll_campaign(cur, measured):
    bad, cancelled = 0, False
    while True:
        time.sleep(60)
        disk_guard()
        if stop_requested() and not measured and not cancelled:
            run_id = cur.get("run") or current_run(cur["cid"])
            log(f"STOP during warm-up: cancelling run {run_id} and campaign {cur['cid']}", study=True)
            req("POST", f"/api/campaigns/{cur['cid']}/cancel")
            if run_id:
                req("POST", "/cancel", {"run_id": run_id})
            cancelled = True
        code, c = req("GET", "/api/campaigns/" + cur["cid"])
        if code == 200 and isinstance(c, dict):
            bad = 0
            if not cur.get("run"):
                rid = current_run(cur["cid"], c)
                if rid:
                    cur["run"] = rid
                    mark(current=cur)
                    log(f"{cur['label']}: run {rid}")
            if c.get("status") != "running":
                if cancelled:
                    raise Fail("warm-up cancelled by STOP")
                return c
            continue
        bad += 1
        if bad >= 3:
            raise Crash(f"console unreachable for 3 polls (docker up: {docker_up()})")


def current_run(cid, c=None):
    if c is None:
        _, c = req("GET", "/api/campaigns/" + cid)
    reps = (c or {}).get("reps") or [] if isinstance(c, dict) else []
    return reps[-1].get("run_id") if reps else None


def recover(cur, measured):
    """Power-cut / crash policy: containers started (no reset), console restarted, then
    resume the phase that was cut. Throughput comes from the journal's segments."""
    log(f"recovering {cur['label']} (campaign {cur['cid']}, run {cur.get('run')})", study=True)
    bringup()
    code, c = req("GET", "/api/campaigns/" + cur["cid"])
    if code == 200 and isinstance(c, dict) and c.get("status") == "running":
        sampler = Sampler(os.path.join(win_dir(cur["label"]), "resources.csv"))
        try:
            c = poll_campaign(cur, measured)
        finally:
            sampler.stop()
        if c.get("status") == "done":
            return finish(cur, c, measured)
    run_id = cur.get("run") or current_run(cur["cid"])
    if not run_id:
        log("no run id: nothing reached the ledger; redoing the run from reset", study=True)
        mark(current=None)
        return do_run(cur["label"], measured)
    ev = [e.get("event") for e in journal(run_id)]
    if "stage.ballots.start" not in ev:
        log(f"{run_id} cut before its ballot window (generate): redoing from reset", study=True)
        mark(current=None)
        return do_run(cur["label"], measured)
    cur["resumed"] = True
    mark(current=cur)
    sampler = Sampler(os.path.join(win_dir(cur["label"]), "resources.csv"))
    try:
        if "stage.ballots.end" not in ev or "stage.submit.end" not in ev:
            for i in range(3):
                code, b = req("POST", f"/api/runs/{run_id}/resume")
                log(f"resume #{i+1} {run_id} -> {code} {str(b)[:200]}", study=True)
                if code != 202:
                    break
                wait_idle(run_id)
                _, runs = req("GET", "/runs")
                me = next((x for x in runs if x.get("run_id") == run_id or x.get("id") == run_id), {}) \
                    if isinstance(runs, list) else {}
                if me.get("status") not in ("interrupted", "close-pending") and not me.get("resumable"):
                    break
        code, b = req("POST", f"/api/runs/{run_id}/verify-only", {"run_id": run_id})
        log(f"verify-only {run_id} -> {code} {str(b)[:200]}", study=True)
        if code == 202:
            wait_idle(run_id)
        code, st = req("GET", "/api/ceremony/" + run_id)
        if code == 200 and isinstance(st, dict) and st.get("trustees"):
            for t in st["trustees"][:3]:
                code, b = req("POST", "/ceremony/submit", {"run_id": run_id, "trustee_id": t["id"]})
                log(f"ceremony/submit {t['id']} -> {code} {str(b)[:150]}")
                if code == 202:
                    wait_idle(run_id)
            code, b = req("POST", "/ceremony/publish", {"run_id": run_id})
            log(f"ceremony/publish -> {code} {str(b)[:150]}")
            if code == 202:
                wait_idle(run_id)
        code, b = req("POST", "/verify", {"run_id": run_id})
        log(f"verify {run_id} -> {code} {str(b)[:200]}", study=True)
        if code == 202:
            wait_idle(run_id)
    finally:
        sampler.stop()
    _, c = req("GET", "/api/campaigns/" + cur["cid"])
    return finish(cur, c if isinstance(c, dict) else {}, measured)


def finish(cur, c, measured):
    label, cid = cur["label"], cur["cid"]
    run_id = cur.get("run") or current_run(cid, c)
    reps = c.get("reps") or []
    r = reps[-1] if reps else {}
    log(f"{label_name(label)}: campaign {cid} {c.get('status')} error={c.get('error')} run {run_id} "
        f"tps {r.get('committed_tps')} p99 {r.get('latency_p99_ms')} failed {r.get('failed')} "
        f"{r.get('fail_reason', '')} resumed {cur.get('resumed')}", study=True)
    jr = journal(run_id) if run_id else []
    starts = [ts(e["ts"]) for e in jr if e.get("event") in ("stage.ballots.start", "segment.start")]
    ends = [ts(e["ts"]) for e in jr if e.get("event") in ("stage.ballots.end", "segment.end")]
    win = (min(starts), max(ends)) if starts and ends else None
    segs = [e for e in jr if e.get("event") == "segment.end"]
    d = win_dir(label)
    summary, hot = resources_summary(os.path.join(d, "resources.csv"), win)
    with open(os.path.join(d, "resources-summary.txt"), "w", encoding="utf-8") as f:
        f.write(summary)
    log(f"{label}: resources: " + " | ".join(summary.splitlines()[:4]), study=True)
    # export, evidence, ballots.csv
    code, out, err = wsl(f"mkdir -p {wsl_dir(label)} && curl -s -m 1800 -o {wsl_dir(label)}/{cid}.zip "
                         f"-w '%{{http_code}}' '{BASE}/api/campaigns/{cid}/export'", 1900)
    log(f"export {cid} -> http {out.strip()} rc {code}", study=True)
    ev_sh = (f"cd {wsl_dir(label)} && mkdir -p logs && cd logs && for c in peer0.org1.example.com peer0.org2.example.com orderer.example.com; do "
             f"docker logs --timestamps $c > $c.log 2>&1; gzip -f $c.log; done; "
             f"for c in peer0.org1.example.com peer0.org2.example.com; do echo $c $(docker exec $c du -sb /var/hyperledger/production); done; "
             f"echo orderer.example.com $(docker exec orderer.example.com du -sb /var/hyperledger/production/orderer); "
             f"docker exec peer0.org1.example.com df -B1 /var/hyperledger/production | tail -1")
    rc, out, err = wsl(ev_sh, 3600)
    ledger = time.strftime("%Y-%m-%dT%H:%M:%S%z\n") + out + err
    log(f"{label}: ledger du: " + out.replace("\n", " | ")[:600], study=True)
    if run_id:
        rc, o, e = wsl(f"p=~/.saksi/campaign/runs/{run_id}/ballots.csv; [ -f $p ] && stat -c %s $p && rm -f $p")
        log(f"deleted {run_id}/ballots.csv ({o.strip()} bytes)" if o.strip() else f"{run_id}: no ballots.csv to delete")
    wsl(f"cp '/mnt/c/Users/User/ch4-capstone/{label}/resources.csv' '/mnt/c/Users/User/ch4-capstone/{label}/resources-summary.txt' {wsl_dir(label)}/")
    rec = {"label": label, "campaign": cid, "run": run_id, "status": c.get("status"),
           "tps": r.get("committed_tps"), "p99": r.get("latency_p99_ms"), "failed": r.get("failed"),
           "resumed": cur.get("resumed"), "hot_samples": len(hot), "window": win,
           "segments": [{k: s.get(k) for k in ("index", "tps", "committed", "window_ms")} for s in segs],
           "duration_s": time.time() - cur["started"], "ledger": ledger, "disk_after": disk_line()}
    copy_evidence(rec, summary)
    s = state()
    s.setdefault("results", []).append(rec)
    s["current"] = None
    save(s)
    return rec


def copy_evidence(rec, summary):
    label = rec["label"]
    dest = os.path.join(EVID, label)
    os.makedirs(dest, exist_ok=True)
    z = os.path.join(WSL_HOME_UNC, "ch4", "capstone", label, rec["campaign"] + ".zip")
    try:
        with zipfile.ZipFile(z) as zf:
            zf.extractall(dest)
    except (OSError, zipfile.BadZipFile) as e:
        log(f"{label}: export unzip failed: {e}", study=True)
    shutil.copy(os.path.join(win_dir(label), "resources.csv"), dest)
    shutil.copy(os.path.join(win_dir(label), "preflight.json"), os.path.join(dest, "preflight-controller.json"))
    with open(os.path.join(dest, "resources-summary.txt"), "w", encoding="utf-8") as f:
        f.write(summary)
    with open(os.path.join(dest, "ledger-size.txt"), "w", encoding="utf-8") as f:
        f.write(rec["ledger"])
    with open(LOG, encoding="utf-8") as f:
        lines = [l for l in f if label in l or "compaction" in l or "reset" in l]
    with open(os.path.join(dest, "controller-log.txt"), "w", encoding="utf-8") as f:
        f.writelines(lines[-200:])
    seg = "; ".join(f"segment {s['index']}: {s['tps']:.1f} TPS, {s['committed']} committed, {s['window_ms']/1000:.0f} s"
                    for s in rec["segments"] if s.get("tps") is not None and s.get("window_ms") is not None)
    note = (f"# {label_name(label)} (capstone 1, saksi 4a38a54)\n\n"
            f"Generated by `C:\\Users\\User\\ch4-capstone\\controller.py` at {now()}. "
            f"{'Warm-up: a full run, discarded from the statistics.' if label == 'warmup' else 'Measured repetition.'}\n\n"
            f"| | |\n|---|---|\n"
            f"| Election name | `{label_name(label)}` |\n| Campaign | `{rec['campaign']}` ({rec['status']}) |\n"
            f"| Run | `{rec['run']}` |\n| committed_tps | {rec['tps']} |\n| p99 ms | {rec['p99']} |\n"
            f"| Failed | {rec['failed']} |\n| Resumed | {rec['resumed']} |\n| Segments | {seg or '-'} |\n"
            f"| Host CPU samples > 25 % in the ballot window | {rec['hot_samples']} |\n"
            f"| Wall time (reset to export) | {rec['duration_s']/60:.0f} min |\n| Disk after | {rec['disk_after']} |\n\n"
            f"## Resources (10 s sampler, `resources.csv`)\n\n```\n{summary[:6000]}```\n\n"
            f"## Ledger size\n\n```\n{rec['ledger']}```\n\n"
            f"The peer and orderer `docker logs` stay in WSL at `~/ch4/capstone/{label}/logs/` (too large for git); "
            f"the run's `ballots.csv` was deleted after the export and `ballots.ndjson` kept.\n")
    with open(os.path.join(dest, "NOTE.md"), "w", encoding="utf-8") as f:
        f.write(note)
    commit(f"docs(desktop-runs): SP-1.92M capstone {label} ({rec['run']})")


def commit(msg):
    run(["git", "-C", REPO, "add", "docs/desktop-runs"], 120)
    rc, out, err = run(["git", "-C", REPO, "commit", "-q", "-m",
                        msg + "\n\nCo-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"], 120)
    log(f"commit '{msg}' -> rc {rc} {err.strip()[:200]}")


# ---------------------------------------------------------------- gate timings
def gate():
    rows = state().get("gate_rows", [])
    done = {(r["tier"]) for r in rows}
    bringup()
    for pos_label, voters in GATE_TIERS:
        tier = f"{pos_label}-{TIER_NAME[voters]}"
        if tier in done:
            continue
        positions = 1 if pos_label == "SP" else 3
        c = cfg(f"{tier} ch4 gate")
        c.update({"voters": voters, "positions": positions, "mode": "groundtruth"})
        code, b = req("POST", "/generate", c)
        if code != 202:
            raise Fail(f"gate generate {tier}: {code} {b}")
        run_id = b["run_id"]
        wait_idle(run_id, poll=5)
        secs, wall = [], []
        for _ in range(3):
            t0 = time.time()
            code, chk = req("GET", "/api/check/" + run_id, timeout=600)
            wall.append(time.time() - t0)
            ends = [e for e in journal(run_id) if e.get("event") == "stage.check.end"]
            if code != 200 or not isinstance(chk, dict) or not chk.get("pass") or not ends:
                raise Fail(f"gate check {tier}: {code} {str(chk)[:300]}")
            secs.append(ends[-1]["mono_ms"] / 1000)
        rows_audited = ends[-1].get("rows")
        med = statistics.median(secs)
        row = {"tier": tier, "run": run_id, "voters": voters, "positions": positions,
               "records": voters * positions, "rows": rows_audited, "seconds": secs, "median_s": med,
               "rows_per_s": rows_audited / med if med else None, "client_wall_s": wall,
               "checks": len(chk.get("checks", []))}
        rows.append(row)
        mark(gate_rows=rows)
        log(f"gate {tier}: {rows_audited} rows, check {secs} s (median {med:.3f}), "
            f"{row['rows_per_s'] or 0:,.0f} rows/s, {row['checks']} checks pass", study=True)
    table = ["| Tier | Voters (table rows) | Ballot records | Check s (median of 3) | Rows per second | Run |",
             "|---|---|---|---|---|---|"]
    for r in rows:
        table.append(f"| {r['tier']} | {r['rows']:,} | {r['records']:,} | {r['median_s']:.3f} | "
                     f"{(r['rows_per_s'] or 0):,.0f} | `{r['run']}` |")
    text = ("# Validation-gate timing (adviser W3 #3)\n\nThe seven-check, fail-closed data validation "
            "(`GET /api/check/<run>`, journal `stage.check.start`..`stage.check.end`) timed alone, on "
            "groundtruth-mode populations (no cryptography), between capstone runs on an idle network. "
            "Seconds are the console's own `mono_ms` for the check stage; each tier was checked three times.\n\n"
            + "\n".join(table) + "\n")
    os.makedirs(EVID, exist_ok=True)
    with open(os.path.join(EVID, "validation-gate-timing.md"), "w", encoding="utf-8") as f:
        f.write(text)
    with open(os.path.join(EVID, "validation-gate-timing.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)
    commit("docs(desktop-runs): validation-gate timing per tier (SP/MP 1K-3.5M)")
    log("gate timings done:\n" + "\n".join(table), study=True)


# ---------------------------------------------------------------- main
def main():
    s = state()
    if not s.get("started"):
        mark(started=now(), crashes=0)
    log("controller start (pid %d)" % os.getpid())
    wait_backup()
    i = 0
    while i < len(QUEUE):
        step = QUEUE[i]
        s = state()
        if step in s.get("done", []):
            i += 1
            continue
        hold()
        measured = step.startswith("m")
        label = s.get("rerun_label", {}).get(step, step)
        try:
            if step == "gate":
                gate()
                res = None
            else:
                res = do_run(label, measured)
        except Crash as e:
            s = state()
            s["crashes"] = s.get("crashes", 0) + 1
            save(s)
            log(f"CRASH #{s['crashes']} during {label}: {e}", study=True)
            if s["crashes"] >= 3:
                log("third crash: stopping the campaign", study=True)
                return
            if not docker_up():
                rc, o, e2 = run(["powershell", "-NoProfile", "-Command", f"Start-Process '{DOCKER_EXE}'"], 60)
                log(f"Docker Desktop relaunched (rc {rc})", study=True)
                if not wait_docker(900):
                    compact()
            continue
        except Fail as e:
            log(f"STOPPED at {label}: {e}", study=True)
            return
        s = state()
        if res and measured and res["hot_samples"] and not s.get("rerun_used", {}).get(step):
            s.setdefault("rerun_used", {})[step] = True
            s.setdefault("rerun_label", {})[step] = step + "-rerun"
            save(s)
            log(f"{label}: {res['hot_samples']} host CPU samples > 25 % in the ballot window: rerunning once "
                f"as {step}-rerun", study=True)
            continue
        if res and measured and res["hot_samples"]:
            log(f"{label}: host CPU > 25 % again; rerun used, the run stands flagged", study=True)
        s.setdefault("done", []).append(step)
        save(s)
        i += 1
    log("capstone 1 queue complete: " + json.dumps([{k: r[k] for k in ('label', 'run', 'tps', 'p99', 'hot_samples', 'resumed')}
                                                  for r in state().get("results", [])]), study=True)


def selftest():
    d = parse_docker_stats("peer0.org1.example.com|412.5%|1.5GiB / 31.2GiB|1.2GB / 3.4GB\nbad")
    assert d["docker.peer0.org1.example.com.cpu_pct"] == 412.5
    assert d["docker.peer0.org1.example.com.mem_bytes"] == 1.5 * 1024 ** 3
    assert d["docker.peer0.org1.example.com.blk_write_bytes"] == 3.4e9
    m = parse_meminfo("MemTotal: 100 kB\nMemAvailable: 50 kB\n1.50 2.00 3.00 1/2 3\n")
    assert m == {"wsl.MemTotal_kb": 100, "wsl.MemAvailable_kb": 50, "wsl.load1": 1.5, "wsl.load5": 2.0}
    assert ts("2026-10-01T04:00:01Z") == 1790827201
    import tempfile
    p = os.path.join(tempfile.mkdtemp(), "r.csv")
    n = os.cpu_count() or 16
    with open(p, "w", encoding="utf-8") as f:
        f.write("unix_ts,iso,metric,value\n"
                f"100,x,win.Processor(_Total)\\% Processor Time,80\n100,x,win.Process(vmmemWSL)\\% Processor Time,{70*n}\n"
                f"110,x,win.Processor(_Total)\\% Processor Time,80\n110,x,win.Process(vmmemWSL)\\% Processor Time,{40*n}\n")
    _, hot = resources_summary(p, (100, 110))
    assert hot == [40.0], hot
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["selftest"]:
        selftest()
    else:
        try:
            main()
        except Exception as e:  # noqa: BLE001 - an unattended controller must log why it ended
            import traceback
            log("controller died: " + traceback.format_exc(), study=True)
