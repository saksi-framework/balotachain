# The selection rule, explained line by line

How the generator decides which candidate each synthetic voter picks. Written
for someone who wants to follow the arithmetic rather than take it on trust.

The function lives at `packages/saksi-auditor/src/fixtures.rs` in the `saksi`
repo. A runnable Python translation is in
[`reference_generator.py`](reference_generator.py); every number in this file
was produced by running it, not written from memory.

---

## The whole thing

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

Eleven lines. The rest of this document is those eleven lines, slowly.

---

## 1. The signature

```rust
fn select_candidate(profile, voter_idx, p, candidates) -> usize
```

Four inputs, one output. The output is a **candidate index**, 0-based — `0`
means the first candidate on the ballot.

| Input | Means | Example |
|---|---|---|
| `profile` | `Uniform` or `Skewed` | `Skewed` |
| `voter_idx` | which voter, `0` to `voters - 1` | `5` = the 6th voter |
| `p` | which position | `0` = President, `1` = VP, `2` = Senator |
| `candidates` | how many candidates that position has | `4` |

**Nothing else goes in.** No clock, no random number generator, no file, no
seed. That is what "pure function" means, and it is why the same four numbers
always produce the same vote.

That property is not a stylistic preference — it is what lets the ground-truth
CSV be trusted. The plaintext table and the encrypted ballots are produced by
two different code paths; they agree because both call this function with the
same arguments. Introduce randomness and they would silently describe different
populations.

---

## 2. The guard

```rust
if candidates <= 1 {
    return 0;
}
```

Two jobs, one obvious and one not.

**The obvious one:** if a position has only one candidate, the only possible
vote is candidate `0`.

**The real reason it is there:** the skewed branch below divides by
`candidates - 1`. If `candidates` were `1`, that is **division by zero** — a
crash. This line makes that unreachable. Guards that look redundant often are
not; this one is load-bearing.

---

## 3. Uniform — walk the list

```rust
(voter_idx + p) % candidates
```

`%` is remainder: `7 % 4` is `3`, because 7 = 4 + 3.

Ignore `+ p` for a moment. `voter_idx % candidates` counts around the ballot in
a loop:

| voter | `voter_idx % 4` |
|---|---|
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | **0** — wraps |
| 5 | 1 |

Real output, 4 candidates, position 0:

```python
>>> [select_candidate("uniform", v, 0, 4) for v in range(8)]
[0, 1, 2, 3, 0, 1, 2, 3]
```

Voter 0 picks candidate 0, voter 1 picks candidate 1, restarting every four
voters. Across a million voters each candidate ends up with a near-exactly equal
share. That is what *uniform* means.

**What `+ p` does.** It shifts the starting point per position. The same voters
at position 1:

```python
>>> [select_candidate("uniform", v, 1, 4) for v in range(8)]
[1, 2, 3, 0, 1, 2, 3, 0]
```

Same cycle, rotated by one. Without it, voter 0 would pick the first candidate
in every single race — obviously artificial.

---

## 4. Skewed — the even/odd split

```rust
if voter_idx % 2 == 0 {
    0
}
```

`voter_idx % 2` is `0` for even numbers and `1` for odd. So this reads: **every
even-numbered voter picks candidate 0.**

Voters 0, 2, 4, 6, 8 … are exactly half the electorate. That is how candidate 0
ends up with precisely 50% — not approximately, structurally. At 3,524,078
voters, candidate 0 receives exactly 1,762,039.

---

## 5. Skewed — spreading the rest

```rust
1 + ((voter_idx / 2 + p) % (candidates - 1))
```

This runs only for **odd** voters — the other half of the electorate. They share
candidates 1, 2 and 3; candidate 0 is spoken for. Read it inside-out.

**`candidates - 1`** → `4 - 1 = 3`. Three candidates left to spread across.

**`voter_idx / 2`** → integer division, which discards the remainder. The odd
voters are 1, 3, 5, 7 …, and halving them gives 0, 1, 2, 3 …. It **renumbers the
odd voters into a clean counting sequence**. Without it we would be counting
1, 3, 5, 7 and skipping candidates.

**`% (candidates - 1)`** → wraps that count around the three available slots:
0, 1, 2, 0, 1, 2 …

**`1 +`** → shifts the result from `0,1,2` up to `1,2,3`, stepping over
candidate 0.

Traced for real:

| voter | `voter_idx / 2` | `% 3` | `1 +` | picks |
|---|---|---|---|---|
| 1 | 0 | 0 | **1** | candidate 1 |
| 3 | 1 | 1 | **2** | candidate 2 |
| 5 | 2 | 2 | **3** | candidate 3 |
| 7 | 3 | **0** — wraps | **1** | candidate 1 |
| 9 | 4 | 1 | **2** | candidate 2 |

Interleaved with the even voters, position 0 gives:

```python
>>> [select_candidate("skewed", v, 0, 4) for v in range(8)]
[0, 1, 0, 2, 0, 3, 0, 1]
```

Candidate 0 every other slot; the rest taking turns in between.

> **Translation hazard.** This is the one line where the Python version can go
> wrong. Rust's `/` on integers truncates, but Python's `/` produces a float —
> it must be written `//`. Using `/` there fails on the following `%`.

---

## 6. How the result is used

The generator calls the function in a nested loop — every voter, every position:

```rust
for (voter_idx, credential) in credentials.iter().enumerate() {
    for p in 0..positions {
        let selected = select_candidate(profile, voter_idx, p, candidates);
        selections.push((p, selected));      // ← recorded
        // ... then encrypt `selected` under the election key
    }
}
```

Two separate things happen to `selected`: it is **recorded** in `selections`,
and it is **encrypted** into a ballot.

Afterwards the ground truth is counted from the recorded list:

```rust
let ground_truth = tally_selections(&selections, contest_ids.len(), candidates);
```

**This separation is the point.** The ground truth is not accumulated inside the
encryption loop. If the cryptography ever encrypted a different number than the
voter selected, the decrypted tally and this list would disagree and `E = 0`
would fail. If both were driven by one shared counter, they would carry the same
wrong value and the check would pass while being wrong.

---

## 7. The weakness, now that the mechanics are visible

`+ p` only **rotates** the assignment. It never changes how many votes each
candidate receives — only which candidate receives which pile. So every position
ends up with the same set of totals in a different order:

```
PRESIDENT       1762039  587347  587346  587346
VICE_PRESIDENT  1762039  587346  587347  587346
SENATOR         1762039  587346  587346  587347
```

If some component ever confused President's tally with Senator's, `E = 0` would
still pass — the numbers are interchangeable.

The legacy 6-voter fixture guards against exactly this. Its comment reads:
*"picked so the tally is non-trivial and the two contests have different totals
(catches off-by-one or contest-mixing bugs in the auditor)"*. The parameterized
generator does not carry that property forward.

This is a limitation of the **test data**, not of the protocol. Contest-mixing
is not a failure mode this evaluation probes. It is written down here so it is
declared rather than discovered.

---

## Summary

| Line | What it does |
|---|---|
| `if candidates <= 1 { return 0 }` | Trivial contest; also prevents divide-by-zero below |
| `(voter_idx + p) % candidates` | Uniform: cycle through candidates, rotated per position |
| `if voter_idx % 2 == 0 { 0 }` | Skewed: every even voter takes the front-runner — exactly half |
| `voter_idx / 2` | Renumber the odd voters 0, 1, 2, 3 … |
| `% (candidates - 1)` | Wrap across the remaining candidates |
| `1 +` | Step over candidate 0 |

## Related

- [`synthetic-data-generation.md`](synthetic-data-generation.md) — the full
  pipeline: output schemas, the validation gate, reproducing any tier.
- [`rust-python-cross-reference.md`](rust-python-cross-reference.md) — the same
  function in both languages, side by side.
- [`reference_generator.py`](reference_generator.py) — runnable; verified
  byte-identical to the Rust generator.
