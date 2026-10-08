#!/usr/bin/env bash
# Re-verify an archived run folder with the A5 auditor (saksi branch
# security/reorder-detection), streaming the zstd ballot files through FIFOs so
# nothing large is decompressed to disk.
# usage: reverify.sh <run-dir> [label] [ledger-ballots-override.zst]
set -u
RUN=$1; LABEL=${2:-$(basename "$RUN")}; LEDGER_ZST=${3:-$RUN/ledger/ballots.ndjson.zst}
BIN=/root/ch4-ax42/security/A5/a5-auditor
OUT=/root/ch4-ax42/security/A5/results; mkdir -p "$OUT"
W=$(mktemp -d /root/ch4-ax42/security/A5/work.XXXX); mkdir "$W/ledger"
ln -s "$RUN/header.json" "$W/header.json"
ln -s "$RUN/ledger/header.json" "$W/ledger/header.json"
mkfifo "$W/ballots.ndjson" "$W/ledger/ballots.ndjson"
# One full decompression per open of the FIFO; the auditor opens each file
# sequentially (served: crypto audit, then ledger.order; ledger: ledger.order).
feed() { while [ -p "$2" ]; do zstd -dcq "$1" > "$2" 2>/dev/null; done; }
feed "$RUN/ballots.ndjson.zst" "$W/ballots.ndjson" >/dev/null 2>&1 & P1=$!
feed "$LEDGER_ZST" "$W/ledger/ballots.ndjson" >/dev/null 2>&1 & P2=$!
start=$(date +%s)
SAKSI_AUDIT_THREADS=${SAKSI_AUDIT_THREADS:-8} nice -n 10 "$BIN" audit-stream "$W" --json > "$OUT/$LABEL.json" 2> "$OUT/$LABEL.err"
rc=$?
secs=$(( $(date +%s) - start ))
# Stop the feeders: remove the FIFOs, then unblock any writer stuck in open().
rm -f "$W/ballots.ndjson" "$W/ledger/ballots.ndjson"
kill $P1 $P2 2>/dev/null; pkill -9 -P $P1 2>/dev/null; pkill -9 -P $P2 2>/dev/null; kill -9 $P1 $P2 2>/dev/null
rm -rf "$W"
python3 - "$OUT/$LABEL.json" "$LABEL" "$rc" "$secs" <<'PY'
import json,sys
p,label,rc,secs=sys.argv[1:]
try: sa=json.load(open(p))
except Exception as e: print(f"{label}\tERROR rc={rc} {e}"); sys.exit()
fc=[f["check"] for f in sa.get("failed_checks",[])]
e=sum(abs(c["E"]) for c in sa["contests"])
lo=(sa.get("ledger_order") or "ABSENT")[:110]
print(f"{label}\toverall={sa['overall']}\tfailed={fc}\tsumE={e}\tcontests={len(sa['contests'])}\t{secs}s\tledger.order={lo}")
PY
