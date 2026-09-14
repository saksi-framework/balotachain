#!/usr/bin/env bash
# ban-init installer. Idempotent: safe to run on a fresh repo or an existing one.
# Usage: install.sh [--caveman lite|full|ultra] [--dry-run]
# Writes:  .claude/agents/{scout,mech-executor,deep-worker,reviewer,final-reviewer}.md  (only if missing)
#          a marked section in ./CLAUDE.md (created if absent; existing content untouched)
#          ~/.claude/.caveman-active (session caveman level)
# Prints one STATUS line per item: installed | present | skipped.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TPL="$SKILL_DIR/templates"
LEVEL="ultra"
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --caveman) LEVEL="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
case "$LEVEL" in lite|full|ultra) ;; *) echo "caveman level must be lite|full|ultra" >&2; exit 2 ;; esac

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "STATUS repo: not a git repository. Run 'git init' first, then re-run /ban-init." >&2
  exit 3
fi
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# --- prerequisites ---------------------------------------------------------
SDD=""
for d in "$HOME/.claude/plugins/cache/claude-plugins-official/superpowers"/*/skills/subagent-driven-development \
         "$HOME/.claude/skills/subagent-driven-development"; do
  [ -f "$d/SKILL.md" ] && SDD="$d" && break
done
if [ -z "$SDD" ]; then
  echo "STATUS superpowers: MISSING. ban-init wraps superpowers:subagent-driven-development; install the superpowers plugin (claude plugin install superpowers) and re-run." >&2
  exit 4
fi
echo "STATUS superpowers: present ($SDD)"

CAVE=""
for d in "$HOME/.claude/plugins/cache/caveman/caveman"/*/skills/caveman; do
  [ -f "$d/SKILL.md" ] && CAVE="$d" && break
done
[ -n "$CAVE" ] && echo "STATUS caveman: present" || echo "STATUS caveman: MISSING (ban-init still installs; token rules degrade to plain prose)"

# --- agents ------------------------------------------------------------------
mkdir -p .claude/agents
for a in scout executor mech-executor reviewer final-reviewer; do
  dst=".claude/agents/$a.md"
  if [ -f "$dst" ]; then
    echo "STATUS agent $a: present (not overwritten)"
  else
    [ "$DRY" = 1 ] || cp "$TPL/agents/$a.md" "$dst"
    echo "STATUS agent $a: installed"
  fi
done

# --- CLAUDE.md section --------------------------------------------------------
BEGIN="<!-- ban-init:begin -->"
END="<!-- ban-init:end -->"
if [ -f CLAUDE.md ] && grep -qF "$BEGIN" CLAUDE.md; then
  echo "STATUS CLAUDE.md section: present"
else
  if [ "$DRY" != 1 ]; then
    [ -f CLAUDE.md ] || printf '# CLAUDE.md\n\n' > CLAUDE.md
    { printf '\n%s\n' "$BEGIN"; cat "$TPL/CLAUDE-section.md"; printf '%s\n' "$END"; } >> CLAUDE.md
  fi
  echo "STATUS CLAUDE.md section: installed"
fi

# --- ledger dir is owned by superpowers (.superpowers/sdd/<plan>/); nothing to create here.

# --- caveman level --------------------------------------------------------------
if [ -n "$CAVE" ]; then
  [ "$DRY" = 1 ] || printf '%s' "$LEVEL" > "$HOME/.claude/.caveman-active"
  echo "STATUS caveman level: $LEVEL"
fi

echo "STATUS done: ban-init ready in $ROOT"
