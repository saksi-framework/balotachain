. /mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad/env.sh
mkdir -p ~/precinct-task8/logs
for try in 1 2 3; do
  echo "reset $1 try $try $(date -Is)" >> ~/precinct-task8/logs/resets.txt
  cd ~/Code/saksi && bash tools/tier.sh 10000 3 > ~/precinct-task8/logs/reset-$1-try$try.log 2>&1
  ec=$?; echo "TIER_EXIT=$ec"; tail -2 ~/precinct-task8/logs/reset-$1-try$try.log
  echo "reset $1 try $try done exit=$ec $(date -Is)" >> ~/precinct-task8/logs/resets.txt
  [ $ec = 0 ] && break
done
docker ps --format '{{.Names}}' | sort | tr '\n' ' '; echo
exit $ec
