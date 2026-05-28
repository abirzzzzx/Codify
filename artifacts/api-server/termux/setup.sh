#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# TermuxHost — setup.sh
# Can be run from either:
#   artifacts/api-server/         → bash setup.sh
#   artifacts/api-server/termux/  → bash setup.sh
# ============================================================

set -e

# Resolve directories regardless of where script is called from
THIS="$(cd "$(dirname "$0")" && pwd)"
BASENAME="$(basename "$THIS")"

if [ "$BASENAME" = "termux" ]; then
  TERMUX_DIR="$THIS"
  API_DIR="$(cd "$THIS/.." && pwd)"
else
  # Called from api-server/ directly
  TERMUX_DIR="$THIS/termux"
  API_DIR="$THIS"
fi

echo ""
echo "======================================"
echo "  TermuxHost — Termux Setup"
echo "======================================"
echo ""

# ── Node.js ────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[*] Installing Node.js..."
  pkg install nodejs -y
fi

NODE_VER=$(node --version | cut -c2- | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "[!] Node.js v18+ required. Got: $(node --version)"
  echo "    Run: pkg install nodejs"
  exit 1
fi
echo "[✓] Node.js $(node --version)"

# ── Python (optional) ──────────────────────────────────────
if command -v python3 &>/dev/null || command -v python &>/dev/null; then
  echo "[✓] Python available"
else
  echo "[~] Python not found (optional — needed for Python/bot projects)"
  echo "    Install with: pkg install python"
fi

# ── PM2 ────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "[*] Installing PM2..."
  npm install -g pm2
fi
echo "[✓] PM2 $(pm2 --version)"

# ── Runtime packages ───────────────────────────────────────
echo "[*] Installing runtime dependencies..."
cd "$TERMUX_DIR"
npm install --ignore-scripts 2>&1 | grep -v "^npm warn" || true
echo "[✓] nodemailer + @ngrok/ngrok installed"

# ── Verify dist ────────────────────────────────────────────
if [ ! -f "$API_DIR/dist/index.mjs" ]; then
  echo ""
  echo "[!] dist/index.mjs not found."
  echo "    Make sure you cloned the full repository."
  exit 1
fi
echo "[✓] Server bundle: $API_DIR/dist/index.mjs"

# ── .env ───────────────────────────────────────────────────
if [ ! -f "$API_DIR/.env" ]; then
  cp "$API_DIR/.env.example" "$API_DIR/.env"
  echo ""
  echo "[!] Created $API_DIR/.env"
  echo "    Fill in these values before starting:"
  echo "      DATABASE_URL  = postgresql://...?sslmode=require"
  echo "      JWT_SECRET    = run: openssl rand -hex 32"
  echo "      PORT          = 3000"
  echo "      EMAIL_USER    = your@gmail.com"
  echo "      EMAIL_PASS    = 16-char App Password"
  echo ""
else
  echo "[✓] .env exists at $API_DIR/.env"
fi

# ── Termux:Boot auto-start script ──────────────────────────
BOOT_DIR="$HOME/.termux/boot"
mkdir -p "$BOOT_DIR"
cat > "$BOOT_DIR/termuxhost.sh" << BOOTEOF
#!/data/data/com.termux/files/usr/bin/bash
# Requires Termux:Boot from F-Droid for auto-start on device reboot
pm2 resurrect
BOOTEOF
chmod +x "$BOOT_DIR/termuxhost.sh"
echo "[✓] Boot script written to ~/.termux/boot/termuxhost.sh"

# ── Done ───────────────────────────────────────────────────
echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "  NEXT STEPS:"
echo ""
echo "  1. Edit your config:"
echo "     nano $API_DIR/.env"
echo ""
echo "  2. Start the server:"
echo "     pm2 start $API_DIR/dist/index.mjs --name termuxhost-api"
echo "     pm2 save"
echo ""
echo "  3. Test:"
echo "     curl http://localhost:3000/api/healthz"
echo ""
echo "  4. To auto-start on boot:"
echo "     Install 'Termux:Boot' from F-Droid"
echo "     (script already saved to ~/.termux/boot/termuxhost.sh)"
echo ""
