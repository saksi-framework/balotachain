# AX42 on-chain security test plan (saksi 4a38a54)

Designed 2026-10-04 (planning only; nothing run yet). Run after the user's usage reset.

**Scheduling rule.** Every test runs on an SP-1K network, or on a copied export, in a gap between measured MP windows. No test shares a measured window, and `security_run=true` runs are never used for RQ3. Tooling lives in the run tooling, never in saksi, unless marked (c).

## Facts verified in source at 4a38a54
- **No caller authorisation.** There is no `GetClientIdentity` outside vendor. `CreateElection`, `PublishDKGTranscript` and `SubmitPartialDecryption` refuse duplicates, so front-running is possible.
- **DKG and partial decryptions are shape/presence-only.** `PublishDKGTranscript` and `SubmitPartialDecryption` check shape and presence only, which is why the console runs those attacks simulated. A raw `peer invoke` commits them live, and the auditor catches them.
- **`PublishTally` checks signatures and threshold.** It verifies Schnorr signatures over (electionID, totals) and enforces valid >= threshold. Flipping a total therefore breaks the signatures; a wrong total that is properly signed needs the trustee keys.
- **Transport.** The console binds to loopback over plain HTTP; peer gRPC uses TLS.
- **Reordering.** `ledger_digest` is test-only, so detecting reordering needs a branch.

## OUTSIDE-IN (external attacker, from the desktop against our own server IP 157.180.56.166 only)
Allowed by Hetzner's terms: the scan targets our own rented IP, not a foreign network. Never scan any other IP.
| ID | Paper ref | Adversary | Method | Pass | h |
|---|---|---|---|---|---|
| X1 | T3.9 external attacker | External attacker | `nmap -sS -p-` the server from the desktop | only 22/tcp open; Fabric 7050/7051/9051 and console 8090 not reachable | 0.25 |
| X2 | T3.9 transport | Network | TLS check on peer gRPC from inside the server (`openssl s_client` to the peer) | TLS 1.2+; cert chain = channel CA | 0.25 |
| X3 | hardening | External attacker | `sshd -T`: passwordauthentication no, permitrootlogin prohibit-password | key-only SSH | 0.1 |

## BEFORE (setup, DKG, lifecycle)
| ID | Paper ref | Adversary | Method | Cat | Pass | Expected | h |
|---|---|---|---|---|---|---|---|
| B1 | T3.9 front-run; limits | Ledger admin | A second channel identity front-runs `CreateElection` or `PublishDKGTranscript`; the honest run then gets `already exists` | b | lock-out shown and logged | **limitation demonstrated** (no caller auth) | 0.5 |
| B2 | case 10; external attacker; T5 | External attacker | `peer invoke SubmitBallot` with a cert not on the channel | b | refused at MSP/gateway before the chaincode | **closes case 10 live** | 0.5 |
| B3 | case 7/11; issuer_binding | Malicious admin | `CreateElection` with an empty issuer key, then a self-issued ballot, then the auditor | b | accepted on-chain; auditor fails `parameters.issuer_binding` | optional on-chain, caught by the auditor | 0.5 |
| B4 | T6/T4; dkg.decode | Malicious trustees | Tampered DKG transcript via `peer invoke PublishDKGTranscript`, then the auditor | b | committed; auditor `dkg.decode` fails | **committed, then detected, live** | 0.75 |

## DURING (ballot window)
| ID | Paper ref | Adversary | Method | Cat | Pass | Expected | h |
|---|---|---|---|---|---|---|---|
| D1 | T5/T7, cases 1,2,4,5,12 | Voter / client | Console security run at MP-10K (extends the SP-10K and MP-1K runs) | a+b | 100% refused at the declared gate | per-position check holds at scale | 0.5 |
| D2 | T3 duplicates; replay | Network | Replay driver resubmits N committed ballots during recovery | b | each refused `gate=nullifier`; tally unchanged | replay refused live | 0.5 |
| D3 | T3; reliability | Infra | `docker kill` the peer AND the orderer at 3 random points; restart with no reset; resume, verify-only, publish, verify | b | E=0, peers consistent, chain linked | **orderer kill is new** | 2.0 |
| D4 | T3; availability | Network | `tc netem` delay/loss on the Fabric bridge during the window | b | completes, 0 accepted ballots lost | documented degradation | 1.0 |
| D5 | T3.9 interception | Eavesdropper | `tcpdump` on peer gRPC and console HTTP | b/d | peer traffic is TLS ciphertext; console readable | **honest limit** (plain-HTTP console) | 0.5 |

## AFTER (close, ceremony, tally, audit)
| ID | Paper ref | Adversary | Method | Cat | Pass | Expected | h |
|---|---|---|---|---|---|---|---|
| A1 | T6; case 9 | Malicious trustees | Tampered partial CP response via `peer invoke SubmitPartialDecryption`, then the auditor | b | committed; auditor `decryption.cp_proof` fails | **live on 4a38a54** (replaces the 7272837 citation) | 0.75 |
| A2 | T6; case 8 | Malicious trustees | `peer invoke PublishTally` with fewer than 3 valid signatures | b | refused, threshold message | **case 8 live on-chain** | 0.5 |
| A3 | T4; tally.accuracy | Ledger admin | Flip one total in a signed tally, then `PublishTally` | b/c | refused (signatures bind the totals) | a wrong total that is properly signed needs trustee keys: state as a limit | 0.5 |
| A4 | RQ1 software independence; case 14 | Ledger admin | Flip a byte in an exported public record, then the auditor | b | detected | detected | 0.25 |
| A5 | T3.9 reorder | Ledger admin | Wire `ledger_digest` (chain order vs served order) into the auditor; re-verify the archived dumps | **c** | reordering detected | needs a security-only branch | branch |
| A6 | RQ1(e) | Verifiability | Copy a desktop run's public record to the AX42 and run the auditor there | b | tally reproduced, E=0, on a second machine | **closes RQ1(e)** | 0.5 |
| A7 | Privacy; Table 4.10 | Privacy adversary | Linkage join of nullifiers/commitments against the registration list at tier scale | b | 0 linkage hits; at most 1/N | **closes the privacy-linkage placeholder** | 1.0 |

Counts: (a) 1, (b) 14, (c) 2, (d) 1. Total about 10.3 server hours. A5 runs off the server.
Top value: A6, A1, B2, A2, B4, then A7.

## Tiers (user decision 2026-10-05)
| Group | Tier |
|---|---|
| BEFORE and AFTER CLI tests (B1–B4, A1–A3) | SP-1K throwaway network |
| DURING attack timeline (D1) | MP-10K |
| Crash, replay and netem (D2–D4), tcpdump (D5) | SP-50K |
| Privacy linkage (A7) | largest export (SP-3.5M m3 or MP-3.5M) |
| Verifier on a second machine (A6) | SP-3.5M m3 public record, copied to the AX42 |
| Modified record (A4) | any export |
| Outside-in pentest (X1–X3) | the server itself |

**D1-L (added, user choice):** a live attack timeline at **MP-1M** on the AX42 (~2.5 h), all ballot-stage attacks mounted during a capstone-size ballot window. It shows the gates still refuse at scale. It is a security run, kept out of RQ3.

## Run order
1. **A6, A4, A7:** analysis on copied exports; they touch no live network, so they can run anytime.
2. **B2, B3, B1:** on a throwaway SP-1K network.
3. **B4, A1, A2, A3:** CLI invokes, back to back.
4. **D1, D2.**
5. **D3, D4, D5:** after the last measured MP window, because they perturb the network.
6. **A5:** on a security-only saksi branch after the campaign.

## Tooling to build (run tooling only)
- `tamper_invoke.py`: proto field flip producing hex for `peer invoke`. Used by B4, A1, A2, A3.
- `outside_msp_invoke.sh`: submit with a cert from outside the channel. Used by B2.
- `replay_committed.py`: resubmit committed ballots. Used by D2.
- `netem.sh`, `tcpdump_capture.sh`. Used by D4, D5.
- `linkage_join.py`. Used by A7.
- An orderer-kill extension to the T3 fault driver. Used by D3.

## Paper impact
- **Demonstrated live:**
  - B2 closes case 10;
  - B4 and A1 become "committed, then detected" on 4a38a54;
  - A2 closes case 8.
- **Placeholders closed:**
  - A6 closes RQ1(e);
  - A7 closes the privacy-linkage placeholder.
- **Stated as limits:**
  - B1: no caller authorisation;
  - D5: plain-HTTP console;
  - A3: totals are bound by the signatures, but not checked against the aggregate on-chain.
- **A5:** reordering moves from SKIPPED to detected, on re-verified runs only.
