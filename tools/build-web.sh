#!/usr/bin/env sh
# Build the three browser apps the saksi-campaign console serves, and assemble
# them into the layout its --web-dir expects:
#
#   dist-web/board/     <- apps/auditor  (public bulletin board, base /board/)
#   dist-web/trustee/   <- apps/trustee  (trustee console,       base /trustee/)
#   dist-web/admin/     <- apps/admin    (admin console,         base /admin/)
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

# The apps import @balotachain/ui through its package `exports`, which point at
# dist — so the shared package has to be built first.
pnpm --filter @balotachain/ui build
pnpm --filter auditor build
pnpm --filter trustee build
pnpm --filter admin build

rm -rf dist-web
mkdir -p dist-web/board dist-web/trustee dist-web/admin
cp -R apps/auditor/dist/. dist-web/board/
cp -R apps/trustee/dist/. dist-web/trustee/
cp -R apps/admin/dist/. dist-web/admin/

printf '\nbuilt: %s/dist-web\n' "$root"
printf 'serve: saksi-campaign serve --demo <saksi-demo> --web-dir "%s/dist-web"\n' "$root"
