#!/usr/bin/env python3
"""A7 privacy-linkage join (run tooling, read-only).

Streams a run's zstd ballots.ndjson (never decompressed to disk), decodes the
voter-linked fields each ballot exposes on the public bulletin board
(nullifier value, credential_commitment, voter_credential_commitment) and joins
them against the registration list (header.json voter_ids). A linkage hit is any
exposed value that is a member of the registration-identifier set, i.e. a public
field that re-identifies a registered voter. Expect 0; bound is 1/N.

Usage: linkage_join.py <run-dir> [--out result.json]
"""
import json, subprocess, sys, hashlib

# ---- minimal protobuf reader (wire types 0 varint, 2 len-delimited) ----
def _varint(b, i):
    shift = 0; val = 0
    while True:
        x = b[i]; i += 1
        val |= (x & 0x7F) << shift
        if not (x & 0x80): return val, i
        shift += 7

def fields(b):
    """yield (field_number, wire_type, value_bytes_or_int, new_i)."""
    i = 0; n = len(b)
    while i < n:
        key, i = _varint(b, i)
        fn = key >> 3; wt = key & 7
        if wt == 0:
            v, i = _varint(b, i); yield fn, wt, v
        elif wt == 2:
            ln, i = _varint(b, i); yield fn, wt, b[i:i+ln]; i += ln
        elif wt == 5:
            yield fn, wt, b[i:i+4]; i += 4
        elif wt == 1:
            yield fn, wt, b[i:i+8]; i += 8
        else:
            raise ValueError(f"unsupported wire type {wt}")

def submsg(b, want):
    for fn, wt, v in fields(b):
        if fn == want and wt == 2: return v
    return None

def extract(ballot_hex):
    b = bytes.fromhex(ballot_hex.strip())
    vcc = None; cc = None; nul = None; pos = None
    for fn, wt, v in fields(b):
        if fn == 3 and wt == 2: vcc = v                       # voter_credential_commitment
        elif fn == 7 and wt == 2: pos = v.decode('utf-8','replace')
        elif fn == 6 and wt == 2:                             # credential_presentation
            cc = submsg(v, 2)                                 # CP.credential_commitment
            nmsg = submsg(v, 5)                               # CP.nullifier
            if nmsg is not None: nul = submsg(nmsg, 2)        # Nullifier.value
    return vcc, cc, nul, pos

def main():
    run = sys.argv[1]
    out = None
    if "--out" in sys.argv: out = sys.argv[sys.argv.index("--out")+1]
    hdr = json.load(open(f"{run}/header.json"))
    reg = set(hdr.get("voter_ids") or [])          # registration identifiers
    reg_hex = set(x.encode().hex() for x in reg)    # same, hex form, for a byte-join
    N = len(reg)

    import glob
    zst = (glob.glob(f"{run}/ballots.ndjson.zst") or glob.glob(f"{run}/ledger/ballots.ndjson.zst"))
    if not zst: sys.exit(f"no ballots.ndjson.zst under {run}")
    zst = zst[0]

    p = subprocess.Popen(["zstd","-dc",zst], stdout=subprocess.PIPE, bufsize=1<<20)
    total = 0
    nul_seen = {}           # nullifier hex -> count (collision = linkage/double-vote)
    cc_set = set()          # distinct credential_commitment
    vcc_set = set()         # distinct voter_credential_commitment
    hits = []               # exposed value that is a registration identifier
    for raw in p.stdout:
        line = raw.strip()
        if not line: continue
        total += 1
        vcc, cc, nul, pos = extract(line.decode('ascii','replace'))
        if nul is not None:
            h = nul.hex(); nul_seen[h] = nul_seen.get(h,0)+1
            if h in reg_hex or nul.decode('latin1','ignore') in reg: hits.append(("nullifier",h))
        if cc is not None:
            ch = cc.hex(); cc_set.add(ch)
            if ch in reg_hex: hits.append(("credential_commitment",ch))
        if vcc is not None:
            vh = vcc.hex(); vcc_set.add(vh)
            if vh in reg_hex: hits.append(("voter_credential_commitment",vh))
    p.stdout.close(); p.wait()
    if p.returncode not in (0, None): sys.exit(f"zstd failed rc={p.returncode}")

    nul_collisions = {h:c for h,c in nul_seen.items() if c > 1}
    res = {
        "run": run, "zst": zst,
        "registered_voters_N": N,
        "ballots": total,
        "distinct_nullifiers": len(nul_seen),
        "nullifier_collisions": len(nul_collisions),
        "distinct_credential_commitments": len(cc_set),
        "distinct_voter_credential_commitments": len(vcc_set),
        "linkage_hits": len(hits),
        "linkage_hit_examples": hits[:5],
        "linkage_bound_per_voter": (1.0/N if N else None),
        "note": "hit = public ballot field that is a member of the registration-identifier set",
    }
    print(json.dumps(res, indent=2))
    if out:
        json.dump(res, open(out,"w"), indent=2)

if __name__ == "__main__":
    main()
