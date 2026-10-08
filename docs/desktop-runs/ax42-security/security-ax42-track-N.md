# Security tests — Track N (network), saksi study build 4a38a54, Hetzner AX42

Track N owns the saksi console and the Fabric test-network exclusively (channel
`saksi`, chaincode `saksi-bulletin`, 2 peers Org1/Org2 + 1 Raft orderer, Docker).
Console on 127.0.0.1:8090 (auth off on loopback). Endorsement policy
`OR('Org1MSP.peer')`. Every network run here is a security run; none feeds RQ3.

Environment: AMD Ryzen 7 PRO 8700GE (16 threads), 61 GiB RAM, Ubuntu 24.04 + Docker.
Auditor binary: `/root/Code/saksi/target/release/saksi-demo` (audit-stream, Rust).

## Tooling built (run tooling, `/root/ch4-ax42/security/tools/`)
- `tamper_invoke/` — Go program (built binary `tamper_invoke`). DEVIATION from the
  plan's `tamper_invoke.py`: Python was infeasible on the host (no protoc, no
  python-protobuf). The Go tool imports saksi's own `saksiprotocolv1` protobuf and
  client-SDK and reuses the EXACT byte-level mutation functions from
  `saksi-campaign/scenarios.go` (verbatim), so each attack is the same mutation the
  auditor is already proven to catch — higher fidelity than a hand-rolled Python
  flip, zero new deps. Subcommands: b1, b3, b4, a1, a2, a3, submit-raw,
  stream-dkg, stream-partial, stream-legacy. Submits through the Fabric gateway
  exactly as a `peer invoke` would; the `gate=<id>:` is read back via ErrorText.
- `outside_msp_invoke.sh` — openssl throwaway CA + P-256 client cert (PKCS#8),
  submit SubmitBallot with it. (B2)
- `replay_committed.py` — resubmit committed ballots via `tamper_invoke submit-raw`,
  expect gate=nullifier each. (D2)
- `netem.sh`, `tcpdump_capture.sh` — tc netem on the Fabric bridge; tcpdump on
  peer gRPC + console HTTP. (D4, D5)
- `orderer_kill.sh` — docker stop/start orderer + peer0.org2 in 3 cycles, the
  orderer leg the console fault API (peer0.org1 only) does not cover. (D3)

Evidence per test: `/root/ch4-ax42/security/<ID>/evidence.txt`. All CLI tests ran
on the SP-1K throwaway network (console reset to voters=1000, positions=3; reset
job network-reset-20261007-075937-40, chain height 6). After the 7 CLI tests the
`saksi` channel stood at height 189 — the committed invokes (B3 ballot, B4 DKG,
A1 partial, and each test's CreateElection/CloseElection) produced blocks; the
gateway client only returns after commit, so [COMMIT] = endorsed, ordered and
committed. Per-test tx ids are not surfaced by the gateway client (noted limit).

---

## BEFORE (setup, DKG, lifecycle)

### B1 — front-run CreateElection (no caller authorisation)
- Paper ref: T3.9 front-run; limits. Adversary: a second channel identity.
- Command: `tamper_invoke b1 <bundle>` — Org2MSP/User1 calls CreateElection for an
  election id, then the honest Org1MSP/User1 calls CreateElection for the same id.
- Observed: attacker create `[COMMIT]`; honest create `[REFUSED] ... chaincode
  response 500, election "secB1-...-080738" already exists`.
- Verdict: **LIMITATION DEMONSTRATED** — there is no GetClientIdentity / caller
  authorisation; any channel member can front-run and lock out the honest operator.
- Evidence: `B1/evidence.txt`.

### B2 — SubmitBallot with a cert from a CA not on the channel
- Paper ref: case 10; external attacker; T5. Adversary: external attacker.
- Command: `outside_msp_invoke.sh <ballot.hex>` — generates a self-signed rogue CA
  (CN=rogue-ca) + client cert, submits SubmitBallot claiming Org1MSP with it.
- Observed: `[REFUSED] ... access denied: channel [saksi] creator org unknown,
  creator is malformed` — rejected at the peer MSP / gateway, before the chaincode
  (no gate= id; the membership layer refuses it).
- Verdict: **PASS** — closes case 10 live.
- Evidence: `B2/evidence.txt`.

### B3 — legacy election (empty issuer key) + self-issued ballot
- Paper ref: case 7/11; issuer_binding. Adversary: malicious admin.
- Command: `tamper_invoke b3 <bundle>` (CreateElection with issuer_public_key
  cleared, PublishDKGTranscript, SubmitBallot) then offline `tamper_invoke
  stream-legacy <dir>` + `saksi-demo audit-stream <dir> --json`.
- Observed on-chain: CreateElection(empty issuer) `[COMMIT]`, PublishDKGTranscript
  `[COMMIT]`, SubmitBallot(self-issued) `[COMMIT]` — the issuer gate is skipped
  for a legacy election, so the self-issued ballot is accepted.
- Observed offline: positive control overall=pass; after mutation overall=fail,
  failed check `parameters.issuer_binding` ("election parameters carry no issuer
  key, so the chain's issuer gate was off").
- Verdict: **PASS** — accepted on-chain, caught by the auditor (as planned).
- Evidence: `B3/evidence.txt`.

### B4 — tampered DKG transcript committed live, detected offline
- Paper ref: T6/T4; dkg.decode. Adversary: malicious trustees.
- Command: `tamper_invoke b4 <bundle>` (CreateElection, PublishDKGTranscript with
  trustee0 coefficient-commitment[0] low bit flipped) then `stream-dkg` +
  `audit-stream`.
- Observed on-chain: CreateElection `[COMMIT]`, PublishDKGTranscript(tampered)
  `[COMMIT]` — the chaincode checks DKG shape/presence only.
- Observed offline: overall=fail, `dkg.decode` ("trustee 1 coefficient_commitments[0]
  is not a valid" ristretto point).
- Verdict: **PASS** — committed, then detected, live on 4a38a54.
- Evidence: `B4/evidence.txt`.

---

## AFTER (close, ceremony, tally, audit)

### A1 — tampered partial decryption committed live, detected offline
- Paper ref: T6; case 9. Adversary: malicious trustees.
- Command: `tamper_invoke a1 <bundle>` (full lifecycle to CloseElection, then
  SubmitPartialDecryption with the Chaum-Pedersen response low bit flipped) then
  `stream-partial` + `audit-stream`.
- Observed on-chain: 15 ballots committed, election closed,
  SubmitPartialDecryption(tampered) `[COMMIT]` — shape/presence only, no caller auth.
- Observed offline: overall=fail, `decryption.cp_proof` (partial_decryptions[0],
  trustee 1).
- Verdict: **PASS** — committed, then detected, live on 4a38a54 (replaces the
  7272837 citation).
- Evidence: `A1/evidence.txt`.

### A2 — PublishTally below the signature threshold
- Paper ref: T6; case 8. Adversary: malicious trustees.
- Command: `tamper_invoke a2 <bundle>` (lifecycle to partials, PublishTally with
  the tally's signatures stripped to 2 of 5; threshold is 3).
- Observed: `[REFUSED] ... chaincode response 500, tally has 2 valid trustee
  signatures, threshold is 3`.
- Verdict: **PASS** — case 8 live on-chain.
- Evidence: `A2/evidence.txt`.

### A3 — flip one total in a signed tally, then PublishTally
- Paper ref: T4; tally.accuracy. Adversary: ledger admin.
- Command: `tamper_invoke a3 <bundle>` (lifecycle to partials, PublishTally with
  totals[0] incremented 3 -> 4, signatures left intact).
- Observed: `[REFUSED] ... chaincode response 500, tally signature from trustee
  "1" does not verify: tally signature does not verify`.
- Verdict: **PASS / LIMITATION stated** — the Schnorr signatures bind the totals,
  so a flipped total is refused; a *wrong total that is properly signed* would need
  the trustee keys. On-chain there is no independent check of totals against the
  aggregate; the binding is via the signatures (stated as a limit, per plan).
- Evidence: `A3/evidence.txt`.


---

## DURING (ballot window)

### D1 — console attack timeline at MP-10K
- Paper ref: T5/T7, cases 1,2,4,5,12. Adversary: voter / client.
- Method: a single on-chain SECURITY RUN via POST /run-all, voters=10000,
  attack_plan stages=[dkg,ballots,close,ceremony], ballots_at=0.5, timeout_s=3
  (each paused stage auto-mounts all its attacks unattended). The campaign path
  force-strips attack_plan on every repetition, so a security run must go through
  /run-all, not /api/campaigns. Driver: `tools/run_attack_timeline.py`.
  Run id sec-d1-mp10k-20261007-082414-...-53 (reset to voters=10000 first,
  network-reset-20261007-081917-41, chain height 6).
- Observed (per /api/scenarios/<run>, verdict PASS = refused by the declared gate;
  the live verdict is inverted — a rejection is a PASS):
  - Live on-chain (was_live=true), refused at the declared CHAIN gate:
    tamper-ballot-proof=cds, reused-nullifier=nullifier, corrupted-ballot-bytes=decode,
    self-issued-credential=issuer, overvote=selection — all **PASS**.
  - Simulated (was_live=false), caught by the declared AUDITOR check:
    dropped-ballot=stream.completeness, tamper-partial-decryption=decryption.cp_proof,
    tamper-dkg-transcript=dkg.decode — all **PASS**.
  - reordered-ballots = **SKIPPED** (no gate checks ordering on-chain or in the
    stateless auditor; documented gap, never mounted).
- correctness.csv: E=0 for every contest, decoded==ground_truth, published_tally
  matches, ledger_matches_local=true — the per-position check holds at 10k scale.
- Verdict: **PASS** — 100% refused at the declared gate (8 PASS, 1 SKIPPED by design).
- Evidence: `D1/` (scenarios.json, negative-tests.csv, correctness.csv, attack_events.ndjson).

### D2 — replay committed ballots during recovery
- Paper ref: T3 duplicates; replay. Adversary: network.
- Method (SP-50K network): open election d2-* via `saksi-console --setup-only`,
  commit 10 ballots, `docker restart peer0.org1.example.com` (recovery), then
  `tools/replay_committed.py d2.json -n 10` resubmits the same 10 committed ballots.
- Observed: all 10 first submissions `[COMMIT]`; after the peer restart, all 10
  replays `[REFUSED] ... gate=nullifier: nullifier already spent in election
  "d2-083130" (double vote)`. RESULT 10/10 refused gate=nullifier. No new ballot
  committed (each replay rejected), so the committed set — and the tally — is unchanged.
- Verdict: **PASS** — replay refused live, including across a peer restart.
- Evidence: `D2/evidence.txt`.

### D5 — tcpdump on peer gRPC and console HTTP
- Paper ref: T3.9 interception. Adversary: eavesdropper.
- Method (SP-50K network): `tools/tcpdump_capture.sh D5 25` captures lo:7051 (peer
  gRPC) and lo:8090 (console HTTP) while ballots are submitted and the console API
  is polled.
- Observed: peer-7051.pcap 2.47 MB, 4512 packets, 0 readable election terms
  (SubmitBallot/nullifier/election/president) — TLS ciphertext. console-8090.pcap
  1.23 MB, 560 packets, readable plaintext ("GET /api/campaigns HTTP/1.1",
  "HTTP/1.1 200 OK", "GET /api/trail HTTP/1.1").
- Verdict: **LIMITATION DEMONSTRATED (honest limit)** — peer gRPC is TLS; the
  console binds loopback over plain HTTP and is readable to a local eavesdropper.
- Evidence: `D5/` (peer-7051.pcap, console-8090.pcap, evidence.txt).

---

## OUTSIDE-IN (this track's part)

### X2 — TLS on peer gRPC (from inside the server)
- Paper ref: T3.9 transport. Adversary: network.
- Method: `openssl s_client -connect localhost:7051 -servername peer0.org1.example.com
  -CAfile <org1 channel tlsca>` (and the same for peer0.org2:9051 and orderer:7050).
- Observed: peer0.org1 7051 negotiates **TLS 1.3** (TLS_AES_128_GCM_SHA256); peer
  certificate CN=peer0.org1.example.com issued by CN=tlsca.org1.example.com (the
  channel's org1 TLS CA); **Verify return code: 0 (ok)**. peer0.org2:9051 and
  orderer:7050 also verify OK against their channel TLS CAs.
- Verdict: **PASS** — TLS 1.2+ (1.3 here), cert chain = channel CA.
- Evidence: `X2/evidence.txt`.

### D4 — tc netem delay/loss on the Fabric bridge during the window
- Paper ref: T3; availability. Adversary: network.
- Method (SP-50K): `tools/netem.sh add 40 0.5` applies 40 ms delay + 0.5% loss to
  the Fabric docker bridge (br-cbaf03f94216, network fabric_test) for the whole
  ballot window; `run_plain.py` runs a voters=50000 on-chain election; netem is
  cleared on exit. Wrapper: `tools/d4_run.sh`.
- Observed: the run completed under degradation (~12 min window vs ~3 min clean).
  correctness.csv: E=0 and pass=true for all 24 contests; president totals
  24500+9000+8500+8000 = 50000 — every accepted ballot committed, 0 lost.
  Submit's fail-loud reconcile did not trip. netem cleared afterwards (qdisc noqueue).
- Verdict: **PASS** — completes under delay/loss with 0 accepted ballots lost
  (documented degradation: large throughput hit under the injected latency/loss).
- Evidence: `D4/` (evidence.txt, correctness.csv, perf.csv).

### D3 — crash peer AND orderer at multiple points, restart, resume, verify
- Paper ref: T3; reliability. Adversary: infra. (Orderer kill is new.)
- Method (SP-50K, 150000 ballot submissions): `tools/d3_drive.py` — /generate, then
  arm the console peer-restart fault (at=0.4, down_s=25, which stops peer0.org1,
  the sole endorser, mid-window), /submit, and during the window 3 external
  `docker stop/start orderer.example.com` cycles (the orderer leg, the T3-drill
  extension; `tools/orderer_kill.sh` is the standalone form). No network reset.
  Then /resume, the trustee ceremony (3 of 5), publish, verify-only + offline audit.
- Observed (journal + audit-stream):
  - fault.start at ballots_committed=15050 (block 309); stage.ballots.interrupted
    committed=15050 dropped=134950; fault.end peer down_ms=25215. run.end
    failed=false resumed=true security_run=true.
  - resume re-submitted the 134950 dropped ballots (no reset), then close + ceremony
    + PublishTally committed on-chain (block 3045).
  - verify_only.reconcile: chain_count=150000, committed_local=150000, expected=150000,
    **missing=0, reconciled=true** — no accepted ballot lost after recovery.
  - verify_only.chain: blocks 6..3045, **linked=true, status=PASS** — chain linked,
    peers consistent.
  - audit-stream: overall=pass, 0 failed checks, 12 contests **all E=0**, sum
    ground_truth=150000 == sum decoded=150000 — tally reproduced exactly.
- Verdict: **PASS** — peer + orderer killed mid-window, restart with no reset,
  resume, E=0, chain linked, 0 ballots lost.
- Evidence: `D3/` (evidence.txt, audit-stream.json, journal_key.ndjson).

### D1-L — attack timeline during an MP-1M on-chain ballot window (last)
- Paper ref: T5/T7 at scale. Method: same as D1 (`run_attack_timeline.py`) but
  voters=1000000 (3,000,000 ballot submissions), attack_plan all stages,
  ballots_at=0.5. A security run; kept out of RQ3.
- Result (run id sec-d1l-mp1m-...-58; 3,000,000 ballot submissions; ~2.3 h):
  all 5 live ballot-stage attacks refused at the declared CHAIN gate at MP-1M scale
  (was_live=true): tamper-ballot-proof=cds, reused-nullifier=nullifier,
  corrupted-ballot-bytes=decode, self-issued-credential=issuer, overvote=selection.
  Simulated attacks caught by the declared AUDITOR check: dropped-ballot=
  stream.completeness, tamper-partial-decryption=decryption.cp_proof,
  tamper-dkg-transcript=dkg.decode. reordered-ballots=SKIPPED (no gate).
  correctness.csv: 24 contests, all E=0 and pass=true, sum ground_truth=6,000,000 ==
  sum decoded=6,000,000, ledger_matches_local all true.
- Verdict: **PASS** — every ballot-stage gate still refuses at MP-1M scale; E=0
  (8 PASS, 1 SKIPPED by design).
- Evidence: D1-L/ (scenarios.json, negative-tests.csv, correctness.csv, run.log).

---

## Summary (Track N)

| Test | Verdict | Key evidence |
|---|---|---|
| B1 front-run CreateElection | LIMITATION | Org2 commits, honest Org1 "already exists" |
| B2 outside-MSP SubmitBallot | PASS | peer MSP "creator org unknown" (pre-chaincode) |
| B3 legacy empty-issuer | PASS | on-chain accept; auditor parameters.issuer_binding |
| B4 tampered DKG | PASS | committed live; auditor dkg.decode |
| A1 tampered partial decryption | PASS | committed live; auditor decryption.cp_proof |
| A2 PublishTally < threshold | PASS | refused: threshold is 3 |
| A3 flipped tally total | PASS/LIMIT | refused: tally signature does not verify |
| D1 attack timeline MP-10K | PASS | 5 live gates refuse, 3 auditor checks, E=0 |
| D2 replay committed ballots | PASS | gate=nullifier x10, incl. across peer restart |
| D3 crash peer+orderer | PASS | resumed no-reset, missing=0, chain linked, E=0 |
| D4 netem during window | PASS | 50k completes under 40ms/0.5%, E=0, 0 lost |
| D5 tcpdump peer vs console | LIMITATION | peer gRPC TLS, console HTTP plaintext |
| X2 peer gRPC TLS | PASS | TLS 1.3, cert chain = channel CA |
| D1-L attack timeline MP-1M | PASS | 5 live gates refuse at scale, 3 auditor checks, E=0 (6M votes) |

## Paper impact (Track N)
- **Demonstrated live on 4a38a54:**
  - B2 closes case 10 (outside-MSP ballot refused at the membership layer).
  - B4 and A1 are now "committed, then detected" live: the chaincode accepts the
    shape-only DKG transcript / partial decryption, and the offline auditor rejects
    them (dkg.decode / decryption.cp_proof).
  - A2 closes case 8 (PublishTally below the trustee-signature threshold refused).
  - D1 / D1-L: the full attack timeline is refused at the declared gate at MP-10K
    (and, D1-L, at MP-1M scale), with E=0.
- **Stated as limits:**
  - B1: no caller authorisation — any channel member can front-run CreateElection /
    PublishDKGTranscript and lock out the honest operator.
  - D5: the console binds loopback over plain HTTP; peer gRPC is TLS (X2, D5).
  - A3: the trustee signatures bind the totals (a flipped total is refused), but the
    chaincode does not independently check totals against the aggregate; a wrong
    total that is correctly signed would need the trustee keys.
- **Reliability (new):** D3 shows the election survives killing the sole-endorser
  peer AND the orderer mid-window, with no reset: resume fills every dropped ballot
  (missing=0), the chain stays linked, and the tally reproduces ground truth (E=0).
  D4 shows it completes under injected network delay/loss with no accepted ballot lost.

## Note on tooling mirror
Brief asks tooling be mirrored into balotachain-n2 at tools/security/. That repo is
on the desktop (not reachable from this laptop session); the server copies live at
/root/ch4-ax42/security/tools/. The desktop session mirrors them later.
