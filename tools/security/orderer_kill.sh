#!/usr/bin/env bash
# D3 extension: kill the orderer AND peer0.org2 at 3 points, each down for a
# spell, then restart — alongside a running ballot window. The console fault API
# covers peer0.org1 restart; this covers the orderer (new) and org2 leg.
# Usage: orderer_kill.sh <down_seconds> <gap_seconds>   (3 cycles)
set -euo pipefail
DOWN="${1:-20}"; GAP="${2:-30}"
for n in 1 2 3; do
  echo "[$(date -u +%H:%M:%S)] cycle $n: docker stop orderer.example.com peer0.org2.example.com"
  docker stop orderer.example.com peer0.org2.example.com >/dev/null
  sleep "$DOWN"
  echo "[$(date -u +%H:%M:%S)] cycle $n: docker start (down ${DOWN}s)"
  docker start orderer.example.com peer0.org2.example.com >/dev/null
  sleep "$GAP"
done
echo "orderer/org2 kill drill done (3 cycles)"
