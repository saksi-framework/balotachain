for r in warmup m1; do echo "== $r"; python3 -c "
import json,sys
r=json.load(open(sys.argv[1]))
print('pass',r['canvass_pass'],'exit',r['exit_code'],'total_s',r['total_ms']/1000,'canvass_ms',r['canvass_ms'],'started',r['started'])
for p in r['precincts']:
  m=p['submit_metrics']; print(p['precinct_id'],p['records'],p['verified'],round(m['window_ms']/1000,1),round(m['committed_tps'],3),m['latency_p50_ms'],m['latency_p95_ms'],m['latency_p99_ms'],round(p['precinct_window_ms']/1000,1),round(p['close_to_return_ms']/1000,1),p['audit'],p['close_block'])
" ~/precinct-task8/clean/$r/run/canvass-run.json; cat ~/precinct-task8/clean/$r/run/canvass-checks.csv; done
