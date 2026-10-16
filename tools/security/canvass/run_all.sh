#!/usr/bin/env bash
# Drive the national-canvass attack scenarios end to end against a live Fabric
# network, one full 10-precinct run per scenario, and judge each with
# assert_outcome.py into negative-tests-canvass.csv.
#
# This runs the REAL console driver (saksi-canvass-demo) and needs the desktop:
# a deployed chaincode and the generated fabric-samples identities. It does NOT
# reset the network (ground rule: no attack during a measured run, one reset per
# run). Reset with tools/tier.sh and host-hygiene BEFORE each scenario yourself;
# the summary accumulates across invocations, so the usual use is one scenario
# per reset:  run_all.sh --only T9   (reset)   run_all.sh --only T10 ...
#
# Required env (no sane default possible):
#   DRIVER   path to the built saksi-canvass-demo
#   DEMO     path to the built saksi-demo (SAKSI_DEMO is also honoured)
#   FABRIC_TLS_CERT / FABRIC_CERT / FABRIC_KEY   the driver's identity
# Optional env:
#   GEN_ROOT (default a fresh mktemp dir per scenario), VOTERS (10000),
#   POSITIONS (3), CANDIDATES (4), PRECINCTS (10), CHANNEL (saksi),
#   REPORT (./negative-tests-canvass.csv), TAMPER (../tamper_invoke/tamper_invoke)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
mut="$here/mutate_return.py"
demo="${DEMO:-${SAKSI_DEMO:-saksi-demo}}"
driver="${DRIVER:?set DRIVER to the saksi-canvass-demo binary}"
voters="${VOTERS:-10000}"; positions="${POSITIONS:-3}"; candidates="${CANDIDATES:-4}"
precincts="${PRECINCTS:-10}"; channel="${CHANNEL:-saksi}"
report="${REPORT:-$PWD/negative-tests-canvass.csv}"
export SAKSI_DEMO="$demo" SAKSI_CHANNEL="$channel"
export TAMPER="${TAMPER:-$here/../tamper_invoke/tamper_invoke}"

ALL=(T9 T10 T11 T12 T13 T14a T14b T15 T16 T19 T20 T21 T24)
only=""
[ "${1:-}" = "--only" ] && { only="$2"; shift 2; }

cat <<'REMINDER'
================= HOST HYGIENE (ask the user; none pre-approved) =================
  * Docker virtual-disk compaction; `wsl --shutdown` is NEVER pre-approved.
  * Host free space on Q: and C:. PC on the AVR or wall.
  * No measured run in progress. ONE network reset (tools/tier.sh) per scenario.
  * This script does NOT reset the network. Reset + gen a fresh dir per scenario.
=================================================================================
REMINDER

fabric_flags=(
  --fabric-channel "$channel"
  --fabric-tls-cert "${FABRIC_TLS_CERT:?set FABRIC_TLS_CERT}"
  --fabric-cert "${FABRIC_CERT:?set FABRIC_CERT}"
  --fabric-key "${FABRIC_KEY:?set FABRIC_KEY}"
)

run_one() {
  local scen="$1" id="${1%[ab]}"
  local dir="${GEN_ROOT:-$(mktemp -d)}/$scen"
  echo "=== $scen : generating a fresh $precincts-precinct election into $dir ==="
  "$demo" gen --stream "$dir" --precincts "$precincts" --voters "$voters" \
    --positions "$positions" --candidates "$candidates" --trustees 5 --threshold 3 \
    --election-id "cv-$scen" --distribution realistic >/dev/null

  local hook=(--attack "$scen")
  case "$scen" in
    T14b) export CANVASS_T14=close ;;
    *)    unset CANVASS_T14 || true ;;
  esac
  case "$scen" in
    T19) hook+=(--attack-pre-close-script "$here/pre_close_t19.sh") ;;
    T20) hook+=(--attack-pre-tally-script "$here/pre_tally_t20.sh") ;;  # hook: see README / task5 report
    *)   hook+=(--attack-script "python3 $mut --scenario $id") ;;
  esac

  "$driver" --dir "$dir" --demo "$demo" --out "$dir/run" "${fabric_flags[@]}" "${hook[@]}" || true

  local onchain=""
  [ "$scen" = "T19" ] && onchain="$(cat "$dir/t19-onchain.txt" 2>/dev/null || true)"
  [ "$scen" = "T20" ] && onchain="$(cat "$dir/t20-onchain.txt" 2>/dev/null || true)"
  python3 "$here/assert_outcome.py" "$scen" "$dir/run/canvass-checks.csv" \
    --out "$report" ${onchain:+--onchain "$onchain"} || true
}

if [ -n "$only" ]; then
  run_one "$only"
else
  for s in "${ALL[@]}"; do run_one "$s"; done
fi

echo "---"
echo "report: $report"
column -s, -t "$report" 2>/dev/null || cat "$report"
