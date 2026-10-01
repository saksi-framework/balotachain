#!/bin/bash
# Step 0: free derived files in run folders. DRY=1 lists only.
cd ~/.saksi/campaign/runs || exit 1
KEEP="sp-10k-ch4-sec-20260929-183410-129 mp-1k-ch4-sec-20260930-185139-29 sp-10k-ch4-t3-20260929-183754-130"
df -B1 / | tail -1
csvb=0; ndb=0; ncsv=0; nnd=0; nobuild=0
for d in */; do d=${d%/}; [ -f "$d/run.json" ] || [ -f "$d/journal.ndjson" ] || continue
  keep=0; for k in $KEEP; do [ "$d" = "$k" ] && keep=1; done
  if [ -f "$d/ballots.csv" ] && [ $keep = 0 ]; then s=$(stat -c%s "$d/ballots.csv"); csvb=$((csvb+s)); ncsv=$((ncsv+1)); [ -z "$DRY" ] && rm -f "$d/ballots.csv"; fi
  if [ -f "$d/ballots.ndjson" ]; then
    b=$(grep -o '"git_head_saksi": *"[0-9a-f]*"' "$d/run.json" 2>/dev/null | head -1 | grep -o '[0-9a-f]\{40\}')
    [ -z "$b" ] && b=$(head -1 "$d/journal.ndjson" 2>/dev/null | grep -o '"git_head_saksi":"[0-9a-f]*"' | grep -o '[0-9a-f]\{40\}')
    if [ -z "$b" ]; then nobuild=$((nobuild+1)); echo "NOBUILD $d"; continue; fi
    case "$b" in 4a38a54*) ;; *) s=$(stat -c%s "$d/ballots.ndjson"); ndb=$((ndb+s)); nnd=$((nnd+1)); echo "old ${b:0:7} $d"; [ -z "$DRY" ] && rm -f "$d/ballots.ndjson";; esac
  fi
done
echo "csv files $ncsv bytes $csvb; old-build ndjson files $nnd bytes $ndb; no-build $nobuild"
df -B1 / | tail -1
