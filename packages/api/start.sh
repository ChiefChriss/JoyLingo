#!/bin/sh
set -eu

# Miruro stream sidecar (Python) — API proxies /api/proxy and /sources through it.
export MIRURO_API_URL="${MIRURO_API_URL:-http://127.0.0.1:8000}"

# Ensure PGlite data directory exists (volume mount or ephemeral).
DATA_DIR="${API_DATA_DIR:-/data}"
case "$DATA_DIR" in
  memory://*) ;;
  *) mkdir -p "$DATA_DIR" ;;
esac

python3 -m uvicorn api:app --host 127.0.0.1 --port 8000 --app-dir /app/sidecar &
SIDECAR_PID=$!

cleanup() {
  kill "$SIDECAR_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait briefly for sidecar health before accepting API traffic.
i=0
while [ "$i" -lt 30 ]; do
  if python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)" 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 0.5
done

exec node packages/api/dist/main.js
