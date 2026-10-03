"""Chapter 4, second study environment: the on-chain MP tiers on the Hetzner AX42.

Linux-native port of the desktop controller (C:\\Users\\User\\ch4-capstone\\controller.py):
the same run loop, single-rep campaigns on a freshly reset network, labels, resource
sampler, contention rule (> 2 % of the ballot-window samples AND >= 6), export, du,
zstd packing and evidence. Dropped: WSL, VHDX compaction, Windows counters. On native
ext4 the ledger is wiped by the network reset between runs, so there is no bloat.

Runs as systemd unit ax42-controller.service (Restart=on-failure, enabled at boot) and
resumes from state.json. The console runs as saksi-console.service (tools/up.sh, which
execs the console; its CPU is accounted through its own cgroup). The desktop pulls the
evidence (outbox/<n>-<label>/READY), the study-log lines (study.md) and the archive
files (archive.tsv) with pull.py; nothing here depends on the desktop being up.

STOP in this folder holds the queue before the next step (a warm-up is cancelled).

Usage: python3 controller.py          run / resume the queue
       python3 controller.py selftest parser and rule checks
"""
import csv, glob, json, os, re, shutil, statistics, subprocess, sys, threading, time, zipfile
import urllib.request, urllib.error
from datetime import datetime, timezone

HERE = "/root/ax42"
STATE = f"{HERE}/state.json"
LOG = f"{HERE}/controller.log"
STUDY = f"{HERE}/study.md"          # study-log lines; pull.py appends them to ch4-study-log.md
STOP = f"{HERE}/STOP"
WORK = f"{HERE}/work"
OUTBOX = f"{HERE}/outbox"
ARCHIVE = f"{HERE}/archive.tsv"     # run \t path \t sha256-of-file: what pull.py copies to Q:\thesis-archive\ax42
RUNS = "/root/.saksi/campaign/runs"
BASE = "http://127.0.0.1:8090"
GB = 1e9
NCPU = os.cpu_count() or 16
# Disk per ballot record on this host: ~33 KB ledger (peers + orderer) + ~12 KB run files
# (ballots.ndjson, the verify ledger dump, ballots.csv) at peak; 15 % + 20 GB margin.
PER_RECORD = 45e3
MARGIN = 20 * GB
FREE_ABORT = 15 * GB
DATE = "2026-10-04"
POS = 3
TRUSTEES = ["COMELEC", "Civil Society Watch", "University IT", "Academe Observer", "Bar Association"]
ENV = "Hetzner AX42, native Ubuntu 24.04 + Docker Engine"
HW = ("AMD Ryzen 7 PRO 8700GE (8 cores / 16 threads), 64 GB RAM (61 GiB usable), swap off, "
      "2 x 512 GB NVMe in RAID0 (/dev/md2, ext4, 928 GB)")

# key -> (tier, voters, warmups, reps, name suffix, measured, evidence dir relative to docs/desktop-runs)
SPECS = {
    "mp1k": ("MP-1K", 1000, 2, 10, "", True, f"{DATE}-ax42-mp-1k"),
    "mp10k": ("MP-10K", 10000, 2, 10, "", True, f"{DATE}-ax42-mp-10k"),
    "mp50k": ("MP-50K", 50000, 2, 5, "", True, f"{DATE}-ax42-mp-50k"),
}
BIG = [("MP-483K", "mp483k", 483000), ("MP-1M", "mp1m", 1000000),
       ("MP-1.92M", "mp1.92m", 1921917), ("MP-3.5M", "mp3.5m", 3524078)]
for _tier, _k, _v in BIG:
    for _s in ("warmup", "m1", "m2", "m3"):
        SPECS[f"{_k}-{_s}"] = (_tier, _v, 0, 1, _s, _s != "warmup",
                               f"{DATE}-ax42-{_tier.lower()}/{_s}")
QUEUE = ["ladder", "mp1k", "mp10k", "mp50k"] + [f"{k}-{s}" for _, k, _ in BIG for s in ("warmup", "m1", "m2", "m3")]
TIER_LAST = {"mp1k": "mp1k", "mp10k": "mp10k", "mp50k": "mp50k",
             **{f"{k}-m3": k for _, k, _ in BIG}}


class Fail(Exception):
    pass


class Crash(Exception):
    pass


def spec(label):
    rerun = label.endswith("-rerun")
    tier, v, w, r, suf, measured, evid = SPECS[label[:-6] if rerun else label]
    if rerun:
        suf, evid = (suf + " rerun").strip(), evid + "-rerun"
    name = f"{tier} ch4 ax42" + (f" {suf}" if suf else "")
    return {"tier": tier, "voters": v, "positions": POS, "warmups": w, "reps": r, "suffix": suf,
            "measured": measured, "evid": evid, "name": name, "multi": w + r > 1}


# ---------------------------------------------------------------- plumbing
def now():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def log(msg, study=False):
    line = f"{now()} {msg}"
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    if study:
        with open(STUDY, "a", encoding="utf-8") as f:
            f.write(f"- **{time.strftime('%m-%d %H:%M')}** {msg}\n")


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


def sh(cmd, timeout=120):
    try:
        r = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True, timeout=timeout,
                           encoding="utf-8", errors="replace")
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def req(method, path, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            code, text = resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        code, text = e.code, e.read().decode("utf-8", "replace")
    except (OSError, urllib.error.URLError) as e:
        return 0, str(e)[:200]
    try:
        return code, json.loads(text)
    except ValueError:
        return code, text


def console_up():
    return req("GET", "/api/campaigns", timeout=20)[0] == 200


def docker_up():
    return sh("docker info --format '{{.ServerVersion}}'", 60)[0] == 0


def free_bytes():
    return shutil.disk_usage("/").free


def disk_line():
    u = shutil.disk_usage("/")
    return f"/ (md2) {u.free/GB:.1f} GB free of {u.total/GB:.0f} GB"


# ---------------------------------------------------------------- bring-up
FABRIC = re.compile(r"(example\.com|^dev-peer|saksi)")


def bringup():
    """Docker, the existing Fabric containers (no reset), then the console service."""
    for _ in range(60):
        if docker_up():
            break
        sh("systemctl start docker", 120)
        time.sleep(15)
    else:
        raise Crash("docker not up after 15 min")
    _, out, _ = sh("docker ps -a --filter status=exited --filter status=created --format '{{.Names}}'", 60)
    names = [n for n in out.split() if FABRIC.search(n)]
    if names:
        rc, _, e = sh("docker start " + " ".join(names), 300)
        log(f"docker start {names} -> rc {rc} {e.strip()[:200]}", study=True)
    if console_up():
        return
    rc, _, e = sh("systemctl start saksi-console", 60)
    log(f"systemctl start saksi-console -> rc {rc} {e.strip()[:200]}", study=True)
    for _ in range(80):  # first start builds the network and both binaries
        if console_up():
            _, o, _ = sh("journalctl -u saksi-console -n 12 --no-pager", 30)
            log("console up: " + " | ".join(l.split(": ", 1)[-1] for l in o.splitlines()[-8:]))
            return
        time.sleep(15)
    raise Crash("console not reachable 20 min after systemctl start")


# ---------------------------------------------------------------- console API
def wait_job(job, poll=15, what="job"):
    while True:
        time.sleep(poll)
        code, j = req("GET", "/api/jobs/" + job)
        if code == 200 and isinstance(j, dict) and j.get("status") not in ("queued", "running"):
            return j
        if code == 0 and not console_up():
            raise Crash(f"console unreachable during {what} {job}")


def reset(voters, why):
    code, b = req("POST", "/api/network/reset", {"voters": voters, "positions": POS, "confirm": "RESET"})
    if code != 202:
        raise Fail(f"reset ({why}): {code} {b}")
    j = wait_job(b["job"], what="reset")
    res = j.get("result") or {}
    if j.get("status") != "done" or not res.get("chain_height"):
        raise Fail(f"reset {b['job']} {j.get('status')} {j.get('error')} {res}")
    log(f"reset ({why}) {b['job']} done, chain height {res.get('chain_height')}, "
        f"{res.get('duration_ms')} ms", study=True)
    return b["job"]


def ladder():
    bringup()
    code, p = req("GET", "/api/preflight?mode=onchain&voters=1000&positions=3&candidates=4&concurrency=128")
    if code == 200 and (p.get("ladder") or {}).get("ok"):
        log(f"ladder already passed for this build: {p['ladder']}", study=True)
        return
    code, b = req("POST", "/api/ladder", {})
    if code != 202:
        raise Fail(f"ladder: {code} {b}")
    log(f"validation ladder job {b['job']} started", study=True)
    j = wait_job(b["job"], 30, "ladder")
    res = j.get("result") or {}
    log(f"ladder {b['job']} {j.get('status')} {j.get('error') or ''}: "
        f"{json.dumps(res)[:900]}", study=True)
    if j.get("status") != "done":
        raise Fail(f"ladder {j.get('status')}: {j.get('error')}")
    os.makedirs(f"{WORK}/ladder", exist_ok=True)
    with open(f"{WORK}/ladder/ladder.json", "w") as f:
        json.dump(res, f, indent=2)
    out = f"{OUTBOX}/00-ladder"
    os.makedirs(out, exist_ok=True)
    shutil.copy(f"{WORK}/ladder/ladder.json", out)
    with open(f"{out}/DEST", "w") as f:
        f.write(f"{DATE}-ax42-ladder")
    with open(f"{out}/MSG", "w") as f:
        f.write(f"docs(desktop-runs): validation ladder on the AX42 (saksi 4a38a54)")
    open(f"{out}/READY", "w").close()


def cpu_now():
    """Busy share of all CPUs over 5 s, from /proc/stat (nothing of the run is running yet)."""
    a = proc_stat()
    time.sleep(5)
    b = proc_stat()
    return 100.0 * (b[0] - a[0]) / max(1, b[1] - a[1])


def preflight(tag, sp):
    t0 = time.time()
    while True:
        code, p = req("GET", f"/api/preflight?mode=onchain&voters={sp['voters']}&positions={POS}"
                             f"&candidates=4&concurrency=128", timeout=60)
        cpu = cpu_now()
        if code == 200 and isinstance(p, dict):
            h = p.get("host", {})
            codes = [w["code"] for w in p.get("warnings", [])]
            ob = p.get("orderer_batch") or {}
            chain_ok = (p.get("fabric") or {}).get("reachable") and (p.get("ladder") or {}).get("ok")
            if ob.get("saksi_configtx") != "saksi" or ob.get("MaxMessageCount") != "50" or ob.get("BatchTimeout") != "2s":
                raise Fail(f"preflight {tag}: orderer_batch not the declared saksi configtx: {ob}")
            if not codes and chain_ok and cpu < 25:
                log(f"preflight {tag} green: host CPU {cpu:.1f} % (/proc/stat, 5 s), load1 {h.get('guest_load1')}, "
                    f"orderer {ob.get('MaxMessageCount')}/{ob.get('BatchTimeout')}/{ob.get('PreferredMaxBytes')}/"
                    f"{ob.get('SnapshotIntervalSize')} saksi_configtx {ob.get('saksi_configtx')}, "
                    f"phase_timeout {p.get('phase_timeout')}, no warnings", study=True)
                p["controller_host_cpu_pct_5s"] = cpu
                return p
            if any(c.startswith(("disk_", "mem", "phase_timeout", "ladder", "fabric", "verify_threads_invalid"))
                   for c in codes) or time.time() - t0 > 1800:
                raise Fail(f"preflight {tag}: {codes} cpu {cpu:.1f} chain_ok {chain_ok}")
            if int(time.time() - t0) % 300 < 40:
                log(f"preflight {tag} not green yet: host CPU {cpu:.1f} load1 {h.get('guest_load1')} warnings {codes}")
        time.sleep(30)


def cfg(sp):
    return {"name": sp["name"], "trustees": [{"name": t} for t in TRUSTEES], "threshold": 3,
            "positions": POS, "candidates": 4, "voters": sp["voters"], "distribution": "realistic",
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
        with open(f"{RUNS}/{run_id}/journal.ndjson", encoding="utf-8") as f:
            for line in f:
                try:
                    out.append(json.loads(line))
                except ValueError:
                    pass
    except OSError:
        pass
    return out


def ts(s):
    s = re.sub(r"\.\d+Z$", "Z", s)
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()


def ballot_window(run_id):
    jr = journal(run_id)
    starts = [ts(e["ts"]) for e in jr if e.get("event") in ("stage.ballots.start", "segment.start")]
    ends = [ts(e["ts"]) for e in jr if e.get("event") in ("stage.ballots.end", "segment.end")]
    return (min(starts), max(ends)) if starts and ends else None, [e for e in jr if e.get("event") == "segment.end"]


# ---------------------------------------------------------------- sampler
def proc_stat():
    with open("/proc/stat") as f:
        v = [int(x) for x in f.readline().split()[1:9]]
    total = sum(v)
    return total - v[3] - v[4], total  # busy (minus idle, iowait), total


RUN_CGROUPS = ["/sys/fs/cgroup/system.slice/docker-*.scope", "/sys/fs/cgroup/system.slice/docker.service",
               "/sys/fs/cgroup/system.slice/containerd.service", "/sys/fs/cgroup/system.slice/saksi-console.service"]


def run_cpu_usec():
    """CPU time of everything the run consists of: the Fabric containers, dockerd/containerd,
    and the console with the saksi-demo processes it spawns. Everything else is non-run load."""
    tot = 0
    for pat in RUN_CGROUPS:
        for d in glob.glob(pat):
            try:
                with open(d + "/cpu.stat") as f:
                    tot += int(f.readline().split()[1])
            except (OSError, ValueError, IndexError):
                pass
    return tot


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
        if k in ("MemTotal", "MemAvailable", "SwapTotal", "SwapFree", "Dirty", "Cached"):
            rows[f"host.{k}_kb"] = int(v.split()[0])
    if lines and ":" not in lines[-1]:
        la = lines[-1].split()
        rows["host.load1"], rows["host.load5"] = float(la[0]), float(la[1])
    return rows


IOSTAT_KEEP = ("r/s", "rkB/s", "w/s", "wkB/s", "r_await", "w_await", "f/s", "aqu-sz", "%util")


def parse_iostat_line(hdr, line):
    p = line.split()
    if not hdr or len(p) != len(hdr) or not re.match(r"(nvme\d+n\d+|md\d+)$", p[0]):
        return {}
    return {f"io.{p[0]}.{h}": float(v) for h, v in zip(hdr[1:], p[1:]) if h in IOSTAT_KEEP}


class Sampler:
    """Every 10 s: docker stats per container, /proc/meminfo + loadavg, host CPU from /proc/stat,
    the run's CPU from its cgroups (so non-run load = host - run), iostat for nvme0n1/nvme1n1/md2
    (one long-lived iostat -dxyk 10), and df of /. Long format: unix_ts,iso,metric,value."""

    def __init__(self, path):
        self.path, self.stop_ev, self.latest = path, threading.Event(), {}
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.io = subprocess.Popen(["iostat", "-dxyk", "10", "nvme0n1", "nvme1n1", "md2"], stdout=subprocess.PIPE,
                                   stderr=subprocess.DEVNULL, text=True, env={**os.environ, "LC_ALL": "C", "S_TIME_FORMAT": "ISO"})
        threading.Thread(target=self._iostat, daemon=True).start()
        self.t = threading.Thread(target=self._loop, daemon=True)
        self.t.start()

    def _iostat(self):
        hdr, cur = None, {}
        for line in self.io.stdout:
            if line.startswith("Device"):
                if cur:
                    self.latest = cur
                hdr, cur = line.split(), {}
                continue
            cur.update(parse_iostat_line(hdr, line))

    def _loop(self):
        new = not os.path.exists(self.path)
        prev = None
        with open(self.path, "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if new:
                w.writerow(["unix_ts", "iso", "metric", "value"])
            while not self.stop_ev.is_set():
                t0 = time.time()
                try:
                    rows, prev = sample(prev)
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
        self.io.kill()


def sample(prev):
    rows = {}
    cur = (time.time(),) + proc_stat() + (run_cpu_usec(),)
    if prev:
        dt, dbusy, dtot, drun = cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2], cur[3] - prev[3]
        host = 100.0 * dbusy / max(1, dtot)
        run = min(100.0, 100.0 * drun / (dt * NCPU * 1e6)) if dt > 0 else 0.0
        rows.update({"host.cpu_pct": host, "host.run_cpu_pct": run, "host.nonrun_cpu_pct": max(0.0, host - run)})
    rc, out, _ = sh("docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.BlockIO}}'", 30)
    if rc == 0:
        rows.update(parse_docker_stats(out))
    with open("/proc/meminfo") as f1, open("/proc/loadavg") as f2:
        rows.update(parse_meminfo(f1.read() + f2.read()))
    u = shutil.disk_usage("/")
    rows.update({"host.root_free_bytes": u.free, "host.root_used_bytes": u.used})
    return rows, cur


def load_resources(path):
    data = {}
    try:
        with open(path, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    data.setdefault(r["metric"], []).append((float(r["unix_ts"]), float(r["value"])))
                except ValueError:
                    pass
    except OSError:
        pass
    return data


def contended(hot, n):
    """Coordinator rule 2026-10-03 01:35: a rerun needs more than 2 % of the window's samples
    over 25 % of non-run CPU AND at least 6 of them."""
    return hot > 0.02 * n and hot >= 6


def resources_summary(path, wins):
    """Peaks over the run and means/peaks inside the ballot window(s); a bottleneck is named
    only when the evidence shows one. Returns (text, hot samples, window samples)."""
    data = load_resources(path)
    lines, flags = [], []

    def inwin(vals):
        return [v for t, v in vals if any(a <= t <= b for a, b in wins)]

    lines.append(f"{'metric':60s} {'run peak':>14s} {'window mean':>14s} {'window peak':>14s}")
    for k in sorted(data):
        if k.endswith(("blk_read_bytes", "blk_write_bytes")):
            continue
        allv = [v for _, v in data[k]]
        wv = inwin(data[k])
        lines.append(f"{k:60s} {max(allv):14.1f} {statistics.mean(wv) if wv else float('nan'):14.1f} "
                     f"{max(wv) if wv else float('nan'):14.1f}")
    for k in sorted(data):
        if k.endswith(("blk_read_bytes", "blk_write_bytes")) and data[k]:
            v = data[k]
            lines.append(f"{k:60s} total {(v[-1][1]-v[0][1])/GB:.2f} GB over the run (cumulative counter)")
    host = inwin(data.get("host.cpu_pct", []))
    nonrun = inwin(data.get("host.nonrun_cpu_pct", []))
    hot = [v for v in nonrun if v > 25]
    ma = data.get("host.MemAvailable_kb", [])
    if ma and min(v for _, v in ma) < 2e6:
        flags.append(f"MemAvailable fell to {min(v for _, v in ma)/1e6:.2f} GB")
    for k, v in data.items():
        wv = inwin(v)
        if k.endswith(".%util") and wv and statistics.mean(wv) > 80:
            flags.append(f"{k} mean {statistics.mean(wv):.0f} % in the ballot window")
        if k.endswith(".aqu-sz") and wv and statistics.mean(wv) > 2:
            flags.append(f"{k} mean queue {statistics.mean(wv):.1f} in the ballot window")
    if host and statistics.mean(host) > 90:
        flags.append(f"host CPU mean {statistics.mean(host):.0f} % in the ballot window")
    l1 = inwin(data.get("host.load1", []))
    if l1 and statistics.mean(l1) > 14:
        flags.append(f"load1 mean {statistics.mean(l1):.1f} of {NCPU} CPUs in the ballot window")
    top = sorted(((k, max(inwin(v) or [0])) for k, v in data.items()
                  if k.startswith("docker.") and k.endswith("cpu_pct")), key=lambda x: -x[1])[:3]
    wtxt = "; ".join(f"{fmt_ts(a)} to {fmt_ts(b)}" for a, b in wins) or "?"
    head = [f"ballot window(s): {wtxt}",
            f"host CPU (/proc/stat) samples in window: {len(host)}, mean "
            f"{statistics.mean(host) if host else float('nan'):.1f} %, max {max(host) if host else float('nan'):.1f} %",
            f"non-run CPU (host minus the containers, dockerd/containerd and the console cgroups): {len(nonrun)} samples, "
            f"max {max(nonrun) if nonrun else float('nan'):.1f} %, over 25 % (contended): {len(hot)}",
            f"load1 in window: mean {statistics.mean(l1) if l1 else float('nan'):.2f}, max {max(l1) if l1 else float('nan'):.2f}",
            "top container CPU peaks in window: " + ", ".join(f"{k[7:-8]} {v:.0f} %" for k, v in top),
            "bottleneck: " + ("; ".join(flags) if flags else "none evident from host evidence "
                              "(no memory, disk-util, queue or CPU saturation flag)")]
    return "\n".join(head) + "\n\n" + "\n".join(lines) + "\n", hot, len(nonrun)


def fmt_ts(t):
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t))


# ---------------------------------------------------------------- one run
def stop_requested():
    return os.path.exists(STOP)


def hold():
    if not stop_requested():
        return
    log("STOP file present: holding before the next step", study=True)
    while stop_requested():
        time.sleep(60)
    log("STOP file removed: continuing", study=True)


def ensure_disk(sp, label):
    records = sp["voters"] * POS
    need = records * PER_RECORD * (sp["warmups"] + sp["reps"]) * 1.15 + MARGIN
    free = free_bytes()
    log(f"disk check {label}: {records:,} records x {sp['warmups'] + sp['reps']} run(s) x 45 KB x 1.15 + 20 GB "
        f"= {need/GB:.1f} GB needed; {disk_line()}", study=True)
    if free < need:
        raise Fail(f"disk: {free/GB:.1f} GB free < {need/GB:.1f} GB needed for {label}")


def do_run(label, measured):
    s = state()
    cur = s.get("current")
    if cur and cur.get("label") == label and cur.get("cid"):
        return recover(cur, measured)
    sp = spec(label)
    ensure_disk(sp, label)
    bringup()
    job = reset(sp["voters"], label)
    pf = preflight(label, sp)
    d = f"{WORK}/{label}"
    if os.path.exists(f"{d}/resources.csv"):  # a redo after a cut before the window: keep the old one aside
        os.replace(f"{d}/resources.csv", f"{d}/resources.{int(time.time())}.csv")
    os.makedirs(d, exist_ok=True)
    with open(f"{d}/preflight.json", "w") as f:
        json.dump(pf, f, indent=2)
    sampler = Sampler(f"{d}/resources.csv")
    try:
        code, b = req("POST", "/api/campaigns", {"config": cfg(sp), "warmups": sp["warmups"], "reps": sp["reps"]})
        if code != 202:
            raise Fail(f"campaign {label}: {code} {b}")
        cid = b["campaign"]
        cur = {"label": label, "cid": cid, "reset": job, "started": time.time(), "resumed": False}
        mark(current=cur)
        log(f"{sp['name']}: campaign {cid} started ({sp['warmups']} + {sp['reps']}; {disk_line()})", study=True)
        c = poll_campaign(cur, measured)
    finally:
        sampler.stop()
    return finish(cur, c, measured)


def run_ids(c):
    return [r.get("run_id") for r in (c.get("reps") or []) if r.get("run_id")] if isinstance(c, dict) else []


def poll_campaign(cur, measured):
    bad, cancelled, window_logged = 0, False, set()
    while True:
        time.sleep(60)
        if free_bytes() < FREE_ABORT and not cancelled:
            log(f"/ below 15 GB free mid-run ({disk_line()}): cancelling campaign {cur['cid']}", study=True)
            req("POST", f"/api/campaigns/{cur['cid']}/cancel")
            for rid in run_ids(req("GET", "/api/campaigns/" + cur["cid"])[1])[-1:]:
                req("POST", "/cancel", {"run_id": rid})
            cancelled = True
        if stop_requested() and not measured and not cancelled:
            log(f"STOP during warm-up: cancelling campaign {cur['cid']}", study=True)
            req("POST", f"/api/campaigns/{cur['cid']}/cancel")
            for rid in run_ids(req("GET", "/api/campaigns/" + cur["cid"])[1])[-1:]:
                req("POST", "/cancel", {"run_id": rid})
            cancelled = True
        code, c = req("GET", "/api/campaigns/" + cur["cid"])
        if code == 200 and isinstance(c, dict):
            bad = 0
            rids = run_ids(c)
            if rids != cur.get("runs"):
                cur["runs"], cur["run"] = rids, rids[-1] if rids else None
                mark(current=cur)
                log(f"{cur['label']}: runs {rids}")
            # first-throughput line once per run: the ballot window opened and progress exists
            for rid in rids:
                if rid in window_logged:
                    continue
                jr = journal(rid)
                st = [e for e in jr if e.get("event") == "stage.ballots.start"]
                pr = [e for e in jr if e.get("event") == "ballots.progress"]
                if st and (len(pr) >= 30 or (pr and "stage.ballots.end" in {e.get("event") for e in jr})):
                    n, ms = pr[-1].get("done"), pr[-1].get("mono_ms")
                    rate = f"{1000.0 * n / ms:.0f} records/s" if n and ms else "?"
                    log(f"{cur['label']}: {rid} ballot window open since {fmt_ts(ts(st[-1]['ts']))}; first throughput "
                        f"{n} records in {ms} ms -> ~{rate}",
                        study=(rid == rids[0] or not spec(cur['label'])['multi']))
                    window_logged.add(rid)
            if c.get("status") != "running":
                if cancelled:
                    raise Fail(f"{cur['label']} cancelled (STOP or disk low)")
                return c
            continue
        bad += 1
        if bad >= 3:
            raise Crash(f"console unreachable for 3 polls (docker up: {docker_up()})")


def recover(cur, measured):
    """Power-cut / crash policy. Multi-rep tiers: an interrupted campaign is redone from its
    reset. Single long runs: containers started (no reset), console restarted, resume the
    phase that was cut; throughput then comes from the journal's segments."""
    log(f"recovering {cur['label']} (campaign {cur['cid']}, runs {cur.get('runs')})", study=True)
    bringup()
    sp = spec(cur["label"])
    code, c = req("GET", "/api/campaigns/" + cur["cid"])
    if code == 200 and isinstance(c, dict) and c.get("status") == "running":
        sampler = Sampler(f"{WORK}/{cur['label']}/resources.csv")
        try:
            c = poll_campaign(cur, measured)
        finally:
            sampler.stop()
        if c.get("status") == "done":
            return finish(cur, c, measured)
    elif code == 200 and isinstance(c, dict) and c.get("status") == "done":
        for rid in run_ids(c)[-1:]:
            wait_idle(rid)
        log(f"{cur['label']}: campaign already done; post-run steps only", study=True)
        return finish(cur, c, measured)
    if sp["multi"]:
        log(f"{cur['label']}: multi-rep campaign interrupted: discarded, redoing from its reset", study=True)
        mark(current=None)
        return do_run(cur["label"], measured)
    rids = cur.get("runs") or run_ids(c if isinstance(c, dict) else {})
    run_id = rids[-1] if rids else None
    if not run_id:
        log("no run id: nothing reached the ledger; redoing the run from reset", study=True)
        mark(current=None)
        return do_run(cur["label"], measured)
    ev = [e.get("event") for e in journal(run_id)]
    if "stage.ballots.start" not in ev:
        log(f"{run_id} cut before its ballot window (generate): redoing from reset", study=True)
        mark(current=None)
        return do_run(cur["label"], measured)
    cur["resumed"], cur["run"], cur["runs"] = True, run_id, [run_id]
    mark(current=cur)
    sampler = Sampler(f"{WORK}/{cur['label']}/resources.csv")
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


def correctness(run_id):
    try:
        with open(f"{RUNS}/{run_id}/correctness.csv", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
    except OSError:
        return {"contests": 0}
    es = [int(r["E"]) for r in rows if r.get("E", "").lstrip("-").isdigit()]
    return {"contests": len(rows), "E_max_abs": max((abs(e) for e in es), default=None),
            "all_pass": all(r.get("pass") == "true" for r in rows) if rows else False,
            "ledger_matches_local": all(r.get("ledger_matches_local") == "true" for r in rows) if rows else False}


def perf(run_id):
    try:
        with open(f"{RUNS}/{run_id}/perf.csv", encoding="utf-8") as f:
            return next(csv.DictReader(f), {})
    except OSError:
        return {}


ZPACK = "nice -n 19 ionice -c3 /root/ax42/zpack.sh"


def finish(cur, c, measured):
    label, cid = cur["label"], cur["cid"]
    sp = spec(label)
    rids = run_ids(c) or cur.get("runs") or []
    reps = c.get("reps") or []
    log(f"{sp['name']}: campaign {cid} {c.get('status')} error={c.get('error')} runs {len(rids)} resumed {cur.get('resumed')}: "
        + "; ".join(f"{r.get('kind')} {r.get('run_id')} tps {r.get('committed_tps')} p99 {r.get('latency_p99_ms')} "
                    f"failed {r.get('failed')} {r.get('fail_reason') or ''}" for r in reps), study=True)
    d = f"{WORK}/{label}"
    os.makedirs(d, exist_ok=True)
    per_run, wins_measured = [], []
    for i, r in enumerate(reps):
        rid = r.get("run_id")
        win, segs = ballot_window(rid) if rid else (None, [])
        kind = r.get("kind") if sp["multi"] else sp["suffix"]  # single-rep: warmup / m1..m3 from the label
        per_run.append({"index": i, "kind": kind, "run": rid, "tps": r.get("committed_tps"),
                        "p99": r.get("latency_p99_ms"), "p50": perf(rid).get("latency_p50_ms") if rid else None,
                        "failed": r.get("failed"), "fail_reason": r.get("fail_reason"), "window": win,
                        "segments": [{k: s.get(k) for k in ("index", "tps", "committed", "window_ms")} for s in segs],
                        "correctness": correctness(rid) if rid else {}, "committed": perf(rid).get("committed") if rid else None,
                        "dropped": perf(rid).get("dropped") if rid else None})
    # contention per measured repetition (a warm-up never forces a rerun)
    cand = []
    for pr in per_run:
        if pr["window"]:
            _, hot, n = resources_summary(f"{d}/resources.csv", [pr["window"]])
            pr["hot_samples"], pr["window_samples"] = len(hot), n
            if (sp["multi"] and pr["kind"] != "warmup") or (not sp["multi"] and measured):
                cand.append((contended(len(hot), n), len(hot), n))
    worst = max(cand)[1:] if cand else (0, 0)  # a contended rep first, else the most hot samples
    wins = [pr["window"] for pr in per_run if pr["window"]]
    summary, hot, nwin = resources_summary(f"{d}/resources.csv", wins)
    with open(f"{d}/resources-summary.txt", "w", encoding="utf-8") as f:
        f.write(summary)
    log(f"{label}: resources: " + " | ".join(summary.splitlines()[:6]), study=True)
    # export
    zpath = f"{d}/{cid}.zip"
    try:
        with urllib.request.urlopen(f"{BASE}/api/campaigns/{cid}/export", timeout=1800) as resp, open(zpath, "wb") as f:
            shutil.copyfileobj(resp, f, 1 << 20)
            exp = resp.status
    except (OSError, urllib.error.URLError) as e:
        exp = f"error {e}"
    log(f"export {cid} -> {exp} ({os.path.getsize(zpath) if os.path.exists(zpath) else 0} bytes)", study=True)
    # ledger size and container logs
    ev_sh = (f"mkdir -p {d}/logs && cd {d}/logs && for c in peer0.org1.example.com peer0.org2.example.com orderer.example.com; do "
             "docker logs --timestamps $c > $c.log 2>&1; gzip -f $c.log; done; "
             "for c in peer0.org1.example.com peer0.org2.example.com; do echo $c $(docker exec $c du -sb /var/hyperledger/production); done; "
             "echo orderer.example.com $(docker exec orderer.example.com du -sb /var/hyperledger/production/orderer); "
             "for v in $(docker volume ls -q | grep example.com); do echo volume $v $(du -sb /var/lib/docker/volumes/$v/_data | cut -f1); done; "
             "du -sb /var/lib/docker | sed 's/^/docker-root /'; df -B1 / | tail -1")
    rc, out, err = sh(ev_sh, 3600)
    ledger = time.strftime("%Y-%m-%dT%H:%M:%S%z\n") + out + err
    with open(f"{d}/ledger-size.txt", "w", encoding="utf-8") as f:
        f.write(ledger)
    log(f"{label}: ledger du: " + out.replace("\n", " | ")[:700], study=True)
    # ballots.csv deleted after the export; ndjson zstd-packed with sha256 sidecars
    for rid in rids:
        p = f"{RUNS}/{rid}/ballots.csv"
        if exp == 200 and os.path.exists(p):
            sz = os.path.getsize(p)
            os.remove(p)
            log(f"deleted {rid}/ballots.csv ({sz} bytes)", study=not sp["multi"])
    if exp == 200:
        files = " ".join(f"{RUNS}/{rid}/ballots.ndjson {RUNS}/{rid}/ledger/ballots.ndjson" for rid in rids)
        rc, o, e = sh(f"{ZPACK} {files}", 12 * 3600)
        log(f"{label}: ndjson stored zstd-compressed (sha256 sidecars): "
            + o.strip().replace("\n", " | ")[-900:], study=True)
        with open(ARCHIVE, "a", encoding="utf-8") as af:
            for rid in rids:
                for rel in ("ballots.ndjson", "ledger/ballots.ndjson"):
                    for ext in (".zst", ".sha256"):
                        fp = f"{RUNS}/{rid}/{rel}{ext}"
                        if os.path.exists(fp):
                            h = sh(f"sha256sum '{fp}' | cut -d' ' -f1", 3600)[1].strip()
                            af.write(f"{rid}\t{fp}\t{h}\t{os.path.getsize(fp)}\n")
            for fp in sorted(glob.glob(f"{d}/logs/*.log.gz")):
                h = sh(f"sha256sum '{fp}' | cut -d' ' -f1", 600)[1].strip()
                af.write(f"{label}-logs\t{fp}\t{h}\t{os.path.getsize(fp)}\n")
    else:
        log(f"{label}: export not 200 ({exp}); ballots.csv kept, ndjson left uncompressed", study=True)
    rec = {"label": label, "name": sp["name"], "tier": sp["tier"], "campaign": cid, "status": c.get("status"),
           "runs": per_run, "resumed": cur.get("resumed"), "measured": measured, "multi": sp["multi"],
           "worst_contention": list(worst), "duration_s": time.time() - cur["started"], "ledger": ledger,
           "disk_after": disk_line(), "summary_csv": (c.get("summary") if isinstance(c.get("summary"), (list, dict)) else None),
           "finished": now()}
    write_outbox(rec, summary, zpath)
    s = state()
    s.setdefault("results", []).append({k: v for k, v in rec.items() if k not in ("ledger",)})
    s["current"] = None
    save(s)
    write_status()
    return rec


def seq():
    s = state()
    n = s.get("seq", 0) + 1
    mark(seq=n)
    return n


def fmt(v, nd=1):
    try:
        return f"{float(v):,.{nd}f}"
    except (TypeError, ValueError):
        return "-"


def build_line():
    s = state()
    return s.get("build", "saksi 4a38a54")


def write_outbox(rec, summary, zpath):
    label = rec["label"]
    sp = spec(label)
    out = f"{OUTBOX}/{seq():02d}-{label}"
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    try:
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(out)
    except (OSError, zipfile.BadZipFile) as e:
        log(f"{label}: export unzip failed: {e}", study=True)
    d = f"{WORK}/{label}"
    for src, dst in (("resources.csv", "resources.csv"), ("preflight.json", "preflight-controller.json"),
                     ("resources-summary.txt", "resources-summary.txt"), ("ledger-size.txt", "ledger-size.txt")):
        if os.path.exists(f"{d}/{src}"):
            shutil.copy(f"{d}/{src}", f"{out}/{dst}")
    with open(LOG, encoding="utf-8") as f:
        lines = [l for l in f if label in l or "reset" in l]
    with open(f"{out}/controller-log.txt", "w", encoding="utf-8") as f:
        f.writelines(lines[-300:])
    rows = []
    for pr in rec["runs"]:
        cr = pr["correctness"]
        seg = "; ".join(f"seg {s['index']}: {fmt(s['tps'])} TPS" for s in pr["segments"] if s.get("tps") is not None)
        rows.append(f"| {pr['kind']} | `{pr['run']}` | {fmt(pr['tps'])} | {fmt(pr['p50'])} | {fmt(pr['p99'])} | "
                    f"{pr['committed']} / {pr['dropped']} | {cr.get('E_max_abs')} ({cr.get('contests')} contests, pass "
                    f"{cr.get('all_pass')}, ledger_matches_local {cr.get('ledger_matches_local')}) | {pr['failed']} "
                    f"{pr['fail_reason'] or ''} | {pr.get('hot_samples', '-')} of {pr.get('window_samples', '-')} | {seg or '-'} |")
    kind = ("Multi-repetition campaign on one freshly reset network, as the desktop's 2026-09-30 protocol "
            f"({sp['warmups']} warm-ups + {sp['reps']} measured)." if sp["multi"] else
            "Warm-up: a full run on its own freshly reset network, discarded from the statistics." if not sp["measured"]
            else "Measured repetition: a single-rep campaign on its own freshly reset network.")
    note = (f"# {sp['name']} (AX42, saksi 4a38a54)\n\n"
            f"Generated by `/root/ax42/controller.py` on the AX42 at {now()}. {kind} "
            "These runs carry `ax42` in the election name and must not be pooled with desktop runs.\n\n"
            f"- Environment: {ENV}.\n- Hardware: {HW}.\n- Build: {build_line()}.\n"
            "- Preset: 3 positions x 4 candidates, 5 trustees at threshold 3, `realistic`, 128 in flight, "
            "closed loop, on-chain; orderer MaxMessageCount 50, BatchTimeout 2s, PreferredMaxBytes 2 MB, "
            "SnapshotIntervalSize 256 MB (saksi configtx, preflight `orderer_batch`).\n\n"
            f"| | |\n|---|---|\n| Election name | `{sp['name']}` |\n| Campaign | `{rec['campaign']}` ({rec['status']}) |\n"
            f"| Resumed after a cut | {rec['resumed']} |\n| Wall time (reset to export) | {rec['duration_s']/60:.0f} min |\n"
            f"| Disk after | {rec['disk_after']} |\n\n"
            "| Kind | Run | committed_tps | p50 ms | p99 ms | committed / dropped | max abs E | failed | "
            "non-run CPU samples > 25 % in window | segments |\n|---|---|---|---|---|---|---|---|---|---|\n"
            + "\n".join(rows) + "\n\n"
            "Contention rule: a measured run is rerun once only if more than 2 % of its ballot-window samples, "
            "and at least 6, show non-run CPU (host CPU from /proc/stat minus the CPU of the Fabric containers, "
            "dockerd/containerd and the console's cgroup) above 25 %.\n\n"
            f"## Resources (10 s sampler, `resources.csv`)\n\n```\n{summary[:7000]}```\n\n"
            f"## Ledger size\n\n```\n{rec['ledger']}```\n\n"
            "Peer and orderer `docker logs` (gzipped) and the zstd-compressed `ballots.ndjson` and verify ledger "
            "dump `ledger/ballots.ndjson` (each with the original's sha256 in a `.sha256` sidecar; restore with "
            "`zstd -dc ballots.ndjson.zst | sha256sum`) are archived to `Q:\\thesis-archive\\ax42\\<run>\\`, "
            "sha256-checked after the copy. `ballots.csv` was deleted after the export.\n")
    with open(f"{out}/NOTE.md", "w", encoding="utf-8") as f:
        f.write(note)
    with open(f"{out}/DEST", "w") as f:
        f.write(sp["evid"])
    with open(f"{out}/MSG", "w") as f:
        f.write(f"docs(desktop-runs): {sp['name']} on the AX42 ({', '.join(str(p['run']) for p in rec['runs'])})")
    if label in TIER_LAST:
        tier_note(rec, out)
    open(f"{out}/READY", "w").close()
    log(f"{label}: evidence ready in {out} for the desktop pull", study=True)


def tier_note(rec, out):
    """A tier summary beside the tier folder: every run of the tier (single-rep tiers gather
    warm-up + m1..m3 from state), with TPS / p99 / E."""
    sp = spec(rec["label"])
    recs = [r for r in state().get("results", []) if r["tier"] == sp["tier"]] + [rec]
    rows, tps_m, p99_m = [], [], []
    for r in recs:
        for pr in r["runs"]:
            cr = pr["correctness"]
            m = (r["multi"] and pr["kind"] != "warmup") or (not r["multi"] and r["measured"])
            if m and not pr["failed"]:
                if pr["tps"] is not None:
                    tps_m.append(float(pr["tps"]))
                if pr["p99"] is not None:
                    p99_m.append(float(pr["p99"]))
            rows.append(f"| {r['name'] if not r['multi'] else pr['kind']} | `{pr['run']}` | {'measured' if m else 'warm-up'} | "
                        f"{fmt(pr['tps'])} | {fmt(pr['p50'])} | {fmt(pr['p99'])} | {cr.get('E_max_abs')} | {cr.get('all_pass')} | "
                        f"{pr.get('hot_samples', '-')} / {pr.get('window_samples', '-')} | {r['resumed']} |")
    stat = (f"Measured committed_tps: median {statistics.median(tps_m):.1f}, mean {statistics.mean(tps_m):.1f}, "
            f"min {min(tps_m):.1f}, max {max(tps_m):.1f} (n = {len(tps_m)}). p99 ms: median "
            f"{statistics.median(p99_m):.1f}, max {max(p99_m):.1f}.") if tps_m and p99_m else "No measured run."
    base = sp["evid"].split("/")[0]
    text = (f"# {sp['tier']} on-chain on the AX42 (saksi 4a38a54)\n\n"
            f"Generated by `/root/ax42/controller.py` at {now()}. Second study environment: {ENV}; {HW}. "
            f"Build: {build_line()}. Every election name carries `ax42`; these runs are not pooled with the "
            f"desktop's. Evidence: [`{base}/`]({base}/). Setup report: [`{DATE}-ax42-setup.md`]({DATE}-ax42-setup.md).\n\n"
            + ("Protocol: one campaign of %d warm-ups + %d measured repetitions on one freshly reset network, "
               "as the desktop's 2026-09-30 protocol.\n\n" % (sp["warmups"], sp["reps"]) if sp["multi"] else
               "Protocol: 1 warm-up + 3 measured, each a single-rep campaign on its own freshly reset network "
               "(adviser W2/W3 protocol).\n\n")
            + f"{stat}\n\n| Run label | Run | Kind | committed_tps | p50 ms | p99 ms | max abs E | all pass | "
              "non-run CPU > 25 % / window samples | resumed |\n|---|---|---|---|---|---|---|---|---|---|\n"
            + "\n".join(rows) + "\n")
    with open(f"{out}/TIERNOTE", "w", encoding="utf-8") as f:
        f.write(f"{base}.md\n")
    with open(f"{out}/TIERNOTE.md", "w", encoding="utf-8") as f:
        f.write(text)
    log(f"{sp['tier']} tier summary: {stat}", study=True)


# ---------------------------------------------------------------- main
def write_status(note=""):
    """~/ch4-ax42/STATUS.md: one-glance progress for `ssh ... cat ~/ch4-ax42/STATUS.md`."""
    s = state()
    done = s.get("done", [])
    cur = s.get("current") or {}
    lines = [f"# AX42 study status ({now()})", "", f"- Service: ax42-controller.service; console: saksi-console.service",
             f"- Queue: {len(done)} of {len(QUEUE)} steps done; next/current: "
             f"{next((q for q in QUEUE if q not in done), 'none (complete)')}"
             + (f" (campaign {cur.get('cid')}, runs {cur.get('runs')})" if cur else ""),
             f"- Disk: {disk_line()}", f"- Crashes: {s.get('crashes', 0)}; stopped: {s.get('stopped') or 'no'}; "
             f"complete: {s.get('complete') or 'no'}"] + ([f"- Note: {note}"] if note else []) + [
             "", "| Label | Run | Kind | TPS | p99 ms | max abs E | failed | non-run hot/window |", "|---|---|---|---|---|---|---|---|"]
    for r in s.get("results", []):
        for p in r["runs"]:
            lines.append(f"| {r['label']} | {p['run']} | {p['kind']} | {fmt(p['tps'])} | {fmt(p['p99'])} | "
                         f"{(p['correctness'] or {}).get('E_max_abs')} | {p['failed']} | "
                         f"{p.get('hot_samples', '-')}/{p.get('window_samples', '-')} |")
    with open(f"{HERE}/STATUS.md.tmp", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.replace(f"{HERE}/STATUS.md.tmp", f"{HERE}/STATUS.md")


def main():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUTBOX, exist_ok=True)
    if not state().get("started"):
        mark(started=now(), crashes=0)
    log("controller start (pid %d)" % os.getpid(), study=True)
    i = 0
    while i < len(QUEUE):
        step = QUEUE[i]
        s = state()
        if step in s.get("done", []):
            i += 1
            continue
        hold()
        write_status()
        label = s.get("rerun_label", {}).get(step, step)
        measured = step != "ladder" and spec(label)["measured"]
        try:
            res = ladder() if step == "ladder" else do_run(label, measured)
        except Crash as e:
            s = state()
            s["crashes"] = s.get("crashes", 0) + 1
            save(s)
            log(f"CRASH #{s['crashes']} during {label}: {e}", study=True)
            if s["crashes"] >= 3:
                log("third crash: stopping the queue", study=True)
                write_status("stopped after the third crash")
                return
            sh("systemctl restart docker" if not docker_up() else "true", 300)
            time.sleep(30)
            continue
        except Fail as e:
            log(f"STOPPED at {label}: {e}", study=True)
            mark(stopped=f"{now()} {label}: {e}")
            write_status()
            return
        s = state()
        hot_n, win_n = (res or {}).get("worst_contention") or (0, 0)
        if res and measured and hot_n and not contended(hot_n, win_n):
            log(f"{label}: minor non-run load, {hot_n} of {win_n} samples > 25 %; below the rerun rule "
                "(> 2 % and >= 6); the run stands", study=True)
        if res and measured and contended(hot_n, win_n) and not s.get("rerun_used", {}).get(step):
            s.setdefault("rerun_used", {})[step] = True
            s.setdefault("rerun_label", {})[step] = step + "-rerun"
            save(s)
            log(f"{label}: {hot_n} of {win_n} non-run CPU samples > 25 % in the ballot window: rerunning once "
                f"as {step}-rerun", study=True)
            continue
        if res and measured and contended(hot_n, win_n):
            log(f"{label}: contended again; rerun used, the run stands flagged", study=True)
        s.setdefault("done", []).append(step)
        save(s)
        i += 1
    log("AX42 queue complete: " + json.dumps([{"label": r["label"], "runs": [(p["run"], p["tps"], p["p99"],
                                                (p["correctness"] or {}).get("E_max_abs")) for p in r["runs"]]}
                                              for r in state().get("results", [])])[:3000], study=True)
    mark(complete=now())
    write_status()


def selftest():
    d = parse_docker_stats("peer0.org1.example.com|412.5%|1.5GiB / 31.2GiB|1.2GB / 3.4GB\nbad")
    assert d["docker.peer0.org1.example.com.cpu_pct"] == 412.5
    assert d["docker.peer0.org1.example.com.mem_bytes"] == 1.5 * 1024 ** 3
    assert d["docker.peer0.org1.example.com.blk_write_bytes"] == 3.4e9
    m = parse_meminfo("MemTotal: 100 kB\nMemAvailable: 50 kB\n1.50 2.00 3.00 1/2 3\n")
    assert m == {"host.MemTotal_kb": 100, "host.MemAvailable_kb": 50, "host.load1": 1.5, "host.load5": 2.0}
    hdr = "Device r/s rkB/s rrqm/s %rrqm r_await rareq-sz w/s wkB/s %util".split()
    io = parse_iostat_line(hdr, "md2 1.00 2.00 0 0 0.5 4 3.00 4.00 9.5")
    assert io["io.md2.%util"] == 9.5 and io["io.md2.wkB/s"] == 4.0 and "io.md2.rrqm/s" not in io
    assert parse_iostat_line(hdr, "sda 1 2 3 4 5 6 7 8 9") == {}
    assert ts("2026-10-01T04:00:01Z") == 1790827201 and ts("2026-10-01T04:00:01.123Z") == 1790827201
    import tempfile
    p = os.path.join(tempfile.mkdtemp(), "r.csv")
    with open(p, "w", encoding="utf-8") as f:
        f.write("unix_ts,iso,metric,value\n100,x,host.nonrun_cpu_pct,40\n110,x,host.nonrun_cpu_pct,10\n"
                "100,x,host.cpu_pct,80\n200,x,host.nonrun_cpu_pct,90\n")
    _, hot, n = resources_summary(p, [(100, 110)])
    assert hot == [40.0] and n == 2, (hot, n)
    assert not contended(1, 621) and not contended(5, 100) and not contended(6, 400)
    assert contended(13, 621) and contended(6, 200)
    assert spec("mp1k")["name"] == "MP-1K ch4 ax42" and spec("mp1k")["reps"] == 10 and spec("mp1k")["multi"]
    assert spec("mp483k-warmup")["name"] == "MP-483K ch4 ax42 warmup" and not spec("mp483k-warmup")["measured"]
    assert spec("mp3.5m-m2-rerun")["name"] == "MP-3.5M ch4 ax42 m2 rerun"
    assert spec("mp1.92m-m1")["evid"] == "2026-10-04-ax42-mp-1.92m/m1"
    assert QUEUE[:5] == ["ladder", "mp1k", "mp10k", "mp50k", "mp483k-warmup"] and len(QUEUE) == 20
    b, t = proc_stat()
    assert 0 < b < t
    print("selftest ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["selftest"]:
        selftest()
    else:
        try:
            main()
        except Exception:  # noqa: BLE001 - an unattended controller must log why it ended
            import traceback
            log("controller died: " + traceback.format_exc(), study=True)
            raise
