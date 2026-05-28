#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# TermuxHost — One-Command Setup Script
# Run from the termux/ directory:  bash setup.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "======================================"
echo "  TermuxHost — Termux Setup"
echo "======================================"
echo ""

# ── Step 1: Check Node.js ──────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[!] Node.js not found. Installing..."
  pkg install nodejs -y
fi

NODE_VER=$(node --version | cut -c2- | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "[!] Node.js v18+ required. Current: $(node --version)"
  echo "    Run: pkg install nodejs"
  exit 1
fi

echo "[✓] Node.js $(node --version)"

# ── Step 2: Check Python (optional for Python projects) ────
if command -v python3 &>/dev/null; then
  echo "[✓] Python $(python3 --version 2>&1 | awk '{print $2}')"
elif command -v python &>/dev/null; then
  echo "[✓] Python $(python --version 2>&1 | awk '{print $2}')"
else
  echo "[~] Python not found — optional. Install with: pkg install python"
fi

# ── Step 3: Install PM2 globally ───────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "[*] Installing PM2..."
  npm install -g pm2 --silent
fi
echo "[✓] PM2 $(pm2 --version)"

# ── Step 4: Install runtime packages ───────────────────────
echo "[*] Installing runtime dependencies..."
cd "$SCRIPT_DIR"
npm install --ignore-scripts 2>&1 | grep -v "^npm warn" || true
echo "[✓] Dependencies installed"

# ── Step 5: Verify dist exists ─────────────────────────────
if [ ! -f "$API_DIR/dist/index.mjs" ]; then
  echo ""
  echo "[!] dist/index.mjs not found."
  echo "    The pre-built server bundle is missing."
  echo "    Make sure you cloned the full repository including the dist/ folder."
  echo "    If the dist/ folder is missing from git, see TERMUX_SETUP.md for"
  echo "    instructions on building from source."
  exit 1
fi

echo "[✓] Server bundle found: dist/index.mjs"

# ── Step 6: Set up .env ────────────────────────────────────
if [ ! -f "$API_DIR/.env" ]; then
  cp "$API_DIR/.env.example" "$API_DIR/.env"
  echo ""
  echo "[!] Created .env from .env.example"
  echo "    You MUST edit it before starting the server:"
  echo "    nano $API_DIR/.env"
  echo ""
  echo "    Required values:"
  echo "      DATABASE_URL  — Neon PostgreSQL connection string"
  echo "      JWT_SECRET    — random secret (run: openssl rand -hex 32)"
  echo "      EMAIL_USER    — Gmail address"
  echo "      EMAIL_PASS    — Gmail App Password"
  echo "      NGROK_AUTHTOKEN — ngrok token (optional)"
  echo ""
else
  echo "[✓] .env already exists"
fi

# ── Step 7: Instructions ───────────────────────────────────
echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "  1. Edit your config:"
echo "     nano $API_DIR/.env"
echo ""
echo "  2. Start with PM2 (recommended):"
echo "     cd $SCRIPT_DIR && npm run pm2"
echo "     pm2 save && pm2 startup"
echo ""
echo "  3. Or start directly:"
echo "     cd $SCRIPT_DIR && npm start"
echo ""
echo "  4. Test it:"
echo "     curl http://localhost:3000/api/healthz"
echo ""
echo "  Full guide: $API_DIR/docs/TERMUX_SETUP.md"
echo ""
