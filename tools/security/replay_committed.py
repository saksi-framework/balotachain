#!/usr/bin/env python3
"""D2 replay: resubmit already-committed ballots; each must be refused gate=nullifier.

Reads ballots (hex, one per line) from a run dir ballots.ndjson(.zst) or a
saksi-demo bundle (.json, ballots[]), then shells out to the Go gateway client
(tamper_invoke submit-raw) per ballot so the gate= detail is captured.
ponytail: subprocess per ballot (fine for the tens of replays D2 needs).
"""
import argparse, json, subprocess, sys, tempfile, os, io, shutil
TOOL = "/root/ch4-ax42/security/tools/tamper_invoke/tamper_invoke"

def load_ballots(src, n):
    if src.endswith(".json"):
        return json.load(open(src))["ballots"][:n]
    if src.endswith(".zst"):
        raw = subprocess.run(["zstd","-dc",src], capture_output=True, check=True).stdout.decode()
    else:
        raw = open(src).read()
    return [ln.strip() for ln in raw.splitlines() if ln.strip()][:n]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="ballots.ndjson(.zst) or bundle.json")
    ap.add_argument("-n", type=int, default=10, help="number of committed ballots to replay")
    a = ap.parse_args()
    ballots = load_ballots(a.source, a.n)
    print(f"replaying {len(ballots)} committed ballot(s)")
    refused_nullifier = 0
    for i, h in enumerate(ballots):
        with tempfile.NamedTemporaryFile("w", suffix=".hex", delete=False) as f:
            f.write(h); path = f.name
        out = subprocess.run([TOOL,"submit-raw","--ballot",path,"--label",f"replay[{i}]"],
                              capture_output=True, text=True).stdout
        os.unlink(path)
        line = out.strip().splitlines()[-1] if out.strip() else "(no output)"
        print(line)
        if "gate=nullifier" in line:
            refused_nullifier += 1
    print(f"RESULT: {refused_nullifier}/{len(ballots)} refused gate=nullifier")
    sys.exit(0 if refused_nullifier == len(ballots) else 1)

if __name__ == "__main__":
    main()
