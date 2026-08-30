#!/usr/bin/env bash
# Hourly background sync — fuel transactions (Azpetrol) and vehicle odometers
# (Wialon telemetry). Call from crontab:
# 0 * * * * /home/dietpi/attendance-tracker/scripts/sync-fuel.sh >> /home/dietpi/fuel-sync.log 2>&1
#
# The two endpoints are called separately and hold separate locks, so a failure
# or a slow run in one cannot hold up or fail the other.

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

stamp() { date '+%Y-%m-%d %H:%M:%S'; }

post() {
  # Never let one endpoint's failure abort the script; report and carry on.
  curl -s --max-time 300 -X POST "http://localhost:${PORT}$1" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: ${CRON_SECRET}" || echo '{"error":"request failed"}'
}

echo "[$(stamp)] Starting fuel sync..."
echo "[$(stamp)] $(post /api/azpetrol/sync)"

echo "[$(stamp)] Starting odometer sync..."
echo "[$(stamp)] $(post /api/telemetry/odometer-sync)"
