# Gmail SMTP Setup Guide

TermuxHost sends emails (verification codes, password resets) using **Gmail SMTP with an App Password**. This is more secure than using your real Gmail password.

---

## Requirements

- A Google account (Gmail)
- 2-Step Verification enabled on the account

---

## Step 1 — Enable 2-Step Verification

If you haven't already:

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Under **"How you sign in to Google"**, click **"2-Step Verification"**
3. Follow the prompts to enable it

---

## Step 2 — Generate an App Password

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. You may need to re-authenticate
3. In the "App name" field, type: `TermuxHost`
4. Click **"Create"**
5. Google shows a **16-character password** (e.g., `abcd efgh ijkl mnop`)
6. Copy it — you will not see it again

---

## Step 3 — Set in `.env`

```env
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=abcdefghijklmnop
```

> **Note:** Enter the 16-character App Password **without spaces**.

---

## Step 4 — Test Email Sending

Register a new account on TermuxHost. If you receive a verification email, your setup is correct.

You can also test with curl:

```bash
curl -X POST https://your-api/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "youremail@gmail.com"}'
```

---

## Customizing Email

The `APP_NAME` env var controls the sender name in emails:

```env
APP_NAME=MyHostingPlatform
```

Emails will appear as: **"MyHostingPlatform" \<youremail@gmail.com\>**

---

## Gmail Sending Limits

| Plan | Daily limit |
|---|---|
| Free Gmail | 500 emails/day |
| Google Workspace | 2,000 emails/day |

For personal and small-team use, the free limit is more than sufficient.

---

## Troubleshooting

### "Invalid login" error
- Make sure you are using the **App Password**, not your regular Gmail password
- Ensure 2FA is enabled on the account
- Try generating a new App Password

### "Username and Password not accepted"
- Your Gmail account may have "Less secure app access" disabled — use App Passwords instead (which bypass this)

### No email received
- Check the spam/junk folder
- Verify `EMAIL_USER` is spelled correctly
- Check API server logs: `pm2 logs termuxhost-api`

### "Error: ECONNECTION"
- Termux may be blocking outbound SMTP. Try using port 587 explicitly:
  Modify `lib/email.ts` to use `host: "smtp.gmail.com", port: 587, secure: false`
