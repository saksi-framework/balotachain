"""Decode the published tally (protobuf hex in header.json) and, with --tamper OUT,
write a copy of the run folder's header with one trustee signature byte flipped."""
import json, sys, shutil, os

def varint(b, i):
    r = s = 0
    while True:
        x = b[i]; i += 1
        r |= (x & 0x7F) << s; s += 7
        if x < 0x80:
            return r, i

def fields(b):
    i, out = 0, []
    while i < len(b):
        key, i = varint(b, i)
        f, w = key >> 3, key & 7
        start = i
        if w == 0:
            v, i = varint(b, i)
        elif w == 2:
            n, i = varint(b, i); start = i; v = b[i:i + n]; i += n
        elif w == 1:
            v = b[i:i + 8]; i += 8
        elif w == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError(w)
        out.append((f, w, v, start))
    return out

d = sys.argv[1]
h = json.load(open(os.path.join(d, "header.json")))
t = bytes.fromhex(h["tally"])
fs = fields(t)
totals, sigs = None, []
for f, w, v, start in fs:
    if f == 3 and w == 2:
        totals, j = [], 0
        while j < len(v):
            x, j = varint(v, j); totals.append(x)
    if w == 2 and f != 3:
        try:
            sub = fields(v)
        except Exception:
            continue
        sb = [(sf, sv, ss) for sf, sw, sv, ss in sub if sw == 2 and len(sv) == 64]
        if sb:
            tid = [sv.decode() for sf, sw, sv, ss in sub if sw == 2 and len(sv) < 40]
            sigs.append((tid, start + sb[0][2]))
print("election_id", fields(t)[0][2] if fields(t)[0][1] == 2 else "")
print("published totals", totals)
print("contests", h["params"] and len(totals))
print("signatures", len(sigs), "trustee ids", [s[0] for s in sigs])
if len(sys.argv) > 3 and sys.argv[2] == "--tamper":
    out = sys.argv[3]
    shutil.copytree(d, out, dirs_exist_ok=True)
    b = bytearray(t); off = sigs[0][1] + 32; b[off] ^= 1
    h["tally"] = b.hex()
    json.dump(h, open(os.path.join(out, "header.json"), "w"))
    print("tampered byte", off, "of signature of", sigs[0][0])
