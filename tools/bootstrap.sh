#!/usr/bin/env sh
set -eu

missing=0

check() {
  if command -v "$1" >/dev/null 2>&1; then
    printf 'ok: %s\n' "$1"
  else
    printf 'missing: %s\n' "$1"
    missing=1
  fi
}

check git
check gh
check rustc
check cargo
check go
check node
check corepack
check docker
check flutter
check dart

if [ "$missing" -ne 0 ]; then
  printf '\nInstall the missing tools, then run this script again.\n'
  printf 'See docs/dev-environment.md for platform-specific setup notes.\n'
  exit 1
fi

printf '\nAll expected tool commands are available.\n'
printf 'Next: corepack enable && pnpm install\n'

