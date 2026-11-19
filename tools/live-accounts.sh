#!/usr/bin/env bash
#
# live-accounts.sh: make the accounts and trustee tokens for the live election demo.
#
#   tools/live-accounts.sh [--state DIR] [--saksi DIR] [--admin NAME]
#                          [--trustees N] [--force]
#
#   --state DIR     the kit's state folder (default ~/.balotachain-live, mode 0700)
#   --saksi DIR     saksi checkout holding target/saksi-campaign (default ~/dev/saksi-live)
#   --admin NAME    the presenter's admin account (default ban)
#   --trustees N    trustee accounts and tokens; only 5 is accepted, because
#                   tools/live-up.sh starts exactly five trustee processes
#   --force         replace existing accounts: the old accounts/, tokens/ and handout/
#                   folders are moved into archive/<UTC time>/ inside the state folder
#
# It writes, inside the state folder (every file mode 0600):
#   accounts/console.json              the admin account (the console's --auth-file)
#   accounts/trustee-<N>.json          one trustee account each (that process's --auth-file)
#   tokens/trustee-<N>.token           the raw bearer token (that process's --token-file)
#   tokens/console-trustee-tokens.json the tokens' SHA-256 (the console's --trustee-tokens)
#   handout/passwords.txt              every account with its password, for the presenter
#
# It makes no voter accounts. Voters are the precinct's voter list, uploaded on the
# presenter page at setup, and check in on their phones with no account
# (docs/live-demo/run-sheet.md; saksi docs/live/voter-list-api.md).
#
# Passwords are 15 lowercase letters from /dev/urandom, without i, l and o (about 67 bits).
# They are hashed by `saksi-campaign hash-password` on stdin. No password or token is
# ever a command-line argument or printed; the script prints the handout's path only.
#
# It needs the saksi-campaign binary; tools/live-up.sh --build builds it.
set -euo pipefail

LV_PROG=live-accounts
BC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tools/live-lib.sh
. "$BC_DIR/tools/live-lib.sh"

STATE_DIR="$LV_DEFAULT_STATE"
SAKSI_DIR="$HOME/dev/saksi-live"
ADMIN=ban TRUSTEES=5 FORCE=0

need_count() {
	case "$2" in
	'' | *[!0-9]*) lv_fail "$1 needs a whole number, got '$2'." ;;
	esac
}

while [ $# -gt 0 ]; do
	case "$1" in
	--state) STATE_DIR="${2:?--state needs a folder}"; shift 2 ;;
	--saksi) SAKSI_DIR="${2:?--saksi needs a folder}"; shift 2 ;;
	--admin) ADMIN="${2:?--admin needs a name}"; shift 2 ;;
	--voters | --spares) lv_fail "$1 is gone: voters are the precinct's voter list, uploaded at setup, and need no account (see docs/live-demo/run-sheet.md)." ;;
	--trustees) TRUSTEES="${2:-}"; need_count --trustees "$TRUSTEES"; shift 2 ;;
	--force) FORCE=1; shift ;;
	-h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
	*) lv_fail "unknown flag $1 (see --help)." ;;
	esac
done

case "$ADMIN" in
'' | *[!A-Za-z0-9._-]*) lv_fail "--admin must be letters, digits, dot, dash or underscore." ;;
voter[0-9]* | trustee[0-9]*) lv_fail "--admin must not look like a voter or trustee account name." ;;
esac
# Leading zeros would make the shell read the number as octal ("08" fails).
TRUSTEES=$((10#$TRUSTEES))
[ "$TRUSTEES" -eq 5 ] || lv_fail "--trustees must be 5: tools/live-up.sh starts exactly five trustee processes (LV_TRUSTEES in tools/live-lib.sh)."

SAKSI_DIR="$(cd "$SAKSI_DIR" 2>/dev/null && pwd)" || lv_fail "the saksi checkout was not found. Pass --saksi <folder>."
lv_saksi_bins "$SAKSI_DIR"
[ -x "$CONSOLE_BIN" ] || lv_fail "the saksi-campaign binary is not built at $CONSOLE_BIN. $(lv_build_hint "$SAKSI_DIR")"

STATE="$(lv_state_open "$STATE_DIR" 1)"
umask 077

# Refuse to replace accounts unless --force. With --force the old set is kept
# exactly as it is until the new set is complete; only then is it moved into
# the archive (a rename inside the state folder: nothing is deleted or copied
# anywhere else), so a failure half way leaves the old accounts in place.
existing=""
for d in accounts tokens handout; do
	if [ -e "$STATE/$d" ]; then existing="$existing $d"; fi
done
if [ -n "$existing" ]; then
	[ "$FORCE" = 1 ] || lv_fail "the state folder $STATE already holds accounts (${existing# }). Nothing was changed. Use --force to archive them and make new ones."
fi

# Everything is written into a staging folder first, then moved into place, so
# a failure half way leaves no partial account set behind.
STAGE="$(mktemp -d "$STATE/.accounts-staging.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

ALPHABET='abcdefghjkmnpqrstuvwxyz'
PW_LEN=15

# new_password: print a fresh password. Called only inside $( ), so the value
# goes into a shell variable and nowhere else.
new_password() {
	local pw=""
	set +o pipefail
	while [ "${#pw}" -lt "$PW_LEN" ]; do
		pw="$pw$(head -c 256 /dev/urandom | LC_ALL=C tr -dc "$ALPHABET")"
	done
	set -o pipefail
	printf '%s' "${pw:0:$PW_LEN}"
}

# hash_password: read the password on stdin (from printf, a shell builtin) and
# print its bcrypt hash.
hash_password() {
	local h
	h="$("$CONSOLE_BIN" hash-password 2>/dev/null)" || lv_fail "saksi-campaign hash-password failed."
	case "$h" in
	'$2a$12$'* | '$2b$12$'* | '$2y$12$'*) ;;
	*) lv_fail "saksi-campaign hash-password gave something that is not a cost-12 bcrypt hash." ;;
	esac
	printf '%s' "$h"
}

HANDOUT="$STAGE/passwords.txt"
{
	printf '# BalotaChain live demo accounts. Keep this file private.\n'
	printf '# The admin account is the presenter'"'"'s; each trustee account is one trustee tab.\n'
	printf '# Voters have no account: they check in from the voter list.\n'
	printf '# username\tpassword\trole\n'
} >"$HANDOUT"

# user_entry <username> <role> <trustee_id or empty> <bcrypt hash>
user_entry() {
	if [ -n "$3" ]; then
		printf '  {"username": "%s", "role": "%s", "trustee_id": "%s", "password_bcrypt": "%s"}' "$1" "$2" "$3" "$4"
	else
		printf '  {"username": "%s", "role": "%s", "password_bcrypt": "%s"}' "$1" "$2" "$4"
	fi
}

lv_say "hashing passwords (cost 12, a second or so each)"

# Console accounts: the admin only.
CONSOLE_JSON="$STAGE/console.json"
pw="$(new_password)"
h="$(printf '%s\n' "$pw" | hash_password)"
{
	printf '[\n'
	user_entry "$ADMIN" admin "" "$h"
} >"$CONSOLE_JSON"
printf '%s\t%s\tadmin (presenter)\n' "$ADMIN" "$pw" >>"$HANDOUT"
printf '\n]\n' >>"$CONSOLE_JSON"

# Trustee accounts and tokens: one file of each per trustee process.
TOKENS_JSON="$STAGE/console-trustee-tokens.json"
printf '[\n' >"$TOKENS_JSON"
n=1
while [ "$n" -le "$TRUSTEES" ]; do
	pw="$(new_password)"
	h="$(printf '%s\n' "$pw" | hash_password)"
	{
		printf '[\n'
		user_entry "trustee$n" trustee "$n" "$h"
		printf '\n]\n'
	} >"$STAGE/trustee-$n.json"
	printf 'trustee%s\t%s\ttrustee %s\n' "$n" "$pw" "$n" >>"$HANDOUT"

	tok="$("$CONSOLE_BIN" new-token)" || lv_fail "saksi-campaign new-token failed."
	case "$tok" in
	'' | *[!0-9a-f]*) lv_fail "saksi-campaign new-token gave something that is not a hex token." ;;
	esac
	printf '%s\n' "$tok" >"$STAGE/trustee-$n.token"
	th="$(printf '%s\n' "$tok" | "$CONSOLE_BIN" hash-token 2>/dev/null)" || lv_fail "saksi-campaign hash-token failed."
	tok=""
	case "$th" in
	*[!0-9a-f]*) lv_fail "saksi-campaign hash-token gave something that is not a SHA-256 hex." ;;
	esac
	[ "${#th}" -eq 64 ] || lv_fail "saksi-campaign hash-token gave something that is not a SHA-256 hex."
	[ "$n" -eq 1 ] || printf ',\n' >>"$TOKENS_JSON"
	printf '  {"trustee_id": "%s", "token_sha256": "%s"}' "$n" "$th" >>"$TOKENS_JSON"
	n=$((n + 1))
done
printf '\n]\n' >>"$TOKENS_JSON"
pw=""

chmod 600 "$STAGE"/*

# The new set is complete. Now archive the old one, then move the new one in.
if [ -n "$existing" ]; then
	ARCHIVE="$(lv_new_archive "$STATE")"
	for d in $existing; do
		mv "$STATE/$d" "$ARCHIVE/$d"
	done
	lv_warn "the old${existing} were moved to $ARCHIVE."
	lv_warn "an election in progress stops working with new accounts: phones and trustee processes must sign in again, and the console and trustees must be restarted (tools/live-up.sh down, then up)."
fi
mkdir -p "$STATE/accounts" "$STATE/tokens" "$STATE/handout"
chmod 700 "$STATE/accounts" "$STATE/tokens" "$STATE/handout"

# Move into place.
mv "$CONSOLE_JSON" "$STATE/accounts/console.json"
n=1
while [ "$n" -le "$TRUSTEES" ]; do
	mv "$STAGE/trustee-$n.json" "$STATE/accounts/trustee-$n.json"
	mv "$STAGE/trustee-$n.token" "$STATE/tokens/trustee-$n.token"
	n=$((n + 1))
done
mv "$TOKENS_JSON" "$STATE/tokens/console-trustee-tokens.json"
mv "$HANDOUT" "$STATE/handout/passwords.txt"

lv_say "accounts made in $STATE"
lv_note "admin $ADMIN, trustees trustee1 to trustee$TRUSTEES; no voter accounts (voters check in from the voter list)"
lv_note "the passwords are in $STATE/handout/passwords.txt (mode 0600). This script does not print them."
