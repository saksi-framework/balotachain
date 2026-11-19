#!/usr/bin/env sh
# Regenerate live-election.json, the vote app's test election, with the saksi
# native CLI (`saksi-demo live <op>`, see saksi docs/live/wire-format.md).
#
#   sh apps/vote/src/test/fixture/make-fixture.sh /path/to/saksi-demo
#
# Every key it makes is a THROWAWAY TEST KEY: the issuer and trustee secret
# files live in a temporary directory that is deleted on exit, and the voter
# credential in the output only votes in this fixture election. Nothing here
# is used by a real election.
set -eu

demo=${1:?usage: make-fixture.sh /path/to/saksi-demo}
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
out="$here/live-election.json"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

live() { "$demo" live "$1"; }

election_id="vote-fixture"
positions='[{"id":"president","candidates":["alice","bob","carol"]},
            {"id":"vice-president","candidates":["dan","eve","fay"]}]'
trustees=3
threshold=2

# The election's issuer, and a second issuer the credential is not from.
issuer=$(printf '{"key_file":"%s"}' "$work/issuer.key" | live issuer-keygen)
issuer_pk=$(printf '%s' "$issuer" | jq -r .public_key)
other=$(printf '{"key_file":"%s"}' "$work/other-issuer.key" | live issuer-keygen)
other_pk=$(printf '%s' "$other" | jq -r .public_key)

params_for() {
  jq -n --arg id "$election_id" --argjson positions "$positions" \
    --argjson n "$trustees" --argjson t "$threshold" --arg pk "$1" \
    '{election_id:$id, positions:$positions, trustees:$n, threshold:$t, issuer_public_key:$pk}' |
    live election-params | jq -r .params
}
params=$(params_for "$issuer_pk")
params_other=$(params_for "$other_pk")

# DKG: every trustee makes a receive key, deals, and the console assembles
# the transcript from the commitments.
peers='[]'
i=1
while [ "$i" -le "$trustees" ]; do
  mkdir -p "$work/t$i"
  pk=$(jq -n --argjson id "$i" --arg f "$work/t$i/receive.key" '{trustee_id:$id, key_file:$f}' |
    live trustee-keygen | jq -r .receive_public_key)
  peers=$(printf '%s' "$peers" | jq --argjson id "$i" --arg pk "$pk" '. + [{trustee_id:$id, receive_public_key:$pk}]')
  i=$((i + 1))
done
dealers='[]'
i=1
while [ "$i" -le "$trustees" ]; do
  commitments=$(jq -n --arg f "$work/t$i/receive.key" --arg p "$params" --argjson id "$i" --argjson peers "$peers" \
    '{receive_key_file:$f, params:$p, dealer_id:$id, peers:$peers}' | live dkg-deal | jq .commitments)
  dealers=$(printf '%s' "$dealers" | jq --argjson id "$i" --argjson c "$commitments" '. + [{dealer_id:$id, commitments:$c}]')
  i=$((i + 1))
done
transcript=$(jq -n --arg p "$params" --argjson d "$dealers" '{params:$p, dealers:$d}' | live dkg-transcript)

# One voter's blind issuance, end to end.
begin=$(printf '{}' | live voter-begin)
r=$(jq -n --arg f "$work/issuer.key" --arg bc "$(printf '%s' "$begin" | jq -r .blinded_commitment)" \
  --arg s "$work/session.json" '{issuer_key_file:$f, blinded_commitment:$bc, session_file:$s}' |
  live issue-presign | jq -r .r)
blind=$(printf '%s' "$begin" | jq --arg r "$r" --arg pk "$issuer_pk" '{state:.state, r:$r, issuer_public_key:$pk}' |
  live voter-blind)
s_iss=$(jq -n --arg f "$work/issuer.key" --arg s "$work/session.json" \
  --arg e "$(printf '%s' "$blind" | jq -r .e_prime)" '{issuer_key_file:$f, session_file:$s, e_prime:$e}' |
  live issue-sign | jq -r .s_iss)
final=$(printf '%s' "$blind" | jq --arg s "$s_iss" --arg pk "$issuer_pk" '{state:.state, s_iss:$s, issuer_public_key:$pk}' |
  live voter-finalize)

jq -n \
  --arg id "$election_id" --argjson positions "$positions" \
  --argjson n "$trustees" --argjson t "$threshold" \
  --arg params "$params" --arg params_other "$params_other" \
  --arg issuer_pk "$issuer_pk" --arg other_pk "$other_pk" \
  --argjson transcript "$transcript" --argjson final "$final" \
  '{
    schema: "balotachain-vote-fixture-v1",
    note: "Throwaway test keys. Made by make-fixture.sh with saksi-demo live; never use for a real election.",
    election_id: $id,
    positions: $positions,
    trustees: $n,
    threshold: $t,
    params: $params,
    dkg: $transcript.dkg,
    issuer_public_key: $issuer_pk,
    joint_public_key: $transcript.joint_public_key,
    joint_key_fingerprint: $transcript.joint_key_fingerprint,
    credential: $final.credential,
    commitment: $final.commitment,
    other_issuer: {issuer_public_key: $other_pk, params: $params_other}
  }' >"$out"

printf 'wrote %s\n' "$out"
