#!/usr/bin/env bash
# Install docs/context/memory into this device's Claude Code memory for this checkout.
# Claude Code keys a project's memory by the checkout's absolute path with every
# character that is not a letter or digit replaced by "-". A file already there is
# kept when it is newer than the repository copy.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) abs="$(cygpath -w "$repo")" ;;
  *) abs="$repo" ;;
esac
key="$(printf '%s' "$abs" | sed 's/[^A-Za-z0-9]/-/g')"
dest="${HOME}/.claude/projects/${key}/memory"
mkdir -p "$dest"

for f in "$repo"/docs/context/memory/*.md; do
  name="$(basename "$f")"
  if [ -e "$dest/$name" ] && [ "$dest/$name" -nt "$f" ]; then
    echo "kept (newer on this device): $name"
  else
    cp "$f" "$dest/$name"
    echo "restored: $name"
  fi
done
echo "memory: $dest"
