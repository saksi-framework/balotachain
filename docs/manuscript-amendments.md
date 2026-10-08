# Manuscript amendments

Amendments to the BalotaChain manuscript required by the instrument-gap audit
(`docs/instrument-gap-report.md`). Each amendment answers one or more of that
report's commitment ids (C1–C48, T1–T8) and names the artifact that backs it:
a journal event, a CSV column, a test name, or a function. Where a number
depends on a measurement run that has not been executed, the text carries an
explicit `TODO(fill from summary.csv)` marker rather than a placeholder value.

Two conventions apply throughout. First, no reported figure has a producer that
does not exist: a column with nothing to fill it is written as an empty cell,
never as a zero, and the regression guard for that rule is
`TestRowWithoutProducersEmitsEmptyCells` in
`saksi/packages/saksi-bulletin/client-sdk/bench/metrics_test.go`. Second, every
duration is computed from monotonic readings held in memory (`time.Time.Sub` in
Go, `Instant::elapsed` in Rust); wall-clock strings written into artifacts are
labels and are never parsed back and subtracted.

File paths in §1 to §10 are given without line numbers, because the files named
were still under active change on the `instrument-gap` branch when those
sections were written. Sections added or revised on 2026-10-08 cite line numbers
at saksi `4a38a54`, the single study build of Chapter IV, unless another commit
is named.

**Update of 2026-10-08.** This file was last changed on 2026-09-15. Since then
the Chapter IV study ran to completion on `4a38a54` (merge of saksi #56, which
contains #55's merge `25a4fae`), on the declared desktop and on a second machine
(a Hetzner AX42), and an AX42 security pass ran on the same build
(`docs/desktop-runs/ax42-security/STATUS.md`). Chapter IV is drafted in
`docs/paper/chapter-4-draft.md`; this file stays consistent with it. Changes:
- §2.1 and §5: the tables are filled from the runs (Chapter IV Table 4.2); §5's
  refusal list replaces `OfflineVoterCeiling`, removed by saksi #49.
- §3: four further places that carry the on-chain-aggregation premise.
- §4.1: T5's "outside an authorized identity" is false (no caller authorization).
- §6: the partial-decryption limitation is now demonstrated live, and the
  key-generation transcript shares it.
- §7: filled. §8: deleted (Fabric came up). §9: Caliper struck from the
  manuscript by the researchers' decision of 29 September 2026.
- New §11 (issuer binding, selection-sum proof and the empty-position hole,
  fixed at saksi #55), §12 (security-pass findings), §13 (simulated ceremony,
  extended), §14 (figures, tables and tool lists that no longer match the
  system, and the second environment).

---

## 1. Appendix A — the 500-voter reproducibility sample

**Answers C44 (CONTRADICTED).**

The published sample gives the 500-voter, single-position, four-candidate tally
as CAND_PRES_01 = 142, CAND_PRES_02 = 119, CAND_PRES_03 = 131, CAND_PRES_04 =
108, and does not state which generator profile produced it. No profile the
generator ships produces those numbers, so the manuscript's own worked
reproducibility example cannot be reproduced with the open-source generator —
something a panelist can establish in a single command.

**Replace the sample with the regenerated `realistic` row.** The corrected
paragraph should read:

> Running the reference generator with 500 voters, one position, four
> candidates, and the `realistic` profile produces the ground-truth tally
>
> ```
> position,candidate,ground_truth_count
> PRESIDENT,CAND_PRES_01,245
> PRESIDENT,CAND_PRES_02,90
> PRESIDENT,CAND_PRES_03,85
> PRESIDENT,CAND_PRES_04,80
> ```
>
> The profile must be stated, because it determines the row: at the same
> configuration `uniform` yields 125/125/125/125 and `skewed` yields
> 250/84/83/83. Only `realistic` decides the contest outright, which is why it
> is the profile used for the accuracy experiments.

**Backing artifact.** The command is

```
python3 docs/saksi/reference_generator.py --voters 500 --positions 1 \
  --candidates 4 --distribution realistic
```

run from the balotachain repository root. The Python reference generator is a
line-for-line translation of the Rust selection code in
`saksi/packages/saksi-auditor/src/fixtures.rs` (`realistic_quotas`,
`SelectionPlan`); the two are verified byte-identical across the nine
configurations exercised by the cross-reference (see
`saksi/docs/rust-python-cross-reference.md`). The arithmetic is integer and
carries no random state, so the row above is deterministic and any reader can
reproduce it. The audit records this correspondence as C43 (SATISFIED); C44 is
the sample row alone.

---

## 2. §3 Performance — repetitions, stage timers, and the deleted Fabric columns

**Answers C35, C36, C37, C18, C39, C45.**

### 2.1 Repetitions as executed

The manuscript commits to at least ten measured repetitions after two discarded
warm-ups, with three after one warm-up at the capstone tiers. A repetition
driver now carries out that procedure: `saksi-campaign --repeat --config run.json
--warmups W --reps R` drives the console's HTTP API once per repetition, tags
each repetition's journal with a `rep {index, kind}` event where `kind` is
`warmup` or `measured`, and writes `summary.csv` across the measured repetitions
only. Failed runs are excluded from every throughput and latency statistic and
are reported instead as a failure rate; a run is failed when the predicate
`runFailed` in `saksi/packages/saksi-campaign/journal.go` fires — a stage error,
any dropped ballot, a reconcile mismatch, a non-zero `E` on any contest, or an
interruption — and its reason string is recorded in the `run.end` journal event
(`reason`) and in `perf.csv` (`fail_reason`).

The manuscript should therefore report the counts **as executed**, not as
planned. Insert this table, filled from `summary.csv` and `campaign.json` of each
tier export as Chapter IV Table 4.2 records them (all on saksi `4a38a54`;
"desktop" is the declared Ryzen 7 5700G, "AX42" the second environment of §14):

| Configuration | Warm-ups discarded | Measured repetitions | Runs failed | Failure rate |
|---|---|---|---|---|
| SP-1K (desktop) | 2 | 10 | 0 | 0 |
| MP-1K (desktop) | 2 | 10 | 0 | 0 |
| MP-1K (AX42) | 2 | 10 | 0 | 0 |
| SP-10K (desktop) | 2 | 10 | 0 | 0 |
| MP-10K (desktop) | 2 | 10 | 0 | 0 |
| MP-10K (AX42) | 2 | 10 | 0 | 0 |
| SP-50K (desktop) | 2 | 5 | 0 | 0 |
| MP-50K (desktop) | 2 | 5 | 0 | 0 |
| MP-50K (AX42) | 2 | 5 | 0 | 0 |
| SP-483K (desktop) | 1 | 3 | 0 | 0 |
| MP-483K (AX42, on-chain) | 1 | 3 | 0 | 0 |
| MP-483K (desktop, on-chain, optional) | 1 (interrupted by a power loss after its window; verified, discarded) | 3 | 0 | 0 |
| MP-483K (desktop, offline) | 0 | 1 | 0 | 0 |
| SP-1M (desktop) | 0 | 3 | 0 | 0 (Night 1 attempt superseded: 2 of 3 failed when the host disk filled) |
| MP-1M (AX42, on-chain) | 1 | 3 | 0 | 0 |
| MP-1M (desktop, offline) | 0 | 1 | 0 | 0 |
| SP-1.92M (desktop) | 1 | 3 | 1 (m1: `nothing_submitted` after its resume; 0 ballots lost) | 1 of 3 by the console's flag; 0 by ballot loss |
| MP-1.92M (AX42, on-chain) | 1 | 3 | 0 | 0 |
| MP-1.92M (desktop, offline) | 0 | 1 | 0 | 0 |
| SP-3.5M (desktop) | 1 | 3 | 0 (one m2 attempt cut by a power loss before any ballot, discarded and rerun) | 0 |
| MP-3.5M (AX42, on-chain) | 1 | 3 | 0 | 0 |
| MP-3.5M (desktop, offline) | 0 | 1 | 0 | 0 |

The departures from ten measured repetitions after two warm-ups (2 + 5 at 50K,
1 + 3 at 483K and the capstones, 0 + 3 at SP-1M, single offline runs) are stated
in Chapter IV beneath Table 4.2, with their reasons. Source: Chapter IV Tables
4.2 and 4.11 and the evidence commits listed in its header.

Each metric is reported as min, median, mean, p95, p99 and population standard
deviation, satisfying C36. Within a run those six statistics come from
`bench.Summary` in
`saksi/packages/saksi-bulletin/client-sdk/bench/metrics.go` (nearest-rank
percentiles, population standard deviation; known-vector test
`TestSummaryKnownVector`, edge cases `TestSummaryN1`, `TestSummaryN2`,
`TestSummaryAllEqualStdDevZero`), and appear in `perf.csv` as
`latency_min_ms`, `latency_p50_ms`, `latency_mean_ms`, `latency_p95_ms`,
`latency_p99_ms` and `latency_stddev_ms`. Across repetitions the same six
statistics are recomputed over the per-run values by the `--repeat` driver into
`summary.csv`.

### 2.2 Stage timers as implemented

The manuscript commits to timing four stages separately: proof generation,
proof verification, aggregation, and threshold decryption. The instrument now
has three distinct classes of timer, and the manuscript must say which class
each reported figure belongs to, because they are not interchangeable.

**Four in-process Rust timers.** `audit_with_evidence` in
`saksi/packages/saksi-auditor/src/lib.rs` accumulates a `Timings` struct with
four `Duration` fields — `verify_ballots`, `aggregate`, `combine`, `decode` —
stamped at the four existing stage boundaries inside the auditor process, with
no I/O between the stamps. `audit_stream_dir` in
`saksi/packages/saksi-auditor/src/demo.rs` copies them into the `StreamAudit`
JSON as `timings_ms`, the console writes them to `timings.json`, and they reach
`perf.csv` as `proof_verify_inproc_ms`, `aggregate_inproc_ms`,
`combine_inproc_ms` and `decrypt_inproc_ms`. These map onto the paper's "proof
verification", "aggregation" and "threshold decryption" (split into Lagrange
recombination and discrete-log recovery, which the paper collapses into one).

> **Timing-semantics note that must appear in the text.** The `aggregate` timer
> measures Ristretto point addition only. Point decompression was moved into
> ballot verification, where it belongs, so `aggregate_inproc_ms` is **not
> comparable to any aggregation figure reported earlier in this project's
> history**. Any earlier aggregation number in a draft or a progress report must
> be struck, not reconciled.

**Generator CPU sums.** The paper's "proof generation" is measured by the
generator, not the auditor, and is reported as thread-summed CPU time. The
chunked streaming generator (`write_election_stream_chunked` in
`saksi/packages/saksi-auditor/src/stream.rs`) accumulates per-ballot credential,
encryption and CDS-proving durations across its `rayon` worker threads and
writes `gen-timings.json` with the keys `credential_cpu_ms`, `encrypt_cpu_ms`,
`cds_prove_cpu_ms`, `wall_ms`, `chunks` and `chunk_voters`. The `_cpu_ms`
figures are **summed across threads and therefore legitimately exceed
`wall_ms`**, which is the prologue-to-end wall time of the whole generation. In
`perf.csv` these become `gen_wall_ms` (wall), `gen_cpu_ms` (the three CPU sums
added) and `proof_gen_cpu_ms` (`cds_prove_cpu_ms` alone). The manuscript must
state the units as CPU-milliseconds wherever it quotes proof-generation cost,
and must not divide a CPU sum by a wall time and call the result a rate.

**Console wall clocks.** Submission cost is a wall clock kept by the Go console.
`submitBallots` in `saksi/packages/saksi-campaign/executor.go` opens the timed
window around the ballot submission only: latency is measured from `SubmitAsync`
to `commit.Status()`, and the `qscc` receipt fetch, the receipt CSV write and
every other file write happen **after** the window closes, batched one
`GetBlockByNumber` per distinct block. The window's duration is `perf.csv`
`submit_window_ms`; `committed_tps` is committed ballots divided by that window.
Per-ballot latencies go to `latencies.csv` (`index,segment,ms,ok`).

### 2.3 Fabric per-phase columns removed

**Delete the endorsement/ordering/validation/commit breakdown from Appendix C
and from any §3 text that promises it.** The five columns `endorse_p50_ms`,
`cds_verify_p50_ms`, `order_p50_ms`, `validate_p50_ms` and `commit_p50_ms` have
been removed from `bench.Row` and its CSV header in
`saksi/packages/saksi-bulletin/client-sdk/bench/metrics.go`.

The reason is that they are not client-observable. A Fabric client sees one
duration — submit to commit — and the internal split between endorsement,
ordering, validation and commit is visible only inside the peer and the
orderer. The previous form emitted them as zeros, which a reader would have
taken as measurements. Deleting the columns is the honest outcome; emitting
zeros was not, and reporting a number the instrument cannot see would have been
worse than reporting nothing. The manuscript should say plainly that the
submit-to-commit latency distribution is reported and that its internal phases
are out of the client's observational reach.

The same deletion logic applies to `decrypt_ms`, `peak_cpu_pct` and
`peak_mem_mb`, which are now nullable: they are filled when a producer ran (the
auditor's decode timer; the `docker stats` sampler in
`saksi/packages/saksi-campaign/sampler.go` for the peer, orderer and the
console's own process) and left as empty cells when it did not. An offline run
opens no submission window, so its submit, peak and ledger columns are blank
rather than zeroed. Every column's provenance is documented in
`perf-schema.md`, written into each run folder beside `perf.csv` by
`writePerfSchema` in `saksi/packages/saksi-campaign/perf.go`.

---

## 3. Algorithm 4 and the hot-key paragraph

**Answers §2 item 4 of the audit (NOT BACKED — contradicted).**

The manuscript describes per-precinct sub-accumulators folded into a single
closing transaction, presented as the fix for write-set contention on a hot
accumulator key. No such mechanism exists, and none is needed, because the
premise is wrong: there is no on-chain accumulator to contend for.

**Rewrite the paragraph as follows.**

> Homomorphic aggregation is performed by the verifier from the public record,
> not by the ledger. The chaincode stores each accepted ballot under its own
> composite key (`ballot|<election-id>|<nullifier>`, written by `SubmitBallot`
> in `saksi/packages/saksi-bulletin/chaincode/contract.go`) and maintains no
> running total of any kind. Concurrent ballot submissions therefore touch
> disjoint keys, and no two transactions in a block write the same key, so the
> read-write-set conflict that a shared accumulator would produce — and that
> Fabric would resolve by invalidating the loser at validation — cannot arise
> in this design.
>
> The aggregate is instead recomputed by anyone holding the public record. The
> auditor folds each verified ballot's ciphertext into a per-contest running
> ElGamal aggregate as it streams the ballots
> (`audit_with_evidence` in `saksi/packages/saksi-auditor/src/lib.rs`; the
> aggregate is decrypted only after every ballot has been folded, per
> `saksi/packages/saksi-auditor/src/decryption.rs`), and the result is checked
> against the published tally by the `tally.homomorphic_sum` and
> `tally.aggregate` findings. Because the aggregation is a pure function of the
> committed record, it is reproducible by an independent verifier and requires
> no trust in the party that first computed it.

Delete Algorithm 4 and the hot-key discussion, or restate them as a design
alternative that was considered and rejected in favour of verifier-side
aggregation, with the contention argument given as the reason the alternative
was not needed. Do not present unbuilt chaincode as implemented.

**The same premise appears in four more places (added 2026-10-08).** Each
says the chaincode aggregates, or coordinates decryption; neither is true. At
`4a38a54` the chaincode stores ballots under per-nullifier keys (`SubmitBallot`,
`contract.go:118`), stores the key-generation transcript, the partial
decryptions and the tally (`PublishDKGTranscript` :608,
`SubmitPartialDecryption` :806, `PublishTally` :910), and verifies the tally's
trustee signatures against the threshold (:966-980). The ceremony is driven by
the console (`saksi/packages/saksi-campaign/ceremony.go`), and the aggregate is
computed by the verifier. Amend:
- **Definition of Terms, "Smart Contract (Chaincode)" (p. 13):** "the chaincode
  verifies ballots, performs aggregation, and coordinates decryption" →
  "the chaincode verifies each submitted ballot at its gates, records the
  election's public artifacts, and verifies the trustee signatures on the
  published tally".
- **Overview of the framework (p. 35):** "Accepted ballots are homomorphically
  aggregated into an encrypted total" → "Anyone holding the public record
  homomorphically aggregates the accepted ballots into an encrypted total per
  contest; the verifier does so".
- **Algorithm 4 (p. 41):** "each contest carries its own encrypted accumulator
  on the ledger" → "each contest is aggregated by the verifier from that
  contest's ciphertexts; the ledger holds no accumulator".
- **System architecture, after Figure 3.4 (p. 43), and Table 3.3's chaincode
  row (p. 44):** "commits valid ballots to the ledger, performs homomorphic
  aggregation, and coordinates the threshold decryption ceremony" and "Ballot
  verification, aggregation, decryption coordination" → "verifies and commits
  ballots; records the key-generation transcript, partial decryptions and the
  signed tally; verifies tally signatures at threshold". Move "aggregation" to
  the verifier's row.

---

## 4. T5 "expired" credentials, and C4 nullifier uniqueness

**Answers T5 (PARTIAL) and C4 (PARTIAL).**

### 4.1 Drop "expired"

T5 lists "invalid or expired credentials" among the unauthorized-access cases.
Credentials in this scheme carry no validity period: there is no expiry field in
the credential structure and no expiry gate in the chaincode, so an "expired
credential" is not a state the system can be in and not a rejection it can
produce. **Remove the word "expired" from T5 and from the eleven-row negative
test catalogue.** The remaining unauthorized-access cases — an invalid
credential signature, a reused nullifier, and a duplicate submission for the
same position — are each backed by a chaincode test
(`TestSubmitBallotRejectsBadCredentialSignature`,
`TestSubmitBallotRejectsDoubleVote` in
`saksi/packages/saksi-bulletin/chaincode/contract_test.go`) and by the auditor's
`nullifier.unique` finding.

If credential expiry is wanted as future work, say so in the limitations
section as an unimplemented extension, with the note that adding it means a
validity field on the credential and a clock the chaincode can trust — neither
of which this design currently has.

**Also correct T5's "submission attempts outside an authorized identity"
(Table 3.8, p. 49; added 2026-10-08).** The chaincode performs no caller
authorization: there is no `GetClientIdentity` call anywhere in
`saksi/packages/saksi-bulletin/chaincode/contract.go` at `4a38a54`, so any
member of the channel may call any function. Two different things are true and
should be said separately:

> A submission signed by an identity outside the channel's membership is
> refused by Fabric's membership service before the chaincode runs (AX42
> security pass B2: `creator org unknown`). Within the channel, the chaincode
> does not distinguish callers: eligibility to vote is established by the
> anonymous credential and its issuer binding (§11), not by the submitting
> identity. A channel member can therefore front-run another member's
> lifecycle call (B1: a second organization's `CreateElection` committed and
> the honest operator's call was refused, `already exists`). Caller
> authorization per function is future work.

Evidence: `docs/desktop-runs/ax42-security/B1/`, `B2/`, `STATUS.md:8,10`
(`82997d4`); Chapter IV Tables 4.6 (T5) and 4.7a. The same correction applies to
the p. 7 statement that a permissioned chain gives "access control over who may
participate in maintaining the record" (true of membership, not of chaincode
calls) and to Table 3.9's "membership" defense (§12).

### 4.2 Nullifier uniqueness is a verifier check

The manuscript places nullifier uniqueness inside the data-validation gate,
alongside completeness, identifier uniqueness, candidate-set membership and
aggregate consistency. It is not there, and it cannot be: the gate
(`RunCheck` in `saksi/packages/saksi-campaign/check.go`) runs over the plaintext
ground-truth CSVs, streaming them line by line, at a point in the pipeline
**before any nullifier has been derived**. There is nothing for it to check.

**Rewrite §3.3's gate description to four plaintext checks and move nullifier
uniqueness to the verifier.** The corrected statement:

> The data-validation gate operates on the plaintext synthetic population and
> checks completeness and well-formedness, identifier uniqueness, membership of
> every selection in the declared candidate set, and internal consistency
> between the per-ballot table and the summary table. It is fail-closed: a
> population that fails any check cannot proceed to encryption.
>
> Nullifier uniqueness is enforced twice, at neither of those points. On the
> ledger, `SubmitBallot` rejects a ballot whose nullifier has already been spent
> for that election and position, before any state is written. Off the ledger,
> the independent verifier recomputes uniqueness across the whole public record
> and reports it as the `nullifier.unique` finding. The property is therefore a
> chaincode gate and a verifier check, not a data-preparation check.

This is a strengthening, not a weakening: the gate performs seven checks where
the paper claims four, and the double-vote property is enforced where an
adversary would actually attack it rather than on data the adversary never sees.

---

## 5. Table 3.5 — the evaluation matrix, as executed

**Answers C3, C7, C11.**

Table 3.5 currently presents single-position and multi-position evaluation at
every tier as though all cells were populated. They are not, and the table must
distinguish three states: executed with a repetition count, not reached, and
not evaluated on-chain.

**Amendment.** Every executed cell carries its measured repetition count, drawn
from `summary.csv`'s `runs_measured` for that configuration. Every unreached
cell reads **"not evaluated"** and carries the reason recorded by the
instrument, not a reason supplied by the author. The reasons available are:

- the run-level failure reason from the `run.end` journal event's `reason` field
  (`runFailed` in `saksi/packages/saksi-campaign/journal.go`, surfaced as
  `perf.csv`'s `fail_reason` column), for a tier that was attempted and did not
  complete;
- a preflight refusal, for a tier the console would not start. Saksi #49 (merge
  `25d523f`) removed the fixed offline voter cap (`OfflineVoterCeiling`) and
  replaced it with resource guards, so at `4a38a54` the blocking refusals in
  `saksi/packages/saksi-campaign/preflight.go` are:
  - `ladder_missing` (:375), for a tier above the ladder's ceiling when the
    validation ladder has not been run for the current build — error text
    "validation ladder has not been run for this build; run tools/ladder.sh
    first" (`server.go:1210`);
  - `disk_short` (:393), when the projected ledger (on-chain) or run store
    (offline) exceeds the free space of its volume, with the projected and
    available byte counts in the message;
  - `memory_short` (:406), when the auditor's projected memory exceeds what is
    available;
  - `phase_timeout_short` (:439), when the longest phase is estimated to
    exceed the console's phase timeout (`--phase-timeout`, env
    `SAKSI_PHASE_TIMEOUT`), so the run would be cancelled part-way;
  - and the operational refusals `fabric_not_configured`, `fabric_unreachable`
    (the only forceable one), `run_busy` and `verify_threads_invalid`.

  `OfflineRecordCeiling` (`config.go:28`, 3,524,078 × 3 records) remains as a
  sanity bound on a configuration no study row asks for; it is not a resource
  guard and refused no study tier.

The ladder itself answers C7 and, in doing so, C9's system-test tier:
`tools/ladder.sh` runs the complete protocol offline at 1, 10, 100 and 1,000
voters, asserts `E = 0` on every contest and a passing gate at each step, and
writes `ladder.json` recording the commit it validated. Larger tiers in
`offline` and `onchain` mode refuse to start unless a `ladder.json` matching the
current build exists; `groundtruth` mode is exempt, since it runs no
cryptography. The manuscript's claim that the protocol is validated end to end
at the four small tiers before any larger tier is therefore enforced by the
instrument rather than asserted by the author.

Fill the table as (measured repetitions; warm-ups in Chapter IV Table 4.2):

| Tier | Single-position reps | Multi-position reps | Note |
|---|---|---|---|
| 1,000 | 10 on-chain (desktop) | 10 on-chain (desktop); 10 on-chain (AX42) | |
| 10,000 | 10 on-chain (desktop) | 10 on-chain (desktop); 10 on-chain (AX42) | |
| 50,000 | 5 on-chain (desktop) | 5 on-chain (desktop); 5 on-chain (AX42) | the [18] comparison tier |
| 483,000 | 3 on-chain (desktop), plus a 5-step rate sweep and a burst | 3 on-chain (AX42); 3 on-chain (desktop, optional); 1 offline (desktop) | |
| 1,000,000 | 3 on-chain (desktop) | 3 on-chain (AX42); 1 offline (desktop) | |
| 1,921,917 | 3 on-chain (desktop; m1 resumed after a power loss, correctness record only) | 3 on-chain (AX42); 1 offline (desktop) | capstone |
| 3,524,078 | 3 on-chain (desktop) | 3 on-chain (AX42); 1 offline (desktop) | capstone |

No cell is "not evaluated": every tier on both axes ran, and no tier was refused
by the console. The multi-position on-chain tiers from 483,000 voters up ran on
the AX42 because the desktop's measured host-disk cost per record (95 to 119 KB,
Chapter IV Table 4.26) exceeded its drive for MP-3.5M; Table 3.5's "stretch goal"
and "capstone attempt" labels become "evaluated". Table 3.5 should also say which
machine ran each cell (§14). Source: Chapter IV Tables 4.2, 4.22 and 4.26.

---

## 6. Table 3.11 — the signed final tally

**Answers C32 (CONTRADICTED) and C34 (PARTIAL).**

Table 3.11 lists a signed final tally among the items committed to the bulletin
board. At the time of the audit no tally signature existed anywhere — not on the
wire, not on-chain, not in the trustee application — so the row was false.

**The row is now true, and the manuscript should describe the mechanism as
follows.** Each trustee signs the tally with a
Schnorr proof over ristretto255 whose base is the group generator, whose
statement is the trustee's public share, and whose witness is the trustee's
secret share. The signing context binds the domain
separator `saksi.tally.sig.v1`, the election id, and the totals as
little-endian unsigned 64-bit integers. The signatures travel on the wire as
`repeated TrusteeSignature signatures` on `TallyResult`. Verification keys are
not transmitted: they are derived
from the DKG transcript's coefficient commitments by evaluating every trustee's
commitment polynomial at the signer's index and summing, so a signature is
verifiable by anyone holding the public record — in Rust and, byte-identically,
in the chaincode.

Verification then happens in two places. On-chain, the chaincode's
`PublishTally` rejects a tally whose signatures do not verify, whose trustee ids
are duplicated or unknown, or whose count of valid signatures is below the
election's threshold, using the `sigverify` package's `DeriveVerificationKey`
and `VerifySchnorr` against a
golden vector shared byte-for-byte with the Rust implementation,
`saksi/packages/saksi-protocol/test-vectors/tally-sig-v1.hex`. Off-chain, the
independent
verifier reports the `tally.signatures` finding, which is strict: an unsigned
tally is a FAIL, not a pass with a warning. Runs recorded before this mechanism
existed are labelled "unsigned (legacy)" in the audit trail rather than silently
accepted.

**How many signatures the published tally carries depends on which path
published it.** The plain submit path — the no-ceremony harness run, where the
console forwards the generated bundle straight to the ledger — publishes the
generator's full n-of-n signature set. The trustee-ceremony path publishes only
the signatures of the trustees that actually submitted in that ceremony
(`tallyToPublish`, `saksi/packages/saksi-campaign/ceremony.go`), because the
chaincode counts these signatures against the threshold and a 5-of-5
endorsement must not be recorded for a ceremony two trustees took part in. Both
sets are signatures over the same totals; only the number of signers on the
published record differs, and the manuscript should say which path produced the
run it reports.

**Limitation that must be stated in the same paragraph.** The decryption
ceremony is *simulated*. All trustee partial decryptions and all tally
signatures are produced by the generator inside a single
process and are forwarded to the ledger by the console; there is no multi-party
ceremony across separate machines or separate custody boundaries. The
cryptography is real: real Chaum-Pedersen proofs, real Schnorr signatures and
real threshold recombination. What is not exercised by these experiments is the
trust separation between trustees.
This is the same trust model as the existing partial-decryption path and should
be read as an evaluation-harness limitation, not a protocol claim.

**Second limitation, on partial decryptions. This one is true of the code
today.** The chaincode validates that a submitted partial decryption *carries* a
Chaum-Pedersen proof — the check is `partial.GetProof() == nil` in
`SubmitPartialDecryption`,
`saksi/packages/saksi-bulletin/chaincode/contract.go` — and does not verify that
proof at endorsement. Proof verification is the verifier's, reported as the
`decryption.cp_proof` finding. The split should therefore be stated precisely:
**tally signatures are verified on chain; partial-decryption proofs are
validated for shape on chain and verified cryptographically off chain.**

**Demonstrated on the study build (added 2026-10-08).** In the AX42 security
pass a partial decryption with its Chaum-Pedersen response altered was
committed on-chain and then failed by the verifier at `decryption.cp_proof`
(A1), and a key-generation transcript with one coefficient commitment altered
was committed by `PublishDKGTranscript` (`contract.go:608`, shape and presence
checks only) and failed at `dkg.decode` (B4). Table 3.8 T6 and Table 3.9's
malicious-trustee row should read "committed, then detected by the verifier",
not "rejected". Evidence: `docs/desktop-runs/ax42-security/A1/`, `B4/`,
`STATUS.md:11-12` (`82997d4`); Chapter IV Tables 4.6 and 4.7a. These supersede
the 2026-09-15 trial on saksi branch `feat/sample-chains` (`7272837`).

**What the on-chain tally check does and does not cover.** `PublishTally`
refused a tally with 2 of 5 signatures (A2, `threshold is 3`) and a tally with
one total changed and its signatures kept (A3, `tally signature from trustee
"1" does not verify`). It does not compare the totals with the aggregate: a
wrong total that the trustees sign correctly would be accepted on-chain and
caught only by the verifier's `tally.accuracy`. That case needs the trustee keys
and was not mounted. Evidence: `ax42-security/A2/`, `A3/`, `STATUS.md:13-14`.

---

## 7. Measure-first note on the throughput planning figure

**Answers C15, and the audit's observation that no scaling comparison exists.**

Any figure of the form "approximately 100 transactions per second" that appears
in the planning or feasibility discussion must be removed. It had no source: it
was a planning assumption carried forward, not a measurement of this system, and
it should never have been used to size the experiment schedule.

**Replace it with the measured value.** The first on-chain configuration
executed is SP-1K, and its measured `committed_tps` — committed ballots divided
by the timed submit window, from the `committed_tps` column of `perf.csv` — is
the throughput figure from which every later tier's cost is estimated. The
manuscript should state the number, the window it was measured over, and the
concurrency and send rate that produced it (`perf.csv` records
`driver_ceiling_tps` beside it precisely so a reader can tell whether the
harness or the network was the limit).

> SP-1K measured committed throughput: 893.9 tx/s (median of 10 measured
> repetitions, range 741.1 to 944.4; harness ceiling 862.5 tx/s; 128 ballot
> records in flight, no send-rate cap), on the study build `4a38a54`.

Source: Chapter IV Table 4.14 (`summary.csv` of `campaign-20260929-174641-11`,
branch `docs/ch4-study-2026-09-30`, `8739722`). Two notes belong beside it. The
pre-study figure of about 995 tx/s at the same concurrency (`CLAIMS.md`, earlier
revision) was measured on build `ef663d1` and is superseded: the study build is
9 to 28 % slower on the same tiers (Table 4.28). And the median sits above 0.8 x
the harness ceiling, which is the rule's `inconclusive` condition below: it is
a sustained rate for 128 records in flight, not a saturation figure. The
saturation figure is the SP-483K sweep's plateau, 610.9 tx/s (Table 4.16).

The same discipline governs the scaling-limit rule. `Finalise` in
`saksi/packages/saksi-campaign/journal.go` computes `arrival_tps = voters /
36000` and classifies a run's `scaling_limit` as `true`, `false`, or
`inconclusive`. The verdict is `inconclusive` whenever the run was not a single
uninterrupted window, or whenever committed throughput came within 20 % of the
harness's own ceiling — because in that case the driver, not Fabric, was the
constraint, and calling it a scaling limit of the system would be attributing a
harness artifact to the design. The manuscript should report the classification
verbatim, including `inconclusive` verdicts, rather than resolving them by
judgement.

**Arrival rate on multi-position elections (added 2026-10-08).** At `4a38a54`
the console's `arrival_tps` is voters / 36,000 for every election
(`journal.go:584`; `Positions` is passed in but not used), while committed TPS
counts ballot records, of which a three-position election has three per voter.
On a multi-position run the console's `scaling_limit` therefore compares records
per second with voters per second and understates the arrival rate threefold.
Chapter IV Table 4.24 computes arrival as voters × positions / 36,000, which is
the correct comparison; its source line should cite that formula, not
`run.end` `arrival_tps`, for the multi-position rows. The margins Chapter IV
reports are computed per record and stand; a multi-position `scaling_limit`
verdict read from `run.end` should not be quoted without this caveat.

---

## 8. Fallback text if Fabric does not come up on the desktop (deleted)

**Answered C10, C11, C16, C41 conditionally. Deleted 2026-10-08.**

Fabric came up. Every on-chain tier of Table 3.5 ran on-chain (§5), so, as this
section required, its fallback text is deleted rather than softened and the
on-chain columns are filled from the run journals (Chapter IV Tables 4.2, 4.3
and 4.14). Nothing from the fallback text enters the manuscript. The section
number is kept so that cross-references stay stable.

---

## 9. Caliper struck; where the performance figures come from

**Answers C17 (CONTRADICTED), C19, C20. Revised 2026-10-08.**

The manuscript states that metrics follow the Hyperledger Performance and
Scale Working Group white paper via Caliper, with latency reported as
percentiles rather than averages. No Caliper run exists in this study: every
performance figure in Chapter IV comes from the campaign console's own driver.
Caliper 0.6, the pinned version, would in any case have reported maximum,
minimum and average latency only, not the percentiles the manuscript promises.
By the researchers' decision of 29 September 2026, **Caliper is struck from the
manuscript**, and every mention is amended to cite the console's `perf.csv`
(one row per run) and `summary.csv` (statistics across measured repetitions).

**Replace the methodology sentence (§ Evaluation, p. 47)** with:

> Metric definitions follow the Hyperledger Performance and Scale Working Group
> white paper [23]: send rate, throughput measured as committed transactions per
> second, and transaction latency reported as percentiles rather than averages,
> together with success rate and resource consumption. They are measured by the
> study's own campaign console, which submits each ballot record through the
> Fabric gateway, records its submit-to-commit latency, and writes one `perf.csv`
> row per run and a `summary.csv` across the measured repetitions of each
> configuration. Percentiles (p50, p95, p99) are nearest-rank over the full
> per-ballot latency vector (`Summary` in
> `saksi/packages/saksi-bulletin/client-sdk/bench/metrics.go`); the raw
> durations are kept in `latencies.csv` so any reader can recompute them or apply
> another convention. Committed throughput is committed ballots divided by the
> timed submission window (`submit_window_ms`), and `driver_ceiling_tps` is
> recorded beside it so that a harness-limited run is identified (§7).

**Every other mention, and its replacement:**

| Place | Current text | Amended text |
|---|---|---|
| Table 3.4 (p. 44) | row "Hyperledger Caliper — Blockchain benchmarking" | delete the row; add "Campaign console (Go, part of Saksi) — election driver, load generator and instrument (`perf.csv`, `summary.csv`)" (with §14's other tool changes) |
| Table 3.6 (pp. 46-47), RQ2 latency and RQ3 throughput rows | Evidence "Caliper performance report" | "console `perf.csv` and `summary.csv`" |
| Table 3.7 (p. 48), Throughput | "Caliper-driven load at increasing send rates until saturation" | "console-driven load at increasing send rates until saturation (the console's rate sweep)" |
| Table 3.7 (p. 48), Performance log analysis | "Post-run analysis of Caliper reports, peer and orderer logs, and chaincode events" | "Post-run analysis of the console's run journal (`journal.ndjson`), `perf.csv` and `summary.csv`, and the peer and orderer logs" |
| Table 3.8 (p. 49), T1, T2, T8 evidence | "Recorded Caliper ..." | "Recorded console `perf.csv` / `summary.csv`" |
| Audit trail (p. 55) | "the Caliper benchmark reports used for performance log analysis" | "the console's run journals and performance exports used for performance log analysis" |
| Table 3.12 (p. 59), Toolchain versions | "Go, Rust, Flutter, Tauri, and Caliper versions recorded at execution" | see §14 |
| Appendix D (p. 71) | "Rust, Go, Flutter, Tauri, Hyperledger Fabric, and Hyperledger Caliper" | see §14 |

The related-work mention of Caliper (p. 21, reference [16] "with the Hyperledger
Caliper benchmarking tool") describes another study and stays.

The send-rate sweep and the peak-load burst are the console's: a sweep
multiplies the target send rate per step within a time-bounded window, sizing
each step's concurrency from the previous step's p99 so the closed-loop driver
is not itself the ceiling, and stops at the first step where committed
throughput falls or ballots drop; the plateau is the last good step. This backs
"increasing send rates until saturation" (C20) and the T8 peak-load case. As
executed: the SP-483K sweep's plateau was 610.9 TPS at an offered 1,024/s, and
the burst committed 144,900 ballots at 512.9 TPS with 0 dropped (Chapter IV
Table 4.16; `docs/desktop-runs/2026-10-01-sp-483k/sweep/summary.csv`,
`plateau_tps` 610.928, `f2d8921`).

---

## 10. Key generation in the evaluation harness

The Algorithms section's shared facts state that private keys and nonces are
uniformly random scalars from the operating system's CSPRNG. Until saksi #50
(merge `1812139`, 15 September 2026) that was not true of the harness's DKG: the
generator built every trustee's polynomial from fixed coefficients
(`dealer_id × 13 + k + 1`, in `gen_prologue` and `happy_path_fixture`,
`saksi/packages/saksi-auditor/src/fixtures.rs`), so the joint secret key of every
generated election could be derived from the public source. From that commit on,
every coefficient is drawn by `Dealer::random`
(`saksi/packages/saksi-crypto/src/dkg.rs`) from `OsRng`, and the shared-facts
sentence holds for the harness as written. The fixed polynomials that remain are
the golden test vector's (`tally-sig-v1.hex`) and saksi-crypto's unit tests,
whose keys are published test data by design.

What this changes for the evidence:

- Correctness, verifiability, integrity (attack) and performance results from
  runs before `1812139` stand. None of them depends on the election key being
  secret.
- A statement about ballot secrecy or unlinkability demonstrated on generated
  elections must cite runs generated at or after `1812139`. A run's generator
  commit is recorded as `git_head_saksi` in its `run.json` and in line 1 of its
  `journal.ndjson`.
- The fix does not remove the §6 limitation. The ceremony is still simulated:
  the generator process holds every trustee share, so the secrecy a harness run
  demonstrates is against everyone except that process.
- Every Chapter IV run is on `4a38a54`, a descendant of `1812139` (`run.json`
  `git_head_saksi`; Chapter IV header), so every one of them may be cited for
  secrecy and linkage claims, including the A7 linkage join (§12).

---

## 11. Issuer binding, the selection-sum proof, and the empty-position ballot

**Added 2026-10-08. Fixed in saksi #55 (merge `25a4fae`), part of the study
build `4a38a54`. Runs generated before `25a4fae` did not enforce any of the
three.**

Before saksi #55 three statements in the manuscript were not true of the code:

1. **Overvote.** The paper says the ballot proof shows the ballot holds "exactly
   one valid candidate" (Algorithm 3, p. 40), Table 3.11 says the proof "shows
   the ballot encodes one valid selection" (p. 56), and Algorithm 4 relies on
   the manifest's "selection limit" (p. 41). The CDS proof shows only that each
   ciphertext encrypts 0 or 1; nothing bound their sum, so a ballot record with
   two 1s passed every gate.
2. **Issuer binding.** The paper says the chaincode "independently verifies the
   credential" (p. 35), and Table 3.9 lists the credential gate against a forged
   identity (p. 54). The chaincode verified the credential's signature under the
   issuer key the ballot itself carried, so a self-issued credential passed. The
   2026-09-15 `sample-stuffing` trial committed one, and the verifier flagged it
   at `ballot.issuer_binding`.
3. **A second vote through an empty position.** A ballot record with an empty
   `position_id` was a legacy whole-ballot record whose nullifier did not collide
   with the per-position nullifiers, so a voter could vote a second time in one
   contest of a per-position election.

**What the study build does.** Saksi #55 adds three gates to `SubmitBallot`
(`saksi/packages/saksi-bulletin/chaincode/contract.go` at `4a38a54`):
- `issuer` (:175-177): the presentation's issuer key must equal
  `ElectionParameters.issuer_public_key`, which `CreateElection` stores and
  validates as a canonical ristretto255 point (:548-549); auditor checks
  `ballot.issuer_binding` and `parameters.issuer_binding`
  (`saksi-auditor/src/ballot.rs:93`);
- `selection` (:305-307): each ballot record carries a selection proof, a
  Chaum-Pedersen proof that the homomorphic sum of the position's ciphertexts
  encrypts exactly 1, bound to the election, position and nullifier; auditor
  check `ballot.selection_sum` (`ballot.rs:88`). No new primitive: the sum of
  the ciphertexts is (R·G, R·Y + m·G) with R the sum of the randomness, and
  proving m = 1 is one DLEQ proof;
- `shape` (:233-237): a record that names no position is refused on an election
  whose contests are per position; auditor check `ballot.shape`.

Unit tests: `TestSubmitBallotIssuerBinding` (`contract_test.go:261`),
`TestCreateElectionValidatesTheIssuerKey` (`:1320`),
`TestSubmitBallotSelectionProof` (`selection_test.go:143`),
`TestSubmitBallotRefusesAnEmptyPositionOnAPositionedElection` (`:192`).

**Demonstrated.** The `self-issued-credential` and `overvote` scenarios were
refused live at the `issuer` and `selection` gates in all four attack-timeline
runs: the desktop SP-10K and MP-1K security runs, and on the AX42 D1 (MP-10K)
and D1-L (MP-1M, mounted halfway through a 3,000,000-record window). The empty
position was not mounted (catalogue case 13: implemented, unit test only).
Evidence: Chapter IV Tables 4.7 and 4.8; `negative-tests.csv` of
`sp-10k-ch4-sec-20260929-183410-129`, `mp-1k-ch4-sec-20260930-185139-29`;
`docs/desktop-runs/ax42-security/D1/`, `D1-L/`, `STATUS.md:15,21-22`.

**Limit to state.** A legacy election created with an empty issuer key skips the
`issuer` and `selection` gates (`contract.go:105,114`). B3 created one and
committed a self-issued ballot on-chain; the verifier failed the record at
`parameters.issuer_binding` (`ax42-security/B3/`, `STATUS.md:9`). Every study
election had an issuer key.

**Amend the text:**
- p. 40, Algorithm 3: "shows that an encrypted ballot holds exactly one valid
  candidate" → "shows that each ciphertext encrypts 0 or 1, and a second
  Chaum-Pedersen proof over the sum of a position's ciphertexts shows that the
  position holds exactly one selection".
- p. 35: "the chaincode independently verifies the credential, the nullifier,
  and the proof" → "the chaincode verifies that the credential was issued under
  the election's registered issuer key, the nullifier's freshness, each
  ciphertext's validity proof, and the position's selection-sum proof".
- Table 3.9, external attacker, "Credential gate; membership" → "issuer gate
  (credential bound to the election's issuer key); membership service for
  identities outside the channel".
- Table 3.11, "Shows the ballot encodes one valid selection": true from
  `4a38a54`; add "(CDS per ciphertext and a selection-sum proof per position)".

Outside this file, the same correction is owed in saksi
`docs/wizard/4-encrypt.md`, the Defense Reviewer Part 5 row (2), and PR #63's
`body.html` ("checkable from the chain alone"); their state was not checked
here.

---

## 12. Security pass on the study build: what Chapter III must now say

**Added 2026-10-08.** The AX42 security pass (2026-10-07/08, saksi `4a38a54`)
mounted, against the chaincode through the Fabric gateway, the attacks the
console cannot express as one ballot submission. Evidence for every item:
`docs/desktop-runs/ax42-security/STATUS.md`, `security-ax42-track-N.md`,
`security-ax42-track-O.md` and the per-test folders (`82997d4`); Chapter IV Table
4.7a. Each item names the manuscript text it changes.

- **No caller authorization (B1).** See §4.1. Table 3.9's "membership" defense
  holds for identities outside the channel (B2) and not between members.
- **Shape-only checks on the transcript and the partials (B4, A1).** See §6.
  Table 3.9, malicious trustees, "Invalid proof detected" stands, but detection
  is by the verifier after commitment, not by the chaincode.
- **Tally publication (A2, A3).** See §6: threshold and signatures are enforced
  on-chain; totals are not compared with the aggregate on-chain.
- **Reordering (A5).** Table 3.9 (ledger administrator, "drop, reorder, or
  tamper ... Tampering detected by the verifier", p. 54) and Appendix C's
  protocol row ("Omission or reordering is ...", p. 70). Drops are detected by
  `stream.completeness`, and a one-byte edit of a published record by
  `ballot.cds_proof`, `tally.homomorphic_sum` and `tally.signatures` (A4).
  Reordering was not detected by the study build. Saksi #58 (merged `37035f9`,
  2026-10-08) adds the auditor check `ledger.order`
  (`saksi-auditor/src/ledger.rs:84`), which holds the chain's read-back to the
  ledger's canonical nullifier order and the published `ledger_digest`. A5
  re-verified all 47 AX42 multi-position on-chain runs with the PR head
  (`640a7b2`): every one passed `ledger.order`, and a dump with two records
  swapped failed with `ledger.order` alone (`A5/report.md`, `A5/verdicts.tsv`).
  Write: "a bulletin-board node that serves records reordered, dropped,
  duplicated or altered is detected by the verifier on runs verified with
  `37035f9` or later; Fabric's block order is not observable on this read path
  and is not checked; the `reordered-ballots` attack scenario, which reorders
  the console's own record, remains SKIPPED because that record is compared as
  a sorted set; the tally is an order-independent sum, so reordering cannot
  change it".
- **Transport (X2, D5).** Table 3.9, network adversary, "TLS transport": peer
  and orderer gRPC ran TLS 1.3 with certificates verifying against the channel
  TLS CAs (X2), and 4,512 captured peer packets held no readable election term.
  The campaign console served plain HTTP, and its requests and responses were
  readable (D5). Write "TLS on the Fabric network; the evaluation console is
  plain HTTP and must sit behind TLS termination in any deployment".
- **Replay and degraded network (D2, D4).** Ten committed ballots replayed after
  a peer restart were all refused (`gate=nullifier`); an MP-50K election under
  40 ms delay and 0.5 % loss completed with 0 ballots lost and E = 0, at 52.0
  TPS against about 820 clean. These fill Table 3.9's "Replay rejected" and T3.
- **One machine; Raft (D3).** p. 47 states that Raft provides crash fault
  tolerance, not Byzantine fault tolerance. Add that the evaluated network has
  one orderer and both organizations on one machine, so neither distributed
  trust nor orderer failover is demonstrated. D3 stopped the sole endorsing peer
  for 25.2 s and the orderer three times during one window; the run resumed with
  no reset, 150,000 of 150,000 reconciled, chain linked, E = 0: recovery by
  restart, not failover (`D3/evidence.txt`).
- **Second-machine verification (A6).** Closes RQ1(e): the SP-3.5M m3 public
  record, copied to the AX42 (input SHA-256 `49b89e62...` matching the desktop
  archive), audited there in 1,073 s with every contest identical. Same source
  commit, its own build: independence from the machine, not from the codebase.
- **Linkage (A7).** Table 3.6's unlinkability metric: a join of every
  voter-linked public field against the registration list over MP-3.5M m3
  (N = 3,524,078, 10,572,234 ballots) found 0 linkage hits and 0 nullifier
  collisions (bound 1/N = 2.84 x 10^-7; `A7/a7-result.json`). A voter's three
  position-ballots share a credential commitment and are linkable to each other
  under a pseudonym; timing linkage was not analysed.
- **Deployment findings (X1, X3).** On the rented server, Fabric's orderer, peer
  and operations ports were published on all interfaces with no host firewall
  (X1), and SSH accepted passwords for non-root accounts (X3). Both were fixed
  during the pass (`fabric-firewall.service`; `passwordauthentication no`;
  `X1-rescan/nmap-v4-targeted.txt`, `STATUS.md:23-24`), and an SSH bot flood was
  mitigated though not stopped (`SSH-flood/ssh-flood-evidence.txt`). These are
  findings about how the test network was deployed, not about the protocol;
  Chapter III's ethical commitments (attacks only inside the researchers'
  controlled environment, p. 59) should note that the second environment was
  internet-facing and was hardened during the study.
- **Sub-threshold refusal in the console.** Saksi #57 (merged `83c78bd`,
  2026-10-08, after the study build) shows the server refusing a 2-of-5
  decryption in the wizard (`TestPublishAtTwoOfFiveIsRefusedWithReason`). On the
  study build the refusal is demonstrated at the chaincode (A2).
- **Instrument bug, not a limitation.** The ceremony-status view reported only
  the first contest; fixed in saksi #54 (`c42f24f`). One line under the
  instrument findings.

---

## 13. The simulated ceremony, extended to registration and voting

**Added 2026-10-08. Extends §6 and §10.**

In the evaluation harness one generator process (`saksi-demo`) produces every
trustee share, every partial decryption and tally signature, and also acts as the
registrar and as every voter: it issues each blind-signed credential and builds
each ballot. Blind issuance is implemented, but it is never exercised across two
parties. Qualify:
- p. 41, "the registrar never learns the value that will later identify the
  ballot" → add "In the evaluation, registrar and voters are simulated by one
  process, so this property is implemented, not demonstrated".
- Definition of Terms, "Trustee" (p. 15), "one of the five independent parties
  ... any three may jointly decrypt" → "one of five trustee shares (threshold
  three); in the evaluation all five shares are held by one process".

Evidence: Chapter IV, Privacy (limits) and Election Return Approval; §6; the
election parameters of Table 4.1 (5 trustees, threshold 3).

---

## 14. Figures, tables and tool lists that no longer match the system; the second environment

**Added 2026-10-08.** Chapter III describes a Flutter voter app and a Tauri
trustee app as the clients, and one desktop as the environment. The study ran
otherwise: the saksi campaign console (Go, `saksi/packages/saksi-campaign`) drove
every election from its `/wizard`, generated ballots with `saksi-demo`, and served
the admin, trustee and public bulletin-board apps as React browser apps
(`docs/updates/2026-09-10-dynamic-board-and-trustee.md`;
`docs/updates/2026-09-15-state-and-next-steps.md`); and the multi-position
on-chain tiers and the security pass ran on a second machine (Chapter IV Table
4.1). No study run used the Flutter voter app or a Tauri shell.

- **Figure 3.3 (p. 36), workflow.** "The voter application encrypts ... three
  gates ... aggregated" → the generator builds credentials, ciphertexts, CDS
  proofs and selection proofs; the console submits each ballot record; the
  chaincode's named gates refuse invalid records (`decode`, `issuer`, credential
  signature, `shape`, `nullifier`, `cds`, `selection`; `SubmitBallot`, `contract.go:104-307`);
  the verifier aggregates and checks the decryption (§3).
- **Figure 3.4 (pp. 42-43), architecture, and the paragraph after it.** Replace
  the voter and trustee applications with the campaign console and its browser
  apps (admin, trustee, public board), and draw the verifier, not the chaincode,
  as the aggregator (§3). The Flutter voter app and the Tauri shells remain in
  the repository as demonstration clients, not as the evaluated path.
- **Table 3.3 (pp. 43-44).** Rows "Voter app (Flutter)" and "Trustee app
  (Tauri)" → "Campaign console (Go): election lifecycle, ballot submission,
  ceremony, attack timeline, instrument" and "Browser apps (React): admin,
  trustee ceremony, public bulletin board"; chaincode row per §3.
- **Table 3.4 (p. 44).** Delete "Flutter / Dart", "Tauri" and "Hyperledger
  Caliper" (§9); add "React / TypeScript — browser apps", "WSL2 (Ubuntu) and
  Docker Desktop — the desktop's Fabric host", "Docker Engine — the AX42's Fabric
  host", "Python — run controller, resource sampler and cost model
  (`docs/desktop-runs/tools/controller.py`, `cost-model.md`)". All free.
- **Table 3.5 (p. 45).** Filled per §5, with the machine per cell.
- **Table 3.12 (pp. 58-59).** Fill every "recorded at execution" field from
  Chapter IV Table 4.1 and add the AX42 column (Ryzen 7 PRO 8700GE, 64 GB, 2 x
  NVMe RAID0, Ubuntu 24.04 native, Docker Engine 29.8.2, same Fabric images and
  orderer parameters). Name the desktop's WSL2 + Docker Desktop layer (24 GB of
  the 32 GB allotted, swap off). "Toolchain versions: Go, Rust, Flutter, Tauri,
  and Caliper" → "Saksi and console at commit `4a38a54`; Go, Rust (pinned
  1.98.1), Node/pnpm for the browser apps". Replace the storage projection
  "approximately 30 to 50 GB of ledger per million single-position ballots, with
  150 GB provisioned for the full-ZAMBASULTA multi-position run" with the
  measured "11.8 to 12.0 KB per ballot record per peer copy (about 12 GB per
  million per copy, 33.4 to 34.2 GB across the three copies); the full
  multi-position run occupied 353.5 GB" (Chapter IV Tables 4.21 and 4.26).
- **Appendix A data specification (p. 62), "Randomness and seed".**
  "Deterministic pseudorandom generation with a recorded seed" → "Selections are
  a deterministic integer function of the voter count, positions, candidates and
  profile, with no seed (§1); keys and nonces are drawn from the operating
  system's CSPRNG (§10)".
- **Appendix B (screens).** Redo from the current apps, built to `DESIGN.md`
  (balotachain #65, `d2161f8`).
- **Appendix D (p. 71), budget.** The software list "Rust, Go, Flutter, Tauri,
  Hyperledger Fabric, and Hyperledger Caliper" → "Rust, Go, TypeScript/React,
  Hyperledger Fabric, Docker and Python". "Cloud services and hosting, PHP 0, as
  all benchmarking is executed locally" is no longer true: the AX42 was rented
  from 2026-10-04 (`docs/desktop-runs/2026-10-04-ax42-setup.md`). Replace with
  the rental's actual amount: `TODO(fill from the AX42 invoice)`.

---

## Cross-reference: audit ids answered here

| Audit id | Section |
|---|---|
| C3, C7, C11 | §5 |
| C4 | §4.2 |
| C10, C16, C41 | §8 (deleted: Fabric came up; answered by the on-chain runs, §5) |
| C15, C38 | §7 |
| C17, C19, C20 | §9 |
| C18, C35, C39 | §2.1 |
| C32, C34 | §6 |
| C36 | §2.1 |
| C37 | §2.2, §2.3 |
| C44 | §1 |
| C45 | §2.3 |
| T5 | §4.1 |
| T6 | §6 |
| T8 | §9 |
| §2 item 4 (precinct fold) | §3 |
| Algorithms shared facts (CSPRNG keys) | §10 |
| Overvote, issuer binding, empty-position ballot (saksi #55) | §11 |
| Table 3.9 rows; RQ1(e); linkage; deployment findings | §12 |
| Simulated registration and ceremony | §6, §13 |
| Figures 3.3, 3.4; Tables 3.3, 3.4, 3.12; Appendices A (seed), B, D | §14 |
| Caliper mentions (Tables 3.4, 3.6, 3.7, 3.8, 3.12; p. 47; p. 55; App. D) | §9 |
