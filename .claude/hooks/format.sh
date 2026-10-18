#!/usr/bin/env bash
# Stop hook: formats the files changed in the working tree at the end of each Claude turn.
#   - server/: spotless:apply when a *.java file changed (silent until the pom has Spotless);
#   - app/: prettier on the changed app files (silent until app/ has prettier installed).
# Commands from progetto.yml (comandi.*.formattazione), limited to what changed.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"
status=0

# Server: only when Java files changed.
if [[ -x server/mvnw && -f server/pom.xml ]] && grep -q 'spotless-maven-plugin' server/pom.xml; then
  if git status --porcelain -- 'server/*.java' | grep -q .; then
    (cd server && ./mvnw -q spotless:apply >/dev/null 2>&1) || {
      echo "spotless:apply failed: run 'cd server && ./mvnw spotless:apply' to see why" >&2
      status=1
    }
  fi
fi

# App: prettier on changed (modified, added or untracked) files it knows how to format.
if [[ -x app/node_modules/.bin/prettier ]]; then
  mapfile -t files < <(
    git status --porcelain --untracked-files=all -- app/ |
      grep -v '^ *D' |
      sed -E 's/^.{3}//; s/.* -> //' |
      grep -E '\.(ts|tsx|js|jsx|mjs|cjs|json|md|css)$' |
      grep -v -E '^app/(node_modules|android|ios|dist|web-build|\.expo)/' |
      sed 's:^app/::' || true
  )
  if ((${#files[@]})); then
    (cd app && ./node_modules/.bin/prettier --write --log-level warn -- "${files[@]}" >/dev/null) || {
      echo "prettier failed: run 'cd app && npx prettier --check .' to see why" >&2
      status=1
    }
  fi
fi
exit "$status"
