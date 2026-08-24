#!/usr/bin/env python3
"""Reference implementation of the Saksi synthetic-vote selection rule.

This is a line-for-line Python translation of `select_candidate` from
`packages/saksi-auditor/src/fixtures.rs`. It exists so the rule can be read,
run, and checked without a Rust toolchain — and so anyone can independently
reproduce a published ground-truth table.

Run it to regenerate any tier:

    python reference_generator.py --voters 1000 --positions 3 --candidates 4 \
        --distribution skewed

Verified byte-identical to the Rust generator's output.

The translation is direct: the rule is integer addition, floor division, and
remainder, which behave identically in both languages for non-negative values.
There is nothing subtle to get wrong.
"""

import argparse
import sys
from collections import Counter


def select_candidate(profile: str, voter_idx: int, p: int, candidates: int) -> int:
    """Which candidate voter `voter_idx` picks for position `p`.

    Returns a 0-based candidate index. `profile` is "uniform" or "skewed".

    Deterministic: the same voter and position always give the same vote, with
    no seed and no state. That is what lets a population be reproduced from its
    four parameters alone, and what makes the two generator paths agree.

    KNOWN LIMIT: this is a round-robin, so each position ends up with a
    near-identical set of totals — permutations of one another. A component that
    confused one contest for another would still satisfy E = 0. Contest-mixing
    is not a failure mode this test data probes.
    """
    if candidates <= 1:
        return 0

    if profile == "uniform":
        # Walk the candidate list; the +p offset rotates the assignment per
        # position so the positions are not literally identical.
        return (voter_idx + p) % candidates

    # Skewed: half the voters pick candidate 0; the rest spread over 1..C.
    if voter_idx % 2 == 0:
        return 0
    return 1 + ((voter_idx // 2 + p) % (candidates - 1))


# ---------------------------------------------------------------------------
# Everything below is presentation: labels and file layout, matching the CSVs
# the Rust generator writes.
# ---------------------------------------------------------------------------

def position_name(p: int) -> str:
    """Column header for position `p` (uppercased, underscored)."""
    return {0: "PRESIDENT", 1: "VICE_PRESIDENT", 2: "SENATOR"}.get(p, f"POSITION_{p}")


def candidate_label(p: int, k: int) -> str:
    """Candidate label as it appears in both CSVs, e.g. CAND_PRES_01.

    `k` is the 0-based index; labels are 1-based so they read as ballot
    positions rather than array offsets.
    """
    prefix = {0: "PRES", 1: "VICE", 2: "SEN"}.get(p, f"POS{p}")
    return f"CAND_{prefix}_{k + 1:02d}"


def generate(voters: int, positions: int, candidates: int, distribution: str):
    """Yield each voter's row and accumulate the tally, in one pass."""
    counts = [Counter() for _ in range(positions)]
    complexity = "single" if positions == 1 else "multi"

    for voter_idx in range(voters):
        picks = []
        for p in range(positions):
            k = select_candidate(distribution, voter_idx, p, candidates)
            counts[p][k] += 1
            picks.append(candidate_label(p, k))
        yield [f"V-{voter_idx + 1:06d}", str(voters), complexity] + picks, counts


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voters", type=int, required=True)
    ap.add_argument("--positions", type=int, default=3)
    ap.add_argument("--candidates", type=int, default=4)
    ap.add_argument("--distribution", choices=["uniform", "skewed"], default="uniform")
    ap.add_argument("--out-dir", default=None,
                    help="write the two CSVs here; omit to print the tally only")
    args = ap.parse_args()

    header = ["voter_id", "scale_group", "ballot_complexity"] + \
             [position_name(p) for p in range(args.positions)]

    rows_out = None
    if args.out_dir:
        import os
        os.makedirs(args.out_dir, exist_ok=True)
        rows_out = open(os.path.join(args.out_dir, "ground-truth-ballots.csv"),
                        "w", newline="", encoding="utf-8")
        rows_out.write(",".join(header) + "\n")

    counts = None
    for row, counts in generate(args.voters, args.positions, args.candidates,
                               args.distribution):
        if rows_out:
            rows_out.write(",".join(row) + "\n")
    if rows_out:
        rows_out.close()

    summary = ["position,candidate,ground_truth_count"]
    for p in range(args.positions):
        for k in range(args.candidates):
            summary.append(f"{position_name(p)},{candidate_label(p, k)},{counts[p][k]}")

    if args.out_dir:
        import os
        with open(os.path.join(args.out_dir, "ground-truth-summary.csv"),
                  "w", newline="", encoding="utf-8") as f:
            f.write("\n".join(summary) + "\n")
        print(f"wrote both tables to {args.out_dir}", file=sys.stderr)
    else:
        print("\n".join(summary))

    # Every position must total the voter count: one selection per voter, per
    # position, no abstention modelled.
    for p in range(args.positions):
        total = sum(counts[p].values())
        assert total == args.voters, f"position {p} totals {total}, expected {args.voters}"
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
