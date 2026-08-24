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

## The one real difference between the languages

Rust's `u64` **wraps** at 64 bits — that is what `wrapping_mul` means. Python's
integers are arbitrary precision and never overflow, so every multiplication
and addition must be masked back down by hand:

```python
MASK64 = (1 << 64) - 1
```

Miss a single mask and the two implementations agree for the first few
operations and then diverge silently. Everything else below is a direct
transliteration.

Right shifts are safe in both: `>>` on an unsigned Rust integer and on a
non-negative Python integer are the same operation.

---

## `mix` — scramble (voter, position) into a spread-out number

This is the SplitMix64 finalizer. Deterministic, stateless, seedless.

| # | Rust | Python | Note |
|---|---|---|---|
| 1 | `fn mix(voter_idx: usize, p: usize) -> u64 {` | `def mix(voter_idx: int, p: int) -> int:` | Python has one integer type; the u64 behaviour is enforced by masking, not by the type |
| 2 | `let mut x = (voter_idx as u64)` `.wrapping_mul(0x9e37_79b9_7f4a_7c15)` `^ (p as u64).wrapping_add(1);` | `x = ((voter_idx * 0x9E3779B97F4A7C15) & MASK64)` `^ ((p + 1) & MASK64)` | The multiply **must** be masked. `0x9E37…` is the golden-ratio constant; `p + 1` avoids position 0 contributing nothing |
| 3 | `x ^= x >> 30;` | `x ^= x >> 30` | Identical. Shift-xor mixes the high bits down |
| 4 | `x = x.wrapping_mul(0xbf58_476d_1ce4_e5b9);` | `x = (x * 0xBF58476D1CE4E5B9) & MASK64` | Mask required |
| 5 | `x ^= x >> 27;` | `x ^= x >> 27` | Identical |
| 6 | `x = x.wrapping_mul(0x94d0_49bb_1331_11eb);` | `x = (x * 0x94D049BB133111EB) & MASK64` | Mask required |
| 7 | `x ^ (x >> 31)` | `return x ^ (x >> 31)` | Rust returns the last expression; Python needs `return`. No mask needed — xor of two ≤64-bit values cannot exceed 64 bits |

**Side by side:**

```rust
fn mix(voter_idx: usize, p: usize) -> u64 {
    let mut x = (voter_idx as u64).wrapping_mul(0x9e37_79b9_7f4a_7c15) ^ (p as u64).wrapping_add(1);
    x ^= x >> 30;
    x = x.wrapping_mul(0xbf58_476d_1ce4_e5b9);
    x ^= x >> 27;
    x = x.wrapping_mul(0x94d0_49bb_1331_11eb);
    x ^ (x >> 31)
}
```

```python
def mix(voter_idx: int, p: int) -> int:
    x = ((voter_idx * 0x9E3779B97F4A7C15) & MASK64) ^ ((p + 1) & MASK64)
    x ^= x >> 30
    x = (x * 0xBF58476D1CE4E5B9) & MASK64
    x ^= x >> 27
    x = (x * 0x94D049BB133111EB) & MASK64
    return x ^ (x >> 31)
```

### What each step is doing

The pattern is **multiply, shift-xor, multiply, shift-xor** — a standard
avalanche construction. The multiplications spread influence from low bits to
high bits; the shift-xors fold high bits back down over the low ones. After the
full sequence, flipping any single input bit changes about half the output bits.

That is the whole point: `voter_idx` and `voter_idx + 1` are adjacent numbers,
but their mixed values are unrelated, so consecutive voters do not vote in a
predictable sequence.

---

## `select_candidate` — turn that number into a vote

| # | Rust | Python | Note |
|---|---|---|---|
| 1 | `pub(crate) fn select_candidate(` `profile: SelectionProfile, voter_idx: usize,` `p: usize, candidates: usize) -> usize {` | `def select_candidate(profile: str, voter_idx: int,` `p: int, candidates: int) -> int:` | Rust uses an enum for the profile; Python uses a string. Same two values |
| 2 | `if candidates <= 1 { return 0; }` | `if candidates <= 1: return 0` | Guard: a one-candidate contest has only one possible vote, and it also stops the `candidates - 1` below from being zero |
| 3 | `let h = mix(voter_idx, p);` | `h = mix(voter_idx, p)` | Identical |
| 4 | `SelectionProfile::Uniform =>` `(h % candidates as u64) as usize` | `if profile == "uniform":` `return h % candidates` | Rust needs the cast because `%` requires matching types; Python does not |
| 5 | `if h & 1 == 0 { 0 }` | `if h & 1 == 0: return 0` | Skewed: the lowest bit is a coin flip. Heads → candidate 0 |
| 6 | `else { 1 + ((h >> 8) % (candidates as u64 - 1)) as usize }` | `return 1 + ((h >> 8) % (candidates - 1))` | Tails → spread over candidates 1..C using a **different** slice of the same hash |

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
    let h = mix(voter_idx, p);
    match profile {
        SelectionProfile::Uniform => (h % candidates as u64) as usize,
        SelectionProfile::Skewed => {
            if h & 1 == 0 {
                0
            } else {
                1 + ((h >> 8) % (candidates as u64 - 1)) as usize
            }
        }
    }
}
```

```python
def select_candidate(profile: str, voter_idx: int, p: int, candidates: int) -> int:
    if candidates <= 1:
        return 0

    h = mix(voter_idx, p)

    if profile == "uniform":
        return h % candidates

    if h & 1 == 0:
        return 0
    return 1 + ((h >> 8) % (candidates - 1))
```

### Why `h >> 8` and not `h` again

The skewed branch asks two questions of one hash: *does this voter pick the
front-runner?* (bit 0) and *if not, which of the others?* (bits 8 and up).

Using `h` for both would correlate the answers — the same bits deciding the
coin flip would also steer the spread. Shifting by 8 takes a fresh region of the
hash, so the two decisions are independent.

---

## Worked example

Voter 0, position 0 (President), 4 candidates — real output, not illustrative:

```python
>>> from reference_generator import mix, select_candidate
>>> h = mix(0, 0)
>>> h
6238072747940578789
>>> h % 4                    # uniform → candidate index 1 → CAND_PRES_02
1
>>> h & 1                    # skewed: odd, so NOT the front-runner
1
>>> 1 + ((h >> 8) % 3)       # skewed → candidate index 1 → CAND_PRES_02
1
```

Here both profiles happen to land on the same candidate; they diverge on other
inputs. Three consecutive cases, showing how little the inputs resemble the
outputs:

| voter | position | `mix(voter, position)` | uniform | skewed |
|---|---|---|---|---|
| 0 | 0 | `6238072747940578789` | `CAND_PRES_02` | `CAND_PRES_02` |
| 1 | 0 | `16490336266968443936` | `CAND_PRES_01` | `CAND_PRES_01` |
| 0 | 1 | `15839785061582574730` | `CAND_VICE_03` | `CAND_VICE_01` |

Two things to notice. Voters 0 and 1 are adjacent integers but their mixed
values share no structure — that is the avalanche doing its job. And the same
voter at positions 0 and 1 gets unrelated values, which is why per-position
totals come out distinct rather than as rotations of one another.

Note also that `voter_idx = 0` still produces a large mixed value: the
`^ (p + 1)` term stops the all-zeros input collapsing to zero, which a plain
multiply would.

---

## The properties this preserves

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
