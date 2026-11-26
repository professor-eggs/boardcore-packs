#!/usr/bin/env bash
# Claude Code Stop hook: when an agent ends its turn with code changes (uncommitted, or committed on a
# branch that differs from origin/main), run the lint, the type-aware lint and the typecheck and hand any
# errors back, so it fixes them while it still has the context. The type-aware lint is skipped when
# oxlint-tsgolint's binary isn't installed. Each code state is checked once per session, pass or fail,
# so an unchanged tree (or someone else's broken work in progress) never blocks turn after turn, and a
# second stop in the same turn (stop_hook_active) is always let through.
input=$(cat)
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then exit 0; fi
field() { printf '%s' "$input" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -n 1 | sed 's/.*"\([^"]*\)"$/\1/'; }
cwd=$(field cwd)
root=$(git -C "${cwd:-${CLAUDE_PROJECT_DIR:-.}}" rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
command -v pnpm >/dev/null 2>&1 || exit 0
# The lint loads Boardcore's plugin and the typecheck reads its packages, so the submodule must be installed.
[ -x node_modules/.bin/oxlint ] && [ -x node_modules/.bin/tsc ] && [ -d boardcore/node_modules ] || exit 0
code=(-- '*.ts' '*.mts' '*.js' '*.mjs' '*.json')
if [ -z "$(git status --porcelain "${code[@]}" 2>/dev/null)" ] && git diff --quiet origin/main...HEAD "${code[@]}" 2>/dev/null; then exit 0; fi
# The code state: HEAD plus the uncommitted code diff and untracked code files.
stamp=$( { git rev-parse HEAD; git diff HEAD "${code[@]}"; git ls-files --others --exclude-standard "${code[@]}" | xargs -r cat; } 2>/dev/null | git hash-object --stdin)
sid=$(field session_id)
stamp_file="$(git rev-parse --git-dir)/claude-check-${sid:-any}"
[ "$(cat "$stamp_file" 2>/dev/null)" = "$stamp" ] && exit 0
printf '%s' "$stamp" > "$stamp_file"
# The type-aware lint needs oxlint-tsgolint's binary, an optional package for this platform
# (@oxlint-tsgolint/<platform>-<arch>); node_modules/.bin/tsgolint is only a shim, there either way.
tsgolint_ok() {
  node -e 'const { platform: p, arch } = process; const fs = require("node:fs");
    const r = require("node:module").createRequire(require.resolve("oxlint-tsgolint/package.json"));
    fs.accessSync(r.resolve(`@oxlint-tsgolint/${p}-${arch}/tsgolint${p === "win32" ? ".exe" : ""}`), fs.constants.X_OK);' 2>/dev/null
}
# Every check runs, so a lint failure can't hide a type error (the hook blocks only once per turn). The
# type-aware lint runs every plain rule too, so after a lint failure it would only repeat those errors: it
# waits for a passing lint (the fixed code is a new state, checked at the next stop).
out=$( {
  pnpm -s lint; a=$?
  t=0; if [ "$a" -eq 0 ] && tsgolint_ok; then pnpm -s lint:types; t=$?; fi
  pnpm -s typecheck; b=$?
  exit $(( a || t || b ))
} 2>&1 )
[ $? -eq 0 ] && exit 0
n=$(printf '%s\n' "$out" | wc -l)
{
  echo "pnpm lint, pnpm lint:types or pnpm typecheck failed on the code in this checkout. Fix these before you finish, or say why they should stay:"
  printf '%s\n' "$out" | head -n 60
  [ "$n" -gt 60 ] && echo "(… $((n - 60)) more lines: run pnpm lint, pnpm lint:types and pnpm typecheck to see them all)"
} >&2
exit 2
