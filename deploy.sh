#!/usr/bin/env bash
set -euo pipefail

APP_NAME="attendance-tracker"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="$(stat -c "%U" "${APP_DIR}")"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
ENV_FILE="${APP_DIR}/.env"

DB_NAME="${DB_NAME:-attendance_tracker}"
DB_USER="${DB_USER:-attendance}"
APP_PORT="${APP_PORT:-3000}"

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

run_as_postgres() {
  if [[ "${EUID}" -eq 0 ]]; then
    runuser -u postgres -- "$@"
  else
    sudo -u postgres "$@"
  fi
}

random_hex() {
  openssl rand -hex "$1"
}

install_system_packages() {
  log "Installing system packages"
  need_sudo apt-get update
  need_sudo apt-get install -y ca-certificates curl gnupg openssl build-essential postgresql postgresql-contrib
}

install_node_if_needed() {
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -p "process.versions.node.split('.')[0]")"
    if [[ "${major}" -ge 24 ]]; then
      log "Node.js $(node -v) already installed"
      return
    fi
  fi

  log "Installing Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | need_sudo bash -
  need_sudo apt-get install -y nodejs
}

ensure_postgres_running() {
  log "Starting PostgreSQL"
  need_sudo systemctl enable postgresql
  need_sudo systemctl start postgresql
}

create_env_if_missing() {
  if [[ -f "${ENV_FILE}" ]]; then
    log ".env exists, keeping current environment"
    return
  fi

  log "Creating .env"
  DB_PASSWORD="$(random_hex 24)"
  AUTH_SECRET="$(random_hex 32)"
  ADMIN_PASSWORD="$(random_hex 12)"

  cat > "${ENV_FILE}" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
AUTH_SECRET="${AUTH_SECRET}"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"
PORT=${APP_PORT}
EOF

  chmod 600 "${ENV_FILE}"
  printf '%s\n' "${ADMIN_PASSWORD}" > "${APP_DIR}/.admin-password"
  chmod 600 "${APP_DIR}/.admin-password"
}

load_env_values() {
  DATABASE_URL_VALUE="$(grep '^DATABASE_URL=' "${ENV_FILE}" | sed -E 's/^DATABASE_URL="?([^"]+)"?$/\1/')"
  DB_PASSWORD_FROM_URL="$(printf '%s' "${DATABASE_URL_VALUE}" | sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#')"
}

setup_database() {
  log "Creating PostgreSQL database and user"
  run_as_postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD_FROM_URL}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD_FROM_URL}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
}

install_app() {
  log "Installing npm dependencies"
  cd "${APP_DIR}"
  npm ci

  log "Generating Prisma client"
  npx prisma generate

  log "Applying database migrations"
  npx prisma migrate deploy

  log "Building application"
  npm run build
}

install_systemd_service() {
  log "Installing systemd service"
  need_sudo tee "${SERVICE_FILE}" >/dev/null <<EOF
[Unit]
Description=Attendance Tracker
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  need_sudo systemctl daemon-reload
  need_sudo systemctl enable "${APP_NAME}"
  need_sudo systemctl restart "${APP_NAME}"
}

print_summary() {
  log "Deployment complete"
  echo "Service: ${APP_NAME}"
  echo "Directory: ${APP_DIR}"
  echo "URL: http://SERVER_IP:${APP_PORT}"

  if [[ -f "${APP_DIR}/.admin-password" ]]; then
    echo "Admin username: admin"
    echo "Admin password: $(cat "${APP_DIR}/.admin-password")"
    echo "Password saved in: ${APP_DIR}/.admin-password"
  else
    echo "Admin credentials are from existing .env"
  fi
}

install_system_packages
install_node_if_needed
ensure_postgres_running
create_env_if_missing
load_env_values
setup_database
install_app
install_systemd_service
print_summary
