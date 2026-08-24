# Prompt — update Appendix A to match the implemented generator

Paste everything below the line into whatever you use to edit the manuscript
(a fresh Claude session with the .docx attached, or hand it to a co-author).
The replacement table content itself lives in
`docs/appendix-a-replacement-draft.md` in this repo.

---

I need you to update **Appendix A: Data Collection** in my thesis manuscript
(`BalotaChain on the Saksi Framework: End-to-End Verifiable Elections on
Permissioned Blockchain Using Synthetic Election Data`). The synthetic-data
generator has now been implemented, and the appendix describes it inaccurately
in four specific ways. I need the appendix corrected to match what the software
actually produces, without weakening any claim the manuscript makes elsewhere.

## Background you need

The manuscript's own methodology (Figure 3.1, DSRM process model) splits the
pipeline into **Stage 4 — Synthetic Data Generation** (seed the population and
its known vote-to-candidate ground-truth counts, then pass a data-validation
gate) and **Stage 5 — Demonstration** (run the encrypted election end to end).
Appendix A documents the Stage-4 output.

The implemented generator now exports that output as two CSV files on every
run. It has been verified at the full ZAMBASULTA capstone tier (3,524,078
voters × 3 positions, generated in under a second), and — importantly — the
plaintext counts it writes have been confirmed byte-identical to what the real
cryptographic pipeline independently recovers through threshold decryption
(E = 0 on every contest). So the appendix is now documenting a real, running
artifact, not a proposed one.

## Change 1 — split the sample-records table into two tables

Appendix A currently has a single table, `Sample synthetic voter records
(multi-position configuration)`, mixing plaintext selections with
`anonymous_credential` and `nullifier` values.

Those two field groups are produced at **different pipeline stages**. The
plaintext selections exist before any cryptography runs; credentials and
nullifiers are created during simulated registration, inside Stage 5. Showing
them in one table implies they are generated together, which contradicts
Figure 3.1.

Replace it with two clearly-labelled tables:

- **A.1 Synthetic ground-truth input (generated before encryption)** — the
  Stage-4 artifact. This is the transparency exhibit: a reader can inspect the
  entire input population before trusting anything downstream.
- **A.2 Synthetic voter record after simulated registration** — the Stage-5
  record, retaining `credential` and `nullifier`.

This keeps every one of Table 3.2's eight fields illustrated by example, which
a single Stage-4-only table would not.

## Change 2 — Table A.1 must be WIDE (one row per voter)

The current sample is long format: one row per voter-position pair, so voter
V-000001 occupies three consecutive rows for President, Vice President, and
Senator.

The generator writes wide format: **one row per voter, one column per
position**. Every voter casts a selection in every position (the generator
models no abstention), so the wide form carries identical information while
letting a reader see a complete ballot on one line.

Actual header and first rows:

```
voter_id,scale_group,ballot_complexity,PRESIDENT,VICE_PRESIDENT,SENATOR
V-000001,3524078,multi,CAND_PRES_01,CAND_VICE_01,CAND_SEN_01
V-000002,3524078,multi,CAND_PRES_02,CAND_VICE_03,CAND_SEN_04
```

In the single-position configuration the table has one selection column,
`PRESIDENT`, and `ballot_complexity` reads `single`.

Table A.2 stays long, since credentials and nullifiers genuinely are
per-position artifacts.

## Change 3 — candidate labels are now `CAND_PRES_01`, not `CAND_P_02`

The appendix uses single-letter prefixes (`CAND_P_02`, `CAND_V_01`,
`CAND_S_03`). The generator emits readable prefixes: `CAND_PRES_NN`,
`CAND_VICE_NN`, `CAND_SEN_NN`. Update every occurrence, including the
`Sample seeded ground truth` table at the end of the appendix.

## Change 4 — the reproducibility claim is factually wrong and must be corrected

The `Generation parameters` table currently states:

> Randomness and seed — Deterministic pseudorandom generation with a recorded
> seed for reproducible populations

**There is no seed.** The generator does not draw selections from a seeded
PRNG. Each selection is derived arithmetically from the voter index, position
index, candidate count, and distribution profile — a pure function with no
random state at all.

This is a *stronger* reproducibility guarantee than a stored seed, and should
be stated as such: reproducing a population requires only the four generation
parameters, which the table already records, and there is no seed value that
could be lost, mistranscribed, or fail to reproduce. Reword the row to say
that. Do not simply delete it — reproducibility is a real property here and
deserves an accurate claim rather than none.

If for any reason you prefer to keep the existing phrasing, the words
"with a recorded seed" must still go, because no seed is recorded.

## Also update, in the same pass

- The `Election scales (voters)` row: the two largest tiers are now labelled
  **capstone**, not conditional, matching the revised Scope and Limitations,
  Table 3.1, Table 3.2, and Table 3.5.
- Field-name consistency: Table 3.2 (Chapter III) names the fields `selection`
  and `credential`, while the current Appendix A headers read
  `candidate_selection` and `anonymous_credential`. Standardise on Table 3.2's
  names so the chapter and the appendix agree.

## Constraints

- Do not change any claim in Chapters I–III. This is an appendix correction to
  match implemented behaviour, not a scope or methodology change.
- Keep the manuscript's existing table styling, caption format, and the
  italicised explanatory notes beneath each table.
- Preserve the existing `Sample seeded ground truth (single-position,
  500-voter sample)` table and its note — only the candidate labels inside it
  change.
- The two CSV filenames, if you mention them, are `ground-truth-ballots.csv`
  and `ground-truth-summary.csv`.

Ready-to-use replacement text for all of the above is in
`docs/appendix-a-replacement-draft.md`. Apply it, then show me the final
Appendix A so I can check it before it goes into the document.
