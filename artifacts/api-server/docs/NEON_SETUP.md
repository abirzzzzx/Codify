# Neon PostgreSQL Setup Guide

TermuxHost uses **Neon** — a serverless PostgreSQL database — as its main data store. Neon is free, fast, and works perfectly with Termux since it connects over the internet with no local installation required.

---

## Step 1 — Create a Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub or email
3. You are placed on the **Free tier** (which is sufficient)

---

## Step 2 — Create a Project

1. Click **"New Project"**
2. Name it: `termuxhost` (or anything you prefer)
3. Select a region close to you
4. Click **"Create Project"**

---

## Step 3 — Get the Connection String

1. In your project dashboard, click **"Connection Details"**
2. Select **"Connection string"** mode
3. Copy the string — it looks like:
   ```
   postgresql://username:password@ep-something-123.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Paste it as `DATABASE_URL` in your `.env` file

> **Important:** The URL must include `?sslmode=require` at the end.

---

## Step 4 — Push the Schema

Run this once after setting up your `.env`:

```bash
cd ~/termuxhost-api/artifacts/api-server
node -e "
const {execSync} = require('child_process');
require('dotenv').config();
execSync('cd ../.. && npx drizzle-kit push --config lib/db/drizzle.config.ts', {stdio:'inherit', env: {...process.env}});
"
```

This creates all required tables:
- `users`
- `sessions`
- `projects`
- `logs`
- `env_vars`
- `api_keys`
- `verification_codes`

---

## Step 5 — Verify

Connect with any PostgreSQL client:

```bash
# Using psql (install with: pkg install postgresql)
psql "$DATABASE_URL" -c "\dt"
```

You should see all 7 tables listed.

---

## Free Tier Limits

| Limit | Value |
|---|---|
| Storage | 0.5 GB |
| Compute hours | 191.9 hrs/month |
| Projects | 1 |
| Branches | 10 |

The free tier is more than enough for personal and small-team use.

---

## Connection Pooling (Optional)

For production with many concurrent users, use Neon's pooled connection string:
1. In the Neon dashboard → **Connection Details**
2. Enable **"Pooler"** toggle
3. Copy the pooled URL (uses port 5432 with `pgbouncer=true`)

Update `DATABASE_URL` in `.env` with the pooled string.

---

## Pausing

Neon auto-pauses projects after 5 minutes of inactivity on the free tier. The first connection after a pause takes ~1 second. This is normal.

To avoid pauses, upgrade to a paid plan or use Neon's "Never sleep" option.

---

## Troubleshooting

### "SSL connection required"
Make sure your URL ends with `?sslmode=require`.

### "Connection timeout"
Check that your Neon project is not suspended (log in to dashboard).

### "Database does not exist"
Use the exact database name from your connection string (usually `neondb`).
