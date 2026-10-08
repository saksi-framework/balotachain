#!/usr/bin/env bash
# D3: crash the orderer AND the (sole-endorser) peer0.org1 at 3 points during an
# on-chain ballot window, restart with NO reset, then resume + verify-only. The
# decrypted tally must reproduce ground truth (E=0): no accepted ballot lost.
set -uo pipefail
VOTERS="${1:-50000}"
OUT=/root/ch4-ax42/security/D3
TOOLS=/root/ch4-ax42/security/tools
mkdir -p "$OUT"
: > "$OUT/kills.log"

# Kicker: wait for the ballot window to open, then 3 stop/start cycles.
(
  sleep 40
  for n in 1 2 3; do
    echo "[$(date -u +%H:%M:%S)] cycle $n stop orderer.example.com peer0.org1.example.com" >> "$OUT/kills.log"
    docker stop orderer.example.com peer0.org1.example.com >> "$OUT/kills.log" 2>&1
    sleep 15
    echo "[$(date -u +%H:%M:%S)] cycle $n start" >> "$OUT/kills.log"
    docker start orderer.example.com peer0.org1.example.com >> "$OUT/kills.log" 2>&1
    sleep 25
  done
  # ensure all back up
  docker start orderer.example.com peer0.org1.example.com peer0.org2.example.com >> "$OUT/kills.log" 2>&1
  echo "[$(date -u +%H:%M:%S)] kills done, containers up" >> "$OUT/kills.log"
) &
KICKER=$!

PATH=/root/Code/fabric-samples/bin:/usr/local/go/bin:/usr/bin:/bin \
  python3 "$TOOLS/run_plain.py" --voters "$VOTERS" --label d3-crash-$(date -u +%H%M%S) --out "$OUT" --resume \
  >> "$OUT/evidence.txt" 2>&1
wait $KICKER 2>/dev/null
docker start orderer.example.com peer0.org1.example.com peer0.org2.example.com >> "$OUT/kills.log" 2>&1
echo "D3 wrapper done" >> "$OUT/evidence.txt"
