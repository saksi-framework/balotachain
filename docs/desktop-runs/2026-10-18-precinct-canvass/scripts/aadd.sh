. /mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad/env.sh
set -uo pipefail
DEMO=$HOME/Code/saksi/target/release/saksi-demo
OUT=$HOME/precinct-task8/a-additive
export SAKSI_AUDIT_THREADS=16
for r in "$@"; do
  A=/mnt/q/thesis-archive/runs/$r; W=$HOME/scratch-precinct/$r; O=$OUT/$r
  mkdir -p "$W" "$O"
  echo "== $r $(date -Is)"
  cp "$A/header.json" "$W/"
  t0=$(date +%s); zstd -d -q -f "$A/ballots.ndjson.zst" -o "$W/ballots.ndjson"; t1=$(date +%s)
  echo "decompress_s=$((t1-t0))" | tee "$O/walltime.txt"
  got=$(sha256sum "$W/ballots.ndjson" | cut -d' ' -f1); want=$(cut -d' ' -f1 "$A/ballots.ndjson.sha256")
  echo "sha256 got=$got want=$want" | tee "$O/sha256-check.txt"
  if [ "$got" != "$want" ]; then echo "SHA MISMATCH, skipping $r"; echo MISMATCH >> "$O/sha256-check.txt"; rm -rf "$W"; continue; fi
  echo MATCH >> "$O/sha256-check.txt"
  t0=$(date +%s.%N)
  "$DEMO" precinct-aggregate "$W" --precinct-size 1000 --ground-truth "$A/ground-truth-ballots.csv" \
     --correctness "$A/correctness.csv" --out "$O" > "$O/stdout.txt" 2> "$O/stderr.txt"
  ec=$?; t1=$(date +%s.%N)
  echo "exit_code=$ec aggregate_wall_s=$(echo "$t1 - $t0" | bc)" | tee -a "$O/walltime.txt"
  tail -3 "$O/stdout.txt"
  rm -rf "$W"
done
rmdir $HOME/scratch-precinct 2>/dev/null; echo done $(date -Is)
