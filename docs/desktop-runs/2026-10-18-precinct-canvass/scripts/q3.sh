python3 -c "
import json,sys
r=json.load(open(sys.argv[1]))
print('pass',r['canvass_pass'],'exit',r['exit_code'],'total_s',r['total_ms']/1000,'canvass_ms',r['canvass_ms'])
for p in r['precincts']:
  m=p['submit_metrics']; print(p['precinct_id'],p['records'],p['verified'],round(m['committed_tps'],3),m['latency_p50_ms'],m['latency_p99_ms'],p['close_block'])
" ~/precinct-task8/clean/$1/run/canvass-run.json
tail -2 ~/precinct-task8/clean/$1/run/canvass-checks.csv
