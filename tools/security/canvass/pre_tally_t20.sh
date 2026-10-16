#!/usr/bin/env bash
# T20 (cross-precinct tally replay). Mounts against a hook the Task 4 driver
# does NOT yet expose:
#
#   --attack-pre-tally-script   SAKSI_HOOK=pre-tally   args: <precinct dir> <election id>
#       run in every precinct, after CloseElection + partials and before
#       PublishTally.
#
# REQUIRED DRIVER CHANGE (Task 4): add this hook in precinctLifecycle, between
# submitPartials and the PublishTally step, with the same arg/exit contract as
# the other hooks (args "<precinct dir> <election id>", non-zero exit stops the
# run). Until it exists, this script cannot be wired in; it is written here so
# the mount is ready. See README.md and task5 report.
#
# When the precinct is the T20 target (default p04), it reads the previous
# precinct's (p03) trustee-signed tally and publishes it on the current channel
# with `tamper_invoke publish-tally --channel --election`. The tally proto
# carries p03's election id, so the chaincode is expected to REFUSE it. The
# response is recorded to <run dir>/t20-onchain.txt; canvass.accuracy
# (p04 tally.homomorphic_sum) is the backstop if it had committed.
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
