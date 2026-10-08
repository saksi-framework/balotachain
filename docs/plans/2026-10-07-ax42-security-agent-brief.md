# Brief: AX42 security tests (Chapter IV, RQ2/T-series), saksi study build 4a38a54

## Context
- Plan (source of truth, read it fully first): `Q:\Code - LAPTOP\Code\projects\balotachain\docs\plans\2026-10-04-ax42-security-tests.md`
  (tests X1-X3, B1-B4, D1-D5, D1-L, A1-A7; tiers table; tooling list; paper impact).
- Server: Hetzner AX42, `ssh -i ~/.ssh/hetzner_ax42 root@157.180.56.166` (Ubuntu 24.04, 16 threads, 61 GB RAM, ~174 GB free on /).
  - `saksi-console.service` runs the saksi-campaign console on loopback (plain HTTP). Find its port and the
    saksi checkout from `systemctl cat saksi-console` and `~/ch4-ax42/controller.py`.
  - `~/ch4-ax42/controller.py` is the measured-study controller. Its queue is COMPLETE. Do NOT start
    `ax42-controller.service`. Reuse its helpers as API reference (`req`, `wait_job`, `reset`, `preflight`,
    campaign start/poll, export, resources sampling).
  - The saksi console has a security-run / attack timeline (the `/wizard` attack timeline; `scenarios.go`),
    a network reset (`POST /api/network/reset`), campaign runs, export, and the auditor (verify).
  - Fabric test-network: 2 peers (org1, org2) + 1 Raft orderer, in Docker. Peer CLI env is in the saksi
    fabric scripts (`tools/up.sh` and the test-network `setOrgEnv`/`envVar.sh`).
  - Run evidence lives in `/root/.saksi/campaign/runs/<run>/` (ballots.ndjson zstd-compressed with sha256
    sidecars, ledger dumps, exports). The largest MP export is the MP-3.5M m3 run
    `mp-3-5m-ch4-ax42-m3-20261006-123905-51`.
- Desktop repos: balotachain `Q:\Code - LAPTOP\Code\projects\balotachain`, saksi `Q:\Code - LAPTOP\Code\projects\saksi`
  (study build 4a38a54 source for reading: chaincode `contract.go`, auditor checks, `scenarios.go`, proto).
  Desktop SP runs archive: `Q:\thesis-archive\runs` (SP-3.5M m3 is there, zstd). WSL Ubuntu also has `~/.saksi/campaign/runs`.

## Rules (hard)
- Never modify saksi source or the deployed chaincode. Tooling is "run tooling": put it on the server at
  `/root/ch4-ax42/security/` and mirror a copy into balotachain-n2 at `tools/security/` (see Reporting).
- Never delete measured-run evidence (`/root/.saksi/campaign/runs/*ch4-ax42*`, outbox, Q:\thesis-archive). Network resets
  wipe only the live Fabric ledger, which is fine: the measured queue is finished and pulled.
- Do not touch `/root/ax42/gdrive-copy.sh` or start the Google Drive copy.
- Every security network run is flagged `security_run` / labelled `security`; none feeds RQ3 throughput.
- External scanning: ONLY the server's own IP 157.180.56.166 (Hetzner ToS). Never scan any other address.
- Nothing destructive outside the thesis scope. Never touch the desktop's Docker/WSL newh-events Supabase containers.
- Disk on the server: check `df` before each tier; MP-1M on-chain needs ~140 GB; the reset before it frees the previous ledger.
- If a test cannot be done as planned, do the closest honest variant and record exactly what differed. Never
  report a pass you did not observe. Record the exact command, the gate/check name returned, tx IDs, and block numbers.

## Two tracks (run in parallel by two agents; each agent is told its track)

### Track N (network): owns the console and the Fabric network exclusively
Order (one network at a time):
1. Build `tamper_invoke.py` (proto field flip -> hex/args for `peer invoke`), `outside_msp_invoke.sh` (submit with a cert
   from a CA not on the channel: generate a throwaway CA + cert with openssl/cryptogen), `replay_committed.py`,
   `netem.sh`, `tcpdump_capture.sh`, and an orderer-kill extension for the T3 fault drill.
2. SP-1K throwaway network (console reset + a small security run to have an election): B2, B3, B1, then B4, A1, A2, A3 (CLI invokes).
   Run the auditor after each committed-tamper test and record the failing check (`dkg.decode`, `decryption.cp_proof`, `parameters.issuer_binding`...).
3. D1: console security run (attack timeline) at MP-10K; record per-scenario chain gate + audit gate, 100% refused.
4. SP-50K: D2 replay during recovery, D3 kill peer AND orderer at 3 random points (restart, no reset, resume, verify-only, publish, verify; E=0),
   D4 `tc netem` delay/loss on the Fabric docker bridge during the ballot window, D5 tcpdump on peer gRPC (TLS) and console HTTP (plaintext).
5. D1-L (last, ~2.5 h): the attack timeline mounted during an MP-1M on-chain ballot window. Show every ballot-stage gate still refuses at scale; E=0.
6. X2 (TLS check on peer gRPC from inside the server) can be done any time in this track.

### Track O (offline): never calls the console's mutating API and never touches Docker/Fabric
- X1: `nmap -sS -p- 157.180.56.166` FROM THE DESKTOP (install nmap via winget if missing; if a SYN scan needs admin, use `-sT`). Pass: only 22/tcp open.
- X3: `sshd -T` on the server (passwordauthentication no, permitrootlogin prohibit-password/without-password).
- A4: copy an exported public record, flip one byte (a committed ballot ciphertext, and separately a tally total), run the auditor (offline/CLI auditor from the saksi build on the server or desktop), record the check that fails.
- A6: run the auditor on a second machine. Take the SP-3.5M m3 public record from the desktop archive (or, if that is too big to move quickly, the SP-1M m3 public record) to the AX42, and verify it there with the server's auditor: tally reproduced, E=0. Record sizes, times, sha256.
- A7: `linkage_join.py`: join nullifiers / credential commitments / any voter-linked field in the largest MP export (MP-3.5M m3 on the server) against the registration list; report hits (expect 0) and the bound. Stream zstd input; do not decompress to disk (disk is tight). Run at nice 10.
- A5 is OUT of scope today (needs a saksi branch); write one line saying so.

## Reporting
- Each agent writes its report to `Q:\Code - LAPTOP\Code\projects\balotachain\.superpowers\sdd\2026-09-14-study-grade-wizard\security-ax42-track-<N|O>.md`:
  per test: ID, paper ref, what ran (exact commands), observed result (gate/check, tx, block, E), PASS / LIMITATION DEMONSTRATED / DEVIATION, evidence path.
  Then a short "Paper impact" section mapped to the plan's Paper impact list.
- Copy the tooling into `Q:\Code - LAPTOP\Code\projects\balotachain-n2\tools\security\` and evidence (small files only: logs, auditor JSON, pcaps under 50 MB)
  into `balotachain-n2\docs\desktop-runs\ax42-security\<test-id>\`. Commit on the current branch `docs/ch4-night1-2026-10-01` (Conventional Commits; end the message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_015B2HKZXwcfd5r1J9GG4udm`), and push that branch. Never push or merge main.
  The two tracks commit different paths; `git pull --rebase` before push if rejected.
- Also append one line per finished test to `/root/ch4-ax42/security/STATUS.md` on the server so progress is visible.
- Reply to the orchestrator in under 15 lines: counts by outcome, anything that blocked, report path.
