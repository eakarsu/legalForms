#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

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
