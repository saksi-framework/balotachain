SP=/mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad
echo "chain3 start: attacks first, then clean runs (warm-up attempt 2 stopped at precinct-02 to reorder) $(date -Is)" >> ~/precinct-task8/logs/resets.txt
bash $SP/attacks.sh T20 T9 T10 T11 T12 T13 T14a T14b T15 T16 T21 T24
bash $SP/clean.sh warmup m1 m2 m3
echo "CHAIN DONE $(date -Is)" >> ~/precinct-task8/logs/resets.txt
