#!/usr/bin/env python3
# X1: full TCP connect scan of OWN server IP only (Hetzner ToS: own rented IP).
import socket, concurrent.futures, sys, time, json
IP = "157.180.56.166"
assert IP == "157.180.56.166", "scan own IP only"
def probe(p):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    try:
        if s.connect_ex((IP, p)) == 0:
            return p
    except OSError:
        pass
    finally:
        s.close()
    return None
t0 = time.time()
openp = []
with concurrent.futures.ThreadPoolExecutor(max_workers=200) as ex:
    for r in ex.map(probe, range(1, 65536)):
        if r: openp.append(r)
openp.sort()
out = {"ip": IP, "open_tcp": openp, "scanned_ports": 65535,
       "elapsed_s": round(time.time()-t0, 1), "method": "python full-connect"}
print(json.dumps(out, indent=2))
