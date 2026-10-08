#!/bin/bash
D=/root/ch4-ax42/security/A6/sp-3-5m-m3
cd $D
[ -f ballots.ndjson ] || zstd -dq ballots.ndjson.zst -o ballots.ndjson
uname -a > host.txt; nproc >> host.txt; /root/Code/saksi/target/release/saksi-demo --version >> host.txt 2>&1; git -C /root/Code/saksi rev-parse HEAD >> host.txt
S=$(date +%s)
/root/Code/saksi/target/release/saksi-demo audit-stream $D --json > audit.json 2> audit.err; RC=$?
echo "rc=$RC wall_s=$(( $(date +%s) - S ))" > audit.rc
rm -f ballots.ndjson
