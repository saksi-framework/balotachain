#!/usr/bin/env bash
#
# live-dns.sh: point vote and t1 to t5 under the domain at this Mac, through Cloudflare.
#
#   tools/live-dns.sh [--ip A.B.C.D | --iface NAME] [--domain NAME] [--token-file FILE]
#                     [--dry-run] [--check] [--remove [--yes]] [--allow-public]
#
#   --ip A.B.C.D     the address to publish (default: this Mac's address on the
#                    interface of the default route; the script says which one)
#   --iface NAME     take the address of this interface instead (for example en0)
#   --domain NAME    the Cloudflare zone (default vancornelio.dev)
#   --token-file F   Cloudflare API token, DNS edit on that zone (default
#                    ~/.secrets/cloudflare.token; must be readable by its owner only)
#   --dry-run        print what would be created or changed; no API call at all
#   --check          only check that the six names resolve to the address, through a
#                    public resolver (1.1.1.1) and this Mac's own resolver, for up to 120 s
#   --remove         delete the six A records (after the defense); lists them first and
#                    asks for the word REMOVE unless --yes is given
#   --allow-public   allow an address outside 10/8, 172.16/12 and 192.168/16
#
# The six names are vote, t1, t2, t3, t4 and t5. Each becomes an A record with
# proxied false, TTL 60 and the comment "balotachain live demo": created if
# missing, updated if an A record with that name exists. If a name has a record
# of another type, the script stops before changing anything. It never deletes or
# changes any other record. After a write it runs the --check step.
#
# The token reaches curl on its standard input as a config line. It is never a
# command-line argument, never exported, and never printed. Needs curl, jq and dig.
set -euo pipefail

LV_PROG=live-dns
BC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tools/live-lib.sh
. "$BC_DIR/tools/live-lib.sh"

IP="" IFACE="" DOMAIN="$LV_DEFAULT_DOMAIN"
TOKEN_FILE="$HOME/.secrets/cloudflare.token"
DRY=0 CHECK_ONLY=0 REMOVE=0 YES=0 ALLOW_PUBLIC=0
NAMES="vote t1 t2 t3 t4 t5"
TTL=60
COMMENT="balotachain live demo"
CF_API="https://api.cloudflare.com/client/v4"
CHECK_SECONDS="${LIVE_DNS_CHECK_SECONDS:-120}"

while [ $# -gt 0 ]; do
	case "$1" in
	--ip) IP="${2:?--ip needs an address}"; shift 2 ;;
	--iface) IFACE="${2:?--iface needs an interface name}"; shift 2 ;;
	--domain) DOMAIN="${2:?--domain needs a name}"; shift 2 ;;
	--token-file) TOKEN_FILE="${2:?--token-file needs a path}"; shift 2 ;;
	--dry-run) DRY=1; shift ;;
	--check) CHECK_ONLY=1; shift ;;
	--remove) REMOVE=1; shift ;;
	--yes) YES=1; shift ;;
	--allow-public) ALLOW_PUBLIC=1; shift ;;
	-h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
	*) lv_fail "unknown flag $1 (see --help)." ;;
	esac
done

[ $((CHECK_ONLY + REMOVE)) -le 1 ] || lv_fail "--check and --remove cannot be used together."
[ $((CHECK_ONLY + DRY)) -le 1 ] || lv_fail "--check and --dry-run cannot be used together: the check sends DNS queries, and a dry run sends nothing."
[ -z "$IP" ] || [ -z "$IFACE" ] || lv_fail "give --ip or --iface, not both."
case "$DOMAIN" in
'' | *[!A-Za-z0-9.-]* | .* | *.) lv_fail "--domain '$DOMAIN' is not a domain name." ;;
esac
DOMAIN="$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z')"

# --- the address -------------------------------------------------------------

default_iface() {
	if command -v route >/dev/null 2>&1 && route -n get default >/dev/null 2>&1; then
		route -n get default 2>/dev/null | awk '/interface:/ { print $2; exit }'
	elif command -v ip >/dev/null 2>&1; then
		ip route show default 2>/dev/null | awk '{ for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }'
	fi
}

iface_v4() {
	if command -v ipconfig >/dev/null 2>&1 && [ "$(uname -s)" = Darwin ]; then
		ipconfig getifaddr "$1" 2>/dev/null || true
	elif command -v ip >/dev/null 2>&1; then
		ip -4 -o addr show dev "$1" 2>/dev/null | awk '{ split($4, a, "/"); print a[1]; exit }'
	fi
}

if [ "$REMOVE" = 0 ]; then
	if [ -z "$IP" ]; then
		if [ -z "$IFACE" ]; then
			IFACE="$(default_iface)"
			[ -n "$IFACE" ] || lv_fail "this Mac has no default route, so there is no network to publish. Join the hotspot first, or pass --ip."
			lv_say "using the default-route interface $IFACE"
		else
			lv_say "using the interface $IFACE"
		fi
		IP="$(iface_v4 "$IFACE")"
		[ -n "$IP" ] || lv_fail "the interface $IFACE has no IPv4 address. Join the hotspot first, or pass --ip or --iface."
	fi
	lv_valid_v4 "$IP" || lv_fail "'$IP' is not an IPv4 address."
	if ! lv_is_private_v4 "$IP"; then
		[ "$ALLOW_PUBLIC" = 1 ] || lv_fail "$IP is not a private address (10/8, 172.16/12, 192.168/16). The target is always a hotspot or LAN address. Pass --allow-public only if you really mean it."
		lv_warn "$IP is a public address; publishing it because --allow-public was given."
	fi
	lv_say "address: $IP"
fi

# --- the check ---------------------------------------------------------------

# check_names: wait up to CHECK_SECONDS for every name to resolve to IP through
# 1.1.1.1 and through this Mac's own resolver.
check_names() {
	local deadline now name fqdn pub loc all_ok pub_only stale
	command -v dig >/dev/null 2>&1 || lv_fail "dig is missing; it is needed for the check."
	deadline=$(($(date +%s) + CHECK_SECONDS))
	lv_say "checking that the names resolve to $IP (up to $CHECK_SECONDS s)"
	while :; do
		all_ok=1 pub_only="" stale=""
		for name in $NAMES; do
			fqdn="$name.$DOMAIN"
			pub="$(dig +short +time=3 +tries=1 @1.1.1.1 "$fqdn" A 2>/dev/null | grep -E '^[0-9.]+$' | head -n1 || true)"
			loc="$(lv_resolve_v4 "$fqdn" || true)"
			if [ "$pub" != "$IP" ] || [ "$loc" != "$IP" ]; then
				all_ok=0
				if [ "$pub" = "$IP" ] && [ -z "$loc" ]; then pub_only="$pub_only $fqdn"; fi
				if [ -n "$loc" ] && [ "$loc" != "$IP" ]; then stale="$stale $fqdn"; fi
			fi
		done
		now=$(date +%s)
		if [ "$all_ok" = 1 ] || [ "$now" -ge "$deadline" ]; then break; fi
		sleep 5
	done
	for name in $NAMES; do
		fqdn="$name.$DOMAIN"
		pub="$(dig +short +time=3 +tries=1 @1.1.1.1 "$fqdn" A 2>/dev/null | grep -E '^[0-9.]+$' | head -n1 || true)"
		loc="$(lv_resolve_v4 "$fqdn" || true)"
		printf '    %-24s public resolver: %-16s this Mac: %s\n' "$fqdn" "${pub:-none}" "${loc:-none}"
	done
	if [ "$all_ok" = 1 ]; then
		lv_say "all six names resolve to $IP, publicly and on this Mac."
		return 0
	fi
	if [ -n "$pub_only" ]; then
		printf '%s: the public resolver has the address but this Mac does not, for%s.\n' "$LV_PROG" "$pub_only" >&2
		printf '%s: two causes are known. (1) This Mac cached a "no such name" answer from a lookup made before the records existed; it clears by itself in about 5 minutes, or at once if you run: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder (this script does not run sudo). (2) This network'\''s DNS drops private addresses (DNS rebinding protection); if the names still do not resolve after the flush, use the hotspot, whose DNS passes them. Then run tools/live-dns.sh --check again.\n' "$LV_PROG" >&2
	fi
	if [ -n "$stale" ]; then
		printf '%s: this Mac resolves%s to another address than %s.\n' "$LV_PROG" "$stale" "$IP" >&2
		printf '%s: its cache may hold an old answer from another network: run sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder, then run tools/live-dns.sh --check again.\n' "$LV_PROG" >&2
	fi
	if [ -z "$pub_only$stale" ]; then
		printf '%s: not every name resolves to %s yet. Wait a minute and run tools/live-dns.sh --check again.\n' "$LV_PROG" "$IP" >&2
	fi
	return 1
}

if [ "$CHECK_ONLY" = 1 ]; then
	check_names
	exit
fi

# --- dry run: no API call at all ------------------------------------------------

if [ "$DRY" = 1 ]; then
	if [ "$REMOVE" = 1 ]; then
		lv_say "dry run: would look up and delete the A records named:"
		for name in $NAMES; do lv_note "$name.$DOMAIN"; done
	else
		lv_say "dry run: would create, or update if an A record exists, in zone $DOMAIN:"
		for name in $NAMES; do
			lv_note "$name.$DOMAIN  A  $IP  proxied false  TTL $TTL  comment \"$COMMENT\""
		done
		lv_note "A name that holds a record of another type would stop the run before any change."
	fi
	lv_say "dry run: no request was sent to Cloudflare."
	exit 0
fi

# --- the API -----------------------------------------------------------------

command -v curl >/dev/null 2>&1 || lv_fail "curl is missing."
command -v jq >/dev/null 2>&1 || lv_fail "jq is missing (brew install jq)."
[ -f "$TOKEN_FILE" ] || lv_fail "the token file $TOKEN_FILE does not exist. Pass --token-file."
[ -r "$TOKEN_FILE" ] || lv_fail "the token file $TOKEN_FILE cannot be read."
lv_private_to_owner "$TOKEN_FILE" || lv_fail "the token file $TOKEN_FILE can be read by group or others (mode $(lv_perm "$TOKEN_FILE")). Run chmod 600 on it first."
# A Cloudflare token is letters, digits, dash and underscore. Anything else
# (a quote, a space inside it) would break the curl config line, so refuse.
if tr -d '\r\n' <"$TOKEN_FILE" | LC_ALL=C grep -q '[^A-Za-z0-9_-]'; then
	lv_fail "the token file $TOKEN_FILE holds characters a Cloudflare token does not have. Check the file."
fi
[ -n "$(tr -d ' \t\r\n' <"$TOKEN_FILE" | head -c 1)" ] || lv_fail "the token file $TOKEN_FILE is empty."

WORK="$(mktemp -d "${TMPDIR:-/tmp}/live-dns.XXXXXX")"
chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT

# cf <METHOD> <path> [body file]: call the API and print the JSON answer. The
# token goes to curl on stdin, inside a config line built by printf (a shell
# builtin) and tr reading the file in place.
cf() {
	local method="$1" path="$2" body="${3:-}" out
	out="$WORK/answer.json"
	if [ -n "$body" ]; then
		{ printf 'header = "Authorization: Bearer '; tr -d '\r\n' <"$TOKEN_FILE"; printf '"\n'; } |
			curl -sS --max-time 30 -K - -X "$method" -H 'Content-Type: application/json' \
				--data-binary "@$body" -o "$out" "$CF_API$path" ||
			lv_fail "the request $method $path did not reach Cloudflare."
	else
		{ printf 'header = "Authorization: Bearer '; tr -d '\r\n' <"$TOKEN_FILE"; printf '"\n'; } |
			curl -sS --max-time 30 -K - -X "$method" -o "$out" "$CF_API$path" ||
			lv_fail "the request $method $path did not reach Cloudflare."
	fi
	if ! jq -e '.success == true' "$out" >/dev/null 2>&1; then
		printf '%s: Cloudflare refused %s %s: %s\n' "$LV_PROG" "$method" "$path" \
			"$(jq -r '[.errors[]? | "\(.code) \(.message)"] | join("; ")' "$out" 2>/dev/null || echo 'no readable answer')" >&2
		exit 1
	fi
	cat "$out"
}

# The zone's name is checked here too, lower-cased, not left to the API's filter.
ZONE_ID="$(cf GET "/zones?name=$DOMAIN" | jq -r --arg d "$DOMAIN" '[.result[] | select((.name | ascii_downcase) == $d)][0].id // empty')"
[ -n "$ZONE_ID" ] || lv_fail "the token cannot see a zone named $DOMAIN."
lv_say "zone $DOMAIN found"

# Look every name up first, so a wrong-type record stops the run before any change.
for name in $NAMES; do
	fqdn="$name.$DOMAIN"
	cf GET "/zones/$ZONE_ID/dns_records?name=$fqdn&per_page=100" >"$WORK/$name.raw.json"
	# Keep only records whose name is exactly this one (lower-cased), with the
	# type upper-cased, so every decision below rests on our own check and not
	# on the API's name filter.
	jq --arg n "$fqdn" '{result: [.result[] | select((.name | ascii_downcase) == $n) | .type |= ascii_upcase]}' \
		"$WORK/$name.raw.json" >"$WORK/$name.json"
	dropped="$(jq -r --arg n "$fqdn" '[.result[] | select((.name | ascii_downcase) != $n)] | length' "$WORK/$name.raw.json")"
	[ "$dropped" = 0 ] || lv_warn "Cloudflare returned $dropped record(s) for $fqdn under another name; they are ignored and left alone."
	other="$(jq -r '[.result[] | select(.type != "A") | .type] | unique | join(", ")' "$WORK/$name.json")"
	count_a="$(jq -r '[.result[] | select(.type == "A")] | length' "$WORK/$name.json")"
	if [ "$REMOVE" = 0 ]; then
		[ -z "$other" ] || lv_fail "$fqdn already has a record of type $other. Nothing was changed. Remove or rename that record by hand first; this script only manages A records."
		[ "$count_a" -le 1 ] || lv_fail "$fqdn has $count_a A records. Nothing was changed. Leave one at most, then run again."
	fi
done

if [ "$REMOVE" = 1 ]; then
	found=0
	lv_say "A records that would be deleted:"
	for name in $NAMES; do
		while IFS= read -r line; do
			[ -n "$line" ] || continue
			lv_note "$line"
			found=$((found + 1))
		done <<EOF
$(jq -r '.result[] | select(.type == "A") | "\(.name)  A  \(.content)  comment: \(.comment // "none")"' "$WORK/$name.json")
EOF
	done
	if [ "$found" = 0 ]; then
		lv_say "none of the six names has an A record. Nothing to delete."
		exit 0
	fi
	if [ "$YES" = 0 ]; then
		printf 'Type REMOVE to delete these %s records: ' "$found"
		read -r answer || answer=""
		[ "$answer" = REMOVE ] || lv_fail "not confirmed. Nothing was deleted."
	fi
	for name in $NAMES; do
		for id in $(jq -r '.result[] | select(.type == "A") | .id' "$WORK/$name.json"); do
			cf DELETE "/zones/$ZONE_ID/dns_records/$id" >/dev/null
			lv_note "deleted $name.$DOMAIN"
		done
	done
	lv_say "the A records are removed. Delete or roll the Cloudflare token now (see docs/live-demo/README.md)."
	exit 0
fi

for name in $NAMES; do
	fqdn="$name.$DOMAIN"
	jq -n --arg n "$fqdn" --arg ip "$IP" --arg c "$COMMENT" --argjson ttl "$TTL" \
		'{type: "A", name: $n, content: $ip, ttl: $ttl, proxied: false, comment: $c}' >"$WORK/body.json"
	id="$(jq -r '[.result[] | select(.type == "A")][0].id // empty' "$WORK/$name.json")"
	if [ -z "$id" ]; then
		cf POST "/zones/$ZONE_ID/dns_records" "$WORK/body.json" >/dev/null
		lv_note "created $fqdn -> $IP"
	else
		same="$(jq -r --arg ip "$IP" --arg c "$COMMENT" --argjson ttl "$TTL" \
			'[.result[] | select(.type == "A")][0] | (.content == $ip and .proxied == false and .ttl == $ttl and .comment == $c)' "$WORK/$name.json")"
		if [ "$same" = true ]; then
			lv_note "unchanged $fqdn -> $IP"
		else
			old_comment="$(jq -r '[.result[] | select(.type == "A")][0].comment // ""' "$WORK/$name.json")"
			if [ "$old_comment" != "$COMMENT" ]; then
				lv_note "replacing an A record this kit did not make: $fqdn was $(jq -r '[.result[] | select(.type == "A")][0].content' "$WORK/$name.json"), comment \"${old_comment:-none}\""
			fi
			cf PUT "/zones/$ZONE_ID/dns_records/$id" "$WORK/body.json" >/dev/null
			lv_note "updated $fqdn -> $IP"
		fi
	fi
done

check_names
