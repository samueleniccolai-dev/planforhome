#!/usr/bin/env bash
# Runs on the server, from its own folder. Usage:
#   remote.sh deploy <server-image> <web-image> <ghcr-user> <domain>   (stdin: GHCR_TOKEN, DEMO_PASSWORD, FCM base64)
#   remote.sh rollback <ghcr-user>                            (stdin: GHCR_TOKEN, may be empty)
# Takes the lock first, then moves the files received in incoming/<sha>/ into place, writes the .env
# (mode 600), pulls, starts the stack and checks that server and caddy run exactly the expected images.
set -euo pipefail
umask 077

HERE=$(cd "$(dirname "$0")" && pwd)
case $HERE in
  */incoming/*) ROOT=${HERE%/incoming/*} ;;
  *) ROOT=$HERE ;;
esac
# shellcheck source=lib.sh
. "$HERE/lib.sh"

MODE=${1-}
LOCK_WAIT=${LOCK_WAIT:-300}

read_secret() { IFS= read -r "$1" || true; }

get_env() { sed -n "s/^$1='\\(.*\\)'\$/\\1/p" "$ROOT/.env" 2>/dev/null | head -n 1; }

set_env() { # set_env KEY VALUE
  local tmp="$ROOT/.env.tmp"
  {
    grep -v "^$1=" "$ROOT/.env" 2>/dev/null || true
    printf "%s='%s'\n" "$1" "$2"
  } >"$tmp"
  mv -f "$tmp" "$ROOT/.env"
}

pull_images() { # pull_images <token> <user> <image>...
  local token=$1 user=$2 rc=0
  shift 2
  if [[ -z $token ]]; then
    log "no registry token: skipping login and pull"
    return 0
  fi
  printf '%s' "$token" | docker login ghcr.io -u "$user" --password-stdin >/dev/null || rc=$?
  if [[ $rc -eq 0 ]]; then
    local image
    for image in "$@"; do
      docker pull "$image" >/dev/null || {
        rc=$?
        break
      }
    done
  fi
  docker logout ghcr.io >/dev/null 2>&1 || true
  return "$rc"
}

service_image() { # prints the image reference of a running service, from "docker compose ps"
  docker compose ps --format '{{.Service}} {{.Image}}' | awk -v s="$1" '$1 == s { print $2 }'
}

start_and_verify() { # start_and_verify <server-image> <web-image>
  set_env IMAGE_SERVER "$1"
  set_env IMAGE_WEB "$2"
  (cd "$ROOT" && docker compose up -d --wait --wait-timeout 180) || die "docker compose up failed"
  local actual_server actual_web
  actual_server=$(cd "$ROOT" && service_image server)
  actual_web=$(cd "$ROOT" && service_image caddy)
  [[ $actual_server == "$1" ]] || die "digest check failed: server runs '${actual_server:-nothing}'"
  [[ $actual_web == "$2" ]] || die "digest check failed: caddy runs '${actual_web:-nothing}'"
  log "digest check ok"
}

write_state() { printf '%s\n%s\n' "$2" "$3" >"$ROOT/$1"; }

take_lock() {
  mkdir -p "$ROOT"
  exec 9>"$ROOT/deploy.lock"
  flock -w "$LOCK_WAIT" 9 || die "could not take the deploy lock within ${LOCK_WAIT}s"
  log "lock taken"
}

install_incoming() {
  [[ $HERE != "$ROOT" ]] || return 0
  local f
  for f in lib.sh docker-compose.yml Caddyfile env.example remote.sh; do
    mv -f "$HERE/$f" "$ROOT/$f"
  done
  rmdir "$HERE" 2>/dev/null || true
}

do_deploy() {
  local server=$1 web=$2 user=$3 domain=$4 token demo fcm
  validate_image "$server" && validate_image "$web" || die "invalid image reference" 2
  validate_user "$user" || die "invalid registry user" 2
  read_secret token
  read_secret demo
  read_secret fcm
  [[ -n $token && -n $demo ]] || die "missing secrets on stdin"
  [[ $demo != *"'"* && $fcm != *"'"* ]] || die "a secret contains a single quote"

  take_lock
  install_incoming

  set_env DEMO_PASSWORD "$demo"
  set_env FCM_SERVICE_ACCOUNT_BASE64 "$fcm"
  validate_host "$domain" || die "invalid domain" 2
  set_env LAB_BASE_DOMAIN "$domain"
  if [[ -z $(get_env POSTGRES_PASSWORD) ]]; then
    set_env POSTGRES_PASSWORD "$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi

  # Remember what is verified-good as "precedente", unless this is the same deploy again.
  if [[ -f $ROOT/current ]] && [[ $(sed -n 1p "$ROOT/current") != "$server" || $(sed -n 2p "$ROOT/current") != "$web" ]]; then
    cp -f "$ROOT/current" "$ROOT/precedente"
  fi

  pull_images "$token" "$user" "$server" "$web" || die "pull failed"
  start_and_verify "$server" "$web"
  write_state current "$server" "$web"
  log "deploy ok"
}

do_rollback() {
  local user=$1 token
  read_secret token
  take_lock
  [[ -f $ROOT/precedente ]] || die "no previous version to roll back to"
  local server web
  server=$(sed -n 1p "$ROOT/precedente")
  web=$(sed -n 2p "$ROOT/precedente")
  validate_image "$server" && validate_image "$web" || die "saved previous version is not valid"
  validate_user "$user" || die "invalid registry user" 2

  pull_images "$token" "$user" "$server" "$web" || die "pull failed"
  start_and_verify "$server" "$web"
  write_state current "$server" "$web"
  rm -f "$ROOT/precedente"
  log "rollback ok"
}

case $MODE in
  deploy)
    [[ $# -eq 5 ]] || die "usage: remote.sh deploy <server> <web> <user> <domain>" 2
    do_deploy "$2" "$3" "$4" "$5"
    ;;
  rollback)
    [[ $# -eq 2 ]] || die "usage: remote.sh rollback <user>" 2
    do_rollback "$2"
    ;;
  *) die "usage: remote.sh deploy|rollback ..." 2 ;;
esac
