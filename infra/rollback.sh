#!/usr/bin/env bash
# Runs on the runner. Puts back the images saved as "precedente" by the last deploy.
# Same lock as deploy (taken by remote.sh). Exit != 0 when there is nothing to go back to.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$HERE/lib.sh"

require_vars DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
validate_host "$DEPLOY_HOST" || die "invalid DEPLOY_HOST" 3
validate_user "$DEPLOY_USER" || die "invalid DEPLOY_USER" 3
GHCR_USER=${GHCR_USER:-none}
validate_user "$GHCR_USER" || die "invalid GHCR_USER" 3
[[ ${GHCR_TOKEN-} != *$'\n'* ]] || die "GHCR_TOKEN contains a newline" 3

ssh_setup
log "running remote.sh rollback"
printf '%s\n' "${GHCR_TOKEN-}" |
  remote "bash '$REMOTE_ROOT/remote.sh' rollback '$GHCR_USER'"
log "rollback done"
