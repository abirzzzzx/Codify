# Termux Setup Guide

Complete guide to running TermuxHost on Android using Termux.

> **Key point:** Do NOT run `pnpm install` from the project root in Termux.  
> The root workspace is configured for Linux x64 (Replit). Use the `termux/` folder instead — it runs the pre-compiled server bundle directly.

---

## Requirements

- Android 7.0 or later
- [Termux](https://f-droid.org/en/packages/com.termux/) from **F-Droid** (NOT Google Play — the Play version is outdated)
- 200 MB free storage minimum
- Internet connection

---

## Quick Start (Automated)

```bash
# 1. Install packages
pkg update && pkg upgrade -y
pkg install nodejs git -y

# 2. Clone the repository
git clone https://github.com/yourusername/termuxhost-api.git ~/termuxhost
cd ~/termuxhost/artifacts/api-server/termux

# 3. Run setup (installs deps, creates .env, gives instructions)
bash setup.sh
```

Then fill in your `.env`:
```bash
nano ../.env
```

Then start:
```bash
npm run pm2
pm2 save && pm2 startup
```

---

## Step-by-Step Guide

### Step 1 — Install Termux Packages

```bash
pkg update && pkg upgrade -y
pkg install nodejs git -y
```

**Python** is only needed if you want to host Python projects:
```bash
pkg install python -y
```

Verify Node.js:
```bash
node --version   # must be v18+
```

---

### Step 2 — Install PM2

PM2 keeps the server running even when Termux is minimized:

```bash
npm install -g pm2
```

---

### Step 3 — Clone the Repository

```bash
git clone https://github.com/yourusername/termuxhost-api.git ~/termuxhost
```

---

### Step 4 — Go to the Termux Directory

```bash
cd ~/termuxhost/artifacts/api-server/termux
```

> **Important:** Always work from the `termux/` subdirectory in Termux, NOT from the project root. The root uses a pnpm workspace that is configured for Linux x64 only.

---

### Step 5 — Install Runtime Packages

```bash
npm install
```

This installs only 2 small packages:
- `nodemailer` — for sending verification/reset emails
- `@ngrok/ngrok` — for public tunnel URLs (optional, installed as optional dep)

If `@ngrok/ngrok` fails on your Android version, that is fine — ngrok is optional. The server will still run; you can use the ngrok CLI directly instead.

---

### Step 6 — Configure Environment

```bash
cp ../.env.example ../.env
nano ../.env
```

**Required values:**

| Variable | What to put |
|---|---|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `JWT_SECRET` | A long random string — run `openssl rand -hex 32` |
| `PORT` | `3000` (or any free port) |

**Optional values:**

| Variable | What to put |
|---|---|
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Your Gmail App Password (16 chars) |
| `NGROK_AUTHTOKEN` | Your ngrok auth token |
| `NVIDIA_API_KEY` | For AI features |
| `CORS_ORIGINS` | Your frontend URL on Vercel/GitHub Pages |

Save: `Ctrl+X` → `Y` → `Enter`

---

### Step 7 — Set Up the Database

Run this once to create all database tables in Neon:

```bash
# Install drizzle-kit locally (one-time)
npm install -g drizzle-kit

# Run push from the lib/db directory
cd ~/termuxhost/lib/db
DATABASE_URL="$(grep '^DATABASE_URL=' ~/termuxhost/artifacts/api-server/.env | cut -d= -f2-)" \
  npx drizzle-kit push --config ./drizzle.config.ts
```

Or use any PostgreSQL client to verify tables exist:
```bash
# Optional: install psql
pkg install postgresql -y
psql "$DATABASE_URL" -c "\dt"
```

---

### Step 8 — Start the Server

**With PM2 (recommended — keeps running in background):**
```bash
cd ~/termuxhost/artifacts/api-server/termux
npm run pm2
pm2 save
pm2 startup
```

**Direct start (stays in foreground):**
```bash
bash start.sh
```

---

### Step 9 — Test the API

```bash
curl http://localhost:3000/api/healthz
```

Expected response: `{"status":"ok"}`

---

### Step 10 — Create the First Admin User

Register normally through the API, then promote to admin:

```bash
psql "$DATABASE_URL" -c \
  "UPDATE users SET is_admin=true, is_verified=true WHERE email='your@email.com';"
```

---

## PM2 Commands

```bash
pm2 status                    # check if running
pm2 logs termuxhost-api       # view live logs
pm2 restart termuxhost-api    # restart server
pm2 stop termuxhost-api       # stop server
pm2 delete termuxhost-api     # remove from PM2
```

---

## Termux Wake Lock (Keep Running When Screen Off)

```bash
termux-wake-lock
```

Or tap the Termux notification and press **"Acquire wakelock"**.

---

## Storage Permissions (Optional)

To store project files on shared/SD card storage:

```bash
termux-setup-storage
```

Then set in `.env`:
```env
PROJECTS_DIR=/sdcard/termuxhost/projects
```

---

## Troubleshooting

### "pnpm install" fails with "Use pnpm instead"
**Do not run `pnpm install` from the project root in Termux.**  
Go to `artifacts/api-server/termux/` and run `npm install` instead.

### "node ./build.mjs" fails with missing @esbuild/android-arm64
**Do not run `node ./build.mjs` in Termux.**  
The server comes pre-compiled. You do not need to build it.  
Just run `npm start` or `npm run pm2` from the `termux/` directory.

### @ngrok/ngrok fails to install
This is expected on some Android versions. It is an optional package.  
The server will start without it. You can run ngrok manually:
```bash
# Download ngrok for Android ARM64 from https://ngrok.com/download
# Then run:
./ngrok http 3000
```

### Port 3000 already in use
Change `PORT=3001` in `.env` and restart.

### "Cannot find package 'esbuild'"
You ran `node ./build.mjs` from the wrong directory.  
That is only for Replit (Linux). In Termux, use `termux/` → `npm start`.

### Server starts but email doesn't send
- Verify `EMAIL_USER` and `EMAIL_PASS` are set in `.env`  
- `EMAIL_PASS` must be a Gmail App Password (16 chars, no spaces), not your normal Gmail password

### Database connection error
- Verify `DATABASE_URL` is correct and includes `?sslmode=require`
- Check that your Neon project is active (log in to neon.tech)

### Server crashes immediately
Check logs:
```bash
pm2 logs termuxhost-api --lines 50
```
The most common cause is a missing required env var (`DATABASE_URL`, `JWT_SECRET`, or `PORT`).
