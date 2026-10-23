#!/usr/bin/env bash
# Tâche planifiée USDT (TRC-20) : crédite les dépôts, finalise les retraits en
# attente et, toutes les 10 minutes, balaye les dépôts vers le portefeuille chaud.
set -u

ENV_FILE="/etc/cashpay-usdt-job.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

APP_URL="${CASH_PAY_APP_URL:-http://127.0.0.1:8002}"
SECRET="${USDT_SCAN_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "[USDT Job] USDT_SCAN_SECRET is not configured" >&2
  exit 1
fi

SWEEP=""
if [[ "$(date +%M)" =~ ^[0-9]*0$ ]]; then
  SWEEP="?sweep=1"
fi

curl --fail --silent --show-error \
  --max-time 55 \
  -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  "${APP_URL%/}/api/internal/jobs/usdt-trc20-deposits${SWEEP}"
echo
