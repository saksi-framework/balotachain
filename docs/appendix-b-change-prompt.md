# Prompt — align Appendix B's bulletin board with the implemented ballot model

Hand this over together with `docs/appendix-a-change-prompt.md`; both are
manuscript edits in the same pass.

> **This supersedes an earlier version of this prompt**, which asked for the
> Senator race to be rewritten as single-winner because the generator could not
> produce a multi-winner contest. The generator now can. The mockup's twelve
> seats stay; what must be corrected is smaller, and different.

---

I need two corrections to **Appendix B: Software Design/Prototype** in my thesis
manuscript, so the Public Bulletin Board mockup matches what the implemented
system produces.

## What is already correct and must NOT change

The mockup shows a **Senator** race with **12 seats**, several candidates marked
`ELECTED`. That is right. The implemented system elects the top *N* candidates in
the Senate race, with *N* configurable, while President and Vice President remain
single-winner. Keep the seat count, the `ELECTED` markers, the vote counts, the
percentages, and the bar styling exactly as they are.

## Correction 1 — state the ballot model

The mockup does not say how a voter votes in a twelve-seat race, and the two
possibilities are very different systems. The implemented one is:

> Each voter selects **one** senator. The twelve highest-polling candidates are
> elected.

That is **Single Non-Transferable Vote (SNTV)**, a real multi-seat electoral
system. It is *not* the current Philippine Senate method, in which a voter may
mark up to twelve names — and the difference matters, because a panelist may
reasonably assume the latter.

Please add a short line to the Senator column, or to the caption, making the
ballot model explicit. Something like:

> Senator — 12 seats. One vote per voter; the twelve highest-polling candidates
> are elected (single non-transferable vote).

## Correction 2 — the candidate count

The mockup says **"Top 12 of 37 candidates elected."** The implemented generator
uses **one candidate count for every position**, so a run with 37 senators would
also give 37 presidential candidates.

Either:

- **(preferred)** change "37" to the same candidate count the other positions
  show, so the figure is internally consistent; or
- keep 37 and add a note that the figure illustrates a larger candidate list than
  the evaluated configuration uses.

## Also worth stating in Scope and Limitations

If the manuscript does not already say so, one sentence converts a question a
panelist could raise into something the study declares on its own terms:

> The evaluated ballot model allows each voter a single selection per position
> and an equal number of candidates across positions. Multi-seat contests are
> decided by plurality over those single selections; ballots on which a voter
> marks several candidates for one position — as in the current Philippine
> Senate election — are outside the scope of this evaluation, as they require a
> ballot well-formedness proof over a selection limit greater than one.

That sentence is accurate and worth keeping: supporting a twelve-mark ballot
genuinely would require new cryptography, not a configuration change. The
well-formedness proof shows each ciphertext encrypts zero or one and the
validation gate asserts each position's total equals its ballot count; a
twelve-mark ballot needs a proof that a voter's selections *sum to twelve*, plus
a reworked gate, chaincode verifier, and auditor.

## Constraints

- Do not change any claim in Chapters I–III beyond the optional Scope sentence.
- Keep the mockup's existing visual style, colours, and layout.
- Do not touch Appendix A here; that is the separate prompt.
