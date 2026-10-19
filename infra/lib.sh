#!/usr/bin/env bash
# Common functions for the deploy scripts. Sourced, never run. Runs on the runner and on the server.
# Nothing here prints a secret: secrets are only ever passed on stdin or written to files (mode 600).

REMOTE_ROOT=/opt/planforhome
IMAGE_RE='^ghcr\.io/[a-z0-9][a-z0-9._/-]*@sha256:[0-9a-f]{64}$'

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() {
  log "ERROR: $*"
  exit "${2:-1}"
}

# validate_image <reference>: only ghcr.io/...@sha256:<64 hex>.
validate_image() { [[ ${1-} =~ $IMAGE_RE ]]; }
validate_sha() { [[ ${1-} =~ ^[0-9a-f]{40}$ ]]; }
validate_host() { [[ ${1-} =~ ^[A-Za-z0-9][A-Za-z0-9._:-]*$ ]]; }
validate_user() { [[ ${1-} =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; }

# require_vars NAME...: fails (exit 3) naming the missing variables, never their values.
require_vars() {
  local name missing=()
  for name in "$@"; do
    [[ -n ${!name-} ]] || missing+=("$name")
  done
  [[ ${#missing[@]} -eq 0 ]] || die "missing required variables: ${missing[*]}" 3
}

# ssh_setup: writes the key and the pinned host key to a private temp dir and fills SSH_OPTS.
# Needs DEPLOY_SSH_KEY and DEPLOY_KNOWN_HOSTS (the contents). No trust on first use.
ssh_setup() {
  SSH_TMP=$(umask 077 && mktemp -d)
  trap 'rm -rf "$SSH_TMP"' EXIT
  (umask 077 && printf '%s\n' "$DEPLOY_SSH_KEY" >"$SSH_TMP/key" && printf '%s\n' "$DEPLOY_KNOWN_HOSTS" >"$SSH_TMP/known_hosts")
  SSH_OPTS=(
    -o StrictHostKeyChecking=yes
    -o "UserKnownHostsFile=$SSH_TMP/known_hosts"
    -o IdentitiesOnly=yes
    -o BatchMode=yes
    -o ConnectTimeout=20
    -i "$SSH_TMP/key"
  )
  DEST="$DEPLOY_USER@$DEPLOY_HOST"
}

# remote <command>: runs the command on the server; stdin is passed through.
remote() { ssh "${SSH_OPTS[@]}" "$DEST" "$1"; }
