#!/usr/bin/env bash
# T20 (cross-precinct tally replay). Driver pre-tally hook (saksi 4b9284d;
# run_all.sh passes --attack-pre-tally-tolerate with it):
#   SAKSI_HOOK=pre-tally   args: <precinct dir> <election id>
# run in every precinct, after CloseElection + partials and before PublishTally.
#
# When the precinct is the T20 target (default p04), it reads the previous
# precinct's (p03) trustee-signed tally and submits it with `tamper_invoke
# publish-tally --channel --election`. The tally proto carries p03's election
# id, so the call addresses p03's election (already closed and tallied), not
# p04's: the expected response is a refusal whose gate text names p03's
# election (e.g. already published). The line is recorded verbatim to
# <run dir>/t20-onchain.txt; the paper words it as "refused by the election
# binding of the target precinct" and cites the gate text as recorded.
# canvass.accuracy (p04 tally.homomorphic_sum) is the backstop if it committed.
#
# Must exit 0 even on refusal. Needs a live network + tamper_invoke (desktop).
set -euo pipefail

pdir="$1"; eid="$2"
run="$(cd "$pdir/.." && pwd)"
target="${CANVASS_TARGET:-4}"
sibling="${CANVASS_SIBLING:-3}"
tamper="${TAMPER:-$(cd "$(dirname "$0")/../tamper_invoke" && pwd)/tamper_invoke}"
channel="${SAKSI_CHANNEL:-saksi}"
outfile="$run/t20-onchain.txt"

num=$(basename "$pdir" | sed 's/.*-//')
if [ "$((10#$num))" -ne "$target" ]; then
  echo "[skip] T20 $(basename "$pdir") is not the target precinct $target"
  exit 0
fi

sibhdr=$(printf '%s/precinct-%02d/header.json' "$run" "$sibling")
if [ ! -f "$sibhdr" ]; then
  echo "[skip] T20 sibling header $sibhdr not found"
  exit 0
fi
tally=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["tally"])' "$sibhdr")
echo "[MOUNTED] T20 publishing precinct-$(printf '%02d' "$sibling")'s tally onto $eid (channel $channel)"
line=$("$tamper" publish-tally --tally-hex "$tally" --channel "$channel" --election "$eid" --label "T20" 2>&1 | tail -1)
echo "$line"
echo "$line" > "$outfile"
exit 0
