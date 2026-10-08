#!/usr/bin/env bash
# B2 (paper case 10 / external attacker): submit a ballot with an identity whose
# CA is NOT on the channel. Expect the peer MSP / gateway to refuse it before the
# chaincode runs (no gate= id: rejection happens at the membership layer).
# Usage: outside_msp_invoke.sh <ballot.hex>
set -euo pipefail
BALLOT="${1:?usage: outside_msp_invoke.sh <ballot.hex>}"
TOOL=/root/ch4-ax42/security/tools/tamper_invoke/tamper_invoke
OUT="$(mktemp -d)"; trap "rm -rf $OUT" EXIT
# Throwaway CA + client cert on the same curve Fabric uses (P-256), self-signed
# by a CA no organization MSP trusts.
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$OUT/ca.key" 2>/dev/null
openssl req -x509 -new -key "$OUT/ca.key" -days 1 -subj "/CN=rogue-ca" -out "$OUT/ca.pem" 2>/dev/null
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$OUT/client.key" 2>/dev/null
openssl req -new -key "$OUT/client.key" -subj "/CN=rogue-user/OU=client" -out "$OUT/client.csr" 2>/dev/null
openssl x509 -req -in "$OUT/client.csr" -CA "$OUT/ca.pem" -CAkey "$OUT/ca.key" -CAcreateserial -days 1 -out "$OUT/client.pem" 2>/dev/null
echo "rogue identity (issuer not a channel MSP):"
openssl x509 -in "$OUT/client.pem" -noout -subject -issuer
echo "submitting SubmitBallot claiming Org1MSP with this foreign cert:"
"$TOOL" submit-raw --ballot "$BALLOT" --cert "$OUT/client.pem" --key "$OUT/client.key" --msp Org1MSP --label "SubmitBallot[rogue-CA cert]"
