. /mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad/runenv.sh
D=$T8/smoke; rm -rf $D
$DEMO gen --stream $D --precincts 2 --voters 40 --positions 3 --candidates 4 --trustees 5 --threshold 3 --election-id cv-smoke --distribution realistic > $T8/logs/smoke-gen.log 2>&1 || { echo GENFAIL; tail $T8/logs/smoke-gen.log; exit 1; }
$DRIVER --dir $D --demo $DEMO --out $D/run --distribution realistic "${FFLAGS[@]}" > $T8/logs/smoke.log 2>&1
echo "DRIVER_EXIT=$?"; tail -25 $T8/logs/smoke.log
cat $D/run/canvass-checks.csv
