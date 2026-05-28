# Termux Setup Guide

Complete guide to running TermuxHost on Android using Termux.

---

## Important — What NOT to Do in Termux

| ❌ Do NOT run this | Why |
|---|---|
| `pnpm install` from the project root | Workspace is for Linux x64 only, blocks Android |
| `node ./build.mjs` | Requires Linux esbuild binary, fails on ARM64 |
| `npm run pm2` from `artifacts/api-server/` | That script doesn't exist there |
| `pm2 startup` | Android has no init system — use Termux:Boot instead |

---

## Requirements

- Android 7.0+
- [Termux](https://f-droid.org/en/packages/com.termux/) from **F-Droid** (NOT Google Play)
- Internet connection

---

## One-Command Setup

```bash
# Step 1 — Install packages
pkg update && pkg upgrade -y
pkg install nodejs git -y

# Step 2 — Clone
git clone https://github.com/yourusername/termuxhost-api.git ~/termuxhost

# Step 3 — Setup (run from artifacts/api-server/)
cd ~/termuxhost/artifacts/api-server
bash setup.sh
```

That's it. The script installs PM2, installs runtime packages, creates `.env`, and sets up auto-boot.

---

## After setup.sh Completes

### 1. Edit your config
```bash
nano ~/termuxhost/artifacts/api-server/.env
```

Fill in at minimum:

```env
PORT=3000
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=<run: openssl rand -hex 32>
EMAIL_USER=your@gmail.com
EMAIL_PASS=your16charapppassword
```

### 2. Start the server
```bash
pm2 start ~/termuxhost/artifacts/api-server/dist/index.mjs --name termuxhost-api
pm2 save
```

### 3. Test it
```bash
curl http://localhost:3000/api/healthz
# Expected: {"status":"ok"}
```

---

## PM2 on Termux

`pm2 startup` does **not** work on Android (no system init). Use these instead:

### Keep running while Termux is open
```bash
pm2 start ~/termuxhost/artifacts/api-server/dist/index.mjs --name termuxhost-api
```

### Keep alive after closing the PM2 process list
```bash
pm2 save   # saves the current process list
```

### Auto-start when Termux opens
Add to `~/.bashrc`:
```bash
echo 'pm2 resurrect --silent 2>/dev/null' >> ~/.bashrc
```

### Auto-start on device reboot (recommended)
1. Install **Termux:Boot** from F-Droid
2. The `setup.sh` already created `~/.termux/boot/termuxhost.sh` for you
3. Open Termux:Boot once to grant permissions

### PM2 Commands
```bash
pm2 status                      # check if running
pm2 logs termuxhost-api         # live logs
pm2 logs termuxhost-api --lines 50  # last 50 lines
pm2 restart termuxhost-api      # restart
pm2 stop termuxhost-api         # stop
pm2 delete termuxhost-api       # remove from PM2
```

---

## Set Up the Database

Run once to create all 7 tables in your Neon database:

```bash
cd ~/termuxhost/lib/db

# Load DATABASE_URL from .env
export $(grep '^DATABASE_URL=' ~/termuxhost/artifacts/api-server/.env | head -1)

# Push schema
npx drizzle-kit push --config ./drizzle.config.ts
```

Verify tables:
```bash
# Install psql (optional)
pkg install postgresql -y
psql "$DATABASE_URL" -c "\dt"
```

---

## Create the First Admin

Register normally via the API, then run:
```bash
psql "$DATABASE_URL" \
  -c "UPDATE users SET is_admin=true, is_verified=true WHERE email='your@email.com';"
```

---

## Installing Python (for Python Projects)

```bash
pkg install python -y
python --version
```

---

## Project Files Storage

By default, hosted project files go into `./projects/` next to the server.

To store them on shared storage:
```bash
termux-setup-storage   # grant storage permission
```

Then in `.env`:
```env
PROJECTS_DIR=/sdcard/termuxhost/projects
```

---

## Troubleshooting

### "bash: setup.sh: No such file or directory"
You are in the wrong directory. Run from `artifacts/api-server/`:
```bash
cd ~/termuxhost/artifacts/api-server
bash setup.sh
```

### "npm error Missing script: pm2"
Do not use `npm run pm2`. Start the server directly with PM2:
```bash
pm2 start ~/termuxhost/artifacts/api-server/dist/index.mjs --name termuxhost-api
```

### "Init system not found" from pm2 startup
`pm2 startup` is not supported on Android. Use Termux:Boot instead (see above).

### pnpm install fails with "Use pnpm instead"
Do not run `pnpm install` from the project root in Termux.  
Only run `npm install` inside `artifacts/api-server/termux/` as described above.

### "node ./build.mjs" fails with missing android-arm64
Do not run the build script in Termux. The server comes pre-built in `dist/`.

### @ngrok/ngrok fails to install
Expected on some Android versions — it's optional. The server starts fine without it.  
Run ngrok manually if needed:
```bash
# Download from https://ngrok.com/download → Linux ARM64
./ngrok http 3000
```

### dist/index.mjs not found
The pre-built bundle is missing from your clone. Either:
- Re-clone the full repo (make sure the remote has `dist/` committed)
- Or contact the repo owner to push the built files

### Server crashes on start — "JWT_SECRET environment variable is required"
Edit `.env` and add:
```env
JWT_SECRET=<paste output of: openssl rand -hex 32>
```

### Server crashes — "DATABASE_URL must be set"
Edit `.env` and add your Neon connection string:
```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Port already in use
```bash
# Find what's using port 3000
lsof -i :3000
# Change port in .env
PORT=3001
pm2 restart termuxhost-api
```
