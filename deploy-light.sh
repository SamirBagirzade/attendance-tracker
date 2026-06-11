#!/usr/bin/env bash
set -euo pipefail

APP_NAME="attendance-tracker"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${APP_DIR}/.env"
INSTALL_DEPS=0

for arg in "$@"; do
  case "${arg}" in
    --deps)
      INSTALL_DEPS=1
      ;;
    -h|--help)
      echo "Usage: ./deploy-light.sh [--deps]"
      echo ""
      echo "  --deps   Run npm ci before building."
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}"
      echo "Usage: ./deploy-light.sh [--deps]"
      exit 1
      ;;
  esac
done

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

if [[ "${INSTALL_DEPS}" -eq 1 ]]; then
  log "Installing npm dependencies"
  npm ci
else
  log "Skipping npm dependencies"
  echo "Use ./deploy-light.sh --deps if package.json or package-lock.json changed."
fi

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
