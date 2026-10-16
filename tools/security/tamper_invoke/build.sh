#!/usr/bin/env bash
# Build tamper_invoke from any checkout without editing the committed go.mod.
#
# go.mod keeps the AX42 replace paths (/root/Code/saksi/...) that the archived
# Chapter IV runs were built with. This writes a gitignored go.local.mod (and
# go.local.sum) whose replaces point at SAKSI_REPO instead, and builds with
# -modfile. SAKSI_REPO defaults to the saksi checkout next to balotachain
# (../../../../saksi from this directory).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="${SAKSI_REPO:-$here/../../../../saksi}"
repo="$(cd "$repo" && { pwd -W 2>/dev/null || pwd; })"  # Git Bash: Windows form for Go
[ -d "$repo/packages/saksi-bulletin/client-sdk" ] || { echo "no saksi checkout at $repo (set SAKSI_REPO)" >&2; exit 2; }
cd "$here"
sed "s#/root/Code/saksi/#$repo/#g" go.mod > go.local.mod
cp go.sum go.local.sum
go build -modfile=go.local.mod -o tamper_invoke .
[ "${VET:-0}" = 1 ] && go vet -modfile=go.local.mod ./...
echo "built $here/tamper_invoke against $repo"
