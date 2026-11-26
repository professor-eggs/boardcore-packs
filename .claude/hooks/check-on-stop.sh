#!/usr/bin/env bash
# Claude Code Stop hook: before an agent ends its turn with uncommitted code changes, run the lint and
# the typecheck (a few seconds) and hand any errors back so it fixes them while it still has the context.
# It blocks once per turn: if the agent stops again with errors left (stop_hook_active), it lets it go.
input=$(cat)
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -d node_modules ] && [ -d boardcore/node_modules ] || exit 0
changed=$(git status --porcelain -- '*.ts' '*.mts' '*.js' '*.mjs' '*.json' 2>/dev/null)
[ -z "$changed" ] && exit 0
if ! out=$( { pnpm -s lint && pnpm -s typecheck; } 2>&1 ); then
  {
    echo "pnpm lint or pnpm typecheck failed on your uncommitted changes. Fix these before you finish, or say why they should stay:"
    printf '%s\n' "$out" | tail -n 60
  } >&2
  exit 2
fi
exit 0
