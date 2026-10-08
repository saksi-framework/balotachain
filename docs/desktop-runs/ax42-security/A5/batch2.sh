#!/usr/bin/env bash
# A5 re-verify: the remaining AX42 MP runs (483K warmup/m2/m3, 1M x4, 1.92M x4, 3.5M warmup/m1/m2).
cd /root/ch4-ax42/security/A5
RUNS=/root/.saksi/campaign/runs
for r in $RUNS/mp-483k-ch4-ax42-warmup-* $RUNS/mp-483k-ch4-ax42-m2-* $RUNS/mp-483k-ch4-ax42-m3-* $RUNS/mp-1m-ch4-ax42-* $RUNS/mp-1-92m-ch4-ax42-* $RUNS/mp-3-5m-ch4-ax42-warmup-* $RUNS/mp-3-5m-ch4-ax42-m1-* $RUNS/mp-3-5m-ch4-ax42-m2-*; do
  ./reverify.sh "$r" "$(basename "$r")" >> verdicts.tsv
done
echo BATCH2-DONE $(date +%T) >> verdicts.tsv
