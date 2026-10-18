. /mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad/env.sh
set -euo pipefail
mkdir -p ~/precinct-task8
cd ~/Code/saksi
git checkout -q 0cdc335
git log --oneline -1
cargo build --release -p saksi-demo 2>&1 | tail -3
cd packages/saksi-campaign
go build -o ~/Code/saksi/target/saksi-campaign ./cmd/saksi-campaign
go build -o ~/Code/saksi/target/saksi-canvass-demo ./cmd/saksi-canvass-demo
cd ~
[ -d ~/balotachain ] || git clone -q https://github.com/saksi-framework/balotachain.git ~/balotachain
cd ~/balotachain && git fetch -q && git checkout -q 20d9860 && git log --oneline -1
SAKSI_REPO=$HOME/Code/saksi bash tools/security/tamper_invoke/build.sh 2>&1 | tail -5
ls -la tools/security/tamper_invoke/ | grep -v '\.go$'
SAKSI_DEMO=$HOME/Code/saksi/target/release/saksi-demo bash tools/security/canvass/selftest.sh 2>&1 | tail -20
sha256sum ~/Code/saksi/target/release/saksi-demo ~/Code/saksi/target/saksi-campaign ~/Code/saksi/target/saksi-canvass-demo ~/balotachain/tools/security/tamper_invoke/tamper_invoke | tee ~/precinct-task8/binary-sha256.txt
