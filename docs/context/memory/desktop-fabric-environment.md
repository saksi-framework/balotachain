---
name: desktop-fabric-environment
description: How Fabric runs on the Ryzen desktop (WSL2 Ubuntu + Docker Desktop), the storage/fstab fixes applied 2026-09-11, and the adopted orderer batch parameters.
metadata:
  type: project
---

The paper's Table 3.12 desktop is THIS Windows box (Ryzen 7 5700G, 32 GB, NVMe on Q:, SATA on C:). Fabric runs inside WSL2 `Ubuntu` (user `user`, root via `wsl -d Ubuntu -u root` without password; run commands as `wsl -d Ubuntu -e bash -c '...'`, non-login shell) with Docker Desktop's WSL integration. saksi lives at `~/Code/saksi`, fabric-samples at `~/Code/fabric-samples`, runs at `~/.saksi/campaign/runs`, console in tmux `console` on 127.0.0.1:8090, logs under `~/saksi-logs/`.

Fixes applied 2026-09-11, do not undo:
- Docker data disk moved to the NVMe: `Q:\DockerDesktop\DockerDesktopWSL\disk\docker_data.vhdx`; `C:\Users\User\AppData\Local\Docker\wsl\disk` is a junction to it. Docker Desktop's "Disk image location" setting stays at its default and must NOT be changed through the GUI (it errors on the junction). On the SATA VHDX both peers stalled 5–10 s on block commit (fsync); on NVMe fsync max went 58.8 → 3.3 ms and stalls vanished.
- `C:\Users\User\.wslconfig`: `memory=24GB`, `swap=0`.
- Ubuntu `/etc/fstab`: the NFS mount `<LAN address>` is `noauto,x-systemd.automount` (backup `/etc/fstab.bak-2026-09-11`). Before, it hung every boot ~90 s and Docker failed with "getting list of WSL2 integrated distros: context deadline exceeded".

Adopted orderer parameters (declared environment, path 2): MaxMessageCount 50, BatchTimeout 2s, PreferredMaxBytes 2 MB, SnapshotIntervalSize 256 MB → 812 TPS at c=96, 1006 at c=192 (defaults: 488/465). Rule learned twice: MaxMessageCount must be ≤ the in-flight ballot count, or BatchTimeout must be far below target latency, else every block waits the timeout (c=8 gave 3.9 TPS; 500/2s gave 45 TPS).

**Why:** three days of instrument work were nearly misread as protocol limits; all three were environment.
**How to apply:** before any measurement session, check `wsl -d Ubuntu -e true` returns in seconds, `docker info` works, and the configtx in fabric-samples is the adopted one (saksi PR feat/orderer-batch-params makes it automatic). See [[instrument-gap-done]].
