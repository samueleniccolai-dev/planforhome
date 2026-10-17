#!/usr/bin/env bash
# SessionStart hook, Claude Code cloud sessions only (also Routines): prepares the container so
# that the commands of progetto.yml run as in CI. The cloud image may lack:
#   1. JDK 25: installed from Ubuntu's own repositories;
#   2. Node 24 LTS: installed with nvm when the image has it;
#   3. a running Docker daemon, needed by Testcontainers (PostgreSQL) in the server tests;
#   4. the Chromium build Playwright expects: the image has an older one under /opt/pw-browsers
#      and the Playwright download site may not be reachable, so a link with the expected name
#      points at the image's build. CI installs the exact build and stays the judge.
# Then it warms up Maven (server/) and npm (app/), so the cached container already has them.
# No Android SDK here: the APK is built only in CI (progetto.yml, sessione.android_sdk).
#
# Idempotent, non-interactive, synchronous (the session starts when the tools are ready).
# Every step is best effort: a failure is reported and the next step still runs.
# A local machine is left alone: there the developer installs these once.
set -uo pipefail

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

env_file="${CLAUDE_ENV_FILE:-/dev/null}"
jdk=/usr/lib/jvm/java-25-openjdk-amd64
problems=()
warn() { problems+=("$1"); echo "session-start: $1" >&2; }

# 1. JDK 25 (progetto.yml: sessione.jdk).
if [[ ! -x "$jdk/bin/java" ]]; then
  { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      openjdk-25-jdk-headless; } >/dev/null 2>&1 || warn "JDK 25 not installed (apt-get failed)"
fi
if [[ -x "$jdk/bin/java" ]]; then
  export JAVA_HOME="$jdk" PATH="$jdk/bin:$PATH"
  echo "export JAVA_HOME=$jdk" >>"$env_file"
  echo "export PATH=$jdk/bin:\$PATH" >>"$env_file"
fi

# 2. Node 24 LTS (progetto.yml: sessione.node).
node_major() { node -v 2>/dev/null | sed -n 's/^v\([0-9]*\).*/\1/p'; }
if [[ "$(node_major)" != "24" ]]; then
  nvm_sh="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -s "$nvm_sh" ]]; then
    # shellcheck disable=SC1090
    { . "$nvm_sh" && nvm install 24 && nvm alias default 24; } >/tmp/session-start-node.log 2>&1 ||
      warn "Node 24 not installed with nvm (see /tmp/session-start-node.log)"
    node_bin="$(dirname "$(command -v node 2>/dev/null || echo /nonexistent/node)")"
    [[ "$(node_major)" == "24" ]] && echo "export PATH=$node_bin:\$PATH" >>"$env_file"
  else
    warn "Node $(node -v 2>/dev/null || echo missing) instead of 24 and no nvm: app commands may differ from CI"
  fi
fi

# 3. Docker daemon (Testcontainers starts PostgreSQL in a container).
docker_up() { docker info >/dev/null 2>&1; }
if ! docker_up && command -v dockerd >/dev/null; then
  # A daemon may be starting (wait for it) or shutting down (wait until it is gone).
  for _ in $(seq 1 30); do
    docker_up && break
    pgrep -x dockerd >/dev/null || break
    sleep 1
  done
  if ! docker_up; then
    # A pid file left by a daemon that is gone would stop the new one at once.
    pgrep -x dockerd >/dev/null || rm -f /var/run/docker.pid
    nohup dockerd >>/tmp/dockerd.log 2>&1 &
    for _ in $(seq 1 60); do
      docker_up && break
      sleep 1
    done
  fi
fi
docker_up || warn "Docker daemon not running (see /tmp/dockerd.log)"

# 4. Maven dependencies and plugins of the server.
if [[ -x server/mvnw ]]; then
  (cd server && ./mvnw -B -ntp -q -DskipTests test-compile) >/tmp/session-start-maven.log 2>&1 ||
    warn "Maven warm-up failed (see /tmp/session-start-maven.log)"
fi

# 5. npm dependencies of the app (lockfile only: npm ci never changes package-lock.json).
if [[ -f app/package-lock.json ]]; then
  (cd app && npm ci --no-audit --no-fund) >/tmp/session-start-npm.log 2>&1 ||
    warn "npm ci failed (see /tmp/session-start-npm.log)"
fi

# 6. Chromium for the Playwright tests of the web app.
browsers_json=app/node_modules/playwright-core/browsers.json
pw_version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' app/node_modules/playwright-core/package.json 2>/dev/null | head -1)"
if [[ ! -f "$browsers_json" ]]; then
  chromium="not needed (no Playwright in app/ yet)"
elif [[ -d /opt/pw-browsers ]]; then
  revision="$(python3 -I -c '
import json, sys
print(next(b["revision"] for b in json.load(open(sys.argv[1]))["browsers"]
           if b["name"] == "chromium-headless-shell"))' "$browsers_json" 2>/dev/null)"
  wanted="chromium_headless_shell-$revision/chrome-headless-shell-linux64/chrome-headless-shell"
  if [[ -z "$revision" ]]; then
    warn "Chromium revision not found in $browsers_json"
  elif [[ -x "/opt/pw-browsers/$wanted" ]]; then
    browsers=/opt/pw-browsers
    chromium="build $revision"
  else
    have="$(find /opt/pw-browsers -maxdepth 1 -name 'chromium_headless_shell-*' 2>/dev/null | sort -t- -k2 -n | tail -1)"
    exe=""
    for candidate in "$have/chrome-headless-shell-linux64/chrome-headless-shell" \
      "$have/chrome-linux/headless_shell"; do
      [[ -x "$candidate" ]] && exe="$candidate" && break
    done
    if [[ -n "$exe" ]]; then
      browsers="$HOME/.cache/planforhome/pw-browsers"
      mkdir -p "$browsers/$(dirname "$wanted")"
      ln -sfn "$exe" "$browsers/$wanted"
      touch "$browsers/chromium_headless_shell-$revision/INSTALLATION_COMPLETE"
      chromium="$(basename "$have") standing in for build $revision"
      warn "Playwright $pw_version wants Chromium build $revision, using the image's $(basename "$have") (CI uses the exact one)"
    else
      warn "no Chromium headless shell under /opt/pw-browsers: browser tests will fail"
    fi
  fi
  [[ -n "${browsers:-}" ]] && echo "export PLAYWRIGHT_BROWSERS_PATH=$browsers" >>"$env_file"
else
  warn "no /opt/pw-browsers in the image: browser tests may fail"
fi

# java -version also prints "Picked up JAVA_TOOL_OPTIONS ...": keep only the version line.
java_version="$("$jdk/bin/java" -version 2>&1 | grep -m1 ' version ' | cut -d'"' -f2)"
docker_version=off
docker_up && docker_version="$(docker info --format '{{.ServerVersion}}' 2>/dev/null)"
echo "session-start: JDK ${java_version:-missing}, Node $(node -v 2>/dev/null || echo missing)," \
  "Docker $docker_version, Chromium ${chromium:-missing} for Playwright ${pw_version:-?};" \
  "${#problems[@]} warning(s)"
exit 0
