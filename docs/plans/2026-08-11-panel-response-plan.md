# Plan — Respond to Panel Comments (BalotaChain/Saksi thesis)

Source: `COMMENTS-AND-SUGGESTIONS-balotachain1.docx` (Adviser Mark L. Flores, 35
comments + priority list). Verdict: **PROCEED WITH IMPLEMENTATION, subject to
major methodological + technical clarifications.**

## Framing (verified against the codebase, not assumed)

The panel's overarching ask: keep three things distinct — what the system is
*designed* to provide, what is *implemented*, what is *empirically demonstrated*
— and stop overclaiming ("secure", "production-ready", "national-scale").

**Good news, evidence-backed:** most of the panel's HIGH-priority *technical*
items are already implemented. What they demand is largely **formalization**
(matrices, specs, precise definitions, mapping tests → claims) plus a few
genuinely-new assembled tests. Current verified state:

- **Negative tests (#24):** 11 of the panel's 12 cases already have tests
  (chaincode `TestSubmitBallotRejects*`: MalformedCiphertext, BadCredentialSignature,
  TamperedCDSProof, DoubleVote, WrongVersion, ContestCountMismatch, MissingDKG,
  MissingNullifier, UnknownElection/Position; auditor: tampered CDS / Chaum-Pedersen /
  partial share, wrong issuer pk, wrong tally, sub-threshold, altered contest id).
  Only "expired credential" is absent — the credential model has **no expiry**, so
  that is a documentation note (N/A), not a gap.
- **Verifier is public-record-only (#28/#29):** `ElectionArtifacts` consumes only
  public data (parameters, DKG transcript, ballots, partial decryptions, tally,
  issuer *public* key). No secret shares, no private keys. Independent verification
  from the public record is already true by construction.
- **Correctness ladder (adviser's 1→10→100→1000):** demonstrated this session —
  N=1000 audits clean (3000 ballots, 0 FAIL, all nullifiers distinct, E=0 on all
  9 contests).
- **6-phase incremental order (adviser):** matches our locked sequencing
  (crypto core → protocol → blockchain → apps → testing → evaluation).

So this plan is **mostly formalization + a few new tests + tier re-labelling**,
NOT a rebuild. It spans both repos (Saksi = crypto library; BalotaChain =
election application + manuscript).

---

## A. Implementation work (code)

### I1 — Formal end-to-end Independent Verification Test (#29) — flagship, HIGH
Assemble the pieces we have into the panel's exact procedure: run an election →
close → tally → **strip private trustee data** → hand the verifier ONLY the public
record → confirm it reproduces the verification result → then **tamper one public
record** and confirm the verifier detects it.
- We have: public-only auditor, `ledger_digest` (reorder/tamper detection), and
  tamper tests (`wrong_tally`, `malicious_bb_node_*`, `tampered_*`).
- New: a single dedicated test/harness that (a) serializes the public record only,
  (b) runs the verifier in a clean process, (c) asserts PASS, (d) flips one record,
  (e) asserts the verifier now FAILS with the specific finding. Runs offline.

**Eng-review decision (E1): the verifier runs on the PUBLIC record ONLY.** The
exported record MUST NOT include `ground_truth` — that is the generator's answer
key, not public election data. I1 runs the auditor with `ground_truth: None`,
asserting the tally is reproduced + verified from public artifacts (params, DKG
transcript, ballots, partial decryptions, tally) plus proof + ledger-consistency
checks. The `E=0`-vs-seeded-truth comparison stays a **separate generator-side
test** (already built, Phase 1.3) — mixing it into the public verifier would make
"independent verification" verify against a private answer key, defeating #29.

**Eng-review decision (F5): the tamper matrix covers every public-record mutation
class the verifier must catch**, not just four: (1) flipped ballot ciphertext byte,
(2) altered tally total, (3) dropped ballot, (4) reordered ballots, (5) tampered
partial-decryption share, (6) tampered DKG transcript. Each asserts the specific
failing finding.

### I2 — Privacy unlinkability as a linkage-ATTEMPT experiment (#17) — HIGH
**Eng-review decision (E2):** not just a structural assert — a runnable adversary
experiment that *attempts* linkage and provably fails.
- Adversary holds the full on-chain record (all ballots, nullifiers, commitments,
  tally) + the synthetic voter-registration list.
- The experiment RUNS a linkage function: for each published ballot, try to join it
  to a voter id using any on-chain field. Assert it does no better than chance —
  every on-chain field is anonymous crypto material (ElGamal ciphertext, PRF
  nullifier, curve-point commitment, public label); none joins to a registration
  identifier, so the linkage set is empty.
- Stays within the locked **structural** scope (no timing/metadata channel), but is
  an actual attack procedure, not a claim. Acknowledge the limit: two ballots from
  the same credential share a commitment → linkable to each other, never to an
  identity. Stated as structural, not empirical unlinkability.

### I3 — Complete + formalize the negative-test matrix (#24, #22) — HIGH
- Add the one missing case as an explicit documented decision: credential
  expiry — either add an expiry field + rejection test, or record "no expiry in the
  v1 model" as a scope note. (Recommend the scope note; expiry is not in the protocol.)
- Emit the panel's per-scenario record for every negative + attack test:
  Precondition / Input / Action / Expected behavior / Actual result / Evidence(log)
  / Pass-fail / Security property. **Eng-review decision (E3): a hand-maintained
  mapping doc** (test name → panel fields), NOT an auto-extraction harness — the
  suite is ~30 tests, and Rust/Go expose no structured test metadata, so a parser
  would be accidental complexity for a doc artifact.

> **Eng-review decision (E4): I4–I7 are requirements ON the saksi campaign plan
> (`saksi/docs/plans/2026-07-15-research-campaign-suite.md`), which owns the
> measurement harness — they are NOT re-specified or built here.** This plan
> records the panel rationale; the campaign plan is the single source of truth so
> the two plans cannot drift on one harness. Each item below is folded into the
> campaign plan as a panel-driven requirement.

### I4 — Tier reclassification + failure-analysis fallback (#20) — HIGH → campaign plan
Reclassify the campaign tiers and make 1M **non-mandatory**:
- **Primary:** 1k, 10k, 50k (must complete).
- **Large-scale:** 483k.
- **Stress:** 1,000,000 (attempt; success NOT a thesis pass condition).
- If a tier cannot complete, the run records the bottleneck: CPU/RAM/storage
  utilization, transaction backlog, throughput degradation, failure point — a
  failed stress test analyzed properly is a valid result. Wire this into the
  `campaign.json` manifest + `verify` gate (a Stress cell may be "incomplete +
  analyzed" without failing the campaign). Supersedes the earlier "attempt all
  tiers end-to-end, mandatory" framing.

### I5 — Performance statistical rigor (#18) — HIGH (already = Phase 2 E-findings)
The panel confirms the eng-review validity corrections. Extend the metrics to the
panel's full list: exact repetition count, warm-up runs (discarded), failed-run
inclusion policy (excluded + logged), and **stddev / IQR** alongside
min/median/mean/p95/p99. Resource axis: CPU, RAM, **disk, network** utilization
(add disk+net to the docker-stats capture). Phase timings: endorse / order /
validate / commit + CDS-verify + proof-gen + proof-verify + aggregation +
threshold-decryption (Phase 2.1).

### I6 — Reproducible environment capture (#19) — MEDIUM
The `campaign.json` manifest records the complete environment per run: CPU, RAM,
storage, OS, Docker / Fabric / Go / Rust / Flutter / Tauri / Caliper versions,
peers, orderers, consensus config, container resource limits, network config.
Auto-capture what is machine-readable; template the rest.

### I7 — Baseline truly comparable (#21) — MEDIUM (already = E4)
The no-CDS Galal baseline variant (`//go:build nocds`) must run on the **same
box / same Fabric config / same workload** as the measured system. If any baseline
number comes from different hardware, it is labelled a **cross-study comparison**,
never a controlled experimental comparison, in both the manifest and the write-up.

### I8 — Formalize RQ1 correctness criteria (#3) — HIGH
Convert "operate correctly" into the panel's measurable criteria and map each to an
existing gate/test: final tally == ground truth (**E=0**), invalid ballots rejected
(**negative suite**), duplicate votes rejected (**nullifier uniqueness**), all
accepted ballots included (**Reconcile**), result independently verifiable (**I1**),
all crypto proofs verified (**CDS / Chaum-Pedersen / credential checks**). This is a
mapping doc backed by named tests — most already exist.

---

## B. Documentation deliverables (describe what is built; manuscript + repo)

- **D1 Threat Model Matrix (#15):** Adversary / Capability / Attack / Target /
  Defense / Expected result / Evidence — one row per adversary class, each linked to
  its test. Source: `security_privacy.rs` traceability matrix (already exists in
  comment form).
- **D2 Crypto protocol spec (#12, #13):** parameters, curve (ristretto255), key
  sizes, RNG (OsRng), encoding, ciphertext structure, DKG/threshold config, proof
  gen/verify, aggregation, decryption, credential issuance, nullifier derivation +
  the lifted-ElGamal vote→group-element→tally→brute-force-decode recovery, with
  pseudocode for the implemented portions.
- **D3 RQ → Objective → System function → Test scenario → Metric → Expected →
  Evidence matrix (#4).**
- **D4 Saksi vs BalotaChain contribution split (#11):** Saksi = crypto library
  (encryption, DKG, ZK proofs, decryption); BalotaChain = election app (voter/trustee
  workflow, Fabric integration, election management, verification).
- **D5 Verifier verification-scope list (#28):** map the auditor's findings to the
  panel's list (tx validity, credential, nullifier uniqueness, ciphertext, ballot
  proof, aggregate, trustee decryption proof, threshold, final tally, ledger
  consistency) — nearly 1:1 with existing findings.
- **D6 Audit-trail data classification table (#27):** Data / on-chain-off-chain /
  public-private / purpose / retention; demonstrate no on-chain voter-ballot linkage.
- **D7 System architecture diagram (#30):** Voter→Saksi→Fabric→Chaincode→Ledger;
  Trustee→Saksi→Fabric; Ledger→Verifier — with interface boundaries, data flow,
  crypto ops, public/private, trust boundaries.
- **D8 Test taxonomy (#23):** map existing tests to Unit / Integration / System.
  Gap: integration `voter↔Fabric` (write path) and `trustee↔blockchain` are absent
  (the deferred LARGE write path); `verifier↔ledger` exists (fabric-adapter CI job).
- **D9 Per-repo reproducibility docs (#31):** version, commit/tag, dependency
  versions, build + test + deploy instructions, for both repos.

---

## C. Framing / claim-scoping (code comments + reports already do this; reinforce)

- **#16, #35 no "secure":** language is "demonstrated resistance to the defined
  attack scenarios under the stated threat model" — already in code comments; audit
  the manuscript + report strings for stray absolute claims.
- **#25 Raft = CFT not BFT:** make prominent — the class-5 BB-node test already
  frames "auditor detects, network does not prevent (1-org, no BFT)".
- **#11/#34 Saksi vs BalotaChain / terminology:** consistent naming everywhere.

---

## D. Explicitly NOT changed (already satisfies the panel, with evidence)

| Panel ask | Already have |
|---|---|
| Correctness at 1→10→100→1000 before scaling | ✓ demonstrated (N=1000, 0 FAIL, E=0) |
| Verifier from public record only (#28/#29) | ✓ `ElectionArtifacts` is public-only |
| Negative tests (#24) | ✓ 11/12 (expiry N/A) |
| Tally accuracy vs ground truth (#3) | ✓ E=0 wired + tested |
| All accepted ballots included (#3) | ✓ Reconcile wired |
| Ledger tamper/reorder detection | ✓ `ledger_digest` |
| Two repos (#31) | ✓ saksi + balotachain |
| Percentile perf metrics (#18) | ✓ p50/p95/p99 harness |

---

## Sequencing (adviser's 6 phases; we are at Testing/Evaluation)

HIGH-before-more-implementation (panel priority): **I8, I3, I1, I2** (correctness
criteria + negative matrix + independent-verification test + privacy experiment)
— all offline, verifiable now — then **D1–D5** (threat model, crypto spec, RQ
matrix, contribution split, verifier scope). Then **I4/I5/I6/I7** wire into the
Phase 2 measurement harness (network-gated). D6–D9 + framing land alongside.

## NOT in scope
- Building the voter/trustee/admin write path (LARGE, deferred; the auditor +
  saksi-demo already prove the protocol end-to-end).
- Any manuscript prose beyond claim-scoping the code comments / report strings.
- Making the 1M stress tier mandatory (#20 explicitly relaxes it).

---

## E. Matrix of Revisions — committed-manuscript obligations (2026-08-19)

Source: `doc-spec-update/Matrix_of_Revisions.docx` (32 revisions the researchers
have ALREADY written into `BalotaChain_LineNumbered.docx`) + the line-numbered
manuscript body. Because these are *committed* claims, the code must now MATCH
them. Investigation mapped all 32 rows to code obligations; the material ones:

### Hard code-vs-doc mismatches (doc now claims what the code lacks)

**M12 — BSGS tally decode at ≥50k voters (manuscript p.40 line 734).** The doc
commits verbatim to "a linear scan at the smaller tiers and Shanks's baby-step
giant-step method [29] at fifty thousand voters and above, with the search bound
set to the number of ballots accepted." Current code is linear-only
(`tally.rs` `for k in 0..=max`). **Decision: implement BSGS at ≥50k, keep linear
below** (reverses this plan's earlier "BSGS not in scope"). ~40 lines
(curve25519-dalek), bound = accepted-ballot count, exact + always terminates.
Lands in `saksi-auditor::tally` (and the standalone `brute_force_decode`).
Also update `saksi/docs/plans/2026-07-15-research-campaign-suite.md` NOT-in-scope
(remove the BSGS exclusion).

**M20 — expired-credential negative case (manuscript test T5, line 939).** The
doc lists "invalid or **expired** credentials" as a rejection case; the v1
credential model has **no expiry**. **Decision: add credential expiry as a real
protocol feature.**

**Eng-review E1 — the expiry clock must NOT be the client tx timestamp.**
`GetTxTimestamp` is set by the client in the signed proposal, so a malicious voter
could backdate it to pass an expired credential. Instead bind expiry to an
**on-chain election voting window** the client does not control:
- `ElectionParameters` gains a voting window (`voting_close`, optionally
  `voting_open`), stored at `CreateElection`.
- The credential gains `valid_until`. At `SubmitBallot` the chaincode rejects if
  `valid_until < voting_close` (the credential must cover the whole voting
  period), comparing two on-chain values — deterministic across endorsers and
  not voter-spoofable. A real boundary, not a hygiene check.

**Eng-review E2 — this is a wire-breaking change with Rust↔Go byte-parity risk;
sequence these steps explicitly (do not discover them mid-build):**
1. Proto: add `valid_until` to the credential/presentation and the voting window
   to `ElectionParameters`; regenerate Rust + Go (protoc/Docker — the known-fiddly
   path; use the host vendored protoc fallback if Docker is down).
2. `saksi-credentials`: extend the **issuer-signed message** to cover `valid_until`
   (it MUST be inside the signature or a voter can edit it).
3. `credverify` (Go): mirror the new signed scope **byte-for-byte** with the Rust
   signer.
4. **Re-pin the golden vectors** `credential-sig-v1.hex` and `ballot-v1.hex`
   (the signature bytes change).
5. A **Rust→Go signature-parity test** over the new scope (the chaincode gate and
   the Rust signer must agree, else all ballots reject at endorsement).
6. Then the chaincode expiry gate + auditor check + the negative test (expired
   credential rejected) with its positive control (valid credential accepted).

Touches `saksi-protocol` (proto + regen), `saksi-credentials`, chaincode
(`credverify` + `contract`), `saksi-auditor`. LARGE — the one genuinely new
protocol feature the matrix forces; the byte-parity step is the landmine.

### Spec / pseudocode artifact the doc says is released with the Saksi repo

**M11 (line 711) + M12 Algorithms.** `spec/protocol.md` already covers
ristretto255 / 32-byte encodings / Merlin Fiat-Shamir / additive `m·G`. Add the
doc's remaining specifics: 252-bit scalar field, OS CSPRNG via `getrandom`,
explicit ciphertext structure, and **numbered pseudocode/Algorithms** matching
the manuscript's "Algorithm N" references (Pedersen DKG, CDS prove/verify,
credential issuance, nullifier derivation, tally decode incl. BSGS). Doc D2.

### Experiments the doc commits to — run + record evidence (refine I1/I2/I5)

- **M21 (line 902):** verifier runs on a **separate machine** from the public
  record, reproduces the tally + accepts all proofs, then one record is modified
  and it must detect the inconsistency ("software independence", Rivest). We now
  literally have two boxes (Linux dev + Windows run) — run it cross-machine. This
  is I1, upgraded from "clean process" to "separate machine".
- **M32 (line 877):** Table 3.8 nine-column schema, 8 scenarios — the actual-
  result + evidence-log columns are "completed during implementation": run the 8
  scenarios, capture actual results + log references, archive with the repo. This
  is the evidence layer over I3.
- **M16 (line 920):** privacy unlinkability formalized as identifying a targeted
  voter's ballot **better than random over the anonymity set** (Pfitzmann-Hansen),
  bounded by 1/(anonymity-set size). Pins I2's success metric.
- **M17 (line 1068):** **≥10 measured repetitions after 2 discarded warm-ups**,
  failed runs excluded + failure rate reported, separate proof-gen / proof-verify
  / aggregation / threshold-decryption timings, min/median/mean/p95/p99/stddev +
  CPU/mem/disk/net. Pins the campaign-plan harness numbers (I5).
- **M13 (line 768):** worked example — 3 positions × 5 voters → 15 accepted
  records, 3 independent tallies matching seeded ground truth. Generate + document
  (already producible: `saksi-demo gen --voters 5 --positions 3`).

### Integration-test scope (eng-review E3, M19)
M19 claims a three-tier plan (unit / integration / system). The integration tier
is scoped to **what exists**: app↔Saksi-library (FFI), Saksi-library↔chaincode
(`saksi-demo` lifecycle), chaincode↔ledger, verifier↔ledger (`fabric-adapter`,
CI-proven). The **app↔Fabric write** integration is explicitly **deferred** in
both plan and manuscript (the voter/trustee/admin write path is LARGE and out of
scope; apps write to a JSON store, not Fabric). Do not claim app↔Fabric write
integration as passing.

### Added test items (eng-review G4/G5)
- **G4 (M12):** BSGS decode differentially tested against the linear scan across a
  value range + boundaries (0, N, exactly the ≥50k threshold); the threshold is a
  named constant.
- **G5 (M23):** a test asserting the on-chain stored set equals the 9 classified
  public items (no extra field that could create a voter↔ballot linkage).

### Already satisfied / manuscript-only
M27 correctness ladder ✓ (proven at N=1000); M24 verifier's 10 checks = existing
auditor findings (map them, incl. `ledger_digest` = append-only consistency); M2
baseline cross-study (campaign plan). ~18 rows are pure prose (captions, refs,
DSRM table, terminology, cost, ethics, lit-synthesis) — manuscript, no code.

### Revised implementation order (matrix-aware)
Offline, verifiable on Windows: **M12 BSGS → M20 expiry → I8/I3 (+M32 evidence,
M13 example) → I1/M21 (cross-machine) → I2/M16 → M11 spec/pseudocode**. Then
I5/M17 + I4/I6/I7 in the campaign harness (network-gated).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | n/a | Panel-response triage; strategy set by adviser comments |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | unavailable | codex not on this profile's PATH; subagent outside-voice previously declined |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | clean | Run 1 (I-items): 5 findings resolved (I1 public-record-only + E=0 gen-side; I2 linkage-attempt; I3 hand-maintained table; I4-I7 folded into campaign plan; I1 6-case tamper matrix). Run 2 (matrix §E): 5 findings resolved — E1 credential expiry bound to an on-chain voting window (not spoofable client tx timestamp); E2 explicit Rust↔Go byte-parity + golden-vector re-pin sequence for the wire-breaking M20 change; E3 M19 integration scoped to what exists (app↔Fabric write stays deferred); G4 BSGS differential+boundary test; G5 on-chain 9-item data-classification test |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | n/a | No UI in this plan (tests + docs) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | n/a | — |

- **VERDICT:** ENG CLEARED (run 2) — matrix obligations locked. Start order: M12 BSGS (safe, isolated) → M20 expiry (wire-breaking; follow the E2 parity sequence) → I8/I3/I1/I2. Manuscript should note (M8 epistemic status): credential expiry is enforced against the on-chain voting window; app↔Fabric write integration is deferred.

NO UNRESOLVED DECISIONS
