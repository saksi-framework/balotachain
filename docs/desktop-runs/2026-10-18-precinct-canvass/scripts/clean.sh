# usage: clean.sh warmup m1 m2 m3   one tier.sh reset per run, plan size 10 x 1000 x 3
SP=/mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad
for r in "$@"; do
  bash $SP/reset.sh "clean-$r" || { echo "RESET FAILED $r"; exit 1; }
  . $SP/runenv.sh
  D=$T8/clean/$r; rm -rf $D; mkdir -p $T8/clean
  echo "clean $r gen $(date -Is)" >> $T8/logs/resets.txt
  $DEMO gen --stream $D --precincts 10 --voters 10000 --positions 3 --candidates 4 --trustees 5 --threshold 3 \
    --election-id cv-$r --distribution realistic > $T8/logs/clean-$r-gen.log 2>&1 || { echo GENFAIL; exit 1; }
  echo "clean $r start $(date -Is)" >> $T8/logs/resets.txt
  $DRIVER --dir $D --demo $DEMO --out $D/run --distribution realistic "${FFLAGS[@]}" > $T8/logs/clean-$r.log 2>&1
  ec=$?
  echo "clean $r end $(date -Is) exit=$ec" >> $T8/logs/resets.txt
  tail -4 $T8/logs/clean-$r.log
done
