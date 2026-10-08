export PATH=$HOME/go/bin:$HOME/.cargo/bin:$HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/wsl/lib:/mnt/c/WINDOWS/system32:/mnt/c/WINDOWS:/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0
PT=${PT:-5h}
LOGF=~/saksi-logs/up-night2-$(date +%H%M).log
which powershell.exe
tmux send-keys -t console C-c 2>/dev/null; sleep 3
tmux kill-session -t console 2>/dev/null || true
tmux new -d -s console "export PATH='$PATH'; cd ~/Code/saksi && SAKSI_PHASE_TIMEOUT=$PT ./tools/up.sh 2>&1 | tee $LOGF; bash"
for i in $(seq 1 200); do grep -q 'serving' $LOGF 2>/dev/null && break; sleep 3; done
echo LOG $LOGF; tail -n 12 $LOGF
