# Study complete — 8 October 2026

The Chapter IV study is finished: every measured tier, the second environment, and the security
pass are run, written up, and merged. This note is the entry point for a fresh checkout.

## Where things stand

| Repo | `main` | Open PRs |
|---|---|---|
| saksi | `83c78bd` | none |
| balotachain | this commit | none |

Merged since the 15 September note:

| PR | What |
|---|---|
| saksi #55, #56 | F1 issuer binding on-chain (`issuer` gate), F2 sum-to-one selection proof (`selection` gate), the empty-position fix (`shape` gate), console UX. Their merge, **`4a38a54`, is the study build**: every measured run uses it. |
| saksi #57 (`83c78bd`) | The wizard shows the server refusing decryption below the threshold (adviser W3#2). |
| saksi #58 (`37035f9`) | Auditor check `ledger.order`: detects reordering of the served records against the chain read-back. |
| balotachain #65 | `DESIGN.md` and the shared design system across the four apps. |
| balotachain #66, #67 | Chapter IV: every run's evidence, the security pass, the refreshed draft, figures, and the Chapter III amendments (`CLAIMS.md`, `manuscript-amendments.md`). |
| balotachain #63 | Trace v9, rebased; notes where #55/#57/#58 changed what it describes. |

## What was measured

All runs: saksi `4a38a54`, 3 positions x 4 candidates (MP) or 1 position (SP), 5 trustees at
threshold 3, 128 in flight, orderer 50 tx / 2 s. Every run ended with E = 0.

- **Desktop** (Ryzen, Windows 11, WSL2 + Docker Desktop): SP on-chain 1K to 3.5M (both capstones),
  MP on-chain 1K to 50K, MP offline 483K to 3.5M, SP-483K on a fresh network (583.3 TPS against 509
  on an accumulating one), MP-483K on-chain (median 636.0 TPS).
- **AX42** (Hetzner, Ryzen 7 PRO 8700GE, native Ubuntu 24.04): MP on-chain 1K to 3.5M, 20 steps,
  0 crashes. Medians: about 830 TPS at 1K-50K, 553.9 at 483K, 473.5 at 1M, 464.9 at 1.92M, 423.9 at
  3.5M (p99 448.9 ms; 1.44x the election-day arrival rate, the study's smallest margin).
- Why the desktop beat the AX42 at 483K but not at 50K: `docs/desktop-runs/ch4-reports/desktop-vs-ax42-483k.md`
  and Chapter IV "Second environment" (throughput follows mean latency; both hosts slow down once
  peer writes per record double; the desktop's fast phase is faster and longer).

## Security pass

Plan: `docs/plans/2026-10-04-ax42-security-tests.md`. Results: `docs/desktop-runs/ax42-security/`.

- Refused or detected: B2 (cert outside the channel), B3/B4/A1 (committed, then caught by the
  auditor), A2 (below threshold), A3 (flipped total), D1 at MP-10K and **D1-L at MP-1M** (every live
  attack refused at its gate during a 3,000,000-record ballot window, E = 0), D2 replay, D3 peer and
  orderer kill with resume, D4 netem, A4 one-byte edits, A6 (a second machine reproduced the SP-3.5M
  tally, 8/8 contests identical: RQ1(e)), A7 (0 linkage hits over 3,524,078 voters), A5 (47 runs pass
  `ledger.order`).
- Found and fixed on the AX42: Fabric ports open to the internet (X1, `fabric-firewall.service`),
  password SSH (X3), an SSH bot flood that dropped our sessions.
- Stated limits: no caller authorisation (B1 front-run), plain-HTTP console (D5), block order not
  observable from the read path, one host per environment, `govulncheck` reports 5 known
  vulnerabilities in the chaincode's gRPC / `x/net` dependencies (bumping them changes the chaincode).

## Open items

1. **Raw run files on the AX42** (333 GB): copy with `python C:\Users\User\ax42-pull\pull_parallel.py 6`
   (resumable, sha256-checked, to `Q:\thesis-archive\ax42`), then cancel the server, which is
   still billing. Run evidence (summaries, perf, receipts, resources) is already in this repo.
2. **Appendix B screenshots** from the redesigned apps.
3. **For the manuscript:** the [18] beyond-one-million projection value, the AX42 rental cost
   (Appendix D), Table 4.7a numbering. The paper itself (PDF/.docx) stays out of this public repo.
4. **Desktop Fabric:** the volumes were removed after the last run; the next desktop bring-up needs
   `./tools/up.sh down` and a fresh network.

Power: the desktop lost power several times during the study (electric-cooperative brownouts). The
resume/discard policy in `docs/plans/2026-10-01-ch4-runs-and-chapter.md` handled each one; no
measured result came from an interrupted run.
