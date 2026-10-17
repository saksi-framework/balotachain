#!/usr/bin/env python3
"""Sort a ballots.ndjson into the chain's canonical (ascending nullifier) order.

The console record is voter-major; the chain serves ballots in ascending
nullifier order. The canvass's ledger.order check expects that order, so the
faked chain read-back in the selftest must be sorted the same way the Task 2
Rust fixture sorts it (by Ballot.credential_presentation.nullifier.value).

  _sort_nullifier.py <src ballots.ndjson> <dst ballots.ndjson>
"""
import sys
from pathlib import Path


def _varint(b, i):
    s = v = 0
    while True:
        x = b[i]; i += 1; v |= (x & 0x7F) << s
        if not (x & 0x80):
            return v, i
        s += 7


def _find(b, want):
    i, n = 0, len(b)
    while i < n:
        key, i = _varint(b, i); fn = key >> 3; wt = key & 7
        if wt == 2:
            ln, i = _varint(b, i)
            if fn == want:
                return i, ln
            i += ln
        elif wt == 0:
            st = i; _, i = _varint(b, i)
            if fn == want:
                return st, i - st
        elif wt == 5:
            if fn == want:
                return i, 4
            i += 4
        elif wt == 1:
            if fn == want:
                return i, 8
            i += 8
        else:
            raise ValueError(f"wire type {wt}")
    raise ValueError(f"field {want} not found")


def nullifier(line):
    b = bytes.fromhex(line.strip())
    cs, cl = _find(b, 6)          # Ballot.credential_presentation
    sub = b[cs:cs + cl]
    ns, nl = _find(sub, 5)        # CredentialPresentation.nullifier
    nsub = sub[ns:ns + nl]
    vs, vl = _find(nsub, 2)       # Nullifier.value
    return nsub[vs:vs + vl]


def main():
    src, dst = sys.argv[1], sys.argv[2]
    lines = [l for l in Path(src).read_text().splitlines() if l.strip()]
    lines.sort(key=lambda l: (nullifier(l), l))
    Path(dst).write_text("".join(l + "\n" for l in lines))


if __name__ == "__main__":
    main()
