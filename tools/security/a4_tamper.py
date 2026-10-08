#!/usr/bin/env python3
"""A4 tamper helper (run tooling). Flips ONE byte in a copy of an exported
public record.
  ballot <src> <dst>  flip 1 content byte of ballot[0]'s first Ciphertext.data (f4>f3)
  tally  <src> <dst>  flip 1 byte of the signed tally's totals (TallyResult f3)
"""
import json, os, shutil, sys

def _varint(b,i):
    s=0;v=0
    while True:
        x=b[i];i+=1;v|=(x&0x7F)<<s
        if not(x&0x80):return v,i
        s+=7

def find(b,want):
    """first field `want`: return (wt, content_start, content_len). For wt0,
    content spans the varint bytes."""
    i=0;n=len(b)
    while i<n:
        key,i=_varint(b,i);fn=key>>3;wt=key&7
        if wt==2:
            ln,i=_varint(b,i)
            if fn==want:return wt,i,ln
            i+=ln
        elif wt==0:
            st=i;_,i=_varint(b,i)
            if fn==want:return wt,st,i-st
        elif wt==5:
            if fn==want:return wt,i,4
            i+=4
        elif wt==1:
            if fn==want:return wt,i,8
            i+=8
        else:raise ValueError(f"wt {wt}")
    raise ValueError(f"field {want} not found")

def do_ballot(src,dst):
    os.makedirs(dst,exist_ok=True)
    shutil.copyfile(f"{src}/header.json",f"{dst}/header.json")
    lines=open(f"{src}/ballots.ndjson").readlines()
    b=bytearray.fromhex(lines[0].strip())
    _,cs,cl=find(b,4)                       # first Ciphertext (repeated f4)
    sub=b[cs:cs+cl]
    _,ds,dl=find(sub,3)                      # Ciphertext.data (f3, bytes)
    off=ds+dl//2; sub[off]^=0x01; b[cs:cs+cl]=sub
    lines[0]=b.hex()+"\n"
    open(f"{dst}/ballots.ndjson","w").writelines(lines)
    print(f"ballot: flipped 1 byte of ballot[0] ciphertext.data at sub-offset {off}")

def do_tally(src,dst):
    os.makedirs(dst,exist_ok=True)
    shutil.copyfile(f"{src}/ballots.ndjson",f"{dst}/ballots.ndjson")
    h=json.load(open(f"{src}/header.json"))
    t=bytearray.fromhex(h["tally"])
    wt,cs,cl=find(t,3)                        # TallyResult.totals (f3 uint64)
    off=cs+(cl//2 if wt==2 else 0); t[off]^=0x01
    h["tally"]=t.hex()
    json.dump(h,open(f"{dst}/header.json","w"))
    print(f"tally: flipped 1 byte of tally totals (wt{wt}) at offset {off}")

if __name__=="__main__":
    mode,src,dst=sys.argv[1:4]
    (do_ballot if mode=="ballot" else do_tally)(src,dst)
