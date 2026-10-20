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

# T3: the API is closed without login.
status=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "$BASE/api/families") || fail "GET /api/families unreachable"
[[ $status == 401 ]] || fail "GET /api/families without login is not 401 ($status)"
log "ok: GET /api/families without login is 401"

# T3: the login page is prerendered (in English) and a bundle carries both languages.
login_page=$("${CURL[@]}" -w '\n%{http_code}' "$BASE/login") || fail "GET /login unreachable"
[[ ${login_page##*$'\n'} == 200 ]] || fail "GET /login is not 200"
[[ $login_page == *"Sign in to planforhome"* ]] || fail "GET /login is not the sign-in page"
found_bundle=0
while IFS= read -r src; do
  [[ -n $src ]] || continue
  [[ $src == /* ]] || continue
  js=$("${CURL[@]}" "$BASE$src") || continue
  if [[ $js == *"Accedi a planforhome"* && $js == *"Sign in to planforhome"* ]]; then
    found_bundle=1
    break
  fi
done < <(grep -oE '<script[^>]* src="[^"]+"' <<<"$login_page" | grep -oE 'src="[^"]+"' | sed -E 's/^src="//; s/"$//')
[[ $found_bundle == 1 ]] || fail "no bundle of /login has both languages"
log "ok: GET /login and its bundle"

# T3: renewing a session needs a session.
status=$("${CURL[@]}" -X POST -o /dev/null -w '%{http_code}' "$BASE/api/auth/refresh") || fail "POST /api/auth/refresh unreachable"
[[ $status == 401 ]] || fail "POST /api/auth/refresh without a session is not 401 ($status)"
log "ok: POST /api/auth/refresh without a session is 401"
log "smoke passed"
