#!/usr/bin/env bash
# Runs on the runner. Usage: deploy.sh <server-image@sha256:...> <web-image@sha256:...>
# Copies the files to the server and runs remote.sh there. Builds nothing. Idempotent.
# Exit: 0 ok, 2 invalid arguments, 3 missing configuration, other: failure.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"

[[ $# -eq 2 ]] || die "usage: deploy.sh <server-image> <web-image>" 2
IMAGE_SERVER=$1
IMAGE_WEB=$2
validate_image "$IMAGE_SERVER" || die "invalid server image reference (need ghcr.io/...@sha256:<64 hex>)" 2
validate_image "$IMAGE_WEB" || die "invalid web image reference (need ghcr.io/...@sha256:<64 hex>)" 2

require_vars DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS DEMO_PASSWORD GHCR_USER GHCR_TOKEN GIT_SHA LAB_BASE_DOMAIN
validate_host "$LAB_BASE_DOMAIN" || die "invalid LAB_BASE_DOMAIN" 3
validate_host "$DEPLOY_HOST" || die "invalid DEPLOY_HOST" 3
validate_user "$DEPLOY_USER" || die "invalid DEPLOY_USER" 3
validate_user "$GHCR_USER" || die "invalid GHCR_USER" 3
validate_sha "$GIT_SHA" || die "GIT_SHA must be 40 hex characters" 3
for secret in GHCR_TOKEN DEMO_PASSWORD; do
  [[ ${!secret} != *$'\n'* && ${!secret} != *"'"* ]] || die "$secret contains a newline or a single quote" 3
done

FCM_B64=
if [[ -n ${FCM_SERVICE_ACCOUNT_JSON-} ]]; then
  FCM_B64=$(printf '%s' "$FCM_SERVICE_ACCOUNT_JSON" | base64 | tr -d '\n')
fi

ssh_setup
INCOMING="$REMOTE_ROOT/incoming/$GIT_SHA"

log "copying files to $INCOMING"
remote "umask 077 && mkdir -p '$INCOMING'"
scp "${SSH_OPTS[@]}" \
  "$HERE/remote.sh" "$HERE/lib.sh" "$HERE/docker-compose.yml" "$HERE/Caddyfile" "$HERE/env.example" \
  "$DEST:$INCOMING/"

log "running remote.sh deploy"
# Secrets travel on stdin only (printf is a builtin: nothing shows up in a process list).
printf '%s\n%s\n%s\n' "$GHCR_TOKEN" "$DEMO_PASSWORD" "$FCM_B64" |
  remote "bash '$INCOMING/remote.sh' deploy '$IMAGE_SERVER' '$IMAGE_WEB' '$GHCR_USER' '$LAB_BASE_DOMAIN'"
log "deploy done: $GIT_SHA"
