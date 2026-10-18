# copy evidence into the balotachain clone (no ballots.ndjson, no authority.key)
set -u
T8=$HOME/precinct-task8
E=$HOME/balotachain/docs/desktop-runs/2026-10-18-precinct-canvass
mkdir -p $E
cp $T8/binary-sha256.txt $T8/negative-tests-canvass.csv $E/ 2>/dev/null
mkdir -p $E/logs; cp $T8/logs/resets.txt $E/logs/
pull_run() { # src dst
  local s=$1 d=$2; mkdir -p $d
  for f in canvass-run.json canvass.json canvass-checks.csv; do cp $s/run/$f $d/ 2>/dev/null; done
  cp $s/national/registry.json $d/ 2>/dev/null
  cp $s/t19-onchain.txt $s/t20-onchain.txt $d/ 2>/dev/null
  : > $d/ledger-sha256.txt
  for p in $s/precinct-*; do
    local n=$(basename $p); mkdir -p $d/$n
    for f in perf.csv submit-metrics.json timings.json correctness.csv return.json close.json latencies.csv; do cp $p/$f $d/$n/ 2>/dev/null; done
    [ -f $p/ledger/ballots.ndjson ] && (cd $s && sha256sum $n/ledger/ballots.ndjson >> $d/ledger-sha256.txt)
  done
  ls $s/national/returns > $d/national-returns.txt 2>/dev/null
}
for r in ${CLEAN_RUNS-warmup m1 m2 m3}; do [ -d $T8/clean/$r ] && { pull_run $T8/clean/$r $E/clean/$r; cp $T8/logs/clean-$r.log $E/clean/$r/driver.log; }; done
for a in $T8/attacks/*; do s=$(basename $a); pull_run $a $E/attacks/$s; cp $T8/logs/attack-$s.log $E/attacks/$s/run_all.log 2>/dev/null; rm -rf $E/attacks/$s/precinct-*/latencies.csv; done
cp -r $T8/a-additive $E/
du -sh $E
