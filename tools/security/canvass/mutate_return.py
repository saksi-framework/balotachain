#!/usr/bin/env python3
"""Precinct-return transmission attacks (size-M national canvass).

One subcommand per scenario. Each is a driver *attack script* hook: the console
driver (`saksi-canvass-demo`) runs it with `--scenario <id>` and appends the
hook's positional arguments, and sets `SAKSI_HOOK` to the hook name:

  SAKSI_HOOK=return    args: <precinct dir> <return path> <national dir>
      run in every precinct, after `sign-return` wrote return.json and before
      the driver copies it to national/returns/<pid>.json.
  SAKSI_HOOK=national  args: <national dir>
      run once, after every precinct and before `audit-canvass`.

A scenario acts only on its target precinct (or at the national hook) and is a
no-op elsewhere, so the same script is passed to every precinct. It prints one
line `[MOUNTED] <id> <what>` when it acts, and `[skip] <id> <why>` otherwise.
Mutations are on files only; no network. stdlib only (Python 3.12).

The target precinct defaults to the one the plan names (p03, p05, ...), and is
overridable with CANVASS_TARGET (precinct number) and CANVASS_SIBLING; the
selftest uses the defaults. `saksi-demo` is found via SAKSI_DEMO (default on
PATH).
"""
import argparse
import json
import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

DEMO = os.environ.get("SAKSI_DEMO", "saksi-demo")

# Default target precinct number per scenario, as the plan names them. The
# sibling is the second precinct a scenario needs (relabel target / key donor).
TARGET = {
    "T9": 3, "T10": 3, "T11": 3, "T12": 4, "T13": 5,
    "T14": 3, "T15": 6, "T16": 7, "T21": 3,
}
# T12: the victim slot is p04 and the donor is p03, already built because the
# driver runs precincts in ascending order. T21 borrows p04's key from gen.
SIBLING = {"T12": 3, "T21": 4}


def pid(n):
    return f"p{n:02d}"


def pdir_name(n):
    return f"precinct-{n:02d}"


def mounted(scen, what):
    print(f"[MOUNTED] {scen} {what}")


def skip(scen, why):
    print(f"[skip] {scen} {why}")


def precinct_number(precinct_dir):
    """The NN of a .../precinct-NN directory."""
    return int(Path(precinct_dir).name.split("-")[-1])


def target_number(scen):
    env = os.environ.get("CANVASS_TARGET")
    return int(env) if env else TARGET[scen]


def sibling_number(scen):
    env = os.environ.get("CANVASS_SIBLING")
    return int(env) if env else SIBLING[scen]


def base_id(precinct_dir):
    """National (base) election id = header election id with the -pNN cut off."""
    h = json.loads((Path(precinct_dir) / "header.json").read_text())
    eid = h["election_id"]
    return eid.rsplit("-p", 1)[0]


def read_close(precinct_dir):
    c = json.loads((Path(precinct_dir) / "close.json").read_text())
    return int(c["close_block"]), c["close_tip_hash"]


def run_demo(*args):
    r = subprocess.run([DEMO, *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"saksi-demo {args[0]} failed: {r.stderr.strip() or r.stdout.strip()}")
    return r.stdout


def fresh_scalar_key(path):
    """A random canonical ristretto255 scalar, little-endian hex. Clearing the
    top four bits keeps the value below the group order, so it is canonical."""
    b = bytearray(secrets.token_bytes(32))
    b[31] &= 0x0F
    Path(path).write_text(b.hex())


# ---- protobuf field walk (same shape as a4_tamper.py) ---------------------

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


def flip_first_ballot_ciphertext(ledger_path):
    """Flip one content byte of ballot[0]'s first ciphertext (Ballot.ciphertexts
    f4 -> Ciphertext.data f3). The ballot stops verifying and its aggregate
    changes, while the record count is unchanged."""
    lines = Path(ledger_path).read_text().splitlines()
    b = bytearray.fromhex(lines[0].strip())
    cs, cl = _find(b, 4)
    sub = b[cs:cs + cl]
    ds, dl = _find(sub, 3)
    sub[ds + dl // 2] ^= 0x01
    b[cs:cs + cl] = sub
    lines[0] = b.hex()
    Path(ledger_path).write_text("\n".join(lines) + "\n")


# ---- re-sign helper --------------------------------------------------------

def resign_from(precinct_dir, out_path, *, key=None, election_id=None,
                ledger=None, close_block=None, tip=None):
    """Produce a validly signed return via `saksi-demo sign-return`, optionally
    over an edited header (election_id), an edited ledger, a different key, or a
    different close reference. Uses a temp copy so the real precinct is untouched."""
    src = Path(precinct_dir)
    blk, t = read_close(precinct_dir)
    close_block = blk if close_block is None else close_block
    tip = t if tip is None else tip
    key = key or str(src / "authority.key")
    ledger = ledger or str(src / "ledger" / "ballots.ndjson")
    work = src
    tmp = None
    if election_id is not None:
        tmp = src.parent / f".mut-{src.name}"
        if tmp.exists():
            shutil.rmtree(tmp)
        tmp.mkdir(parents=True)
        h = json.loads((src / "header.json").read_text())
        h["election_id"] = election_id
        (tmp / "header.json").write_text(json.dumps(h))
        work = tmp
    try:
        run_demo("sign-return", str(work), "--ledger", ledger,
                 "--close-block", str(close_block), "--tip-hash", tip,
                 "--key", key, "--out", out_path)
    finally:
        if tmp and tmp.exists():
            shutil.rmtree(tmp)


# ---- scenarios -------------------------------------------------------------

def t9(scen, pdir, ret, nat):
    """Flip one byte of one aggregate in return.json AFTER signing."""
    r = json.loads(Path(ret).read_text())
    c = r["contests"][0]["sum_c2"]
    r["contests"][0]["sum_c2"] = c[:-2] + ("00" if c[-2:] != "00" else "01")
    Path(ret).write_text(json.dumps(r, indent=2))
    mounted(scen, f"flipped last byte of {pid(precinct_number(pdir))} aggregate sum_c2 after signing")


def t10(scen, pdir, ret, nat):
    """Duplicate the accepted return as a second file for the same precinct."""
    p = pid(precinct_number(pdir))
    dst = Path(nat) / "returns"
    dst.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ret, dst / f"{p}-dup.json")
    mounted(scen, f"wrote a duplicate return {p}-dup.json for {p} (the honest {p}.json is also delivered)")


def t11(scen, pdir, ret, nat):
    """A return for an unregistered precinct id, signed with a fresh key."""
    base = base_id(pdir)
    unreg = "p99"
    key = Path(nat) / ".t11-fresh.key"
    fresh_scalar_key(key)
    dst = Path(nat) / "returns"
    dst.mkdir(parents=True, exist_ok=True)
    resign_from(pdir, str(dst / f"{unreg}.json"), key=str(key),
                election_id=f"{base}-{unreg}")
    key.unlink(missing_ok=True)
    mounted(scen, f"injected a valid-signed return for unregistered {unreg} ({base}-{unreg})")


def t12(scen, pdir, ret, nat):
    """Relabel a sibling precinct's return to this precinct without re-signing.
    The honest return of this precinct is overwritten (substituted)."""
    sib = pdir_name(sibling_number(scen))
    donor = Path(pdir).parent / sib / "return.json"
    if not donor.exists():
        skip(scen, f"donor {sib}/return.json not present yet")
        return
    me = pid(precinct_number(pdir))
    base = base_id(pdir)
    r = json.loads(donor.read_text())
    r["precinct_id"] = me
    r["election_id"] = f"{base}-{me}"
    Path(ret).write_text(json.dumps(r, indent=2))
    mounted(scen, f"substituted {sib}'s return relabelled to {me}; signature now binds the wrong id")


def t13(scen, pdir, ret, nat):
    """Drop this precinct's return (do not deliver it)."""
    Path(ret).unlink(missing_ok=True)
    mounted(scen, f"dropped {pid(precinct_number(pdir))}'s return on the path")


def t14(scen, pdir, ret, nat):
    """Re-sign with the real key but a wrong election id (T14a). The wrong-close
    variant (T14b) is produced by the CANVASS_T14 env set to 'close'."""
    me = pid(precinct_number(pdir))
    base = base_id(pdir)
    if os.environ.get("CANVASS_T14") == "close":
        blk, _ = read_close(pdir)
        resign_from(pdir, ret, close_block=blk + 1, tip="ab" * 32)
        mounted(scen, f"T14b: re-signed {me} with a stale close reference (block {blk + 1}, wrong tip)")
    else:
        resign_from(pdir, ret, election_id=f"wrong-{me}")
        mounted(scen, f"T14a: re-signed {me} under a wrong election id wrong-{me}")


def t15(scen, pdir, ret, nat):
    """Sign with the real key over a ledger copy with one ballot line omitted."""
    short = Path(nat) / ".t15-ledger.ndjson"
    lines = (Path(pdir) / "ledger" / "ballots.ndjson").read_text().splitlines()
    short.write_text("\n".join(lines[1:]) + "\n")
    resign_from(pdir, ret, ledger=str(short))
    short.unlink(missing_ok=True)
    mounted(scen, f"re-signed {pid(precinct_number(pdir))} over a ledger missing one ballot")


def t16(scen, pdir, ret, nat):
    """Forge the aggregate (doctor one ballot) and re-sign with the stolen real
    key. The honest return is overwritten."""
    bad = Path(nat) / ".t16-ledger.ndjson"
    shutil.copyfile(Path(pdir) / "ledger" / "ballots.ndjson", bad)
    flip_first_ballot_ciphertext(bad)
    resign_from(pdir, ret, ledger=str(bad))
    bad.unlink(missing_ok=True)
    mounted(scen, f"re-signed {pid(precinct_number(pdir))} over a doctored aggregate with the real key")


def t21(scen, pdir, ret, nat):
    """Sign with another registered precinct's key."""
    sib = pdir_name(sibling_number(scen))
    donor_key = Path(pdir).parent / sib / "authority.key"
    if not donor_key.exists():
        skip(scen, f"donor key {sib}/authority.key not present")
        return
    resign_from(pdir, ret, key=str(donor_key))
    mounted(scen, f"re-signed {pid(precinct_number(pdir))} with {sib}'s authority key")


def t24(scen, nat):
    """After all returns, replace one accepted file in national/returns/ with a
    doctored copy (flip one aggregate byte). The canvass re-verifies on read, so
    the replaced return is invalid: signature, completeness, recompute and
    national_sum all fire."""
    victim_n = int(os.environ.get("CANVASS_T24_VICTIM", "1"))
    victim = Path(nat) / "returns" / f"{pid(victim_n)}.json"
    if not victim.exists():
        skip(scen, f"{victim.name} not present")
        return
    r = json.loads(victim.read_text())
    c = r["contests"][0]["sum_c2"]
    r["contests"][0]["sum_c2"] = c[:-2] + ("00" if c[-2:] != "00" else "01")
    victim.write_text(json.dumps(r, indent=2))
    mounted(scen, f"replaced accepted {victim.name} with a doctored copy on the national server")


RETURN_HOOK = {
    "T9": t9, "T10": t10, "T11": t11, "T12": t12, "T13": t13,
    "T14": t14, "T15": t15, "T16": t16, "T21": t21,
}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scenario", required=True, choices=sorted(set(RETURN_HOOK) | {"T24"}))
    ap.add_argument("args", nargs="*", help="hook positional args appended by the driver")
    a = ap.parse_args(argv)
    scen = a.scenario
    hook = os.environ.get("SAKSI_HOOK", "return")

    if scen == "T24":
        if hook != "national":
            skip(scen, f"runs at the national hook, not {hook}")
            return 0
        (nat,) = a.args
        t24(scen, nat)
        return 0

    if hook != "return":
        skip(scen, f"runs at the return hook, not {hook}")
        return 0
    pdir, ret, nat = a.args
    if precinct_number(pdir) != target_number(scen):
        skip(scen, f"{Path(pdir).name} is not the target precinct {target_number(scen)}")
        return 0
    RETURN_HOOK[scen](scen, pdir, ret, nat)
    return 0


if __name__ == "__main__":
    sys.exit(main())
