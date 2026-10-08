# Security tests — Track O (offline / analysis), saksi 4a38a54, AX42

Track O never calls the console's mutating API and never touches Docker/Fabric.
Server: Hetzner AX42 157.180.56.166. Auditor: `/root/Code/saksi/target/release/saksi-demo`
(prebuilt release of `saksi-auditor`). Tooling: `/root/ch4-ax42/security/tools/`.
Evidence: `/root/ch4-ax42/security/<id>/`. Date: 2026-10-07.

---

## X1 — external port scan of our own server IP (paper ref T3.9, external attacker)

Adversary: external attacker. Method: full TCP connect scan of all 65535 ports of
157.180.56.166 **from the user's laptop** (no sudo/nmap available; Python full-connect
scan, 200-way concurrency, 2 s timeout). Only our own rented Hetzner IP is scanned.

- Tool: `tools/x1_scan.py` (hard-pinned to 157.180.56.166).
- Command: `python3 x1_scan.py`
- Result (`X1/x1_result.json`, 98.2 s, 65535 ports): open TCP =
  **22, 7050, 7051, 7053, 9051, 9443, 9444, 9445**.
- Pass criterion: only 22/tcp open; Fabric 7050/7051/9051 and console 8090 not reachable externally.

Confirmation (re-probe from laptop + server-side `ss -tlnp`, `X1/server-listeners.txt`):
- 7050 (orderer), 7051 (org1 peer), 9051 (org2 peer) are externally reachable and speak
  **TLS 1.3**; 7053 and 9443/9444/9445 (Fabric operations/metrics) are reachable too.
- All of them are bound to `0.0.0.0` by `docker-proxy` (Fabric test-network container port
  publishing) with no host firewall in front.
- Console **8090 is loopback-only** (`127.0.0.1`, `saksi-campaign`) and is **closed**
  from the laptop — correct.

Verdict: **DEVIATION / limitation demonstrated.** The pass criterion ("only 22/tcp open")
**fails**: the Fabric orderer, both peers and the operations endpoints are published to the
internet because the test-network's `docker-proxy` binds `0.0.0.0` and the host has no
firewall. The peer/orderer gRPC is TLS-gated and MSP-authenticated (an outside cert is
rejected before the chaincode — see Track N B2), so exposure is not direct compromise, but
the attack surface is real and larger than the plan assumed. Remediation: bind the Fabric
container ports to `127.0.0.1` or add a host firewall (ufw/nftables) allowing only 22.
The console (8090) is correctly not exposed.

## X2 — not in Track O

X2 (TLS on peer gRPC from inside the server) is owned by Track N per the brief.

## X3 — SSH hardening (paper ref: hardening)

Method: `sshd -T` on the server, effective config.

```
permitrootlogin without-password
pubkeyauthentication yes
passwordauthentication yes
kbdinteractiveauthentication no
usepam yes
```
Evidence: `X3/sshd-T.txt`.

- `permitrootlogin without-password`: root is key-only (no password login for root). OK.
- `pubkeyauthentication yes`: key auth enabled. OK.
- `passwordauthentication yes`: **password authentication is globally enabled.**

Verdict: **DEVIATION from the plan's pass criterion.** The plan expected
`passwordauthentication no` (key-only SSH). Root login is key-only
(`without-password`), so the root account cannot be password-brute-forced, but
password authentication is still enabled server-wide for any other account. This is
an honest finding, not a pass: SSH is not fully key-only. Remediation if desired:
set `PasswordAuthentication no` in sshd_config and reload. (Track O does not modify
server config; reported only.)

## A4 — modified public record detected by the auditor (paper ref RQ1 software independence, case 14)

Adversary: ledger admin who edits an exported public record. Method: take a clean
export (SP/MP-1K run `mp-1k-ch4-ax42-20261003-170017-5`: `header.json` + decompressed
`ballots.ndjson`, 3000 ballots), confirm it audits clean, then flip exactly **one
byte** in the published record — two independent variants — and re-run the offline
auditor. Tooling: `tools/a4_tamper.py` (protobuf-aware single-byte flip; a content-byte
flip leaves every length prefix intact so the failure is a cryptographic check, not a
parse error).

Baseline (`A4/clean-audit.json`): `overall = pass`, every contest `E = 0`,
decoded == published tally. rc 0.

Variant 1 — flip 1 byte of ballot[0]'s first `Ciphertext.data` (Ballot f4 > f3):
- Command: `a4_tamper.py ballot A4/clean A4/tamper-ballot` then
  `saksi-demo audit-stream A4/tamper-ballot --json`
- Result (`A4/tamper-ballot-audit.json`): `overall = fail`, rc 1.
  Failing check: **`ballot.cds_proof`** — "ballot[0] contest president/cand0: CDS
  verification failed". Cascades to `decryption.cp_proof` / `decryption.threshold`.

Variant 2 — flip 1 byte of the signed tally's `totals` (TallyResult f3):
- Command: `a4_tamper.py tally A4/clean A4/tamper-tally` then
  `saksi-demo audit-stream A4/tamper-tally --json`
- Result (`A4/tamper-tally-audit.json`): `overall = fail`, rc 1.
  Failing checks: **`tally.homomorphic_sum`** ("contest vice-president/cand2:
  homomorphic decode = 172, published tally = 173") and **`tally.signatures`** (all 5
  trustee Schnorr signatures fail over the altered totals; 0 valid, below threshold 3).

Verdict: **PASS (detected).** A one-byte edit anywhere in the published record — ballot
ciphertext or tally total — is caught by the offline auditor. The tally variant also
corroborates A3: the trustee signatures bind the totals, so a flipped total breaks them.

## A5 — reorder detection (paper ref T3.9 reorder)

**OUT of scope today.** Detecting ledger reordering requires wiring `ledger_digest`
(chain order vs served order) into the auditor, i.e. a security-only saksi branch.
Not built here (no saksi-source modification in this session).

## A6 — verifier on a second machine (paper ref RQ1(e))

**DEFERRED.** A6 needs the desktop run archive (SP-3.5M m3 public record) copied to the
AX42, and the desktop is powered off and unreachable from this laptop. Cannot be done
today. (The AX42 auditor itself is proven working here by A4 and A7.)

## A7 — privacy linkage join at tier scale (paper ref Privacy, Table 4.10)

Adversary: privacy adversary holding the public bulletin board and the registration
list. Method: stream the largest MP export's zstd `ballots.ndjson` **without
decompressing to disk** (`zstd -dc | parse`), decode every voter-linked field each
ballot publishes (nullifier value, credential_commitment, voter_credential_commitment),
and join them against the registration-identifier set (`header.json` `voter_ids`). A
linkage hit = any public ballot field that is a member of the registration set, i.e. a
field that re-identifies a registered voter. Tool: `tools/linkage_join.py`, run at
`nice 10` as `systemd-run --unit=sec-a7` (survives session death).

Export: `mp-3-5m-ch4-ax42-m3-20261006-123905-51` (20 GB zstd, streamed).
Command: `linkage_join.py <run> --out A7/a7-result.json`
Result (`A7/a7-result.json`):

| metric | value |
|---|---|
| registered voters N | 3,524,078 |
| ballots | 10,572,234 (= 3 × N, 3 positions/voter) |
| distinct nullifiers | 10,572,234 (every ballot unique) |
| nullifier collisions | 0 |
| distinct credential_commitments | 3,524,078 (= N) |
| distinct voter_credential_commitments | 3,524,078 (= N) |
| **linkage hits** | **0** |
| linkage bound (1/N) | 2.84e-07 |

Verdict: **PASS (0 linkage hits).** No nullifier or commitment published on the board
is a member of the registration-identifier set, so the public record re-identifies no
registered voter; the residual linkage bound is 1/N ≈ 2.84e-07.
Two honest structural notes recorded from the same pass:
- Nullifiers are unique per ballot (0 collisions over 10.57 M), consistent with
  `nullifier = PRF(s_cred, election_id || position_id)` — one per voter per position,
  no cross-voter reuse and no double vote.
- `credential_commitment` is stable per voter (exactly N distinct over 3N ballots), so a
  voter's own 3 position-ballots are linkable *to each other* pseudonymously, but the
  commitment is not in the registration set and so is not linkable to a real identity.

---

## Paper impact (Track O)

- **A7 closes the privacy-linkage placeholder** (Table 4.10): 0 linkage hits at 3.5 M
  scale, bound 1/N ≈ 2.84e-07.
- **A4** confirms, live on 4a38a54, that a one-byte edit of a published record (ballot
  ciphertext → `ballot.cds_proof`; tally total → `tally.homomorphic_sum` +
  `tally.signatures`) is detected by the offline auditor — RQ1 software independence,
  case 14. Also corroborates A3 (signatures bind totals).
- **X1** stated as a **limitation**: the Fabric orderer/peers/operations ports
  (7050/7051/7053/9051/9443-9445) are internet-exposed via `docker-proxy` on `0.0.0.0`
  with no host firewall; only 22 and the TLS/MSP-gated Fabric ports answer, and the console
  (8090) is loopback-only. Pass criterion ("only 22 open") fails.
- **X3** stated as a **limitation**: root is key-only but password authentication is
  globally enabled; SSH is not fully key-only.
- **A6** deferred (desktop off); **A5** out of scope (needs a security-only branch).
