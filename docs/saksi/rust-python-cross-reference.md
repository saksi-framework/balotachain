# Rust ↔ Python cross-reference

The selection rule, line by line, in both languages. The Python is a runnable
reference implementation at [`reference_generator.py`](reference_generator.py);
the Rust is the real generator at
`packages/saksi-auditor/src/fixtures.rs`.

**Verified equivalent**: both produce byte-identical `ground-truth-ballots.csv`
and `ground-truth-summary.csv` at 5,000 voters × 3 positions × 4 candidates, on
both the `uniform` and `skewed` profiles.

```bash
python reference_generator.py --voters 5000 --positions 3 --candidates 4 \
    --distribution skewed --out-dir ./py
saksi-demo gen-ground-truth --voters 5000 --positions 3 --candidates 4 \
    --distribution skewed --election-id x --out-dir ./rust
diff ./py/ground-truth-ballots.csv ./rust/ground-truth-ballots.csv   # no output
```

---

## Does anything translate awkwardly?

No. The rule is integer addition, floor division, and remainder — all of which
behave identically in Rust and Python for non-negative values. There are no
overflow concerns (nothing is multiplied), no sign concerns (nothing is
negative), and no type concerns beyond Rust needing its integers to match.

The one cosmetic difference: Rust's `/` on integers already truncates, so it is
written `voter_idx / 2`; Python's `/` produces a float, so it must be written
`voter_idx // 2`. Using `/` there would silently produce a `TypeError` on the
subsequent `%` — the only way to get this translation wrong.

---

## `select_candidate` — which candidate a voter picks

| # | Rust | Python | Note |
|---|---|---|---|
| 1 | `pub(crate) fn select_candidate(` `profile: SelectionProfile, voter_idx: usize,` `p: usize, candidates: usize) -> usize {` | `def select_candidate(profile: str, voter_idx: int,` `p: int, candidates: int) -> int:` | Rust uses an enum for the profile; Python uses a string. Same two values |
| 2 | `if candidates <= 1 { return 0; }` | `if candidates <= 1: return 0` | A one-candidate contest has only one possible vote. This also stops `candidates - 1` below from being zero |
| 3 | `SelectionProfile::Uniform =>` `(voter_idx + p) % candidates` | `if profile == "uniform":` `return (voter_idx + p) % candidates` | Walk the candidate list in order; `+ p` rotates the starting point per position |
| 4 | `if voter_idx % 2 == 0 { 0 }` | `if voter_idx % 2 == 0: return 0` | Skewed: every even-numbered voter picks the front-runner — exactly half of them |
| 5 | `else { 1 + ((voter_idx / 2 + p)` `% (candidates - 1)) }` | `return 1 + ((voter_idx // 2 + p)` `% (candidates - 1))` | The odd voters walk candidates 1..C. **`/` in Rust, `//` in Python** — the one place a careless translation breaks |

**Side by side:**

```rust
pub(crate) fn select_candidate(
    profile: SelectionProfile,
    voter_idx: usize,
    p: usize,
    candidates: usize,
) -> usize {
    if candidates <= 1 {
        return 0;
    }
    match profile {
        SelectionProfile::Uniform => (voter_idx + p) % candidates,
        // Half the voters pick candidate 0; the rest spread over 1..C.
        SelectionProfile::Skewed => {
            if voter_idx % 2 == 0 {
                0
            } else {
                1 + ((voter_idx / 2 + p) % (candidates - 1))
            }
        }
    }
}
```

```python
def select_candidate(profile: str, voter_idx: int, p: int, candidates: int) -> int:
    if candidates <= 1:
        return 0

    if profile == "uniform":
        return (voter_idx + p) % candidates

    # Skewed: half the voters pick candidate 0; the rest spread over 1..C.
    if voter_idx % 2 == 0:
        return 0
    return 1 + ((voter_idx // 2 + p) % (candidates - 1))
```

---

## Worked example

Real output, 4 candidates. Candidate indices are 0-based here; the CSV labels
them 1-based (`CAND_PRES_01` is index 0).

```python
>>> from reference_generator import select_candidate as sc
>>> [sc("uniform", v, 0, 4) for v in range(6)]
[0, 1, 2, 3, 0, 1]
>>> [sc("skewed", v, 0, 4) for v in range(6)]
[0, 1, 0, 2, 0, 3]
>>> [sc("skewed", v, 1, 4) for v in range(6)]
[0, 2, 0, 3, 0, 1]
```

Reading those:

- **uniform** cycles `0,1,2,3,0,1,…` — every candidate gets an equal share.
- **skewed** alternates: every even voter takes candidate 0, and the odd voters
  walk `1,2,3,1,2,3,…`. Candidate 0 therefore gets exactly half.
- Changing the position from `0` to `1` **rotates** the odd voters' walk
  (`1,2,3` becomes `2,3,1`) but leaves candidate 0's half untouched.

That last point is the source of the limitation below.

---

## A known limit of this rule

Because the position only *rotates* the assignment, every position ends up with
the same multiset of totals — permutations of one another, differing by a vote
or two at scale:

```
PRESIDENT       1762039  587347  587346  587346
VICE_PRESIDENT  1762039  587346  587347  587346
SENATOR         1762039  587346  587346  587347
```

Totals that interchangeable mean the accuracy check cannot discriminate between
contests: a component that confused one contest for another would still satisfy
`E = 0`. The legacy 6-voter fixture avoids this deliberately — its comment says
its values were *"picked so the tally is non-trivial and the two contests have
different totals (catches off-by-one or contest-mixing bugs in the auditor)"* —
but the parameterized generator does not carry the property forward.

This is a limit of the **test data**, not of the protocol. Contest-mixing is not
a failure mode this evaluation probes, and it is recorded here so it is declared
rather than discovered.

---

## The properties this rule does preserve

Both implementations, being pure functions of their four arguments:

1. **Reproduce from parameters alone.** No seed to store, ship, or lose. State
   `voters`, `positions`, `candidates`, `distribution` and the population is
   fully determined.
2. **Agree across generator paths.** `gen --stream` (full cryptography) and
   `gen-ground-truth` (no cryptography) replay the same function and therefore
   produce byte-identical tables.
3. **Allow independent verification.** Anyone can run the Python here against a
   published ground-truth CSV and confirm it is what it claims to be — without
   Rust, without the repository, without trusting the researchers.

Point 3 is the reason this file exists.
