SP=/mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad
echo "chain2 start; warmup attempt 1 aborted (driver killed with its session at precinct-01) $(date -Is)" >> ~/precinct-task8/logs/resets.txt
while pgrep -f aadd.sh >/dev/null; do sleep 30; done
echo "a-additive finished $(date -Is)" >> ~/precinct-task8/logs/resets.txt
bash $SP/clean.sh warmup m1 m2 m3
bash $SP/attacks.sh T20 T9 T10 T11 T12 T13 T14a T14b T15 T16 T21 T24
echo "CHAIN DONE $(date -Is)" >> ~/precinct-task8/logs/resets.txt
