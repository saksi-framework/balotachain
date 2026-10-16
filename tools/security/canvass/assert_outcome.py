#!/usr/bin/env python3
"""Read canvass-checks.csv after a canvass run and judge one scenario against
its expected failing-check set (the corrected Task 2 table). Prints PASS/FAIL
and appends a row to negative-tests-canvass.csv.

Usage:
  assert_outcome.py <scenario> <canvass-checks.csv> [--out negative-tests-canvass.csv]
                    [--onchain "<text>"]

For the file scenarios (T9-T16, T21, T24) the verdict is PASS when the set of
failed checks equals the expected set exactly. For the chain scenarios (T19,
T20) the expected verdict is a pair: the recorded on-chain outcome plus the
canvass check, and --onchain carries the `[COMMIT]`/`[REFUSED] gate=...` line.
The chain verdict is strict set equality too: refused on chain -> no check may
fail; committed -> the failed set must equal the scenario's full expected set.
A missing canvass-checks.csv (the driver stopped before the canvass) writes a
row with verdict ERROR and exits 1.
"""
import argparse
import csv
import sys
from pathlib import Path

# Expected failing checks, primary first (corrected Task 2 table, after the
# "accepted returns" fix). T14 has two variants; the mount chooses which.
EXPECTED = {
    "T9":  ["canvass.signature", "canvass.completeness", "canvass.precinct_recompute", "canvass.national_sum"],
    "T10": ["canvass.registry"],
    "T11": ["canvass.registry"],
    "T12": ["canvass.signature", "canvass.completeness", "canvass.precinct_recompute", "canvass.national_sum"],
    "T13": ["canvass.completeness", "canvass.national_sum"],
    "T14a": ["canvass.registry", "canvass.completeness", "canvass.national_sum"],
    "T14b": ["canvass.precinct_recompute"],
    "T15": ["canvass.precinct_recompute", "canvass.national_sum"],
    "T16": ["canvass.precinct_recompute", "canvass.national_sum"],
    "T21": ["canvass.signature", "canvass.completeness", "canvass.national_sum"],
    "T24": ["canvass.signature", "canvass.completeness", "canvass.precinct_recompute", "canvass.national_sum"],
    # Chain scenarios: the full canvass set IF the chain committed the mount.
    # If the chain refused it, the expected set is empty (see main).
    "T19": ["canvass.nullifier_unique", "canvass.accuracy"],
    "T20": ["canvass.accuracy"],
}

MOUNT = {
    "T9":  "one aggregate byte flipped after signing",
    "T10": "return delivered twice",
    "T11": "unregistered precinct, fresh-key signature",
    "T12": "sibling return relabelled and substituted",
    "T13": "return dropped on the path",
    "T14a": "wrong election id, re-signed with the real key",
    "T14b": "stale close reference, re-signed with the real key",
    "T15": "real key over a ledger missing one ballot",
    "T16": "doctored aggregate re-signed with the stolen real key",
    "T21": "signed with another registered precinct's key",
    "T24": "accepted national/returns file replaced after acceptance",
    "T19": "ballot resubmitted across precincts (submit-raw --channel)",
    "T20": "a precinct's tally published on another precinct",
}


def failed_checks(csv_path):
    failed = []
    with open(csv_path, newline="") as f:
        for row in csv.DictReader(f):
            if row["verdict"].strip().lower() != "pass":
                failed.append(row["check"].strip())
    return failed


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario")
    ap.add_argument("checks_csv")
    ap.add_argument("--out", default="negative-tests-canvass.csv")
    ap.add_argument("--onchain", default="")
    a = ap.parse_args(argv)

    scen = a.scenario
    if scen not in EXPECTED:
        print(f"unknown scenario {scen}", file=sys.stderr)
        return 2
    expected = EXPECTED[scen]
    chain = scen in ("T19", "T20")
    if chain:
        refused = "REFUSED" in a.onchain.upper()
        if refused:
            expected = []
        expected_str = ("refused on chain: none" if refused
                        else "committed on chain: " + ",".join(expected))
    else:
        expected_str = ",".join(expected)

    try:
        failed = failed_checks(a.checks_csv)
    except FileNotFoundError:
        failed, verdict = None, "ERROR"
    else:
        verdict = "PASS" if set(failed) == set(expected) else "FAIL"

    out = Path(a.out)
    new = not out.exists()
    with open(out, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["scenario", "mount", "expected_checks", "failed_checks", "onchain", "verdict"])
        got = "no canvass-checks.csv" if failed is None else ",".join(failed)
        w.writerow([scen, MOUNT.get(scen, ""), expected_str, got, a.onchain, verdict])

    print(f"{verdict} {scen}: expected [{expected_str}] got [{got}]"
          + (f" on-chain [{a.onchain}]" if a.onchain else ""))
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
