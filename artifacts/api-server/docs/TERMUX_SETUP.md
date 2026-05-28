# Termux Setup Guide

Complete guide to running TermuxHost on Android using Termux.

---

## Requirements

- Android 7.0 or later
- [Termux](https://f-droid.org/en/packages/com.termux/) (install from F-Droid, NOT Google Play)
- 500 MB free storage minimum
- Internet connection

---

## Step 1 — Install Termux Packages

```bash
pkg update && pkg upgrade -y
pkg install nodejs git python -y
```

Verify installations:
```bash
node --version   # should be v18+
python --version # should be 3.x
git --version
```

---

## Step 2 — Install PM2 (Global)

PM2 keeps the API server running even after closing Termux:

```bash
npm install -g pm2
```

---

## Step 3 — Clone the Repository

```bash
cd ~
git clone https://github.com/yourusername/termuxhost-api.git
cd termuxhost-api
```

---

## Step 4 — Install Dependencies

```bash
cd artifacts/api-server
npm install
```

> **Note:** If any package fails with a native binding error, it is safe to ignore — all native modules are externalized and none are required for core functionality.

---

## Step 5 — Configure Environment

```bash
cp .env.example .env
nano .env
```

Required variables:
- `DATABASE_URL` — your Neon PostgreSQL connection string
- `JWT_SECRET` — a long random string (use `openssl rand -hex 32`)
- `EMAIL_USER` — your Gmail address
- `EMAIL_PASS` — your Gmail App Password
- `NGROK_AUTHTOKEN` — your ngrok auth token

Optional:
- `PROJECTS_DIR` — custom path for project files (default: `./projects`)
- `NVIDIA_API_KEY` — for AI features
- `CORS_ORIGINS` — comma-separated frontend origins

Save and exit: `Ctrl+X`, then `Y`, then `Enter`.

---

## Step 6 — Push Database Schema

Run this once to set up all database tables:

```bash
cd ~/termuxhost-api
DATABASE_URL="$(grep DATABASE_URL artifacts/api-server/.env | cut -d= -f2-)" \
  node -e "require('child_process').execSync('npx drizzle-kit push --config lib/db/drizzle.config.ts', {stdio: 'inherit'})"
```

Or if you have pnpm installed:
```bash
pnpm --filter @workspace/db run push
```

---

## Step 7 — Build the API Server

```bash
cd ~/termuxhost-api/artifacts/api-server
node ./build.mjs
```

You should see `dist/index.mjs` created.

---

## Step 8 — Start with PM2

```bash
cd ~/termuxhost-api/artifacts/api-server
pm2 start dist/index.mjs \
  --name termuxhost-api \
  --interpreter node \
  --env-file .env
pm2 save
```

Enable PM2 on startup:
```bash
pm2 startup
# follow the printed instructions
```

---

## PM2 Commands

```bash
pm2 status              # check if running
pm2 logs termuxhost-api # view live logs
pm2 restart termuxhost-api
pm2 stop termuxhost-api
pm2 delete termuxhost-api
```

---

## Step 9 — Test the API

```bash
curl http://localhost:3000/api/healthz
```

Expected: `{"status":"ok"}`

---

## Step 10 — Create the First Admin

Register normally, then manually set admin in the database:

```bash
# In psql or any PostgreSQL client connected to your Neon DB:
UPDATE users SET is_admin = true, is_verified = true WHERE email = 'your@email.com';
```

---

## Termux Wake Lock (Keep Running)

To prevent Android from killing Termux when the screen is off:

1. In Termux, run: `termux-wake-lock`
2. Or keep the notification visible (tap "Acquire wakelock" in Termux notification)

---

## Storage Permissions (Optional)

If you want to store project files on external storage:

```bash
termux-setup-storage
```

Then set `PROJECTS_DIR=/sdcard/termuxhost/projects` in your `.env`.

---

## Troubleshooting

### "node: command not found"
```bash
pkg install nodejs
```

### "npm: command not found"
npm comes with Node.js. Re-run `pkg install nodejs`.

### Port 3000 already in use
Change `PORT=3001` in `.env` and rebuild.

### Database connection failed
- Ensure `DATABASE_URL` is correct in `.env`
- Check that Neon project is active and not paused
- Verify SSL: the URL should end with `?sslmode=require`

### Ngrok not connecting
- Check `NGROK_AUTHTOKEN` is set correctly
- Ensure you are not on a corporate/restricted network
- Try restarting: `POST /api/ngrok/reconnect`

### Email not sending
- Verify Gmail App Password (not your regular password)
- Check 2FA is enabled on your Google account
- Test: `POST /api/auth/resend-verification`
