#!/usr/bin/env bash
#
# live-up.sh: bring up the live election demo on this Mac (console and five trustees).
#
#   tools/live-up.sh [up|down|status] [--state DIR] [--saksi DIR] [--domain NAME]
#                    [--tls-cert FILE] [--tls-key FILE] [--build]
#                    [--public [--tunnel-token-file FILE]]
#
#   up (default)   check everything, then start the console on vote.<domain>:8443 and
#                  trustees 1 to 5 on t<N>.<domain>:900<N>, and print the seven tabs
#   down           stop the tunnel (when --public started one), the five trustees and
#                  the console (SIGTERM, by pid file)
#   status         show what runs, what the names resolve to, the certificate's last
#                  day and the election state; changes nothing
#
#   --state DIR     the kit's state folder (default ~/.balotachain-live)
#   --saksi DIR     saksi checkout with tools/up.sh and the built binaries
#                   (default ~/dev/saksi-live)
#   --domain NAME   the demo's domain (default vancornelio.dev)
#   --tls-cert F    certificate chain for *.<domain>
#                   (default ~/.secrets/lego-live/certificates/_.<domain>.crt)
#   --tls-key F     its private key, only ever passed on as a path; it must be
#                   readable by its owner only
#                   (default ~/.secrets/lego-live/certificates/_.<domain>.key)
#   --build         build saksi-demo (release) and saksi-campaign through saksi's
#                   tools/up.sh, then the web apps with tools/build-web.sh, before starting
#   --public        also open the phone page and the board to the internet for a remote
#                   test session: the console additionally accepts ballot.<domain>:8443,
#                   and cloudflared runs the Cloudflare Tunnel set up in the dashboard
#                   (docs/live-demo/README.md, Remote test session). up checks the public
#                   address answers, then prints the one link to send to members. Off by
#                   default; without it nothing about up changes.
#   --tunnel-token-file F
#                   the tunnel token for --public, mode 0600, read by cloudflared itself
#                   (--token-file) and never by this script
#                   (default ~/.secrets/cloudflare-tunnel.token)
#
# up stops with one sentence at the first thing that is wrong, in this order: Docker,
# the certificate, Fabric, the binaries and web apps, the accounts, the names, the ports.
# It never starts, stops, resets or redeploys Fabric (COMPOSE_PROJECT_NAME=saksilive), and
# never restarts a process by itself. down and status never touch Fabric or Docker.
#
# Run tools/live-accounts.sh once before the first up, and tools/live-dns.sh on the
# network of the day before each up.
set -euo pipefail

LV_PROG=live-up
BC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tools/live-lib.sh
. "$BC_DIR/tools/live-lib.sh"

CMD=up
STATE_DIR="$LV_DEFAULT_STATE"
SAKSI_DIR="$HOME/dev/saksi-live"
DOMAIN="$LV_DEFAULT_DOMAIN"
SITE_CERT=""
SITE_KEY=""
BUILD=0
PUBLIC=0
TUNNEL_TOKEN_FILE="$HOME/.secrets/cloudflare-tunnel.token"
START_WAIT="${LIVE_UP_WAIT_SECONDS:-90}"

while [ $# -gt 0 ]; do
	case "$1" in
	up | down | status) CMD="$1"; shift ;;
	--state) STATE_DIR="${2:?--state needs a folder}"; shift 2 ;;
	--saksi) SAKSI_DIR="${2:?--saksi needs a folder}"; shift 2 ;;
	--domain) DOMAIN="${2:?--domain needs a name}"; shift 2 ;;
	--tls-cert) SITE_CERT="${2:?--tls-cert needs a path}"; shift 2 ;;
	--tls-key) SITE_KEY="${2:?--tls-key needs a path}"; shift 2 ;;
	--build) BUILD=1; shift ;;
	--public) PUBLIC=1; shift ;;
	--tunnel-token-file) TUNNEL_TOKEN_FILE="${2:?--tunnel-token-file needs a path}"; shift 2 ;;
	-h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
	*) lv_fail "unknown argument $1 (see --help)." ;;
	esac
done
# The default certificate follows --domain (lego's file names).
[ -n "$SITE_CERT" ] || SITE_CERT="$HOME/.secrets/lego-live/certificates/_.$DOMAIN.crt"
[ -n "$SITE_KEY" ] || SITE_KEY="$HOME/.secrets/lego-live/certificates/_.$DOMAIN.key"
case "$DOMAIN" in
'' | *[!A-Za-z0-9.-]* | .* | *.) lv_fail "--domain '$DOMAIN' is not a domain name." ;;
esac
DOMAIN="$(printf '%s' "$DOMAIN" | tr 'A-Z' 'a-z')"

# Every Fabric container this kit relies on belongs to the saksilive compose
# project. Set before anything that could touch Fabric.
export COMPOSE_PROJECT_NAME=saksilive

CONSOLE_HOST="vote.$DOMAIN"
CONSOLE_URL="https://$CONSOLE_HOST:$LV_CONSOLE_PORT"
FABRIC_CONTAINERS="orderer.example.com peer0.org1.example.com peer0.org2.example.com"

# fabric_running: the names of running containers of the saksilive compose
# project. The label, not only the name, so an old network under another
# project with the same container names never passes.
fabric_running() {
	docker ps --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Names}}' 2>/dev/null || true
}

# The remote test session's public name (--public). Cloudflare's edge serves
# HTTPS on 8443 as well as 443, and the browser must use the console's own port:
# the console appends its port to an --allow-host given without one and compares
# the browser's Origin host:port with Host, so a name on 443 (whose Host header
# carries no port) cannot pass its guard without a console change. The tunnel's
# dashboard entry sets the HTTP Host header to exactly PUBLIC_HOST:PUBLIC_PORT.
PUBLIC_HOST="ballot.$DOMAIN"
PUBLIC_PORT="$LV_CONSOLE_PORT"
PUBLIC_URL="https://$PUBLIC_HOST:$PUBLIC_PORT"
CLOUDFLARED_BIN="$(command -v cloudflared 2>/dev/null || printf '/opt/homebrew/bin/cloudflared')"

trustee_host() { printf 't%s.%s' "$1" "$DOMAIN"; }
trustee_port() { printf '900%s' "$1"; }
trustee_url() { printf 'https://%s:%s' "$(trustee_host "$1")" "$(trustee_port "$1")"; }

# --- the state folder ----------------------------------------------------------

STATE="$(lv_state_open "$STATE_DIR" 0)"
ACC="$STATE/accounts"
TOK="$STATE/tokens"
RUNS="$STATE/runs"
TRUSTEES_DIR="$STATE/trustees"
LOGS="$STATE/logs"
PIDS="$STATE/pids"
HANDOUT="$STATE/handout/passwords.txt"
VOTER_LIST="$STATE/$LV_VOTER_LIST_NAME"

pidfile_of() { # console | trustee-N
	printf '%s/%s.pid' "$PIDS" "$1"
}
logfile_of() {
	printf '%s/%s.log' "$LOGS" "$1"
}
port_of() {
	case "$1" in
	console) printf '%s' "$LV_CONSOLE_PORT" ;;
	trustee-*) trustee_port "${1#trustee-}" ;;
	esac
}
PROCS="console trustee-1 trustee-2 trustee-3 trustee-4 trustee-5"

# is_ours <proc> <pid>: the pid is this kit's process of that kind. The tunnel
# is cloudflared started with --pidfile inside this state folder.
is_ours() {
	case "$1" in
	tunnel) lv_is_our_tunnel "$2" "$STATE" ;;
	*) lv_is_ours "$2" "$STATE" ;;
	esac
}

# running_pid <proc>: the pid from the pid file when it is a live process of this
# kit (saksi-campaign, or cloudflared for the tunnel).
running_pid() {
	local f pid
	f="$(pidfile_of "$1")"
	[ -f "$f" ] || return 1
	pid="$(cat "$f" 2>/dev/null || true)"
	is_ours "$1" "$pid" || return 1
	printf '%s' "$pid"
}

# public_code <path> [curl args...]: the HTTP status of PUBLIC_URL<path>, reached
# the way a member's phone reaches it (public DNS, Cloudflare's edge, the tunnel).
public_code() {
	local path="$1"
	shift
	curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$@" "$PUBLIC_URL$path" 2>/dev/null || true
}

# --- down ----------------------------------------------------------------------

kit_down() {
	local p pid waiting left n
	waiting=""
	for p in tunnel trustee-5 trustee-4 trustee-3 trustee-2 trustee-1 console; do
		if pid="$(running_pid "$p")"; then
			lv_say "stopping $p (pid $pid)"
			kill -TERM "$pid" 2>/dev/null || true
			waiting="$waiting $p:$pid"
		elif [ -f "$(pidfile_of "$p")" ]; then
			lv_note "$p was not running (its pid file named no process of this kit); removing the old pid file"
			rm -f "$(pidfile_of "$p")"
		fi
	done
	[ -n "$waiting" ] || { lv_say "nothing of the kit was running."; return 0; }
	n=0
	while [ "$n" -lt 20 ]; do
		left=""
		for entry in $waiting; do
			is_ours "${entry%%:*}" "${entry#*:}" && left="$left $entry"
		done
		[ -n "$left" ] || break
		sleep 1
		n=$((n + 1))
	done
	left=""
	for entry in $waiting; do
		p="${entry%%:*}" pid="${entry#*:}"
		if is_ours "$p" "$pid"; then
			left="$left $p"
			printf '%s: %s (pid %s) is still running after 20 seconds. It was not killed harder; look at %s, then stop it by hand.\n' "$LV_PROG" "$p" "$pid" "$(logfile_of "$p")" >&2
		else
			rm -f "$(pidfile_of "$p")"
		fi
	done
	[ -z "$left" ] || return 1
	case "$waiting" in
	*' tunnel:'*) lv_say "the tunnel, the console and the trustees are stopped; $PUBLIC_HOST no longer reaches this Mac. Fabric was not touched." ;;
	*) lv_say "the console and the trustees are stopped. Fabric was not touched." ;;
	esac
	rm -f "$PIDS/tunnel.cloudflared.pid"
}

# --- status --------------------------------------------------------------------

kit_status() {
	local p pid port listener stale name fqdn addr where code
	lv_say "processes"
	for p in $PROCS; do
		port="$(port_of "$p")"
		if pid="$(running_pid "$p")"; then
			printf '    %-10s up    pid %-7s port %s\n' "$p" "$pid" "$port"
		else
			listener="$(lv_port_listener "$port" || true)"
			# One line per process: a stale pid file is said on the port's line.
			stale=""
			if [ -f "$(pidfile_of "$p")" ]; then
				stale="; its pid file is stale (pid $(cat "$(pidfile_of "$p")" 2>/dev/null || true) is not this kit's process), tools/live-up.sh down removes it"
			fi
			if [ -n "$listener" ]; then
				printf '    %-10s down  port %s is held by pid %s, which is not this kit'\''s%s\n' "$p" "$port" "$listener" "$stale"
			else
				printf '    %-10s down  port %s%s\n' "$p" "$port" "$stale"
			fi
		fi
	done
	# The tunnel has a line only when --public started one (or left a pid file).
	if pid="$(running_pid tunnel)"; then
		code="$(public_code /api/capabilities)"
		case "$code" in
		200) where="$PUBLIC_URL answers" ;;
		*) where="$PUBLIC_URL does NOT answer (HTTP ${code:-none}); see $(logfile_of tunnel)" ;;
		esac
		printf '    %-10s up    pid %-7s %s\n' tunnel "$pid" "$where"
	elif [ -f "$(pidfile_of tunnel)" ]; then
		printf '    %-10s down  its pid file is stale (pid %s is not this kit'\''s cloudflared), tools/live-up.sh down removes it\n' tunnel "$(cat "$(pidfile_of tunnel)" 2>/dev/null || true)"
	fi
	lv_say "Fabric (compose project $COMPOSE_PROJECT_NAME)"
	if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
		lv_note "Docker does not answer."
	else
		local running
		running="$(fabric_running)"
		for name in $FABRIC_CONTAINERS; do
			if printf '%s\n' "$running" | grep -qx "$name"; then
				lv_note "$name runs"
			else
				lv_note "$name is NOT running (as a $COMPOSE_PROJECT_NAME container)"
			fi
		done
	fi
	lv_say "names (this Mac's resolver)"
	for name in vote t1 t2 t3 t4 t5; do
		fqdn="$name.$DOMAIN"
		addr="$(lv_resolve_v4 "$fqdn" || true)"
		if [ -z "$addr" ]; then
			where="does not resolve"
		elif lv_is_local_v4 "$addr"; then
			where="$addr (this Mac)"
		else
			where="$addr (NOT this Mac)"
		fi
		printf '    %-24s %s\n' "$fqdn" "$where"
	done
	lv_say "certificate"
	if [ -r "$SITE_CERT" ]; then
		lv_note "valid until $(openssl x509 -in "$SITE_CERT" -noout -enddate 2>/dev/null | sed 's/^notAfter=//')"
	else
		lv_note "$SITE_CERT cannot be read"
	fi
	lv_say "election"
	if running_pid console >/dev/null; then
		lv_note "$(election_state)"
	else
		lv_note "the console is not running"
	fi
}

# election_state: one line on the console's current election.
election_state() {
	local body code
	body="$(mktemp "${TMPDIR:-/tmp}/live-up.XXXXXX")"
	code="$(curl -sS --max-time 10 -o "$body" -w '%{http_code}' "$CONSOLE_URL/api/live/election" 2>/dev/null || true)"
	case "$code" in
	200)
		if command -v jq >/dev/null 2>&1; then
			jq -r '"state \(.state), election \(.election_id)\(if .title then ", title \"\(.title)\"" else "" end)\(if .precinct_label then ", \(.precinct_label), voters on the list \(.counts.voters_on_list // "?"), checked in \(.counts.checked_in // "?")" else ", no voter list (an election made before the voter list: do not reuse it)" end)\(if .state == "closed" and (.counts.min_ballot_records | type) == "number" and (.counts.ballot_records | type) == "number" and .counts.ballot_records_source == "chain" and .counts.ballot_records >= 0 and (.counts.ballot_records | isinfinite | not) and .counts.ballot_records < .counts.min_ballot_records then "; closed with \(.counts.ballot_records) ballot records, decryption needs at least \(.counts.min_ballot_records): it cannot be finished, run tools/live-reset.sh" else "" end)"' "$body" 2>/dev/null || printf 'answered, but not readable'
		else
			grep -o '"state": *"[^"]*"' "$body" | head -n1
		fi
		;;
	404)
		if grep -q 'no live election' "$body" 2>/dev/null; then
			printf 'no election is set up yet (create one on the presenter page)'
		else
			printf 'the console answered 404 without the live route (is --live on?)'
		fi
		;;
	*) printf 'the console did not answer %s/api/live/election (HTTP %s)' "$CONSOLE_URL" "${code:-none}" ;;
	esac
	rm -f "$body"
}

if [ "$CMD" = down ]; then
	kit_down
	exit
fi
if [ "$CMD" = status ]; then
	kit_status
	exit 0
fi

# --- up ------------------------------------------------------------------------

# 1. Preflight: Docker and the certificate. The key is only tested for being
#    readable and private to its owner (its mode); it is never opened here.
lv_say "1. Docker and the certificate"
command -v docker >/dev/null 2>&1 || lv_fail "docker is not installed. Install Docker Desktop and start it."
docker info >/dev/null 2>&1 || lv_fail "Docker does not answer. Start Docker Desktop and run tools/live-up.sh again."
command -v openssl >/dev/null 2>&1 || lv_fail "openssl is missing."
command -v curl >/dev/null 2>&1 || lv_fail "curl is missing."
[ -f "$SITE_CERT" ] && [ -r "$SITE_CERT" ] || lv_fail "the certificate $SITE_CERT is missing or cannot be read. Pass --tls-cert."
[ -f "$SITE_KEY" ] && [ -r "$SITE_KEY" ] || lv_fail "the certificate key $SITE_KEY is missing or cannot be read. Pass --tls-key."
lv_private_to_owner "$SITE_KEY" || lv_fail "the certificate key $SITE_KEY can be read by other users (mode $(lv_perm "$SITE_KEY")). Run chmod 600 on it."
openssl x509 -in "$SITE_CERT" -noout >/dev/null 2>&1 || lv_fail "$SITE_CERT is not a PEM certificate."
openssl x509 -in "$SITE_CERT" -noout -checkend 86400 >/dev/null 2>&1 ||
	lv_fail "the certificate $SITE_CERT runs out within a day ($(openssl x509 -in "$SITE_CERT" -noout -enddate | sed 's/^notAfter=//')). Renew it first."
# The SAN list from -text (LibreSSL's /usr/bin/openssl has no -ext), compared
# entry by entry as fixed strings.
cert_sans() {
	openssl x509 -in "$1" -noout -text 2>/dev/null |
		awk '/X509v3 Subject Alternative Name/ { getline; print; exit }' |
		tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}
cert_sans "$SITE_CERT" | tr 'A-Z' 'a-z' | grep -qxF "dns:*.$DOMAIN" ||
	lv_fail "the certificate $SITE_CERT does not cover *.$DOMAIN."
lv_note "certificate for *.$DOMAIN, valid until $(openssl x509 -in "$SITE_CERT" -noout -enddate | sed 's/^notAfter=//')"

# 1b. Public access (--public only). The token file is checked for existing,
#     being non-empty and private to its owner; it is never opened here.
if [ "$PUBLIC" = 1 ]; then
	lv_say "1b. public access through the Cloudflare Tunnel ($PUBLIC_HOST)"
	[ -x "$CLOUDFLARED_BIN" ] || lv_fail "cloudflared is not installed (looked for $CLOUDFLARED_BIN). Run: brew install cloudflared"
	[ -f "$TUNNEL_TOKEN_FILE" ] && [ -r "$TUNNEL_TOKEN_FILE" ] || lv_fail "the tunnel token file $TUNNEL_TOKEN_FILE is missing or cannot be read. See docs/live-demo/README.md, Remote test session, or pass --tunnel-token-file."
	[ -s "$TUNNEL_TOKEN_FILE" ] || lv_fail "the tunnel token file $TUNNEL_TOKEN_FILE is empty."
	lv_private_to_owner "$TUNNEL_TOKEN_FILE" || lv_fail "the tunnel token file $TUNNEL_TOKEN_FILE can be read by other users (mode $(lv_perm "$TUNNEL_TOKEN_FILE")). Run chmod 600 on it."
	case "$TUNNEL_TOKEN_FILE" in
	*' '*) lv_fail "the path '$TUNNEL_TOKEN_FILE' contains a space; the kit does not support that." ;;
	esac
	other="$(pgrep -x cloudflared 2>/dev/null | head -n1 || true)"
	[ -z "$other" ] || lv_fail "a cloudflared process already runs (pid $other). Stop it first: a second connector of the same tunnel would share the traffic, and this kit could not stop it."
	lv_note "cloudflared $("$CLOUDFLARED_BIN" --version 2>/dev/null | awk '{ print $3; exit }'), token file mode $(lv_perm "$TUNNEL_TOKEN_FILE")"
fi

# 2 and 3. Fabric: use the running saksilive network as it is, or stop.
lv_say "2. Fabric (COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME)"
SAKSI_DIR="$(cd "$SAKSI_DIR" 2>/dev/null && pwd)" || lv_fail "the saksi checkout was not found. Pass --saksi <folder>."
[ -f "$SAKSI_DIR/tools/up.sh" ] || lv_fail "$SAKSI_DIR/tools/up.sh is missing: that is not a saksi checkout."
# Sourcing up.sh defines its functions and runs nothing. It sets ROOT,
# TLS_CERT, CERT and KEY (the Fabric ones), which is why ours are named
# BC_DIR, SITE_CERT and SITE_KEY. It also defines cmd_up, cmd_down and
# cmd_status; its cmd_down tears the Fabric network down, so this script's own
# functions are named kit_down and kit_status and must never be called cmd_*.
# shellcheck source=/dev/null
. "$SAKSI_DIR/tools/up.sh"

if ! network_running; then
	stopped="$(docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.Names}}' 2>/dev/null | tr '\n' ' ' || true)"
	if [ -n "${stopped// /}" ]; then
		lv_fail "the Fabric network is not running, but stopped $COMPOSE_PROJECT_NAME containers exist (${stopped% }). This script does not start Fabric. To start them as they are: docker start ${stopped% }"
	fi
	lv_fail "no Fabric network is running and no $COMPOSE_PROJECT_NAME containers exist. This script does not start Fabric. To bring one up (it starts no console): cd $SAKSI_DIR && COMPOSE_PROJECT_NAME=saksilive bash -c '. tools/up.sh; preflight; install_fabric; bring_up_network'. That writes into the fabric-samples folder (FABRIC_SAMPLES, default ~/dev/fabric-samples), which the study's saksi checkout uses too, and makes its test-network crypto again."
fi
running="$(fabric_running)"
for c in $FABRIC_CONTAINERS; do
	printf '%s\n' "$running" | grep -qx "$c" ||
		lv_fail "no running $COMPOSE_PROJECT_NAME container named $c (the compose project label is checked, not only the name). This script does not start Fabric. If it is a stopped $COMPOSE_PROJECT_NAME container, start it as it is: docker start $c"
done
lv_note "the network is running ($FABRIC_CONTAINERS)"
resolve_identity
FABRIC_TLS_CERT="$TLS_CERT" FABRIC_CERT="$CERT" FABRIC_KEY="$KEY"

# 4. Binaries and the web apps.
lv_say "3. binaries and web apps"
if [ "$BUILD" = 1 ]; then
	# On this Mac, Homebrew's own cargo can be broken by a libgit2 upgrade
	# (dyld cannot load libllhttp); rustup's cargo, which saksi's wasm build
	# also uses, is preferred whenever it is installed.
	if [ -x /opt/homebrew/opt/rustup/bin/cargo ]; then
		PATH="/opt/homebrew/opt/rustup/bin:$PATH"
	fi
	preflight
	build_binaries
	lv_say "building the web apps (tools/build-web.sh)"
	(cd "$BC_DIR" && bash tools/build-web.sh) || lv_fail "tools/build-web.sh failed; see its output above."
	lv_note "macOS asks again whether saksi-campaign may accept incoming connections after every rebuild. Answer Allow, and build the day before the demo."
fi
lv_saksi_bins "$SAKSI_DIR"
[ -x "$DEMO_BIN" ] || lv_fail "saksi-demo is not built at $DEMO_BIN. $(lv_build_hint "$SAKSI_DIR")"
[ -x "$CONSOLE_BIN" ] || lv_fail "saksi-campaign is not built at $CONSOLE_BIN. $(lv_build_hint "$SAKSI_DIR")"
WEB_DIR="$BC_DIR/dist-web"
for app in admin board trustee vote; do
	[ -f "$WEB_DIR/$app/index.html" ] || lv_fail "$WEB_DIR/$app/index.html is missing. Run tools/live-up.sh --build (or bash tools/build-web.sh)."
done
built_at() { date -r "$1" '+%Y-%m-%d %H:%M'; }
lv_note "saksi-demo     built $(built_at "$DEMO_BIN")"
lv_note "saksi-campaign built $(built_at "$CONSOLE_BIN")"
for app in admin board trustee vote; do
	lv_note "dist-web/$app built $(built_at "$WEB_DIR/$app/index.html")"
done

# 5. Accounts and tokens.
lv_say "4. accounts and tokens"
for f in "$ACC/console.json" "$TOK/console-trustee-tokens.json"; do
	[ -f "$f" ] || lv_fail "$f is missing. Run tools/live-accounts.sh --state $STATE first."
	lv_private_to_owner "$f" || lv_fail "$f can be read by other users (mode $(lv_perm "$f")). Run chmod 600 on it."
done
for n in $LV_TRUSTEES; do
	for f in "$ACC/trustee-$n.json" "$TOK/trustee-$n.token"; do
		[ -f "$f" ] || lv_fail "$f is missing. Run tools/live-accounts.sh --state $STATE first."
		lv_private_to_owner "$f" || lv_fail "$f can be read by other users (mode $(lv_perm "$f")). Run chmod 600 on it."
	done
done
lv_note "found in $STATE (accounts/, tokens/)"
# The voter list is uploaded on the presenter page; the console never reads
# this file. Only its mode is checked here, and its content is never read.
if [ -e "$VOTER_LIST" ]; then
	lv_private_to_owner "$VOTER_LIST" || lv_fail "$VOTER_LIST can be read by other users (mode $(lv_perm "$VOTER_LIST")). Run chmod 600 on it."
	lv_note "the voter list file is in place, mode $(lv_perm "$VOTER_LIST") (upload it on the presenter page at setup)"
else
	lv_warn "no voter list at $VOTER_LIST. Setup needs one: see docs/live-demo/run-sheet.md, Before the demo."
fi

# 6. Names: every name must resolve, on this Mac, to an address of this Mac.
lv_say "5. names"
for name in vote t1 t2 t3 t4 t5; do
	fqdn="$name.$DOMAIN"
	addr="$(lv_resolve_v4 "$fqdn" || true)"
	[ -n "$addr" ] || lv_fail "$fqdn does not resolve on this Mac. Run tools/live-dns.sh on this network first (the trustees call the console by name, and the certificate is for the names)."
	lv_is_local_v4 "$addr" || lv_fail "$fqdn resolves to $addr, which is not an address of this Mac. Run tools/live-dns.sh on this network first."
	lv_note "$fqdn -> $addr"
done

# 7. Ports, and our own processes.
lv_say "6. ports"
for p in $PROCS tunnel; do
	if pid="$(running_pid "$p")"; then
		lv_fail "the kit is already running ($p is pid $pid). See tools/live-up.sh status, or stop it with tools/live-up.sh down. Nothing was restarted."
	fi
done
for p in $PROCS; do
	port="$(port_of "$p")"
	holder="$(lv_port_listener "$port" || true)"
	[ -z "$holder" ] || lv_fail "port $port is in use by pid $holder ($(ps -p "$holder" -o command= 2>/dev/null | cut -c1-80)). Free it first."
done
lv_note "8443 and 9001 to 9005 are free"

# --- start ---------------------------------------------------------------------

umask 077
mkdir -p "$RUNS" "$TRUSTEES_DIR" "$LOGS" "$PIDS"
STARTED=""

# abort <proc> <sentence>: show the last 20 lines of its log, stop everything
# this run started, exit 1.
abort() {
	local p="$1" log
	log="$(logfile_of "$p")"
	printf '%s: %s\n' "$LV_PROG" "$2" >&2
	if [ -f "$log" ]; then
		printf '%s: last 20 lines of %s:\n' "$LV_PROG" "$log" >&2
		tail -n 20 "$log" >&2
	fi
	if [ -n "$STARTED" ]; then
		printf '%s: stopping what this run started.\n' "$LV_PROG" >&2
		kit_down >&2 || true
	fi
	exit 1
}
# Ctrl-C or a TERM during start-up stops what this run started.
trap 'abort console "interrupted."' INT TERM

# start <proc> <args...>: start saksi-campaign in the background with its log
# and pid file.
start() {
	local p="$1" log pid
	shift
	log="$(logfile_of "$p")"
	[ ! -f "$log" ] || mv -f "$log" "$log.prev"
	STARTED="$STARTED $p"
	nohup "$CONSOLE_BIN" "$@" >"$log" 2>&1 </dev/null &
	pid=$!
	printf '%s\n' "$pid" >"$(pidfile_of "$p")"
	lv_note "$p started (pid $pid), log $log"
}

alive() { # <proc>
	local pid
	pid="$(cat "$(pidfile_of "$1")" 2>/dev/null || true)"
	[ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# --public: the console also accepts the public name, with the port the browser
# uses (the tunnel's dashboard entry sends exactly this as the Host header).
PUBLIC_FLAGS=""
[ "$PUBLIC" = 0 ] || PUBLIC_FLAGS="--allow-host $PUBLIC_HOST:$PUBLIC_PORT"
FABRIC_FLAGS="--fabric-tls-cert $FABRIC_TLS_CERT --fabric-cert $FABRIC_CERT --fabric-key $FABRIC_KEY"
# FABRIC_FLAGS is split on spaces when used, so no path may hold one.
for v in "$FABRIC_TLS_CERT" "$FABRIC_CERT" "$FABRIC_KEY" "$SITE_CERT" "$SITE_KEY" "$STATE" "$BC_DIR" "$SAKSI_DIR"; do
	case "$v" in
	*' '*) lv_fail "the path '$v' contains a space; the kit does not support that." ;;
	esac
done

# 8. The console.
lv_say "7. console on $CONSOLE_URL"
# shellcheck disable=SC2086
start console serve \
	--addr "0.0.0.0:$LV_CONSOLE_PORT" \
	--live \
	--live-precinct "$LV_PRECINCT" \
	--tls-cert "$SITE_CERT" --tls-key "$SITE_KEY" \
	--allow-host "$CONSOLE_HOST" $PUBLIC_FLAGS \
	--auth-file "$ACC/console.json" \
	--trustee-tokens "$TOK/console-trustee-tokens.json" \
	--runs "$RUNS" \
	--demo "$DEMO_BIN" \
	--web-dir "$WEB_DIR" \
	--fabric-channel "$CHANNEL" \
	$FABRIC_FLAGS

# Ready means: the console answers on its name over TLS, says Fabric is
# configured ("fabric":true only says every Fabric flag is set; it does not
# dial the peer), and the live routes are on (GET /api/live/election answers
# 200 with an election, or 404 "no live election has been set up").
PROBE="$(mktemp -d "${TMPDIR:-/tmp}/live-up.XXXXXX")"
trap 'rm -rf "$PROBE"' EXIT
n=0
while :; do
	alive console || abort console "the console stopped while starting."
	caps_code="$(curl -sS --max-time 5 -o "$PROBE/caps" -w '%{http_code}' "$CONSOLE_URL/api/capabilities" 2>/dev/null || true)"
	case "$caps_code" in
	403) abort console "the console refuses $CONSOLE_HOST:$LV_CONSOLE_PORT (403, forbidden host); its --allow-host does not match the name." ;;
	esac
	case "$(cat "$PROBE/caps" 2>/dev/null || true)" in
	*'"fabric":true'*)
		code="$(curl -sS --max-time 5 -o "$PROBE/election" -w '%{http_code}' "$CONSOLE_URL/api/live/election" 2>/dev/null || true)"
		case "$code" in
		200) break ;;
		404)
			# 404 also means "live mode is off"; only the live route's own
			# answer counts as ready.
			grep -q 'no live election' "$PROBE/election" 2>/dev/null && break
			abort console "the console answers 404 on /api/live/election without the live route's answer; is --live on?"
			;;
		403) abort console "the console refuses $CONSOLE_HOST:$LV_CONSOLE_PORT (403, forbidden host); its --allow-host does not match the name." ;;
		esac
		;;
	*'"fabric":false'*) abort console "the console answers, but with Fabric off; a Fabric flag is missing." ;;
	esac
	n=$((n + 2))
	[ "$n" -lt "$START_WAIT" ] || abort console "the console did not answer on $CONSOLE_URL within $START_WAIT seconds."
	sleep 2
done
lv_note "the console answers on $CONSOLE_URL with Fabric on and live mode on"

# 9. The trustees.
PEERS=""
for n in $LV_TRUSTEES; do
	PEERS="$PEERS${PEERS:+,}$n=$(trustee_url "$n")"
done
for n in $LV_TRUSTEES; do
	p="trustee-$n"
	url="$(trustee_url "$n")"
	lv_say "8. trustee $n on $url"
	# shellcheck disable=SC2086
	start "$p" trustee --id "$n" \
		--addr "0.0.0.0:$(trustee_port "$n")" \
		--tls-cert "$SITE_CERT" --tls-key "$SITE_KEY" \
		--allow-host "$(trustee_host "$n")" \
		--auth-file "$ACC/trustee-$n.json" \
		--console "$CONSOLE_URL" \
		--token-file "$TOK/trustee-$n.token" \
		--state-dir "$TRUSTEES_DIR/$n" \
		--peers "$PEERS" \
		--demo "$DEMO_BIN" \
		--web-dir "$WEB_DIR" \
		--fabric-channel "$CHANNEL" \
		$FABRIC_FLAGS
	w=0
	while :; do
		alive "$p" || abort "$p" "trustee $n stopped while starting."
		body="$(curl -sS --max-time 5 "$url/api/trustee/peer" 2>/dev/null || true)"
		case "$body" in
		*"\"trustee_id\":$n,"* | *"\"trustee_id\":$n}"*) break ;;
		*'"trustee_id":'*) abort "$p" "$url answers as another trustee: $body" ;;
		esac
		w=$((w + 2))
		[ "$w" -lt "$START_WAIT" ] || abort "$p" "trustee $n did not answer on $url within $START_WAIT seconds."
		sleep 2
	done
	lv_note "trustee $n answers on $url"
done

# 9b. The tunnel (--public only). cloudflared reads the token file itself
#     (--token-file), so the token is in no command line, environment or log of
#     this script. --pidfile inside the state folder is what marks the process
#     as this kit's (lv_is_our_tunnel). Ready means: the public name answers
#     through Cloudflare with this console's capabilities, and a same-origin
#     POST (logout without a session, which changes nothing) passes the
#     console's Host and Origin guard.
if [ "$PUBLIC" = 1 ]; then
	lv_say "9. tunnel: $PUBLIC_URL"
	log="$(logfile_of tunnel)"
	[ ! -f "$log" ] || mv -f "$log" "$log.prev"
	STARTED="$STARTED tunnel"
	# env -u: cloudflared prefers a TUNNEL_TOKEN from the environment over
	# --token-file, so a stray exported one would run some other tunnel.
	# --grace-period 5s: SIGTERM finishes within down's 20 s wait.
	nohup env -u TUNNEL_TOKEN "$CLOUDFLARED_BIN" tunnel --no-autoupdate --grace-period 5s \
		--pidfile "$PIDS/tunnel.cloudflared.pid" \
		run --token-file "$TUNNEL_TOKEN_FILE" >"$log" 2>&1 </dev/null &
	printf '%s\n' "$!" >"$(pidfile_of tunnel)"
	lv_note "tunnel started (pid $!), log $log"
	# Every way the public check fails stops the whole kit (abort); this says how
	# to get the LAN-only demo back.
	LAN_ONLY=" The whole kit was stopped. For the LAN-only demo, run tools/live-up.sh again without --public."
	w=0
	post=""
	while :; do
		alive tunnel || abort tunnel "cloudflared stopped while starting (a wrong or revoked token stops it; see the log).$LAN_ONLY"
		code="$(curl -sS --max-time 10 -o "$PROBE/public" -w '%{http_code}' "$PUBLIC_URL/api/capabilities" 2>/dev/null || true)"
		case "$code" in
		200)
			grep -q '"fabric":true' "$PROBE/public" 2>/dev/null ||
				abort tunnel "$PUBLIC_URL answers, but not as this console. Check the public hostname's service in the dashboard (https://127.0.0.1:$LV_CONSOLE_PORT).$LAN_ONLY"
			post="$(public_code /api/logout -X POST -H "Origin: $PUBLIC_URL")"
			case "$post" in
			204) break ;;
			403) abort tunnel "a same-origin POST through $PUBLIC_HOST was refused (403, from the console or from Cloudflare; see the log). For the console, the dashboard's HTTP Host Header must be exactly $PUBLIC_HOST:$PUBLIC_PORT.$LAN_ONLY" ;;
			esac
			;;
		403) abort tunnel "$PUBLIC_HOST was refused (403, from the console or from Cloudflare; see the log). For the console, the dashboard's HTTP Host Header must be exactly $PUBLIC_HOST:$PUBLIC_PORT.$LAN_ONLY" ;;
		esac
		w=$((w + 2))
		[ "$w" -lt "$START_WAIT" ] || abort tunnel "$PUBLIC_URL did not answer within $START_WAIT seconds (last GET /api/capabilities HTTP ${code:-none}$([ -z "$post" ] || printf ', last POST /api/logout HTTP %s (404 = the dashboard Path rule does not let it through)' "$post"); 000 = the name does not resolve or the edge port is closed, 530 = the tunnel is not connected, 502 = Cloudflare cannot reach https://127.0.0.1:$LV_CONSOLE_PORT, check the Origin Server Name). See docs/live-demo/README.md, Remote test session.$LAN_ONLY"
		sleep 2
	done
	lv_note "$PUBLIC_URL answers through Cloudflare, and the console accepts its POSTs"
fi

# 10. The seven tabs, in order (D13).
cat <<EOF

The live demo is up. Open one browser window with seven pinned tabs, in this order:
  Cmd+1  Presenter  $CONSOLE_URL/admin/
EOF
for n in $LV_TRUSTEES; do
	printf '  Cmd+%s  Trustee %s  %s/trustee/\n' "$((n + 1))" "$n" "$(trustee_url "$n")"
done
cat <<EOF
  Cmd+7  Board      $CONSOLE_URL/board/

Members open, on their phones (always with the port):
  $CONSOLE_URL/vote/

Passwords: $HANDOUT (admin and trustees; this script does not print them)
Precinct:  $LV_PRECINCT (voters check in from the list uploaded at setup)
Logs:      $LOGS
Election:  $(election_state)

Stop with: tools/live-up.sh down$([ "$STATE" = "$LV_DEFAULT_STATE" ] || printf ' --state %s' "$STATE")
EOF
if [ "$PUBLIC" = 1 ]; then
	cat <<EOF

REMOTE TEST SESSION: the phone page and the board are on the internet.
Send members this one link (they open it at home, on their own Wi-Fi):
  $PUBLIC_URL/vote/
Public board: $PUBLIC_URL/board/
Only the phone page, the board and the routes they use pass the dashboard's Path
rule; the presenter and trustee pages stay on the LAN names. Approve a remote check-in
only after confirming on a call that it is that member. Cloudflare sees what the phones
send: make no privacy claim for this session. If remote check-in keeps telling
members to wait and try again, stop the tunnel and use the LAN.
Stop the tunnel right after the session: tools/live-up.sh down
EOF
fi
