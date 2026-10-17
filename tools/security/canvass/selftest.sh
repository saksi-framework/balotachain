#!/usr/bin/env bash
# Self-test for the national-canvass attack runners, with no Fabric network.
#
# It builds a canvass fixture the way the Task 2 tests do: `saksi-demo gen
# --precincts 7` (enough for the plan's own targets p03-p07, so no target
# override is used and a wrongly wired target/sibling shows up), then fakes
# each precinct's chain read-back (ballots.ndjson sorted into nullifier order),
# close.json, a signed return, and the delivered returns in national/returns/.
# Then, for each file-level scenario (T9-T16, T21, T24), it emulates the
# driver's hooks (return hook per precinct in ascending order, then the national
# hook), fails if the scenario never printed [MOUNTED], runs `saksi-demo
# audit-canvass`, and checks that assert_outcome.py reports PASS against the
# corrected expected sets.
#
# The chain scenarios (T19, T20) are not exercised here: they need a live
# network. See README.md.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
demo="${SAKSI_DEMO:-saksi-demo}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export SAKSI_DEMO="$demo"
# Use the scenarios' real targets and siblings (no override).
unset CANVASS_TARGET CANVASS_SIBLING CANVASS_T24_VICTIM
P=(01 02 03 04 05 06 07)

TARGETS=(T9 T10 T11 T12 T13 T14a T14b T15 T16 T21 T24)

base="$work/clean"
"$demo" gen --stream "$base" --precincts 7 --voters 70 --positions 2 \
  --candidates 4 --trustees 5 --threshold 3 --election-id cv-test \
  --distribution realistic >/dev/null
echo "built fixture: 7 precincts x 10 voters x 2 positions"

# Fake the chain read-back + close + signed returns, exactly like the Task 2 fixture.
for k in "${P[@]}"; do
  pdir="$base/precinct-$k"; mkdir -p "$pdir/ledger"
  python3 "$here/_sort_nullifier.py" "$pdir/ballots.ndjson" "$pdir/ledger/ballots.ndjson"
  blk=$((100 + 10#$k)); tip=$(printf '11%.0s' $(seq 1 32))
  printf '{"close_block": %d, "close_tip_hash": "%s"}\n' "$blk" "$tip" > "$pdir/close.json"
  "$demo" sign-return "$pdir" --ledger "$pdir/ledger/ballots.ndjson" \
    --close-block "$blk" --tip-hash "$tip" --key "$pdir/authority.key" \
    --out "$pdir/return.json" >/dev/null
done

# Baseline: a clean canvass must pass all seven checks.
mkdir -p "$base/national/returns"
for k in "${P[@]}"; do cp "$base/precinct-$k/return.json" "$base/national/returns/p$k.json"; done
"$demo" audit-canvass "$base" >/dev/null && echo "baseline clean canvass: pass" \
  || { echo "BASELINE FAILED"; exit 1; }
rm -rf "$base/national/returns"
# Hide every signed return; each is released only when its precinct's hook runs,
# as the driver's sign-return does, so a later precinct's return never exists
# early (a backwards donor is skipped and caught below).
for k in "${P[@]}"; do mv "$base/precinct-$k/return.json" "$base/precinct-$k/.signed-return.json"; done

report="$work/negative-tests-canvass.csv"
fails=0
for scen in "${TARGETS[@]}"; do
  id="${scen%[ab]}"           # T14a/T14b -> T14 for the subcommand
  run="$work/$scen"
  log="$work/$scen.hook.log"
  cp -r "$base" "$run"
  mkdir -p "$run/national/returns"
  if [ "$scen" = "T14b" ]; then export CANVASS_T14=close; else unset CANVASS_T14; fi
  # return hook, per precinct in ascending order, then the driver's copy step
  for k in "${P[@]}"; do
    pdir="$run/precinct-$k"
    mv "$pdir/.signed-return.json" "$pdir/return.json"
    SAKSI_HOOK=return python3 "$here/mutate_return.py" --scenario "$id" \
      "$pdir" "$pdir/return.json" "$run/national" >> "$log"
    if [ -f "$pdir/return.json" ]; then cp "$pdir/return.json" "$run/national/returns/p$k.json"; fi
  done
  SAKSI_HOOK=national python3 "$here/mutate_return.py" --scenario "$id" "$run/national" >> "$log"
  grep '^\[MOUNTED\]' "$log" || true
  if ! grep -q "^\[MOUNTED\] $id " "$log"; then
    echo "FAIL $scen: never mounted (only [skip] lines)"; fails=$((fails + 1)); continue
  fi
  "$demo" audit-canvass "$run" --out "$run" >/dev/null 2>&1 || true
  python3 "$here/assert_outcome.py" "$scen" "$run/canvass-checks.csv" --out "$report" || fails=$((fails + 1))
done

echo "---"
echo "report: $report"
cat "$report"
if [ "$fails" -ne 0 ]; then
  echo "SELFTEST: $fails scenario(s) FAILED"
  exit 1
fi
echo "SELFTEST: all ${#TARGETS[@]} file scenarios PASS"
