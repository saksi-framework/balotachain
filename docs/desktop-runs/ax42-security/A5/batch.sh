#!/usr/bin/env bash
cd /root/ch4-ax42/security/A5
RUNS=/root/.saksi/campaign/runs
for r in $RUNS/mp-1k-ch4-ax42-* $RUNS/mp-10k-ch4-ax42-* $RUNS/mp-50k-ch4-ax42-* $RUNS/mp-483k-ch4-ax42-m1-* $RUNS/mp-3-5m-ch4-ax42-m3-*; do
  ./reverify.sh "$r" "$(basename "$r")" >> verdicts.tsv
done
echo BATCH-DONE $(date +%T) >> verdicts.tsv
