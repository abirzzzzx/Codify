#!/data/data/com.termux/files/usr/bin/bash
# TermuxHost — Direct start script (without PM2)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$API_DIR/.env" ]; then
  echo "[!] .env not found. Run: bash setup.sh"
  exit 1
fi

echo "[*] Starting TermuxHost API..."
exec node "$API_DIR/dist/index.mjs"
