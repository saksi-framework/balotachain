#!/usr/bin/env bash
# D4: run an on-chain election with tc netem (delay/loss) on the Fabric bridge for
# the whole ballot window; the run must complete with no dropped ballots and E=0.
# netem is always cleared on exit (trap).
set -uo pipefail
VOTERS="${1:-50000}"; DELAY="${2:-40}"; LOSS="${3:-0.5}"
OUT=/root/ch4-ax42/security/D4
TOOLS=/root/ch4-ax42/security/tools
mkdir -p "$OUT"
trap "$TOOLS/netem.sh clear >> $OUT/evidence.txt 2>&1" EXIT
{
  echo "# D4 netem during ballot window  $(date -u)"
  echo "## apply netem delay=${DELAY}ms loss=${LOSS}% on the fabric bridge"
  "$TOOLS/netem.sh" add "$DELAY" "$LOSS"
  echo "## run on-chain election voters=$VOTERS under netem"
  PATH=/root/Code/fabric-samples/bin:/usr/local/go/bin:/usr/bin:/bin \
    python3 "$TOOLS/run_plain.py" --voters "$VOTERS" --label d4-netem-$(date -u +%H%M%S) --out "$OUT"
} >> "$OUT/evidence.txt" 2>&1
