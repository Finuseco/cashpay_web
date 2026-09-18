#!/usr/bin/env bash
set -u

ENV_FILE="/etc/cashpay-loan-job.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

APP_URL="${CASH_PAY_APP_URL:-http://127.0.0.1:8002}"
SECRET="${INTERNAL_JOB_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "[Loan Repayment Job] INTERNAL_JOB_SECRET is not configured" >&2
  exit 1
fi

curl --fail --silent --show-error \
  --max-time 50 \
  -H "x-internal-job-secret: ${SECRET}" \
  "${APP_URL%/}/api/internal/jobs/loan-repayments"
