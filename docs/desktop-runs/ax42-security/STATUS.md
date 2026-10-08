# Security test STATUS (append-only; both tracks)
[O] X3 2026-10-07 DEVIATION — sshd -T: root key-only (permitrootlogin without-password) but passwordauthentication yes (not fully key-only). ev X3/sshd-T.txt
[O] A4 2026-10-07 PASS — 1-byte flip detected: ballot ciphertext -> ballot.cds_proof; tally total -> tally.homomorphic_sum + tally.signatures. ev A4/
[O] A7 2026-10-07 PASS — linkage join mp-3-5m m3: N=3,524,078, 10,572,234 ballots, 0 linkage hits, 0 nullifier collisions, bound 1/N=2.84e-07. ev A7/a7-result.json
[O] A6 2026-10-07 DEFERRED — needs desktop archive; desktop off.
[O] A5 2026-10-07 OUT-OF-SCOPE — needs security-only saksi branch (ledger_digest).
[O] X1 2026-10-07 DEVIATION — open TCP: 22,7050,7051,7053,9051,9443,9444,9445. Fabric orderer/peers/ops internet-exposed via docker-proxy 0.0.0.0 (no host firewall); console 8090 loopback-only/closed. Pass crit (only 22) fails. ev X1/
- [N] B2 PASS outside-MSP SubmitBallot refused at peer MSP (creator org unknown) — closes case 10 live. 2026-10-07
- [N] B3 PASS legacy empty-issuer: self-issued ballot committed on-chain, auditor fails parameters.issuer_binding. 2026-10-07
- [N] B1 LIMITATION Org2 front-runs CreateElection, honest Org1 refused "already exists" (no caller auth). 2026-10-07
- [N] B4 PASS tampered DKG committed live, auditor fails dkg.decode — committed then detected. 2026-10-07
- [N] A1 PASS tampered partial committed live, auditor fails decryption.cp_proof — committed then detected. 2026-10-07
- [N] A2 PASS PublishTally with 2/5 sigs refused: threshold is 3 — closes case 8 live. 2026-10-07
- [N] A3 PASS/LIMIT flipped tally total refused (signature does not verify); wrong signed total needs trustee keys. 2026-10-07
- [N] D1 PASS MP-10K attack timeline: 5 live attacks refused at chain gate (cds/nullifier/decode/issuer/selection), 3 simulated caught by auditor (stream.completeness/decryption.cp_proof/dkg.decode), reordered SKIPPED; E=0. 2026-10-07
- [N] D2 PASS replay of 10 committed ballots refused gate=nullifier (double vote), incl. across peer restart; tally unchanged. 2026-10-07
- [N] D5 LIMIT tcpdump: peer gRPC TLS (0 plaintext terms, 4512 pkts), console HTTP plaintext readable (560 pkts). 2026-10-07
- [N] X2 PASS peer gRPC TLS 1.3, cert chain verifies against channel TLS CA (org1/org2/orderer all Verify return code 0). 2026-10-07
- [N] D4 PASS 50k election completed under tc netem (40ms/0.5% loss), E=0 all 24 contests, 0 ballots lost. 2026-10-07
- [N] D3 PASS peer(sole endorser)+orderer killed mid-window (15050 committed,134950 dropped), resumed no-reset -> all 150000 committed (missing=0), chain linked, E=0 all 12 contests. 2026-10-07
- [N] D1-L PASS MP-1M attack timeline (3M ballots): 5 live ballot gates refuse at scale (cds/nullifier/decode/issuer/selection), 3 simulated caught (stream.completeness/decryption.cp_proof/dkg.decode), reordered SKIPPED; E=0 all 24 contests, decoded==ground_truth=6,000,000. 2026-10-07
- [orch] D1-L PASS MP-1M live: 5 live attacks refused at chain gate (cds/nullifier/decode/issuer/selection), 3 simulated caught (stream.completeness/dkg.decode/decryption.cp_proof), reorder SKIPPED; 3,000,000 committed, 0 dropped, 440 TPS; ledger_audit ok, ledger_matches_local true. 2026-10-07
- [orch] X1 FIXED: fabric-firewall.service (DOCKER-USER + INPUT DROP on enp6s0, v4+v6). nmap -sT from desktop v4: only 22 open, Fabric+8090 filtered; v6 connect test from laptop: only 22 open. 2026-10-07
- [orch] X3 FIXED: sshd_config.d/00-hardening.conf; sshd -T passwordauthentication no, kbdinteractive no; password login refused (publickey). 2026-10-07
- [orch] A6 PASS second machine: SP-3.5M m3 public record (sha256 49b89e62.. matches desktop archive) audited on AX42 (Ryzen 8700GE, Ubuntu) in 1073 s: overall pass, all contests E=0, aggregates/recovered points identical to the desktop audit. Closes RQ1(e). 2026-10-07
