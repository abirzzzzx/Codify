# TermuxHost API

A fully functional backend hosting platform built for **Termux on Android**. Host Node.js apps, Python scripts, Discord bots, APIs, and WebSocket servers — all from your Android phone.

## Features

- **Auth**: Register, login, JWT, email verification, password reset
- **Project Hosting**: Node.js, Python, Discord bots, APIs, WebSocket servers
- **File Manager**: Upload, create, edit, delete files per project
- **Package Manager**: Install npm and pip packages per project
- **Process Manager**: Start, stop, restart projects with live logs
- **Environment Variables**: Per-project `.env` file management
- **AI Assistant**: Powered by NVIDIA Gemma 3n — debug, generate, edit code
- **Ngrok Integration**: Automatic public URL tunneling
- **Admin Panel**: Manage users, projects, and running processes
- **API Keys**: Generate API keys for programmatic access

---

## Quick Start (Termux)

### 1. Install Termux packages

```bash
pkg update && pkg upgrade -y
pkg install nodejs git python -y
npm install -g pm2
```

### 2. Clone and install

```bash
git clone https://github.com/yourusername/termuxhost-api.git
cd termuxhost-api/artifacts/api-server
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in all values (see [docs/ENV_VARS.md](docs/ENV_VARS.md)).

### 4. Push database schema

```bash
cd ../../
npm run db:push
```

### 5. Start with PM2

```bash
cd artifacts/api-server
pm2 start dist/index.mjs --name termuxhost-api
pm2 save
pm2 startup
```

---

## Documentation

| Guide | Description |
|---|---|
| [docs/API.md](docs/API.md) | Full REST API reference |
| [docs/TERMUX_SETUP.md](docs/TERMUX_SETUP.md) | Detailed Termux setup guide |
| [docs/NEON_SETUP.md](docs/NEON_SETUP.md) | Neon PostgreSQL setup |
| [docs/GMAIL_SETUP.md](docs/GMAIL_SETUP.md) | Gmail SMTP / App Password |
| [docs/NGROK_SETUP.md](docs/NGROK_SETUP.md) | Ngrok tunnel setup |

---

## Stack

| Component | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | Neon PostgreSQL (via Drizzle ORM) |
| Auth | JWT + bcryptjs |
| Email | Nodemailer + Gmail SMTP |
| Tunnel | Ngrok |
| AI | NVIDIA Gemma 3n (OpenAI-compatible API) |
| Process Mgmt | child_process (PM2-compatible) |

---

## Frontend Integration

This API is designed for a frontend hosted on **GitHub Pages or Vercel**.

- Base URL: `https://<your-ngrok-or-domain>/api`
- All authenticated endpoints require: `Authorization: Bearer <token>`
- See [docs/API.md](docs/API.md) for all endpoints

---

## License

MIT
