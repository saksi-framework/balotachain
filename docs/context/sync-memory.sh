#!/usr/bin/env bash
# Copy this device's Claude Code memory for this checkout into docs/context/memory,
# so it can be committed. Private network addresses are redacted on the way in.
# Review `git diff docs/context/memory` before committing.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) abs="$(cygpath -w "$repo")" ;;
  *) abs="$repo" ;;
esac
key="$(printf '%s' "$abs" | sed 's/[^A-Za-z0-9]/-/g')"
src="${HOME}/.claude/projects/${key}/memory"
[ -d "$src" ] || { echo "no Claude Code memory for this checkout at $src" >&2; exit 1; }

out="$repo/docs/context/memory"
mkdir -p "$out"
for f in "$src"/*.md; do
  sed -E 's/\b(10|100|172|192)\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(:[^ `]*)?/<LAN address>/g' "$f" > "$out/$(basename "$f")"
done
echo "synced $(ls "$src"/*.md | wc -l) notes from $src"
git -C "$repo" status --short -- docs/context/memory
