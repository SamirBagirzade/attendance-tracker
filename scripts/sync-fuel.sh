#!/usr/bin/env bash
# Daily fuel sync — call from crontab:
# 30 23 * * * /home/dietpi/attendance-tracker/scripts/sync-fuel.sh >> /var/log/fuel-sync.log 2>&1

set -euo pipefail

PORT="${PORT:-3000}"
CRON_SECRET="${CRON_SECRET:-}"

if [[ -z "$CRON_SECRET" ]]; then
  # Load from .env if available
  ENV_FILE="$(dirname "$0")/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')
    PORT_VAL=$(grep '^PORT=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"')
    PORT="${PORT_VAL:-$PORT}"
  fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting fuel sync..."

RESPONSE=$(curl -s -X POST "http://localhost:${PORT}/api/azpetrol/sync" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: ${CRON_SECRET}")

echo "[$(date '+%Y-%m-%d %H:%M:%S')] $RESPONSE"
