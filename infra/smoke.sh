#!/usr/bin/env bash
# Runs on the runner. Probes https://$LAB_BASE_DOMAIN from outside; exits != 0 at the first failed check.
# Checks grow with the milestones (infra/README.md). Now: T1.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"

require_vars LAB_BASE_DOMAIN GIT_SHA
validate_host "$LAB_BASE_DOMAIN" || die "invalid LAB_BASE_DOMAIN" 3
BASE="https://$LAB_BASE_DOMAIN"
CURL=(curl -sS --max-time 15 --retry 6 --retry-delay 5 --retry-connrefused)

fail() { die "smoke: $*"; }

# T1: health with the deployed commit.
body=$("${CURL[@]}" -w '\n%{http_code}' "$BASE/api/health") || fail "GET /api/health unreachable"
[[ ${body##*$'\n'} == 200 ]] || fail "GET /api/health is not 200"
[[ $body == *"\"sha\":\"$GIT_SHA\""* ]] || fail "/api/health does not report $GIT_SHA"
log "ok: /api/health reports $GIT_SHA"

# T1: the initial page.
page=$("${CURL[@]}" -w '\n%{http_code}' "$BASE/") || fail "GET / unreachable"
[[ ${page##*$'\n'} == 200 ]] || fail "GET / is not 200"
[[ $page == *planforhome* ]] || fail "GET / does not look like the app"
log "ok: GET /"

# T1: http redirects permanently to https.
code=$(curl -sS --max-time 15 -o /dev/null -w '%{http_code} %{redirect_url}' "http://$LAB_BASE_DOMAIN/") || fail "http unreachable"
[[ $code == 301\ https://* || $code == 308\ https://* ]] || fail "http does not redirect permanently to https ($code)"
log "ok: http redirects"

# T1: HSTS.
headers=$("${CURL[@]}" -I "$BASE/") || fail "HEAD / unreachable"
grep -qi '^strict-transport-security:' <<<"$headers" || fail "missing Strict-Transport-Security header"
log "ok: HSTS"
log "smoke passed"
