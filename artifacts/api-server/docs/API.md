# TermuxHost — API Reference

**Base URL:** `https://<your-ngrok-or-domain>/api`

All requests that require authentication must include:
```
Authorization: Bearer <jwt_token>
```

---

## Authentication (`/api/auth`)

### POST `/api/auth/register`
Create a new account.

**Body:**
```json
{
  "email": "user@example.com",
  "username": "myuser",
  "password": "mypassword123"
}
```

**Response 201:**
```json
{
  "message": "Account created. Check your email for a verification code.",
  "userId": "uuid"
}
```

---

### POST `/api/auth/login`
Login and receive a JWT token.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "myuser",
    "isVerified": true,
    "isAdmin": false
  }
}
```

---

### POST `/api/auth/logout`
🔒 Requires auth. Invalidates the current session token.

---

### POST `/api/auth/verify-email`
Verify email with the 6-digit code sent after registration.

**Body:**
```json
{
  "userId": "uuid",
  "code": "123456"
}
```

---

### POST `/api/auth/resend-verification`
Resend the email verification code.

**Body:**
```json
{ "email": "user@example.com" }
```

---

### POST `/api/auth/forgot-password`
Request a password reset code.

**Body:**
```json
{ "email": "user@example.com" }
```

---

### POST `/api/auth/reset-password`
Reset password using the code from email.

**Body:**
```json
{
  "userId": "uuid",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

---

### GET `/api/auth/me`
🔒 Requires auth. Get the current authenticated user.

---

### PUT `/api/auth/change-password`
🔒 Requires auth. Change the current user's password.

**Body:**
```json
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

---

## Projects (`/api/projects`)

🔒 All project endpoints require auth + verified email.

### GET `/api/projects`
List all projects for the current user.

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "my-bot",
      "type": "discord",
      "status": "running",
      "entrypoint": "index.js",
      "port": null,
      "isRunning": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST `/api/projects`
Create a new project.

**Body:**
```json
{
  "name": "my-api",
  "type": "nodejs",
  "entrypoint": "server.js",
  "port": "3000"
}
```

`type` options: `nodejs`, `python`, `discord`, `api`, `websocket`

---

### GET `/api/projects/:id`
Get a single project by ID.

---

### PUT `/api/projects/:id`
Update project settings (entrypoint, port).

---

### DELETE `/api/projects/:id`
Delete a project and all its files.

---

### POST `/api/projects/:id/start`
Start the project process.

---

### POST `/api/projects/:id/stop`
Stop the project process.

---

### POST `/api/projects/:id/restart`
Restart the project process.

---

### POST `/api/projects/:id/install`
Install npm or pip packages.

**Body:**
```json
{
  "packageManager": "npm",
  "packages": ["express", "dotenv"]
}
```

Or for Python:
```json
{
  "packageManager": "pip",
  "packages": ["requests", "flask"]
}
```

---

## Files (`/api/projects/:id/files`)

🔒 Requires auth + verified email.

### GET `/api/projects/:id/files`
Get the full file tree of the project directory.

---

### GET `/api/projects/:id/files/content?path=<filepath>`
Read a file's content.

---

### PUT `/api/projects/:id/files/content`
Create or update a file.

**Body:**
```json
{
  "path": "src/index.js",
  "content": "console.log('hello');"
}
```

---

### DELETE `/api/projects/:id/files/content?path=<filepath>`
Delete a file or directory.

---

### POST `/api/projects/:id/files/mkdir`
Create a directory.

**Body:**
```json
{ "path": "src/utils" }
```

---

### POST `/api/projects/:id/files/upload?dir=<optional_subdir>`
Upload a file via multipart form.

**Form field:** `file` (the file to upload)

---

## Logs (`/api/projects/:id/logs`)

🔒 Requires auth.

### GET `/api/projects/:id/logs?limit=100&offset=0&level=info`
Get project logs. Optional query params: `limit` (max 500), `offset`, `level`.

---

### DELETE `/api/projects/:id/logs`
Clear all logs for the project.

---

## Environment Variables (`/api/projects/:id/env`)

🔒 Requires auth.

### GET `/api/projects/:id/env`
List all env var keys (not values) for the project.

---

### POST `/api/projects/:id/env`
Set an environment variable.

**Body:**
```json
{
  "key": "DATABASE_URL",
  "value": "postgresql://...",
  "description": "Main database connection"
}
```

---

### DELETE `/api/projects/:id/env/:key`
Delete an environment variable.

---

### GET `/api/projects/:id/env/export`
Export all env var key-value pairs (including values).

---

## AI Assistant (`/api/ai`)

🔒 Requires auth. Rate limited to 10 requests/min.

### POST `/api/ai/debug`
Debug code in a project file.

**Body:**
```json
{
  "projectId": "uuid",
  "filePath": "index.js",
  "error": "TypeError: Cannot read properties of undefined",
  "language": "javascript"
}
```

---

### POST `/api/ai/generate`
Generate code and save to a project file.

**Body:**
```json
{
  "projectId": "uuid",
  "filename": "utils/logger.js",
  "description": "A simple logger with timestamps",
  "language": "javascript"
}
```

---

### POST `/api/ai/explain`
Explain an error message.

**Body:**
```json
{
  "error": "ECONNREFUSED 127.0.0.1:5432",
  "context": "Trying to connect to PostgreSQL"
}
```

---

### POST `/api/ai/edit`
Edit a project file based on an instruction.

**Body:**
```json
{
  "projectId": "uuid",
  "filePath": "index.js",
  "instruction": "Add error handling to the database connection",
  "language": "javascript"
}
```

---

### POST `/api/ai/imports`
Add missing imports to a file.

**Body:**
```json
{
  "projectId": "uuid",
  "filePath": "index.js",
  "language": "javascript"
}
```

---

### POST `/api/ai/template`
Generate a starter template for a project.

**Body:**
```json
{
  "projectId": "uuid",
  "projectType": "discord bot"
}
```

---

## API Keys (`/api/keys`)

🔒 Requires auth.

### GET `/api/keys`
List all API keys (names only, no raw keys).

---

### POST `/api/keys`
Create a new API key.

**Body:**
```json
{ "name": "My Frontend App" }
```

**Response:**
```json
{
  "key": "th_abc123...",
  "name": "My Frontend App",
  "message": "API key created. Save the key — it will not be shown again."
}
```

---

### DELETE `/api/keys/:id`
Delete an API key.

---

## Ngrok (`/api/ngrok`)

🔒 Requires auth.

### GET `/api/ngrok/status`
Get current ngrok tunnel status and URL.

**Response:**
```json
{
  "connected": true,
  "url": "https://abc123.ngrok.io"
}
```

---

### POST `/api/ngrok/start`
Start the ngrok tunnel.

---

### POST `/api/ngrok/stop`
Stop the ngrok tunnel.

---

### POST `/api/ngrok/reconnect`
Reconnect the ngrok tunnel (stop + restart).

---

## Admin (`/api/admin`)

🔒 Requires auth + admin role.

### GET `/api/admin/stats`
Platform-wide statistics.

### GET `/api/admin/users`
List all users.

### POST `/api/admin/users/:id/suspend`
Suspend a user (stops all their projects).

### POST `/api/admin/users/:id/unsuspend`
Re-enable a suspended user.

### DELETE `/api/admin/users/:id`
Permanently delete a user.

### GET `/api/admin/projects`
List all projects on the platform.

### POST `/api/admin/projects/:id/disable`
Disable a project (admin can stop it from running).

### POST `/api/admin/projects/:id/enable`
Re-enable a disabled project.

### POST `/api/admin/projects/:id/stop`
Force-stop a running project.

### DELETE `/api/admin/projects/:id`
Permanently delete a project.

### GET `/api/admin/processes`
List all currently running processes.

---

## Health Check

### GET `/api/healthz`
No auth required.

**Response:**
```json
{ "status": "ok" }
```

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Human-readable error message.",
  "detail": "Optional technical detail (development only)"
}
```

Common HTTP status codes:
| Code | Meaning |
|---|---|
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Forbidden (suspended, not verified, not admin) |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 413 | Payload too large |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
