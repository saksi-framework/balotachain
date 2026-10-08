#!/usr/bin/env bash
# D4: tc netem delay/loss on the Fabric docker bridge during the ballot window.
# Usage: netem.sh add [delay_ms] [loss_pct] | netem.sh clear
# ponytail: acts on the docker bridge for the fabric_test network; needs root + tc.
set -euo pipefail
NET="$(docker network ls --format "{{.Name}}" | grep -E "fabric_test|compose_test" | head -1)"
[ -z "$NET" ] && { echo "no fabric docker network found"; exit 1; }
ID="$(docker network inspect -f "{{.Id}}" "$NET")"
BR="br-${ID:0:12}"
case "${1:-}" in
  add)
    D="${2:-100}"; L="${3:-5}"
    tc qdisc replace dev "$BR" root netem delay "${D}ms" loss "${L}%"
    echo "netem on $BR ($NET): delay ${D}ms loss ${L}%"; tc qdisc show dev "$BR" ;;
  clear)
    tc qdisc del dev "$BR" root 2>/dev/null || true
    echo "netem cleared on $BR"; tc qdisc show dev "$BR" ;;
  *) echo "usage: netem.sh add [delay_ms] [loss_pct] | clear"; exit 2 ;;
esac
