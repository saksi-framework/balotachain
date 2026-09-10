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

File paths below are given without line numbers, because the files named are
still under active change on the `instrument-gap` branch.

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
only. (Driver lands with Task 9; the failure predicate and the journal tagging
it reads are already on the branch.) Failed runs are excluded from every throughput and latency statistic and
are reported instead as a failure rate; a run is failed when the predicate
`runFailed` in `saksi/packages/saksi-campaign/journal.go` fires — a stage error,
any dropped ballot, a reconcile mismatch, a non-zero `E` on any contest, or an
interruption — and its reason string is recorded in the `run.end` journal event
(`reason`) and in `perf.csv` (`fail_reason`).

The manuscript should therefore report the counts **as executed**, not as
planned. Insert this table and fill it from `summary.csv`:

| Configuration | Warm-ups discarded | Measured repetitions | Runs failed | Failure rate |
|---|---|---|---|---|
| SP-1K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| MP-1K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| SP-10K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| MP-10K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| SP-50K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| MP-50K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| SP-483K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| MP-483K | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| SP-1M | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| MP-1M | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| SP-1.92M | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| MP-1.92M | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| SP-3.5M | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |
| MP-3.5M | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) | TODO(fill from summary.csv) |

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
- the ladder gate's refusal, for a tier that was never started because the
  validation ladder had not been run for the current build — error text
  "validation ladder has not been run for this build; run tools/ladder.sh
  first" (lands with Task 9);
- the disk guard's refusal, for an on-chain tier whose projected ledger size
  exceeded free space on the peer volume, with the projected and available byte
  counts in the message (lands with Task 9);
- the offline ceiling, for a cryptographic-path tier above the offline cap —
  `OfflineVoterCeiling` in `saksi/packages/saksi-campaign/config.go`.

The ladder itself answers C7 and, in doing so, C9's system-test tier:
`tools/ladder.sh` runs the complete protocol offline at 1, 10, 100 and 1,000
voters, asserts `E = 0` on every contest and a passing gate at each step, and
writes `ladder.json` recording the commit it validated. Larger tiers in
`offline` and `onchain` mode refuse to start unless a `ladder.json` matching the
current build exists; `groundtruth` mode is exempt, since it runs no
cryptography. The manuscript's claim that the protocol is validated end to end
at the four small tiers before any larger tier is therefore enforced by the
instrument rather than asserted by the author.

Fill the table as:

| Tier | Single-position reps | Multi-position reps | Note |
|---|---|---|---|
| 1,000 | TODO(fill from summary.csv) | TODO(fill from summary.csv) | |
| 10,000 | TODO(fill from summary.csv) | TODO(fill from summary.csv) | |
| 50,000 | TODO(fill from summary.csv) | TODO(fill from summary.csv) | the [18] comparison tier |
| 483,000 | TODO(fill from summary.csv) | TODO(fill from summary.csv) | |
| 1,000,000 | TODO(fill from summary.csv) | TODO(fill from summary.csv) | |
| 1,921,917 | TODO(fill from summary.csv) | TODO(fill from summary.csv) | capstone |
| 3,524,078 | TODO(fill from summary.csv) | TODO(fill from summary.csv) | capstone |

A cell that stays empty after the runs is written "not evaluated (`<reason>`)"
with the reason string quoted verbatim from the journal.

---

## 6. Table 3.11 — the signed final tally

**Answers C32 (CONTRADICTED) and C34 (PARTIAL).**

> **Status: the signed-tally mechanism is scheduled in this cycle; strip the
> markers once Tasks 10 and 11 merge.** Every sentence below that describes it
> carries a sentence-level marker naming the task that delivers it. Nothing in
> this section describing tally signatures is true of the code as it stands
> today; the only unmarked statements are the two that are.

Table 3.11 lists a signed final tally among the items committed to the bulletin
board. At the time of the audit no tally signature existed anywhere — not on the
wire, not on-chain, not in the trustee application — so the row was false. It is
still false as this amendment is written.

**The row becomes true once Tasks 10 and 11 merge, and the manuscript should
then describe the mechanism as follows.** Each trustee signs the tally with a
Schnorr proof over ristretto255 whose base is the group generator, whose
statement is the trustee's public share, and whose witness is the trustee's
secret share *(lands with Task 10)*. The signing context binds the domain
separator `saksi.tally.sig.v1`, the election id, and the totals as
little-endian unsigned 64-bit integers *(lands with Task 10)*. The signatures
travel on the wire as `repeated TrusteeSignature signatures` on `TallyResult`
*(lands with Task 10)*. Verification keys are not transmitted: they are derived
from the DKG transcript's coefficient commitments by evaluating every trustee's
commitment polynomial at the signer's index and summing, so a signature is
verifiable by anyone holding the public record *(key derivation lands with
Task 10 in Rust and with Task 11 in the chaincode)*.

Verification then happens in two places. On-chain, the chaincode's
`PublishTally` rejects a tally whose signatures do not verify, whose trustee ids
are duplicated or unknown, or whose count of valid signatures is below the
election's threshold *(lands with Task 11)*, using the `sigverify` package's
`DeriveVerificationKey` and `VerifySchnorr` *(lands with Task 11)* against a
golden vector shared byte-for-byte with the Rust implementation,
`saksi/packages/saksi-protocol/test-vectors/tally-sig-v1.hex` *(the vector is
written by Task 10 and consumed by Task 11)*. Off-chain, the independent
verifier reports the `tally.signatures` finding, which is strict: an unsigned
tally is a FAIL, not a pass with a warning *(the `tally.signatures` finding
lands with Task 10)*. Runs recorded before this mechanism existed are labelled
"unsigned (legacy)" in the audit trail rather than silently accepted *(lands
with Task 11)*.

*Status marker, to be resolved before submission.* Task 10 (wire field, Rust
signing, golden vector, `tally.signatures` finding) is in flight on a parallel
branch; Task 11 (chaincode `sigverify`, `PublishTally` gate, trail label) is
pending. Until Task 11 lands, the t-of-n threshold is enforced by the console
alone and the manuscript must say so; once it lands, signature verification and
the t-of-n count are chaincode-enforced.
`TODO(confirm Tasks 10 and 11 landed before submission and strip the markers;
if the pre-agreed fallback was taken, state that the chaincode enforces shape
and distinct-signer count only and that full signature verification is the
auditor's.)`

**Limitation that must be stated in the same paragraph.** The decryption
ceremony is *simulated*. All trustee partial decryptions — and, once Task 10
lands, all tally signatures — are produced by the generator inside a single
process and are forwarded to the ledger by the console; there is no multi-party
ceremony across separate machines or separate custody boundaries. The
cryptography is real: real Chaum-Pedersen proofs today, and real Schnorr
signatures and real threshold recombination once the tasks above merge. What is
not exercised by these experiments is the trust separation between trustees.
This is the same trust model as the existing partial-decryption path and should
be read as an evaluation-harness limitation, not a protocol claim.

**Second limitation, on partial decryptions. This one is true of the code
today.** The chaincode validates that a submitted partial decryption *carries* a
Chaum-Pedersen proof — the check is `partial.GetProof() == nil` in
`SubmitPartialDecryption`,
`saksi/packages/saksi-bulletin/chaincode/contract.go` — and does not verify that
proof at endorsement. Proof verification is the verifier's, reported as the
`decryption.cp_proof` finding. With Task 11 landed the split becomes precise and
should then be stated precisely: **tally signatures are verified on chain;
partial-decryption proofs are validated for shape on chain and verified
cryptographically off chain.** Until then, nothing about the tally is verified
on chain at all.

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

> SP-1K measured committed throughput: `TODO(fill from summary.csv)` tx/s
> (median of `TODO(fill from summary.csv)` measured repetitions; harness ceiling
> `TODO(fill from summary.csv)` tx/s).

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

---

## 8. Fallback text if Fabric does not come up on the desktop

**Answers C10, C11, C16, C41 conditionally.**

The on-chain path has never executed in this project's history. If the Fabric
network cannot be brought up on the evaluation desktop, the following text
stands in place of the on-chain results, and no result is reported that was not
obtained.

> **Execution environment for the reported results.** The Hyperledger Fabric
> network could not be brought up on the evaluation host. All tiers were
> therefore executed in offline mode, in which the complete cryptographic path
> runs — credential issuance, ElGamal encryption, CDS proof generation and
> verification, homomorphic aggregation, threshold partial decryption,
> Lagrange recombination and bounded discrete-log tally recovery — but no
> transaction is submitted to a ledger.
>
> Consequently: RQ1 accuracy results (`E = 0` at every executed tier) are
> reported in full, since accuracy is a property of the cryptographic path and
> not of the ledger. RQ3 reports the offline stage timers only — the four
> in-process auditor timers and the generator's CPU sums described in §2.2 —
> and reports no committed throughput, no submit-to-commit latency
> distribution, and no peer or orderer resource figures. Every on-chain column
> of Table 3.5, Table 3.7 and Appendix C is marked **"not evaluated on-chain
> (network unavailable)"** rather than left blank or filled with an offline
> proxy.
>
> Scenario results are marked with their layer. Scenarios that mutate an
> offline copy of the record and re-audit it are reported as simulated;
> `negative-tests.csv` carries `on_chain=false` for each. The one
> chaincode-layer scenario, ballot reordering, reports SKIPPED offline, since
> ordering is a ledger property that the stateless verifier does not observe.
> The ledger-integrity check (append-only chain walk, `VerifyChain` in
> `saksi/packages/saksi-bulletin/client-sdk/ledger.go`) reports **"not run"**;
> it never reports PASS by default.

If Fabric does come up, this section is deleted rather than softened, and the
on-chain columns are filled from the run journals.

---

## 9. Caliper's role, and where percentiles come from

**Answers C17 (CONTRADICTED), C19, C20.**

The manuscript states that metrics follow the Hyperledger Performance and
Scale Working Group white paper via Caliper, with latency reported as
percentiles rather than averages. Caliper 0.6, the pinned version, reports
maximum, minimum and average latency in its default report — not percentiles.
As configured, the tool the manuscript names as the source of percentiles would
have reported exactly the averages the manuscript says it does not use. The
repository's own Caliper README asserted the opposite and has been corrected.

**Amendment.** State the division of labour explicitly:

> Caliper is used as an independent cross-check of committed throughput and
> transaction success rate against the project's own driver. Caliper 0.6
> reports maximum, minimum and average latency only; it does not compute
> latency percentiles. The percentile figures reported in this work
> (p50, p95, p99) are computed by the project's Go benchmark driver from
> per-transaction submit-to-commit durations, using nearest-rank percentiles
> over the full latency vector — `Summary` in
> `saksi/packages/saksi-bulletin/client-sdk/bench/metrics.go`, with the raw
> per-ballot durations preserved in `latencies.csv` so any reader can recompute
> them or apply a different percentile convention. Where per-transaction
> latencies are recoverable from Caliper's transaction-update log, a report
> post-processor computes the same percentiles from Caliper's own data as a
> second cross-check; where they are not, the report prints Caliper's
> max/min/avg and the line "percentiles: unavailable (Caliper reports
> max/min/avg only)" rather than silently substituting an average.

The same paragraph should note that the send-rate sweep and the peak-load burst
are driven by the project's own driver, not by Caliper: a sweep multiplies the
target send rate per step within a time-bounded window, sizing each step's
concurrency from the previous step's p99 so the closed-loop driver is not itself
the ceiling, and stopping at the first step where committed throughput falls or
ballots drop. The plateau is the last good step (lands with Task 9). This is
what backs the manuscript's "increasing send rates until saturation" (C20) and
the T8 peak-load case; Caliper's fixed-rate rounds do not.

---

## Cross-reference: audit ids answered here

| Audit id | Section |
|---|---|
| C3, C7, C11 | §5 |
| C4 | §4.2 |
| C10, C16, C41 (conditional) | §8 |
| C15, C38 | §7 |
| C17, C19, C20 | §9 |
| C18, C35, C39 | §2.1 |
| C32, C34 | §6 |
| C36 | §2.1 |
| C37 | §2.2, §2.3 |
| C44 | §1 |
| C45 | §2.3 |
| T5 | §4.1 |
| T8 | §9 |
| §2 item 4 (precinct fold) | §3 |
