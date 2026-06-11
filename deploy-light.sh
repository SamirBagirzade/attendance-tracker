#!/usr/bin/env bash
set -euo pipefail

APP_NAME="attendance-tracker"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${APP_DIR}/.env"

log() {
  printf '\n\033[1;34m==>\033[0m %s\n' "$1"
}

need_sudo() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Run ./deploy.sh first."
  exit 1
fi

cd "${APP_DIR}"

log "Installing npm dependencies"
npm ci

log "Generating Prisma client"
npx prisma generate

log "Applying database migrations"
npx prisma migrate deploy

log "Building application"
npm run build

log "Restarting service"
need_sudo systemctl restart "${APP_NAME}"

log "Light deploy complete"
need_sudo systemctl status "${APP_NAME}" --no-pager
