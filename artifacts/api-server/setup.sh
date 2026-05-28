#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# TermuxHost — Run this from artifacts/api-server/
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "======================================"
echo "  TermuxHost — Termux Setup"
echo "======================================"
echo ""

# ── Step 1: Node.js ────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[*] Installing Node.js..."
  pkg install nodejs -y
fi

NODE_VER=$(node --version | cut -c2- | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "[!] Node.js v18+ required. Current: $(node --version)"
  echo "    Run: pkg install nodejs"
  exit 1
fi
echo "[✓] Node.js $(node --version)"

# ── Step 2: PM2 ────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "[*] Installing PM2..."
  npm install -g pm2
fi
echo "[✓] PM2 $(pm2 --version)"

# ── Step 3: Runtime packages ───────────────────────────────
echo "[*] Installing runtime dependencies..."
cd "$SCRIPT_DIR/termux"
npm install --ignore-scripts 2>&1 | grep -v "^npm warn" || true
echo "[✓] Dependencies installed"

# ── Step 4: Verify dist ────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/dist/index.mjs" ]; then
  echo "[!] dist/index.mjs not found — make sure you cloned the full repo."
  exit 1
fi
echo "[✓] Server bundle: dist/index.mjs"

# ── Step 5: .env ───────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  echo ""
  echo "[!] Created .env — fill in these required values:"
  echo "      DATABASE_URL    = your Neon connection string"
  echo "      JWT_SECRET      = run:  openssl rand -hex 32"
  echo "      PORT            = 3000"
  echo "      EMAIL_USER      = your Gmail address"
  echo "      EMAIL_PASS      = your Gmail App Password"
  echo ""
  echo "    Edit now:  nano $SCRIPT_DIR/.env"
else
  echo "[✓] .env exists"
fi

# ── Step 6: Termux:Boot script ─────────────────────────────
BOOT_DIR="$HOME/.termux/boot"
mkdir -p "$BOOT_DIR"
cat > "$BOOT_DIR/termuxhost.sh" << EOF
#!/data/data/com.termux/files/usr/bin/bash
# Auto-start TermuxHost on device boot (requires Termux:Boot from F-Droid)
pm2 resurrect
EOF
chmod +x "$BOOT_DIR/termuxhost.sh"
echo "[✓] Boot script: ~/.termux/boot/termuxhost.sh"

# ── Done ───────────────────────────────────────────────────
echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "  NEXT STEPS:"
echo ""
echo "  1. Edit config (if you haven't yet):"
echo "     nano $SCRIPT_DIR/.env"
echo ""
echo "  2. Start the server:"
echo "     pm2 start $SCRIPT_DIR/dist/index.mjs --name termuxhost-api"
echo "     pm2 save"
echo ""
echo "  3. Test it:"
echo "     curl http://localhost:3000/api/healthz"
echo ""
echo "  4. For auto-start on boot:"
echo "     Install 'Termux:Boot' from F-Droid"
echo "     (script already saved to ~/.termux/boot/termuxhost.sh)"
echo ""
