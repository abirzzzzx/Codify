# TermuxHost — Termux Quick Start

This folder contains everything you need to run the API server on Android (Termux).  
**No build step required** — the server comes pre-compiled.

---

## One-Command Setup

```bash
cd artifacts/api-server/termux
bash setup.sh
```

Then edit your `.env`:
```bash
nano ../. env
```

Then start:
```bash
npm run pm2
```

---

## What You Need

| Package | Install |
|---|---|
| Node.js v18+ | `pkg install nodejs` |
| Python (optional) | `pkg install python` |
| Git | `pkg install git` |
| PM2 | `npm install -g pm2` |

The setup script installs Node.js and PM2 automatically.

---

## Manual Steps

```bash
# 1. Install Termux packages
pkg update && pkg upgrade -y
pkg install nodejs git -y

# 2. Install PM2
npm install -g pm2

# 3. Clone the repo
git clone https://github.com/yourusername/termuxhost-api.git ~/Codify
cd ~/Codify/artifacts/api-server/termux

# 4. Install the 2 runtime packages
npm install

# 5. Configure .env
cp ../.env.example ../.env
nano ../.env

# 6. Start
npm run pm2
pm2 save && pm2 startup
```

---

## Why npm install here (not pnpm install at the root)?

The root project uses a pnpm workspace for development on Linux. 
**You do not need pnpm or the workspace setup to run the server in Termux.**

The `dist/index.mjs` file is a pre-compiled bundle that already includes all the TypeScript code. This folder only installs the 2 runtime packages that are loaded separately:
- `nodemailer` — for sending emails
- `@ngrok/ngrok` — for tunnel URLs (optional)

---

## PM2 Commands

```bash
pm2 status                      # check status
pm2 logs termuxhost-api         # view logs
pm2 restart termuxhost-api      # restart
pm2 stop termuxhost-api         # stop
pm2 delete termuxhost-api       # remove
```

---

## Full Documentation

See `../docs/TERMUX_SETUP.md` for the complete guide.
