# shellcheck shell=bash
#
# live-lib.sh: helpers shared by the live demo kit (live-accounts.sh,
# live-dns.sh, live-up.sh, live-reset.sh). Sourced, never run. Written for
# macOS's /bin/bash 3.2: no associative arrays, no mapfile, no ${x,,}.
#
# Nothing here prints a password, a token or a key.

LV_DEFAULT_STATE="${HOME}/.balotachain-live"
LV_DEFAULT_DOMAIN="vancornelio.dev"
LV_TRUSTEES="1 2 3 4 5"
LV_CONSOLE_PORT=8443
# The demo precinct, passed to the console as --live-precinct. Four digits and a
# capital letter; every screen shows it as "Precinct 0001A (demonstration)".
LV_PRECINCT=0001A
# The real voter list (the members' rows) lives in the state folder, mode 0600,
# outside every repository. No script reads it or prints it; live-up.sh only
# checks its mode.
LV_VOTER_LIST_NAME=voter-list.csv

lv_say() { printf '==> %s\n' "$*"; }
lv_note() { printf '    %s\n' "$*"; }
lv_warn() { printf '%s: warning: %s\n' "${LV_PROG:-live}" "$*" >&2; }
lv_fail() {
	printf '%s: %s\n' "${LV_PROG:-live}" "$*" >&2
	exit 1
}

# lv_perm <path>: the permission bits in octal (for example 600).
lv_perm() {
	stat -L -f '%Lp' "$1" 2>/dev/null || stat -L -c '%a' "$1" 2>/dev/null
}

# lv_private_to_owner <path>: true when group and others have no access.
lv_private_to_owner() {
	local p
	p="$(lv_perm "$1")" || return 1
	[ -n "$p" ] || return 1
	# The last two octal digits are group and others.
	case "$p" in
	*00) return 0 ;;
	*) return 1 ;;
	esac
}

# lv_state_open <dir> <create:0|1>: make sure the state folder exists with mode
# 0700, and print its absolute path.
lv_state_open() {
	local dir="$1" create="$2"
	if [ ! -d "$dir" ]; then
		[ "$create" = 1 ] || lv_fail "the state folder $dir does not exist. Run tools/live-accounts.sh first."
		(umask 077 && mkdir -p "$dir") || lv_fail "cannot create the state folder $dir."
		chmod 700 "$dir"
	fi
	# The real path (symlinks resolved), so the string the processes are started
	# with is the same one lv_is_ours looks for when they are stopped, and so
	# the mode checked is the folder's, not a symlink's (stat does not follow
	# one, and chmod on it cannot change what stat reports for it).
	local real
	real="$(cd "$dir" && pwd -P)" || lv_fail "cannot open the state folder $dir."
	lv_private_to_owner "$real" || lv_fail "the state folder $real can be read by other users (mode $(lv_perm "$real")). Run chmod 700 $real and try again."
	printf '%s\n' "$real"
}

# lv_utc_stamp: a UTC time stamp usable as a folder name.
lv_utc_stamp() { date -u '+%Y%m%dT%H%M%SZ'; }

# lv_new_archive <state>: create a fresh archive/<UTC stamp> folder inside the
# state folder and print its path. Never reuses an existing folder.
lv_new_archive() {
	local base stamp dir n
	base="$1/archive"
	(umask 077 && mkdir -p "$base")
	stamp="$(lv_utc_stamp)"
	dir="$base/$stamp"
	n=2
	while [ -e "$dir" ]; do
		dir="$base/$stamp-$n"
		n=$((n + 1))
	done
	(umask 077 && mkdir "$dir") || lv_fail "cannot create $dir."
	printf '%s\n' "$dir"
}

# lv_resolve_v4 <name>: the first IPv4 address this machine's own resolver
# gives for the name, or nothing. On macOS this asks the system resolver
# (dscacheutil), which is what the browsers and curl use.
lv_resolve_v4() {
	if command -v dscacheutil >/dev/null 2>&1; then
		dscacheutil -q host -a name "$1" 2>/dev/null | awk '/^ip_address:/ { print $2; exit }'
	elif command -v getent >/dev/null 2>&1; then
		getent ahostsv4 "$1" 2>/dev/null | awk '{ print $1; exit }'
	fi
}

# lv_local_v4s: every IPv4 address configured on this machine, one per line.
lv_local_v4s() {
	if command -v ifconfig >/dev/null 2>&1; then
		ifconfig 2>/dev/null | awk '$1 == "inet" { sub(/^addr:/, "", $2); print $2 }'
	elif command -v ip >/dev/null 2>&1; then
		ip -4 -o addr show 2>/dev/null | awk '{ split($4, a, "/"); print a[1] }'
	fi
}

# lv_is_local_v4 <address>: true when the address is configured on this machine.
lv_is_local_v4() {
	[ -n "$1" ] || return 1
	lv_local_v4s | grep -qx -- "$1"
}

# lv_is_private_v4 <address>: true for 10/8, 172.16/12 and 192.168/16.
lv_is_private_v4() {
	local a b
	case "$1" in
	10.*) return 0 ;;
	192.168.*) return 0 ;;
	172.*)
		a="${1#172.}"
		b="${a%%.*}"
		case "$b" in
		'' | *[!0-9]*) return 1 ;;
		esac
		[ "$b" -ge 16 ] && [ "$b" -le 31 ]
		return
		;;
	esac
	return 1
}

# lv_valid_v4 <address>: true for a dotted IPv4 address.
lv_valid_v4() {
	local IFS=. part n=0
	case "$1" in
	'' | *[!0-9.]* | .* | *. | *..*) return 1 ;;
	esac
	# shellcheck disable=SC2086
	set -- $1
	[ $# -eq 4 ] || return 1
	for part in "$@"; do
		[ "$part" -le 255 ] || return 1
		n=$((n + 1))
	done
	[ "$n" -eq 4 ]
}

# lv_is_ours <pid> <state folder real path>: true when the pid is alive, is a
# saksi-campaign process, and was started with a path inside this state folder
# (every kit process has --auth-file <state>/accounts/...). Any other
# saksi-campaign, such as a canvass console that inherited a recycled pid, is
# not ours. Uses ps, not /proc, so it works on macOS; -ww keeps the whole line.
lv_is_ours() {
	local cmd
	case "$1" in
	'' | *[!0-9]*) return 1 ;;
	esac
	[ -n "${2:-}" ] || return 1
	cmd="$(ps -ww -p "$1" -o command= 2>/dev/null)" || return 1
	case "$cmd" in
	*saksi-campaign*"$2/"*) return 0 ;;
	esac
	return 1
}

# lv_port_listener <port>: the pid listening on the TCP port, or nothing.
lv_port_listener() {
	lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -n1
}

# lv_saksi_bins <saksi checkout>: set DEMO_BIN and CONSOLE_BIN to where
# saksi's tools/up.sh builds them. Does not check that they exist.
lv_saksi_bins() {
	DEMO_BIN="$1/target/release/saksi-demo"
	CONSOLE_BIN="$1/target/saksi-campaign"
}

lv_build_hint() {
	printf 'Build it with: tools/live-up.sh --build (or, in %s: cargo build --release -p saksi-demo, then cd packages/saksi-campaign && go build -o %s/target/saksi-campaign ./cmd/saksi-campaign)' "$1" "$1"
}

# lv_is_our_tunnel <pid> <state folder real path>: true when the pid is alive,
# is cloudflared, and was started with a path inside this state folder
# (live-up.sh --public passes --pidfile <state>/pids/...). A cloudflared started
# by hand or by another tool is never ours.
lv_is_our_tunnel() {
	local cmd
	case "$1" in
	'' | *[!0-9]*) return 1 ;;
	esac
	[ -n "${2:-}" ] || return 1
	cmd="$(ps -ww -p "$1" -o command= 2>/dev/null)" || return 1
	case "$cmd" in
	*cloudflared*"$2/"*) return 0 ;;
	esac
	return 1
}
