#!/usr/bin/env bash
#
# live-reset.sh: set the live demo aside for a clean second run.
#
#   tools/live-reset.sh [--state DIR] [--yes] [live-up.sh flags such as --saksi]
#
# When it is needed: an election is left in a state it cannot be finished or
# abandoned from (open with the voters gone, or closed and stuck), or the
# console must start with no election at all. After a verified or abandoned
# election it is not needed: "Set up the next election" on the presenter page
# (on an abandoned one, the Next election form already open there) makes the
# next election on the same console, with a new election id.
#
#   --state DIR   the kit's state folder (default ~/.balotachain-live)
#   --yes         do not ask for the word RESET
#
# It runs tools/live-up.sh down, then moves runs/ and trustees/ into
# archive/<UTC time>/ inside the state folder (a rename on the same disk: the
# run folders' private/ parts, which hold the issuer key, the locked voter list,
# the check-in state and the signatures, are never copied or deleted). The
# archive then holds them; delete it after the defense with
# rm -rf <state>/archive/<UTC time>. Accounts, tokens, the handout and the
# voter list file (<state>/voter-list.csv) are kept. It never touches Fabric:
# the chain keeps the old elections, and the next election gets a new id.
# --saksi, --domain, --tls-cert and --tls-key are passed on to tools/live-up.sh down.
set -euo pipefail

LV_PROG=live-reset
BC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tools/live-lib.sh
. "$BC_DIR/tools/live-lib.sh"

STATE_DIR="$LV_DEFAULT_STATE"
YES=0
PASS=()
DOMAIN="$LV_DEFAULT_DOMAIN"
while [ $# -gt 0 ]; do
	case "$1" in
	--state) STATE_DIR="${2:?--state needs a folder}"; shift 2 ;;
	--yes) YES=1; shift ;;
	--domain) DOMAIN="${2:?--domain needs a name}"; PASS+=("$1" "$2"); shift 2 ;;
	-h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
	--saksi | --tls-cert | --tls-key) PASS+=("$1" "${2:?$1 needs a value}"); shift 2 ;;
	*) lv_fail "unknown flag $1 (see --help)." ;;
	esac
done

STATE="$(lv_state_open "$STATE_DIR" 0)"

moving=""
for d in runs trustees; do
	[ ! -e "$STATE/$d" ] || moving="$moving $d"
done

case "$moving" in
" runs trustees") what="runs/ and trustees/" ;;
" runs") what="runs/" ;;
" trustees") what="trustees/" ;;
*) what="" ;;
esac
if [ -n "$what" ]; then
	lv_say "this stops the console and the five trustees, then moves $what into $STATE/archive/."
else
	lv_say "this stops the console and the five trustees. There is no runs/ or trustees/ folder to move yet."
fi
lv_note "Accounts, tokens and passwords are kept. Fabric is not touched; the chain keeps the old elections."
lv_note "Needed only when the last election cannot be finished or abandoned (open with the voters gone, or closed and stuck), or to start with no election. After a verified or abandoned election, \"Set up the next election\" on the presenter page (on an abandoned one, its Next election form) is enough."
if [ "$YES" = 0 ]; then
	printf 'Type RESET to go on: '
	read -r answer || answer=""
	[ "$answer" = RESET ] || lv_fail "not confirmed. Nothing was changed."
fi

bash "$BC_DIR/tools/live-up.sh" down --state "$STATE" ${PASS[@]+"${PASS[@]}"} ||
	lv_fail "live-up.sh down did not stop everything, so nothing was moved. Stop the process it named, then run this again."

if [ -n "$moving" ]; then
	ARCHIVE="$(lv_new_archive "$STATE")"
	for d in $moving; do
		mv "$STATE/$d" "$ARCHIVE/$d"
	done
	lv_say "moved $what to $ARCHIVE"
	lv_note "the archive holds the old runs' voter lists, check-ins and signatures; delete it after the defense with: rm -rf $ARCHIVE"
else
	lv_say "there was nothing to move."
fi

cat <<EOF

The kit is reset. Before the next run:

1. A phone that showed a failed check keeps that warning until the site's data
   is cleared on that phone. Clearing the data is the only way to clear it.
2. Every phone that voted in the last run clears the site's data for
   vote.$DOMAIN before the next run, so it starts with no credential, no
   receipt and no check-in. The steps for iOS Safari and Android Chrome are in
   docs/live-demo/README.md.
3. Start again with tools/live-up.sh.
EOF
