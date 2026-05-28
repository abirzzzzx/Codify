# Ngrok Setup Guide

TermuxHost uses **ngrok** to expose your local API server to the internet so your frontend (Vercel/GitHub Pages) can reach it from anywhere.

---

## Step 1 — Create an Ngrok Account

1. Go to [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Sign up with GitHub or email (free)

---

## Step 2 — Get Your Auth Token

1. Log in to the [ngrok dashboard](https://dashboard.ngrok.com)
2. In the left sidebar, click **"Your Authtoken"**
3. Copy the token (looks like: `2abc...xyz_abc123...`)

---

## Step 3 — Set in `.env`

```env
NGROK_AUTHTOKEN=your_token_here
```

---

## Step 4 — Automatic Startup

When `NGROK_AUTHTOKEN` is set, the API server automatically starts a tunnel when it boots. The public URL is logged:

```
INFO  Ngrok tunnel active  url=https://abc123.ngrok-free.app
```

You can also check the current URL via the API:

```bash
curl -H "Authorization: Bearer <token>" \
  https://your-ngrok-url/api/ngrok/status
```

---

## Step 5 — Update Your Frontend

After getting the ngrok URL, update your frontend environment variable:

```env
# In your Vercel/GitHub Pages project
VITE_API_BASE_URL=https://abc123.ngrok-free.app/api
```

---

## Fixed Domain (Optional — Paid Plan)

By default, ngrok assigns a random subdomain each time you restart. To get a stable URL:

1. Upgrade to a paid ngrok plan
2. In your ngrok dashboard, create a **Static Domain** (e.g., `myapp.ngrok.app`)
3. Add to `.env`:
   ```env
   NGROK_DOMAIN=myapp.ngrok.app
   ```

---

## Free Tier Limits

| Limit | Value |
|---|---|
| Concurrent tunnels | 1 |
| Connections/minute | 20 |
| Bandwidth | Unlimited |
| Custom domains | No (paid only) |
| Sessions | Expire after 2 hours (old agent; new agent has no expiry) |

---

## Reconnection

If the tunnel drops, call the reconnect endpoint:

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  https://localhost:3000/api/ngrok/reconnect
```

Or restart PM2:
```bash
pm2 restart termuxhost-api
```

---

## Troubleshooting

### "ERR_NGROK_108" — Account limit reached
You already have a tunnel running elsewhere. Go to the ngrok dashboard → **Sessions** and disconnect any active sessions.

### Tunnel URL changes on restart
This is normal on the free plan. Use a fixed domain (paid) or update your frontend env var each time.

### "Invalid authtoken"
Regenerate your token from [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) and update `.env`.

### Requests timing out through ngrok
Ngrok adds latency. If your frontend has short timeouts, increase them to at least 30 seconds.
