#!/usr/bin/env sh
# Build the four browser apps the saksi-campaign console serves, and assemble
# them into the layout its --web-dir expects:
#
#   dist-web/board/     <- apps/auditor  (public bulletin board, base /board/)
#   dist-web/trustee/   <- apps/trustee  (trustee console,       base /trustee/)
#   dist-web/admin/     <- apps/admin    (admin console,         base /admin/)
#   dist-web/vote/      <- apps/vote     (phone voter app,       base /vote/)
#
# Then run the console pointed at it:
#
#   saksi-campaign serve --demo <saksi-demo> --web-dir "$(pwd)/dist-web"
#
# Serving them from the console keeps them same-origin with the API, which is
# what keeps its cross-origin POST guard protecting the write endpoints and
# lets the session cookie reach the API.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"

die() {
  printf 'build-web: %s\n' "$1" >&2
  exit 1
}

# dist-web is what the console serves on demo day. The vote app must never
# carry the local test election (VITE_LIVE_LOCAL, with its throwaway
# credential), make the mock its default client (VITE_LIVE_MOCK), or let
# `?mock=1` open the mock's practice election (VITE_LIVE_MOCK_SWITCH). Refuse
# any of them from the environment or from an (untracked, gitignored) .env
# file, then pin all three off for the build: Vite never lets a .env file
# override a variable already in the environment.
for var in VITE_LIVE_LOCAL VITE_LIVE_MOCK VITE_LIVE_MOCK_SWITCH; do
  eval "val=\${$var:-}"
  case "$val" in
    "" | 0) ;;
    *) die "$var=$val is set; dist-web must not carry the local test election or the mock. Unset it (build those with vite build --outDir elsewhere)." ;;
  esac
done
for f in apps/vote/.env apps/vote/.env.*; do
  [ -e "$f" ] || continue
  if grep -Eq '^[[:space:]]*(export[[:space:]]+)?VITE_LIVE_(LOCAL|MOCK|MOCK_SWITCH)[[:space:]]*=' "$f"; then
    die "$f sets VITE_LIVE_LOCAL, VITE_LIVE_MOCK or VITE_LIVE_MOCK_SWITCH; remove that line before building dist-web."
  fi
done

# The apps import @balotachain/ui through its package `exports`, which point at
# dist — so the shared package has to be built first.
pnpm --filter @balotachain/ui build
pnpm --filter auditor build
pnpm --filter trustee build
pnpm --filter admin build
VITE_LIVE_LOCAL=0 VITE_LIVE_MOCK=0 VITE_LIVE_MOCK_SWITCH=0 pnpm --filter vote build

rm -rf dist-web
mkdir -p dist-web/board dist-web/trustee dist-web/admin dist-web/vote
cp -R apps/auditor/dist/. dist-web/board/
cp -R apps/trustee/dist/. dist-web/trustee/
cp -R apps/admin/dist/. dist-web/admin/
cp -R apps/vote/dist/. dist-web/vote/

# Belt and braces: fail if any trace of the test election reached the bundle.
fixture=apps/vote/src/test/fixture/live-election.json
s_cred=$(sed -n 's/.*"s_cred": *"\([0-9a-f]*\)".*/\1/p' "$fixture" | head -n 1)
[ -n "$s_cred" ] || die "cannot read the test credential marker from $fixture"
if grep -rqE "vote-fixture|$s_cred" dist-web/vote; then
  rm -rf dist-web/vote
  die "dist-web/vote contains the local test election; removed it. Check VITE_LIVE_LOCAL and apps/vote/.env*."
fi
# ...or the mock: its election id and its IndexedDB name are in any bundle
# that can run it, and in no other.
if grep -rqE "live-mock|balotachain-vote-mock" dist-web/vote; then
  rm -rf dist-web/vote
  die "dist-web/vote contains the mock (practice election); removed it. Check VITE_LIVE_MOCK, VITE_LIVE_MOCK_SWITCH and apps/vote/.env*."
fi

printf '\nbuilt: %s/dist-web\n' "$root"
printf 'serve: saksi-campaign serve --demo <saksi-demo> --web-dir "%s/dist-web"\n' "$root"
