# usage: attacks.sh T19 [T20 ...]   one tier.sh reset per scenario, then run_all --only
SP=/mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad
for s in "$@"; do
  bash $SP/reset.sh "$s" || { echo "RESET FAILED $s"; exit 1; }
  . $SP/runenv.sh
  export GEN_ROOT=$T8/attacks REPORT=$T8/negative-tests-canvass.csv VOTERS=${VOTERS:-1000}
  mkdir -p $GEN_ROOT; rm -rf $GEN_ROOT/$s
  echo "attack $s start $(date -Is)" >> $T8/logs/resets.txt
  cd ~/balotachain/tools/security/canvass && bash run_all.sh --only "$s" > $T8/logs/attack-$s.log 2>&1
  echo "attack $s end $(date -Is) exit=$?" >> $T8/logs/resets.txt
  tail -6 $T8/logs/attack-$s.log
  cat $GEN_ROOT/$s/t19-onchain.txt $GEN_ROOT/$s/t20-onchain.txt 2>/dev/null
done
