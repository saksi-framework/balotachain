#!/usr/bin/env bash
# T19 (cross-precinct double vote). Driver pre-close hook:
#   SAKSI_HOOK=pre-close   args: <precinct dir> <election id>
# run in every precinct, after the ballot window and before CloseElection.
#
# When the precinct is the T19 target (default p04), it takes a ballot already
# committed on the previous precinct's election (p03) and resubmits it to the
# current channel with `tamper_invoke submit-raw --channel`. The ballot proto
# carries p03's election id, so the call addresses p03's (already closed)
# election, not p04's: the expected response is a refusal whose gate text names
# p03's election (e.g. election closed / nullifier). The line is recorded
# verbatim to <run dir>/t19-onchain.txt; the paper words it as "refused by the
# election binding of the target precinct" and cites the gate text as recorded.
# canvass.nullifier_unique (+ accuracy) is the backstop if it had committed.
#
# Must exit 0 even on an on-chain refusal (a non-zero exit would stop the run).
# Needs a live Fabric network and the built tamper_invoke binary (desktop only).
set -euo pipefail

pdir="$1"; eid="$2"
run="$(cd "$pdir/.." && pwd)"
target="${CANVASS_TARGET:-4}"
sibling="${CANVASS_SIBLING:-3}"
tamper="${TAMPER:-$(cd "$(dirname "$0")/../tamper_invoke" && pwd)/tamper_invoke}"
channel="${SAKSI_CHANNEL:-saksi}"
outfile="$run/t19-onchain.txt"

num=$(basename "$pdir" | sed 's/.*-//')
if [ "$((10#$num))" -ne "$target" ]; then
  echo "[skip] T19 $(basename "$pdir") is not the target precinct $target"
  exit 0
fi

src=$(printf '%s/precinct-%02d/ballots.ndjson' "$run" "$sibling")
if [ ! -f "$src" ]; then
  echo "[skip] T19 sibling ballots $src not found"
  exit 0
fi
tmp=$(mktemp --suffix=.hex)
head -n1 "$src" | tr -d '[:space:]' > "$tmp"
echo "[MOUNTED] T19 resubmitting a precinct-$(printf '%02d' "$sibling") ballot onto $eid (channel $channel)"
line=$("$tamper" submit-raw --ballot "$tmp" --channel "$channel" --election "$eid" --label "T19" 2>&1 | tail -1)
rm -f "$tmp"
echo "$line"
echo "$line" > "$outfile"
exit 0
