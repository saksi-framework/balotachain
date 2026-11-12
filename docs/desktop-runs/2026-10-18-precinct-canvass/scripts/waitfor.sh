# usage: waitfor.sh <pattern> [file]  waits up to ~9.5 min
f=${2:-$HOME/precinct-task8/logs/resets.txt}
for i in $(seq 1 50); do grep -q "$1" "$f" 2>/dev/null && break; sleep 10; done
tail -4 "$f"
