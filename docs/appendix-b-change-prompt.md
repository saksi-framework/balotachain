# Prompt — fix the Appendix B mockup so it matches the implemented ballot model

Hand this over together with `docs/appendix-a-change-prompt.md`; both are
manuscript edits in the same pass.

---

I need one correction to **Appendix B: Software Design/Prototype** in my thesis
manuscript. The Public Bulletin Board mockup shows an election the implemented
system cannot produce, and a panelist comparing the screenshot against my
generated data would catch it.

## The contradiction

The Public Bulletin Board mockup currently shows a **Senator** race labelled
**"12 seats"** and **"Top 12 of 37 candidates elected"**, listing several
senators each marked `ELECTED`.

That is a **multi-winner** contest with a **per-position candidate count**. The
implemented generator supports neither:

- Every position is **single-winner** — a voter selects exactly one candidate.
- Every position has the **same** number of candidates, set by one parameter.

This is not an oversight in the generator. It is what the rest of the manuscript
already says. Appendix A's generation parameters read *"three positions:
President, Vice President, Senator, **single-winner each**"* and *"Fixed set of
K candidates"*. The mockup is the only place claiming otherwise.

Supporting a genuine 12-of-37 Senate race would require new cryptography, not a
configuration change: the ballot well-formedness proof (CDS) proves each
ciphertext encrypts zero or one, and the data-validation gate asserts that each
position's ground-truth total equals its ballot count. A twelve-winner contest
needs a proof that a voter's selections *sum to twelve*, plus a reworked gate
and auditor. That is out of scope for this study.

## The change

Rewrite the Senator column of the Public Bulletin Board mockup as a
**single-winner** race, consistent with President and Vice President:

- Remove the **"12 seats"** label; make it **1 seat**, as the other two are.
- Remove **"Top 12 of 37 candidates elected"** and the "Showing top 3 of 12
  elected senators · View full ranking →" affordance.
- Show a candidate list of the same length as the other positions, with exactly
  **one** candidate marked `ELECTED` — the one with the highest count.
- Keep the vote counts, percentages, and bar styling exactly as they are.

Everything else in Appendix B is accurate and should not change.

## Also worth stating, if the manuscript does not already

Scope and Limitations does not currently note that the evaluated ballot model is
single-winner with a uniform candidate count per position. Consider adding one
sentence there, phrased as a stated limit rather than a defect — something like:

> The evaluated ballot model assigns each position a single winner and an equal
> number of candidates; multi-winner contests such as the twelve-seat Senate
> race, and per-position candidate lists of differing length, are outside the
> scope of this evaluation, as they require a ballot well-formedness proof over
> a selection limit greater than one.

That converts something a panelist could raise as a gap into something the study
declares on its own terms.

## Constraints

- Do not change any claim in Chapters I–III beyond the optional Scope sentence
  above.
- Keep the mockup's existing visual style, colours, and layout — only the
  Senator column's seat count, candidate count, and elected markers change.
- Do not touch Appendix A here; that is the separate prompt.
