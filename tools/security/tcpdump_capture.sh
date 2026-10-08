#!/usr/bin/env bash
# D5: capture peer gRPC (TLS) and console HTTP (plaintext) on loopback, then show
# that peer bytes are TLS ciphertext and console bytes are readable.
# Usage: tcpdump_capture.sh <out_dir> [seconds]
set -euo pipefail
OUT="${1:?usage: tcpdump_capture.sh <out_dir> [seconds]}"; SECS="${2:-20}"
mkdir -p "$OUT"
# peer gRPC = 7051, console HTTP = 8090, both on lo.
timeout "$SECS" tcpdump -i lo -s 0 -w "$OUT/peer-7051.pcap" "tcp port 7051" 2>/dev/null &
P1=$!
timeout "$SECS" tcpdump -i lo -s 0 -w "$OUT/console-8090.pcap" "tcp port 8090" 2>/dev/null &
P2=$!
echo "capturing ${SECS}s on lo: peer 7051 + console 8090 (generate traffic now)"
wait $P1 $P2 || true
echo "=== peer 7051: TLS handshake present? (expect Client/Server Hello, then ciphertext) ==="
tcpdump -r "$OUT/peer-7051.pcap" -A 2>/dev/null | grep -aiE "TLS|handshake|application_data" | head -3 || true
strings "$OUT/peer-7051.pcap" | grep -aiE "SubmitBallot|election|nullifier" | head -3 && echo "WARNING: peer plaintext leak" || echo "peer: no plaintext chaincode terms found (TLS ok)"
echo "=== console 8090: plaintext HTTP readable? (expect readable HTTP) ==="
strings "$OUT/console-8090.pcap" | grep -aiE "HTTP/1|GET /|POST /|api/" | head -3 || echo "console: no HTTP strings captured (no traffic in window?)"
