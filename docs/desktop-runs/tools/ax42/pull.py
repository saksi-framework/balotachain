"""Desktop side of the AX42 study: pull what the server's controller produced.

Every run (scheduled task AX42Pull, every 15 min; one instance at a time via a file lock):
1. study-log lines: /root/ax42/study.md from the last offset -> ch4-study-log.md (AX42 section);
2. evidence: each /root/ax42/outbox/<n>-<label>/ with READY -> balotachain-n2
   docs/desktop-runs/<DEST>/ (+ the tier note), then commit and push on BRANCH;
3. archive: every file in /root/ax42/archive.tsv -> Q:\\thesis-archive\\ax42\\<run>\\..., sha256
   checked against the server's hash; a mismatch is deleted and retried next time.
The server keeps everything until the user cancels it, so a missed cycle loses nothing.

Usage: pythonw pull.py          one cycle
       python pull.py status    print what is pulled
"""
import hashlib, json, msvcrt, os, shutil, subprocess, sys, time

HERE = r"C:\Users\User\ax42-pull"
STATE = os.path.join(HERE, "pull-state.json")
LOG = os.path.join(HERE, "pull.log")
LOCK = os.path.join(HERE, "pull.lock")
TMP = os.path.join(HERE, "tmp")
REPO = r"Q:\Code - LAPTOP\Code\projects\balotachain-n2"
EVID = os.path.join(REPO, "docs", "desktop-runs")
BRANCH = "docs/ch4-night1-2026-10-01"
STUDY_LOG = r"Q:\Code - LAPTOP\Code\projects\balotachain\.superpowers\sdd\2026-09-14-study-grade-wizard\ch4-study-log.md"
SECTION = "\n## AX42 (Hetzner), 2026-10-04 →\n\n"
ARCH = r"Q:\thesis-archive\ax42"
HOST = "root@157.180.56.166"
KEY = r"C:\Users\User\.ssh\hetzner_ax42"
SSH = r"C:\Windows\System32\OpenSSH\ssh.exe"
SCP = r"C:\Windows\System32\OpenSSH\scp.exe"
OPTS = ["-i", KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=30"]
NOWIN = 0x08000000
TRAILER = ("\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n"
           "Claude-Session: https://claude.ai/code/session_015B2HKZXwcfd5r1J9GG4udm")


def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")


def run(args, timeout=600, cwd=None):
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout, cwd=cwd,
                           creationflags=NOWIN, encoding="utf-8", errors="replace")
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def ssh(cmd, timeout=300):
    return run([SSH] + OPTS + [HOST, cmd], timeout)


def scp(remote, local, recursive=False, timeout=6 * 3600):
    return run([SCP] + OPTS + (["-r"] if recursive else []) + [f"{HOST}:{remote}", local], timeout)


def state():
    try:
        with open(STATE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"offset": 0, "outbox": [], "archive": {}}


def save(s):
    with open(STATE + ".tmp", "w", encoding="utf-8") as f:
        json.dump(s, f, indent=2)
    os.replace(STATE + ".tmp", STATE)


def study_lines(s):
    rc, out, err = ssh(f"tail -c +{s['offset'] + 1} /root/ax42/study.md 2>/dev/null")
    if rc != 0 or not out:
        return
    raw = out.encode("utf-8")
    cut = raw.rfind(b"\n") + 1  # whole lines only
    if not cut:
        return
    with open(STUDY_LOG, encoding="utf-8") as f:
        has = SECTION.strip() in f.read()
    with open(STUDY_LOG, "a", encoding="utf-8") as f:
        if not has:
            f.write(SECTION)
        f.write(raw[:cut].decode("utf-8"))
    s["offset"] += cut
    save(s)


def git(*a, timeout=300):
    for i in range(6):
        rc, o, e = run(["git", "-C", REPO] + list(a), timeout)
        if rc == 0 or "index.lock" not in e:
            return rc, o, e
        time.sleep(20)
    return rc, o, e


def evidence(s):
    rc, out, _ = ssh("cd /root/ax42/outbox 2>/dev/null && ls -d */READY 2>/dev/null")
    for d in sorted(l.split("/")[0] for l in out.split()):
        if d in s["outbox"]:
            continue
        os.makedirs(TMP, exist_ok=True)
        local = os.path.join(TMP, d)
        shutil.rmtree(local, ignore_errors=True)
        rc, o, e = scp(f"/root/ax42/outbox/{d}", TMP, recursive=True, timeout=3600)
        if rc != 0 or not os.path.exists(os.path.join(local, "READY")):
            log(f"outbox {d}: scp failed rc {rc} {e[:200]}")
            return
        with open(os.path.join(local, "DEST"), encoding="utf-8") as f:
            dest = os.path.join(EVID, *f.read().strip().split("/"))
        with open(os.path.join(local, "MSG"), encoding="utf-8") as f:
            msg = f.read().strip()
        os.makedirs(dest, exist_ok=True)
        for n in os.listdir(local):
            if n in ("DEST", "MSG", "READY", "TIERNOTE", "TIERNOTE.md"):
                continue
            src, dst = os.path.join(local, n), os.path.join(dest, n)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
        if os.path.exists(os.path.join(local, "TIERNOTE")):
            with open(os.path.join(local, "TIERNOTE"), encoding="utf-8") as f:
                tn = f.read().strip()
            shutil.copy2(os.path.join(local, "TIERNOTE.md"), os.path.join(EVID, tn))
        git("add", "docs/desktop-runs")
        rc, o, e = git("commit", "-q", "-m", msg + TRAILER)
        log(f"outbox {d}: commit rc {rc} {e.strip()[:200]}")
        if rc != 0 and "nothing to commit" not in (o + e):
            return
        rc, o, e = git("push", "-q", "origin", BRANCH, timeout=600)
        log(f"outbox {d}: push rc {rc} {e.strip()[:200]}")
        s["outbox"].append(d)
        save(s)
        shutil.rmtree(local, ignore_errors=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""):
            h.update(b)
    return h.hexdigest()


def archive(s):
    rc, out, _ = ssh("cat /root/ax42/archive.tsv 2>/dev/null")
    for line in out.splitlines():
        p = line.split("\t")
        if len(p) != 4 or p[1] in s["archive"]:
            continue
        key, path, want, size = p
        if "/campaign/runs/" in path:
            rel = path.split("/campaign/runs/", 1)[1].split("/", 1)[1]
        else:
            rel = "logs/" + os.path.basename(path)
        dest = os.path.join(ARCH, key, *rel.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        free = shutil.disk_usage(ARCH).free
        if free < int(size) + 20e9:
            log(f"archive: Q: {free/1e9:.1f} GB free, {path} needs {int(size)/1e9:.1f} GB + 20 GB: held")
            return
        t0 = time.time()
        rc, o, e = scp(path, dest)
        got = sha256(dest) if rc == 0 and os.path.exists(dest) else None
        if got != want:
            log(f"archive {path}: rc {rc} sha256 {got} != {want}: removed, retry next cycle {e[:200]}")
            if os.path.exists(dest):
                os.remove(dest)
            return
        s["archive"][path] = {"dest": dest, "sha256": got, "bytes": int(size), "at": time.strftime("%Y-%m-%d %H:%M:%S")}
        save(s)
        log(f"archive {path} -> {dest}: {int(size)/1e9:.2f} GB in {time.time()-t0:.0f} s, sha256 ok")


def main():
    os.makedirs(HERE, exist_ok=True)
    lockf = open(LOCK, "a+")
    try:
        msvcrt.locking(lockf.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        return  # a previous cycle is still pulling
    s = state()
    s.setdefault("archive", {})
    try:
        study_lines(s)
        evidence(s)
        study_lines(s)
        archive(s)
    except Exception as e:  # noqa: BLE001 - the scheduled task must log, not die silently
        import traceback
        log("cycle failed: " + traceback.format_exc()[-800:])


if __name__ == "__main__":
    if sys.argv[1:] == ["status"]:
        s = state()
        print(json.dumps({"offset": s.get("offset"), "outbox": s.get("outbox"),
                          "archived_files": len(s.get("archive", {})),
                          "archived_gb": round(sum(v["bytes"] for v in s.get("archive", {}).values()) / 1e9, 2)}, indent=1))
    else:
        main()
