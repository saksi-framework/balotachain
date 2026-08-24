# Saksi documentation (mirrored)

Documentation for the Saksi framework, copied here so the thesis repo carries
everything a reader needs without following a second repository.

> **Canonical source:** these files live in the `saksi` repo under `docs/`.
> Edit them there and re-copy; edits made here will be overwritten and will not
> reach the code they describe.

| File | What it covers |
|---|---|
| [`synthetic-data-generation.md`](synthetic-data-generation.md) | How the synthetic voter populations are produced — the selection rule, contest indexing, output schemas, the validation gate, and how to reproduce any tier. Backs **Appendix A**. |
| [`research-election-console-runbook.md`](research-election-console-runbook.md) | Building and running the Research Election Console. |

## Start here

If you want to understand how the evaluation data comes into existence, read
`synthetic-data-generation.md` top to bottom — it is ordered to be read that way.
The short version:

1. **Nothing is random.** Every voter's choice comes from one pure function of
   `(profile, voter_index, position_index, candidate_count)`. There is no seed.
   Restating the four generation parameters reproduces the population exactly.
2. **Two paths, one population.** `gen-ground-truth` writes only the plaintext
   tables and runs no cryptography — 3.5M voters in 0.6 seconds. `gen --stream`
   runs the real DKG, credentials, ElGamal encryption, and CDS proofs, and
   writes the same plaintext tables alongside. The two are byte-identical,
   verified by `diff`.
3. **Ground truth is derived separately from the ciphertexts.** It comes from an
   explicit record of what each voter chose, never accumulated as a side effect
   of the encryption loop. That separation is what gives `E = Σ|Tᵢ − Gᵢ| = 0`
   its meaning: if the crypto encrypted a different bit than the voter selected,
   the two would diverge instead of sharing the same wrong value.
4. **A gate stands between generation and encryption.** Methodology Figure 3.1
   calls for it; the console enforces it. The population is recounted from
   scratch and held against its own published tally before anything is
   encrypted, and a population that fails cannot proceed.
