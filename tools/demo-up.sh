#!/usr/bin/env bash
#
# demo-up.sh — bring the defense demo up from a clean network, repeatably.
#
#   tools/demo-up.sh --saksi ~/Code/saksi [--balotachain ~/Code/balotachain]
#                    [--reset] [--build-web] [--seed] [--port 8090]
#
#   --saksi PATH        saksi checkout (required; no spaces in the path)
#   --balotachain PATH  this repo (default: the repo this script lives in)
#   --reset             tear the Fabric network down and bring it back up with an
#                       empty ledger, the same steps tools/tier.sh runs
#   --build-web         run tools/build-web.sh to refresh dist-web
#   --seed              pre-generate one MP-1K election (1,000 voters x 3 positions
#                       x 4 candidates, realistic) and wait until it is ready
#   --port N            console port (default 8090)
#
# Runs under WSL Ubuntu on the desktop. Safe to re-run: a console started by an
# earlier run is stopped first, binaries are built only when missing, and --seed
# does nothing if a "MP-1K demo" election already exists.
#
# If the console runs with auth (SAKSI_AUTH_FILE exported), --seed needs an admin
# login: export DEMO_ADMIN_USER and DEMO_ADMIN_PASS first.
set -euo pipefail

say() { printf '==> %s\n' "$*"; }
fail() { printf 'demo-up: %s\n' "$*" >&2; exit 1; }

SAKSI_DIR=""
BC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESET=0 BUILD_WEB=0 SEED=0 PORT=8090
while [ $# -gt 0 ]; do
	case "$1" in
	--saksi) SAKSI_DIR="${2:?--saksi needs a path}"; shift 2 ;;
	--balotachain) BC_DIR="${2:?--balotachain needs a path}"; shift 2 ;;
	--reset) RESET=1; shift ;;
	--build-web) BUILD_WEB=1; shift ;;
	--seed) SEED=1; shift ;;
	--port) PORT="${2:?--port needs a number}"; shift 2 ;;
	-h | --help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
	*) fail "unknown flag $1 (see --help)" ;;
	esac
done
[ -n "$SAKSI_DIR" ] || fail "--saksi <path to saksi checkout> is required"
SAKSI_DIR="$(cd "$SAKSI_DIR" && pwd)" || fail "saksi path not found"
BC_DIR="$(cd "$BC_DIR" && pwd)" || fail "balotachain path not found"
[ -f "$SAKSI_DIR/tools/up.sh" ] || fail "$SAKSI_DIR/tools/up.sh missing: not a saksi checkout"

STATE="$HOME/.saksi/demo"
LOG="$STATE/serve.log"
PIDFILE="$STATE/serve.pid"
BASE="http://127.0.0.1:$PORT"
mkdir -p "$STATE"

# up.sh reads SAKSI_ADDR; sourcing it defines preflight/install_fabric/cmd_down/
# bring_up_network/resolve_identity (and overwrites ROOT, so ours are not named ROOT).
export SAKSI_ADDR="127.0.0.1:$PORT"
# shellcheck source=/dev/null
. "$SAKSI_DIR/tools/up.sh"

say "preflight (docker, go, cargo, curl)"
preflight

# 1. Network: reset, or make sure it is up.
if [ "$RESET" = 1 ]; then
	say "stopping the console before the reset"
	if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then kill "$(cat "$PIDFILE")" || true; sleep 1; fi
	say "resetting the network (install_fabric, network down, network all) as tier.sh does"
	install_fabric
	cmd_down
	bring_up_network
elif network_running; then
	say "Fabric network already up (use --reset for an empty ledger)"
else
	say "Fabric network down: bringing it up"
	install_fabric
	bring_up_network
fi
say "resolving the Fabric identity"
resolve_identity

# 2. Binaries, only if missing.
DEMO_BIN="$SAKSI_DIR/target/release/saksi-demo"
CONSOLE_BIN="$SAKSI_DIR/target/saksi-campaign"
if [ -x "$DEMO_BIN" ]; then say "saksi-demo present"; else
	say "building saksi-demo (release)"
	(cd "$SAKSI_DIR" && cargo build --release -p saksi-demo -q)
fi
if [ -x "$CONSOLE_BIN" ]; then say "saksi-campaign present"; else
	say "building saksi-campaign"
	(cd "$SAKSI_DIR/packages/saksi-campaign" && go build -o "$CONSOLE_BIN" ./cmd/saksi-campaign)
fi

# 3. Web apps.
if [ "$BUILD_WEB" = 1 ]; then
	say "building the web apps (tools/build-web.sh)"
	(cd "$BC_DIR" && sh tools/build-web.sh)
fi
[ -d "$BC_DIR/dist-web/board" ] || fail "$BC_DIR/dist-web is missing: rerun with --build-web"

# 4. Console, in the background. Stop the previous one first (idempotent).
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
	say "stopping the console from an earlier run (pid $(cat "$PIDFILE"))"
	kill "$(cat "$PIDFILE")" || true
	sleep 1
fi
say "starting the console on $BASE, log $LOG"
nohup "$CONSOLE_BIN" serve \
	--addr "127.0.0.1:$PORT" \
	--demo "$DEMO_BIN" \
	--runs "$RUNS_DIR" \
	--web-dir "$BC_DIR/dist-web" \
	--phase-timeout "$PHASE_TIMEOUT" \
	--fabric-channel "$CHANNEL" \
	--fabric-tls-cert "$TLS_CERT" \
	--fabric-cert "$CERT" \
	--fabric-key "$KEY" >"$LOG" 2>&1 &
echo $! >"$PIDFILE"
for _ in $(seq 1 30); do
	curl -fsS "$BASE/api/capabilities" >/dev/null 2>&1 && break
	sleep 1
done
curl -fsS "$BASE/api/capabilities" | grep -q '"fabric":true' \
	|| fail "console is not up with on-chain enabled; see $LOG"
say "console up, on-chain enabled"

# 5. Seed one MP-1K election. Body = the admin app's ElectionConfig (apps/admin/src/lib/bulletin.ts).
JAR="$STATE/cookies.txt"
curl_c() { curl -sS --fail-with-body -b "$JAR" -c "$JAR" "$@"; }
RUN_ID=""
if [ "$SEED" = 1 ]; then
	if [ -n "${DEMO_ADMIN_USER:-}" ]; then
		say "signing in as $DEMO_ADMIN_USER"
		curl_c -H 'Content-Type: application/json' \
			-d "{\"username\":\"$DEMO_ADMIN_USER\",\"password\":\"${DEMO_ADMIN_PASS:?set DEMO_ADMIN_PASS}\"}" \
			"$BASE/api/login" >/dev/null
	fi
	RUN_ID="$(curl_c "$BASE/runs" | grep -o '"run_id":"mp-1k-demo[^"]*"' | head -n1 | cut -d'"' -f4 || true)"
	if [ -n "$RUN_ID" ]; then
		say "MP-1K demo election already exists: $RUN_ID"
	else
		say "generating the MP-1K election (1,000 voters x 3 positions x 4 candidates, realistic)"
		RESP="$(curl_c -H 'Content-Type: application/json' -d '{
			"name":"MP-1K demo",
			"trustees":[{"name":"COMELEC"},{"name":"Civil Society Watch"},{"name":"University IT"},{"name":"Election Observer"},{"name":"Auditor Office"}],
			"threshold":3,"positions":3,"candidates":4,"senate_seats":2,
			"voters":1000,"distribution":"realistic","mode":"onchain"}' "$BASE/generate")"
		RUN_ID="$(printf '%s' "$RESP" | grep -o '"run_id":"[^"]*"' | cut -d'"' -f4)"
		[ -n "$RUN_ID" ] || fail "generate gave no run_id: $RESP"
		say "waiting for $RUN_ID to finish generating"
		sleep 2
		for _ in $(seq 1 600); do
			curl_c "$BASE/api/runs/$RUN_ID/status" | grep -q '"busy":false' && break
			sleep 2
		done
		curl_c "$BASE/api/runs/$RUN_ID/status" | grep -q '"busy":false' || fail "$RUN_ID still busy after 20 minutes; see $LOG"
	fi
	say "election ready: $RUN_ID"
else
	RUN_ID="$(curl -fsS "$BASE/runs" 2>/dev/null | grep -o '"run_id":"mp-1k-demo[^"]*"' | head -n1 | cut -d'"' -f4 || true)"
fi

# 6. URLs.
R="${RUN_ID:-<run-id>}"
cat <<URLS

Demo ready (console log: $LOG, pid file: $PIDFILE)
  admin     $BASE/admin/
  trustee 1 $BASE/trustee/?run=$R&trustee=1
  trustee 2 $BASE/trustee/?run=$R&trustee=2
  trustee 3 $BASE/trustee/?run=$R&trustee=3
  board     $BASE/board/?run=$R
  wizard    $BASE/wizard
  receipts  $RUNS_DIR/$R/receipts.csv
URLS
[ -n "$RUN_ID" ] || echo "  (no election yet: rerun with --seed, or create one in /admin/)"
