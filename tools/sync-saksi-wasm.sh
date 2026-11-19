#!/usr/bin/env sh
# Copy a freshly built @saksi/wasm package from a saksi checkout into
# packages/saksi-wasm/ and rewrite packages/saksi-wasm/PROVENANCE.md.
#
#   tools/sync-saksi-wasm.sh /path/to/saksi
#
# Build the package first, in the saksi checkout:
#
#   tools/live/build-wasm.sh          # writes packages/saksi-wasm/pkg/
#
# This script never builds anything. It refuses when the saksi checkout has
# uncommitted changes, when the package's recorded git revision is missing,
# marked -dirty, or not in that checkout's history, and when a file is
# missing, so the vendored copy always names a commit anyone can rebuild.
set -eu

die() {
  printf 'sync-saksi-wasm: %s\n' "$1" >&2
  exit 1
}

saksi=${1:-}
[ -n "$saksi" ] || die "usage: tools/sync-saksi-wasm.sh /path/to/saksi"
command -v jq >/dev/null 2>&1 || die "needs jq"

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
saksi=$(CDPATH= cd -- "$saksi" && pwd) || die "no such directory: $1"
pkg="$saksi/packages/saksi-wasm/pkg"
dest="$root/packages/saksi-wasm"

FILES="package.json index.js index.d.ts wire.d.ts saksi_wasm.js saksi_wasm.d.ts saksi_wasm_bg.wasm saksi_wasm_bg.wasm.d.ts"

git -C "$saksi" rev-parse --git-dir >/dev/null 2>&1 || die "$saksi is not a git checkout"
# --no-optional-locks: read the checkout without refreshing its index.
dirty=$(git --no-optional-locks -C "$saksi" status --porcelain)
if [ -n "$dirty" ]; then
  printf '%s\n' "$dirty" >&2
  die "$saksi has uncommitted changes; commit or discard them, rebuild, then sync"
fi

for f in $FILES; do
  [ -f "$pkg/$f" ] || die "missing $pkg/$f (run tools/live/build-wasm.sh in saksi first)"
done

name=$(jq -r .name "$pkg/package.json")
[ "$name" = "@saksi/wasm" ] || die "package is named $name, want @saksi/wasm"
version=$(jq -r .version "$pkg/package.json")
rev=$(jq -r '.saksi.git_rev // empty' "$pkg/package.json")
case "$rev" in
  "") die "package.json has no saksi.git_rev: it was not built by tools/live/build-wasm.sh" ;;
  *-dirty) die "package was built from a dirty checkout ($rev); rebuild from a clean commit" ;;
esac
full=$(git -C "$saksi" rev-parse --verify --quiet "$rev^{commit}") ||
  die "package was built at $rev, which this checkout does not have"
head=$(git -C "$saksi" rev-parse HEAD)
git -C "$saksi" merge-base --is-ancestor "$full" "$head" ||
  die "package was built at $rev, which is not in the history of HEAD"
if [ "$full" != "$head" ]; then
  printf 'sync-saksi-wasm: note: package built at %s, checkout is at %s; rebuild if the crates changed since\n' \
    "$rev" "$(git -C "$saksi" rev-parse --short HEAD)" >&2
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha() { sha256sum "$1" | cut -d' ' -f1; }
else
  sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
fi

# Never write through a symlink, in the source or the destination.
[ -L "$dest" ] && die "$dest is a symlink; refusing to write through it"
mkdir -p "$dest"
for f in $FILES PROVENANCE.md; do
  if [ "$f" != PROVENANCE.md ] && [ -L "$pkg/$f" ]; then
    die "$pkg/$f is a symlink; refusing to copy it"
  fi
  [ -L "$dest/$f" ] && die "$dest/$f is a symlink; refusing to write through it"
done
for f in $FILES; do
  cp "$pkg/$f" "$dest/$f"
done

{
  printf '# Provenance of the vendored @saksi/wasm package\n\n'
  printf 'These files are copied unchanged from a saksi build. Do not edit them;\n'
  printf 're-sync with `tools/sync-saksi-wasm.sh /path/to/saksi` instead.\n\n'
  printf -- '- Package: `%s` %s\n' "$name" "$version"
  printf -- '- Built at saksi commit: `%s` (`%s`)\n' "$rev" "$full"
  printf -- '- Build command (in the saksi checkout): `tools/live/build-wasm.sh`\n'
  printf -- '- Source: `packages/saksi-wasm/pkg/` of that build (the `web` target)\n'
  printf -- '- Wire format: saksi `docs/live/wire-format.md`, section "WebAssembly (phone)"\n'
  printf -- '- After each re-sync, run the issuance tests once with the same build'"'"'s CLI:\n'
  printf -- '  `SAKSI_DEMO=/path/to/saksi-demo pnpm --filter vote exec vitest run src/lib/real.test.ts`\n\n'
  printf '| File | Bytes | SHA-256 |\n|---|---:|---|\n'
  for f in $FILES; do
    printf '| `%s` | %s | `%s` |\n' "$f" "$(wc -c <"$dest/$f" | tr -d ' ')" "$(sha "$dest/$f")"
  done
} >"$dest/PROVENANCE.md"

printf 'synced @saksi/wasm %s (saksi %s) into %s\n' "$version" "$rev" "$dest"
printf 'next: run the issuance tests against that build'"'"'s CLI once:\n'
printf '  SAKSI_DEMO=/path/to/saksi-demo pnpm --filter vote exec vitest run src/lib/real.test.ts\n'

