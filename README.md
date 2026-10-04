# 🌐 OmniDrive — Unified Cloud File System

<p align="center">
  <img src="apps/web/public/logo.svg" width="96" height="96" alt="OmniDrive Logo" />
</p>

<p align="center">
  <strong>One cohesive virtual filesystem spanning multiple Google Drive accounts.</strong><br>
  Browse, upload, download, preview, edit, move, copy, and search across all your Google Drives from a single unified interface.
</p>

<p align="center">
  <a href="#-deploying-on-render"><img src="https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Deploy to Render"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Fastify-4.27-black?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/Prisma-PostgreSQL-38BDF8?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma">
</p>

---

## ✨ Features

- **Unified Virtual Filesystem**: Browse every connected Google Drive from one virtual root (`/`) or view all files in a merged catalog.
- **Smart Upload Placement Strategies**:
  - `most_free` *(default)*: Automatically routes uploads to the account with the largest available free space that can fit the file.
  - `fill_first`: Fills accounts sequentially in a user-customized priority order.
  - `manual`: Target a specific account and folder directly.
- **In-Browser Monaco Code & Text Editor**:
  - Full syntax highlighting (TypeScript, JavaScript, Python, Markdown, JSON, HTML, CSS, SQL, etc.).
  - Save directly to Google Drive (`Ctrl+S` / `Cmd+S`).
  - Revision concurrency conflict detection (`HTTP 409`) with remote reload or overwrite resolution.
- **Rich Media Previews**:
  - Zoom and pan image viewer.
  - Embedded PDF viewer.
  - Audio and video players with HTTP `Range` streaming and seeking support.
  - Direct links and export options (PDF, DOCX, XLSX, PPTX, etc.) for Google-native Docs/Sheets/Slides.
- **Cross-Account Transfers**:
  - Stream files and recurse folders directly between different Google accounts without writing to local disk.
  - Collision policies: `keep_both`, `replace`, or `skip`.
  - Real-time transfer progress tracking via Server-Sent Events (SSE).
- **Security & Token Encryption**:
  - Google OAuth refresh tokens are encrypted at rest with **AES-256-GCM** using unique random IVs per token.
  - Tokens never leave the backend.
  - Strict IDOR and ownership checks on every composite node ID.
- **Zero-Friction Demo Mode & FakeDrive**:
  - Includes a built-in `FakeDriveClient` and in-memory database fallback so you can test all features (multi-account browsing, chunked uploads, Monaco editor, cross-account move) immediately without needing Google Cloud credentials.

---

## 🏗️ Architecture & Monorepo Layout

```
OmniDrive/
├── apps/
│   ├── api/            # Fastify backend with Drive clients, sync, upload & transfer services
│   ├── web/            # React 18 + Vite + Tailwind CSS + Zustand + Monaco Editor frontend
│   └── worker/         # BullMQ background worker for distributed cross-account transfers
├── packages/
│   └── shared/         # Shared TypeScript interfaces, types, and Zod validation schemas
├── infra/              # Dockerfiles, init SQL, and Nginx configurations
├── docker-compose.yml  # Local multi-container development environment
├── render.yaml         # Blueprint specification for 1-click deployment on Render
└── package.json        # Monorepo workspaces orchestrator
```

### Virtual File System Addressing
- Node IDs use composite strings: `"<accountId>:<driveFileId>"`.
- Account roots use `"<accountId>:root"`.
- The top-level virtual root is `"root"` or `"/"` (presents linked accounts as top-level drives).

---

## 🚀 Deploying on Render

OmniDrive is designed to deploy smoothly on **Render** using either Render Blueprints (`render.yaml`) or a unified Web Service.

### Option A: 1-Click Blueprint Deploy (Recommended)

1. Fork or push this repository to your GitHub/GitLab account.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
3. Connect your repository. Render will automatically detect [`render.yaml`](./render.yaml).
4. Render will provision:
   - **`omnidrive-app`** (Web Service: Node.js Fastify API + static React SPA frontend)
   - **`omnidrive-postgres`** (Managed PostgreSQL database)
   - **`omnidrive-redis`** (Managed Redis instance for BullMQ queues)
5. Fill in your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (see instructions below), or leave them empty to use Demo Mode.
6. Click **Apply**. Render will run the build, apply Prisma migrations, and launch OmniDrive.

### Option B: Single Web Service (Free / Starter Tier Friendly)

Because Fastify serves the React web build when `SERVE_STATIC=true` and runs workers in-process when `IN_PROCESS_WORKER=true`, you can run the entire system inside a **single Render Web Service**:

1. Click **New +** → **Web Service** on Render.
2. Connect your repository.
3. Configure the following settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
4. In **Environment Variables**, set:
   ```env
   NODE_ENV=production
   PORT=10000
   SERVE_STATIC=true
   IN_PROCESS_WORKER=true
   SESSION_SECRET=<generate a random 32+ char string>
   TOKEN_ENCRYPTION_KEY=<generate a 32-byte base64 string>
   DATABASE_URL=<your Render PostgreSQL connection string>
   ENABLE_DEMO_ACCOUNTS=true
   ```
5. Click **Create Web Service**.

---

## 🔑 Google Cloud OAuth 2.0 Setup Guide (< 15 Minutes)

To connect real Google Drive accounts to your OmniDrive instance:

### Step 1: Create a Google Cloud Project
1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** → **New Project**. Name it `OmniDrive` and click **Create**.

### Step 2: Enable the Google Drive API
1. In the sidebar, navigate to **APIs & Services** → **Library**.
2. Search for **Google Drive API** and click **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**.
2. Select User Type:
   - **External** (standard for personal accounts).
3. Fill in:
   - **App name**: `OmniDrive`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**, add `https://www.googleapis.com/auth/drive`, and click **Update**.
6. Under **Test Users**, click **+ ADD USERS** and enter the email addresses of the Google accounts you plan to link.
   > ⚠️ **Important Caveat for Testing Mode**: In Testing mode, Google refresh tokens expire after **7 days**. If an account expires, OmniDrive will automatically display a **"Reconnect"** button in the UI. For permanent access without weekly re-authorizing, publish the consent screen or use a Google Workspace Internal app.

### Step 4: Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. Application type: **Web application**. Name: `OmniDrive Web Client`.
3. Under **Authorized redirect URIs**, add:
   - For local development: `http://localhost:3000/api/accounts/callback`
   - For Render deployment: `https://<your-app-subdomain>.onrender.com/api/accounts/callback`
4. Click **Create**. Copy your **Client ID** and **Client Secret**.

---

## 💻 Local Development Quickstart

### Prerequisites
- Node.js 20+
- npm 10+

### 1. Clone & Install
```bash
git clone https://github.com/your-username/OmniDrive.git
cd OmniDrive
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*(Optionally fill in your Google credentials, or leave them blank to use Demo Mode).*

### 3. Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Paste this value into `TOKEN_ENCRYPTION_KEY` in `.env`.

### 4. Build and Start
```bash
# Build all workspaces
npm run build

# Start the full-stack server (Fastify API + React SPA)
SERVE_STATIC=true npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 5. Running in Development Mode with Hot Reload
```bash
# Terminal 1: Fastify API
npm run dev:api

# Terminal 2: Vite React Frontend
npm run dev:web
```
Open **[http://localhost:5173](http://localhost:5173)**.

---

## 🧪 Testing

OmniDrive includes an automated Vitest suite covering encryption, health, registration, session management, virtual root browsing, folder creation, resumable chunked uploads, Monaco text editing with 409 conflict detection, cross-account move jobs, and search:

```bash
npm test
```

---

## 🛠️ Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Application environment (`development` or `production`) | `development` |
| `PORT` | HTTP server port | `3000` (`10000` on Render) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `REDIS_URL` | Redis / KeyDB connection string for BullMQ | `redis://localhost:6379` |
| `SESSION_SECRET` | Secret string for signing session JWT cookies (min 32 chars) | Generated |
| `TOKEN_ENCRYPTION_KEY` | Exactly 32 bytes base64 string for AES-256-GCM token encryption | Generated |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `""` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `""` |
| `GOOGLE_REDIRECT_URI` | OAuth callback redirect target | `http://localhost:3000/api/accounts/callback` |
| `GOOGLE_SCOPES` | Google Drive OAuth scopes | `https://www.googleapis.com/auth/drive` |
| `UPLOAD_CHUNK_BYTES` | Resumable upload chunk size in bytes | `8388608` (8 MiB) |
| `SYNC_INTERVAL_SECONDS`| Periodic account sync interval | `120` |
| `SERVE_STATIC` | Serve React static SPA build directly from Fastify | `true` in production |
| `IN_PROCESS_WORKER` | Run BullMQ / transfer workers in-process with the API server | `true` |
| `ENABLE_DEMO_ACCOUNTS` | Provide simulated Google Drive accounts for instant exploration | `true` |

---

## 📄 License

MIT License. Built for seamless unified multi-account cloud storage.
