#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ $# -eq 0 ]]; then
  : "${BACKEND_PORT:=${PORT:-3000}}"
  : "${FRONTEND_PORT:=3001}"
  export PORT="$BACKEND_PORT" BACKEND_PORT FRONTEND_PORT HOST="${HOST:-127.0.0.1}" JWT_EXPIRES_IN=15m
  for name in DATABASE_URL JWT_SECRET PROVISION_ADMIN_EMAIL PROVISION_ADMIN_PASSWORD OPENROUTER_API_KEY OPENROUTER_MODEL OPENROUTER_BASE_URL; do
    [[ -n "${!name:-}" ]] || { echo "$name is required." >&2; exit 1; }
  done
  [[ "$OPENROUTER_BASE_URL" == "https://openrouter.ai/api/v1" ]] || { echo "OPENROUTER_BASE_URL must be canonical." >&2; exit 1; }
  unset GOVERNED_STORAGE_URL GOVERNED_STORAGE_TOKEN GOVERNED_OCR_URL GOVERNED_OCR_TOKEN
  unset GOVERNED_ESIGN_URL GOVERNED_ESIGN_TOKEN GOVERNED_FILING_URL GOVERNED_FILING_TOKEN
  [[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo "Backend and frontend ports must differ." >&2; exit 1; }
  for runtime_port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    ! lsof -nP -iTCP:"$runtime_port" -sTCP:LISTEN >/dev/null 2>&1 || { echo "Port $runtime_port is occupied." >&2; exit 1; }
  done
  node scripts/migrate.js
  node scripts/provision-runtime-admin.js
  node governed-server.js & api_pid=$!
  node scripts/runtime-ui.mjs & ui_pid=$!
  cleanup() { kill "$api_pid" "$ui_pid" 2>/dev/null || true; wait "$api_pid" "$ui_pid" 2>/dev/null || true; }
  trap cleanup EXIT INT TERM
  for _ in {1..100}; do curl -fsS "http://127.0.0.1:${BACKEND_PORT}/readyz" >/dev/null 2>&1 && break; sleep 0.2; done
  curl -fsS "http://127.0.0.1:${BACKEND_PORT}/readyz" >/dev/null
  curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null
  echo "LegalForms running: UI http://127.0.0.1:${FRONTEND_PORT}, API http://127.0.0.1:${BACKEND_PORT}"
  wait "$api_pid" "$ui_pid"
  exit $?
fi

case "${1:---api}" in
  --api)
    exec node governed-server.js
    ;;
  --migrate)
    exec node scripts/migrate.js
    ;;
  --legacy)
    echo "WARNING: the legacy full-suite server is not the governed production surface." >&2
    exec node server.js
    ;;
  *)
    echo "Usage: ./start.sh [--api|--migrate|--legacy]" >&2
    exit 64
    ;;
esac
