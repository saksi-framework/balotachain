#!/usr/bin/env bash
# Self-test for the national-canvass attack runners, with no Fabric network.
#
# It builds a canvass fixture the way the Task 2 tests do: `saksi-demo gen
# --precincts 3`, then fakes each precinct's chain read-back (ballots.ndjson
# sorted into nullifier order), close.json, a signed return, and the delivered
# returns in national/returns/. Then, for each file-level scenario (T9-T16,
# T21, T24), it emulates the driver's hooks (return hook per precinct, then the
# national hook), runs `saksi-demo audit-canvass`, and checks that
# assert_outcome.py reports PASS against the corrected expected sets.
#
# The chain scenarios (T19, T20) are not exercised here: they need a live
# network. See README.md.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
demo="${SAKSI_DEMO:-saksi-demo}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export SAKSI_DEMO="$demo"
# The fixture has three precincts; target p02, donor/sibling p01.
export CANVASS_TARGET=2 CANVASS_SIBLING=1 CANVASS_T24_VICTIM=1

TARGETS=(T9 T10 T11 T12 T13 T14a T14b T15 T16 T21 T24)

echo "demo = $($demo --version 2>/dev/null || echo "$demo")"
base="$work/clean"
"$demo" gen --stream "$base" --precincts 3 --voters 30 --positions 2 \
  --candidates 4 --trustees 5 --threshold 3 --election-id cv-test \
  --distribution realistic >/dev/null
echo "built fixture: 3 precincts x (30/2 voters) x 2 positions"

# Fake the chain read-back + close + signed returns, exactly like the Task 2 fixture.
build_returns() {  # <dir>
  local d="$1" k pdir blk tip
  for k in 01 02 03; do
    pdir="$d/precinct-$k"; mkdir -p "$pdir/ledger"
    python3 "$here/_sort_nullifier.py" "$pdir/ballots.ndjson" "$pdir/ledger/ballots.ndjson"
    blk=$((100 + 10#$k)); tip=$(printf '11%.0s' $(seq 1 32))
    printf '{"close_block": %d, "close_tip_hash": "%s"}\n' "$blk" "$tip" > "$pdir/close.json"
    "$demo" sign-return "$pdir" --ledger "$pdir/ledger/ballots.ndjson" \
      --close-block "$blk" --tip-hash "$tip" --key "$pdir/authority.key" \
      --out "$pdir/return.json" >/dev/null
  done
}
build_returns "$base"

# Baseline: a clean canvass must pass all seven checks.
mkdir -p "$base/national/returns"
for k in 01 02 03; do cp "$base/precinct-$k/return.json" "$base/national/returns/p$k.json"; done
"$demo" audit-canvass "$base" >/dev/null && echo "baseline clean canvass: pass" \
  || { echo "BASELINE FAILED"; exit 1; }

report="$work/negative-tests-canvass.csv"
rm -f "$report"
fails=0
for scen in "${TARGETS[@]}"; do
  id="${scen%[ab]}"           # T14a/T14b -> T14 for the subcommand
  run="$work/$scen"
  cp -r "$base" "$run"
  rm -rf "$run/national/returns"; mkdir -p "$run/national/returns"
  [ "$scen" = "T14b" ] && export CANVASS_T14=close || unset CANVASS_T14
  # return hook, per precinct, then copy (the driver's copy step)
  for k in 01 02 03; do
    pdir="$run/precinct-$k"
    SAKSI_HOOK=return python3 "$here/mutate_return.py" --scenario "$id" \
      "$pdir" "$pdir/return.json" "$run/national"
    [ -f "$pdir/return.json" ] && cp "$pdir/return.json" "$run/national/returns/p$k.json"
  done
  # national hook, once
  SAKSI_HOOK=national python3 "$here/mutate_return.py" --scenario "$id" "$run/national" || true
  "$demo" audit-canvass "$run" --out "$run" >/dev/null 2>&1 || true
  python3 "$here/assert_outcome.py" "$scen" "$run/canvass-checks.csv" --out "$report" || fails=$((fails + 1))
done

echo "---"
echo "report: $report"
column -s, -t "$report" 2>/dev/null || cat "$report"
if [ "$fails" -ne 0 ]; then
  echo "SELFTEST: $fails scenario(s) FAILED"
  exit 1
fi
echo "SELFTEST: all ${#TARGETS[@]} file scenarios PASS"
